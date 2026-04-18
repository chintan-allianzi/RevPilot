import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Plus, Trash2, Loader2, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VerticalConfig } from "@/lib/icp-config";
import { COMPANY_SIZE_OPTIONS, REVENUE_OPTIONS } from "@/lib/company-types";
import { useAISettings } from "@/contexts/AISettingsContext";
import { callAIProvider } from "@/lib/ai-provider";
import { cn } from "@/lib/utils";

const SYSTEM_PROMPT = `You are an ICP (Ideal Customer Profile) configuration assistant for Office Beacon, a US-based remote staffing company that provides dedicated offshore teams from India at 50-75% cost savings compared to US hiring.

Your job is to help define a new outbound sales vertical. When the user tells you what type of team they want to target, you should:

1. Research and provide accurate US market salary ranges for those roles
2. Calculate realistic Office Beacon offshore pricing (typically 50-75% less than US)
3. Identify the specific job titles companies post when hiring for these roles (these are what we search in Apollo.io to find companies with demand)
4. Identify the buyer personas — the decision makers we'd sell to (VP, Director, C-level titles)
5. List the relevant tech stack / tools these teams commonly use
6. Write 2-3 compelling selling points specific to this vertical

IMPORTANT GUIDELINES FOR SALARY DATA:
- Use realistic 2024-2025 US salary ranges including benefits overhead (add ~30% to base salary)
- Office Beacon pricing should be realistic: typically $12K-$60K per person per year depending on role seniority
- Junior/entry roles: OB cost $12K-$20K/year
- Mid-level roles: OB cost $20K-$35K/year
- Senior roles: OB cost $35K-$55K/year
- Highly specialized roles: OB cost $45K-$65K/year
- Savings percentage should be calculated from the actual numbers

CONVERSATION FLOW:
- Start by confirming what vertical they want and ask 1-2 clarifying questions (e.g., "Are you thinking entry-level bookkeepers or senior accountants/CPAs?" or "Should I include both L1 and L2 support roles?")
- After getting enough context (usually 1-2 exchanges), generate the COMPLETE configuration
- Output the config as a JSON block wrapped in triple backticks with the json tag

JSON FORMAT — always use exactly this structure:
\`\`\`json
{
  "name": "Vertical Name",
  "description": "One-line description of what OB provides",
  "savings": "XX-XX%",
  "jobTitlesToSearch": ["job title 1", "job title 2", "job title 3"],
  "buyerPersonas": ["VP Title", "Director Title", "C-Level Title"],
  "usCostRange": "$XXK-$XXXK",
  "obCostRange": "$XXK-$XXK",
  "techStack": ["Tool 1", "Tool 2", "Tool 3"],
  "sellingPoints": [
    "Selling point 1",
    "Selling point 2",
    "Selling point 3"
  ]
}
\`\`\`

After providing the JSON, say: "Here's your vertical config! The preview on the right has been updated. Feel free to ask me to adjust anything — salaries, job titles, personas, or I can add more detail."

If the user asks to modify something, output the COMPLETE updated JSON again (not just the changed field).

Be conversational, knowledgeable, and specific. Use real market data. Don't be generic.`;

