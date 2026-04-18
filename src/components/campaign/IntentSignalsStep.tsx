import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, Plus, X, Zap, TrendingUp, Globe, Cpu, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SignalConfig {
  id: string;
  name: string;
  category: "hiring" | "growth" | "outsourcing" | "tech" | "custom";
  enabled: boolean;
  weight: number;
  description: string;
  config: Record<string, any>;
}

export interface IntentConfiguration {
  signals: SignalConfig[];
  tierThresholds: { t1: number; t2: number };
  excludeRules: string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  hiring: { label: "Hiring Signals", icon: Zap, color: "text-amber-600" },
  growth: { label: "Growth Signals", icon: TrendingUp, color: "text-emerald-600" },
  outsourcing: { label: "Outsourcing Readiness", icon: Globe, color: "text-blue-600" },
  tech: { label: "Tech & Industry", icon: Cpu, color: "text-violet-600" },
  custom: { label: "Custom Signals", icon: Sparkles, color: "text-primary" },
};

export function buildDefaultSignals(vertical: any): SignalConfig[] {
  return [
    {
      id: "active_job_postings",
      name: "Active job postings for relevant roles",
      category: "hiring",
      enabled: true,
      weight: 35,
      description: "Companies actively hiring for roles related to your vertical",
      config: { roles: vertical?.jobTitlesToSearch || vertical?.job_titles_to_search || [], timeframe: "90" },
    },
    {
      id: "multiple_openings",
      name: "Multiple open positions (3+ roles)",
      category: "hiring",
      enabled: true,
      weight: 10,
      description: "Companies with 3 or more relevant job openings — high demand signal",
      config: { minimumOpenings: 3 },
    },
    {
      id: "headcount_growth_12mo",
      name: "Headcount growth (12 months)",
      category: "growth",
      enabled: true,
      weight: 15,
      description: "Company grew headcount significantly in the last year",
      config: { minimumGrowth: 10, bonusThreshold: 25 },
    },
    {
      id: "headcount_growth_24mo",
      name: "Headcount growth (24 months)",
      category: "growth",
      enabled: true,
      weight: 5,
      description: "Sustained growth over two years",
      config: { minimumGrowth: 15 },
    },
    {
      id: "recent_funding",
      name: "Recently raised funding",
      category: "growth",
      enabled: false,
      weight: 5,
      description: "Company raised a funding round in the last 12 months",
      config: { timeframe: "12" },
    },
    {
      id: "remote_work",
      name: "Remote/hybrid work indicators",
      category: "outsourcing",
      enabled: true,
      weight: 10,
      description: "Remote job postings or distributed team mentions",
      config: { keywords: ["remote", "hybrid", "distributed", "work from home", "virtual"] },
    },
    {
      id: "existing_outsourcing",
      name: "Existing outsourcing/offshoring activity",
      category: "outsourcing",
      enabled: true,
      weight: 5,
      description: "Company already uses offshore teams or BPO services",
      config: { keywords: ["offshore", "outsource", "BPO", "nearshore", "global team"] },
    },
    {
      id: "cost_optimization",
      name: "Cost optimization signals",
      category: "outsourcing",
      enabled: true,
      weight: 5,
      description: "Signs the company is looking to reduce costs or improve efficiency",
      config: { keywords: ["cost reduction", "efficiency", "restructuring", "lean", "optimize"] },
    },
    {
      id: "tech_stack_match",
      name: "Tech stack match",
      category: "tech",
      enabled: true,
      weight: 5,
      description: "Company uses technologies that align with your vertical",
      config: { technologies: vertical?.techStack || vertical?.tech_stack || [] },
    },
    {
      id: "industry_complexity",
      name: "Regulated industry bonus",
      category: "tech",
      enabled: true,
      weight: 5,
      description: "Regulated industries (insurance, healthcare, finance) score higher",
      config: { industries: ["Insurance", "Healthcare", "Financial Services", "Banking", "Pharmaceuticals"] },
    },
  ];
}

export function buildDefaultIntentConfig(vertical: any): IntentConfiguration {
  return {
    signals: buildDefaultSignals(vertical),
    tierThresholds: { t1: 65, t2: 35 },
    excludeRules: ["Staffing and Recruiting", "Employment Services"],
  };
}

/* ------------------------------------------------------------------ */
/* Signal Card                                                         */
/* ------------------------------------------------------------------ */

