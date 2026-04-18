import { supabase } from "@/integrations/supabase/client";

const APOLLO_DEBUG = false;

function logApolloDebug(...args: unknown[]) {
  if (APOLLO_DEBUG) {
    console.log(...args);
  }
}

interface ApolloProxyRequest {
  endpoint: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  apolloApiKey: string;
}

interface ApolloProxyResponse {
  status: number;
  ok: boolean;
  data: unknown;
}

async function resolveApolloApiKey(fallbackApiKey?: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("data_providers")
      .select("api_key")
      .eq("provider_key", "apollo")
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data?.api_key) {
      return data.api_key;
    }
  } catch {
    // fall back to the caller-provided key
  }

  return fallbackApiKey || "";
}

async function callApollo(request: ApolloProxyRequest): Promise<ApolloProxyResponse> {
  const endpoint = request.endpoint.replace(/^\/+/, "");
  const proxyRequest = {
    ...request,
    endpoint,
  };

  logApolloDebug("=== APOLLO REQUEST DEBUG ===");
  logApolloDebug("Edge function:", "apollo-proxy");
  logApolloDebug("Endpoint being called:", endpoint);
  logApolloDebug("API key present:", !!request.apolloApiKey);
  logApolloDebug("API key first 8 chars:", request.apolloApiKey?.substring(0, 8) || "missing");
  logApolloDebug("Request body:", JSON.stringify(request.body || {}));

  const { data, error } = await supabase.functions.invoke("apollo-proxy", {
    body: proxyRequest,
  });

  if (error) {
    throw new Error(`Proxy error: ${error.message}`);
  }

  logApolloDebug("Apollo proxy response:", data);

  return data as ApolloProxyResponse;
}

/**
 * Validate an Apollo API key via the proxy edge function.
 */
export async function validateApolloKeyViaProxy(apiKey: string): Promise<boolean> {
  try {
    const result = await callApollo({
      endpoint: "mixed_companies/search",
      method: "POST",
      body: { per_page: 1, page: 1 },
      apolloApiKey: apiKey,
    });
    return result.status === 200;
  } catch {
    return false;
  }
}

/**
 * Test Apollo connection for both company and people search.
 * Returns detailed status for each endpoint.
 */
export async function testApolloConnection(apiKey: string): Promise<{
  companySearch: { ok: boolean; status: number };
  peopleSearch: { ok: boolean; status: number };
}> {
  const results = {
    companySearch: { ok: false, status: 0 },
    peopleSearch: { ok: false, status: 0 },
  };

  try {
    const companyResult = await callApollo({
      endpoint: "mixed_companies/search",
      method: "POST",
      body: { per_page: 1, page: 1 },
      apolloApiKey: apiKey,
    });
    results.companySearch = { ok: companyResult.ok, status: companyResult.status };
  } catch { /* keep defaults */ }

  try {
    const peopleResult = await callApollo({
      endpoint: "mixed_people/api_search",
      method: "POST",
      body: { page: 1, per_page: 1 },
      apolloApiKey: apiKey,
    });
    results.peopleSearch = { ok: peopleResult.ok, status: peopleResult.status };
  } catch { /* keep defaults */ }

  return results;
}

/**
 * Search for companies matching ICP criteria via the proxy.
 */
export async function searchCompaniesViaProxy(params: {
  apiKey: string;
  searchBody: Record<string, unknown>;
}): Promise<ApolloProxyResponse> {
  const result = await callApollo({
    endpoint: "mixed_companies/search",
    method: "POST",
    body: params.searchBody,
    apolloApiKey: params.apiKey,
  });

  if (result.status === 401 || result.status === 403) {
    throw new Error("Invalid Apollo API key. Please check your key in Settings.");
  }
  if (result.status === 429) {
    throw new Error("Apollo rate limit reached. Please wait a moment and try again.");
  }
  if (!result.ok) {
    throw new Error(`Apollo API error: ${result.status}`);
  }

  return result;
}

/**
 * Get job postings for a specific company via the proxy.
 */
