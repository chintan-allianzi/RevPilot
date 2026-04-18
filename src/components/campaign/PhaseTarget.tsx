import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Headphones, Shield, Network, Code, ChevronRight, Plus, Pencil,
  Layers, Info, Zap, TrendingUp, Cpu, DollarSign, BarChart3,
  Briefcase, Search, MapPin, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VerticalConfig } from "@/lib/icp-config";

export type CampaignMode = "standard" | "job_posting";

/* ── Signal Weights ── */
export interface SignalWeights {
  openJobPostings: number;
  hiringVelocity: number;
  techStackOverlap: number;
  fundingEvent: number;
  headcountGrowth: number;
}

export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  openJobPostings: 85,
  hiringVelocity: 70,
  techStackOverlap: 60,
  fundingEvent: 50,
  headcountGrowth: 40,
};

const SIGNAL_SLIDER_CONFIG = [
  { key: "openJobPostings" as const, label: "Open job postings", icon: Zap, color: "text-amber-500" },
  { key: "hiringVelocity" as const, label: "Hiring velocity", icon: TrendingUp, color: "text-emerald-500" },
  { key: "techStackOverlap" as const, label: "Tech stack overlap", icon: Cpu, color: "text-violet-500" },
  { key: "fundingEvent" as const, label: "Funding event", icon: DollarSign, color: "text-blue-500" },
  { key: "headcountGrowth" as const, label: "Headcount growth", icon: BarChart3, color: "text-rose-500" },
];

