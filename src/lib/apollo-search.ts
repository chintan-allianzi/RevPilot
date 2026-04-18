import { CompanyIntelligence, ICPFilters } from "./company-types";
import { searchCompaniesViaProxy } from "./apollo-api";

// Map user-friendly industry names to Apollo's organization_industries format
const INDUSTRY_TAG_MAP: Record<string, string[]> = {
  'insurance': ['insurance'],
  'insurance agency': ['insurance'],
  'financial services': ['financial services', 'banking'],
  'banking': ['banking'],
  'healthcare': ['hospital & health care', 'health, wellness and fitness', 'medical devices'],
  'technology': ['information technology and services', 'computer software'],
  'manufacturing': ['manufacturing', 'industrial automation'],
  'retail': ['retail', 'consumer goods'],
  'education': ['education management', 'e-learning', 'higher education'],
  'real estate': ['real estate', 'commercial real estate'],
  'construction': ['construction', 'building materials'],
  'legal': ['law practice', 'legal services'],
  'accounting': ['accounting'],
  'hospitality': ['hospitality', 'restaurants', 'food & beverages'],
  'transportation': ['transportation/trucking/railroad', 'logistics and supply chain'],
  'energy': ['oil & energy', 'renewables & environment'],
  'telecommunications': ['telecommunications'],
  'media': ['media production', 'online media'],
  'nonprofit': ['nonprofit organization management'],
  'government': ['government administration'],
  'pharmaceutical': ['pharmaceuticals'],
  'pharmaceuticals': ['pharmaceuticals'],
  'automotive': ['automotive'],
  'aerospace': ['aviation & aerospace'],
};

