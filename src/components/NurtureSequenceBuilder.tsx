import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  GripVertical,
  Mail,
  Linkedin,
  ClipboardList,
  ArrowLeft,
  Clock,
} from "lucide-react";

interface LeadStage {
  id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
}

interface Vertical {
  id: string;
  name: string;
}

interface NurtureStep {
  id?: string;
  step_order: number;
  delay_days: number;
  channel: "email" | "linkedin_message" | "task";
  subject_template: string;
  body_template: string;
}

interface NurtureSequence {
  id: string;
  name: string;
  trigger_stage: string;
  vertical_id: string | null;
  is_active: boolean;
  created_at: string;
  step_count?: number;
  stage_name?: string;
  vertical_name?: string;
}

const VARIABLES = [
  { key: "{{first_name}}", label: "First Name" },
  { key: "{{company_name}}", label: "Company" },
  { key: "{{vertical_role}}", label: "Vertical Role" },
  { key: "{{meeting_link}}", label: "Meeting Link" },
  { key: "{{sender_name}}", label: "Sender Name" },
  { key: "{{sender_title}}", label: "Sender Title" },
  { key: "{{sender_calendar_link}}", label: "Calendar Link" },
];

const CHANNEL_ICONS = {
  email: Mail,
  linkedin_message: Linkedin,
  task: ClipboardList,
};

