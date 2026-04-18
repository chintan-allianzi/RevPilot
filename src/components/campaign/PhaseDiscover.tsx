import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, ChevronDown, ChevronUp, Sparkles,
  TrendingUp, TrendingDown, Minus, Building2,
  ExternalLink, Database, Briefcase, Bug, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyIntelligence, ICPFilters, COMPANY_SIZE_OPTIONS, REVENUE_OPTIONS, COMMON_INDUSTRIES } from "@/lib/company-types";
import { searchCompanies as searchCompaniesMulti, getActiveProviders, type MultiProviderResult } from "@/lib/data-provider-service";
import { callAIProvider } from "@/lib/ai-provider";
import { useAISettings } from "@/contexts/AISettingsContext";
import { getAIConfig } from "@/lib/settings-storage";
import { saveCompaniesToDB, loadSavedCompanies, updateCompanyEnrichment } from "@/lib/supabase-companies";
import { supabase } from "@/integrations/supabase/client";
import TagInput from "@/components/TagInput";
import { toast } from "sonner";
import type { SignalWeights } from "./PhaseTarget";
import type { VerticalConfig } from "@/lib/icp-config";

type EnrichmentStatus = "idle" | "enriching" | "enriched" | "partial" | "failed";
interface EnrichmentState { [companyId: string]: EnrichmentStatus; }

interface PhaseDiscoverProps {
  vertical: VerticalConfig;
  signalWeights: SignalWeights;
  onSelectCompanies: (companies: CompanyIntelligence[]) => void;
  showDebug?: boolean;
}

const SEARCH_MESSAGES = ["Searching data providers...", "Analyzing growth signals...", "Calculating intent scores...", "Preparing results..."];

function mapErrorCode(statusCode?: number, rawError?: string): string {
  if (statusCode === 401 || statusCode === 403) return "Invalid API key. Check Settings → Data Providers.";
  if (statusCode === 429) return "Rate limit reached — try again in a few minutes.";
  if (statusCode === 500 || statusCode === 502 || statusCode === 503) return "Provider server error — try again or switch providers.";
  return rawError || "Unknown error occurred.";
}

function SearchingOverlay({ verticalName }: { verticalName: string }) {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => { const i = setInterval(() => setMsgIdx((n) => (n + 1) % SEARCH_MESSAGES.length), 2500); return () => clearInterval(i); }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <div className="text-center space-y-1 mt-2">
        <p className="text-sm font-medium">Finding companies for {verticalName}</p>
        <p className="text-xs text-muted-foreground animate-pulse">{SEARCH_MESSAGES[msgIdx]}</p>
      </div>
    </div>
  );
}

