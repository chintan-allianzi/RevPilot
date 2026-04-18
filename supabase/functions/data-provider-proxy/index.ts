import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { provider, action, payload } = await req.json();

    if (!provider || !action) {
      return new Response(
        JSON.stringify({ error: "provider and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: providerRow } = await supabaseAdmin
      .from("data_providers")
      .select("api_key, config")
      .eq("provider_key", provider)
      .eq("is_active", true)
      .maybeSingle();

    const apiKey = payload?.api_key || providerRow?.api_key;

    if (!apiKey) {
      console.log(`No API key found for provider: ${provider}`);
      return new Response(
        JSON.stringify({ ok: false, status: 401, data: null, error: `No API key configured for ${provider}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyPrefix = apiKey.substring(0, 5);
    console.log(`data-provider-proxy: provider=${provider}, action=${action}, key=${keyPrefix}...`);

    let result: { ok: boolean; status: number; data: any; [key: string]: any };

    switch (provider) {
      case "clay":
        result = await handleClay(apiKey, action, payload);
        break;
      case "seamless_ai":
        result = await handleSeamlessAI(apiKey, action, payload);
        break;
      case "zoominfo":
        result = await handleZoomInfo(apiKey, action, payload);
        break;
      case "prospeo":
        result = await handleProspeo(apiKey, action, payload);
        break;
      case "apify":
        result = await handleApify(apiKey, action, payload);
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, status: 400, error: `Unsupported provider: ${provider}. Use apollo-proxy for Apollo.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`data-provider-proxy result: provider=${provider}, action=${action}, status=${result.status}, ok=${result.ok}`);

    if (!result.ok && action === "test") {
      if (result.status === 401 || result.status === 403) {
        result.data = { error: "Invalid API key — please check your key and try again" };
      } else if (result.status === 404) {
        result.data = { error: "API endpoint not found — this is a configuration issue, not a key issue" };
      } else if (result.status === 429) {
        result.data = { error: "Rate limited — your key is valid but you've hit the rate limit. Try again in a minute." };
      } else if (result.status >= 500) {
        result.data = { error: `Server error — try again later` };
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("data-provider-proxy error:", error);
    return new Response(
      JSON.stringify({ ok: false, status: 500, error: error.message || "Proxy request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ========== CLAY ==========
async function handleClay(apiKey: string, action: string, payload: any): Promise<{ ok: boolean; status: number; data: any }> {
  const baseUrl = "https://api.clay.com/v3";
  const headers: Record<string, string> = { "Authorization": `Bearer ${apiKey}` };

  if (action === "test") {
    try {
      const res = await fetch(`${baseUrl}/tables`, { method: "GET", headers });
      return { ok: res.ok, status: res.status, data: null };
    } catch {
      try {
        const res2 = await fetch(`${baseUrl}/sources`, { method: "GET", headers });
        return { ok: res2.ok, status: res2.status, data: null };
      } catch {
        return { ok: false, status: 0, data: { error: "Could not reach Clay API" } };
      }
    }
  }

  return { ok: false, status: 400, data: { error: `Clay does not support direct ${action}. Clay works through webhooks and table operations.` } };
}

// ========== SEAMLESS.AI ==========
async function handleSeamlessAI(apiKey: string, action: string, payload: any): Promise<{ ok: boolean; status: number; data: any }> {
  const baseUrl = "https://api.seamless.ai/v1";
  const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };

  if (action === "test") {
    const res = await fetch(`${baseUrl}/contacts/search`, { method: "POST", headers, body: JSON.stringify({ limit: 1, filters: {} }) });
    return { ok: res.ok, status: res.status, data: null };
  }

  if (action === "contact_search") {
    const res = await fetch(`${baseUrl}/contacts/search`, {
      method: "POST", headers,
      body: JSON.stringify({ filters: { company_domains: payload.domains, job_titles: payload.titles }, limit: (payload.per_company || 5) * (payload.domains?.length || 1) }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data?.contacts || data?.results || data };
  }

  if (action === "email_lookup") {
    const res = await fetch(`${baseUrl}/contacts/enrich`, {
      method: "POST", headers,
      body: JSON.stringify({ first_name: payload.firstName, last_name: payload.lastName, company_domain: payload.domain }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  return { ok: false, status: 400, data: { error: `Unknown seamless_ai action: ${action}` } };
}

// ========== ZOOMINFO ==========
async function handleZoomInfo(apiKey: string, action: string, payload: any): Promise<{ ok: boolean; status: number; data: any }> {
  const baseUrl = "https://api.zoominfo.com";
  const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };

  if (action === "test") {
    const res = await fetch(`${baseUrl}/lookup/inputfields/company/search`, { method: "GET", headers });
    return { ok: res.ok, status: res.status, data: null };
  }

  if (action === "company_search") {
    const res = await fetch(`${baseUrl}/search/company`, {
      method: "POST", headers,
      body: JSON.stringify({
        companyName: payload.keywords?.join(" "),
        locationSearchType: "area",
        locationAreaCriteria: payload.locations?.map((l: string) => ({ country: l })),
        employeeCount: payload.min_employees && payload.max_employees ? { min: parseInt(payload.min_employees), max: parseInt(payload.max_employees) } : undefined,
        revenueRange: payload.min_revenue && payload.max_revenue ? { min: parseInt(payload.min_revenue), max: parseInt(payload.max_revenue) } : undefined,
        industries: payload.industries,
        excludeIndustries: payload.exclude_industries,
        rpp: payload.limit || 25,
        page: 1,
      }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data?.data || data };
  }

  if (action === "contact_search") {
    const res = await fetch(`${baseUrl}/search/contact`, {
      method: "POST", headers,
      body: JSON.stringify({ companyDomain: payload.domains, jobTitle: payload.titles, rpp: (payload.per_company || 5) * (payload.domains?.length || 1), page: 1 }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data?.data || data };
  }

  if (action === "email_lookup") {
    const res = await fetch(`${baseUrl}/enrich/contact`, {
      method: "POST", headers,
      body: JSON.stringify({ matchPersonInput: [{ firstName: payload.firstName, lastName: payload.lastName, companyDomain: payload.domain }] }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data?.data?.[0] || data };
  }

  return { ok: false, status: 400, data: { error: `Unknown zoominfo action: ${action}` } };
}

// ========== PROSPEO ==========
// Helper: map buyer persona titles to seniority levels
function mapTitlesToSeniority(titles: string[]): string[] {
  const seniorities = new Set<string>();
  for (const t of titles) {
    const tl = t.toLowerCase();
    if (/\b(founder|co-founder|owner)\b/.test(tl)) seniorities.add("Founder/Owner");
    if (/\b(cto|ceo|cfo|cio|ciso|coo|cmo|chief)\b/.test(tl)) seniorities.add("C-Suite");
    if (/\b(vp|vice president|svp|evp)\b/.test(tl)) seniorities.add("Vice President");
    if (/\bdirector\b/.test(tl)) seniorities.add("Director");
    if (/\b(head of|head,)\b/.test(tl)) seniorities.add("Head");
    if (/\b(manager|lead)\b/.test(tl)) seniorities.add("Manager");
    if (/\bsenior\b/.test(tl)) seniorities.add("Senior");
  }
  if (seniorities.size === 0) {
    seniorities.add("C-Suite");
    seniorities.add("Vice President");
    seniorities.add("Director");
  }
  return Array.from(seniorities);
}

interface SearchAttempt {
  name: string;
  filters: any;
  resultCount: number;
  success: boolean;
}

async function prospeoSearchPerson(
  baseUrl: string,
  headers: Record<string, string>,
  filters: any,
  attemptName: string,
): Promise<{ people: any[]; attempt: SearchAttempt; rawResponse: any; rateLimited?: boolean }> {
  const body = { page: 1, filters };
  console.log(`Prospeo attempt "${attemptName}": ${JSON.stringify(body)}`);

  const res = await fetch(`${baseUrl}/search-person`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);

  if (res.status === 429 || data?.error_code === "RATE_LIMIT" || (typeof data?.message === "string" && data.message.toLowerCase().includes("rate limit"))) {
    console.log(`Prospeo attempt "${attemptName}" error: Rate limit exceeded`);
    return {
      people: [],
      attempt: { name: attemptName, filters: body, resultCount: 0, success: false },
      rawResponse: data,
      rateLimited: true,
    };
  }

  if (!res.ok || data?.error) {
    const errorMsg = data?.filter_error || data?.message || data?.error_code || `HTTP ${res.status}`;
    console.log(`Prospeo attempt "${attemptName}" error: ${errorMsg}`);
    return {
      people: [],
      attempt: { name: attemptName, filters: body, resultCount: 0, success: false },
      rawResponse: data,
    };
  }

  const rawPeople = data?.result?.people || data?.result || data?.data || [];
  const people = (Array.isArray(rawPeople) ? rawPeople : []).map((p: any) => {
    const person = p.person || p;
    return {
      person_id: person.person_id || person.id,
      first_name: person.first_name || (person.full_name || person.name || "").split(" ")[0] || "",
      last_name: person.last_name || (person.full_name || person.name || "").split(" ").slice(1).join(" ") || "",
      name: person.full_name || person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
      title: person.current_job_title || person.job_title,
      company: person.company_name || person.company?.name,
      domain: person.company_website || person.company?.domain,
      linkedin_url: person.linkedin_url,
      location: person.location,
      email: person.email?.email || null,
      email_status: person.email?.status === "VERIFIED" ? "verified" : person.email?.status?.toLowerCase(),
    };
  });

  console.log(`Prospeo attempt "${attemptName}": ${people.length} results`);
  return {
    people,
    attempt: { name: attemptName, filters: body, resultCount: people.length, success: people.length > 0 },
    rawResponse: data,
  };
}

async function handleProspeo(apiKey: string, action: string, payload: any): Promise<{ ok: boolean; status: number; data: any; [key: string]: any }> {
  const baseUrl = "https://api.prospeo.io";
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-KEY": apiKey };

  if (action === "test") {
    try {
      const res = await fetch(`${baseUrl}/account-information`, { method: "POST", headers, body: JSON.stringify({}) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.error === false) {
        return { ok: true, status: 200, data: { credits_remaining: data?.credits_remaining } };
      }
      return { ok: false, status: res.status || 401, data: null };
    } catch {
      return { ok: false, status: 0, data: { error: "Could not reach Prospeo API" } };
    }
  }

  if (action === "company_search") {
    // Adapter sends pre-built { page, filters: { ... } } — pass through directly
    const searchBody = {
      page: payload.page || 1,
      filters: payload.filters || {},
    };
    // Remove api_key if accidentally included
    delete (searchBody as any).api_key;

    console.log("Prospeo company_search FINAL payload:", JSON.stringify(searchBody));

    const res = await fetch(`${baseUrl}/search-company`, { method: "POST", headers, body: JSON.stringify(searchBody) });
    const data = await res.json().catch(() => null);

    if (!res.ok || data?.error) {
      const errorMsg = data?.filter_error || data?.message || data?.error_code || `HTTP ${res.status}`;
      console.log("Prospeo company_search error response:", JSON.stringify(data));
      return { ok: false, status: res.status, data: data, error: `Prospeo: ${errorMsg}` };
    }

    // Prospeo returns { error: false, results: [...], pagination: {...} }
    const rawResults = data?.results || data?.result || data?.data || [];
    const companies = (Array.isArray(rawResults) ? rawResults : []).map((item: any) => {
      // Each result item may have a nested 'company' object
      const c = item.company || item;
      return {
        name: c.name || c.company_name,
        domain: c.domain || c.website,
        industry: c.industry,
        employees: c.employee_count || c.headcount || c.employees,
        revenue: c.revenue_range_printed || c.revenue,
        country: c.location?.country || c.country,
        city: c.location?.city || c.city,
        state: c.location?.state || c.state,
        location: c.location?.formatted || [c.city, c.state, c.country].filter(Boolean).join(", "),
        description: c.description,
        linkedin_url: c.linkedin_url,
        website_url: c.website || c.domain,
        logo_url: c.logo_url,
        tech_stack: c.technology?.technology_names || [],
        founded_year: c.founded_year,
      };
    });

    console.log(`Prospeo company_search: ${companies.length} companies returned`);
    return { ok: true, status: 200, data: companies };
  }

  if (action === "contact_search") {
    const domains: string[] = payload.domains || [];
    // Normalize titles: trim, skip very short ones
    const titles: string[] = (payload.titles || [])
      .map((t: string) => t.trim())
      .filter((t: string) => t.length >= 2);
    const companyNames: string[] = payload.company_names || [];
    const industries: string[] = payload.industries || [];
    const perCompany = payload.per_company || 50;

    const allAttempts: SearchAttempt[] = [];
    let allRawResponses: any[] = [];
    let foundPeople: any[] = [];
    let hitRateLimit = false;

    // Helper to run an attempt and check for rate limit
    async function tryAttempt(filters: any, name: string) {
      if (hitRateLimit || foundPeople.length > 0) return;
      const { people, attempt, rawResponse, rateLimited } = await prospeoSearchPerson(baseUrl, headers, filters, name);
      allAttempts.push(attempt);
      allRawResponses.push(rawResponse);
      if (rateLimited) { hitRateLimit = true; return; }
      if (people.length > 0) foundPeople = people;
    }

    // Attempt 1: Company websites + job titles
    if (domains.length > 0 && titles.length > 0) {
      await tryAttempt({
        company: { websites: { include: domains.slice(0, 500) } },
        person_job_title: { include: titles, match_only_exact_job_titles: false },
      }, "Company websites + job titles");
    }

    // Attempt 2: Company websites + seniority levels
    if (!hitRateLimit && foundPeople.length === 0 && domains.length > 0) {
      const seniorities = mapTitlesToSeniority(titles);
      await tryAttempt({
        company: { websites: { include: domains.slice(0, 500) } },
        person_seniority: { include: seniorities },
      }, "Company websites + seniority levels (" + seniorities.join(", ") + ")");
    }

    // Attempt 3: Company websites only (no title filter — broader)
    if (!hitRateLimit && foundPeople.length === 0 && domains.length > 0) {
      await tryAttempt({
        company: { websites: { include: domains.slice(0, 100) } },
      }, "Company websites only (broad)");
    }

    // Attempt 4: Company names + titles
    if (!hitRateLimit && foundPeople.length === 0 && companyNames.length > 0 && titles.length > 0) {
      await tryAttempt({
        company: { names: { include: companyNames.slice(0, 100) } },
        person_job_title: { include: titles, match_only_exact_job_titles: false },
      }, "Company names + job titles");
    }

    // Attempt 5: Industry-based (last resort)
    if (!hitRateLimit && foundPeople.length === 0 && industries.length > 0 && titles.length > 0) {
      await tryAttempt({
        company_industry: { include: industries },
        person_job_title: { include: titles, match_only_exact_job_titles: false },
        company_headcount_custom: { min: 51, max: 1000 },
      }, "Industry + job titles (broad)");
    }

    // Per-company limiting
    const domainCount: Record<string, number> = {};
    foundPeople = foundPeople.filter((p: any) => {
      const d = (p.domain || "unknown").toLowerCase();
      domainCount[d] = (domainCount[d] || 0) + 1;
      return domainCount[d] <= perCompany;
    });

    // Auto-enrich for emails
    const personIds = foundPeople.map((p: any) => p.person_id).filter(Boolean);
    if (personIds.length > 0) {
      console.log(`Prospeo: enriching ${personIds.length} contacts for emails...`);
      try {
        const enrichRes = await fetch(`${baseUrl}/bulk-enrich-person`, {
          method: "POST", headers,
          body: JSON.stringify({
            only_verified_email: false,
            enrich_mobile: true,
            data: personIds.slice(0, 50).map((id: string, i: number) => ({ identifier: String(i), person_id: id })),
          }),
        });
        const enrichData = await enrichRes.json().catch(() => null);
        if (enrichRes.ok && !enrichData?.error) {
          const enrichedList = enrichData?.result || enrichData?.data || [];
          const enrichMap = new Map<string, any>();
          for (const e of (Array.isArray(enrichedList) ? enrichedList : [])) {
            const ep = e.person || e;
            if (ep.person_id || ep.id) enrichMap.set(ep.person_id || ep.id, ep);
          }
          for (const p of foundPeople) {
            const enriched = enrichMap.get(p.person_id);
            if (enriched) {
              p.email = enriched.email?.email || p.email;
              p.email_status = enriched.email?.status === "VERIFIED" ? "verified" : (enriched.email?.status?.toLowerCase() || p.email_status);
              p.phone = enriched.mobile?.mobile || null;
            }
          }
          console.log(`Prospeo: enriched ${enrichMap.size}/${personIds.length} contacts`);
        }
      } catch (enrichErr) {
        console.log("Prospeo bulk enrich failed (non-fatal):", enrichErr);
      }
    }

    return {
      ok: true,
      status: hitRateLimit ? 429 : 200,
      data: foundPeople,
      searchAttempts: allAttempts,
      rawResponses: allRawResponses,
      error: hitRateLimit ? "Rate limit reached — try again in a few minutes" : undefined,
    };
  }

  if (action === "email_lookup") {
    // Prospeo enrich-person requires full_name (not separate first/last) + company_website
    const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(" ");
    const enrichBody: Record<string, any> = {
      only_verified_email: false,
      enrich_mobile: true,
      data: { full_name: fullName, company_website: payload.domain },
    };
    // If we have a linkedin URL, prefer that for higher match rate
    if (payload.linkedinUrl) {
      enrichBody.data.linkedin_url = payload.linkedinUrl;
    }
    const res = await fetch(`${baseUrl}/enrich-person`, {
      method: "POST", headers,
      body: JSON.stringify(enrichBody),
    });
    const data = await res.json().catch(() => null);
    const person = data?.result?.person || data?.result || data?.data || data;
    // Normalize the response to include email at top level
    const email = person?.email?.email || person?.email || null;
    const normalizedResult = {
      email,
      email_status: person?.email?.status === "VERIFIED" ? "verified" : (person?.email?.status?.toLowerCase() || "guessed"),
      first_name: person?.first_name || payload.firstName,
      last_name: person?.last_name || payload.lastName,
      phone_number: person?.mobile?.mobile || null,
      linkedin_url: person?.linkedin_url || payload.linkedinUrl || null,
    };
    return { ok: res.ok && !!email, status: res.status, data: normalizedResult };
}

  return { ok: false, status: 400, data: { error: `Unknown prospeo action: ${action}` } };
}

// ========== APIFY ==========
async function handleApify(apiKey: string, action: string, payload: any): Promise<{ ok: boolean; status: number; data: any }> {
  const baseUrl = "https://api.apify.com/v2";
  const headers: Record<string, string> = { "Authorization": `Bearer ${apiKey}` };

  if (action === "test") {
    try {
      const res = await fetch(`${baseUrl}/users/me`, { method: "GET", headers });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.data) {
        return { ok: true, status: 200, data: { username: data.data.username || data.data.id } };
      }
      return { ok: false, status: res.status || 401, data: null };
    } catch {
      return { ok: false, status: 0, data: { error: "Could not reach Apify API" } };
    }
  }

  if (action === "run_actor") {
    const actorId = payload?.actor_id;
    if (!actorId) return { ok: false, status: 400, data: { error: "actor_id is required" } };
    const input = payload?.input || {};
    const res = await fetch(`${baseUrl}/acts/${actorId}/runs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  if (action === "get_dataset") {
    const datasetId = payload?.dataset_id;
    if (!datasetId) return { ok: false, status: 400, data: { error: "dataset_id is required" } };
    const res = await fetch(`${baseUrl}/datasets/${datasetId}/items?format=json`, { headers });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  if (action === "get_run") {
    const runId = payload?.run_id;
    if (!runId) return { ok: false, status: 400, data: { error: "run_id is required" } };
    const res = await fetch(`${baseUrl}/actor-runs/${runId}`, { headers });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  if (action === "search_jobs") {
    const actorId = payload?.actor_id;
    if (!actorId) return { ok: false, status: 400, data: { error: "actor_id is required" } };
    const input = payload?.input || {};

    // 1. Start actor
    const startRes = await fetch(`${baseUrl}/acts/${actorId}/runs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const startData = await startRes.json().catch(() => null);
    if (!startRes.ok) return { ok: false, status: startRes.status, data: startData };

    const runId = startData?.data?.id;
    if (!runId) return { ok: false, status: 500, data: { error: "No run ID returned" } };

    // 2. Poll for completion (max 5 min)
    const maxWait = 300_000;
    const pollInterval = 5_000;
    let elapsed = 0;
    let runStatus = "";
    let datasetId = "";

    while (elapsed < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      elapsed += pollInterval;

      const statusRes = await fetch(`${baseUrl}/actor-runs/${runId}`, { headers });
      const statusData = await statusRes.json().catch(() => null);
      runStatus = statusData?.data?.status || "";
      datasetId = statusData?.data?.defaultDatasetId || "";

      if (runStatus === "SUCCEEDED" || runStatus === "FINISHED") break;
      if (runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") {
        return { ok: false, status: 500, data: { error: `Actor run ${runStatus}` } };
      }
    }

    if (!datasetId) return { ok: false, status: 504, data: { error: "Actor run timed out" } };

    // 3. Fetch dataset
    const dsRes = await fetch(`${baseUrl}/datasets/${datasetId}/items?format=json`, { headers });
    const dsData = await dsRes.json().catch(() => null);
    return { ok: true, status: 200, data: Array.isArray(dsData) ? dsData : [] };
  }

  return { ok: false, status: 400, data: { error: `Unknown apify action: ${action}` } };
}
