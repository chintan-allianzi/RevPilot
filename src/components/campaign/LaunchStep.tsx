import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, Send, Loader2, Check, Rocket, Linkedin,
  Mail, ChevronDown, PartyPopper, Plus, AlertCircle,
  CheckCircle2, XCircle, Clock, Users, Inbox, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  linkedinUrl: string | null;
  aiEnrichment: any;
  relevanceScore: number | null;
  recommendedAction: string | null;
  photoUrl: string | null;
  isSaved: boolean;
}

interface ContactMessages {
  emailSubject: string;
  emailBody: string;
  linkedInConnection: string;
  linkedInDM: string;
  instantlyVariables: Record<string, string>;
}

interface EmailSequenceStep {
  stepNumber: number;
  dayDelay: number;
  label: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isAIPersonalized: boolean;
}

interface LaunchStepProps {
  verticalName: string;
  verticalId?: string;
  contacts: ContactItem[];
  contactMessages: Map<string, ContactMessages>;
  sequence: EmailSequenceStep[];
  generateLinkedIn: boolean;
  generateLinkedInDM: boolean;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/* Timezones                                                           */
/* ------------------------------------------------------------------ */

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "Europe/London",
  "Europe/Berlin", "Asia/Kolkata", "Australia/Sydney",
];

/* ------------------------------------------------------------------ */
/* Helper: fill template variables                                     */
/* ------------------------------------------------------------------ */

function fillTemplate(template: string, contact: ContactItem, msgs: ContactMessages): string {
  const v = msgs.instantlyVariables || {};
  return template
    .replace(/\{\{first_name\}\}/g, contact.firstName || "")
    .replace(/\{\{last_name\}\}/g, contact.lastName || "")
    .replace(/\{\{company_name\}\}/g, contact.companyName || "")
    .replace(/\{\{title\}\}/g, contact.title || "")
    .replace(/\{\{growth\}\}/g, v.growth || "")
    .replace(/\{\{savings\}\}/g, v.savings || "")
    .replace(/\{\{vertical_role\}\}/g, v.vertical_role || "")
    .replace(/\{\{us_cost_range\}\}/g, v.us_cost_range || "")
    .replace(/\{\{ob_cost_range\}\}/g, v.ob_cost_range || "")
    .replace(/\{\{industry\}\}/g, v.industry || "")
    .replace(/\{\{vertical_name\}\}/g, v.vertical_name || "")
    .replace(/\{\{vertical_challenge\}\}/g, v.vertical_challenge || "")
    .replace(/\{\{case_study_result_1\}\}/g, v.case_study_result_1 || "")
    .replace(/\{\{case_study_result_2\}\}/g, v.case_study_result_2 || "")
    .replace(/\{\{case_study_result_3\}\}/g, v.case_study_result_3 || "");
}

/* ------------------------------------------------------------------ */
/* Gmail send helper                                                   */
/* ------------------------------------------------------------------ */

async function sendViaGmailApi(emailAccountId: string, opts: {
  to: string; subject: string; body: string; replyToMessageId?: string;
}) {
  const { data, error } = await supabase.functions.invoke("gmail-oauth", {
    body: {
      action: "send", email_account_id: emailAccountId,
      to: opts.to, subject: opts.subject, body: opts.body,
      replyToMessageId: opts.replyToMessageId,
    },
  });
  if (error || !data?.success) throw new Error(data?.error || error?.message || "Gmail API send failed");
  return data;
}

/* ------------------------------------------------------------------ */
/* Round-robin distributor                                             */
/* ------------------------------------------------------------------ */

function distributeContacts(contacts: ContactItem[], accounts: any[]): Map<string, string> {
  const assignment = new Map<string, string>();
  if (accounts.length === 0) return assignment;
  const capacity = new Map<string, number>();
  accounts.forEach(a => capacity.set(a.id, a.daily_send_limit || 50));
  let idx = 0;
  for (const contact of contacts) {
    let attempts = 0;
    while (attempts < accounts.length) {
      const account = accounts[idx % accounts.length];
      const remaining = capacity.get(account.id) || 0;
      if (remaining > 0) {
        assignment.set(contact.id, account.id);
        capacity.set(account.id, remaining - 1);
        idx++;
        break;
      }
      idx++;
      attempts++;
    }
    if (!assignment.has(contact.id)) {
      assignment.set(contact.id, accounts[0].id);
      idx++;
    }
  }
  return assignment;
}

