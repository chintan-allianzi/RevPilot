/**
 * Unified multi-provider data service with automatic failover.
 * Loads active providers from the data_providers table, tries them in priority order.
 */
import { supabase } from "@/integrations/supabase/client";
import { CompanyIntelligence, ICPFilters } from "@/lib/company-types";
import type { ProviderSearchResult } from "@/lib/providers/apollo-adapter";
import * as apolloAdapter from "@/lib/providers/apollo-adapter";
import * as clayAdapter from "@/lib/providers/clay-adapter";
import * as seamlessAdapter from "@/lib/providers/seamless-adapter";
import * as zoominfoAdapter from "@/lib/providers/zoominfo-adapter";
import * as prospeoAdapter from "@/lib/providers/prospeo-adapter";
import * as apifyAdapter from "@/lib/providers/apify-adapter";
import { getApiKey } from "@/lib/settings-storage";

export type { ProviderSearchResult } from "@/lib/providers/apollo-adapter";

export interface ProviderAttempt {
  provider: string;
  providerName: string;
  success: boolean;
  error?: string;
  statusCode?: number;
  resultCount: number;
}

export interface MultiProviderResult {
  provider: string;
  providerName: string;
  success: boolean;
  data: any[];
  attempts: ProviderAttempt[];
  debug?: any;
  failoverOccurred: boolean;
  failedProvider?: string;
}

interface DataProvider {
  id: string;
  provider_key: string;
  provider_name: string;
  provider_type: string[];
  api_key: string | null;
  config: Record<string, any> | null;
  is_active: boolean;
  priority_order: number;
  health_status: string;
}