function mapToApolloIndustries(industries: string[]): string[] {
  const result: string[] = [];
  for (const input of industries) {
    const normalized = input.toLowerCase().trim();
    let matched = false;
    for (const [key, values] of Object.entries(INDUSTRY_TAG_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        result.push(...values);
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push(input.toLowerCase());
    }
  }
  return [...new Set(result)];
}

// Helper: Convert our min/max employee values to Apollo's range format
function buildEmployeeRanges(min: string, max: string): string[] {
  const allRanges = [
    "1,10", "11,20", "21,50", "51,100", "101,200",
    "201,500", "501,1000", "1001,2000", "2001,5000", "5001,10000", "10001,50000",
  ];

  const minNum = parseInt(min) || 1;
  const maxNum = parseInt(max) || 50000;

  return allRanges.filter((range) => {
    const [rangeMin, rangeMax] = range.split(",").map(Number);
    return rangeMax >= minNum && rangeMin <= maxNum;
  });
}

export interface ApolloSearchDebug {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

export async function searchApolloCompanies(
  apiKey: string,
  filters: ICPFilters
): Promise<{ companies: CompanyIntelligence[]; debug: ApolloSearchDebug }> {
  const employeeRanges = buildEmployeeRanges(filters.companyMinSize, filters.companyMaxSize);

  const searchBody: Record<string, unknown> = {
    page: filters.page || 1,
    per_page: filters.resultsLimit,
  };

  // Location filter
  if (filters.locations && filters.locations.length > 0) {
    searchBody.organization_locations = filters.locations;
  }

  // Employee count ranges
  if (employeeRanges.length > 0) {
    searchBody.organization_num_employees_ranges = employeeRanges;
  }

  // Use q_organization_keyword for keyword search across company profiles
  if (filters.jobTitles && filters.jobTitles.length > 0) {
    searchBody.q_organization_keyword = filters.jobTitles.join(" OR ");
  }

  // ===== Industry filtering =====
  if (filters.industriesToInclude && filters.industriesToInclude.length > 0) {
    // Apollo uses organization_industries for text-based industry filtering
    const matchedIndustries = mapToApolloIndustries(filters.industriesToInclude);
    if (matchedIndustries.length > 0) {
      searchBody.organization_industries = matchedIndustries;
    }
  }

  // Exclude industries
  if (filters.industriesToExclude && filters.industriesToExclude.length > 0) {
    const excludeMapped = mapToApolloIndustries(filters.industriesToExclude);
    if (excludeMapped.length > 0) {
      searchBody.organization_not_industries = excludeMapped;
    }
  }

  // Revenue filter - Apollo expects revenue_range with min/max in dollars
  if (filters.revenueMin && filters.revenueMin !== "0") {
    searchBody.revenue_range = { min: Number(filters.revenueMin) };
  }
  if (filters.revenueMax) {
    searchBody.revenue_range = {
      ...((searchBody.revenue_range as object) || {}),
      max: Number(filters.revenueMax),
    };
  }

  console.log("=== APOLLO SEARCH REQUEST ===");
  console.log("Body:", JSON.stringify(searchBody, null, 2));

  const debug: ApolloSearchDebug = {
    request: { ...searchBody },
    response: {},
  };

  try {
    const result = await searchCompaniesViaProxy({ apiKey, searchBody });

    const data = result.data as Record<string, unknown>;
    const responseKeys = data ? Object.keys(data) : [];

    // Extract companies from whichever field Apollo uses
    const orgs = extractCompanies(data);
    const fieldUsed = findCompanyField(data);

    debug.response = {
      status: result.status,
      responseKeys,
      fieldUsed,
      total_entries: (data.pagination as any)?.total_entries,
      companies_returned: orgs.length,
      first_company: orgs[0]?.name || "none",
      rawPreview: JSON.stringify(data).substring(0, 1000),
    };

    console.log("=== APOLLO SEARCH RESPONSE ===");
    console.log("Status:", result.status);
    console.log("Response keys:", responseKeys);
    console.log("Field used:", fieldUsed);
    console.log("Total results:", (data.pagination as any)?.total_entries);
    console.log("Companies returned:", orgs.length);
    if (orgs.length > 0) {
      console.log("First company sample:", JSON.stringify(orgs[0]).substring(0, 300));
    }

    const companies = orgs.map((raw: any, idx: number): CompanyIntelligence => {
      // Apollo nests some data under an "organization" key in mixed_companies/search
      const org = raw.organization || raw;

      const employees = org.estimated_num_employees || org.employee_count || org.num_employees
        || raw.estimated_num_employees || raw.employee_count || 0;
      const g12 = parseFloat(org.estimated_num_employees_growth_12mo || raw.estimated_num_employees_growth_12mo
        || org.organization_headcount_twelve_month_growth || 0) * (
        // Apollo sometimes returns as decimal (0.15) or percentage (15)
        Math.abs(parseFloat(org.estimated_num_employees_growth_12mo || org.organization_headcount_twelve_month_growth || 0)) > 5
          ? 1 : 100
      );
      const g24 = parseFloat(org.estimated_num_employees_growth_24mo || raw.estimated_num_employees_growth_24mo
        || org.organization_headcount_twenty_four_month_growth || 0) * (
        Math.abs(parseFloat(org.estimated_num_employees_growth_24mo || org.organization_headcount_twenty_four_month_growth || 0)) > 5
          ? 1 : 100
      );

      let score = 0;
      if (g12 >= 30) score += 40;
      else if (g12 >= 20) score += 30;
      else if (g12 >= 10) score += 20;
      else if (g12 >= 5) score += 10;
      if (g24 >= 50) score += 30;
      else if (g24 >= 30) score += 20;
      else if (g24 >= 15) score += 10;
      if (employees >= 200 && employees <= 5000) score += 10;

      const industry = org.industry || org.industry_tag_name || raw.industry || "";
      let tier: "T1" | "T2" | "T3" | "EXCLUDE" = "T3";
      if (score >= 60) tier = "T1";
      else if (score >= 35) tier = "T2";

      const excludePatterns = ["staffing", "recruiting", "employment services"];
      if (excludePatterns.some((p) => industry.toLowerCase().includes(p))) {
        tier = "EXCLUDE";
        score = 0;
      }

      return {
        id: org.id || raw.id || `apollo-${idx}`,
        name: org.name || raw.name || "Unknown",
        domain: org.primary_domain || org.domain || org.website_url || raw.primary_domain || "",
        industry,
        employees,
        revenue: org.annual_revenue_printed || org.annual_revenue || org.revenue_range
          || raw.annual_revenue_printed || "",
        revenueRaw: org.annual_revenue || raw.annual_revenue || 0,
        location: [
          org.city || org.hq_city || raw.city,
          org.state || org.hq_state || raw.state,
          org.country || org.hq_country || raw.country,
        ].filter(Boolean).join(", "),
        city: org.city || org.hq_city || raw.city || "",
        state: org.state || org.hq_state || raw.state || "",
        country: org.country || org.hq_country || raw.country || "",
        description: org.short_description || org.description || raw.short_description || "",
        growth12mo: Math.round(g12 * 10) / 10,
        growth24mo: Math.round(g24 * 10) / 10,
        relevantJobPostings: [],
        relevantJobCount: 0,
        techStack: org.technology_names || org.technologies || raw.technology_names || [],
        linkedinUrl: org.linkedin_url || raw.linkedin_url || "",
        logoUrl: org.logo_url || raw.logo_url || "",
        apolloOrgId: org.id || raw.id || "",
        basicScore: score,
        basicTier: tier,
        selected: tier === "T1",
      };
    });

    return { companies, debug };
  } catch (err: any) {
    debug.response = { error: err.message };
    console.error("Apollo search error:", err);
    throw err;
  }
}

// Extract companies from Apollo response - tries multiple known field names
function extractCompanies(data: any): any[] {
  if (!data) return [];

  // Try known Apollo response fields
  for (const field of ["organizations", "accounts", "companies", "results"]) {
    if (Array.isArray(data[field]) && data[field].length > 0) {
      console.log(`Found companies in field: "${field}" (${data[field].length} items)`);
      return data[field];
    }
  }

  // Fallback: find any array that looks like company data
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      const first = data[key][0];
      if (first && (first.name || first.organization_name) && (first.domain || first.primary_domain || first.website_url)) {
        console.log(`Found companies in fallback field: "${key}" (${data[key].length} items)`);
        return data[key];
      }
    }
  }

  return [];
}

