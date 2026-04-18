import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, Building2, Briefcase, MapPin, ExternalLink,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanyIntelligence } from "@/lib/company-types";
import { searchJobPostings, extractCompaniesFromJobs, type JobPostingResult } from "@/lib/providers/apify-adapter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhaseDiscoverJobsProps {
  jobKeywords: string[];
  jobLocation: string;
  onSelectCompanies: (companies: CompanyIntelligence[]) => void;
}

type Phase = "idle" | "searching" | "results" | "error";

const SEARCH_MESSAGES = [
  "Launching job scraper...",
  "Scanning job boards...",
  "Extracting company data...",
  "Deduplicating companies...",
  "Preparing results...",
];

export default function PhaseDiscoverJobs({ jobKeywords, jobLocation, onSelectCompanies }: PhaseDiscoverJobsProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [jobs, setJobs] = useState<JobPostingResult[]>([]);
  const [companies, setCompanies] = useState<CompanyIntelligence[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [actorId, setActorId] = useState<string>("");

  // Load Apify actor config
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("data_providers")
        .select("config")
        .eq("provider_key", "apify")
        .eq("is_active", true)
        .maybeSingle();
      const config = data?.config as Record<string, any> | null;
      const actors = config?.actors || [];
      if (actors.length > 0) {
        setActorId(actors[0].actor_id || "");
      }
    })();
  }, []);

  // Rotating search messages
  useEffect(() => {
    if (phase !== "searching") return;
    const i = setInterval(() => setMsgIdx(n => (n + 1) % SEARCH_MESSAGES.length), 3000);
    return () => clearInterval(i);
  }, [phase]);

  // Propagate selections
  useEffect(() => {
    onSelectCompanies(companies.filter(c => c.selected));
  }, [companies, onSelectCompanies]);

  const handleSearch = useCallback(async () => {
    if (!actorId) {
      toast.error("No Apify actor configured. Go to Settings → Data Providers → Apify to add an actor.");
      return;
    }
    if (jobKeywords.length === 0) {
      toast.error("Please enter at least one job keyword");
      return;
    }

    setPhase("searching");
    setErrorMsg("");
    setMsgIdx(0);

    try {
      const result = await searchJobPostings(jobKeywords, jobLocation, actorId);

      if (!result.success || result.jobs.length === 0) {
        setPhase("error");
        setErrorMsg(result.error || "No job postings found. Try different keywords.");
        return;
      }

      setJobs(result.jobs);
      const extracted = extractCompaniesFromJobs(result.jobs);
      setCompanies(extracted);
      setPhase("results");
      toast.success(`Found ${result.jobs.length} jobs across ${extracted.length} companies`);
    } catch (err: any) {
      setPhase("error");
      setErrorMsg(err?.message || "An unexpected error occurred during the search.");
    }
  }, [actorId, jobKeywords, jobLocation]);

  const toggleSelect = (id: string) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const toggleAll = (selected: boolean) => {
    setCompanies(prev => prev.map(c => ({ ...c, selected })));
  };

  const selectedCount = companies.filter(c => c.selected).length;

  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-1">Job Posting Discovery</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Search job boards via Apify to find companies actively hiring for roles matching your keywords
          </p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Search Configuration</p>
              <div className="flex flex-wrap gap-1.5">
                {jobKeywords.map(kw => (
                  <Badge key={kw} variant="secondary" className="text-xs gap-1">
                    <Briefcase className="h-3 w-3" />
                    {kw}
                  </Badge>
                ))}
              </div>
              {jobLocation && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {jobLocation}
                </div>
              )}
              {actorId ? (
                <p className="text-[10px] text-muted-foreground font-mono">Actor: {actorId}</p>
              ) : (
                <p className="text-[10px] text-amber-600">⚠ No Apify actor configured — go to Settings to add one</p>
              )}
            </div>

            <Button onClick={handleSearch} disabled={!actorId} className="gap-2">
              <Search className="h-4 w-4" />
              Search Job Postings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="text-center space-y-1 mt-2">
          <p className="text-sm font-medium">Searching job postings for "{jobKeywords.join(", ")}"</p>
          <p className="text-xs text-muted-foreground animate-pulse">{SEARCH_MESSAGES[msgIdx]}</p>
          <p className="text-[10px] text-muted-foreground mt-3">This may take a few minutes while the actor runs</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-1">Job Posting Discovery</h2>
        </div>
        <Card>
          <CardContent className="p-5 flex flex-col items-center gap-3 py-12">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="text-sm font-medium">Search Failed</p>
            <p className="text-xs text-muted-foreground text-center max-w-md">{errorMsg}</p>
            <Button variant="outline" onClick={handleSearch} className="mt-2 gap-2">
              <Search className="h-4 w-4" />
              Retry Search
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Results phase
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Companies from Job Postings</h2>
          <p className="text-xs text-muted-foreground">
            {jobs.length} jobs found across {companies.length} companies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => toggleAll(true)}>Select All</Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => toggleAll(false)}>Deselect All</Button>
        </div>
      </div>

      <div className="space-y-2">
        {companies.map(company => {
          const expanded = expandedCompany === company.id;
          const companyJobs = jobs.filter(j => {
            const key = j.companyDomain || j.companyName.toLowerCase().replace(/\s+/g, "_");
            const cKey = company.domain || company.name.toLowerCase().replace(/\s+/g, "_");
            return key === cKey;
          });

          return (
            <Card key={company.id} className={`transition-all ${company.selected ? "ring-1 ring-primary/40" : ""}`}>
              <CardContent className="p-0">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedCompany(expanded ? null : company.id)}
                >
                  <Checkbox
                    checked={company.selected}
                    onCheckedChange={() => toggleSelect(company.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{company.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {company.domain || company.location || "—"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                    <Briefcase className="h-3 w-3" />
                    {company.relevantJobCount} job{company.relevantJobCount !== 1 ? "s" : ""}
                  </Badge>
                  <Badge className={`shrink-0 text-[10px] ${
                    company.basicTier === "T1" ? "bg-success/15 text-success border-success/30"
                    : company.basicTier === "T2" ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-warning/15 text-warning border-warning/30"
                  }`}>
                    {company.basicTier}
                  </Badge>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Matching Job Postings:</p>
                        {companyJobs.map((job, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <Briefcase className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{job.jobTitle}</p>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {job.location && <span>{job.location}</span>}
                                {job.postedDate && <span>• {job.postedDate}</span>}
                              </div>
                            </div>
                            {job.url && (
                              <a href={job.url} target="_blank" rel="noreferrer" className="text-primary hover:underline shrink-0">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                        {company.domain && (
                          <a
                            href={`https://${company.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            Visit website <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedCount} companies selected</span>
          </div>
        </div>
      )}
    </div>
  );
}
