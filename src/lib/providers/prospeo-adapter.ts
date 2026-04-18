/**
 * Prospeo.io adapter — routes through the data-provider-proxy edge function.
 * Translates internal ICPFilters into Prospeo's native API format.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProviderSearchResult } from "./apollo-adapter";
import { ICPFilters } from "@/lib/company-types";

async function callProxy(action: string, payload: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke("data-provider-proxy", {
    body: { provider: "prospeo", action, payload },
  });
  if (error) throw new Error(`Prospeo proxy error: ${error.message}`);
  return data;
}

/**
 * Build Prospeo-native company search payload from internal ICPFilters.
 * Prospeo endpoint: POST /search-company
 * Native fields: company_industry, company_location_search, company_headcount_range
 */
function buildProspeoCompanySearchPayload(filters: ICPFilters) {
  const filtersObj: Record<string, any> = {};

  // company_industry → { include: [...] }
  const industries = filters.industriesToInclude?.length
    ? filters.industriesToInclude
    : (filters as any).industries;
  if (industries?.length > 0) {
    filtersObj.company_industry = { include: industries };
  }

  // company_headcount_custom → { min, max }
  const minEmp = parseInt(String(filters.companyMinSize || (filters as any).minEmployees)) || 51;
  const maxEmp = parseInt(String(filters.companyMaxSize || (filters as any).maxEmployees)) || 501;
  filtersObj.company_headcount_custom = { min: minEmp, max: maxEmp };

  // company_location_search → { include: [...] }
  if (filters.locations?.length > 0) {
    filtersObj.company_location_search = { include: filters.locations };
  }

  // company_keywords → { include: [...] } (tech stack + keywords merged)
  const keywords = [
    ...(filters.techStack || []),
    ...((filters as any).keywords || []),
  ].filter((k) => k && k.length >= 3 && k.length <= 50);
  if (keywords.length > 0) {
    filtersObj.company_keywords = { include: keywords };
  }

  return { page: filters.page || 1, filters: filtersObj };
}

// ========== Company Search ==========
export async function searchCompanies(
  _apiKey: string,
  filters: ICPFilters
): Promise<ProviderSearchResult> {
  try {
    const nativePayload = buildProspeoCompanySearchPayload(filters);
    console.log("[Prospeo Adapter] company_search payload:", JSON.stringify(nativePayload));
    let result = await callProxy("company_search", nativePayload);

    // If industry filter caused an INVALID_FILTERS error, retry without it
    if (!result.ok && result.data?.error_code === "INVALID_FILTERS" && nativePayload.filters?.company_industry) {
      console.log("[Prospeo Adapter] Industry filter invalid, retrying without it...");
      const retryPayload = { ...nativePayload, filters: { ...nativePayload.filters } };
      delete retryPayload.filters.company_industry;
      result = await callProxy("company_search", retryPayload);
    }

    if (!result.ok) {
      return {
        provider: "prospeo",
        success: false,
        data: [],
        error: result.error || `Prospeo error: ${result.status}`,
        statusCode: result.status,
        debug: { sentPayload: nativePayload, rawResponse: result },
      };
    }
    const companies = Array.isArray(result.data) ? result.data : [];
    return {
      provider: "prospeo",
      success: companies.length > 0,
      data: companies,
      statusCode: result.status,
      debug: { sentPayload: nativePayload, resultCount: companies.length },
    };
  } catch (err: any) {
    return { provider: "prospeo", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

// ========== Contact Search (with multi-attempt broadening) ==========
export interface ProspeoSearchOptions {
  companyNames?: string[];
  industries?: string[];
}

export async function searchContacts(
  _apiKey: string,
  domains: string[],
  titles: string[],
  perCompany: number,
  options?: ProspeoSearchOptions
): Promise<ProviderSearchResult> {
  try {
    const result = await callProxy("contact_search", {
      domains,
      titles,
      per_company: perCompany,
      company_names: options?.companyNames || [],
      industries: options?.industries || [],
    });

    const debug: any = {
      searchAttempts: result.searchAttempts || [],
      rawResponses: result.rawResponses || [],
    };

    // Surface rate-limit or attempt-level errors
    if (result.status === 429 || result.error?.includes("Rate limit")) {
      return { provider: "prospeo", success: false, data: [], error: "Rate limit reached — try again in a few minutes", statusCode: 429, debug };
    }

    if (!result.ok) {
      const errorMsg = result.error || result.data?.filter_error || result.data?.message || `Prospeo error: ${result.status}`;
      return { provider: "prospeo", success: false, data: [], error: errorMsg, statusCode: result.status, debug };
    }

    const people = Array.isArray(result.data) ? result.data : [];

    // If no people found, check attempts for specific errors to surface
    if (people.length === 0) {
      const attemptErrors = (result.searchAttempts || [])
        .filter((a: any) => !a.success)
        .map((a: any) => a.name)
        .join(", ");
      const msg = attemptErrors ? `No contacts found (failed attempts: ${attemptErrors})` : "No contacts found matching your criteria";
      return { provider: "prospeo", success: false, data: [], error: msg, statusCode: result.status, debug };
    }

    return {
      provider: "prospeo",
      success: true,
      data: people,
      statusCode: result.status,
      debug,
    };
  } catch (err: any) {
    return { provider: "prospeo", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

// ========== Email Lookup ==========
export async function lookupEmail(
  _apiKey: string,
  firstName: string,
  lastName: string,
  domain: string
): Promise<ProviderSearchResult> {
  try {
    const result = await callProxy("email_lookup", { firstName, lastName, domain });
    if (!result.ok) {
      return { provider: "prospeo", success: false, data: [], error: `Prospeo error: ${result.status}`, statusCode: result.status };
    }
    const enriched = result.data ? [result.data] : [];
    return { provider: "prospeo", success: enriched.length > 0, data: enriched, statusCode: result.status };
  } catch (err: any) {
    return { provider: "prospeo", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

// ========== Test Connection ==========
export async function testConnection(
  apiKey: string
): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const result = await callProxy("test", { api_key: apiKey });
    if (result.ok) {
      const credits = result.data?.credits_remaining;
      const msg = credits != null ? `Connected ✓ (${credits} credits remaining)` : "Connected ✓";
      return { ok: true, status: 200, message: msg };
    }
    if (result.status === 401 || result.status === 403) {
      return { ok: false, status: result.status, message: "Invalid API key — check your key at prospeo.io dashboard" };
    }
    return { ok: false, status: result.status, message: result.data?.error || `Error ${result.status}` };
  } catch (err: any) {
    return { ok: false, status: 0, message: "Could not reach Prospeo — check your internet connection" };
  }
}