export default function NurtureSequenceBuilder() {
  const { user } = useAuth();
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [sequences, setSequences] = useState<NurtureSequence[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [seqName, setSeqName] = useState("");
  const [triggerStage, setTriggerStage] = useState("");
  const [verticalId, setVerticalId] = useState<string>("all");
  const [steps, setSteps] = useState<NurtureStep[]>([]);
  const [saving, setSaving] = useState(false);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [stagesRes, verticalsRes, seqRes] = await Promise.all([
      supabase.from("lead_stages").select("id, stage_key, stage_name, stage_order").order("stage_order"),
      supabase.from("verticals").select("id, name").order("name"),
      supabase.from("nurture_sequences" as any).select("*").order("created_at", { ascending: false }),
    ]);

    const stagesData = (stagesRes.data || []) as LeadStage[];
    const verticalsData = (verticalsRes.data || []) as Vertical[];
    setStages(stagesData);
    setVerticals(verticalsData);

    // Enrich sequences with step counts and names
    const seqData = (seqRes.data || []) as any[];
    if (seqData.length > 0) {
      const seqIds = seqData.map((s: any) => s.id);
      const { data: allSteps } = await supabase
        .from("nurture_steps" as any)
        .select("sequence_id")
        .in("sequence_id", seqIds);

      const stepCounts: Record<string, number> = {};
      for (const s of (allSteps || []) as any[]) {
        stepCounts[s.sequence_id] = (stepCounts[s.sequence_id] || 0) + 1;
      }

      const stageMap = new Map(stagesData.map((s) => [s.id, s.stage_name]));
      const vertMap = new Map(verticalsData.map((v) => [v.id, v.name]));

      setSequences(
        seqData.map((s: any) => ({
          ...s,
          step_count: stepCounts[s.id] || 0,
          stage_name: stageMap.get(s.trigger_stage) || "Unknown",
          vertical_name: s.vertical_id ? vertMap.get(s.vertical_id) || "" : "All",
        }))
      );
    } else {
      setSequences([]);
    }
    setLoading(false);
  };

  const startCreate = () => {
    setEditId(null);
    setSeqName("");
    setTriggerStage("");
    setVerticalId("all");
    setSteps([{ step_order: 1, delay_days: 0, channel: "email", subject_template: "", body_template: "" }]);
    setEditing(true);
  };

  const startEdit = async (seq: NurtureSequence) => {
    setEditId(seq.id);
    setSeqName(seq.name);
    setTriggerStage(seq.trigger_stage);
    setVerticalId(seq.vertical_id || "all");

    const { data } = await supabase
      .from("nurture_steps" as any)
      .select("*")
      .eq("sequence_id", seq.id)
      .order("step_order");

    setSteps(
      ((data || []) as any[]).map((s: any) => ({
        id: s.id,
        step_order: s.step_order,
        delay_days: s.delay_days,
        channel: s.channel,
        subject_template: s.subject_template || "",
        body_template: s.body_template,
      }))
    );
    setEditing(true);
  };

  const addStep = () => {
    const lastDelay = steps.length > 0 ? steps[steps.length - 1].delay_days : 0;
    setSteps([
      ...steps,
      {
        step_order: steps.length + 1,
        delay_days: lastDelay + 3,
        channel: "email",
        subject_template: "",
        body_template: "",
      },
    ]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const updateStep = (idx: number, field: keyof NurtureStep, value: any) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const insertVariable = (idx: number, field: "subject_template" | "body_template", variable: string) => {
    const current = steps[idx][field];
    updateStep(idx, field, current + variable);
  };

  const handleSave = async () => {
    if (!seqName.trim() || !triggerStage) {
      toast.error("Name and trigger stage are required");
      return;
    }
    if (steps.length === 0) {
      toast.error("Add at least one step");
      return;
    }
    for (const s of steps) {
      if (!s.body_template.trim()) {
        toast.error(`Step ${s.step_order} needs a body template`);
        return;
      }
      if (s.channel === "email" && !s.subject_template.trim()) {
        toast.error(`Step ${s.step_order} needs a subject`);
        return;
      }
    }

    setSaving(true);
    const seqPayload: any = {
      name: seqName,
      trigger_stage: triggerStage,
      vertical_id: verticalId === "all" ? null : verticalId,
      is_active: true,
      created_by: user?.id,
    };

    let seqId = editId;
    if (editId) {
      await supabase.from("nurture_sequences" as any).update(seqPayload).eq("id", editId);
      // Delete old steps and re-insert
      await supabase.from("nurture_steps" as any).delete().eq("sequence_id", editId);
    } else {
      const { data, error } = await supabase
        .from("nurture_sequences" as any)
        .insert(seqPayload)
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to create sequence");
        setSaving(false);
        return;
      }
      seqId = (data as any).id;
    }

    // Insert steps
    const stepPayloads = steps.map((s) => ({
      sequence_id: seqId,
      step_order: s.step_order,
      delay_days: s.delay_days,
      channel: s.channel,
      subject_template: s.subject_template || null,
      body_template: s.body_template,
    }));

    await supabase.from("nurture_steps" as any).insert(stepPayloads);

    toast.success(editId ? "Sequence updated" : "Sequence created");
    setSaving(false);
    setEditing(false);
    loadData();
  };

  const toggleActive = async (seq: NurtureSequence) => {
    await supabase
      .from("nurture_sequences" as any)
      .update({ is_active: !seq.is_active } as any)
      .eq("id", seq.id);
    setSequences(sequences.map((s) => (s.id === seq.id ? { ...s, is_active: !s.is_active } : s)));
    toast.success(seq.is_active ? "Sequence deactivated" : "Sequence activated");
  };

  const deleteSequence = async (id: string) => {
    await supabase.from("nurture_sequences" as any).delete().eq("id", id);
    toast.success("Sequence deleted");
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  // Builder view
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-lg font-semibold">{editId ? "Edit Sequence" : "Create Sequence"}</h2>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Sequence Name</Label>
                <Input value={seqName} onChange={(e) => setSeqName(e.target.value)} placeholder="e.g. Post-Meeting Nurture" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Trigger Stage</Label>
                <Select value={triggerStage} onValueChange={setTriggerStage}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select stage..." /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.stage_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vertical (optional)</Label>
                <Select value={verticalId} onValueChange={setVerticalId}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Verticals</SelectItem>
                    {verticals.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Steps ({steps.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPreviewOpen(true); }}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Preview
              </Button>
              <Button size="sm" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
              </Button>
            </div>
          </div>

          {steps.map((step, idx) => {
            const ChannelIcon = CHANNEL_ICONS[step.channel];
            return (
              <Card key={idx}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-[10px] font-mono">Step {step.step_order}</Badge>
                      <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeStep(idx)} disabled={steps.length === 1}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Delay (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={step.delay_days}
                        onChange={(e) => updateStep(idx, "delay_days", parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Channel</Label>
                      <Select value={step.channel} onValueChange={(v: any) => updateStep(idx, "channel", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="linkedin_message">LinkedIn Message</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {step.channel === "email" && (
                    <div>
                      <Label className="text-xs">Subject</Label>
                      <Input
                        value={step.subject_template}
                        onChange={(e) => updateStep(idx, "subject_template", e.target.value)}
                        placeholder="Follow-up: {{company_name}}"
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={step.body_template}
                      onChange={(e) => updateStep(idx, "body_template", e.target.value)}
                      placeholder="Hi {{first_name}}, ..."
                      rows={4}
                      className="mt-1 text-sm"
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {VARIABLES.map((v) => (
                        <Button
                          key={v.key}
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => insertVariable(idx, step.channel === "email" ? "body_template" : "body_template", v.key)}
                        >
                          {v.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editId ? "Update Sequence" : "Create Sequence"}
          </Button>
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sequence Timeline Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {steps.map((step, idx) => {
                const ChannelIcon = CHANNEL_ICONS[step.channel];
                return (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <ChannelIcon className="h-4 w-4 text-primary" />
                      </div>
                      {idx < steps.length - 1 && <div className="w-px h-full bg-border min-h-[20px]" />}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="h-2.5 w-2.5 mr-1" />
                          Day {step.delay_days}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{step.channel.replace("_", " ")}</span>
                      </div>
                      {step.subject_template && (
                        <p className="text-xs font-medium">{step.subject_template}</p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2">{step.body_template}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Auto-send follow-up sequences when deals enter specific pipeline stages
        </p>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Sequence
        </Button>
      </div>

      {sequences.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No nurture sequences yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Create one to auto-send follow-ups when deals reach specific stages.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq) => (
            <Card key={seq.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{seq.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{seq.stage_name}</Badge>
                      <Badge variant="outline" className="text-[10px]">{seq.vertical_name}</Badge>
                      <Badge variant="outline" className="text-[10px]">{seq.step_count} steps</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(seq.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Switch checked={seq.is_active} onCheckedChange={() => toggleActive(seq)} />
                  <Button variant="ghost" size="sm" onClick={() => startEdit(seq)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSequence(seq.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
