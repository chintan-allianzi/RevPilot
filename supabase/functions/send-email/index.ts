import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action,
      email,
      appPassword,
      displayName,
      to,
      subject,
      body,
      replyToMessageId,
    } = await req.json();

    if (!email || !appPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email or appPassword" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const client = new SmtpClient();

    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: email,
      password: appPassword,
    });

    if (action === "test") {
      await client.send({
        from: `${displayName || email} <${email}>`,
        to: email,
        subject: "Office Beacon Outbound — Gmail Connected!",
        content:
          "Your Gmail account has been successfully connected to Office Beacon Outbound.",
        html: `<div style="font-family:sans-serif;padding:20px;">
          <h2>✅ Gmail Connected</h2>
          <p>Your Gmail account has been successfully connected to Office Beacon Outbound.</p>
          <p>You can now send campaign emails directly from this account.</p>
          <hr/><p style="color:#888;font-size:12px;">This is an automated test email.</p>
        </div>`,
      });

      await client.close();
      return new Response(
        JSON.stringify({ success: true, message: "Test email sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "send") {
      if (!to || !subject || !body) {
        await client.close();
        return new Response(
          JSON.stringify({ success: false, error: "Missing to, subject, or body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const emailOptions: any = {
        from: `${displayName || email} <${email}>`,
        to,
        subject,
        html: body.replace(/\n/g, "<br/>"),
      };

      if (replyToMessageId) {
        emailOptions.headers = {
          "In-Reply-To": replyToMessageId,
          References: replyToMessageId,
        };
      }

      await client.send(emailOptions);
      await client.close();

      return new Response(
        JSON.stringify({ success: true, message: "Email sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await client.close();
    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
