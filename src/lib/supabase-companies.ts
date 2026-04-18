import { supabase } from "@/integrations/supabase/client";
import { CompanyIntelligence } from "./company-types";

export async function saveCompaniesToDB(
  companies: CompanyIntelligence[],
  verticalId: string
) {
  const rows = companies.map((c) => ({
    vertical_id: verticalId,
    name: c.name,
    domain: c.domain || null,
    industry: c.industry || null,
    employees: typeof c.employees === "number" && c.employees > 0 ? c.employees : null,
    revenue: c.revenue || null,
    city: c.city || null,
    state: c.state || null,
    country: c.country || null,
    location: c.location || null,
    description: c.description || null,
    logo_url: c.logoUrl || null,
    linkedin_url: c.linkedinUrl || null,
    website_url: c.domain ? `https://${c.domain}` : null,
    apollo_org_id: c.apolloOrgId || null,
    growth_12mo: c.growth12mo || null,
    growth_24mo: c.growth24mo || null,
    tech_stack: c.techStack || [],
    keywords: [],
    basic_score: c.basicScore != null ? Math.round(c.basicScore) : 0,
    basic_tier: c.basicTier || "T3",
    ai_enrichment: c.aiEnrichment || null,
    ai_tier: c.aiTier || null,
    ai_score: c.aiScore != null ? Math.round(c.aiScore) : null,
    is_enriched: !!c.aiEnriched,
    enriched_at: c.aiEnriched ? new Date().toISOString() : null,
    status: c.aiEnriched ? "enriched" : "new",
    raw_data: null,
  }));

  const { data, error } = await supabase
    .from("saved_companies")
    .upsert(rows, { onConflict: "domain,vertical_id" })
    .select();

  if (error) {
    console.error("Failed to save companies:", error);
    throw error;
  }

  console.log(`Saved ${data?.length} companies to database`);
  return data;
}

export async function updateCompanyEnrichment(
  companyDomain: string,
  verticalId: string,
  enrichmentData: any
) {
  const { error } = await supabase
    .from("saved_companies")
    .update({
      ai_enrichment: enrichmentData,
      ai_tier: enrichmentData.tier,
      ai_score: enrichmentData.intent_score != null ? Math.round(enrichmentData.intent_score) : null,
      is_enriched: true,
      enriched_at: new Date().toISOString(),
      status: "enriched",
      updated_at: new Date().toISOString(),
    })
    .eq("domain", companyDomain)
    .eq("vertical_id", verticalId);

  if (error) console.error("Failed to update enrichment:", error);
}

export async function loadSavedCompanies(
  verticalId: string
): Promise<CompanyIntelligence[]> {
  const { data, error } = await supabase
    .from("saved_companies")
    .select("*")
    .eq("vertical_id", verticalId)
    .order("ai_score", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Failed to load saved companies:", error);
    return [];
  }

  return (data || []).map((row) => {
    const enrichment = row.ai_enrichment as any;
    return {
      id: row.id,
      name: row.name,
      domain: row.domain || "",
      industry: row.industry || "",
      employees: row.employees || 0,
      revenue: row.revenue || "",
      location: row.location || "",
      city: row.city || "",
      state: row.state || "",
      country: row.country || "",
      description: row.description || "",
      growth12mo: Number(row.growth_12mo) || 0,
      growth24mo: Number(row.growth_24mo) || 0,
      relevantJobPostings: [],
      relevantJobCount: 0,
      techStack: row.tech_stack || [],
      linkedinUrl: row.linkedin_url || "",
      logoUrl: row.logo_url || "",
      apolloOrgId: row.apollo_org_id || "",
      basicScore: row.basic_score || 0,
      basicTier: (row.basic_tier as any) || "T3",
      aiScore: row.ai_score ?? undefined,
      aiTier: (row.ai_tier as any) ?? undefined,
      aiEnriched: row.is_enriched || false,
      aiEnrichment: enrichment || undefined,
      intentSignals: enrichment?.signals_detected
        ? enrichment.signals_detected.filter((s: any) => s.detected).map((s: any) => ({
            signal: s.evidence || s.signal_name,
            strength: s.strength || 'moderate',
            icon: s.signal_id?.includes('growth') ? 'growth' : s.signal_id?.includes('tech') ? 'tech' : 'hiring',
          }))
        : enrichment?.intent_signals || [],
      outsourcingReadiness: enrichment?.outsourcing_readiness || undefined,
      techStackMatch: enrichment?.tech_stack_match || undefined,
      recommendedAngle: enrichment?.recommended_angle || "",
      riskFactors: enrichment?.risk_factors || [],
      tierReasoning: enrichment?.tier_reasoning || "",
      selected: false,
    };
  });
}
