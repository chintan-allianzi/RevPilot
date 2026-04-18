/**
 * Apify adapter.
 * Provides connection testing, actor execution, and job posting search.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CompanyIntelligence } from "@/lib/company-types";

export async function testConnection(apiKey: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("data-provider-proxy", {
      body: { provider: "apify", action: "test", payload: { api_key: apiKey } },
    });

    if (error) {
      return { ok: false, status: 0, message: "Proxy error: " + error.message };
    }

    if (data?.ok) {
      const username = data?.data?.username;
      return { ok: true, status: 200, message: username ? `Connected as ${username}` : "Connected ✓" };
    }

    return { ok: false, status: data?.status || 401, message: data?.data?.error || "Invalid API token" };
  } catch (err: any) {
    return { ok: false, status: 0, message: err.message || "Connection failed" };
  }
}

/* ── Job Posting types ── */
export interface JobPostingResult {
  jobTitle: string;
  companyName: string;
  companyDomain?: string;
  companyWebsite?: string;
  location?: string;
  postedDate?: string;
  salary?: string;
  description?: string;
  url?: string;
  source?: string;
}

/* ── Run an Apify Actor and poll for results ── */
export async function searchJobPostings(
  keywords: string[],
  location: string,
  actorId: string,
  maxItems: number = 50,
): Promise<{ success: boolean; jobs: JobPostingResult[]; error?: string }> {
  try {
    // Build actor input based on common Indeed/LinkedIn scraper conventions
    const input: Record<string, any> = {
      position: keywords.join(", "),
      country: location || "US",
      location: location || "",
      maxItems,
    };

    // Some actors use "queries" or "search" instead
    if (actorId.includes("indeed")) {
      input.queries = keywords.map(k => `${k} ${location || ""}`).join("\n");
    }

    // 1. Start the actor run
    const { data: runData, error: runError } = await supabase.functions.invoke("data-provider-proxy", {
      body: { provider: "apify", action: "run_actor", payload: { actor_id: actorId, input } },
    });

    if (runError || !runData?.ok) {
      return { success: false, jobs: [], error: runData?.data?.error || runError?.message || "Failed to start actor" };
    }

    const runId = runData.data?.data?.id;
    if (!runId) {
      return { success: false, jobs: [], error: "No run ID returned" };
    }

    // 2. Poll for completion (max 5 minutes)
    const maxWait = 300_000;
    const interval = 5_000;
    let elapsed = 0;
    let status = "";
    let datasetId = "";

    while (elapsed < maxWait) {
      await new Promise(r => setTimeout(r, interval));
      elapsed += interval;

      const { data: statusData } = await supabase.functions.invoke("data-provider-proxy", {
        body: { provider: "apify", action: "get_run", payload: { run_id: runId } },
      });

      status = statusData?.data?.data?.status || statusData?.data?.status || "";
      datasetId = statusData?.data?.data?.defaultDatasetId || statusData?.data?.defaultDatasetId || "";

      if (status === "SUCCEEDED" || status === "FINISHED") break;
      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        return { success: false, jobs: [], error: `Actor run ${status.toLowerCase()}` };
      }
    }

    if (!datasetId) {
      return { success: false, jobs: [], error: "Actor run timed out or no dataset produced" };
    }

    // 3. Fetch dataset items
    const { data: datasetData } = await supabase.functions.invoke("data-provider-proxy", {
      body: { provider: "apify", action: "get_dataset", payload: { dataset_id: datasetId } },
    });

    const items: any[] = Array.isArray(datasetData?.data) ? datasetData.data : [];

    // 4. Normalize to JobPostingResult
    const jobs: JobPostingResult[] = items.map(normalizeJobItem);

    return { success: true, jobs };
  } catch (err: any) {
    return { success: false, jobs: [], error: err.message || "Job search failed" };
  }
}

/* ── Normalize different scraper output formats ── */
function normalizeJobItem(item: any): JobPostingResult {
  return {
    jobTitle: item.positionName || item.title || item.jobTitle || item.position || "",
    companyName: item.company || item.companyName || item.employer || item.organization || "",
    companyDomain: extractDomain(item.companyUrl || item.companyWebsite || item.company_url || ""),
    companyWebsite: item.companyUrl || item.companyWebsite || item.company_url || "",
    location: item.location || item.jobLocation || item.city || "",
    postedDate: item.postedAt || item.date || item.publishedAt || item.posted || "",
    salary: item.salary || item.compensation || "",
    description: item.description || item.snippet || "",
    url: item.url || item.link || item.jobUrl || "",
    source: item.source || "apify",
  };
}

function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }
}

/* ── Extract unique companies from job postings ── */
export function extractCompaniesFromJobs(jobs: JobPostingResult[]): CompanyIntelligence[] {
  const companyMap = new Map<string, { jobs: JobPostingResult[]; name: string; domain: string; location: string }>();

  for (const job of jobs) {
    const key = job.companyDomain || job.companyName.toLowerCase().replace(/\s+/g, "_");
    if (!key) continue;

    const existing = companyMap.get(key);
    if (existing) {
      existing.jobs.push(job);
    } else {
      companyMap.set(key, {
        name: job.companyName,
        domain: job.companyDomain || "",
        location: job.location || "",
        jobs: [job],
      });
    }
  }

  return Array.from(companyMap.values()).map((entry): CompanyIntelligence => ({
    id: crypto.randomUUID(),
    name: entry.name,
    domain: entry.domain,
    industry: "",
    employees: 0,
    revenue: "",
    location: entry.location,
    description: "",
    growth12mo: 0,
    growth24mo: 0,
    relevantJobPostings: entry.jobs.map(j => j.jobTitle),
    relevantJobCount: entry.jobs.length,
    techStack: [],
    linkedinUrl: "",
    logoUrl: "",
    apolloOrgId: "",
    basicScore: Math.min(100, entry.jobs.length * 20),
    basicTier: entry.jobs.length >= 3 ? "T1" : entry.jobs.length >= 2 ? "T2" : "T3",
    selected: true,
  }));
}