/* ── ICP Completeness ── */
function computeICPCompleteness(v: VerticalConfig): number {
  const fields = [
    (v.buyerPersonas?.length || 0) > 0,
    (v.jobTitlesToSearch?.length || 0) > 0,
    (v.techStack?.length || 0) > 0,
    ((v as any).defaultIndustries?.length || (v as any).default_industries?.length || 0) > 0,
    !!(v.defaultMinEmployees || (v as any).default_min_employees),
    !!(v.defaultMaxEmployees || (v as any).default_max_employees),
    !!(v.defaultMinRevenue || (v as any).default_min_revenue),
    !!(v.defaultMaxRevenue || (v as any).default_max_revenue),
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

/* ── Visual Helpers ── */
const verticalIcons: Record<string, React.ElementType> = {
  "IT Help Desk": Headphones,
  "NOC": Network,
  "SOC": Shield,
  "Software Dev": Code,
};

const verticalAccent: Record<string, { border: string; bg: string; icon: string }> = {
  "IT Help Desk": { border: "border-primary", bg: "bg-primary/5", icon: "text-primary" },
  "NOC": { border: "border-warning", bg: "bg-warning/5", icon: "text-warning" },
  "SOC": { border: "border-destructive", bg: "bg-destructive/5", icon: "text-destructive" },
  "Software Dev": { border: "border-success", bg: "bg-success/5", icon: "text-success" },
};

/* ── Component ── */
interface PhaseTargetProps {
  verticals: VerticalConfig[];
  selectedVertical: string | null;
  onSelectVertical: (name: string) => void;
  onCreateVertical: () => void;
  onEditVertical: (v: VerticalConfig, e: React.MouseEvent) => void;
  signalWeights: SignalWeights;
  onSignalWeightsChange: (weights: SignalWeights) => void;
  campaignMode: CampaignMode;
  onCampaignModeChange: (mode: CampaignMode) => void;
  jobKeywords: string[];
  onJobKeywordsChange: (keywords: string[]) => void;
  jobLocation: string;
  onJobLocationChange: (location: string) => void;
  onContinueJobPosting?: () => void;
}

export default function PhaseTarget({
  verticals,
  selectedVertical,
  onSelectVertical,
  onCreateVertical,
  onEditVertical,
  signalWeights,
  onSignalWeightsChange,
  campaignMode,
  onCampaignModeChange,
  jobKeywords,
  onJobKeywordsChange,
  jobLocation,
  onJobLocationChange,
  onContinueJobPosting,
}: PhaseTargetProps) {
  const [keywordInput, setKeywordInput] = useState("");

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !jobKeywords.includes(kw)) {
      onJobKeywordsChange([...jobKeywords, kw]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    onJobKeywordsChange(jobKeywords.filter(k => k !== kw));
  };
  return (
    <div className="space-y-8">
      {/* ── Campaign Mode Toggle ── */}
      <div>
        <h2 className="text-base font-semibold mb-1">Campaign Mode</h2>
        <p className="text-xs text-muted-foreground mb-3">Choose how to discover target companies</p>
        <div className="grid grid-cols-2 gap-3">
          <Card
            className={`cursor-pointer transition-all border-2 ${campaignMode === "standard" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/40"}`}
            onClick={() => onCampaignModeChange("standard")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Standard</p>
                <p className="text-[10px] text-muted-foreground">ICP-based company search via Apollo / Prospeo</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all border-2 ${campaignMode === "job_posting" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/40"}`}
            onClick={() => onCampaignModeChange("job_posting")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Job Posting</p>
                <p className="text-[10px] text-muted-foreground">Find companies via job board scraping (Apify)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Job Posting Keywords (only in job_posting mode) ── */}
      {campaignMode === "job_posting" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Job Search Keywords
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Enter the job titles/keywords to search for on job boards</p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  placeholder='e.g. "React Developer", "Data Engineer"'
                  className="text-sm"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                />
                <button
                  onClick={addKeyword}
                  disabled={!keywordInput.trim()}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              {jobKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {jobKeywords.map(kw => (
                    <Badge key={kw} variant="secondary" className="text-xs gap-1 pr-1">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="ml-0.5 p-0.5 rounded hover:bg-muted">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium mb-1 block">Location (optional)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={jobLocation}
                    onChange={e => onJobLocationChange(e.target.value)}
                    placeholder="e.g. United States, New York"
                    className="text-sm pl-9"
                  />
                </div>
              </div>

              {/* Continue button for job posting mode */}
              {jobKeywords.length > 0 && onContinueJobPosting && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={onContinueJobPosting}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Continue to Discovery →
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Vertical Selection ── */}
      <div>
        <h2 className="text-base font-semibold mb-1">Choose a vertical to target</h2>
        <p className="text-xs text-muted-foreground mb-4">Select an existing vertical or create a custom one</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {verticals.map((v) => {
            const Icon = verticalIcons[v.name] || Layers;
            const accent = verticalAccent[v.name] || { border: "border-border", bg: "bg-muted/5", icon: "text-muted-foreground" };
            const selected = selectedVertical === v.name;
            const completeness = computeICPCompleteness(v);

            return (
              <Card
                key={v.id}
                className={`cursor-pointer transition-all duration-200 relative group hover:shadow-md hover:-translate-y-0.5 border-2 ${
                  selected ? `ring-2 ring-primary ${accent.border} ${accent.bg}` : `border-border hover:${accent.border}`
                }`}
                onClick={() => onSelectVertical(v.name)}
              >
                <CardContent className="p-5">
                  <button
                    onClick={(e) => onEditVertical(v, e)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-start justify-between pr-6">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-card border ${accent.icon}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{v.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.savings} savings</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* ICP Completeness */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground">ICP Completeness</span>
                      <span className={`text-[10px] font-bold ${
                        completeness >= 80 ? "text-success" : completeness >= 50 ? "text-warning" : "text-destructive"
                      }`}>
                        {completeness}%
                      </span>
                    </div>
                    <Progress value={completeness} className="h-1.5" />
                  </div>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {v.techStack.slice(0, 4).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                    {v.techStack.length > 4 && (
                      <Badge variant="outline" className="text-[10px]">+{v.techStack.length - 4}</Badge>
                    )}
                  </div>
                  {!v.isDefault && (
                    <Badge variant="outline" className="text-[10px] mt-2">Custom</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Create card */}
          <Card
            className="cursor-pointer transition-all duration-200 border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:-translate-y-0.5"
            onClick={onCreateVertical}
          >
            <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[140px] gap-2">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted border border-dashed border-muted-foreground/30">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Create Custom Vertical</p>
              <p className="text-xs text-muted-foreground/60">Use AI to define your ICP</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Signal Weights Panel ── */}
      {selectedVertical && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Intent Signal Weights
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adjust how much each buying signal contributes to company scoring in Phase 2
                </p>
              </div>

              <div className="space-y-4">
                {SIGNAL_SLIDER_CONFIG.map(({ key, label, icon: SIcon, color }) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SIcon className={`h-3.5 w-3.5 ${color}`} />
                        <span className="text-xs font-medium">{label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-muted-foreground">
                        {signalWeights[key]}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[signalWeights[key]]}
                      onValueChange={([v]) =>
                        onSignalWeightsChange({ ...signalWeights, [key]: v })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