function SignalCard({ signal, onChange }: { signal: SignalConfig; onChange: (s: SignalConfig) => void }) {
  const sliderColor = signal.weight >= 20 ? "bg-success" : signal.weight >= 10 ? "bg-warning" : "bg-muted-foreground/30";

  return (
    <div className={`p-4 rounded-lg border transition-all duration-200 ${signal.enabled ? "border-primary/30 bg-card shadow-sm" : "border-border bg-muted/10 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={signal.enabled}
          onCheckedChange={(v) => onChange({ ...signal, enabled: !!v })}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{signal.name}</p>
            {signal.enabled && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                signal.weight >= 20 ? "bg-success/10 text-success" : signal.weight >= 10 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
              }`}>
                {signal.weight}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{signal.description}</p>

          {signal.enabled && (
            <div className="mt-3 space-y-3">
              {/* Weight slider with colored fill */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-14">Weight:</span>
                <div className="flex-1 relative">
                  <Slider
                    min={0} max={50} step={1}
                    value={[signal.weight]}
                    onValueChange={([v]) => onChange({ ...signal, weight: v })}
                    className="flex-1"
                  />
                </div>
                <span className="text-xs font-mono w-10 text-right">{signal.weight}%</span>
              </div>

              {/* Roles config */}
              {signal.id === "active_job_postings" && signal.config.roles?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Roles to detect:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {signal.config.roles.map((role: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{role}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Growth config */}
              {signal.id === "headcount_growth_12mo" && (
                <div className="flex gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Min growth:</span>
                    <Select
                      value={String(signal.config.minimumGrowth)}
                      onValueChange={(v) => onChange({ ...signal, config: { ...signal.config, minimumGrowth: +v } })}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20, 25].map((n) => <SelectItem key={n} value={String(n)}>{n}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Bonus above:</span>
                    <Select
                      value={String(signal.config.bonusThreshold)}
                      onValueChange={(v) => onChange({ ...signal, config: { ...signal.config, bonusThreshold: +v } })}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[20, 25, 30, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Keywords display */}
              {signal.config.keywords && (
                <div>
                  <span className="text-xs text-muted-foreground">Keywords to detect:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {signal.config.keywords.map((kw: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Technologies */}
              {signal.id === "tech_stack_match" && signal.config.technologies?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Technologies:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {signal.config.technologies.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

interface IntentSignalsStepProps {
  vertical: any;
  intentConfig: IntentConfiguration;
  setIntentConfig: React.Dispatch<React.SetStateAction<IntentConfiguration>>;
  onBack: () => void;
  onNext: () => void;
}

export default function IntentSignalsStep({ vertical, intentConfig, setIntentConfig, onBack, onNext }: IntentSignalsStepProps) {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customKeywords, setCustomKeywords] = useState("");

  const totalWeight = intentConfig.signals.filter((s) => s.enabled).reduce((sum, s) => sum + s.weight, 0);
  const categories = ["hiring", "growth", "outsourcing", "tech", "custom"] as const;

  const updateSignal = (updated: SignalConfig) => {
    setIntentConfig((prev) => ({
      ...prev,
      signals: prev.signals.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  const handleAddCustomSignal = () => {
    if (!customName.trim()) return;
    const newSignal: SignalConfig = {
      id: `custom_${Date.now()}`,
      name: customName,
      category: "custom",
      enabled: true,
      weight: 5,
      description: customDesc || customName,
      config: { keywords: customKeywords.split(",").map((k) => k.trim()).filter(Boolean) },
    };
    setIntentConfig((prev) => ({ ...prev, signals: [...prev.signals, newSignal] }));
    setCustomName("");
    setCustomDesc("");
    setCustomKeywords("");
    setShowAddCustom(false);
  };

  const handleRemoveCustomSignal = (id: string) => {
    setIntentConfig((prev) => ({ ...prev, signals: prev.signals.filter((s) => s.id !== id) }));
  };

  const handleSaveDefaults = async () => {
    if (!vertical?.id) return;
    const { error } = await supabase
      .from("verticals")
      .update({ default_intent_config: intentConfig as any, updated_at: new Date().toISOString() })
      .eq("id", vertical.id);
    if (error) toast.error("Failed to save defaults");
    else toast.success(`Signal defaults saved for "${vertical.name}"`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Intent & Signals — {vertical?.name}</h2>
          <p className="text-sm text-muted-foreground">Define the buying signals that indicate demand for your service</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveDefaults} className="text-xs">
            Save as vertical defaults
          </Button>
        </div>
      </div>

      {/* Signal categories */}
      {categories.map((cat) => {
        const signals = intentConfig.signals.filter((s) => s.category === cat);
        if (signals.length === 0 && cat !== "custom") return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;

        return (
          <Card key={cat}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <h3 className="text-sm font-semibold">{meta.label}</h3>
                {cat === "hiring" && (
                  <Badge variant="secondary" className="text-[10px]">highest priority</Badge>
                )}
              </div>

              <div className="space-y-2">
                {signals.map((signal) => (
                  <div key={signal.id} className="relative">
                    <SignalCard signal={signal} onChange={updateSignal} />
                    {signal.category === "custom" && (
                      <button
                        onClick={() => handleRemoveCustomSignal(signal.id)}
                        className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add custom signal */}
              {cat === "custom" && (
                <>
                  {showAddCustom ? (
                    <div className="p-4 border border-dashed border-primary/30 rounded-lg space-y-3">
                      <Input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Signal name (e.g., 'Uses legacy systems')"
                      />
                      <Input
                        value={customDesc}
                        onChange={(e) => setCustomDesc(e.target.value)}
                        placeholder="What to look for..."
                      />
                      <Input
                        value={customKeywords}
                        onChange={(e) => setCustomKeywords(e.target.value)}
                        placeholder="Keywords (comma separated)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddCustomSignal}>Add Signal</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowAddCustom(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setShowAddCustom(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Add custom signal
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Tier thresholds */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Tier Scoring Thresholds</h3>

          {/* Gradient tier bar */}
          <div className="relative">
            <div className="relative h-10 rounded-xl overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-warning/40 to-warning/20"
                style={{ width: `${intentConfig.tierThresholds.t2}%` }}
              />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-primary/30 to-primary/20"
                style={{ left: `${intentConfig.tierThresholds.t2}%`, width: `${intentConfig.tierThresholds.t1 - intentConfig.tierThresholds.t2}%` }}
              />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-success/30 to-success/20 rounded-r-xl"
                style={{ left: `${intentConfig.tierThresholds.t1}%`, right: 0 }}
              />
              <div className="absolute inset-0 flex items-center">
                <span className="text-[11px] font-semibold text-warning flex-1 text-center">T3 · Low</span>
                <span className="text-[11px] font-semibold text-primary flex-1 text-center">T2 · Medium</span>
                <span className="text-[11px] font-semibold text-success flex-1 text-center">T1 · Hot</span>
              </div>
            </div>
            {/* Threshold markers */}
            <div className="relative h-4 mt-1">
              <div
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${intentConfig.tierThresholds.t2}%` }}
              >
                <div className="w-0.5 h-2 bg-border" />
                <span className="text-[9px] font-mono text-muted-foreground">{intentConfig.tierThresholds.t2}</span>
              </div>
              <div
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${intentConfig.tierThresholds.t1}%` }}
              >
                <div className="w-0.5 h-2 bg-border" />
                <span className="text-[9px] font-mono text-muted-foreground">{intentConfig.tierThresholds.t1}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">T2 starts at:</span>
              <Input
                type="number" min={10} max={90}
                value={intentConfig.tierThresholds.t2}
                onChange={(e) => setIntentConfig((prev) => ({ ...prev, tierThresholds: { ...prev.tierThresholds, t2: +e.target.value } }))}
                className="w-16 h-8 text-sm text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">T1 starts at:</span>
              <Input
                type="number" min={20} max={95}
                value={intentConfig.tierThresholds.t1}
                onChange={(e) => setIntentConfig((prev) => ({ ...prev, tierThresholds: { ...prev.tierThresholds, t1: +e.target.value } }))}
                className="w-16 h-8 text-sm text-center"
              />
            </div>
            <div className="text-xs text-muted-foreground ml-auto">
              Total weight: <span className={totalWeight === 100 ? "text-success font-semibold" : "text-warning font-semibold"}>{totalWeight}%</span>
              {totalWeight !== 100 && <span className="text-warning ml-1">(should be ~100%)</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> ← Back: ICP Filters
        </Button>
        <Button onClick={onNext} className="gap-2">
          Next: Search Companies → <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
