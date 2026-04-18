import { useState, useEffect } from "react";
import { Search, ArrowLeft, Loader2, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/TagInput";
import { VerticalConfig } from "@/lib/icp-config";
import {
  ICPFilters,
  COMPANY_SIZE_OPTIONS,
  REVENUE_OPTIONS,
  COMMON_INDUSTRIES,
} from "@/lib/company-types";

interface ICPFiltersStepProps {
  vertical: VerticalConfig;
  onBack: () => void;
  onSearch: (filters: ICPFilters) => void;
  onSkipToSaved?: () => void;
  savedCompanyCount?: number;
  searching: boolean;
}

export default function ICPFiltersStep({ vertical, onBack, onSearch, onSkipToSaved, savedCompanyCount = 0, searching }: ICPFiltersStepProps) {
  const [filters, setFilters] = useState<ICPFilters>(() => ({
    jobTitles: [...vertical.jobTitlesToSearch],
    companyMinSize: vertical.defaultMinEmployees || "51",
    companyMaxSize: vertical.defaultMaxEmployees || "5001",
    revenueMin: vertical.defaultMinRevenue || "10000000",
    revenueMax: vertical.defaultMaxRevenue || "1000000000",
    locations: [...(vertical.defaultLocations || ["United States"])],
    industriesToInclude: [...((vertical as any).defaultIndustries || [])],
    industriesToExclude: [...((vertical as any).defaultExcludeIndustries || ["Staffing and Recruiting"])],
    buyerPersonas: [...vertical.buyerPersonas],
    techStack: [...vertical.techStack],
    growthSignals: {
      hiringRelevant: true,
      headcountGrowth: true,
      recentFunding: false,
      newOffices: false,
    },
    resultsLimit: 25,
  }));

  const [industrySearch, setIndustrySearch] = useState("");

  useEffect(() => {
    setFilters((f) => ({
      ...f,
      jobTitles: [...vertical.jobTitlesToSearch],
      companyMinSize: vertical.defaultMinEmployees || "51",
      companyMaxSize: vertical.defaultMaxEmployees || "5001",
      revenueMin: vertical.defaultMinRevenue || "10000000",
      revenueMax: vertical.defaultMaxRevenue || "1000000000",
      locations: [...(vertical.defaultLocations || ["United States"])],
      industriesToInclude: [...((vertical as any).defaultIndustries || [])],
      industriesToExclude: [...((vertical as any).defaultExcludeIndustries || ["Staffing and Recruiting"])],
      buyerPersonas: [...vertical.buyerPersonas],
      techStack: [...vertical.techStack],
    }));
  }, [vertical]);

  const update = <K extends keyof ICPFilters>(key: K, val: ICPFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const toggleGrowth = (key: keyof ICPFilters["growthSignals"]) =>
    setFilters((f) => ({
      ...f,
      growthSignals: { ...f.growthSignals, [key]: !f.growthSignals[key] },
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">ICP Filters — {vertical.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filters auto-populated from your vertical config. Adjust as needed.
          </p>
        </div>
      </div>

      {/* Skip to saved banner */}
      {savedCompanyCount > 0 && onSkipToSaved && (
        <Card className="border-primary/20 bg-primary/5 border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">You have {savedCompanyCount} saved companies</p>
                <p className="text-xs text-muted-foreground">Skip search and use your existing company list</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={onSkipToSaved} className="gap-1.5 shrink-0">
              <Database className="h-3.5 w-3.5" /> Use Saved Companies
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── LEFT: Company Size & Revenue ── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Company Size & Revenue</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Min Employees</Label>
                <Select value={filters.companyMinSize} onValueChange={(v) => update("companyMinSize", v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Max Employees</Label>
                <Select value={filters.companyMaxSize} onValueChange={(v) => update("companyMaxSize", v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Min Revenue</Label>
                <Select value={filters.revenueMin} onValueChange={(v) => update("revenueMin", v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REVENUE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Max Revenue</Label>
                <Select value={filters.revenueMax} onValueChange={(v) => update("revenueMax", v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REVENUE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Results Limit</Label>
              <Select value={String(filters.resultsLimit)} onValueChange={(v) => update("resultsLimit", Number(v))}>
                <SelectTrigger className="mt-1 text-sm w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── RIGHT: Location & Industry ── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Location & Industry</h3>

            <div>
              <Label className="text-xs font-medium">Location (HQ)</Label>
              <TagInput tags={filters.locations} onChange={(v) => update("locations", v)} placeholder="Add location..." />
            </div>

            <div>
              <Label className="text-xs font-medium">Industries to Include</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Select industries to narrow your search</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {filters.industriesToInclude.map((ind, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                    {ind}
                    <button onClick={() => update("industriesToInclude", filters.industriesToInclude.filter((_, idx) => idx !== i))}
                      className="hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={industrySearch}
                onChange={e => setIndustrySearch(e.target.value)}
                placeholder="Type to search industries..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
              {industrySearch && (
                <div className="mt-1 border border-border rounded-lg bg-background shadow-sm max-h-48 overflow-y-auto">
                  {COMMON_INDUSTRIES
                    .filter(ind => ind.toLowerCase().includes(industrySearch.toLowerCase()))
                    .filter(ind => !filters.industriesToInclude.includes(ind))
                    .map(ind => (
                      <button key={ind} onClick={() => {
                        update("industriesToInclude", [...filters.industriesToInclude, ind]);
                        setIndustrySearch('');
                      }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                        {ind}
                      </button>
                    ))
                  }
                </div>
              )}
              {!industrySearch && filters.industriesToInclude.length === 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Insurance', 'Financial Services', 'Healthcare', 'Technology', 'Manufacturing', 'Retail', 'Real Estate', 'Legal Services'].map(ind => (
                    <button key={ind} onClick={() => update("industriesToInclude", [...filters.industriesToInclude, ind])}
                      className="text-xs px-2.5 py-1 border border-border rounded-full hover:bg-muted transition-colors">
                      + {ind}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium">Industries to Exclude</Label>
              <TagInput
                tags={filters.industriesToExclude}
                onChange={(v) => update("industriesToExclude", v)}
                placeholder="Add industry to exclude..."
              />
            </div>
          </CardContent>
        </Card>

        {/* ── LEFT: Job Titles & Personas ── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Job Titles & Personas</h3>

            <div>
              <Label className="text-xs font-medium">Job Titles to Search</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Companies actively hiring for these roles show demand</p>
              <TagInput tags={filters.jobTitles} onChange={(v) => update("jobTitles", v)} placeholder="Add job title..." />
            </div>

            <div>
              <Label className="text-xs font-medium">Buyer Personas / Decision Makers</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">We'll find these titles at matching companies</p>
              <TagInput tags={filters.buyerPersonas} onChange={(v) => update("buyerPersonas", v)} placeholder="Add buyer title..." />
            </div>
          </CardContent>
        </Card>

        {/* ── RIGHT: Tech Stack & Growth ── */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tech Stack & Growth</h3>

            <div>
              <Label className="text-xs font-medium">Tech Stack Filter</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Filter for companies using these technologies</p>
              <TagInput tags={filters.techStack} onChange={(v) => update("techStack", v)} placeholder="Add technology..." />
            </div>

            <div>
              <Label className="text-xs font-medium mb-2 block">Growth Signals</Label>
              <div className="space-y-2.5">
                {([
                  { key: "hiringRelevant" as const, label: "Hiring for relevant roles in last 6 months" },
                  { key: "headcountGrowth" as const, label: "Headcount growth > 10% in last 12 months" },
                  { key: "recentFunding" as const, label: "Recently raised funding" },
                  { key: "newOffices" as const, label: "New office locations" },
                ]).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <Checkbox
                      id={key}
                      checked={filters.growthSignals[key]}
                      onCheckedChange={() => toggleGrowth(key)}
                    />
                    <label htmlFor={key} className="text-xs cursor-pointer">{label}</label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom nav */}
      <div className="flex justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> ← Back: Vertical
        </Button>
        <Button onClick={() => onSearch(filters)} disabled={searching || filters.jobTitles.length === 0} className="gap-2 px-6">
          {searching ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Searching...</>
          ) : (
            <><Search className="h-4 w-4" /> Next: Intent & Signals →</>
          )}
        </Button>
      </div>
    </div>
  );
}