function findCompanyField(data: any): string {
  if (!data) return "none";
  for (const field of ["organizations", "accounts", "companies", "results"]) {
    if (Array.isArray(data[field]) && data[field].length > 0) return field;
  }
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      const first = data[key][0];
      if (first && (first.name || first.organization_name)) return key;
    }
  }
  return "none";
}

// Simple search for debugging - minimal params
export async function simpleApolloSearch(apiKey: string): Promise<{ data: any; debug: ApolloSearchDebug }> {
  const searchBody = {
    page: 1,
    per_page: 10,
    organization_locations: ["United States"],
    organization_num_employees_ranges: ["51,100", "101,200", "201,500", "501,1000"],
  };

  console.log("=== SIMPLE APOLLO SEARCH ===");
  console.log("Body:", JSON.stringify(searchBody, null, 2));

  const result = await searchCompaniesViaProxy({ apiKey, searchBody });
  const data = result.data as Record<string, unknown>;
  const orgs = extractCompanies(data);

  const debug: ApolloSearchDebug = {
    request: searchBody,
    response: {
      status: result.status,
      responseKeys: data ? Object.keys(data) : [],
      fieldUsed: findCompanyField(data),
      total_entries: (data.pagination as any)?.total_entries,
      companies_returned: orgs.length,
      first_company: orgs[0]?.name || "none",
      rawPreview: JSON.stringify(data).substring(0, 1000),
    },
  };

  console.log("Simple search results:", debug.response);

  return { data: result.data, debug };
}

export const AI_ENRICHMENT_PROMPT = `You are a B2B sales intelligence analyst for Office Beacon, a remote staffing company.

Analyze this company and provide a comprehensive intelligence report for outbound sales targeting.

COMPANY DATA:
- Name: {name}
- Industry: {industry}
- Employees: {employees}
- Revenue: {revenue}
- HQ: {location}
- Description: {description}
- 12-month headcount growth: {growth12mo}%
- 24-month headcount growth: {growth24mo}%
- Currently hiring for: {relevantJobPostings}
- Tech stack detected: {techStack}
- LinkedIn URL: {linkedinUrl}

TARGET VERTICAL: {verticalName}
JOB TITLES WE'RE LOOKING FOR: {jobTitles}

Analyze and respond ONLY with this exact JSON structure:
\`\`\`json
{
  "intent_score": <number 0-100>,
  "tier": "T1" | "T2" | "T3" | "EXCLUDE",
  "intent_signals": [
    {"signal": "description of signal", "strength": "strong" | "moderate" | "weak", "icon": "hiring" | "growth" | "tech" | "funding" | "news"}
  ],
  "outsourcing_readiness": {
    "score": "high" | "medium" | "low",
    "reasons": ["reason 1", "reason 2"],
    "remote_indicators": true | false
  },
  "tech_stack_match": {
    "matched": ["tool1", "tool2"],
    "total_relevant": 6,
    "match_percentage": 67
  },
  "recommended_angle": "One sentence on the best sales angle for this company",
  "risk_factors": ["any concerns about targeting this company"],
  "tier_reasoning": "One sentence explaining why this tier was assigned"
}
\`\`\`

SCORING GUIDELINES:
- T1 (Score 70-100): Actively hiring for relevant roles + strong growth + good tech match + outsourcing-friendly industry. These are HOT leads.
- T2 (Score 40-69): Some hiring activity OR growth signals, moderate fit. Worth pursuing.
- T3 (Score 15-39): Low signals but still in ICP. Lower priority.
- EXCLUDE (Score 0-14): Staffing/recruiting companies, too small, wrong industry, or clear misfit.

Weight these factors:
- Active job postings for relevant roles: 30 points max
- Headcount growth >20%: 20 points max
- Tech stack match: 15 points max
- Company size sweet spot (200-5000): 10 points max
- Revenue indicates budget: 10 points max
- Outsourcing readiness signals: 15 points max`;

export function buildEnrichmentPrompt(
  company: CompanyIntelligence,
  verticalName: string,
  jobTitles: string[]
): string {
  return AI_ENRICHMENT_PROMPT
    .replace("{name}", company.name)
    .replace("{industry}", company.industry)
    .replace("{employees}", String(company.employees))
    .replace("{revenue}", company.revenue)
    .replace("{location}", company.location)
    .replace("{description}", company.description)
    .replace("{growth12mo}", String(company.growth12mo))
    .replace("{growth24mo}", String(company.growth24mo))
    .replace("{relevantJobPostings}", company.relevantJobPostings.join(", ") || "Unknown")
    .replace("{techStack}", company.techStack.join(", ") || "Unknown")
    .replace("{linkedinUrl}", company.linkedinUrl)
    .replace("{verticalName}", verticalName)
    .replace("{jobTitles}", jobTitles.join(", "));
}