const WELCOME_MESSAGE = `👋 Hi! I'll help you build a new vertical for Office Beacon outbound.

Just tell me the type of team or role you want to target — for example:
• "Accounting & Bookkeeping"
• "Data Engineering"
• "Customer Support"
• "DevOps / SRE"

I'll research typical US salaries, suggest Office Beacon pricing, identify the right job titles to search for, and build your full ICP config.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface VerticalDraft {
  name: string;
  description: string;
  savings: string;
  jobTitlesToSearch: string[];
  buyerPersonas: string[];
  usCostRange: string;
  obCostRange: string;
  techStack: string[];
  sellingPoints: string[];
  defaultMinEmployees: string;
  defaultMaxEmployees: string;
  defaultMinRevenue: string;
  defaultMaxRevenue: string;
  defaultLocations: string[];
}

function parseJsonFromMessage(content: string): Partial<VerticalDraft> | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1]);
    return {
      name: raw.name || "",
      description: raw.description || "",
      savings: raw.savings || "",
      jobTitlesToSearch: raw.jobTitlesToSearch || raw.job_titles_to_search || [],
      buyerPersonas: raw.buyerPersonas || raw.buyer_personas || [],
      usCostRange: raw.usCostRange || raw.us_cost_range || "",
      obCostRange: raw.obCostRange || raw.ob_cost_range || "",
      techStack: raw.techStack || raw.tech_stack || [],
      sellingPoints: raw.sellingPoints || raw.selling_points || [],
      defaultMinEmployees: raw.defaultMinEmployees || raw.default_min_employees || "51",
      defaultMaxEmployees: raw.defaultMaxEmployees || raw.default_max_employees || "5001",
      defaultMinRevenue: raw.defaultMinRevenue || raw.default_min_revenue || "10000000",
      defaultMaxRevenue: raw.defaultMaxRevenue || raw.default_max_revenue || "1000000000",
      defaultLocations: raw.defaultLocations || raw.default_locations || ["United States"],
    };
  } catch {
    return null;
  }
}

function emptyDraft(): VerticalDraft {
  return { name: "", description: "", savings: "", jobTitlesToSearch: [], buyerPersonas: [], usCostRange: "", obCostRange: "", techStack: [], sellingPoints: [], defaultMinEmployees: "51", defaultMaxEmployees: "5001", defaultMinRevenue: "10000000", defaultMaxRevenue: "1000000000", defaultLocations: ["United States"] };
}

function verticalToDraft(v: VerticalConfig): VerticalDraft {
  return {
    name: v.name,
    description: v.description,
    savings: v.savings,
    jobTitlesToSearch: [...v.jobTitlesToSearch],
    buyerPersonas: [...v.buyerPersonas],
    usCostRange: v.usCostRange,
    obCostRange: v.obCostRange,
    techStack: [...v.techStack],
    sellingPoints: [...v.sellingPoints],
    defaultMinEmployees: v.defaultMinEmployees || "51",
    defaultMaxEmployees: v.defaultMaxEmployees || "5001",
    defaultMinRevenue: v.defaultMinRevenue || "10000000",
    defaultMaxRevenue: v.defaultMaxRevenue || "1000000000",
    defaultLocations: [...(v.defaultLocations || ["United States"])],
  };
}

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagEditor({ tags, onChange, placeholder }: TagEditorProps) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
      setInput("");
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder={placeholder}
          className="text-xs h-7"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={addTag}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface VerticalBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (draft: VerticalDraft, existingId?: string) => void;
  editingVertical?: VerticalConfig | null;
}

export default function VerticalBuilder({ open, onClose, onSave, editingVertical }: VerticalBuilderProps) {
  const { aiProvider, getActiveKey, getActiveModel } = useAISettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<VerticalDraft>(() =>
    editingVertical ? verticalToDraft(editingVertical) : emptyDraft()
  );
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
      setLoading(false);
      setDraft(editingVertical ? verticalToDraft(editingVertical) : emptyDraft());
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, editingVertical]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const apiKey = getActiveKey();
    if (!apiKey) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const assistantContent = await callAIProvider(
        { provider: aiProvider, apiKey, model: getActiveModel() },
        SYSTEM_PROMPT,
        newMessages
      );

      const assistantMsg: ChatMessage = { role: "assistant", content: assistantContent };
      setMessages((prev) => [...prev, assistantMsg]);

      const parsed = parseJsonFromMessage(assistantContent);
      if (parsed) {
        setDraft((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Something went wrong. Please check your API key in Settings and try again." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, aiProvider, getActiveKey, getActiveModel]);

  const handleSave = () => {
    if (!draft.name.trim()) return;
    onSave(draft, editingVertical?.id);
    onClose();
  };

  if (!open) return null;

  const apiKey = getActiveKey();
  const isEditing = !!editingVertical;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-[900px] bg-background border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">
              {isEditing ? `Edit Vertical — ${editingVertical.name}` : "Create Custom Vertical"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEditing && editingVertical.isDefault
                ? "Default vertical — can be customized but not deleted"
                : "Use AI to define your ICP configuration"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Chat */}
          <div className="w-[55%] flex flex-col border-r border-border">
            {!apiKey ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap bg-muted text-foreground">
                      {WELCOME_MESSAGE}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-amber-800">AI provider not configured</p>
                    <p className="text-xs text-amber-700">Connect your AI provider in Settings to enable this feature.</p>
                    <Button variant="outline" size="sm" className="text-xs" asChild>
                      <a href="/settings">Go to Settings →</a>
                    </Button>
                  </div>
                </div>
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Describe the vertical you want to create…"
                      className="text-sm"
                      disabled
                    />
                    <Button size="icon" disabled>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Always show welcome message first */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap bg-muted text-foreground">
                      {isEditing
                        ? `I have the current configuration for **${editingVertical?.name}** loaded in the preview. Ask me to suggest changes — for example:\n• "Add more junior-level job titles"\n• "What's the typical US salary for senior roles?"\n• "Update the tech stack for cloud-native tools"`
                        : WELCOME_MESSAGE}
                    </div>
                  </div>
                  {messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                          m.role === "user"
                            ? "bg-primary/10 text-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {m.content.replace(/```json[\s\S]*?```/g, "[Configuration generated — see preview →]")}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      placeholder="Describe the vertical you want to create…"
                      className="text-sm"
                      disabled={loading}
                    />
                    <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Live Preview */}
          <div className="w-[45%] overflow-y-auto p-5 space-y-5">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Vertical Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                className="text-lg font-semibold mt-1 h-10"
                placeholder="e.g. Data Engineering"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  className="text-sm mt-1"
                  placeholder="One-line description"
                />
              </div>
              <div className="w-24">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Savings</Label>
                <Input
                  value={draft.savings}
                  onChange={(e) => setDraft((p) => ({ ...p, savings: e.target.value }))}
                  className="text-sm mt-1"
                  placeholder="60-70%"
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Job Titles to Search</Label>
              <TagEditor
                tags={draft.jobTitlesToSearch}
                onChange={(t) => setDraft((p) => ({ ...p, jobTitlesToSearch: t }))}
                placeholder="Add job title"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Buyer Personas</Label>
              <TagEditor
                tags={draft.buyerPersonas}
                onChange={(t) => setDraft((p) => ({ ...p, buyerPersonas: t }))}
                placeholder="Add buyer persona"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">US Cost Range</Label>
                <Input
                  value={draft.usCostRange}
                  onChange={(e) => setDraft((p) => ({ ...p, usCostRange: e.target.value }))}
                  className="text-sm mt-1"
                  placeholder="$130K-$180K"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">OB Cost Range</Label>
                <Input
                  value={draft.obCostRange}
                  onChange={(e) => setDraft((p) => ({ ...p, obCostRange: e.target.value }))}
                  className="text-sm mt-1"
                  placeholder="$35K-$55K"
                />
              </div>
            </div>

            {/* Default Search Filters */}
            <div className="border-t border-border pt-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Default Search Filters</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Employees</Label>
                  <Select value={draft.defaultMinEmployees} onValueChange={(v) => setDraft((p) => ({ ...p, defaultMinEmployees: v }))}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Employees</Label>
                  <Select value={draft.defaultMaxEmployees} onValueChange={(v) => setDraft((p) => ({ ...p, defaultMaxEmployees: v }))}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Revenue</Label>
                  <Select value={draft.defaultMinRevenue} onValueChange={(v) => setDraft((p) => ({ ...p, defaultMinRevenue: v }))}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Revenue</Label>
                  <Select value={draft.defaultMaxRevenue} onValueChange={(v) => setDraft((p) => ({ ...p, defaultMaxRevenue: v }))}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVENUE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Default Locations</Label>
                <TagEditor
                  tags={draft.defaultLocations}
                  onChange={(t) => setDraft((p) => ({ ...p, defaultLocations: t }))}
                  placeholder="Add location"
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Tech Stack</Label>
              <TagEditor
                tags={draft.techStack}
                onChange={(t) => setDraft((p) => ({ ...p, techStack: t }))}
                placeholder="Add tool or platform"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Selling Points</Label>
              {draft.sellingPoints.map((sp, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1.5">
                  <span className="text-muted-foreground text-xs mt-1.5">•</span>
                  <Input
                    value={sp}
                    onChange={(e) => {
                      const updated = [...draft.sellingPoints];
                      updated[i] = e.target.value;
                      setDraft((p) => ({ ...p, sellingPoints: updated }));
                    }}
                    className="text-xs h-7 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDraft((p) => ({ ...p, sellingPoints: p.sellingPoints.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setDraft((p) => ({ ...p, sellingPoints: [...p.sellingPoints, ""] }))}
              >
                <Plus className="h-3 w-3 mr-1" /> Add selling point
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <Button onClick={handleSave} disabled={!draft.name.trim()}>
            {isEditing ? "Save Changes" : "Save Vertical"}
          </Button>
        </div>
      </div>
    </div>
  );
}
