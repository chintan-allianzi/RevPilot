import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Sparkles, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Flame, Building2,
  Globe, Shield, Cpu, RefreshCw, Loader2, ExternalLink, CheckCheck, Bug, Save, Database, Search, X, Ban, Info
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CompanyIntelligence, ICPFilters, COMPANY_SIZE_OPTIONS, REVENUE_OPTIONS, COMMON_INDUSTRIES } from "@/lib/company-types";
import { buildEnrichmentPrompt, ApolloSearchDebug } from "@/lib/apollo-search";
import { searchCompanies as searchCompaniesMulti, getActiveProviders, type MultiProviderResult, type ProviderAttempt } from "@/lib/data-provider-service";
import { callAIProvider } from "@/lib/ai-provider";
import { useAISettings } from "@/contexts/AISettingsContext";
import { getAIConfig } from "@/lib/settings-storage";
import { saveCompaniesToDB, loadSavedCompanies, updateCompanyEnrichment } from "@/lib/supabase-companies";
import { IntentConfiguration } from "@/components/campaign/IntentSignalsStep";
import TagInput from "@/components/TagInput";
import { toast } from "sonner";

interface CompanyResultsStepProps {
  companies: CompanyIntelligence[];
  setCompanies: React.Dispatch<React.SetStateAction<CompanyIntelligence[]>>;
  verticalName: string;
  verticalId?: string;
  verticalConfig?: import("@/lib/icp-config").VerticalConfig;
  filters: ICPFilters | null;
  debugInfo: ApolloSearchDebug | null;
  setDebugInfo: React.Dispatch<React.SetStateAction<ApolloSearchDebug | null>>;
  apolloApiKey: string;
  intentConfig?: IntentConfiguration;
  onBack: () => void;
  onNext: (selected: CompanyIntelligence[]) => void;
}

type StatusFilter = "all" | "enriched" | "new";
type TierFilterType = "all" | "T1" | "T2" | "T3" | "EXCLUDE";

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  hiring: Flame,
  growth: TrendingUp,
  tech: Cpu,
  funding: Building2,
  news: Globe,
};

const SEARCH_MESSAGES = [
  "Searching data providers...",
  "Analyzing growth signals...",
  "Calculating preliminary intent scores...",
  "Preparing results...",
];