export async function getCompanyJobPostings(params: {
  apiKey: string;
  organizationId: string;
}): Promise<unknown> {
  const result = await callApollo({
    endpoint: `organizations/${params.organizationId}/job_postings`,
    method: "GET",
    apolloApiKey: params.apiKey,
  });
  return result.data;
}

/**
 * Search for decision makers using multiple parameter formats.
 * Tries each format until one returns results.
 * Now requests emails in search results directly.
 */
export async function searchDecisionMakers(params: {
  apiKey: string;
  companyDomains: string[];
  buyerPersonaTitles: string[];
  perCompany?: number;
}): Promise<{ people: any[]; debug: any[] }> {
  const { apiKey, companyDomains, buyerPersonaTitles, perCompany = 5 } = params;
  const resolvedApiKey = await resolveApolloApiKey(apiKey);

  if (!resolvedApiKey) {
    throw new Error("No Apollo API key configured. Please save your Apollo API key in Settings.");
  }

  const perPage = Math.min(companyDomains.length * perCompany, 100);

  // Common email-requesting params to include in all search attempts
  const emailParams = {
    reveal_personal_emails: false,
    reveal_phone_number: true,
    // Don't filter by email status — we want ALL contacts, even those without verified emails
  };

  const attempts = [
    {
      label: "Format 1: organization_domains + person_titles",
      body: { page: 1, per_page: perPage, organization_domains: companyDomains, person_titles: buyerPersonaTitles, ...emailParams },
    },
    {
      label: "Format 2: q_organization_domains (newline) + person_titles",
      body: { page: 1, per_page: perPage, q_organization_domains: companyDomains.join("\n"), person_titles: buyerPersonaTitles, ...emailParams },
    },
    {
      label: "Format 3: organization_domains + q_person_title",
      body: { page: 1, per_page: perPage, organization_domains: companyDomains, q_person_title: buyerPersonaTitles.join(" OR "), ...emailParams },
    },
    {
      label: "Format 4: q_organization_domains + q_person_title",
      body: { page: 1, per_page: perPage, q_organization_domains: companyDomains.join("\n"), q_person_title: buyerPersonaTitles.join(" OR "), ...emailParams },
    },
    {
      label: "Format 5: organization_domains only (no title filter)",
      body: { page: 1, per_page: perPage, organization_domains: companyDomains, ...emailParams },
    },
  ];

  const debugLog: any[] = [];
  let all403 = true;

  for (const attempt of attempts) {
    logApolloDebug("=== APOLLO PEOPLE SEARCH DEBUG ===");
    logApolloDebug("Format:", attempt.label);
    logApolloDebug("API key first 8 chars:", resolvedApiKey.substring(0, 8));
    logApolloDebug("Request body:", JSON.stringify(attempt.body));

    try {
      const result = await callApollo({
        endpoint: "mixed_people/api_search",
        method: "POST",
        body: attempt.body,
        apolloApiKey: resolvedApiKey,
      });

      if (result.status !== 403) all403 = false;

      const data = result.data as Record<string, any> | null;
      const responseKeys = data ? Object.keys(data) : [];
      const totalEntries = (data as any)?.pagination?.total_entries || 0;

      const people = extractPeopleFromResponse(data);

      const withEmail = people.filter((p: any) => p.email || p.primary_email);
      const emailFields = people.length > 0 ? Object.keys(people[0]).filter(k => k.toLowerCase().includes('email')) : [];

      const attemptDebug: any = {
        format: attempt.label,
        status: result.status,
        totalEntries,
        responseKeys,
        peopleFound: people.length,
        peopleWithEmail: withEmail.length,
        emailFieldsFound: emailFields,
        sampleKeys: people.length > 0 ? Object.keys(people[0]) : [],
        samplePerson: people.length > 0 ? JSON.stringify(people[0]).substring(0, 600) : null,
        rawPreview: JSON.stringify(data).substring(0, 600),
      };

      if (totalEntries > 0 && people.length === 0) {
        attemptDebug.warning = `${totalEntries} entries exist but extraction failed`;
      }

      debugLog.push(attemptDebug);
      logApolloDebug("People search result:", attemptDebug);

      if (people.length > 0) {
        logApolloDebug(`SUCCESS with ${attempt.label}: ${people.length} people, ${withEmail.length} with email`);
        return { people, debug: debugLog };
      }
    } catch (error: any) {
      debugLog.push({ format: attempt.label, error: error.message });
      logApolloDebug(`${attempt.label} failed:`, error.message);
    }
  }

  logApolloDebug("All formats tried, none returned people.");
  
  if (all403) {
    return { people: [], debug: debugLog, authFailed: true } as any;
  }
  
  return { people: [], debug: debugLog };
}

