/**
 * Generates a CAN-SPAM compliant email footer with unsubscribe link.
 * The token generation MUST match the server-side generateToken() in apollo-proxy.
 */

export async function generateUnsubscribeToken(email: string): Promise<string> {
  const secret = "ob-outbound-unsub-2026";
  const encoder = new TextEncoder();
  const data = encoder.encode(email + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);
}

export async function generateEmailFooter(params: {
  senderName: string;
  senderEmail: string;
  companyName?: string;
  companyAddress?: string;
  companyWebsite?: string;
  recipientEmail: string;
  campaignId?: string;
}): Promise<string> {
  const {
    senderName,
    companyName = "Office Beacon",
    companyAddress = "1234 Business Ave, Suite 100, New York, NY 10001",
    companyWebsite = "https://officebeacon.com",
    recipientEmail,
    campaignId,
  } = params;

  const token = await generateUnsubscribeToken(recipientEmail);
  const appUrl = window.location.origin;
  const unsubUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(recipientEmail)}&token=${token}${campaignId ? `&campaign=${campaignId}` : ""}&auto=1`;

  return `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e5e5;font-size:11px;color:#999;line-height:1.6;">
  <p style="margin:0;">${senderName} · ${companyName}</p>
  <p style="margin:4px 0 0;">${companyAddress}</p>
  <p style="margin:4px 0 0;"><a href="${companyWebsite}" style="color:#999;">${companyWebsite}</a></p>
  <p style="margin:12px 0 0;">
    If you'd prefer not to hear from us,
    <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">unsubscribe here</a>.
  </p>
</div>`;
}
