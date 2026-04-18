import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, Sparkles, Send, ChevronDown, ChevronUp, Copy, RefreshCw,
  Loader2, Check, Linkedin, Mail, Pencil, X, Zap, TrendingUp, Cpu, DollarSign, Users
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { callAIProvider } from "@/lib/ai-provider";
import { getAIConfig } from "@/lib/settings-storage";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string | null;
  emailStatus: string;
  companyName: string;
  companyDomain: string;
  companyTier: string;
  aiEnrichment: any | null;
  relevanceScore: number | null;
  recommendedAction: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  isSaved: boolean;
}

interface VerticalInfo {
  name: string;
  description?: string;
  savings?: string;
  sellingPoints?: string[];
  usCostRange?: string;
  obCostRange?: string;
  techStack?: string[];
  buyerPersonas?: string[];
  jobTitlesToSearch?: string[];
}

/* ------------------------------------------------------------------ */
/* Job posting fuzzy matching                                          */
/* ------------------------------------------------------------------ */

function fuzzyMatchJobTitles(
  jobPostings: string[],
  verticalTitles: string[],
): string[] {
  if (!jobPostings?.length || !verticalTitles?.length) return [];
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const normalizedVertical = verticalTitles.map(normalize);
  return jobPostings.filter((posting) => {
    const np = normalize(posting);
    return normalizedVertical.some((vt) => {
      const vtWords = vt.split(/\s+/);
      const npWords = np.split(/\s+/);
      const vtInNp = vtWords.filter((w) => w.length > 2 && np.includes(w)).length;
      const npInVt = npWords.filter((w) => w.length > 2 && vt.includes(w)).length;
      return np.includes(vt) || vt.includes(np) || vtInNp >= Math.ceil(vtWords.length * 0.5) || npInVt >= Math.ceil(npWords.length * 0.5);
    });
  });
}

interface MessagesStepProps {
  verticalName: string;
  verticalId?: string;
  vertical: VerticalInfo;
  contacts: ContactItem[];
  onBack: () => void;
  onNext: (data: {
    contactMessages: Map<string, ContactMessages>;
    sequence: SequenceStep[];
    generateLinkedIn: boolean;
    generateLinkedInDM: boolean;
  }) => void;
}

export type { ContactMessages, EmailSequenceStep, ContactItem };

interface ContactMessages {
  emailSubject: string;
  emailBody: string;
  linkedInConnection: string;
  linkedInDM: string;
  instantlyVariables: Record<string, string>;
  signalsUsed?: string[];
}

interface EmailSequenceStep {
  stepNumber: number;
  dayDelay: number;
  label: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isAIPersonalized: boolean;
}

type SequenceStepType = "email" | "linkedin_connect" | "linkedin_dm";

interface SequenceStep {
  stepNumber: number;
  dayDelay: number;
  label: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isAIPersonalized: boolean;
  type: SequenceStepType;
}

/* ------------------------------------------------------------------ */
/* Signal keys                                                         */
/* ------------------------------------------------------------------ */

const SIGNAL_KEYS = [
  { key: "jobPostings", label: "Job postings", icon: Zap },
  { key: "hiringVelocity", label: "Hiring velocity", icon: TrendingUp },
  { key: "techStack", label: "Tech stack", icon: Cpu },
  { key: "fundingEvent", label: "Funding event", icon: DollarSign },
  { key: "headcountGrowth", label: "Headcount growth", icon: Users },
] as const;

type SignalKey = typeof SIGNAL_KEYS[number]["key"];

const PERSONALIZATION_DEPTHS = [
  { key: "light", label: "Light", desc: "Name + company only" },
  { key: "medium", label: "Medium", desc: "Role + active signals" },
  { key: "deep", label: "Deep", desc: "Pain narrative using all enrichment" },
] as const;

const TONES = [
  { key: "consultative", label: "Consultative" },
  { key: "direct", label: "Direct" },
  { key: "challenger", label: "Challenger" },
  { key: "educational", label: "Educational" },
] as const;

type DepthKey = typeof PERSONALIZATION_DEPTHS[number]["key"];
type ToneKey = typeof TONES[number]["key"];

/* ------------------------------------------------------------------ */
/* Default sequence with LinkedIn steps                                */
/* ------------------------------------------------------------------ */