/**
 * Extract people from an Apollo response, trying multiple field names.
 */
export function extractPeopleFromResponse(data: any): any[] {
  if (!data) return [];

  const possibleFields = ["people", "contacts", "results", "persons", "leads", "matches"];
  for (const field of possibleFields) {
    if (Array.isArray(data[field]) && data[field].length > 0) {
      logApolloDebug(`Found ${data[field].length} people in field "${field}"`);
      return data[field];
    }
  }

  // Auto-detect: find any array with person-like objects
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      const sample = data[key][0];
      if (sample && (sample.first_name || sample.name || sample.email || sample.person)) {
        logApolloDebug(`Auto-detected people in field "${key}" (${data[key].length} items)`);
        return data[key];
      }
    }
  }

  return [];
}

/**
 * Enrich a person to get their email address.
 * Uses Apollo's documented parameters: id, first_name, last_name, domain, linkedin_url.
 * Does NOT use reveal_phone_number (requires webhook).
 */
export async function enrichPerson(params: {
  apiKey: string;
  personId?: string;
  firstName?: string;
  lastName?: string;
  organizationDomain?: string;
  linkedinUrl?: string;
}): Promise<any> {
  const { apiKey, personId, firstName, lastName, organizationDomain, linkedinUrl } = params;
  const resolvedApiKey = await resolveApolloApiKey(apiKey);

  if (!resolvedApiKey) {
    throw new Error("No Apollo API key configured. Please save your Apollo API key in Settings.");
  }

  // Method 1: people/match by ID
  if (personId) {
    try {
      const result = await callApollo({
        endpoint: "people/match",
        method: "POST",
        body: { id: personId, reveal_personal_emails: false },
        apolloApiKey: resolvedApiKey,
      });
      if (result.ok && (result.data as any)?.person) {
        logApolloDebug("enrichPerson: matched by ID");
        return (result.data as any).person;
      }
      if (result.status === 403) {
        logApolloDebug("enrichPerson: people/match returned 403 (endpoint may require higher plan)");
      }
    } catch (e) {
      logApolloDebug("enrichPerson by id failed:", e);
    }
  }

  // Method 2: people/match by name + domain (using Apollo's documented `domain` field)
  if (firstName && lastName && organizationDomain) {
    try {
      const result = await callApollo({
        endpoint: "people/match",
        method: "POST",
        body: {
          first_name: firstName,
          last_name: lastName,
          domain: organizationDomain,
          reveal_personal_emails: false,
        },
        apolloApiKey: resolvedApiKey,
      });
      if (result.ok && (result.data as any)?.person) {
        logApolloDebug("enrichPerson: matched by name+domain");
        return (result.data as any).person;
      }
    } catch (e) {
      logApolloDebug("enrichPerson by name+domain failed:", e);
    }
  }

  // Method 3: people/match by LinkedIn URL
  if (linkedinUrl) {
    try {
      const result = await callApollo({
        endpoint: "people/match",
        method: "POST",
        body: { linkedin_url: linkedinUrl, reveal_personal_emails: false },
        apolloApiKey: resolvedApiKey,
      });
      if (result.ok && (result.data as any)?.person) {
        logApolloDebug("enrichPerson: matched by linkedin");
        return (result.data as any).person;
      }
    } catch (e) {
      logApolloDebug("enrichPerson by linkedin failed:", e);
    }
  }

  // Method 4 (FALLBACK): Use mixed_people/api_search with very specific filters
  if (firstName && lastName && organizationDomain) {
    try {
      logApolloDebug("enrichPerson: falling back to mixed_people/api_search");
      const result = await callApollo({
        endpoint: "mixed_people/api_search",
        method: "POST",
        body: {
          page: 1,
          per_page: 1,
          organization_domains: [organizationDomain],
          q_person_name: `${firstName} ${lastName}`,
          reveal_personal_emails: false,
        },
        apolloApiKey: resolvedApiKey,
      });
      if (result.ok) {
        const people = extractPeopleFromResponse(result.data as any);
        if (people.length > 0) {
          const person = people[0];
          logApolloDebug("enrichPerson: found via search fallback, email:", person.email || "none");
          return person;
        }
      }
    } catch (e) {
      logApolloDebug("enrichPerson search fallback failed:", e);
    }
  }

  return null;
}

