import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function getEncryptionKey(): string {
  const key = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY not configured");
  return key;
}

/** Encrypt a token using pgcrypto via SQL. */
async function encryptToken(plainText: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("encrypt_token", {
    plain_text: plainText,
    encryption_key: getEncryptionKey(),
  });
  if (error) throw new Error("Encryption failed: " + error.message);
  return data as string;
}

/** Decrypt a token using pgcrypto via SQL. */
async function decryptToken(cipherText: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("decrypt_token", {
    cipher_text: cipherText,
    encryption_key: getEncryptionKey(),
  });
  if (error) throw new Error("Decryption failed: " + error.message);
  return data as string;
}

/** Build a raw RFC 2822 MIME message and base64url-encode it for the Gmail API. */
function buildMimeMessage(opts: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const lines: string[] = [];

  lines.push(`From: ${opts.from}`);
  lines.push(`To: ${opts.to}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push(`MIME-Version: 1.0`);

  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`);
    lines.push(`References: ${opts.references || opts.inReplyTo}`);
  }

  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push("");

  const plainText = opts.htmlBody
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  lines.push(`--${boundary}`);
  lines.push(`Content-Type: text/plain; charset="UTF-8"`);
  lines.push("");
  lines.push(plainText);
  lines.push("");

  lines.push(`--${boundary}`);
  lines.push(`Content-Type: text/html; charset="UTF-8"`);
  lines.push("");
  lines.push(opts.htmlBody);
  lines.push("");

  lines.push(`--${boundary}--`);

  const raw = lines.join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return encoded;
}

/** Fetch a fresh access token using a refresh token from Google. */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  return { access_token: tokenData.access_token, expires_in: tokenData.expires_in || 3600 };
}