const defaultSequence: SequenceStep[] = [
  {
    stepNumber: 1, dayDelay: 1, type: "email",
    label: "Opening — AI personalized",
    subjectTemplate: "", bodyTemplate: "", isAIPersonalized: true,
  },
  {
    stepNumber: 2, dayDelay: 2, type: "linkedin_connect",
    label: "LinkedIn connection request",
    subjectTemplate: "", bodyTemplate: "", isAIPersonalized: false,
  },
  {
    stepNumber: 3, dayDelay: 4, type: "email",
    label: "Cost math follow-up",
    subjectTemplate: "Re: {{email_subject}}",
    bodyTemplate: `Quick follow-up with the numbers, {{first_name}}.

US {{vertical_role}}: {{us_cost_range}} + benefits
Office Beacon: {{ob_cost_range}} fully loaded

That's {{savings}} savings — same quality, your timezone overlap, your tools.

Worth a 15-min call to explore?

{{sender_signature}}`,
    isAIPersonalized: false,
  },
  {
    stepNumber: 4, dayDelay: 7, type: "linkedin_dm",
    label: "LinkedIn follow-up DM",
    subjectTemplate: "", bodyTemplate: "", isAIPersonalized: false,
  },
  {
    stepNumber: 5, dayDelay: 8, type: "email",
    label: "Case study",
    subjectTemplate: "How one {{buyer_title}} cut {{vertical_name}} costs {{savings}}",
    bodyTemplate: `One more data point, {{first_name}} — a {{company_size}}-person company in {{industry}} couldn't keep up with {{vertical_challenge}}.

They brought on an Office Beacon team:
• {{case_study_result_1}}
• {{case_study_result_2}}
• {{case_study_result_3}}

Happy to share the full case study if it's relevant to {{company_name}}.

{{sender_signature}}`,
    isAIPersonalized: false,
  },
  {
    stepNumber: 6, dayDelay: 14, type: "email",
    label: "Breakup — low pressure close",
    subjectTemplate: "Last note from me, {{first_name}}",
    bodyTemplate: `Hey {{first_name}}, I don't want to be that person clogging your inbox.

If offshore {{vertical_name}} isn't on your radar right now, no worries at all. But if {{company_name}} ever needs to scale {{vertical_role}} without the US salary overhead, I'd love to put together a custom proposal.

Either way — wishing you and the team well.

{{sender_signature}}`,
    isAIPersonalized: false,
  },
];

/* ------------------------------------------------------------------ */
/* Template filler                                                     */
/* ------------------------------------------------------------------ */