/* ------------------------------------------------------------------ */
/* Contact send status type                                            */
/* ------------------------------------------------------------------ */

type SendStatus = "queued" | "sending" | "sent" | "failed";

interface ContactSendState {
  contactId: string;
  name: string;
  email: string;
  status: SendStatus;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function LaunchStep({
  verticalName, verticalId, contacts, contactMessages,
  sequence, generateLinkedIn, generateLinkedInDM, onBack,
}: LaunchStepProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const emailContacts = useMemo(() => contacts.filter(c => c.email), [contacts]);
  const linkedInContacts = useMemo(() => contacts.filter(c => c.linkedinUrl), [contacts]);

  // Campaign settings
  const [campaignName, setCampaignName] = useState(() => {
    const v = verticalName.replace(/\s+/g, "");
    const month = new Date().toLocaleString("default", { month: "short" });
    const year = new Date().getFullYear();
    return `OB-${v}-T1T2-${month}${year}`;
  });

  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");
  const [sendWindowStart, setSendWindowStart] = useState("08:00");
  const [sendWindowEnd, setSendWindowEnd] = useState("17:00");
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [linkedInDailyLimit, setLinkedInDailyLimit] = useState(25);

  // Multi-select Gmail accounts
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Launch state
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchComplete, setLaunchComplete] = useState(false);
  const [launchErrors, setLaunchErrors] = useState<string[]>([]);
  const [sentEmailCount, setSentEmailCount] = useState(0);

  // Real-time progress
  const [contactSendStates, setContactSendStates] = useState<ContactSendState[]>([]);

