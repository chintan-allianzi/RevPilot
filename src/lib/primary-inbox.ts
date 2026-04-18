import { supabase } from "@/integrations/supabase/client";

/**
 * Get the primary email account for a given user.
 * Falls back to the first active account if no primary is set.
 * Used for deal-related transactional emails (meetings, proposals, nurture sequences).
 * NOT used for campaign outbound (those use multi-inbox round-robin).
 */
export async function getPrimaryEmailAccount(userId: string) {
  // Try primary first
  const { data: primary } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_active", true)
    .maybeSingle();

  if (primary) return primary;

  // Fallback: first active account
  const { data: fallback } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("connected_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return fallback || null;
}

/**
 * Get the primary email account for a deal's assigned BDM.
 * Looks up deals.assigned_to → that user's primary email account.
 */
export async function getPrimaryEmailAccountForDeal(dealId: string) {
  const { data: deal } = await supabase
    .from("deals")
    .select("assigned_to")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal?.assigned_to) return null;
  return getPrimaryEmailAccount(deal.assigned_to);
}

/**
 * Set an account as primary for its user, unsetting all others.
 */
export async function setAccountAsPrimary(accountId: string, userId: string) {
  // Unset all for this user
  await supabase
    .from("email_accounts")
    .update({ is_primary: false } as any)
    .eq("user_id", userId);

  // Set the chosen one
  await supabase
    .from("email_accounts")
    .update({ is_primary: true } as any)
    .eq("id", accountId)
    .eq("user_id", userId);
}