export function SearchingOverlay({ verticalName }: { verticalName: string }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useState(() => {
    const interval = setInterval(() => setMsgIdx((i) => (i + 1) % SEARCH_MESSAGES.length), 2500);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
      <div className="text-center space-y-1 mt-2">
        <p className="text-sm font-medium">Finding companies for {verticalName}</p>
        <p className="text-xs text-muted-foreground animate-pulse">{SEARCH_MESSAGES[msgIdx]}</p>
      </div>
    </div>
  );
}

function DebugPanel({ debugInfo }: { debugInfo: ApolloSearchDebug | null }) {
  if (!debugInfo) return null;
  return (
    <details className="mt-6 border border-border rounded-lg p-4">
      <summary className="text-sm font-medium cursor-pointer text-muted-foreground flex items-center gap-2">
        <Bug className="h-4 w-4" /> Debug: API Request & Response
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-mono font-medium text-muted-foreground">Request sent:</p>
          <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-48 mt-1">
            {JSON.stringify(debugInfo.request, null, 2)}
          </pre>
        </div>
        <div>
          <p className="text-xs font-mono font-medium text-muted-foreground">Response received:</p>
          <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-48 mt-1">
            {JSON.stringify(debugInfo.response, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  );
}

function CompanyCard({
  company,
  expanded,
  onToggleExpand,
  onToggleSelect,
  showSaveButton,
  isAlreadySaved,
  onSave,
  onExclude,
  onReEnrich,
}: {
  company: CompanyIntelligence;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  showSaveButton?: boolean;
  isAlreadySaved?: boolean;
  onSave?: () => void;
  onExclude?: () => void;
  onReEnrich?: () => void;
}) {
  const tier = company.aiTier || company.basicTier;
  const score = company.aiScore ?? company.basicScore;
  const GrowthIcon = company.growth12mo > 10 ? TrendingUp : company.growth12mo < 0 ? TrendingDown : Minus;
  const growthColor = company.growth12mo > 10 ? "text-success" : company.growth12mo < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className={`transition-all ${company.selected ? "ring-1 ring-primary/40" : ""} ${company.aiEnriching ? "animate-pulse" : ""}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggleExpand}>
          {!showSaveButton && (
            <Checkbox
              checked={company.selected}
              onCheckedChange={() => onToggleSelect()}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <span className="text-xs font-bold text-muted-foreground">{company.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{company.name}</p>
              {company.aiEnriched && <Sparkles className="h-3 w-3 text-primary shrink-0" />}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{company.industry}</p>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
            <span>{company.employees ? `${company.employees.toLocaleString()} emp` : "Size N/A"}</span>
            <span>{company.revenue || "Rev. N/A"}</span>
            <span className="truncate max-w-[100px]">{company.location || "Location N/A"}</span>
            <span className={`flex items-center gap-0.5 ${growthColor}`}>
              <GrowthIcon className="h-3 w-3" />
              {company.growth12mo > 0 ? "+" : ""}{company.growth12mo}%
            </span>
          </div>
          <Badge className={`shrink-0 text-[10px] ${
            tier === "T1" ? "bg-success/15 text-success border-success/30" :
            tier === "T2" ? "bg-primary/15 text-primary border-primary/30" :
            tier === "T3" ? "bg-warning/15 text-warning border-warning/30" :
            "bg-muted text-muted-foreground"
          }`}>
            {tier} · {score}
          </Badge>
          {showSaveButton && (
            isAlreadySaved ? (
              <span className="text-[10px] text-success font-medium px-2 py-1 bg-success/10 rounded-md shrink-0">Saved</span>
            ) : (
              <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={(e) => { e.stopPropagation(); onSave?.(); }}>
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            )
          )}
          {onExclude && (
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={(e) => { e.stopPropagation(); onExclude(); }} title="Exclude company">
              <Ban className="h-3 w-3" />
            </Button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 border-t space-y-4">
                <div className="md:hidden flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{company.employees ? `${company.employees.toLocaleString()} employees` : "Size N/A"}</span>
                  <span>·</span>
                  <span>{company.revenue || "Rev. N/A"}</span>
                  <span>·</span>
                  <span>{company.location || "Location N/A"}</span>
                </div>
                {company.description && <p className="text-xs text-muted-foreground">{company.description}</p>}

                {/* Signal-by-signal breakdown (from intent config enrichment) */}
                {(company as any).aiEnrichment?.signals_detected && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Signal Analysis</p>
                    <div className="space-y-1.5">
                      {(company as any).aiEnrichment.signals_detected.map((signal: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            signal.strength === 'strong' ? 'bg-emerald-500' :
                            signal.strength === 'moderate' ? 'bg-blue-500' :
                            signal.strength === 'weak' ? 'bg-amber-500' : 'bg-muted-foreground/30'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{signal.signal_name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                signal.detected ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'
                              }`}>
                                {signal.points_awarded}/{signal.max_points} pts
                              </span>
                            </div>
                            {signal.evidence && signal.detected && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{signal.evidence}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key insight */}
                {(company as any).aiEnrichment?.key_insight && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key Insight</p>
                    <p className="text-sm">{(company as any).aiEnrichment.key_insight}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intent Signals</p>
                    {company.intentSignals && company.intentSignals.length > 0 ? (
                      <div className="space-y-1.5">
                        {company.intentSignals.map((sig, i) => {
                          const SIcon = SIGNAL_ICONS[sig.icon] || Flame;
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <SIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                                sig.strength === "strong" ? "text-success" :
                                sig.strength === "moderate" ? "text-primary" : "text-muted-foreground"
                              }`} />
                              <span>{sig.signal}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2 text-xs">
                          <TrendingUp className={`h-3.5 w-3.5 mt-0.5 ${growthColor}`} />
                          <span>Growth: {company.growth12mo > 0 ? "+" : ""}{company.growth12mo}% (12mo)</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outsourcing Readiness</p>
                    {company.outsourcingReadiness ? (
                      <div>
                        <Badge className={`text-[10px] mb-1.5 ${
                          company.outsourcingReadiness.score === "high" ? "bg-success/15 text-success" :
                          company.outsourcingReadiness.score === "medium" ? "bg-primary/15 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>{company.outsourcingReadiness.score.toUpperCase()}</Badge>
                        <ul className="space-y-0.5">
                          {company.outsourcingReadiness.reasons.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Run AI enrichment to analyze</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tech Stack</p>
                    {company.techStackMatch ? (
                      <div>
                        <p className="text-xs mb-1">{company.techStackMatch.matched.length} of {company.techStackMatch.total_relevant} matches ({company.techStackMatch.match_percentage}%)</p>
                        <div className="flex flex-wrap gap-1">
                          {company.techStackMatch.matched.map((t) => (
                            <Badge key={t} className="text-[10px] bg-success/15 text-success border-success/30">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : company.techStack.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {company.techStack.slice(0, 8).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No tech data available</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sales Angle</p>
                    {company.recommendedAngle ? (
                      <p className="text-xs">{company.recommendedAngle}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Run AI enrichment to generate</p>
                    )}
                    {company.tierReasoning && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <span className="font-medium">Tier reasoning:</span> {company.tierReasoning}
                      </p>
                    )}
                  </div>
                </div>
                {company.riskFactors && company.riskFactors.length > 0 && (
                  <div className="p-2 rounded-md bg-destructive/5 border border-destructive/15">
                    <p className="text-[10px] font-semibold text-destructive mb-1">Risk Factors</p>
                    {company.riskFactors.map((r, i) => (
                      <p key={i} className="text-[11px] text-destructive/80">• {r}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 items-center">
                  {company.linkedinUrl && (
                    <a href={company.linkedinUrl.startsWith("http") ? company.linkedinUrl : `https://${company.linkedinUrl}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {company.domain && (
                    <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {onReEnrich && (
                    <button onClick={(e) => { e.stopPropagation(); onReEnrich(); }}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 ml-auto">
                      <RefreshCw className="h-3 w-3" />
                      {company.aiEnriched ? 'Re-enrich' : 'Enrich'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function CompanyResultsStep({
  companies,
  setCompanies,
  verticalName,
  verticalId,
  verticalConfig,
  filters,
  debugInfo,
  setDebugInfo,
  apolloApiKey,
  intentConfig,
  onBack,
  onNext,
}: CompanyResultsStepProps) {
  const [activeTab, setActiveTab] = useState<string>("saved");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedCompanies, setSavedCompanies] = useState<CompanyIntelligence[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [inlineSearching, setInlineSearching] = useState(false);
  const hasEnrichedCurrentSearch = useRef(false);
  const currentSearchId = useRef<string>('');
  const [enrichmentDone, setEnrichmentDone] = useState(false);
  
  // Inline search filters — prefer vertical config, then filters prop, then defaults
  const vc = verticalConfig;
  const [searchJobTitles, setSearchJobTitles] = useState<string[]>(
    vc?.jobTitlesToSearch?.length ? vc.jobTitlesToSearch : filters?.jobTitles || []
  );
  const [searchLocations, setSearchLocations] = useState<string[]>(
    vc?.defaultLocations?.length ? vc.defaultLocations : filters?.locations || ["United States"]
  );
  const [searchMinEmp, setSearchMinEmp] = useState(
    vc?.defaultMinEmployees || filters?.companyMinSize || "51"
  );
  const [searchMaxEmp, setSearchMaxEmp] = useState(
    vc?.defaultMaxEmployees || filters?.companyMaxSize || "5001"
  );
  const [searchMinRev, setSearchMinRev] = useState(
    vc?.defaultMinRevenue || filters?.revenueMin || "10000000"
  );
  const [searchMaxRev, setSearchMaxRev] = useState(
    vc?.defaultMaxRevenue || filters?.revenueMax || "1000000000"
  );
  const [searchIndustries, setSearchIndustries] = useState<string[]>(
    filters?.industriesToInclude || (vc as any)?.defaultIndustries || []
  );
  const [searchExcludeIndustries, setSearchExcludeIndustries] = useState<string[]>(
    filters?.industriesToExclude || (vc as any)?.defaultExcludeIndustries || ["Staffing and Recruiting"]
  );
  const [inlineIndustrySearch, setInlineIndustrySearch] = useState("");
  
  const { aiProvider, getActiveKey, getActiveModel } = useAISettings();

  // Load saved companies immediately
  useEffect(() => {
    if (verticalId) {
      setSavedLoading(true);
      loadSavedCompanies(verticalId).then((saved) => {
        setSavedCompanies(saved);
        setSavedLoading(false);
      });
    }
  }, [verticalId]);

  // If there are new search results, switch to that tab
  useEffect(() => {
    if (companies.length > 0) {
      setActiveTab("new");
    }
  }, [companies.length]);

  // Filter saved companies
  const filteredSaved = savedCompanies.filter((c) => {
    if (statusFilter === "enriched" && !c.aiEnriched) return false;
    if (statusFilter === "new" && c.aiEnriched) return false;
    const tier = c.aiTier || c.basicTier || "T3";
    if (tierFilter !== "all" && tier !== tierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const savedStats = {
    total: savedCompanies.length,
    enriched: savedCompanies.filter((c) => c.aiEnriched).length,
    unenriched: savedCompanies.filter((c) => !c.aiEnriched).length,
    t1: savedCompanies.filter((c) => (c.aiTier || c.basicTier) === "T1").length,
    t2: savedCompanies.filter((c) => (c.aiTier || c.basicTier) === "T2").length,
    t3: savedCompanies.filter((c) => (c.aiTier || c.basicTier) === "T3").length,
    excluded: savedCompanies.filter((c) => (c.aiTier || c.basicTier) === "EXCLUDE").length,
  };

  const selectedSavedCount = savedCompanies.filter((c) => c.selected).length;

  const toggleSavedSelect = (id: string) =>
    setSavedCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));

  const selectAllSavedTier = (tiers: string[]) =>
    setSavedCompanies((prev) =>
      prev.map((c) => ({ ...c, selected: tiers.includes(c.aiTier || c.basicTier || "T3") }))
    );

  const saveCompanyToPool = async (company: CompanyIntelligence) => {
    if (!verticalId) return;
    try {
      await saveCompaniesToDB([company], verticalId);
      const saved = await loadSavedCompanies(verticalId);
      setSavedCompanies(saved);
      toast.success(`${company.name} saved to pool`);
    } catch {
      toast.error("Failed to save company");
    }
  };

  const excludeSavedCompany = async (companyId: string) => {
    try {
      const { error } = await (await import("@/integrations/supabase/client")).supabase
        .from("saved_companies")
        .delete()
        .eq("id", companyId);
      if (error) throw error;
      setSavedCompanies((prev) => prev.filter((c) => c.id !== companyId));
      toast.success("Company excluded and removed");
    } catch {
      toast.error("Failed to exclude company");
    }
  };

  const excludeNewCompany = (companyId: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
  };

  const [newTierFilter, setNewTierFilter] = useState<TierFilterType>("all");
  const [newSearchQuery, setNewSearchQuery] = useState("");

  const filteredNewCompanies = companies.filter((c) => {
    const tier = c.aiTier || c.basicTier || "T3";
    if (newTierFilter !== "all" && tier !== newTierFilter) return false;
    if (newSearchQuery) {
      const q = newSearchQuery.toLowerCase();
      return c.name?.toLowerCase().includes(q) || c.domain?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q);
    }
    return true;
  });

  const newStats = {
    t1: companies.filter((c) => (c.aiTier || c.basicTier) === "T1").length,
    t2: companies.filter((c) => (c.aiTier || c.basicTier) === "T2").length,
    t3: companies.filter((c) => (c.aiTier || c.basicTier) === "T3").length,
    excluded: companies.filter((c) => (c.aiTier || c.basicTier) === "EXCLUDE").length,
  };

  const handleSaveAll = async () => {
    if (!verticalId || companies.length === 0) return;
    setSaving(true);
    try {
      await saveCompaniesToDB(companies, verticalId);
      const saved = await loadSavedCompanies(verticalId);
      setSavedCompanies(saved);
      toast.success(`${companies.length} companies saved to your ${verticalName} pool`);
      setCompanies([]);
      setActiveTab("saved");
    } catch (err: any) {
      toast.error("Failed to save companies: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const [providerBadge, setProviderBadge] = useState<{ name: string; failover?: string } | null>(null);
  const [providerAttempts, setProviderAttempts] = useState<ProviderAttempt[]>([]);

  const handleInlineSearch = async () => {
    if (searchJobTitles.length === 0) return;
    setInlineSearching(true);
    setDebugInfo(null);
    setProviderBadge(null);
    setProviderAttempts([]);
    try {
      const searchFilters: ICPFilters = {
        jobTitles: searchJobTitles,
        companyMinSize: searchMinEmp,
        companyMaxSize: searchMaxEmp,
        revenueMin: searchMinRev,
        revenueMax: searchMaxRev,
        locations: searchLocations,
        industriesToInclude: searchIndustries,
        industriesToExclude: searchExcludeIndustries,
        buyerPersonas: filters?.buyerPersonas || [],
        techStack: filters?.techStack || [],
        growthSignals: filters?.growthSignals || { hiringRelevant: true, headcountGrowth: true, recentFunding: false, newOffices: false },
        resultsLimit: 25,
      };

      // Use multi-provider service with failover
      const mpResult = await searchCompaniesMulti(searchFilters);
      setProviderAttempts(mpResult.attempts);

      if (mpResult.success) {
        const results = mpResult.data as CompanyIntelligence[];
        setCompanies(results);
        setDebugInfo(mpResult.debug || null);
        setActiveTab("new");
        setEnrichmentDone(false);
        hasEnrichedCurrentSearch.current = false;
        currentSearchId.current = crypto.randomUUID();
        setProviderBadge({
          name: mpResult.providerName,
          failover: mpResult.failoverOccurred ? mpResult.failedProvider : undefined,
        });

        toast.success(`Found ${results.length} companies via ${mpResult.providerName}!`);

        // Auto-enrich
        const searchId = currentSearchId.current;
        const hasKey = !!getActiveKey() || !!getAIConfig().apiKey;
        if (hasKey && intentConfig && !hasEnrichedCurrentSearch.current) {
          hasEnrichedCurrentSearch.current = true;
          setTimeout(() => {
            if (currentSearchId.current === searchId) {
              toast.info('Auto-enriching companies with your intent signals...');
              enrichCompanies(results, setCompanies).then(() => setEnrichmentDone(true));
            }
          }, 500);
        }
      } else {
        setCompanies([]);
        if (mpResult.attempts.length > 0) {
          const details = mpResult.attempts.map(a => `${a.providerName}: ${a.error || 'no results'}`).join('; ');
          toast.error(`All providers failed. ${details}`);
        } else {
          toast.error("No active data providers configured. Add one in Settings.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setInlineSearching(false);
    }
  };

  const buildSignalAwarePrompt = useCallback(() => {
    if (!intentConfig) return null;
    const enabledSignals = intentConfig.signals.filter(s => s.enabled);
    const signalInstructions = enabledSignals.map(s => {
      let detail = `- "${s.name}" (weight: ${s.weight}%, category: ${s.category}): ${s.description}`;
      if (s.config.keywords?.length) detail += `\n  Keywords: ${s.config.keywords.join(', ')}`;
      if (s.config.roles?.length) detail += `\n  Relevant roles: ${s.config.roles.join(', ')}`;
      if (s.config.technologies?.length) detail += `\n  Technologies: ${s.config.technologies.join(', ')}`;
      if (s.config.minimumGrowth) detail += `\n  Minimum growth: ${s.config.minimumGrowth}%`;
      return detail;
    }).join('\n\n');

    return `You are a B2B sales intelligence analyst for Office Beacon, a remote staffing company.

VERTICAL: ${verticalName}

INTENT SIGNALS TO EVALUATE:
${signalInstructions}

TIER THRESHOLDS:
- T1 (Hot): Score ${intentConfig.tierThresholds.t1}-100
- T2 (Medium): Score ${intentConfig.tierThresholds.t2}-${intentConfig.tierThresholds.t1 - 1}
- T3 (Low): Score 0-${intentConfig.tierThresholds.t2 - 1}
- EXCLUDE: Wrong industry, competitor, or clear misfit

Evaluate EACH enabled signal separately. Score 0-100% of each signal's weight based on strength.
IMPORTANT: intent_score must be a whole number (integer) between 0 and 100. No decimals. All points_awarded and max_points values must also be whole numbers.

Respond with a JSON array. For each company:
{
  "company_name": "...",
  "intent_score": <0-100>,
  "tier": "T1"|"T2"|"T3"|"EXCLUDE",
  "tier_reasoning": "One sentence",
  "signals_detected": [
    { "signal_id": "...", "signal_name": "...", "detected": true/false, "strength": "strong"|"moderate"|"weak"|"none", "points_awarded": <number>, "max_points": <number>, "evidence": "..." }
  ],
  "outsourcing_readiness": { "score": "high"|"medium"|"low", "reasons": ["..."] },
  "recommended_angle": "...",
  "risk_factors": ["..."],
  "key_insight": "..."
}`;
  }, [intentConfig, verticalName]);

  const enrichCompanies = useCallback(async (toEnrich: CompanyIntelligence[], updateFn: React.Dispatch<React.SetStateAction<CompanyIntelligence[]>>) => {
    let apiKey = getActiveKey();
    let provider = aiProvider;
    let model = getActiveModel();

    if (!apiKey) {
      const stored = getAIConfig();
      apiKey = stored.apiKey;
      provider = stored.provider;
      model = stored.model;
    }

    if (!apiKey) {
      toast.error("Please add your AI API key in Settings");
      return;
    }

    setEnriching(true);
    setEnrichProgress(0);

    const useSignalPrompt = !!intentConfig;
    const signalSystemPrompt = buildSignalAwarePrompt();
    const batchSize = useSignalPrompt ? 5 : 3;
    const total = toEnrich.length;
    let processed = 0;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i += batchSize) {
      const batch = toEnrich.slice(i, i + batchSize);

      if (useSignalPrompt && signalSystemPrompt) {
        // Batch enrichment with intent signals
        const companyDescriptions = batch.map(c =>
          `Company: ${c.name}\nDomain: ${c.domain}\nIndustry: ${c.industry || 'Unknown'}\nEmployees: ${c.employees || 'Unknown'}\nRevenue: ${c.revenue || 'Unknown'}\nLocation: ${c.location || 'Unknown'}\nDescription: ${c.description || 'No description'}\n12mo growth: ${c.growth12mo ? c.growth12mo + '%' : 'Unknown'}\n24mo growth: ${c.growth24mo ? c.growth24mo + '%' : 'Unknown'}\nTech stack: ${c.techStack?.join(', ') || 'Unknown'}`
        ).join('\n\n---\n\n');

        batch.forEach(c => updateFn(prev => prev.map(x => x.id === c.id ? { ...x, aiEnriching: true } : x)));

        try {
          const response = await callAIProvider(
            { provider: provider as "anthropic" | "openai" | "gemini", apiKey, model },
            signalSystemPrompt,
            [{ role: 'user', content: `Analyze these ${batch.length} companies:\n\n${companyDescriptions}` }]
          );

          const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

          if (jsonMatch) {
            const enrichments = JSON.parse(jsonMatch[0]);
            batch.forEach((company, idx) => {
              if (enrichments[idx]) {
                const raw = enrichments[idx];
                const normalizedSignals = Array.isArray(raw.signals_detected) ? raw.signals_detected : [];
                const intentSignals = normalizedSignals.filter((s: any) => s.detected).map((s: any) => ({
                  signal: s.evidence || s.signal_name,
                  strength: s.strength || 'moderate',
                  icon: s.signal_id?.includes('growth') ? 'growth' : s.signal_id?.includes('tech') ? 'tech' : 'hiring',
                }));

                updateFn(prev => prev.map(c => c.id === company.id ? {
                  ...c,
                  aiScore: raw.intent_score != null ? Math.round(raw.intent_score) : 0,
                  aiTier: raw.tier || 'T3',
                  aiEnriched: true,
                  aiEnriching: false,
                  intentSignals,
                  outsourcingReadiness: raw.outsourcing_readiness || null,
                  techStackMatch: raw.tech_stack_match || null,
                  recommendedAngle: raw.recommended_angle || '',
                  riskFactors: Array.isArray(raw.risk_factors) ? raw.risk_factors : [],
                  tierReasoning: raw.tier_reasoning || '',
                  aiEnrichment: raw,
                  selected: raw.tier === 'T1',
                } : c));

                if (verticalId) {
                  updateCompanyEnrichment(company.domain, verticalId, raw);
                }
                successCount++;
              }
            });
          }
        } catch (err: any) {
          console.error('Batch enrichment failed:', err);
          failCount += batch.length;
          batch.forEach(c => updateFn(prev => prev.map(x => x.id === c.id ? { ...x, aiEnriching: false, aiFailed: true } : x)));
        }
      } else {
        // Fallback: individual enrichment without intent config
        const promises = batch.map(async (company) => {
          try {
            updateFn((prev) => prev.map((c) => (c.id === company.id ? { ...c, aiEnriching: true } : c)));
            const prompt = buildEnrichmentPrompt(company, verticalName, filters?.jobTitles || []);
            const response = await callAIProvider(
              { provider: provider as "anthropic" | "openai" | "gemini", apiKey, model },
              "You are a B2B sales intelligence analyst. Respond ONLY with valid JSON.",
              [{ role: "user", content: prompt }]
            );
            const cleanResponse = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const raw = JSON.parse(jsonMatch[0]);
              const normalizedSignals = Array.isArray(raw.intent_signals)
                ? raw.intent_signals.map((s: any) => ({ signal: s.signal || s.description || String(s), strength: s.strength || "moderate", icon: s.icon || "growth" }))
                : [];
              updateFn((prev) => prev.map((c) => c.id === company.id ? {
                ...c, aiScore: raw.intent_score != null ? Math.round(raw.intent_score) : 0, aiTier: raw.tier || "T3", aiEnriched: true, aiEnriching: false,
                intentSignals: normalizedSignals, outsourcingReadiness: raw.outsourcing_readiness || null,
                techStackMatch: raw.tech_stack_match || null, recommendedAngle: raw.recommended_angle || raw.recommended_sales_angle || "",
                riskFactors: Array.isArray(raw.risk_factors) ? raw.risk_factors : [], tierReasoning: raw.tier_reasoning || "",
                aiEnrichment: raw, selected: raw.tier === "T1",
              } : c));
              if (verticalId) await updateCompanyEnrichment(company.domain, verticalId, raw);
              successCount++;
            } else { throw new Error("AI returned invalid JSON"); }
          } catch (err: any) {
            console.error(`Failed to enrich ${company.name}:`, err);
            failCount++;
            updateFn((prev) => prev.map((c) => (c.id === company.id ? { ...c, aiEnriching: false, aiFailed: true } : c)));
          }
        });
        await Promise.all(promises);
      }

      processed += batch.length;
      setEnrichProgress(Math.round((processed / total) * 100));
      if (i + batchSize < total) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    setEnriching(false);
    if (failCount === 0) {
      toast.success(`AI enrichment complete! All ${successCount} companies scored.`);
    } else {
      toast.warning(`Enrichment done: ${successCount} succeeded, ${failCount} failed.`);
    }

    if (verticalId) {
      const saved = await loadSavedCompanies(verticalId);
      setSavedCompanies(saved);
    }
  }, [aiProvider, getActiveKey, getActiveModel, verticalName, filters?.jobTitles, verticalId, intentConfig, buildSignalAwarePrompt]);

  // Auto-enrich is now triggered only from handleInlineSearch — no useEffect needed

  const handleEnrichSaved = () => {
    const unenriched = savedCompanies.filter((c) => !c.aiEnriched);
    if (unenriched.length === 0) {
      toast.info("All companies are already enriched");
      return;
    }
    enrichCompanies(unenriched, setSavedCompanies);
  };

  const handleReEnrichAll = () => {
    if (savedCompanies.length === 0) return;
    enrichCompanies(savedCompanies, setSavedCompanies);
  };

  const handleReEnrichSingle = (company: CompanyIntelligence, isSaved: boolean) => {
    if (isSaved) {
      enrichCompanies([company], setSavedCompanies);
    } else {
      enrichCompanies([company], setCompanies);
    }
  };

  const handleEnrichNew = () => {
    const unenriched = companies.filter(c => !c.aiEnriched && !(c as any).aiEnriching);
    if (unenriched.length === 0) {
      toast.info('All companies are already enriched');
      return;
    }
    enrichCompanies(unenriched, setCompanies).then(() => setEnrichmentDone(true));
  };

  const hasAIKey = !!getActiveKey() || !!getAIConfig().apiKey;

  const isAlreadySaved = (domain: string) => savedCompanies.some((sc) => sc.domain === domain);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Companies — {verticalName}</h2>
          <p className="text-xs text-muted-foreground">Manage your company pool and search for new prospects</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSearchPanel(!showSearchPanel)} className="gap-2 text-xs">
          <Search className="h-3.5 w-3.5" />
          {showSearchPanel ? "Hide Search" : "Search Companies"}
        </Button>
      </div>

      {/* Inline Search Panel */}
      {showSearchPanel && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">Search for More Companies</h3>
              <button onClick={() => setShowSearchPanel(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              Filters pre-loaded from "{verticalName}" vertical config
              <button
                onClick={() => {
                  if (vc) {
                    setSearchJobTitles(vc.jobTitlesToSearch || []);
                    setSearchLocations(vc.defaultLocations || ["United States"]);
                    setSearchMinEmp(vc.defaultMinEmployees || "51");
                    setSearchMaxEmp(vc.defaultMaxEmployees || "5001");
                    setSearchMinRev(vc.defaultMinRevenue || "10000000");
                    setSearchMaxRev(vc.defaultMaxRevenue || "1000000000");
                    setSearchIndustries((vc as any).defaultIndustries || []);
                    setSearchExcludeIndustries((vc as any).defaultExcludeIndustries || ["Staffing and Recruiting"]);
                  }
                }}
                className="text-primary hover:underline ml-auto text-xs"
              >
                Reset to defaults
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs font-medium">Job Titles</Label>
                <TagInput tags={searchJobTitles} onChange={setSearchJobTitles} placeholder="Add title..." />
              </div>
              <div>
                <Label className="text-xs font-medium">Locations</Label>
                <TagInput tags={searchLocations} onChange={setSearchLocations} placeholder="Add location..." />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs font-medium">Min Employees</Label>
                  <Select value={searchMinEmp} onValueChange={setSearchMinEmp}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-medium">Max Employees</Label>
                  <Select value={searchMaxEmp} onValueChange={setSearchMaxEmp}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs font-medium">Min Revenue</Label>
                  <Select value={searchMinRev} onValueChange={setSearchMinRev}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-medium">Max Revenue</Label>
                  <Select value={searchMaxRev} onValueChange={setSearchMaxRev}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* Industry filter */}
            <div className="mb-4">
              <Label className="text-xs font-medium">Industries to Include</Label>
              <div className="flex flex-wrap gap-1 mt-1 mb-1">
                {searchIndustries.map((ind, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded flex items-center gap-1">
                    {ind}
                    <button onClick={() => setSearchIndustries(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={inlineIndustrySearch}
                onChange={e => setInlineIndustrySearch(e.target.value)}
                placeholder="Add industry..."
                className="w-full px-2 py-1.5 border border-border rounded text-xs bg-background"
              />
              {inlineIndustrySearch && (
                <div className="mt-1 border border-border rounded bg-background shadow-sm max-h-36 overflow-y-auto">
                  {COMMON_INDUSTRIES
                    .filter(ind => ind.toLowerCase().includes(inlineIndustrySearch.toLowerCase()))
                    .filter(ind => !searchIndustries.includes(ind))
                    .slice(0, 10)
                    .map(ind => (
                      <button key={ind} onClick={() => {
                        setSearchIndustries(prev => [...prev, ind]);
                        setInlineIndustrySearch('');
                      }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted transition-colors">
                        {ind}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleInlineSearch} disabled={inlineSearching || searchJobTitles.length === 0} className="gap-2">
                {inlineSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {inlineSearching ? "Searching..." : "Search Companies"}
              </Button>
              <span className="text-xs text-muted-foreground">Results appear in "New Search Results" tab</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrichment progress */}
      {enriching ? (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-xs font-medium flex-1">Enriching companies...</p>
          <Progress value={enrichProgress} className="w-32 h-2" />
        </div>
      ) : enrichmentDone && companies.length > 0 ? (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-success">
          <CheckCheck className="h-3.5 w-3.5" />
          <span>Companies enriched and scored</span>
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="saved" className="flex-1 gap-2 text-xs">
            <Database className="h-3.5 w-3.5" />
            Saved Pool ({savedStats.total})
          </TabsTrigger>
          <TabsTrigger value="new" className="flex-1 gap-2 text-xs">
            <Search className="h-3.5 w-3.5" />
            New Search Results ({companies.length})
          </TabsTrigger>
        </TabsList>

        {/* SAVED POOL TAB */}
        <TabsContent value="saved">
          {savedLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading saved companies...
            </div>
          ) : savedCompanies.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold">No companies saved yet</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Search for companies matching your ICP, then save them here.
                You can run multiple searches and build up your company pool over time.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>← Back to ICP Filters</Button>
                <Button onClick={() => setShowSearchPanel(true)} className="gap-2">
                  <Search className="h-4 w-4" /> Search Companies
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {savedStats.total} companies · {savedStats.enriched} enriched · {savedStats.unenriched} new
                </span>
                <div className="flex gap-1 ml-auto">
                  <Badge className="bg-success/15 text-success border-success/30 text-[10px]">T1: {savedStats.t1}</Badge>
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">T2: {savedStats.t2}</Badge>
                  <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">T3: {savedStats.t3}</Badge>
                  {savedStats.excluded > 0 && <Badge variant="secondary" className="text-[10px]">Excluded: {savedStats.excluded}</Badge>}
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  {(["all", "enriched", "new"] as StatusFilter[]).map((f) => (
                    <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)} className="text-[10px] h-6 px-2">
                      {f === "all" ? "All" : f === "enriched" ? "Enriched" : "Not Enriched"}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {(["all", "T1", "T2", "T3", "EXCLUDE"] as TierFilterType[]).map((f) => (
                    <Button key={f} size="sm" variant={tierFilter === f ? "default" : "outline"} onClick={() => setTierFilter(f)} className="text-[10px] h-6 px-2">
                      {f === "all" ? "All Tiers" : f}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Search by name, domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs w-48 ml-auto"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => selectAllSavedTier(["T1"])} className="text-xs h-7">
                  <CheckCheck className="h-3 w-3 mr-1" /> Select All T1
                </Button>
                <Button size="sm" variant="outline" onClick={() => selectAllSavedTier(["T1", "T2"])} className="text-xs h-7">
                  Select All T1 + T2
                </Button>
                <div className="flex-1" />
                {savedStats.total > 0 && (
                  <Button size="sm" variant="outline" onClick={handleReEnrichAll} disabled={enriching || !hasAIKey} className="text-xs h-7 gap-1.5">
                    <RefreshCw className="h-3 w-3" />
                    Re-enrich All ({savedStats.total})
                  </Button>
                )}
                {savedStats.unenriched > 0 && (
                  <Button size="sm" variant="outline" onClick={handleEnrichSaved} disabled={enriching || !hasAIKey} className="text-xs h-7 gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Enrich Unenriched ({savedStats.unenriched})
                  </Button>
                )}
              </div>

              {/* Company list */}
              <div className="space-y-2">
                {filteredSaved.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    expanded={expandedId === company.id}
                    onToggleExpand={() => setExpandedId(expandedId === company.id ? null : company.id)}
                    onToggleSelect={() => toggleSavedSelect(company.id)}
                    onExclude={() => excludeSavedCompany(company.id)}
                    onReEnrich={() => handleReEnrichSingle(company, true)}
                  />
                ))}
                {filteredSaved.length === 0 && savedCompanies.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No companies match your current filters</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* NEW SEARCH RESULTS TAB */}
        <TabsContent value="new">
          {companies.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                No new search results. Click "Search Companies" above to find companies.
              </p>
              <Button onClick={() => setShowSearchPanel(true)} variant="outline" className="gap-2">
                <Search className="h-4 w-4" /> Search Companies
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-medium">Found {companies.length} companies</p>
                <div className="flex gap-1 ml-2">
                  <Badge className="bg-success/15 text-success border-success/30 text-[10px]">T1: {newStats.t1}</Badge>
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">T2: {newStats.t2}</Badge>
                  <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">T3: {newStats.t3}</Badge>
                  {newStats.excluded > 0 && <Badge variant="secondary" className="text-[10px]">Excluded: {newStats.excluded}</Badge>}
                </div>
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={handleEnrichNew} disabled={enriching || !hasAIKey} className="text-xs h-7 gap-1.5">
                  <Sparkles className="h-3 w-3" /> Enrich & Score
                </Button>
                <Button size="sm" onClick={handleSaveAll} disabled={saving || !verticalId} className="text-xs h-7 gap-1.5">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {saving ? "Saving..." : "Save All to Pool"}
                </Button>
              </div>

              {/* Tier filters + search for new results */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  {(["all", "T1", "T2", "T3", "EXCLUDE"] as TierFilterType[]).map((f) => (
                    <Button key={f} size="sm" variant={newTierFilter === f ? "default" : "outline"} onClick={() => setNewTierFilter(f)} className="text-[10px] h-6 px-2">
                      {f === "all" ? "All Tiers" : f}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Search by name, domain..."
                  value={newSearchQuery}
                  onChange={(e) => setNewSearchQuery(e.target.value)}
                  className="h-7 text-xs w-48 ml-auto"
                />
              </div>

              <div className="space-y-2">
                {filteredNewCompanies.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    expanded={expandedId === company.id}
                    onToggleExpand={() => setExpandedId(expandedId === company.id ? null : company.id)}
                    onToggleSelect={() => {}}
                    showSaveButton
                    isAlreadySaved={isAlreadySaved(company.domain)}
                    onSave={() => saveCompanyToPool(company)}
                    onExclude={() => excludeNewCompany(company.id)}
                    onReEnrich={() => handleReEnrichSingle(company, false)}
                  />
                ))}
                {filteredNewCompanies.length === 0 && companies.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No companies match your current filters</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{selectedSavedCount} companies selected</p>
          <Button
            onClick={() => onNext(savedCompanies.filter((c) => c.selected))}
            disabled={selectedSavedCount === 0}
            className="gap-2"
          >
            <Users className="h-4 w-4" /> Find Decision Makers →
          </Button>
        </div>
      </div>

      <DebugPanel debugInfo={debugInfo} />
    </div>
  );
}