// Cache providers for a short time to avoid re-querying
let cachedProviders: DataProvider[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export async function getActiveProviders(capability?: string): Promise<DataProvider[]> {
  const now = Date.now();
  if (cachedProviders && now - cacheTimestamp < CACHE_TTL_MS) {
    const filtered = capability
      ? cachedProviders.filter((p) => p.is_active && p.provider_type.includes(capability))
      : cachedProviders.filter((p) => p.is_active);
    return filtered.sort((a, b) => a.priority_order - b.priority_order);
  }

  const { data, error } = await supabase
    .from("data_providers")
    .select("*")
    .order("priority_order", { ascending: true });

  if (error) {
    console.error("Failed to load data providers:", error);
    // Fallback: try Apollo from localStorage
    const apolloKey = getApiKey("apollo");
    if (apolloKey) {
      return [{
        id: "fallback-apollo",
        provider_key: "apollo",
        provider_name: "Apollo.io",
        provider_type: ["company_search", "company_enrichment", "contact_search", "contact_enrichment", "email_lookup"],
        api_key: apolloKey,
        config: null,
        is_active: true,
        priority_order: 1,
        health_status: "unchecked",
      }];
    }
    return [];
  }

  cachedProviders = (data || []) as DataProvider[];
  cacheTimestamp = now;

  const filtered = capability
    ? cachedProviders.filter((p) => p.is_active && p.provider_type.includes(capability))
    : cachedProviders.filter((p) => p.is_active);
  return filtered.sort((a, b) => a.priority_order - b.priority_order);
}

export function invalidateProviderCache() {
  cachedProviders = null;
  cacheTimestamp = 0;
}

function getApiKeyForProvider(provider: DataProvider): string {
  // Provider's key from DB takes priority, then fall back to localStorage
  if (provider.api_key) return provider.api_key;
  if (provider.provider_key === "apollo") return getApiKey("apollo");
  if (provider.provider_key === "clay") return getApiKey("clay");
  return "";
}

function isRetryableError(statusCode?: number): boolean {
  return statusCode === 403 || statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 0;
}

// =========== Response Normalizer ===========
function normalizeCompanyResult(provider: string, raw: any): any {
  if (provider === "prospeo") {
    return {
      id: raw.id || raw.domain || crypto.randomUUID(),
      name: raw.name || raw.company_name || "",
      domain: raw.domain || raw.website || "",
      industry: raw.industry || "",
      employees: raw.employees || raw.employee_count || raw.headcount || 0,
      revenue: raw.revenue || raw.revenue_range_printed || "",
      country: raw.country || "",
      city: raw.city || "",
      state: raw.state || "",
      location: raw.location || "",
      description: raw.description || "",
      linkedinUrl: raw.linkedin_url || "",
      logoUrl: raw.logo_url || "",
      websiteUrl: raw.website_url || raw.domain || "",
      techStack: raw.tech_stack || [],
      growth12mo: 0,
      growth24mo: 0,
      relevantJobPostings: [],
      relevantJobCount: 0,
      apolloOrgId: "",
      basicScore: 50,
      basicTier: "T2" as const,
      selected: true,
    };
  }
  if (provider === "apollo") {
    return {
      id: raw.id || raw.apollo_org_id || raw.domain || crypto.randomUUID(),
      name: raw.name || "",
      domain: raw.primary_domain || raw.domain || "",
      industry: raw.industry || "",
      employees: raw.estimated_num_employees || raw.employees || 0,
      revenue: raw.revenue || "",
      revenueRaw: raw.annual_revenue || 0,
      country: raw.country || "",
      city: raw.city || raw.headquarters_city || "",
      state: raw.state || raw.headquarters_state || "",
      location: raw.location || [raw.headquarters_city, raw.headquarters_state].filter(Boolean).join(", "),
      description: raw.short_description || raw.description || "",
      linkedinUrl: raw.linkedin_url || "",
      logoUrl: raw.logo_url || "",
      websiteUrl: raw.website_url || raw.primary_domain || "",
      techStack: raw.tech_stack || raw.technology_names || [],
      growth12mo: raw.growth_12mo || raw.growth12mo || 0,
      growth24mo: raw.growth_24mo || raw.growth24mo || 0,
      relevantJobPostings: raw.relevantJobPostings || [],
      relevantJobCount: raw.relevantJobCount || 0,
      apolloOrgId: raw.apolloOrgId || raw.id || "",
      basicScore: raw.basicScore ?? 50,
      basicTier: raw.basicTier || "T2",
      selected: true,
    };
  }
  // Generic fallback
  return { ...raw, selected: true };
}

// =========== Company Search ===========
export async function searchCompanies(filters: ICPFilters): Promise<MultiProviderResult> {
  const providers = await getActiveProviders("company_search");
  const attempts: ProviderAttempt[] = [];

  for (const provider of providers) {
    const apiKey = getApiKeyForProvider(provider);
    if (!apiKey) {
      attempts.push({ provider: provider.provider_key, providerName: provider.provider_name, success: false, error: "No API key", resultCount: 0 });
      continue;
    }

    let result: ProviderSearchResult;

    switch (provider.provider_key) {
      case "apollo":
        result = await apolloAdapter.searchCompanies(apiKey, filters);
        break;
      case "prospeo":
        result = await prospeoAdapter.searchCompanies(apiKey, filters);
        break;
      case "zoominfo":
        result = await zoominfoAdapter.searchCompanies(apiKey, filters);
        break;
      default:
        attempts.push({ provider: provider.provider_key, providerName: provider.provider_name, success: false, error: "Provider doesn't support company search", resultCount: 0 });
        continue;
    }

    attempts.push({
      provider: provider.provider_key,
      providerName: provider.provider_name,
      success: result.success,
      error: result.error,
      statusCode: result.statusCode,
      resultCount: result.data.length,
    });

    if (result.success && result.data.length > 0) {
      // Normalize all results through the provider-specific normalizer
      const normalizedData = result.data.map((raw: any) => normalizeCompanyResult(provider.provider_key, raw));
      return {
        provider: provider.provider_key,
        providerName: provider.provider_name,
        success: true,
        data: normalizedData,
        attempts,
        debug: result.debug,
        failoverOccurred: attempts.length > 1,
        failedProvider: attempts.length > 1 ? attempts[0].providerName : undefined,
      };
    }

    if (!isRetryableError(result.statusCode)) break;
  }

  return {
    provider: "none",
    providerName: "None",
    success: false,
    data: [],
    attempts,
    failoverOccurred: attempts.length > 1,
  };
}

// =========== Contact Search ===========
export interface ContactSearchOptions {
  companyNames?: string[];
  industries?: string[];
}

export async function searchContacts(
  domains: string[],
  titles: string[],
  perCompany: number,
  options?: ContactSearchOptions
): Promise<MultiProviderResult> {
  const providers = await getActiveProviders("contact_search");
  const attempts: ProviderAttempt[] = [];

  for (const provider of providers) {
    const apiKey = getApiKeyForProvider(provider);
    if (!apiKey) {
      attempts.push({ provider: provider.provider_key, providerName: provider.provider_name, success: false, error: "No API key", resultCount: 0 });
      continue;
    }

    let result: ProviderSearchResult;

    switch (provider.provider_key) {
      case "apollo":
        result = await apolloAdapter.searchContacts(apiKey, domains, titles, perCompany);
        break;
      case "prospeo":
        result = await prospeoAdapter.searchContacts(apiKey, domains, titles, perCompany, {
          companyNames: options?.companyNames,
          industries: options?.industries,
        });
        break;
      case "seamless_ai":
        result = await seamlessAdapter.searchContacts(apiKey, domains, titles, perCompany);
        break;
      case "zoominfo":
        result = await zoominfoAdapter.searchContacts(apiKey, domains, titles, perCompany);
        break;
      default:
        continue;
    }

    attempts.push({
      provider: provider.provider_key,
      providerName: provider.provider_name,
      success: result.success,
      error: result.error,
      statusCode: result.statusCode,
      resultCount: result.data.length,
    });

    if (result.success && result.data.length > 0) {
      return {
        provider: provider.provider_key,
        providerName: provider.provider_name,
        success: true,
        data: result.data,
        attempts,
        debug: result.debug,
        failoverOccurred: attempts.length > 1,
        failedProvider: attempts.length > 1 ? attempts[0].providerName : undefined,
      };
    }

    // Always try next provider if current one returned 0 results or had a retryable error
    // Only stop failover on hard auth errors (401) that indicate a config problem, not empty results
    if (!result.success && result.data.length === 0) {
      // Continue to next provider — current one returned nothing
      console.log(`[DataProviderService] ${provider.provider_name} returned 0 contacts (status ${result.statusCode}), trying next provider...`);
      continue;
    }

    if (!isRetryableError(result.statusCode)) break;
  }

  return {
    provider: "none",
    providerName: "None",
    success: false,
    data: [],
    attempts,
    failoverOccurred: attempts.length > 1,
  };
}

// =========== Email Lookup ===========
// Track providers that are rate-limited during this session to skip them
const rateLimitedProviders = new Map<string, number>(); // provider_key -> timestamp

export async function lookupEmail(
  firstName: string,
  lastName: string,
  domain: string,
  personId?: string,
  linkedinUrl?: string
): Promise<MultiProviderResult> {
  const providers = await getActiveProviders("email_lookup");
  const attempts: ProviderAttempt[] = [];
  const now = Date.now();

  for (const provider of providers) {
    // Skip providers that were rate-limited in the last 5 minutes
    const rateLimitedAt = rateLimitedProviders.get(provider.provider_key);
    if (rateLimitedAt && now - rateLimitedAt < 5 * 60 * 1000) {
      console.log(`[DataProviderService] Skipping ${provider.provider_name} for email lookup — rate limited`);
      attempts.push({
        provider: provider.provider_key,
        providerName: provider.provider_name,
        success: false,
        error: "Rate limited — skipped",
        statusCode: 429,
        resultCount: 0,
      });
      continue;
    }

    const apiKey = getApiKeyForProvider(provider);
    if (!apiKey) continue;

    let result: ProviderSearchResult;

    switch (provider.provider_key) {
      case "apollo":
        result = await apolloAdapter.lookupEmail(apiKey, firstName, lastName, domain, personId, linkedinUrl);
        break;
      case "prospeo":
        result = await prospeoAdapter.lookupEmail(apiKey, firstName, lastName, domain);
        break;
      case "seamless_ai":
        result = await seamlessAdapter.lookupEmail(apiKey, firstName, lastName, domain);
        break;
      case "zoominfo":
        result = await zoominfoAdapter.lookupEmail(apiKey, firstName, lastName, domain);
        break;
      default:
        continue;
    }

    // If rate limited, mark this provider and continue to next
    if (result.statusCode === 429) {
      rateLimitedProviders.set(provider.provider_key, Date.now());
      console.log(`[DataProviderService] ${provider.provider_name} rate limited on email lookup, trying next provider...`);
      attempts.push({
        provider: provider.provider_key,
        providerName: provider.provider_name,
        success: false,
        error: "Rate limited",
        statusCode: 429,
        resultCount: 0,
      });
      continue;
    }

    attempts.push({
      provider: provider.provider_key,
      providerName: provider.provider_name,
      success: result.success,
      error: result.error,
      statusCode: result.statusCode,
      resultCount: result.data.length,
    });

    if (result.success && result.data.length > 0) {
      return {
        provider: provider.provider_key,
        providerName: provider.provider_name,
        success: true,
        data: result.data,
        attempts,
        failoverOccurred: attempts.length > 1,
        failedProvider: attempts.length > 1 ? attempts[0].providerName : undefined,
      };
    }
  }

  return {
    provider: "none",
    providerName: "None",
    success: false,
    data: [],
    attempts,
    failoverOccurred: false,
  };
}

// =========== Test Provider Connection ===========
export async function testProviderConnection(
  providerKey: string,
  apiKey: string
): Promise<{ ok: boolean; status: number; message: string }> {
  switch (providerKey) {
    case "apollo":
      return apolloAdapter.testConnection(apiKey);
    case "clay":
      return clayAdapter.testConnection(apiKey);
    case "seamless_ai":
      return seamlessAdapter.testConnection(apiKey);
    case "zoominfo":
      return zoominfoAdapter.testConnection(apiKey);
    case "prospeo":
      return prospeoAdapter.testConnection(apiKey);
    case "apify":
      return apifyAdapter.testConnection(apiKey);
    default:
      return { ok: false, status: 0, message: "Unknown provider" };
  }
}

// =========== Migrate Legacy Keys ===========
export async function migrateLegacyKeys(): Promise<void> {
  const apolloKey = getApiKey("apollo");
  const clayKey = getApiKey("clay");

  if (!apolloKey && !clayKey) return;

  const { data: providers } = await supabase
    .from("data_providers")
    .select("provider_key, api_key, is_active");

  if (!providers) return;

  for (const p of providers) {
    if (p.provider_key === "apollo" && apolloKey && !p.api_key) {
      await supabase
        .from("data_providers")
        .update({ api_key: apolloKey, is_active: true, updated_at: new Date().toISOString() } as any)
        .eq("provider_key", "apollo");
    }
    if (p.provider_key === "clay" && clayKey && !p.api_key) {
      await supabase
        .from("data_providers")
        .update({ api_key: clayKey, is_active: true, updated_at: new Date().toISOString() } as any)
        .eq("provider_key", "clay");
    }
  }

  invalidateProviderCache();
}
