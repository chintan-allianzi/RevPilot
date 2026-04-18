/**
 * Clay adapter — routes through the data-provider-proxy edge function.
 * 
 * IMPORTANT: Clay does NOT have a public REST API for people/company search.
 * The standard Clay API key is for table/webhook operations only.
 * Clay enrichment works through webhooks and Clay's table interface.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProviderSearchResult } from "./apollo-adapter";

async function callProxy(action: string, payload: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke("data-provider-proxy", {
    body: { provider: "clay", action, payload },
  });
  if (error) throw new Error(`Clay proxy error: ${error.message}`);
  return data;
}

// Clay does NOT support direct contact search via REST API
export async function searchContacts(
  _apiKey: string,
  _domains: string[],
  _titles: string[],
  _perCompany: number
): Promise<ProviderSearchResult> {
  return {
    provider: "clay",
    success: false,
    data: [],
    error: "Clay does not support direct contact search. Clay works through webhooks and table operations.",
    statusCode: 400,
  };
}

// Clay does NOT support direct email lookup via REST API
export async function lookupEmail(
  _apiKey: string,
  _firstName: string,
  _lastName: string,
  _domain: string
): Promise<ProviderSearchResult> {
  return {
    provider: "clay",
    success: false,
    data: [],
    error: "Clay does not support direct email lookup. Clay works through webhooks and table operations.",
    statusCode: 400,
  };
}

export async function testConnection(apiKey: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const result = await callProxy("test", { api_key: apiKey });
    const errorMsg = result.data?.error;
    return {
      ok: result.ok,
      status: result.status,
      message: result.ok ? "Connected — Clay tables accessible" : (errorMsg || `Error ${result.status}`),
    };
  } catch (err: any) {
    return { ok: false, status: 0, message: `Could not reach Clay — ${err.message}` };
  }
}
