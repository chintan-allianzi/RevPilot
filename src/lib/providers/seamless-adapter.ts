/**
 * Seamless.AI adapter — routes through the data-provider-proxy edge function.
 * Seamless.AI is used for contact search, contact enrichment, and email lookup.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProviderSearchResult } from "./apollo-adapter";

async function callProxy(action: string, payload: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke("data-provider-proxy", {
    body: { provider: "seamless_ai", action, payload },
  });
  if (error) throw new Error(`Seamless.AI proxy error: ${error.message}`);
  return data;
}

export async function searchContacts(
  _apiKey: string,
  domains: string[],
  titles: string[],
  perCompany: number
): Promise<ProviderSearchResult> {
  try {
    const result = await callProxy("contact_search", { domains, titles, per_company: perCompany });
    if (!result.ok) {
      return { provider: "seamless_ai", success: false, data: [], error: `Seamless.AI error: ${result.status}`, statusCode: result.status };
    }
    const people = Array.isArray(result.data) ? result.data : [];
    return { provider: "seamless_ai", success: people.length > 0, data: people, statusCode: result.status };
  } catch (err: any) {
    return { provider: "seamless_ai", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

export async function lookupEmail(
  _apiKey: string,
  firstName: string,
  lastName: string,
  domain: string
): Promise<ProviderSearchResult> {
  try {
    const result = await callProxy("email_lookup", { firstName, lastName, domain });
    if (result.ok && result.data?.email) {
      return { provider: "seamless_ai", success: true, data: [result.data], statusCode: 200 };
    }
    return { provider: "seamless_ai", success: false, data: [], statusCode: result.status || 200, error: "No email found" };
  } catch (err: any) {
    return { provider: "seamless_ai", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

export async function testConnection(apiKey: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const result = await callProxy("test", { api_key: apiKey });
    const errorMsg = result.data?.error;
    return {
      ok: result.ok,
      status: result.status,
      message: result.ok ? "Connected" : (errorMsg || `Error ${result.status}`),
    };
  } catch (err: any) {
    return { ok: false, status: 0, message: `Could not reach Seamless.AI — ${err.message}` };
  }
}
