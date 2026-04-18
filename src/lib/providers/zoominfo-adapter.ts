/**
 * ZoomInfo adapter — routes through the data-provider-proxy edge function.
 * ZoomInfo supports company search, company enrichment, contact search, contact enrichment, email lookup.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProviderSearchResult } from "./apollo-adapter";
import type { ICPFilters } from "@/lib/company-types";

async function callProxy(action: string, payload: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke("data-provider-proxy", {
    body: { provider: "zoominfo", action, payload },
  });
  if (error) throw new Error(`ZoomInfo proxy error: ${error.message}`);
  return data;
}

export async function searchCompanies(_apiKey: string, filters: ICPFilters): Promise<ProviderSearchResult> {
  try {
    const result = await callProxy("company_search", {
      locations: filters.locations,
      industries: filters.industriesToInclude,
      exclude_industries: filters.industriesToExclude,
      min_employees: filters.companyMinSize,
      max_employees: filters.companyMaxSize,
      min_revenue: filters.revenueMin,
      max_revenue: filters.revenueMax,
      keywords: filters.jobTitles,
      limit: filters.resultsLimit,
    });
    if (!result.ok) {
      return { provider: "zoominfo", success: false, data: [], error: `ZoomInfo error: ${result.status}`, statusCode: result.status };
    }
    const companies = Array.isArray(result.data) ? result.data : [];
    return { provider: "zoominfo", success: companies.length > 0, data: companies, statusCode: result.status };
  } catch (err: any) {
    return { provider: "zoominfo", success: false, data: [], error: err.message, statusCode: 500 };
  }
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
      return { provider: "zoominfo", success: false, data: [], error: `ZoomInfo error: ${result.status}`, statusCode: result.status };
    }
    const people = Array.isArray(result.data) ? result.data : [];
    return { provider: "zoominfo", success: people.length > 0, data: people, statusCode: result.status };
  } catch (err: any) {
    return { provider: "zoominfo", success: false, data: [], error: err.message, statusCode: 500 };
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
      return { provider: "zoominfo", success: true, data: [result.data], statusCode: 200 };
    }
    return { provider: "zoominfo", success: false, data: [], statusCode: result.status || 200, error: "No email found" };
  } catch (err: any) {
    return { provider: "zoominfo", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

export async function testConnection(apiKey: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const result = await callProxy("test", { api_key: apiKey });
    return { ok: result.ok, status: result.status, message: result.ok ? "Connected" : `Error ${result.status}` };
  } catch (err: any) {
    return { ok: false, status: 0, message: err.message };
  }
}