/** Load an email account by ID, decrypt tokens, refresh if needed. Returns account with live access_token. */
async function loadAccountWithFreshToken(emailAccountId: string): Promise<any> {
  const sb = getSupabaseAdmin();
  const { data: account, error } = await sb
    .from("email_accounts")
    .select("*")
    .eq("id", emailAccountId)
    .eq("is_active", true)
    .single();

  if (error || !account) throw new Error("Email account not found or inactive");

  // Decrypt tokens
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  try {
    if (account.access_token) accessToken = await decryptToken(account.access_token);
    if (account.refresh_token) refreshToken = await decryptToken(account.refresh_token);
  } catch {
    // Tokens might be stored unencrypted (legacy). Try using them directly.
    accessToken = account.access_token;
    refreshToken = account.refresh_token;
  }

  // Check if access token needs refresh
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (!expiresAt || expiresAt <= fiveMinFromNow) {
    if (!refreshToken) throw new Error("No refresh token available. Please reconnect Gmail.");

    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.access_token;

    // Encrypt and save new access token
    const encryptedAccess = await encryptToken(accessToken);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await sb.from("email_accounts").update({
      access_token: encryptedAccess,
      token_expires_at: newExpiry,
    }).eq("id", emailAccountId);
  }

  return { ...account, _decrypted_access_token: accessToken, _decrypted_refresh_token: refreshToken };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return jsonResponse({ success: false, error: "Google OAuth not configured on server" }, 500);
    }

    /* ================================================================
       ACTION: get-client-id — return the public client ID to the frontend
       ================================================================ */
    if (action === "get-client-id") {
      return jsonResponse({ success: true, client_id: clientId });
    }

    /* ================================================================
       ACTION: exchange — swap authorization code for tokens (legacy)
       ================================================================ */
    if (action === "exchange") {
      const { code, redirect_uri } = body;
      if (!code || !redirect_uri) {
        return jsonResponse({ success: false, error: "Missing code or redirect_uri" }, 400);
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return jsonResponse({ success: false, error: tokenData.error_description || tokenData.error }, 400);
      }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      return jsonResponse({
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        email: userInfo.email,
        name: userInfo.name,
      });
    }

    /* ================================================================
       ACTION: connect — exchange code + encrypt tokens + save to DB
       ================================================================ */
    if (action === "connect") {
      const { code, redirect_uri, user_id } = body;
      if (!code || !redirect_uri || !user_id) {
        return jsonResponse({ success: false, error: "Missing code, redirect_uri, or user_id" }, 400);
      }

      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return jsonResponse({ success: false, error: tokenData.error_description || tokenData.error }, 400);
      }

      // Get user info
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      // Encrypt tokens
      const encryptedAccess = await encryptToken(tokenData.access_token);
      const encryptedRefresh = tokenData.refresh_token
        ? await encryptToken(tokenData.refresh_token)
        : null;

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Upsert by (user_id, email)
      const sb = getSupabaseAdmin();
      const { data: savedAccount, error: saveError } = await sb
        .from("email_accounts")
        .upsert(
          {
            user_id,
            email: userInfo.email,
            display_name: userInfo.name || userInfo.email.split("@")[0],
            provider: "gmail-oauth",
            access_token: encryptedAccess,
            refresh_token: encryptedRefresh,
            token_expires_at: expiresAt,
            daily_send_limit: 50,
            is_active: true,
            connected_at: new Date().toISOString(),
          },
          { onConflict: "user_id,email" },
        )
        .select()
        .single();

      if (saveError) {
        return jsonResponse({ success: false, error: "Failed to save account: " + saveError.message }, 500);
      }

      return jsonResponse({
        success: true,
        email: userInfo.email,
        name: userInfo.name,
        account_id: savedAccount.id,
      });
    }

    /* ================================================================
       ACTION: list-accounts — return accounts for a user (no tokens)
       ================================================================ */
    if (action === "list-accounts") {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ success: false, error: "Missing user_id" }, 400);

      const sb = getSupabaseAdmin();
      const { data: accounts, error } = await sb
        .from("email_accounts")
        .select("id, email, display_name, provider, is_active, daily_send_limit, connected_at, token_expires_at")
        .eq("user_id", user_id)
        .eq("is_active", true)
        .order("connected_at", { ascending: false });

      if (error) return jsonResponse({ success: false, error: error.message }, 500);

      return jsonResponse({ success: true, accounts: accounts || [] });
    }

    /* ================================================================
       ACTION: disconnect — deactivate an account
       ================================================================ */
    if (action === "disconnect") {
      const { email_account_id, user_id } = body;
      if (!email_account_id || !user_id) {
        return jsonResponse({ success: false, error: "Missing email_account_id or user_id" }, 400);
      }

      const sb = getSupabaseAdmin();
      const { error } = await sb
        .from("email_accounts")
        .update({ is_active: false })
        .eq("id", email_account_id)
        .eq("user_id", user_id);

      if (error) return jsonResponse({ success: false, error: error.message }, 500);

      return jsonResponse({ success: true });
    }

    /* ================================================================
       ACTION: refresh — get a new access token (legacy, kept for compat)
       ================================================================ */
    if (action === "refresh") {
      const { refresh_token, email_account_id } = body;

      // New path: use email_account_id
      if (email_account_id) {
        const account = await loadAccountWithFreshToken(email_account_id);
        return jsonResponse({
          success: true,
          access_token: account._decrypted_access_token,
          expires_in: 3600,
        });
      }

      // Legacy path: raw refresh_token
      if (!refresh_token) {
        return jsonResponse({ success: false, error: "Missing refresh_token or email_account_id" }, 400);
      }

      const refreshed = await refreshAccessToken(refresh_token);
      return jsonResponse({
        success: true,
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
      });
    }

    /* ================================================================
       ACTION: send — send email via Gmail API
       ================================================================ */
    if (action === "send") {
      const { email_account_id, access_token, from, displayName, to, subject, body: emailBody, replyToMessageId } = body;

      let liveAccessToken: string;
      let senderEmail: string = from || "";
      let senderDisplayName: string = displayName || "";

      if (email_account_id) {
        // New path: load account, decrypt, refresh if needed
        const account = await loadAccountWithFreshToken(email_account_id);
        liveAccessToken = account._decrypted_access_token;
        senderEmail = senderEmail || account.email;
        senderDisplayName = senderDisplayName || account.display_name || "";
      } else if (access_token) {
        // Legacy path
        liveAccessToken = access_token;
      } else {
        return jsonResponse({ success: false, error: "Missing email_account_id or access_token" }, 400);
      }

      if (!to || !subject || !emailBody) {
        return jsonResponse({ success: false, error: "Missing required send fields (to, subject, body)" }, 400);
      }

      const fromHeader = senderDisplayName ? `${senderDisplayName} <${senderEmail}>` : senderEmail;
      const htmlBody = emailBody.replace(/\n/g, "<br/>");

      const raw = buildMimeMessage({
        from: fromHeader,
        to,
        subject,
        htmlBody,
        inReplyTo: replyToMessageId || undefined,
        references: replyToMessageId || undefined,
      });

      const sendRes = await fetch(`${GMAIL_API_URL}/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${liveAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        return jsonResponse({
          success: false,
          error: sendData.error?.message || "Gmail API send failed",
        }, sendRes.status);
      }

      return jsonResponse({
        success: true,
        message: "Email sent via Gmail API",
        gmail_message_id: sendData.id,
        gmail_thread_id: sendData.threadId,
      });
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error("gmail-oauth error:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
});