function EnrichmentDot({ status }: { status: EnrichmentStatus }) {
  const colors: Record<EnrichmentStatus, string> = { idle: "bg-muted-foreground/30", enriching: "bg-amber-400 animate-pulse", enriched: "bg-emerald-500", partial: "bg-amber-500", failed: "bg-destructive" };
  const titles: Record<EnrichmentStatus, string> = { idle: "Not enriched", enriching: "Enriching...", enriched: "Fully enriched", partial: "Partially enriched", failed: "Enrichment failed" };
  return <span title={titles[status]} className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors[status]}`} />;
}

function CompanyCard({ company, enrichmentStatus, expanded, onToggleExpand, onToggleSelect }: {
  company: CompanyIntelligence; enrichmentStatus: EnrichmentStatus; expanded: boolean; onToggleExpand: () => void; onToggleSelect: () => void;
}) {
  const tier = company.aiTier || company.basicTier;
  const score = company.aiScore ?? company.basicScore;
  const enrichment = (company as any).aiEnrichment;
  const GrowthIcon = company.growth12mo > 10 ? TrendingUp : company.growth12mo < 0 ? TrendingDown : Minus;
  const growthColor = company.growth12mo > 10 ? "text-success" : company.growth12mo < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className={`transition-all ${company.selected ? "ring-1 ring-primary/40" : ""}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggleExpand}>
          <Checkbox checked={company.selected} onCheckedChange={() => onToggleSelect()} onClick={(e) => e.stopPropagation()} />
          <EnrichmentDot status={enrichmentStatus} />
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {company.logoUrl ? <img src={company.logoUrl} alt="" className="h-8 w-8 object-contain" /> : <span className="text-xs font-bold text-muted-foreground">{company.name.charAt(0)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{company.name}</p>{company.aiEnriched && <Sparkles className="h-3 w-3 text-primary shrink-0" />}</div>
            <p className="text-[11px] text-muted-foreground truncate">{company.location || company.industry || "—"}</p>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
            <span>{company.employees ? `${company.employees.toLocaleString()} emp` : "—"}</span>
            <span className={`flex items-center gap-0.5 ${growthColor}`}><GrowthIcon className="h-3 w-3" />{company.growth12mo > 0 ? "+" : ""}{company.growth12mo}%</span>
          </div>
          {score != null && <span className="text-xs font-mono font-bold text-muted-foreground shrink-0">{score}</span>}
          <Badge className={`shrink-0 text-[10px] ${tier === "T1" ? "bg-success/15 text-success border-success/30" : tier === "T2" ? "bg-primary/15 text-primary border-primary/30" : tier === "T3" ? "bg-warning/15 text-warning border-warning/30" : "bg-muted text-muted-foreground"}`}>{tier}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 pt-2 border-t space-y-3">
                {company.description && <p className="text-xs text-muted-foreground">{company.description}</p>}
                {enrichment?.ai_rationale && <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">{enrichment.ai_rationale}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {enrichment?.job_signals?.open_roles_count > 0 && <Badge variant="secondary" className="text-[10px] gap-1"><Briefcase className="h-3 w-3" />{enrichment.job_signals.open_roles_count} open roles</Badge>}
                  {company.growth12mo > 10 && <Badge variant="secondary" className="text-[10px] gap-1"><TrendingUp className="h-3 w-3" />+{company.growth12mo}% headcount</Badge>}
                  {enrichment?.funding_detected && <Badge variant="secondary" className="text-[10px] gap-1"><Building2 className="h-3 w-3" />Recent Funding</Badge>}
                </div>
                {company.techStack?.length > 0 && <div className="flex flex-wrap gap-1">{company.techStack.slice(0, 8).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>}
                <div className="flex gap-3 items-center">
                  {company.linkedinUrl && <a href={company.linkedinUrl.startsWith("http") ? company.linkedinUrl : `https://${company.linkedinUrl}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1">LinkedIn <ExternalLink className="h-3 w-3" /></a>}
                  {company.domain && <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1">Website <ExternalLink className="h-3 w-3" /></a>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function PhaseDiscover({ vertical, signalWeights, onSelectCompanies, showDebug = false }: PhaseDiscoverProps) {
  const { serviceKeys } = useAISettings();
  const [searching, setSearching] = useState(false);
  const [companies, setCompanies] = useState<CompanyIntelligence[]>([]);
  const [enrichmentStates, setEnrichmentStates] = useState<EnrichmentState>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedCompanyCount, setSavedCompanyCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const enrichingRef = useRef(false);
  const autoSearchTriggered = useRef(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(false);

  // Provider & error state
  const [noProviderError, setNoProviderError] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeProviderName, setActiveProviderName] = useState<string | null>(null);

  const [filters, setFilters] = useState<ICPFilters>(() => ({
    jobTitles: [...vertical.jobTitlesToSearch],
    companyMinSize: vertical.defaultMinEmployees || "51",
    companyMaxSize: vertical.defaultMaxEmployees || "5001",
    revenueMin: vertical.defaultMinRevenue || "10000000",
    revenueMax: vertical.defaultMaxRevenue || "1000000000",
    locations: [...(vertical.defaultLocations || ["United States"])],
    industriesToInclude: [...((vertical as any).defaultIndustries || (vertical as any).default_industries || [])],
    industriesToExclude: [...((vertical as any).defaultExcludeIndustries || (vertical as any).default_exclude_industries || ["Staffing and Recruiting"])],
    buyerPersonas: [...vertical.buyerPersonas],
    techStack: [...vertical.techStack],
    growthSignals: { hiringRelevant: true, headcountGrowth: true, recentFunding: false, newOffices: false },
    resultsLimit: 25,
  }));
  const [industrySearch, setIndustrySearch] = useState("");

  useEffect(() => { if (vertical?.id) { supabase.from("saved_companies").select("id", { count: "exact", head: true }).eq("vertical_id", vertical.id).then(({ count }) => setSavedCompanyCount(count || 0)); } }, [vertical?.id]);

  useEffect(() => {
    setFilters((f) => ({ ...f, jobTitles: [...vertical.jobTitlesToSearch], companyMinSize: vertical.defaultMinEmployees || "51", companyMaxSize: vertical.defaultMaxEmployees || "5001", revenueMin: vertical.defaultMinRevenue || "10000000", revenueMax: vertical.defaultMaxRevenue || "1000000000", locations: [...(vertical.defaultLocations || ["United States"])], industriesToInclude: [...((vertical as any).defaultIndustries || (vertical as any).default_industries || [])], industriesToExclude: [...((vertical as any).defaultExcludeIndustries || (vertical as any).default_exclude_industries || ["Staffing and Recruiting"])], buyerPersonas: [...vertical.buyerPersonas], techStack: [...vertical.techStack] }));
  }, [vertical]);

  const update = <K extends keyof ICPFilters>(key: K, val: ICPFilters[K]) => setFilters((f) => ({ ...f, [key]: val }));

  useEffect(() => { onSelectCompanies(companies.filter((c) => c.selected)); }, [companies]);

  const enrichCompany = useCallback(async (company: CompanyIntelligence) => {
    const companyId = company.id || company.domain;
    setEnrichmentStates((s) => ({ ...s, [companyId]: "enriching" }));
    try {
      const enrichment: any = { firmographics: { name: company.name, domain: company.domain, employees: company.employees, revenue: company.revenue, industry: company.industry, location: company.location } };

      if (company.apolloOrgId && serviceKeys.apollo) {
        try {
          const jobRes = await supabase.functions.invoke("data-provider-proxy", { body: { provider: "apollo", endpoint: "company_jobs", apiKey: serviceKeys.apollo, payload: { apollo_org_id: company.apolloOrgId } } });
          if (jobRes.data?.jobs?.length > 0) {
            const aiConfig = getAIConfig();
            if (aiConfig) {
              const jobTitles = jobRes.data.jobs.map((j: any) => j.title).slice(0, 30);
              try {
                const aiResult = await callAIProvider(aiConfig, "You are a B2B hiring signal analyst. Return valid JSON only.", [{ role: "user", content: `Given these job titles: ${JSON.stringify(jobTitles)}, and this vertical: ${vertical.name} (${vertical.description}), identify hiring signals. Return JSON: { "hiring_signal": string, "open_roles_count": number, "relevant_roles": string[] }` }]);
                enrichment.job_signals = JSON.parse(aiResult.replace(/```json\n?|\n?```/g, "").trim());
              } catch { enrichment.job_signals = { hiring_signal: "Jobs found", open_roles_count: jobRes.data.jobs.length, relevant_roles: [] }; }
            }
          }
        } catch { /* continue */ }
      }

      const wSum = signalWeights.openJobPostings + signalWeights.hiringVelocity + signalWeights.techStackOverlap + signalWeights.fundingEvent + signalWeights.headcountGrowth;
      let rawScore = 0;
      if (enrichment.job_signals?.open_roles_count > 0) { rawScore += signalWeights.openJobPostings; if (enrichment.job_signals.open_roles_count >= 3) rawScore += signalWeights.hiringVelocity * 0.5; }
      if (company.growth12mo > 10) rawScore += signalWeights.headcountGrowth;
      if (company.techStack?.some((t: string) => vertical.techStack.includes(t))) rawScore += signalWeights.techStackOverlap;
      if (enrichment.funding_detected) rawScore += signalWeights.fundingEvent;
      enrichment.intent_score = wSum > 0 ? Math.round((rawScore / wSum) * 100) : 0;

      const aiConfig = getAIConfig();
      if (aiConfig) {
        try {
          const aiResult = await callAIProvider(aiConfig, "You are a B2B sales analyst. Return valid JSON only.", [{ role: "user", content: `Company: ${company.name}, Industry: ${company.industry}, Employees: ${company.employees}, Revenue: ${company.revenue}, Growth: ${company.growth12mo}%, Job signals: ${JSON.stringify(enrichment.job_signals || {})}, Intent score: ${enrichment.intent_score}, Tech: ${JSON.stringify(company.techStack || [])}. Assign tier T1/T2/T3 and 2-sentence rationale for ${vertical.name}. Return JSON: { "tier": "T1"|"T2"|"T3", "score": number, "rationale": string }` }]);
          const parsed = JSON.parse(aiResult.replace(/```json\n?|\n?```/g, "").trim());
          enrichment.ai_tier = parsed.tier; enrichment.ai_score = parsed.score; enrichment.ai_rationale = parsed.rationale;
        } catch { enrichment.ai_tier = enrichment.intent_score >= 60 ? "T1" : enrichment.intent_score >= 30 ? "T2" : "T3"; enrichment.ai_score = enrichment.intent_score; enrichment.ai_rationale = "Scored by intent signals."; }
      } else { enrichment.ai_tier = enrichment.intent_score >= 60 ? "T1" : enrichment.intent_score >= 30 ? "T2" : "T3"; enrichment.ai_score = enrichment.intent_score; enrichment.ai_rationale = "No AI provider — scored by signals."; }

      if (vertical.id && company.domain) { try { await updateCompanyEnrichment(company.domain, vertical.id, enrichment); } catch {} }

      setCompanies((prev) => prev.map((c) => (c.id || c.domain) === companyId ? { ...c, aiEnriched: true, aiTier: enrichment.ai_tier, aiScore: enrichment.ai_score, aiEnrichment: enrichment } : c));
      setEnrichmentStates((s) => ({ ...s, [companyId]: "enriched" }));
    } catch (err) { console.error("Enrichment failed for", company.name, err); setEnrichmentStates((s) => ({ ...s, [companyId]: "failed" })); }
  }, [vertical, signalWeights, serviceKeys]);

  const runBackgroundEnrichment = useCallback(async (companyList: CompanyIntelligence[]) => {
    if (enrichingRef.current) return; enrichingRef.current = true;
    for (const company of companyList) { if (!enrichingRef.current) break; await enrichCompany(company); await new Promise((r) => setTimeout(r, 500)); }
    enrichingRef.current = false;
  }, [enrichCompany]);

  const handleSearch = useCallback(async (page?: number) => {
    const currentPage = page || 1;
    if (currentPage === 1) {
      setSearchError(null);
      setNoProviderError(false);
    }

    // Provider preflight check
    const providers = await getActiveProviders("company_search");
    if (!providers || providers.length === 0) {
      setNoProviderError(true);
      setHasSearched(true);
      return;
    }
    setActiveProviderName(providers[0].provider_name);

    // Log search payload for debugging
    console.log("[PhaseDiscover] Search payload:", JSON.stringify({ ...filters, page: currentPage }, null, 2));

    setSearching(true); setHasSearched(true); setShowFilters(false);
    try {
      const result: MultiProviderResult = await searchCompaniesMulti({ ...filters, page: currentPage });
      setDebugInfo({ request: { ...filters, page: currentPage }, response: result, provider: result.providerName, attempts: result.attempts });

      if (result.failoverOccurred && result.failedProvider) {
        toast.info(`${result.failedProvider} returned 0 results — retried with ${result.providerName}, found ${result.data?.length || 0} companies.`);
      }

      if (!result.success || !result.data || result.data.length === 0) {
        const lastAttempt = result.attempts?.[result.attempts.length - 1];
        if (lastAttempt && !lastAttempt.success && lastAttempt.error) {
          const msg = mapErrorCode(lastAttempt.statusCode, `${lastAttempt.providerName} returned: ${lastAttempt.error}`);
          setSearchError(msg);
        }
        if (currentPage === 1) setCompanies([]);
        setHasMorePages(false);
        setSearching(false);
        return;
      }

      setActiveProviderName(result.providerName);
      const newResults = (result.data || []).map((c: any) => ({ ...c, selected: c.selected !== false }));
      
      // Determine if there are likely more pages
      const limit = filters.resultsLimit || 25;
      setHasMorePages(newResults.length >= limit);
      setSearchPage(currentPage);

      if (currentPage === 1) {
        // First page: replace
        setCompanies(newResults);
        if (vertical.id) { try { await saveCompaniesToDB(newResults, vertical.id); } catch {} }
        runBackgroundEnrichment(newResults);
      } else {
        // Subsequent pages: merge, dedup by domain
        setCompanies((prev) => {
          const existingDomains = new Set(prev.map((c) => c.domain?.toLowerCase()));
          const unique = newResults.filter((c: any) => !existingDomains.has(c.domain?.toLowerCase()));
          const merged = [...prev, ...unique];
          // Save new unique companies to DB
          if (vertical.id && unique.length > 0) { saveCompaniesToDB(unique, vertical.id).catch(() => {}); }
          // Enrich only the new ones
          if (unique.length > 0) runBackgroundEnrichment(unique);
          if (unique.length === 0) toast.info("No new companies found on this page.");
          return merged;
        });
      }
    } catch (err: any) {
      setSearchError(err.message || "Search failed");
    } finally { setSearching(false); }
  }, [filters, vertical, runBackgroundEnrichment]);

  const handleLoadSaved = useCallback(async () => {
    if (!vertical.id) return; setSearching(true); setHasSearched(true); setShowFilters(false);
    setSearchError(null); setNoProviderError(false);
    try {
      const saved = await loadSavedCompanies(vertical.id);
      const withSelect = saved.map((c) => ({ ...c, selected: true })); setCompanies(withSelect);
      const unenriched = withSelect.filter((c) => !c.aiEnriched);
      if (unenriched.length > 0) runBackgroundEnrichment(unenriched);
    } catch { toast.error("Failed to load saved companies"); } finally { setSearching(false); }
  }, [vertical, runBackgroundEnrichment]);

  // Auto-trigger search on mount
  useEffect(() => {
    if (autoSearchTriggered.current) return;
    autoSearchTriggered.current = true;
    handleSearch(1);
  }, []);

  const toggleSelect = (idx: number) => setCompanies((prev) => prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)));
  const selectAll = () => setCompanies((prev) => prev.map((c) => ({ ...c, selected: true })));
  const deselectAll = () => setCompanies((prev) => prev.map((c) => ({ ...c, selected: false })));

  const selectedCount = companies.filter((c) => c.selected).length;
  const enrichedCount = Object.values(enrichmentStates).filter((s) => s === "enriched").length;

  // Filter summary text
  const filterSummary = `Searching via ${activeProviderName || "Provider"} · Industries: ${filters.industriesToInclude.length > 0 ? filters.industriesToInclude.slice(0, 3).join(", ") + (filters.industriesToInclude.length > 3 ? ` +${filters.industriesToInclude.length - 3}` : "") : "Any"} · Employees: ${filters.companyMinSize}–${filters.companyMaxSize} · Location: ${filters.locations.join(", ") || "Any"}`;

  return (
    <div className="space-y-5">
      {/* Filter summary banner */}
      {hasSearched && !searching && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground truncate flex-1">{filterSummary}</p>
          <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0 ml-2" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? "Hide Filters" : "Edit Filters"}
          </Button>
        </div>
      )}

      {/* No provider error — distinct from "no results" */}
      {noProviderError && (
        <Card className="border-destructive/50">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">No active data provider configured</p>
              <p className="text-xs text-muted-foreground">
                No active data provider is configured for company search. Go to <strong>Settings → Data Providers</strong> to activate Apollo, Prospeo, or ZoomInfo.
              </p>
              {savedCompanyCount > 0 && (
                <Button variant="secondary" size="sm" className="mt-2 text-xs h-7 gap-1" onClick={handleLoadSaved}>
                  <Database className="h-3 w-3" /> Use {savedCompanyCount} Saved Companies
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters panel */}
      <Card>
        <CardContent className="p-0">
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors" onClick={() => setShowFilters(!showFilters)}>
            <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold">ICP Filters — {vertical.name}</span>{hasSearched && <Badge variant="secondary" className="text-[10px]">{companies.length} found</Badge>}</div>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-4">
                  {savedCompanyCount > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><span className="text-xs font-medium">{savedCompanyCount} saved companies</span></div><Button variant="secondary" size="sm" className="text-xs h-7" onClick={handleLoadSaved}>Load Saved</Button></div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Company Size</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Min Employees</Label><Select value={filters.companyMinSize} onValueChange={(v) => update("companyMinSize", v)}><SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger><SelectContent>{COMPANY_SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label className="text-xs">Max Employees</Label><Select value={filters.companyMaxSize} onValueChange={(v) => update("companyMaxSize", v)}><SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger><SelectContent>{COMPANY_SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Min Revenue</Label><Select value={filters.revenueMin} onValueChange={(v) => update("revenueMin", v)}><SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger><SelectContent>{REVENUE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label className="text-xs">Max Revenue</Label><Select value={filters.revenueMax} onValueChange={(v) => update("revenueMax", v)}><SelectTrigger className="mt-1 text-sm h-9"><SelectValue /></SelectTrigger><SelectContent>{REVENUE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Location & Industry</h4>
                      <div><Label className="text-xs">Locations</Label><TagInput tags={filters.locations} onChange={(v) => update("locations", v)} placeholder="Add location..." /></div>
                      <div>
                        <Label className="text-xs">Industries to Include</Label>
                        <div className="flex flex-wrap gap-1 mb-1">{filters.industriesToInclude.map((ind, i) => <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">{ind}<button onClick={() => update("industriesToInclude", filters.industriesToInclude.filter((_, idx) => idx !== i))} className="hover:text-destructive">×</button></span>)}</div>
                        <input type="text" value={industrySearch} onChange={(e) => setIndustrySearch(e.target.value)} placeholder="Search industries..." className="w-full px-3 py-1.5 border border-border rounded-lg text-xs bg-background" />
                        {industrySearch && <div className="mt-1 border border-border rounded-lg bg-background shadow-sm max-h-32 overflow-y-auto">{COMMON_INDUSTRIES.filter((ind) => ind.toLowerCase().includes(industrySearch.toLowerCase()) && !filters.industriesToInclude.includes(ind)).map((ind) => <button key={ind} onClick={() => { update("industriesToInclude", [...filters.industriesToInclude, ind]); setIndustrySearch(""); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">{ind}</button>)}</div>}
                      </div>
                      <div><Label className="text-xs">Exclude</Label><TagInput tags={filters.industriesToExclude} onChange={(v) => update("industriesToExclude", v)} placeholder="Add exclusion..." /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3"><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Job Titles & Personas</h4><div><Label className="text-xs">Job Titles</Label><TagInput tags={filters.jobTitles} onChange={(v) => update("jobTitles", v)} placeholder="Add job title..." /></div><div><Label className="text-xs">Buyer Personas</Label><TagInput tags={filters.buyerPersonas} onChange={(v) => update("buyerPersonas", v)} placeholder="Add buyer title..." /></div></div>
                    <div className="space-y-3"><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tech Stack</h4><div><Label className="text-xs">Technologies</Label><TagInput tags={filters.techStack} onChange={(v) => update("techStack", v)} placeholder="Add technology..." /></div><div><Label className="text-xs">Results Limit</Label><Select value={String(filters.resultsLimit)} onValueChange={(v) => update("resultsLimit", Number(v))}><SelectTrigger className="mt-1 text-sm h-9 w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div></div>
                  </div>
                  <div className="flex justify-end pt-2"><Button onClick={() => { setSearchPage(1); handleSearch(1); }} disabled={searching || filters.jobTitles.length === 0} className="gap-2">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search Companies</Button></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {searching && <SearchingOverlay verticalName={vertical.name} />}

      {!searching && companies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium">{companies.length} companies</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><EnrichmentDot status="enriched" /><span>{enrichedCount} enriched</span></div>
              <p className="text-xs text-muted-foreground">{selectedCount} selected</p>
            </div>
            <div className="flex gap-2"><Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>Select All</Button><Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>Deselect</Button></div>
          </div>
          {enrichedCount < companies.length && enrichedCount > 0 && (
            <div className="space-y-1"><div className="flex justify-between text-[10px] text-muted-foreground"><span>Enriching...</span><span>{enrichedCount}/{companies.length}</span></div><Progress value={(enrichedCount / companies.length) * 100} className="h-1" /></div>
          )}
          <div className="space-y-2">
            {companies.map((company, idx) => {
              const companyId = company.id || company.domain;
              return <CompanyCard key={companyId} company={company} enrichmentStatus={enrichmentStates[companyId] || (company.aiEnriched ? "enriched" : "idle")} expanded={expandedId === companyId} onToggleExpand={() => setExpandedId(expandedId === companyId ? null : companyId)} onToggleSelect={() => toggleSelect(idx)} />;
            })}
          </div>
          {/* Load More button */}
          {hasMorePages && !searching && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleSearch(searchPage + 1)} disabled={searching}>
                <RefreshCw className="h-3 w-3" /> Load More Companies (Page {searchPage + 1})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Search error — specific error message */}
      {!searching && hasSearched && companies.length === 0 && !noProviderError && searchError && (
        <Card className="border-warning/50">
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-warning" />
            <p className="text-sm font-medium">Search Failed</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{searchError}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleSearch(1)}>
                <RefreshCw className="h-3 w-3" /> Retry Search
              </Button>
              {savedCompanyCount > 0 && (
                <Button variant="secondary" size="sm" className="gap-1" onClick={handleLoadSaved}>
                  <Database className="h-3 w-3" /> Use Saved Companies
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No results — no error */}
      {!searching && hasSearched && companies.length === 0 && !noProviderError && !searchError && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No companies found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your ICP filters or use saved companies.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setShowFilters(true); }}>
                <Search className="h-3 w-3" /> Edit Filters
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleSearch(1)}>
                <RefreshCw className="h-3 w-3" /> Retry Search
              </Button>
              {savedCompanyCount > 0 && (
                <Button variant="secondary" size="sm" className="gap-1" onClick={handleLoadSaved}>
                  <Database className="h-3 w-3" /> Use Saved Companies
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug panel */}
      {/* Debug panel — visible with ?debug=true or showDebug prop */}
      {showDebug && debugInfo && (
        <details className="border border-border rounded-lg p-4">
          <summary className="text-sm font-medium cursor-pointer text-muted-foreground flex items-center gap-2"><Bug className="h-4 w-4" />Debug: Company Search — {debugInfo.provider || "unknown"}</summary>
          <div className="mt-3 space-y-3">
            {debugInfo.attempts?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Provider Attempts:</p>
                {debugInfo.attempts.map((a: any, i: number) => (
                  <p key={i} className={`text-xs font-mono ${a.success ? "text-success" : "text-destructive"}`}>
                    {a.providerName}: {a.success ? `✓ ${a.resultCount} results` : `✗ ${a.error || `status ${a.statusCode}`}`}
                  </p>
                ))}
              </div>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Show full request/response</summary>
              <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-48 mt-2">{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          </div>
        </details>
      )}
    </div>
  );
}