/**
 * Bulk enrich contacts via Apollo's POST /people/bulk_match endpoint.
 * Accepts an array of details objects and returns enriched person records.
 * Apollo supports up to 10 records per batch.
 */
export async function bulkEnrichPeople(params: {
  apiKey: string;
  details: Array<{
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    domain?: string;
    linkedin_url?: string;
  }>;
}): Promise<{ matches: any[]; debug: any }> {
  const resolvedApiKey = await resolveApolloApiKey(params.apiKey);
  if (!resolvedApiKey) {
    throw new Error("No Apollo API key configured.");
  }

  const allMatches: any[] = [];
  const debugInfo: any[] = [];
  const BATCH_SIZE = 10; // Apollo bulk_match limit

  for (let i = 0; i < params.details.length; i += BATCH_SIZE) {
    const batch = params.details.slice(i, i + BATCH_SIZE);

    try {
      const result = await callApollo({
        endpoint: "people/bulk_match",
        method: "POST",
        body: {
          reveal_personal_emails: false,
          details: batch,
        },
        apolloApiKey: resolvedApiKey,
      });

      const data = result.data as any;
      const matches = data?.matches || data?.people || [];
      
      debugInfo.push({
        batchIndex: Math.floor(i / BATCH_SIZE),
        batchSize: batch.length,
        status: result.status,
        matchesReturned: matches.length,
      });

      allMatches.push(...matches);

      // Brief pause between batches to avoid rate limiting
      if (i + BATCH_SIZE < params.details.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err: any) {
      debugInfo.push({
        batchIndex: Math.floor(i / BATCH_SIZE),
        batchSize: batch.length,
        error: err.message,
      });
      logApolloDebug("bulkEnrichPeople batch failed:", err.message);
    }
  }

  return { matches: allMatches, debug: debugInfo };
}

/**
 * Normalize a raw Apollo person object into a consistent shape.
 * Handles obfuscated surnames from search results vs full names from enrichment.
 */
export function normalizePerson(raw: any): {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  emailStatus: string;
  phone: string;
  linkedinUrl: string;
  photoUrl: string;
  apolloPersonId: string;
  companyName: string;
  companyDomain: string;
  hasEmail: boolean;
} {
  const p = raw.person || raw;
  const org = p.organization || raw.organization || p.org || {};

  // Last name: prefer full last_name, then try name splitting, then obfuscated as hint
  let lastName = p.last_name || p.lastName || "";
  if (!lastName && p.name) {
    const parts = p.name.split(" ");
    if (parts.length > 1) lastName = parts.slice(1).join(" ");
  }

  return {
    firstName: p.first_name || p.firstName || (p.name || "").split(" ")[0] || "",
    lastName,
    title: p.title || p.headline || p.job_title || "",
    email: p.email || p.primary_email || "",
    emailStatus: p.email_status || p.contact_email_status || (p.email ? "guessed" : "unavailable"),
    phone: p.phone_number || p.sanitized_phone || p.phone || "",
    linkedinUrl: p.linkedin_url || p.linkedinUrl || "",
    photoUrl: p.photo_url || p.photoUrl || "",
    apolloPersonId: p.id || raw.id || "",
    companyName: org.name || p.organization_name || p.company || "",
    companyDomain: org.primary_domain || org.domain || p.organization_domain || "",
    hasEmail: !!(p.email || p.primary_email) || p.has_email === true,
  };
}