function fillTemplate(template: string, contact: ContactItem, msgs: ContactMessages): string {
  const v = msgs.instantlyVariables;
  return template
    .replace(/\{\{first_name\}\}/g, contact.firstName || "")
    .replace(/\{\{last_name\}\}/g, contact.lastName || "")
    .replace(/\{\{company_name\}\}/g, contact.companyName || "")
    .replace(/\{\{title\}\}/g, contact.title || "")
    .replace(/\{\{email_subject\}\}/g, v.email_subject || "")
    .replace(/\{\{personalization\}\}/g, v.personalization || "")
    .replace(/\{\{growth\}\}/g, v.growth || "")
    .replace(/\{\{savings\}\}/g, v.savings || "")
    .replace(/\{\{vertical_role\}\}/g, v.vertical_role || "")
    .replace(/\{\{vertical_name\}\}/g, v.vertical_name || "")
    .replace(/\{\{us_cost_range\}\}/g, v.us_cost_range || "")
    .replace(/\{\{ob_cost_range\}\}/g, v.ob_cost_range || "")
    .replace(/\{\{company_size\}\}/g, v.company_size || "")
    .replace(/\{\{industry\}\}/g, v.industry || "")
    .replace(/\{\{vertical_challenge\}\}/g, v.vertical_challenge || "")
    .replace(/\{\{buyer_title\}\}/g, v.buyer_title || "")
    .replace(/\{\{case_study_result_1\}\}/g, v.case_study_result_1 || "")
    .replace(/\{\{case_study_result_2\}\}/g, v.case_study_result_2 || "")
    .replace(/\{\{case_study_result_3\}\}/g, v.case_study_result_3 || "")
    .replace(/\{\{sender_name\}\}/g, "{{sender_name}}")
    .replace(/\{\{sender_signature\}\}/g, "{{sender_signature}}");
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function MessagesStep({
  verticalName, verticalId, vertical, contacts, onBack, onNext,
}: MessagesStepProps) {

  const [sequence, setSequence] = useState<SequenceStep[]>(defaultSequence);
  const [activeSequenceStep, setActiveSequenceStep] = useState(0);
  const [showSequenceEditor, setShowSequenceEditor] = useState(false);
  const [generateLinkedIn, setGenerateLinkedIn] = useState(true);
  const [generateLinkedInDM, setGenerateLinkedInDM] = useState(true);

  // Context builder state
  const [activeSignals, setActiveSignals] = useState<Set<SignalKey>>(
    new Set(SIGNAL_KEYS.map(s => s.key))
  );
  const [depth, setDepth] = useState<DepthKey>("medium");
  const [tone, setTone] = useState<ToneKey>("consultative");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const [contactMessages, setContactMessages] = useState<Map<string, ContactMessages>>(new Map());
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ contactId: string; field: string } | null>(null);

  const emailContacts = useMemo(() => contacts.filter(c => c.email), [contacts]);
  const emailSteps = useMemo(() => sequence.filter(s => s.type === "email"), [sequence]);

  const toggleSignal = (key: SignalKey) => {
    setActiveSignals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Load previously generated messages from DB
  useEffect(() => {
    if (!verticalId) return;
    const ids = contacts.map(c => c.id).filter(Boolean);
    if (ids.length === 0) return;

    supabase
      .from("saved_contacts")
      .select("id, email_subject, email_body, linkedin_connection, linkedin_dm, instantly_variables, messages_generated")
      .in("id", ids)
      .eq("messages_generated", true)
      .then(({ data }) => {
        if (!data?.length) return;
        const map = new Map(contactMessages);
        data.forEach((row: any) => {
          if (row.email_subject || row.email_body) {
            map.set(row.id, {
              emailSubject: row.email_subject || "",
              emailBody: row.email_body || "",
              linkedInConnection: row.linkedin_connection || "",
              linkedInDM: row.linkedin_dm || "",
              instantlyVariables: row.instantly_variables || {},
              signalsUsed: row.instantly_variables?.signals_used || [],
            });
          }
        });
        setContactMessages(map);
      });
  }, [verticalId, contacts]);

  /* ---- Build signal context string ---- */

  const buildSignalContext = useCallback((enrichment: any, contact: ContactItem): { text: string; usedSignals: string[] } => {
    const used: string[] = [];
    const parts: string[] = [];

    if (activeSignals.has("jobPostings")) {
      const jobs = enrichment?.job_signals || enrichment?.relevantJobPostings;
      if (jobs) {
        parts.push(`Open job postings: ${Array.isArray(jobs) ? jobs.slice(0, 5).join(", ") : JSON.stringify(jobs)}`);
        used.push("Job postings");
      }
    }
    if (activeSignals.has("hiringVelocity")) {
      const hv = enrichment?.hiring_velocity || enrichment?.growth_12mo;
      if (hv) {
        parts.push(`Hiring velocity / 12mo growth: ${hv}%`);
        used.push("Hiring velocity");
      }
    }
    if (activeSignals.has("techStack")) {
      const ts = enrichment?.tech_stack || [];
      if (ts.length > 0) {
        parts.push(`Tech stack: ${ts.slice(0, 8).join(", ")}`);
        used.push("Tech stack");
      }
    }
    if (activeSignals.has("fundingEvent")) {
      const funding = enrichment?.funding || enrichment?.latest_funding;
      if (funding) {
        parts.push(`Funding: ${typeof funding === "string" ? funding : JSON.stringify(funding)}`);
        used.push("Funding event");
      }
    }
    if (activeSignals.has("headcountGrowth")) {
      const g = enrichment?.growth_12mo || enrichment?.headcount_growth;
      if (g) {
        parts.push(`Headcount growth: ${g}%`);
        used.push("Headcount growth");
      }
    }

    return { text: parts.length > 0 ? parts.join("\n") : "No signal data available.", usedSignals: used };
  }, [activeSignals]);

  /* ---- AI Generation ---- */

  const generateForContact = useCallback(async (
    contact: ContactItem,
    aiConfig: { provider: string; apiKey: string; model: string },
    companyJobPostingsCache: Map<string, string[]>,
  ): Promise<ContactMessages> => {
    const enrichment = contact.aiEnrichment || {};
    const aiRationale = enrichment.ai_rationale || enrichment.reasoning || "";

    // Signal context
    const { text: signalText, usedSignals } = buildSignalContext(enrichment, contact);

    // Job posting matching
    let companyJobPostings = companyJobPostingsCache.get(contact.companyDomain) || [];
    const matchingJobs = fuzzyMatchJobTitles(companyJobPostings, vertical.jobTitlesToSearch || []);

    const depthInstructions: Record<DepthKey, string> = {
      light: "Use LIGHT personalization: only reference the prospect's name and company name. Keep it brief and generic.",
      medium: "Use MEDIUM personalization: reference the prospect's role/title and any active buying signals. Show you've done basic research.",
      deep: "Use DEEP personalization: craft a pain narrative using ALL available enrichment data — weave in their growth challenges, hiring needs, tech stack gaps, and industry-specific pressures. Make it feel like a 1:1 conversation.",
    };

    const toneInstructions: Record<ToneKey, string> = {
      consultative: "TONE: Consultative — position yourself as a helpful advisor, ask thoughtful questions, lead with value.",
      direct: "TONE: Direct — get straight to the point, state the value proposition clearly, no fluff.",
      challenger: "TONE: Challenger — respectfully challenge their current approach, present a contrarian insight.",
      educational: "TONE: Educational — lead with a relevant insight or statistic, teach them something new.",
    };

    const systemPrompt = `You are writing a cold outbound email on behalf of Office Beacon, a remote staffing company.

OFFICE BEACON INFO:
- Service: Dedicated remote teams for ${vertical.name}
- Savings: ${vertical.savings || "40-60%"} compared to US hiring
- US cost: ${vertical.usCostRange || "N/A"}
- Office Beacon cost: ${vertical.obCostRange || "N/A"}
- Selling points:
${(vertical.sellingPoints || []).map(p => `  • ${p}`).join("\n")}

${depthInstructions[depth]}
${toneInstructions[tone]}

Company context (AI rationale): ${aiRationale || "N/A"}

Active buying signals:
${signalText}

${matchingJobs.length > 0 ? `MATCHING OPEN JOBS: ${matchingJobs.join(", ")}. Use these as the PRIMARY hook.` : ""}

RULES:
- Conversational, not corporate. Write like a smart human.
- First line must reference the company specifically.
- Keep emails SHORT: 4-6 sentences max.
- Subject lines: lowercase, casual, specific to the company.
- No buzzwords: no "leverage", "synergy", "revolutionary".
- Soft CTA: "worth a quick chat?" not "book a demo now".
- LinkedIn connection requests MUST be under 300 characters.

Respond ONLY with valid JSON:
{
  "email_subject": "...",
  "email_body": "...(include {{sender_name}} sign-off)",
  "linkedin_connection": "...(under 300 chars)",
  "linkedin_dm": "...(2-3 sentences follow-up DM)",
  "personalization": "the opening personalization line",
  "vertical_challenge": "one phrase about their challenge",
  "case_study_result_1": "realistic result bullet",
  "case_study_result_2": "second result",
  "case_study_result_3": "third result",
  "signals_used": ${JSON.stringify(usedSignals)}
}`;

    const userMessage = `Generate personalized outreach:

Prospect: ${contact.firstName} ${contact.lastName}, ${contact.title} at ${contact.companyName}.
Email: ${contact.email}
Domain: ${contact.companyDomain}
Industry: ${enrichment.industry || "Unknown"}
Tier: ${contact.companyTier || "Unknown"}
Score: ${contact.relevanceScore || "N/A"}
Vertical: ${vertical.name}
Personalization depth: ${depth}
Tone: ${tone}`;

    const response = await callAIProvider(
      { provider: aiConfig.provider as any, apiKey: aiConfig.apiKey, model: aiConfig.model },
      systemPrompt,
      [{ role: "user", content: userMessage }],
    );

    const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

    return {
      emailSubject: parsed.email_subject || "",
      emailBody: parsed.email_body || "",
      linkedInConnection: parsed.linkedin_connection || "",
      linkedInDM: parsed.linkedin_dm || "",
      signalsUsed: parsed.signals_used || usedSignals,
      instantlyVariables: {
        personalization: parsed.personalization || "",
        email_subject: parsed.email_subject || "",
        growth: enrichment.growth_12mo ? `${enrichment.growth_12mo}%` : "",
        savings: vertical.savings || "",
        vertical_role: vertical.name || "",
        us_cost_range: vertical.usCostRange || "",
        ob_cost_range: vertical.obCostRange || "",
        company_size: enrichment.employees?.toString() || "",
        industry: enrichment.industry || "",
        vertical_name: vertical.name || "",
        vertical_challenge: parsed.vertical_challenge || "",
        buyer_title: contact.title || "",
        case_study_result_1: parsed.case_study_result_1 || "",
        case_study_result_2: parsed.case_study_result_2 || "",
        case_study_result_3: parsed.case_study_result_3 || "",
        matching_open_jobs: matchingJobs.join(", "),
        signals_used: usedSignals.join(", "),
      },
    };
  }, [vertical, depth, tone, buildSignalContext]);

  const handleGenerateAll = useCallback(async () => {
    const aiConfig = getAIConfig();
    if (!aiConfig.apiKey) { toast.error("Add your AI API key in Settings"); return; }
    if (emailContacts.length === 0) { toast.error("No contacts with email"); return; }

    setIsGenerating(true);
    setGenerationProgress({ done: 0, total: emailContacts.length });
    const map = new Map(contactMessages);
    const BATCH = 3;

    // Pre-fetch job postings
    const companyIds = [...new Set(emailContacts.map(c => (c as any).companyId).filter(Boolean))];
    const jobPostingsCache = new Map<string, string[]>();

    if (companyIds.length > 0) {
      const { data: companyRows } = await supabase
        .from("saved_companies")
        .select("domain, raw_data")
        .in("id", companyIds);
      if (companyRows) {
        for (const row of companyRows) {
          if (row.domain && row.raw_data) {
            const raw = row.raw_data as any;
            const postings: string[] = [];
            const jobData = raw.relevantJobPostings || raw.job_postings || [];
            if (Array.isArray(jobData)) {
              for (const jp of jobData) {
                if (typeof jp === "string") postings.push(jp);
                else if (jp?.title) postings.push(jp.title);
              }
            }
            if (postings.length > 0) jobPostingsCache.set(row.domain, postings);
          }
        }
      }
    }

    for (const contact of emailContacts) {
      const domain = contact.companyDomain;
      if (domain && !jobPostingsCache.has(domain) && contact.aiEnrichment?.relevantJobPostings?.length) {
        jobPostingsCache.set(domain, contact.aiEnrichment.relevantJobPostings);
      }
    }

    for (let i = 0; i < emailContacts.length; i += BATCH) {
      const batch = emailContacts.slice(i, i + BATCH);
      await Promise.all(batch.map(async (c) => {
        try {
          const msgs = await generateForContact(c, aiConfig, jobPostingsCache);
          map.set(c.id, msgs);
          setContactMessages(new Map(map));
        } catch (e: any) { console.error(`Gen failed for ${c.firstName}:`, e); }
      }));
      setGenerationProgress({ done: Math.min(i + BATCH, emailContacts.length), total: emailContacts.length });
      if (i + BATCH < emailContacts.length) await new Promise(r => setTimeout(r, 1500));
    }

    setIsGenerating(false);
    toast.success(`Generated messages for ${map.size} contacts`);
  }, [emailContacts, contactMessages, generateForContact]);

  const handleRegenerateOne = useCallback(async (contactId: string) => {
    const aiConfig = getAIConfig();
    if (!aiConfig.apiKey) { toast.error("Add your AI API key in Settings"); return; }
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    const jobPostingsCache = new Map<string, string[]>();
    const companyId = (contact as any).companyId;
    if (companyId) {
      const { data } = await supabase.from("saved_companies").select("domain, raw_data").eq("id", companyId).single();
      if (data?.domain && data.raw_data) {
        const raw = data.raw_data as any;
        const postings: string[] = [];
        const jobData = raw.relevantJobPostings || raw.job_postings || [];
        if (Array.isArray(jobData)) {
          for (const jp of jobData) {
            if (typeof jp === "string") postings.push(jp);
            else if (jp?.title) postings.push(jp.title);
          }
        }
        if (postings.length > 0) jobPostingsCache.set(data.domain, postings);
      }
    }
    if (contact.companyDomain && !jobPostingsCache.has(contact.companyDomain) && contact.aiEnrichment?.relevantJobPostings?.length) {
      jobPostingsCache.set(contact.companyDomain, contact.aiEnrichment.relevantJobPostings);
    }

    try {
      const msgs = await generateForContact(contact, aiConfig, jobPostingsCache);
      setContactMessages(prev => { const m = new Map(prev); m.set(contactId, msgs); return m; });
      toast.success("Regenerated messages");
    } catch (e: any) { toast.error(`Failed: ${e.message}`); }
  }, [contacts, generateForContact]);

  const handleRegenerateWithoutSignal = useCallback(async (contactId: string, signalToRemove: string) => {
    // Temporarily remove this signal, regenerate, then restore
    const signalKey = SIGNAL_KEYS.find(s => s.label === signalToRemove)?.key;
    if (signalKey && activeSignals.has(signalKey)) {
      setActiveSignals(prev => { const next = new Set(prev); next.delete(signalKey); return next; });
    }
    // Small delay to let state update then regenerate
    setTimeout(() => handleRegenerateOne(contactId), 100);
  }, [activeSignals, handleRegenerateOne]);

  /* ---- Save to DB ---- */

  useEffect(() => {
    if (isGenerating || contactMessages.size === 0) return;
    const save = async () => {
      for (const [cid, msgs] of contactMessages.entries()) {
        await supabase.from("saved_contacts").update({
          email_subject: msgs.emailSubject,
          email_body: msgs.emailBody,
          linkedin_connection: msgs.linkedInConnection,
          linkedin_dm: msgs.linkedInDM,
          messages_generated: true,
          instantly_variables: msgs.instantlyVariables,
          updated_at: new Date().toISOString(),
        }).eq("id", cid);
      }
    };
    save();
  }, [isGenerating, contactMessages]);

  /* ---- Inline edit helpers ---- */

  const updateMessage = (contactId: string, field: keyof ContactMessages, value: string) => {
    setContactMessages(prev => {
      const m = new Map(prev);
      const existing = m.get(contactId);
      if (existing) m.set(contactId, { ...existing, [field]: value });
      return m;
    });
  };

  const updateSequenceStep = (idx: number, field: keyof SequenceStep, value: string) => {
    setSequence(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  /* ---- Render ---- */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Messages — {verticalName}
        </h2>
        <p className="text-sm text-muted-foreground">
          AI-generated personalized outreach for {emailContacts.length} contacts with email
        </p>
      </div>

      {/* ============ Context Builder Panel ============ */}
      <Card className="border-primary/20">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Context Builder
          </h3>

          {/* Signal toggle chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Include signals in prompt:</p>
            <div className="flex flex-wrap gap-2">
              {SIGNAL_KEYS.map(({ key, label, icon: Icon }) => {
                const isActive = activeSignals.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleSignal(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    {isActive && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personalization depth */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Personalization depth:</p>
            <div className="flex gap-2">
              {PERSONALIZATION_DEPTHS.map(d => (
                <button
                  key={d.key}
                  onClick={() => setDepth(d.key)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-left transition-colors ${
                    depth === d.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="text-xs font-medium">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tone selector */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tone:</p>
            <div className="flex gap-2">
              {TONES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTone(t.key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    tone === t.key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ Sequence Configuration ============ */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sequence — {sequence.length} steps</h3>
            <button
              onClick={() => setShowSequenceEditor(!showSequenceEditor)}
              className="text-xs text-primary hover:underline"
            >
              {showSequenceEditor ? "Hide editor" : "Edit sequence templates"}
            </button>
          </div>

          {/* Step pills with type icons */}
          <div className="flex items-center gap-1 flex-wrap">
            {sequence.map((step, i) => (
              <div key={step.stepNumber} className="flex items-center">
                <button
                  onClick={() => setActiveSequenceStep(i)}
                  className={`p-2.5 rounded-lg border text-left transition-colors min-w-[100px] ${
                    activeSequenceStep === i
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {step.type === "email" ? (
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Linkedin className="h-3 w-3 text-blue-500" />
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">Day {step.dayDelay}</span>
                    </div>
                  </div>
                  <p className="text-[10px] mt-1 truncate">{step.label}</p>
                </button>
                {i < sequence.length - 1 && (
                  <span className="text-muted-foreground text-xs px-0.5 flex-shrink-0">→</span>
                )}
              </div>
            ))}
          </div>

          {/* Sequence editor */}
          {showSequenceEditor && sequence[activeSequenceStep]?.type === "email" && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Step {activeSequenceStep + 1} — Subject
                </label>
                <input
                  value={sequence[activeSequenceStep].subjectTemplate}
                  onChange={(e) => updateSequenceStep(activeSequenceStep, "subjectTemplate", e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-background"
                  placeholder={sequence[activeSequenceStep].isAIPersonalized ? "AI generates unique subject per contact" : "Subject template..."}
                  disabled={sequence[activeSequenceStep].isAIPersonalized}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Step {activeSequenceStep + 1} — Body
                </label>
                <textarea
                  value={sequence[activeSequenceStep].bodyTemplate}
                  onChange={(e) => updateSequenceStep(activeSequenceStep, "bodyTemplate", e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm font-mono min-h-[150px] bg-background"
                  placeholder={sequence[activeSequenceStep].isAIPersonalized ? "AI generates unique body per contact" : "Body template..."}
                  disabled={sequence[activeSequenceStep].isAIPersonalized}
                />
              </div>
            </div>
          )}

          {showSequenceEditor && sequence[activeSequenceStep]?.type !== "email" && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
              <div className="flex items-center gap-2 mb-2">
                <Linkedin className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium">
                  {sequence[activeSequenceStep].type === "linkedin_connect" ? "LinkedIn Connection Request" : "LinkedIn Follow-up DM"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {sequence[activeSequenceStep].type === "linkedin_connect"
                  ? "AI-generated connection request (under 300 chars). Only sent to contacts with a LinkedIn URL."
                  : "AI-generated follow-up DM. Only sent to contacts with a LinkedIn URL."}
              </p>
            </div>
          )}

          {/* LinkedIn toggles */}
          <div className="pt-3 border-t border-border flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={generateLinkedIn} onCheckedChange={(v) => setGenerateLinkedIn(!!v)} />
              LinkedIn connection request
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={generateLinkedInDM} onCheckedChange={(v) => setGenerateLinkedInDM(!!v)} />
              LinkedIn follow-up DM
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Generate buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerateAll}
          disabled={isGenerating || emailContacts.length === 0}
          className="gap-2"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? "Generating..." : `Generate All Messages (${emailContacts.length})`}
        </Button>
        {contactMessages.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {contactMessages.size} / {emailContacts.length} generated
          </span>
        )}
      </div>

      {/* Progress bar */}
      {isGenerating && (
        <div className="p-4 border border-border rounded-xl bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Generating personalized messages...</span>
            <span className="text-sm text-muted-foreground font-mono">
              {generationProgress.done} / {generationProgress.total}
            </span>
          </div>
          <Progress value={(generationProgress.done / Math.max(generationProgress.total, 1)) * 100} />
        </div>
      )}

      {/* Contact message cards */}
      <div className="space-y-3">
        {emailContacts.map(contact => {
          const msgs = contactMessages.get(contact.id);
          const isExpanded = expandedContact === contact.id;
          const hasLinkedIn = !!contact.linkedinUrl;

          return (
            <div key={contact.id} className="border border-border rounded-xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {contact.photoUrl ? (
                    <img src={contact.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    (contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{contact.firstName} {contact.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.title} · {contact.companyName} · {contact.email}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {msgs ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Check className="h-3 w-3 mr-1" /> Generated
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                  {hasLinkedIn && <Linkedin className="h-3.5 w-3.5 text-blue-500" />}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {/* Expanded messages */}
              {isExpanded && msgs && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

                  {/* Signal chips used */}
                  {msgs.signalsUsed && msgs.signalsUsed.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Signals used:</p>
                      <div className="flex flex-wrap gap-1">
                        {msgs.signalsUsed.map((signal: string) => (
                          <button
                            key={signal}
                            onClick={() => handleRegenerateWithoutSignal(contact.id, signal)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                            title={`Click to remove "${signal}" and regenerate`}
                          >
                            {signal}
                            <X className="h-2.5 w-2.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Company AI rationale tooltip */}
                  {(contact.aiEnrichment?.ai_rationale || contact.aiEnrichment?.reasoning) && (
                    <div className="p-3 bg-muted/20 rounded-lg border border-border">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Company intelligence:</p>
                      <p className="text-xs text-muted-foreground">
                        {contact.aiEnrichment?.ai_rationale || contact.aiEnrichment?.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Day 1 Email */}
                  <MessageBlock
                    label="Day 1"
                    sublabel="Email — AI personalized"
                    labelColor="bg-primary/10 text-primary"
                    icon={<Mail className="h-3 w-3" />}
                    isEditing={editingMessage?.contactId === contact.id && editingMessage?.field === "email"}
                    onEdit={() => setEditingMessage({ contactId: contact.id, field: "email" })}
                    onDoneEdit={() => setEditingMessage(null)}
                    onRegenerate={() => handleRegenerateOne(contact.id)}
                    onCopy={() => copyToClipboard(`Subject: ${msgs.emailSubject}\n\n${msgs.emailBody}`)}
                  >
                    {editingMessage?.contactId === contact.id && editingMessage?.field === "email" ? (
                      <div className="space-y-2">
                        <input
                          value={msgs.emailSubject}
                          onChange={(e) => updateMessage(contact.id, "emailSubject", e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                          placeholder="Subject line"
                        />
                        <textarea
                          value={msgs.emailBody}
                          onChange={(e) => updateMessage(contact.id, "emailBody", e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[180px] bg-background"
                        />
                      </div>
                    ) : (
                      <div className="bg-muted/20 rounded-lg p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                        <p className="text-sm font-medium mb-3">{msgs.emailSubject}</p>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Body:</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msgs.emailBody}</p>
                      </div>
                    )}
                  </MessageBlock>

                  {/* Day 2 LinkedIn Connection — only for contacts with LinkedIn */}
                  {hasLinkedIn && generateLinkedIn && (
                    <MessageBlock
                      label="Day 2"
                      sublabel="LinkedIn connection request"
                      labelColor="bg-blue-50 text-blue-700"
                      icon={<Linkedin className="h-3 w-3" />}
                      onCopy={() => copyToClipboard(msgs.linkedInConnection)}
                      isEditing={editingMessage?.contactId === contact.id && editingMessage?.field === "linkedin"}
                      onEdit={() => setEditingMessage({ contactId: contact.id, field: "linkedin" })}
                      onDoneEdit={() => setEditingMessage(null)}
                    >
                      {editingMessage?.contactId === contact.id && editingMessage?.field === "linkedin" ? (
                        <textarea
                          value={msgs.linkedInConnection}
                          onChange={(e) => updateMessage(contact.id, "linkedInConnection", e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[80px] bg-background"
                          maxLength={300}
                        />
                      ) : (
                        <div className="bg-blue-50/30 rounded-lg p-4 border border-blue-100">
                          <p className="text-sm">{msgs.linkedInConnection}</p>
                          <p className="text-xs text-muted-foreground mt-2">{msgs.linkedInConnection.length}/300 characters</p>
                        </div>
                      )}
                    </MessageBlock>
                  )}

                  {/* Email Steps 2+ (template-based) */}
                  {emailSteps.slice(1).map(step => (
                    <MessageBlock
                      key={step.stepNumber}
                      label={`Day ${step.dayDelay}`}
                      sublabel={`Email — ${step.label}`}
                      labelColor="bg-muted text-muted-foreground"
                      icon={<Mail className="h-3 w-3" />}
                      onCopy={() => copyToClipboard(fillTemplate(step.bodyTemplate, contact, msgs))}
                    >
                      <div className="bg-muted/10 rounded-lg p-4 border border-dashed border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                        <p className="text-sm mb-2">{fillTemplate(step.subjectTemplate, contact, msgs)}</p>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {fillTemplate(step.bodyTemplate, contact, msgs)}
                        </p>
                      </div>
                    </MessageBlock>
                  ))}

                  {/* Day 7 LinkedIn DM — only for contacts with LinkedIn */}
                  {hasLinkedIn && generateLinkedInDM && (
                    <MessageBlock
                      label="Day 7"
                      sublabel="LinkedIn follow-up DM"
                      labelColor="bg-blue-50 text-blue-700"
                      icon={<Linkedin className="h-3 w-3" />}
                      onCopy={() => copyToClipboard(msgs.linkedInDM)}
                      isEditing={editingMessage?.contactId === contact.id && editingMessage?.field === "linkedindm"}
                      onEdit={() => setEditingMessage({ contactId: contact.id, field: "linkedindm" })}
                      onDoneEdit={() => setEditingMessage(null)}
                    >
                      {editingMessage?.contactId === contact.id && editingMessage?.field === "linkedindm" ? (
                        <textarea
                          value={msgs.linkedInDM}
                          onChange={(e) => updateMessage(contact.id, "linkedInDM", e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[80px] bg-background"
                        />
                      ) : (
                        <div className="bg-blue-50/30 rounded-lg p-4 border border-blue-100">
                          <p className="text-sm">{msgs.linkedInDM}</p>
                        </div>
                      )}
                    </MessageBlock>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 bg-background border-t border-border py-3 px-4 -mx-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground space-x-2">
          <span>{contactMessages.size} messages generated</span>
          <span>·</span>
          <span>{emailContacts.length} email sequences</span>
          {generateLinkedIn && (
            <>
              <span>·</span>
              <span>{contactMessages.size} LinkedIn messages</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack} className="gap-2 h-9">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={() => onNext({
              contactMessages,
              sequence,
              generateLinkedIn,
              generateLinkedInDM,
            })}
            disabled={contactMessages.size === 0}
            className="gap-2 h-9"
          >
            <Send className="h-4 w-4" /> Launch Campaign →
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MessageBlock sub-component                                          */
/* ------------------------------------------------------------------ */

function MessageBlock({
  label, sublabel, labelColor, icon, children,
  onEdit, onDoneEdit, onRegenerate, onCopy, isEditing,
}: {
  label: string;
  sublabel: string;
  labelColor: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onEdit?: () => void;
  onDoneEdit?: () => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  isEditing?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          <span className={`px-1.5 py-0.5 rounded font-mono ${labelColor}`}>{label}</span>
          {sublabel}
        </span>
        <div className="flex gap-2">
          {isEditing ? (
            <button onClick={onDoneEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Check className="h-3 w-3" /> Done
            </button>
          ) : (
            <>
              {onEdit && (
                <button onClick={onEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
              {onRegenerate && (
                <button onClick={onRegenerate} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </button>
              )}
            </>
          )}
          {onCopy && (
            <button onClick={onCopy} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Copy className="h-3 w-3" /> Copy
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