  // BDMs
  const [bdmList, setBdmList] = useState<any[]>([]);
  const [assignedTo, setAssignedTo] = useState(user?.id || "");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, email, email_signature").eq("is_active", true)
      .then(({ data }) => {
        setBdmList(data || []);
        if (!assignedTo && data?.length) setAssignedTo(data[0].id);
        const me = data?.find(p => p.id === user?.id);
        if (me) setProfile(me);
      });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingAccounts(true);
    supabase
      .from("email_accounts").select("*").eq("user_id", user.id).eq("is_active", true)
      .order("connected_at", { ascending: false })
      .then(({ data }) => {
        setEmailAccounts(data || []);
        if (data?.length && selectedAccountIds.length === 0) {
          setSelectedAccountIds(data.map(a => a.id));
        }
        setLoadingAccounts(false);
      });
  }, [user?.id]);

  const selectedAccounts = useMemo(
    () => emailAccounts.filter(a => selectedAccountIds.includes(a.id)),
    [emailAccounts, selectedAccountIds],
  );

  const totalDailyLimit = useMemo(
    () => selectedAccounts.reduce((sum, a) => sum + (a.daily_send_limit || 50), 0),
    [selectedAccounts],
  );

  const contactDistribution = useMemo(
    () => distributeContacts(emailContacts, selectedAccounts),
    [emailContacts, selectedAccounts],
  );

  const distributionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    contactDistribution.forEach((accountId) => {
      counts.set(accountId, (counts.get(accountId) || 0) + 1);
    });
    return counts;
  }, [contactDistribution]);

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId],
    );
  };

  const toggleDay = (d: number) => {
    setSelectedDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort(),
    );
  };

  /* ---- Pre-flight checks ---- */

  const readyContacts = useMemo(
    () => emailContacts.filter(c => contactMessages.has(c.id)),
    [emailContacts, contactMessages],
  );

  const preflightChecks = useMemo(() => {
    const hasAccounts = selectedAccountIds.length > 0;
    const allReady = readyContacts.length === emailContacts.length && emailContacts.length > 0;
    const hasWindow = sendWindowStart && sendWindowEnd && selectedDays.length > 0;
    return { hasAccounts, allReady, hasWindow };
  }, [selectedAccountIds, readyContacts, emailContacts, sendWindowStart, sendWindowEnd, selectedDays]);

  const allPreflightPassed = preflightChecks.hasAccounts && preflightChecks.allReady && preflightChecks.hasWindow;

  const estCompletionDays = useMemo(() => {
    if (totalDailyLimit === 0) return "∞";
    return Math.ceil(emailContacts.length / totalDailyLimit);
  }, [emailContacts.length, totalDailyLimit]);

  /* ---- CSV Export ---- */

  const handleExportEmailCSV = () => {
    const cList = contacts.filter(c => c.email);
    if (cList.length === 0) { toast.error("No contacts with email to export"); return; }
    const headers = ["email","first_name","last_name","company_name","title","email_subject","personalization","linkedin_url","company_domain"];
    const rows = cList.map(c => {
      const msgs = contactMessages.get(c.id);
      return [c.email||"", c.firstName||"", c.lastName||"", c.companyName||"", c.title||"",
        msgs?.emailSubject||"", msgs?.emailBody||"", c.linkedinUrl||"", c.companyDomain||"",
      ].map(val => `"${String(val).replace(/"/g, '""').replace(/\n/g, " ")}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${campaignName || "campaign"}-leads.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cList.length} leads to CSV`);
  };

  const handleExportLinkedInCSV = () => {
    const cList = contacts.filter(c => c.linkedinUrl);
    if (cList.length === 0) { toast.error("No contacts with LinkedIn URL"); return; }
    const headers = ["name","title","company","linkedin_url","connection_message","dm_message","tier","email"];
    const rows = cList.map(c => {
      const msgs = contactMessages.get(c.id);
      return [`${c.firstName} ${c.lastName}`, c.title||"", c.companyName||"",
        c.linkedinUrl||"", msgs?.linkedInConnection||"", msgs?.linkedInDM||"",
        c.companyTier||"", c.email||"",
      ].map(val => `"${String(val).replace(/"/g, '""').replace(/\n/g, " ")}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${campaignName || "campaign"}-linkedin.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cList.length} LinkedIn tasks to CSV`);
  };

  /* ---- Launch with real-time progress ---- */

  const handleLaunch = async () => {
    if (!allPreflightPassed) {
      toast.error("Please complete all pre-flight checks before launching.");
      return;
    }

    setIsLaunching(true);
    setLaunchErrors([]);
    const errors: string[] = [];
    let sentCount = 0;

    // Initialize send states
    const initialStates: ContactSendState[] = emailContacts.map(c => ({
      contactId: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.email || "",
      status: "queued" as SendStatus,
    }));
    setContactSendStates(initialStates);

    const updateContactStatus = (contactId: string, status: SendStatus, error?: string) => {
      setContactSendStates(prev =>
        prev.map(s => s.contactId === contactId ? { ...s, status, error } : s)
      );
    };

    try {
      // 1. Save campaign
      const { data: campaign, error: campError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName, vertical_id: verticalId, status: "active",
          assigned_to: assignedTo, contacts_count: emailContacts.length,
          linkedin_tasks_count: linkedInContacts.length,
          settings: {
            timezone: selectedTimezone,
            sendWindow: { start: sendWindowStart, end: sendWindowEnd },
            sendDays: selectedDays, emailAccountIds: selectedAccountIds,
          } as any,
        } as any)
        .select().single();

      if (campError) throw new Error("Failed to create campaign: " + campError.message);

      // 2. Create email queue
      const now = new Date();
      const emailSteps = sequence.filter((s: any) => !s.type || s.type === "email");

      const queueEntries = emailContacts.flatMap(contact => {
        const msgs = contactMessages.get(contact.id);
        if (!msgs) return [];
        const assignedAccountId = contactDistribution.get(contact.id) || selectedAccountIds[0];
        const assignedAccount = emailAccounts.find(a => a.id === assignedAccountId);

        return emailSteps.map((step) => {
          const sendDate = new Date(now);
          sendDate.setDate(sendDate.getDate() + step.dayDelay - 1);
          const [hours] = sendWindowStart.split(":");
          sendDate.setHours(parseInt(hours), 0, 0, 0);

          let subject: string, body: string;
          if (step.isAIPersonalized) {
            subject = msgs.emailSubject;
            body = msgs.emailBody;
          } else {
            subject = fillTemplate(step.subjectTemplate, contact, msgs);
            body = fillTemplate(step.bodyTemplate, contact, msgs);
          }

          const senderName = assignedAccount?.display_name || "";
          const senderSig = profile?.email_signature || senderName;
          subject = subject.replace(/\{\{sender_name\}\}/g, senderName);
          body = body.replace(/\{\{sender_name\}\}/g, senderName).replace(/\{\{sender_signature\}\}/g, senderSig);

          return {
            campaign_id: campaign.id, contact_id: contact.id,
            email_account_id: assignedAccountId, to_email: contact.email!,
            to_name: `${contact.firstName} ${contact.lastName}`,
            subject, body, sequence_step: step.stepNumber,
            scheduled_at: sendDate.toISOString(), status: "scheduled",
          };
        });
      });

      if (queueEntries.length > 0) {
        const { error: queueError } = await supabase.from("email_queue").insert(queueEntries as any);
        if (queueError) errors.push("Failed to create email queue: " + queueError.message);
      }

      // 3. Send Day 1 emails with live status updates
      const day1Emails = queueEntries.filter(e => e.sequence_step === 1);

      for (const email of day1Emails) {
        updateContactStatus(email.contact_id, "sending");

        try {
          const { data: optOut } = await supabase
            .from("email_optouts").select("id").eq("email", email.to_email).maybeSingle();

          if (optOut) {
            await supabase.from("email_queue")
              .update({ status: "cancelled", error_message: "Contact opted out" } as any)
              .eq("campaign_id", campaign.id).eq("contact_id", email.contact_id).eq("sequence_step", 1);
            updateContactStatus(email.contact_id, "failed", "Opted out");
            continue;
          }

          const sendResult = await sendViaGmailApi(email.email_account_id!, {
            to: email.to_email, subject: email.subject, body: email.body,
          });

          await supabase.from("email_queue")
            .update({
              status: "sent", sent_at: new Date().toISOString(),
              gmail_message_id: sendResult.gmail_message_id || null,
              thread_id: sendResult.gmail_thread_id || null,
            } as any)
            .eq("campaign_id", campaign.id).eq("contact_id", email.contact_id).eq("sequence_step", 1);

          updateContactStatus(email.contact_id, "sent");
          sentCount++;
          await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000));
        } catch (e: any) {
          errors.push(`Send error for ${email.to_email}: ${e.message}`);
          await supabase.from("email_queue")
            .update({ status: "failed", error_message: e.message } as any)
            .eq("campaign_id", campaign.id).eq("contact_id", email.contact_id).eq("sequence_step", 1);
          updateContactStatus(email.contact_id, "failed", e.message);
        }
      }

      // 4. LinkedIn tasks
      if (generateLinkedIn && linkedInContacts.length > 0) {
        const tasks: any[] = [];
        for (const contact of linkedInContacts) {
          const msgs = contactMessages.get(contact.id);
          tasks.push({
            contact_id: contact.isSaved ? contact.id : null, vertical_id: verticalId,
            task_type: "connection_request", message: msgs?.linkedInConnection || "",
            status: "pending", scheduled_date: new Date().toISOString().split("T")[0],
            assigned_to: assignedTo,
            contact_name: `${contact.firstName} ${contact.lastName}`,
            contact_title: contact.title, contact_company: contact.companyName,
            contact_linkedin_url: contact.linkedinUrl, contact_tier: contact.companyTier,
          });
          if (generateLinkedInDM && msgs?.linkedInDM) {
            const dmDate = new Date();
            dmDate.setDate(dmDate.getDate() + 3);
            tasks.push({
              contact_id: contact.isSaved ? contact.id : null, vertical_id: verticalId,
              task_type: "dm", message: msgs.linkedInDM, status: "pending",
              scheduled_date: dmDate.toISOString().split("T")[0], assigned_to: assignedTo,
              contact_name: `${contact.firstName} ${contact.lastName}`,
              contact_title: contact.title, contact_company: contact.companyName,
              contact_linkedin_url: contact.linkedinUrl, contact_tier: contact.companyTier,
            });
          }
        }
        if (tasks.length > 0) await supabase.from("linkedin_tasks").insert(tasks as any);
      }

      const savedIds = emailContacts.filter(c => c.isSaved).map(c => c.id);
      if (savedIds.length > 0) {
        await supabase.from("saved_contacts").update({ status: "sent" }).in("id", savedIds);
      }
    } catch (e: any) {
      errors.push(e.message);
    }

    setIsLaunching(false);
    setLaunchErrors(errors);
    setLaunchComplete(true);
    setSentEmailCount(sentCount);

    if (errors.length === 0) {
      toast.success(`Campaign launched! ${sentCount} Day 1 emails sent across ${selectedAccounts.length} account(s).`);
    } else {
      toast.warning(`Launched with ${errors.length} warning(s)`);
    }
  };

  /* ---- Success screen ---- */
  if (launchComplete && !isLaunching) {
    const linkedInTasksCount = generateLinkedIn
      ? linkedInContacts.length * (generateLinkedInDM ? 2 : 1) : 0;

    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          {launchErrors.length === 0 ? (
            <PartyPopper className="h-8 w-8 text-primary" />
          ) : <span className="text-2xl">⚠️</span>}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">
            {launchErrors.length === 0 ? "Campaign Launched!" : "Campaign Saved with Warnings"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">"{campaignName}"</p>
        </div>
        <div className="flex gap-6">
          <div className="text-center"><p className="text-2xl font-bold">{sentEmailCount}</p><p className="text-xs text-muted-foreground">Day 1 sent</p></div>
          <div className="text-center"><p className="text-2xl font-bold">{emailContacts.length * (sequence.filter((s: any) => !s.type || s.type === "email").length - 1)}</p><p className="text-xs text-muted-foreground">Follow-ups scheduled</p></div>
          <div className="text-center"><p className="text-2xl font-bold">{linkedInTasksCount}</p><p className="text-xs text-muted-foreground">LinkedIn tasks</p></div>
        </div>

        {launchErrors.length > 0 && (
          <div className="w-full max-w-md p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm space-y-1">
            <p className="font-medium text-destructive">Warnings:</p>
            {launchErrors.map((e, i) => <p key={i} className="text-xs text-destructive/80">• {e}</p>)}
          </div>
        )}

        <div className="flex gap-3 flex-wrap justify-center">
          <Button variant="outline" size="sm" onClick={handleExportEmailCSV}>📥 Emails CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportLinkedInCSV}>📥 LinkedIn CSV</Button>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/")}>Dashboard</Button>
          <Button onClick={() => navigate("/linkedin")} variant="secondary"><Linkedin className="h-4 w-4 mr-2" /> LinkedIn Queue</Button>
          <Button onClick={() => window.location.reload()}>New Campaign</Button>
        </div>
      </div>
    );
  }

  /* ---- Launching: real-time progress view ---- */
  if (isLaunching) {
    const sentCount = contactSendStates.filter(s => s.status === "sent").length;
    const failedCount = contactSendStates.filter(s => s.status === "failed").length;
    const sendingCount = contactSendStates.filter(s => s.status === "sending").length;
    const totalCount = contactSendStates.length;

    return (
      <div className="space-y-4 py-4">
        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Launching Campaign...
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sentCount} sent · {sendingCount} sending · {failedCount} failed · {totalCount - sentCount - failedCount - sendingCount} queued
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-4">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${((sentCount + failedCount) / Math.max(totalCount, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Contact list with live status */}
        <div className="max-h-[400px] overflow-y-auto border border-border rounded-xl">
          {contactSendStates.map(cs => (
            <div key={cs.contactId} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cs.name}</p>
                <p className="text-xs text-muted-foreground truncate">{cs.email}</p>
              </div>
              <div className="flex-shrink-0">
                {cs.status === "queued" && (
                  <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" />Queued</Badge>
                )}
                {cs.status === "sending" && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />Sending
                  </Badge>
                )}
                {cs.status === "sent" && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Sent
                  </Badge>
                )}
                {cs.status === "failed" && (
                  <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />Failed
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---- Main form ---- */
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Launch Campaign — {verticalName}
        </h2>
        <p className="text-sm text-muted-foreground">Review and launch your outbound campaign</p>
      </div>

      {/* ============ 3 Stat Cards ============ */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readyContacts.length}</p>
              <p className="text-xs text-muted-foreground">Contacts ready</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{selectedAccounts.length}</p>
              <p className="text-xs text-muted-foreground">Inboxes available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{estCompletionDays}</p>
              <p className="text-xs text-muted-foreground">Est. days to complete</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============ Pre-flight Checklist ============ */}
      <Card className={allPreflightPassed ? "border-emerald-200" : "border-amber-200"}>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {allPreflightPassed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
            Pre-flight Checklist
          </h3>
          <div className="space-y-2">
            <PreflightItem
              passed={preflightChecks.hasAccounts}
              label="At least one email account selected"
              failMessage="Select an email account below or connect one in Settings"
            />
            <PreflightItem
              passed={preflightChecks.allReady}
              label={`All contacts have messages generated (${readyContacts.length}/${emailContacts.length})`}
              failMessage="Go back to Phase 4 and generate messages for all contacts"
            />
            <PreflightItem
              passed={preflightChecks.hasWindow}
              label="Send window configured"
              failMessage="Set send window time and days below"
            />
          </div>
        </CardContent>
      </Card>

      {/* Campaign Settings */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Campaign Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Assigned BDM</Label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                {bdmList.map(b => <option key={b.id} value={b.id}>{b.full_name} ({b.email})</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Email Settings</h3>

          {loadingAccounts ? (
            <div className="flex items-center gap-3 p-4 border border-dashed border-border rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading email accounts...</p>
            </div>
          ) : emailAccounts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Send From (select inboxes)</Label>
                <button onClick={() => {
                  if (selectedAccountIds.length === emailAccounts.length) setSelectedAccountIds([]);
                  else setSelectedAccountIds(emailAccounts.map(a => a.id));
                }} className="text-xs text-primary hover:underline">
                  {selectedAccountIds.length === emailAccounts.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {emailAccounts.map(account => {
                  const isSelected = selectedAccountIds.includes(account.id);
                  const assignedCount = distributionSummary.get(account.id) || 0;
                  return (
                    <label key={account.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleAccount(account.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.email}
                          {account.display_name && <span className="text-muted-foreground font-normal ml-1">({account.display_name})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Limit: {account.daily_send_limit}/day</p>
                      </div>
                      {isSelected && assignedCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{assignedCount} contacts</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-border rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">No Gmail accounts connected</p>
              <p className="text-xs text-muted-foreground">Go to <a href="/settings" className="text-primary underline">Settings</a> to connect</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Timezone</Label>
              <select value={selectedTimezone} onChange={e => setSelectedTimezone(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Send Window Start</Label>
              <Input type="time" value={sendWindowStart} onChange={e => setSendWindowStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Send Window End</Label>
              <Input type="time" value={sendWindowEnd} onChange={e => setSendWindowEnd(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Send Days</Label>
            <div className="flex gap-2">
              {dayNames.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedDays.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/30"
                  }`}>{d}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Outreach */}
      {generateLinkedIn && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Linkedin className="h-4 w-4" /> LinkedIn Outreach</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Connection requests</p><p className="font-medium">{linkedInContacts.length}</p></div>
              {generateLinkedInDM && (
                <div><p className="text-xs text-muted-foreground">Follow-up DMs</p><p className="font-medium">{linkedInContacts.length}</p></div>
              )}
              <div><p className="text-xs text-muted-foreground">Assigned to</p><p className="font-medium">{bdmList.find(b => b.id === assignedTo)?.full_name || "—"}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom bar */}
      <div className="sticky bottom-0 bg-background border-t border-border py-3 px-4 -mx-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2 h-9">
          <ArrowLeft className="h-4 w-4" /> Back to Messages
        </Button>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" size="sm" onClick={handleExportEmailCSV} className="text-xs">📥 Emails CSV</Button>
          <Button variant="ghost" size="sm" onClick={handleExportLinkedInCSV} className="text-xs">📥 LinkedIn CSV</Button>
          <Button onClick={handleLaunch} disabled={!allPreflightPassed} className="gap-2">
            <Rocket className="h-4 w-4" /> Launch Campaign
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PreflightItem sub-component                                         */
/* ------------------------------------------------------------------ */

function PreflightItem({ passed, label, failMessage }: { passed: boolean; label: string; failMessage: string }) {
  return (
    <div className="flex items-start gap-2">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
      )}
      <div>
        <p className={`text-sm ${passed ? "text-foreground" : "text-red-600"}`}>{label}</p>
        {!passed && <p className="text-xs text-muted-foreground">{failMessage}</p>}
      </div>
    </div>
  );
}
