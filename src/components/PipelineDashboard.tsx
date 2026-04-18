import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DollarSign,
  TrendingUp,
  Trophy,
  XCircle,
  Clock,
  ArrowRightLeft,
  Calendar,
  Target,
  Users,
  Activity,
  CheckCircle2,
} from "lucide-react";

interface StageWithProb {
  id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  stage_type: string;
  default_probability: number;
}

interface DealRow {
  id: string;
  deal_name: string;
  deal_value: number | null;
  stage_id: string;
  assigned_to: string | null;
  created_at: string;
  won_date: string | null;
  expected_close_date: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

type AccentColor = "green" | "blue" | "orange";

const accentBorder: Record<AccentColor, string> = {
  green: "border-l-4 border-l-success",
  blue: "border-l-4 border-l-primary",
  orange: "border-l-4 border-l-warning",
};

const accentIconBg: Record<AccentColor, string> = {
  green: "bg-success/10 text-success",
  blue: "bg-primary/10 text-primary",
  orange: "bg-warning/10 text-warning",
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  sub,
  accent = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: AccentColor;
}) => (
  <Card className={`${accentBorder[accent]} hover:shadow-md transition-shadow duration-200`}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className="text-xl font-bold mt-0.5">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accentIconBg[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const fmt = (val: number) => {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

const FUNNEL_COLORS = [
  "from-primary/90 to-primary/70",
  "from-primary/80 to-primary/60",
  "from-primary/70 to-primary/50",
  "from-primary/60 to-primary/40",
  "from-[hsl(280,60%,55%)]/80 to-[hsl(280,60%,55%)]/60",
  "from-[hsl(280,60%,55%)]/70 to-[hsl(280,60%,55%)]/50",
  "from-[hsl(280,60%,55%)]/60 to-[hsl(280,60%,55%)]/40",
];

export default function PipelineDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [stages, setStages] = useState<StageWithProb[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasksDue, setTasksDue] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [stagesRes, dealsRes, profilesRes, activitiesRes, tasksRes, appointmentsRes, histRes] = await Promise.all([
      supabase.from("lead_stages").select("*").order("stage_order"),
      supabase.from("deals").select("id, deal_name, deal_value, stage_id, assigned_to, created_at, won_date, expected_close_date"),
      supabase.from("profiles").select("id, full_name").eq("is_active", true),
      supabase.from("deal_activities").select("*").order("activity_date", { ascending: false }).limit(isAdmin ? 20 : 10),
      supabase.from("deal_tasks").select("*, deal:deals(deal_name)").eq("status", "pending").lte("due_date", new Date(Date.now() + 86400000).toISOString()).order("due_date").limit(10),
      supabase.from("appointments").select("id, deal_id, title, scheduled_at").eq("status", "scheduled").gte("scheduled_at", new Date(new Date().setDate(new Date().getDate() - 7)).toISOString()),
      supabase.from("deal_stage_history").select("deal_id, from_stage_id, to_stage_id, changed_at"),
    ]);

    setStages((stagesRes.data || []) as StageWithProb[]);
    setDeals((dealsRes.data || []) as DealRow[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setActivities(activitiesRes.data || []);
    setTasksDue(tasksRes.data || []);
    setAppointments(appointmentsRes.data || []);
    setStageHistory(histRes.data || []);
    setLoading(false);
  };

  const toggleTask = async (taskId: string) => {
    await supabase.from("deal_tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId);
    setTasksDue(prev => prev.filter(t => t.id !== taskId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const now = new Date();
  const thisMonth = (d: string | null) => d && new Date(d).getMonth() === now.getMonth() && new Date(d).getFullYear() === now.getFullYear();

  const activeStages = stages.filter(s => s.stage_type !== "closed");
  const closedWonStage = stages.find(s => s.stage_key === "closed_won");
  const closedLostStage = stages.find(s => s.stage_key === "closed_lost");

  const activeDeals = deals.filter(d => {
    const s = stages.find(st => st.id === d.stage_id);
    return s && s.stage_type !== "closed";
  });

  const wonDeals = deals.filter(d => d.stage_id === closedWonStage?.id);
  const lostDeals = deals.filter(d => d.stage_id === closedLostStage?.id);

  const wonThisMonth = wonDeals.filter(d => thisMonth(d.won_date));
  const lostThisMonth = lostDeals.filter(d => thisMonth(d.created_at));

  const totalPipelineValue = activeDeals.reduce((s, d) => s + (d.deal_value || 0), 0);
  const weightedPipeline = activeDeals.reduce((s, d) => {
    const stage = stages.find(st => st.id === d.stage_id);
    const prob = stage?.default_probability || 0;
    return s + (d.deal_value || 0) * (prob / 100);
  }, 0);

  const wonThisMonthValue = wonThisMonth.reduce((s, d) => s + (d.deal_value || 0), 0);

  const wonDealCycles = wonDeals.map(d => {
    const created = new Date(d.created_at);
    const won = d.won_date ? new Date(d.won_date) : now;
    return Math.floor((won.getTime() - created.getTime()) / 86400000);
  });
  const avgCycle = wonDealCycles.length > 0 ? Math.round(wonDealCycles.reduce((a, b) => a + b, 0) / wonDealCycles.length) : 0;

  const mqlStage = stages.find(s => s.stage_key === "mql");
  const mqlCount = deals.filter(d => {
    const hist = stageHistory.filter(h => h.deal_id === d.id);
    return hist.some(h => h.to_stage_id === mqlStage?.id) || d.stage_id === mqlStage?.id;
  }).length;

  const sqlStage = stages.find(s => s.stage_key === "sql");
  const sqlCount = deals.filter(d => {
    const hist = stageHistory.filter(h => h.deal_id === d.id);
    return hist.some(h => h.to_stage_id === sqlStage?.id) || d.stage_id === sqlStage?.id;
  }).length;

  const mqlToSql = mqlCount > 0 ? Math.round((sqlCount / mqlCount) * 100) : 0;

  const meetingStage = stages.find(s => s.stage_key === "meeting_completed");
  const meetingCount = deals.filter(d => {
    const hist = stageHistory.filter(h => h.deal_id === d.id);
    return hist.some(h => h.to_stage_id === meetingStage?.id) || d.stage_id === meetingStage?.id;
  }).length;
  const meetingToSql = meetingCount > 0 ? Math.round((sqlCount / meetingCount) * 100) : 0;

  const forecast = (days: number) => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);
    return activeDeals
      .filter(d => d.expected_close_date && new Date(d.expected_close_date) <= cutoff)
      .reduce((s, d) => {
        const stage = stages.find(st => st.id === d.stage_id);
        return s + (d.deal_value || 0) * ((stage?.default_probability || 0) / 100);
      }, 0);
  };

  const funnelData = activeStages.map(s => {
    const count = deals.filter(d => d.stage_id === s.id).length;
    return { ...s, count };
  });
  const maxFunnelCount = Math.max(...funnelData.map(f => f.count), 1);
  const allEmpty = funnelData.every(f => f.count === 0) && wonDeals.length === 0 && lostDeals.length === 0;

  const bdmStats = profiles.map(p => {
    const bdmDeals = deals.filter(d => d.assigned_to === p.id);
    const bdmActive = bdmDeals.filter(d => activeStages.some(s => s.id === d.stage_id));
    const bdmWon = bdmDeals.filter(d => d.stage_id === closedWonStage?.id);
    const bdmWonMonth = bdmWon.filter(d => thisMonth(d.won_date));
    const bdmPipelineVal = bdmActive.reduce((s, d) => s + (d.deal_value || 0), 0);
    const bdmRevenue = bdmWonMonth.reduce((s, d) => s + (d.deal_value || 0), 0);
    const bdmMeetingsWeek = appointments.filter(a => {
      const deal = deals.find(d => d.id === a.deal_id);
      return deal?.assigned_to === p.id;
    }).length;

    return {
      name: p.full_name,
      activeDeals: bdmActive.length,
      pipelineValue: bdmPipelineVal,
      wonMonth: bdmWonMonth.length,
      revenue: bdmRevenue,
      meetingsWeek: bdmMeetingsWeek,
    };
  }).filter(b => b.activeDeals > 0 || b.wonMonth > 0);

  const profMap = new Map(profiles.map(p => [p.id, p.full_name]));

  const forecastValues = [
    { label: "30 days", value: forecast(30) },
    { label: "60 days", value: forecast(60) },
    { label: "90 days", value: forecast(90) },
  ];
  const maxForecast = Math.max(...forecastValues.map(f => f.value), 1);

  return (
    <div className="space-y-6">
      {/* Key Metrics — 4 columns with colored accents */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign} label="Pipeline Value" value={fmt(totalPipelineValue)} accent="green" />
        <MetricCard icon={Target} label="Weighted Pipeline" value={fmt(weightedPipeline)} sub="Value × probability" accent="green" />
        <MetricCard icon={Trophy} label="Won This Month" value={wonThisMonth.length} sub={fmt(wonThisMonthValue)} accent="green" />
        <MetricCard icon={XCircle} label="Lost This Month" value={lostThisMonth.length} accent="orange" />
        <MetricCard icon={Clock} label="Avg Deal Cycle" value={`${avgCycle}d`} sub="Created → Won" accent="orange" />
        <MetricCard icon={ArrowRightLeft} label="MQL → SQL" value={`${mqlToSql}%`} accent="blue" />
        <MetricCard icon={ArrowRightLeft} label="Meeting → SQL" value={`${meetingToSql}%`} accent="blue" />
        <MetricCard icon={TrendingUp} label="Active Deals" value={activeDeals.length} accent="blue" />
      </div>

      {/* Funnel (60%) + Revenue Forecast (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {allEmpty ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Target className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No deals in pipeline yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first deal to see the funnel</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {funnelData.map((s, i) => {
                  const nextCount = i < funnelData.length - 1 ? funnelData[i + 1].count : null;
                  const convPct = nextCount !== null && s.count > 0 ? Math.round((nextCount / s.count) * 100) : null;
                  const widthPct = Math.max((s.count / maxFunnelCount) * 100, 12);
                  const colorClass = FUNNEL_COLORS[i % FUNNEL_COLORS.length];

                  return (
                    <div key={s.id}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs w-40 text-muted-foreground font-medium flex-shrink-0">{s.stage_name}</span>
                        <div className="flex-1 relative">
                          <div
                            className={`h-8 bg-gradient-to-r ${colorClass} rounded-md flex items-center px-3 transition-all duration-500`}
                            style={{ width: `${widthPct}%` }}
                          >
                            <span className="text-xs font-bold text-primary-foreground">{s.count}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground w-10 text-right flex-shrink-0">{s.default_probability}%</span>
                      </div>
                      {convPct !== null && (
                        <div className="flex items-center gap-3 pl-40 py-0.5">
                          <span className="text-[10px] text-muted-foreground">↓ {convPct}% conversion</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Won / Lost */}
                <div className="pt-3 mt-2 border-t border-border space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-40 text-success font-semibold flex-shrink-0">Won</span>
                    <div className="flex-1">
                      <div
                        className="h-8 bg-gradient-to-r from-success/80 to-success/60 rounded-md flex items-center px-3"
                        style={{ width: `${Math.max((wonDeals.length / maxFunnelCount) * 100, 12)}%` }}
                      >
                        <span className="text-xs font-bold text-success-foreground">{wonDeals.length}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right flex-shrink-0">100%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-40 text-destructive font-semibold flex-shrink-0">Lost</span>
                    <div className="flex-1">
                      <div
                        className="h-8 bg-gradient-to-r from-destructive/60 to-destructive/40 rounded-md flex items-center px-3"
                        style={{ width: `${Math.max((lostDeals.length / maxFunnelCount) * 100, 12)}%` }}
                      >
                        <span className="text-xs font-bold text-destructive-foreground">{lostDeals.length}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right flex-shrink-0">0%</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Forecast */}
        <Card className="lg:col-span-2 border-t-4 border-t-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Revenue Forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {forecastValues.map(f => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-bold">{fmt(f.value)}</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
                    style={{ width: `${maxForecast > 0 ? (f.value / maxForecast) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">
              Based on expected close date × deal value × stage probability
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BDM Leaderboard + Tasks Due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isAdmin && bdmStats.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" /> BDM Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">BDM</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Active</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Pipeline</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Won</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Revenue</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Mtgs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bdmStats.sort((a, b) => b.revenue - a.revenue).map(b => (
                      <tr key={b.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 font-medium">{b.name}</td>
                        <td className="py-2.5 text-right">{b.activeDeals}</td>
                        <td className="py-2.5 text-right">{fmt(b.pipelineValue)}</td>
                        <td className="py-2.5 text-right">{b.wonMonth}</td>
                        <td className="py-2.5 text-right font-semibold">{fmt(b.revenue)}</td>
                        <td className="py-2.5 text-right">{b.meetingsWeek}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Tasks Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksDue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tasks due today 🎉</p>
            ) : (
              <div className="space-y-1">
                {tasksDue.map(task => {
                  const isOverdue = new Date(task.due_date) < now;
                  const priorityDot: Record<string, string> = { high: "bg-destructive", medium: "bg-warning", low: "bg-success" };
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => toggleTask(task.id)}
                        className="flex-shrink-0"
                      />
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[task.priority] || "bg-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{task.title}</p>
                        <button
                          onClick={() => navigate(`/pipeline/${task.deal_id}`)}
                          className="text-[10px] text-primary hover:underline truncate block"
                        >
                          {(task.deal as any)?.deal_name || "View deal"}
                        </button>
                      </div>
                      {isOverdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                      <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-1">
              {activities.slice(0, 10).map(act => {
                const typeColor: Record<string, string> = {
                  email_sent: "bg-primary",
                  email_received: "bg-primary",
                  meeting: "bg-success",
                  meeting_scheduled: "bg-success",
                  meeting_completed: "bg-success",
                  note: "bg-muted-foreground",
                  stage_change: "bg-[hsl(280,60%,50%)]",
                  call: "bg-warning",
                };
                const dotColor = typeColor[act.activity_type] || "bg-muted-foreground";

                return (
                  <button
                    key={act.id}
                    onClick={() => navigate(`/pipeline/${act.deal_id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${dotColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{act.subject}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {act.created_by ? profMap.get(act.created_by) || "" : ""} · {act.activity_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(act.activity_date).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
