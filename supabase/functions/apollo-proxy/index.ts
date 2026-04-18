import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Token generation — must match client-side generateUnsubscribeToken()
async function generateToken(email: string): Promise<string> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") || "ob-outbound-unsub-2026";
  const encoder = new TextEncoder();
  const data = encoder.encode(email + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

function buildFooter(displayName: string, email: string, unsubUrl: string): string {
  return `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e5e5;font-size:11px;color:#999;line-height:1.6;">
  <p style="margin:0;">${displayName || email} · Office Beacon</p>
  <p style="margin:4px 0 0;">407 N Pacific Coast Hwy, Ste 584, Redondo Beach, CA, 90277 USA</p>
  <p style="margin:4px 0 0;"><a href="https://officebeacon.com" style="color:#999;">officebeacon.com</a></p>
  <p style="margin:12px 0 0;">
    If you'd prefer not to hear from us,
    <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">unsubscribe here</a>.
  </p>
</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();

    // ========== UNSUBSCRIBE HANDLER (public, no auth needed) ==========
    if (requestBody.action === "unsubscribe") {
      const { email, token, campaignId } = requestBody;

      if (!email || !token) {
        return new Response(
          JSON.stringify({ error: "Invalid unsubscribe link" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const expectedToken = await generateToken(email);
      if (token !== expectedToken) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin.from("email_optouts").upsert(
        { email, reason: "unsubscribed", campaign_id: campaignId || null, opted_out_at: new Date().toISOString() },
        { onConflict: "email" }
      );

      await supabaseAdmin
        .from("saved_contacts")
        .update({ opted_out: true, opted_out_at: new Date().toISOString() })
        .eq("email", email);

      await supabaseAdmin
        .from("email_queue")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("to_email", email)
        .eq("status", "scheduled");

      return new Response(
        JSON.stringify({ success: true, message: "Successfully unsubscribed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== PROCESS EMAIL QUEUE (cron / manual trigger) ==========
    if (requestBody.action === "process-email-queue") {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const now = new Date().toISOString();

      const { data: dueEmails, error: fetchError } = await supabaseAdmin
        .from("email_queue")
        .select("*, email_account:email_accounts(*)")
        .eq("status", "scheduled")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(20);

      if (fetchError || !dueEmails || dueEmails.length === 0) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0, message: "No emails due to send" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing ${dueEmails.length} scheduled emails`);
      let sentCount = 0;
      let failedCount = 0;

      for (const email of dueEmails) {
        // Check opt-out
        const { data: optOut } = await supabaseAdmin
          .from("email_optouts").select("id").eq("email", email.to_email).maybeSingle();

        if (optOut) {
          await supabaseAdmin.from("email_queue").update({
            status: "cancelled", error_message: "Contact opted out", updated_at: now,
          }).eq("id", email.id);
          continue;
        }

        // Check campaign status
        if (email.campaign_id) {
          const { data: campaign } = await supabaseAdmin
            .from("campaigns").select("status").eq("id", email.campaign_id).single();
          if (campaign?.status === "paused" || campaign?.status === "completed") continue;
        }

        // Check if earlier step got a reply
        if (email.sequence_step > 1 && email.contact_id) {
          const { data: replied } = await supabaseAdmin
            .from("email_queue").select("id")
            .eq("contact_id", email.contact_id)
            .eq("campaign_id", email.campaign_id)
            .eq("status", "replied")
            .maybeSingle();

          if (replied) {
            await supabaseAdmin.from("email_queue").update({
              status: "cancelled", error_message: "Contact replied to earlier step", updated_at: now,
            }).eq("id", email.id);
            continue;
          }
        }

        // Get email account
        const account = email.email_account;
        if (!account || !account.access_token) {
          await supabaseAdmin.from("email_queue").update({
            status: "failed", error_message: "No email account credentials found", updated_at: now,
          }).eq("id", email.id);
          failedCount++;
          continue;
        }

        // Mark as sending
        await supabaseAdmin.from("email_queue").update({ status: "sending", updated_at: now }).eq("id", email.id);

        try {
          const client = new SMTPClient({
            connection: {
              hostname: "smtp.gmail.com",
              port: 465,
              tls: true,
              auth: { username: account.email, password: account.access_token },
            },
          });

          const appUrl = Deno.env.get("APP_URL") || "https://id-preview--2ae16d58-feec-45b3-9d65-95c21b929b8c.lovable.app";
          const unsubToken = await generateToken(email.to_email);
          const unsubUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(email.to_email)}&token=${unsubToken}&auto=1`;
          const footer = buildFooter(account.display_name || account.email, account.email, unsubUrl);

          const emailBody = email.body.includes("<") ? email.body : email.body.replace(/\n/g, "<br/>");

          // For follow-ups, add "Re:" for threading
          let subject = email.subject;
          if (email.sequence_step > 1 && !subject.toLowerCase().startsWith("re:")) {
            const { data: step1 } = await supabaseAdmin
              .from("email_queue").select("subject")
              .eq("contact_id", email.contact_id)
              .eq("campaign_id", email.campaign_id)
              .eq("sequence_step", 1)
              .maybeSingle();
            if (step1) subject = `Re: ${step1.subject}`;
          }

          await client.send({
            from: account.display_name ? `${account.display_name} <${account.email}>` : account.email,
            to: email.to_email,
            subject,
            html: emailBody + footer,
          });

          await client.close();

          await supabaseAdmin.from("email_queue").update({
            status: "sent", sent_at: new Date().toISOString(), subject, error_message: null, updated_at: new Date().toISOString(),
          }).eq("id", email.id);

          sentCount++;

          // Throttle between sends
          await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000));
        } catch (sendError) {
          console.error(`Failed to send email ${email.id}:`, sendError);
          await supabaseAdmin.from("email_queue").update({
            status: "failed", error_message: sendError.message || "SMTP send failed", updated_at: new Date().toISOString(),
          }).eq("id", email.id);
          failedCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true, processed: dueEmails.length, sent: sentCount, failed: failedCount,
          message: `Processed ${dueEmails.length} emails: ${sentCount} sent, ${failedCount} failed`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== PROCESS NURTURE QUEUE ==========
    if (requestBody.action === "process-nurture-queue") {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const now = new Date().toISOString();

      const { data: dueItems, error: nFetchError } = await supabaseAdmin
        .from("nurture_queue")
        .select("*, step:nurture_steps(*), contact:saved_contacts(*), email_account:email_accounts(*)")
        .eq("status", "scheduled")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(20);

      if (nFetchError || !dueItems || dueItems.length === 0) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, sent: 0, message: "No nurture items due" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing ${dueItems.length} nurture queue items`);
      let nSent = 0;
      let nFailed = 0;

      for (const item of dueItems) {
        const step = item.step;
        const contact = item.contact;
        const account = item.email_account;

        if (!step || !contact) {
          await supabaseAdmin.from("nurture_queue").update({ status: "failed", error_message: "Missing step or contact" }).eq("id", item.id);
          nFailed++;
          continue;
        }

        // Only process email channel for now
        if (step.channel !== "email") {
          // For linkedin_message and task, just mark as sent (manual action needed)
          await supabaseAdmin.from("nurture_queue").update({ status: "sent", sent_at: now }).eq("id", item.id);
          nSent++;
          continue;
        }

        if (!account || !account.access_token) {
          await supabaseAdmin.from("nurture_queue").update({ status: "failed", error_message: "No email account" }).eq("id", item.id);
          nFailed++;
          continue;
        }

        // Check opt-out
        const { data: optOut } = await supabaseAdmin
          .from("email_optouts").select("id").eq("email", contact.email).maybeSingle();
        if (optOut) {
          await supabaseAdmin.from("nurture_queue").update({ status: "cancelled", error_message: "Opted out" }).eq("id", item.id);
          continue;
        }

        // Resolve template variables
        // Get deal info for sender
        const { data: dealData } = await supabaseAdmin
          .from("deals").select("assigned_to, vertical_id").eq("id", item.deal_id).maybeSingle();

        let senderName = account.display_name || "";
        let senderTitle = "";
        let senderCalLink = "";
        if (dealData?.assigned_to) {
          const { data: profile } = await supabaseAdmin
            .from("profiles").select("full_name, title, calendar_link").eq("id", dealData.assigned_to).maybeSingle();
          if (profile) {
            senderName = profile.full_name || senderName;
            senderTitle = profile.title || "";
            senderCalLink = profile.calendar_link || "";
          }
        }

        let verticalRole = "";
        if (dealData?.vertical_id) {
          const { data: vert } = await supabaseAdmin
            .from("verticals").select("name").eq("id", dealData.vertical_id).maybeSingle();
          verticalRole = vert?.name || "";
        }

        // Get company name
        let companyName = "";
        if (contact.company_id) {
          const { data: comp } = await supabaseAdmin
            .from("saved_companies").select("name").eq("id", contact.company_id).maybeSingle();
          companyName = comp?.name || "";
        }

        const replaceVars = (tpl: string) => tpl
          .replace(/\{\{first_name\}\}/g, contact.first_name || "")
          .replace(/\{\{company_name\}\}/g, companyName)
          .replace(/\{\{vertical_role\}\}/g, verticalRole)
          .replace(/\{\{meeting_link\}\}/g, senderCalLink)
          .replace(/\{\{sender_name\}\}/g, senderName)
          .replace(/\{\{sender_title\}\}/g, senderTitle)
          .replace(/\{\{sender_calendar_link\}\}/g, senderCalLink);

        const subject = replaceVars(step.subject_template || "Follow-up");
        const body = replaceVars(step.body_template);

        try {
          const client = new SMTPClient({
            connection: {
              hostname: "smtp.gmail.com",
              port: 465,
              tls: true,
              auth: { username: account.email, password: account.access_token },
            },
          });

          const appUrl = Deno.env.get("APP_URL") || "https://id-preview--2ae16d58-feec-45b3-9d65-95c21b929b8c.lovable.app";
          const unsubToken = await generateToken(contact.email);
          const unsubUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(contact.email)}&token=${unsubToken}&auto=1`;
          const footer = buildFooter(account.display_name || account.email, account.email, unsubUrl);

          const emailBody = body.includes("<") ? body : body.replace(/\n/g, "<br/>");

          await client.send({
            from: account.display_name ? `${account.display_name} <${account.email}>` : account.email,
            to: contact.email,
            subject,
            html: emailBody + footer,
          });
          await client.close();

          await supabaseAdmin.from("nurture_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", item.id);
          nSent++;

          // Throttle
          await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000));
        } catch (sendErr) {
          console.error(`Nurture send failed ${item.id}:`, sendErr);
          await supabaseAdmin.from("nurture_queue").update({ status: "failed", error_message: sendErr.message || "Send failed" }).eq("id", item.id);
          nFailed++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed: dueItems.length, sent: nSent, failed: nFailed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EMAIL SENDING MODE ==========
    if (requestBody.action === "test-email" || requestBody.action === "send-email") {
      const { email, appPassword, displayName, to, subject, body, action } = requestBody;

      if (!email || !appPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Email and app password are required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const client = new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 465,
            tls: true,
            auth: { username: email, password: appPassword },
          },
        });

        if (action === "test-email") {
          await client.send({
            from: displayName ? `${displayName} <${email}>` : email,
            to: email,
            subject: "Office Beacon Outbound - Gmail Connected!",
            content: "Your Gmail has been successfully connected.",
            html: `<div style="font-family:sans-serif;padding:20px"><h2>✅ Gmail Connected</h2><p>Your Gmail has been successfully connected to Office Beacon Outbound.</p><p>You can now send campaign emails from this account.</p><hr/><p style="color:#888;font-size:12px">This is an automated test.</p></div>`,
          });
          await client.close();
          return new Response(
            JSON.stringify({ success: true, message: "Test email sent" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (action === "send-email") {
          const appUrl = Deno.env.get("APP_URL") || "https://id-preview--2ae16d58-feec-45b3-9d65-95c21b929b8c.lovable.app";
          const unsubToken = await generateToken(to);
          const unsubUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(to)}&token=${unsubToken}&auto=1`;
          const footer = buildFooter(displayName || email, email, unsubUrl);

          const emailBody = body && body.includes("<") ? body : (body || "").replace(/\n/g, "<br/>");
          const fullHtml = emailBody + footer;

          await client.send({
            from: displayName ? `${displayName} <${email}>` : email,
            to,
            subject,
            html: fullHtml,
          });
          await client.close();
          return new Response(
            JSON.stringify({ success: true, message: "Email sent" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await client.close();
        return new Response(
          JSON.stringify({ success: false, error: "Unknown email action" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (smtpErr) {
        console.error("SMTP Error:", smtpErr);
        let errorMsg = smtpErr.message || "SMTP connection failed";
        if (errorMsg.includes("535") || errorMsg.includes("Username and Password not accepted")) {
          errorMsg = "Gmail rejected the password. Use a Google App Password, not your regular password. Visit: myaccount.google.com/apppasswords";
        }
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========== API PROXY MODE ==========
    const {
      endpoint, method, body, apolloApiKey,
      instantlyApiKey, version,
    } = requestBody;

    let fullUrl: string;
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let fetchMethod: string;
    let fetchBody: string | undefined;

    if (instantlyApiKey) {
      const baseUrl = version === "v2"
        ? "https://api.instantly.ai/api/v2/"
        : "https://api.instantly.ai/api/v1/";

      fullUrl = `${baseUrl}${endpoint}`;
      fetchMethod = (method || "POST").toUpperCase();

      if (version === "v2") {
        headers["Authorization"] = `Bearer ${instantlyApiKey}`;
      } else {
        const separator = fullUrl.includes("?") ? "&" : "?";
        fullUrl = `${fullUrl}${separator}api_key=${instantlyApiKey}`;
      }

      fetchBody = body && fetchMethod !== "GET" ? JSON.stringify(body) : undefined;

    } else if (apolloApiKey) {
      if (!endpoint) {
        return new Response(
          JSON.stringify({ error: "API endpoint is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      fullUrl = `https://api.apollo.io/api/v1/${endpoint}`;
      fetchMethod = method || "POST";

      // API key auth: send both header and body key for maximum compatibility
      console.log(`Apollo proxy: endpoint=${endpoint}, key=${apolloApiKey?.substring(0, 5)}..., method=${fetchMethod}`);
      headers["X-Api-Key"] = apolloApiKey;
      headers["Cache-Control"] = "no-cache";
      const bodyWithKey = fetchMethod !== "GET" ? { ...(body || {}), api_key: apolloApiKey } : body;
      fetchBody = bodyWithKey ? JSON.stringify(bodyWithKey) : undefined;

    } else {
      return new Response(
        JSON.stringify({ error: "No API key provided (apolloApiKey or instantlyApiKey required)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Proxy: ${fetchMethod} ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: fetchMethod,
      headers,
      body: fetchBody,
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawText: responseText.substring(0, 2000) };
    }

    console.log(`Proxy response status: ${response.status}`);

    return new Response(
      JSON.stringify({
        status: response.status,
        ok: response.ok,
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Proxy request failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
