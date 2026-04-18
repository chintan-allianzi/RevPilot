import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, Users, Sparkles, Search, Loader2, Save, ChevronDown, ChevronUp,
  ExternalLink, Mail, Phone, Ban, CheckCheck, UserPlus, Trash2, X, RefreshCw, AlertTriangle, Info, Building2
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { searchContacts as searchContactsMulti, lookupEmail as lookupEmailMulti, getActiveProviders, type ContactSearchOptions } from "@/lib/data-provider-service";
import { callAIProvider } from "@/lib/ai-provider";
import { useAISettings } from "@/contexts/AISettingsContext";
import TagInput from "@/components/TagInput";
import { toast } from "sonner";

// Unified contact item
interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string | null;
  emailStatus: "verified" | "guessed" | "unavailable" | "finding";
  phone: string | null;
  linkedinUrl: string | null;
  photoUrl: string | null;
  companyName: string;
  companyDomain: string;
  companyTier: string;
  apolloPersonId: string | null;
  source: "saved" | "new";
  isSaved: boolean;
  isSelected: boolean;
  aiEnrichment: any | null;
  relevanceScore: number | null;
  recommendedAction: string | null;
  companyId: string | null;
}

interface ContactsStepProps {
  verticalName: string;
  verticalId?: string;
  buyerPersonas: string[];
  selectedCompanies: Array<{
    id: string;
    name: string;
    domain: string;
    ai_tier?: string | null;
    basic_tier?: string | null;
    ai_score?: number | null;
    basic_score?: number | null;
    logo_url?: string | null;
    location?: string | null;
    industry?: string | null;
  }>;
  apolloApiKey: string;
  showDebug?: boolean;
  onBack: () => void;
  onNext: (selectedContacts: ContactItem[]) => void;
}

function categorizeTitleGroup(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("cto") || t.includes("chief technology")) return "CTO";
  if (t.includes("ceo") || t.includes("chief executive")) return "CEO";
  if (t.includes("cfo") || t.includes("chief financial")) return "CFO";
  if (t.includes("ciso") || t.includes("chief information security")) return "CISO";
  if (t.includes("cio") || t.includes("chief information officer")) return "CIO";
  if (t.includes("vp") || t.includes("vice president")) {
    if (t.includes("engineer")) return "VP Engineering";
    if (t.includes("product")) return "VP Product";
    if (t.includes("tech")) return "VP Technology";
    return "VP / SVP";
  }
  if (t.includes("director")) {
    if (t.includes("engineer")) return "Dir. Engineering";
    if (t.includes("product")) return "Dir. Product";
    if (t.includes("it") || t.includes("tech")) return "Dir. IT/Tech";
    return "Director";
  }
  if (t.includes("head of") || t.includes("head,")) return "Head of Dept";
  if (t.includes("founder") || t.includes("co-founder")) return "Founder";
  if (t.includes("owner")) return "Owner";
  if (t.includes("manager")) return "Manager";
  return "Other";
}

export default function ContactsStep({
  verticalName,
  verticalId,
  buyerPersonas: initialPersonas,
  selectedCompanies,
  apolloApiKey,
  showDebug = false,
  onBack,
  onNext,
}: ContactsStepProps) {
  const { aiProvider, getActiveKey, getActiveModel } = useAISettings();

  // Unified contacts list
  const [allContacts, setAllContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [titleFilter, setTitleFilter] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState<"all" | "has_email" | "verified" | "no_email">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "priority" | "new" | "enriched" | "saved" | "unsaved">("all");

  // Search panel
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searching, setSearching] = useState(false);
  const [buyerPersonas, setBuyerPersonas] = useState<string[]>(initialPersonas || []);
  const [contactsPerCompany, setContactsPerCompany] = useState("5");
  const [enrichingEmails, setEnrichingEmails] = useState(false);
  const [emailEnrichProgress, setEmailEnrichProgress] = useState({ done: 0, total: 0 });

  // Provider status
  const [providerAvailable, setProviderAvailable] = useState(true);
  const [activeProviderName, setActiveProviderName] = useState<string | null>(null);
  const [resultProviderInfo, setResultProviderInfo] = useState<{ name: string; failover?: string } | null>(null);

  // AI enrichment
  const [enrichingContacts, setEnrichingContacts] = useState(false);

  // Expanded contact
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Debug
  const [contactDebugInfo, setContactDebugInfo] = useState<any>(null);
  const [searchAuthError, setSearchAuthError] = useState<string | null>(null);

  // Check provider availability on mount
  useEffect(() => {
    getActiveProviders("contact_search").then((providers) => {
      setProviderAvailable(providers.length > 0);
      if (providers.length > 0) {
        setActiveProviderName(providers[0].provider_name);
      }
    });
  }, []);

  // Load saved contacts on mount
  useEffect(() => {
    if (verticalId) loadSavedContacts();
  }, [verticalId]);

  const loadSavedContacts = async () => {
    if (!verticalId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("saved_contacts")
      .select(`*, company:saved_companies(id, name, domain, ai_tier, logo_url)`)
      .eq("vertical_id", verticalId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load contacts:", error);
      toast.error("Failed to load saved contacts");
      setIsLoading(false);
      return;
    }

    const saved: ContactItem[] = (data || []).map((c: any) => ({
      id: c.id,
      firstName: c.first_name || "",
      lastName: c.last_name || "",
      title: c.title || "",
      email: c.email,
      emailStatus: (c.email_status as any) || "unavailable",
      phone: c.phone,
      linkedinUrl: c.linkedin_url,
      photoUrl: c.photo_url,
      companyName: c.company?.name || "",
      companyDomain: c.company?.domain || "",
      companyTier: c.company?.ai_tier || "T3",
      apolloPersonId: c.apollo_person_id,
      source: "saved" as const,
      isSaved: true,
      isSelected: !!c.email,
      aiEnrichment: c.ai_enrichment,
      relevanceScore: c.ai_enrichment?.relevance_score ?? null,
      recommendedAction: c.ai_enrichment?.recommended_action ?? null,
      companyId: c.company_id,
    }));

    setAllContacts(saved);
    setIsLoading(false);
  };

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return allContacts.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          c.firstName?.toLowerCase().includes(q) ||
          c.lastName?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (titleFilter) {
        const cat = categorizeTitleGroup(c.title || "");
        if (cat !== titleFilter) return false;
      }
      if (emailFilter === "has_email" && !c.email) return false;
      if (emailFilter === "verified" && c.emailStatus !== "verified") return false;
      if (emailFilter === "no_email" && c.email) return false;
      if (statusFilter === "priority" && c.recommendedAction !== "priority_outreach") return false;
      if (statusFilter === "new" && c.source !== "new") return false;
      if (statusFilter === "enriched" && !c.aiEnrichment) return false;
      if (statusFilter === "saved" && !c.isSaved) return false;
      if (statusFilter === "unsaved" && c.isSaved) return false;
      return true;
    });
  }, [allContacts, searchQuery, titleFilter, emailFilter, statusFilter]);

  // Title groups
  const titleGroups = useMemo(() => {
    const groups = new Map<string, number>();
    allContacts.forEach((c) => {
      const cat = categorizeTitleGroup(c.title || "");
      groups.set(cat, (groups.get(cat) || 0) + 1);
    });
    return Array.from(groups.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);
  }, [allContacts]);

  // Stats
  const selectedContacts = allContacts.filter((c) => c.isSelected);
  const selectedCount = selectedContacts.length;
  const unsavedCount = allContacts.filter((c) => !c.isSaved).length;

  // Selection helpers
  const toggleSelection = (id: string) => {
    setAllContacts((prev) => prev.map((c) => (c.id === id ? { ...c, isSelected: !c.isSelected } : c)));
  };
  const selectAllVisible = () => {
    const visibleIds = new Set(filteredContacts.map((c) => c.id));
    setAllContacts((prev) => prev.map((c) => (visibleIds.has(c.id) ? { ...c, isSelected: true } : c)));
  };
  const deselectAll = () => {
    setAllContacts((prev) => prev.map((c) => ({ ...c, isSelected: false })));
  };
  const selectWithEmailOnly = () => {
    setAllContacts((prev) => prev.map((c) => ({ ...c, isSelected: !!c.email })));
  };

  // Remove contact
  const removeContact = async (id: string) => {
    const contact = allContacts.find((c) => c.id === id);
    if (contact?.isSaved) {
      await supabase.from("saved_contacts").delete().eq("id", id);
    }
    setAllContacts((prev) => prev.filter((c) => c.id !== id));
  };

  // Bulk remove selected
  const removeSelected = async () => {
    const toRemove = allContacts.filter((c) => c.isSelected);
    const savedIds = toRemove.filter((c) => c.isSaved).map((c) => c.id);
    if (savedIds.length > 0) {
      await supabase.from("saved_contacts").delete().in("id", savedIds);
    }
    setAllContacts((prev) => prev.filter((c) => !c.isSelected));
    toast.success(`Removed ${toRemove.length} contacts`);
  };

  // Save single contact to DB
  const saveContactToDB = async (contact: ContactItem): Promise<string | null> => {
    if (!verticalId) return null;
    const matchingCompany = selectedCompanies.find((c) => {
      const cd = (c.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
      return cd === contact.companyDomain;
    });

    const insertData: any = {
      vertical_id: verticalId,
      company_id: matchingCompany?.id || contact.companyId || null,
      first_name: contact.firstName,
      last_name: contact.lastName,
      title: contact.title,
      email: contact.email || null,
      email_status: contact.emailStatus || "unavailable",
      phone: contact.phone || null,
      linkedin_url: contact.linkedinUrl || null,
      photo_url: contact.photoUrl || null,
      apollo_person_id: contact.apolloPersonId || null,
      status: contact.recommendedAction === "priority_outreach" ? "priority" : "new",
      ai_enrichment: contact.aiEnrichment || null,
    };

    const { data, error } = await supabase
      .from("saved_contacts")
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      console.error("Failed to save contact:", error);
      return null;
    }
    return data?.id || null;
  };

  // Save all unsaved
  const saveUnsaved = async () => {
    const unsaved = allContacts.filter((c) => !c.isSaved);
    if (unsaved.length === 0) {
      toast.info("All contacts are already saved");
      return;
    }
    let savedCount = 0;
    for (const contact of unsaved) {
      const newId = await saveContactToDB(contact);
      if (newId) {
        contact.id = newId;
        contact.isSaved = true;
        savedCount++;
      }
    }
    setAllContacts([...allContacts]);
    toast.success(`${savedCount} contacts saved`);
  };

  // Multi-provider contact search + email enrichment
  const handleSearchAndMerge = async () => {
    if (buyerPersonas.length === 0) {
      toast.error("Add at least one buyer persona title");
      return;
    }

    const domains = (selectedCompanies || [])
      .map((c) => (c.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim())
      .filter((d) => d && d.includes("."));

    if (domains.length === 0) {
      toast.error("No valid domains found in selected companies");
      return;
    }

    setSearching(true);
    setShowSearchPanel(false);
    setSearchAuthError(null);
    setResultProviderInfo(null);
    const perCompany = parseInt(contactsPerCompany) || 5;

    try {
      // Build extra context for Prospeo broadening
      const companyNames = selectedCompanies.map(c => c.name).filter(Boolean);
      const industries = [...new Set(selectedCompanies.map(c => c.industry).filter(Boolean))] as string[];

      // Use the multi-provider service with automatic failover
      const mpResult = await searchContactsMulti(domains, buyerPersonas, perCompany, {
        companyNames,
        industries,
      });

      setContactDebugInfo({
        request: { totalDomains: domains.length, domains, buyerPersonas, contactsPerCompany: perCompany },
        searchAttempts: mpResult.debug?.searchAttempts || [],
        rawResponses: mpResult.debug?.rawResponses || [],
        response: { 
          totalContactsFound: mpResult.data.length, 
          provider: mpResult.providerName,
          attempts: mpResult.attempts,
          failoverOccurred: mpResult.failoverOccurred,
        },
      });

      if (!mpResult.success) {
        if (mpResult.attempts.length === 0) {
          setSearchAuthError("No data providers are configured for contact search. Go to Settings → Data Providers to activate one.");
        } else {
          const details = mpResult.attempts.map(a => `${a.providerName}: ${a.error || 'no results'}`).join('; ');
          setSearchAuthError(`All providers failed. ${details}`);
        }
        setSearching(false);
        return;
      }

      // Show provider info
      setResultProviderInfo({
        name: mpResult.providerName,
        failover: mpResult.failoverOccurred ? mpResult.failedProvider : undefined,
      });

      const people = mpResult.data;

      if (people.length === 0) {
        setSearchAuthError(
          "No contacts found at these companies in the provider's database. Try:\n" +
          "• Adding more companies in Step 4\n" +
          "• Broadening your buyer persona titles\n" +
          "• Using a different data provider (enable another provider in Settings)"
        );
        setSearching(false);
        return;
      }

      // Normalize — handle both Apollo and Prospeo response shapes
      // Apollo search may return obfuscated last names; enrichment merges the real ones
      let newItems: ContactItem[] = people.map((raw: any) => {
        const p = raw.person || raw;
        const org = p.organization || raw.organization || {};
        const email = p.email || p.primary_email || raw.email || raw.primary_email || null;
        
        // Determine email status: if we have an email, use the status field.
        // If Apollo says has_email=true but we don't have it yet, mark as "finding".
        // Only mark "unavailable" if we know there's no email.
        const hasEmailFlag = p.has_email === true || raw.has_email === true;
        let emailStatus: "verified" | "guessed" | "unavailable" | "finding";
        if (email) {
          emailStatus = (p.email_status || p.contact_email_status || raw.email_status || "guessed") as any;
        } else if (hasEmailFlag) {
          emailStatus = "finding"; // Apollo knows email exists but didn't return it
        } else {
          emailStatus = "finding"; // Default to finding — will be resolved during enrichment
        }

        // Last name: prefer explicit last_name, then split from name/full_name
        let lastName = p.last_name || "";
        if (!lastName && (p.name || p.full_name)) {
          const nameParts = (p.name || p.full_name || "").split(" ");
          if (nameParts.length > 1) lastName = nameParts.slice(1).join(" ");
        }

        return {
          id: `new-${crypto.randomUUID()}`,
          firstName: p.first_name || (p.name || p.full_name || "").split(" ")[0] || "",
          lastName,
          title: p.title || p.headline || p.current_job_title || "",
          email,
          emailStatus,
          phone: p.phone_number || p.sanitized_phone || raw.phone_number || p.mobile?.mobile || null,
          linkedinUrl: p.linkedin_url || raw.linkedin_url || null,
          photoUrl: p.photo_url || raw.photo_url || null,
          companyName: org.name || p.organization_name || p.company_name || "",
          companyDomain: (org.primary_domain || org.domain || p.organization_domain || p.company_website || "").replace(/^www\./, ""),
          companyTier: "",
          apolloPersonId: p.id || raw.id || null,
          source: "new" as const,
          isSaved: false,
          isSelected: false,
          aiEnrichment: null,
          relevanceScore: null,
          recommendedAction: null,
          companyId: null,
        };
      }).filter((c) => c.firstName || c.lastName);

      // Deduplicate against existing
      const existingEmails = new Set(allContacts.map((c) => c.email).filter(Boolean));
      const existingNames = new Set(allContacts.map((c) => `${c.firstName}|${c.lastName}|${c.companyDomain}`));
      newItems = newItems.filter((c) => {
        if (c.email && existingEmails.has(c.email)) return false;
        if (existingNames.has(`${c.firstName}|${c.lastName}|${c.companyDomain}`)) return false;
        return true;
      });

      // Add to list immediately
      setAllContacts((prev) => [...prev, ...newItems]);
      toast.success(`Found ${newItems.length} new contacts via ${mpResult.providerName}. Looking up emails...`);
      setSearching(false);

      // Enrich emails in background using multi-provider lookupEmail
      const alreadyHaveEmail = newItems.filter((c) => c.email).length;

      const needsEmail = newItems.filter((c) => !c.email && (c.apolloPersonId || (c.firstName && c.companyDomain)));
      if (needsEmail.length > 0) {
        setEnrichingEmails(true);
        setEmailEnrichProgress({ done: 0, total: needsEmail.length });
        let emailsFound = 0;

        for (let i = 0; i < needsEmail.length; i++) {
          const contact = needsEmail[i];
          try {
            const emailResult = await lookupEmailMulti(
              contact.firstName,
              contact.lastName,
              contact.companyDomain,
              contact.apolloPersonId || undefined,
              contact.linkedinUrl || undefined,
            );
            if (emailResult.success && emailResult.data.length > 0) {
              const enriched = emailResult.data[0];
              contact.email = enriched.email;
              contact.emailStatus = (enriched.email_status || "guessed") as any;
              contact.phone = enriched.phone_number || enriched.sanitized_phone || enriched.mobile?.mobile || contact.phone;
              contact.linkedinUrl = enriched.linkedin_url || contact.linkedinUrl;
              emailsFound++;
            } else {
              contact.emailStatus = "unavailable";
            }
          } catch {
            contact.emailStatus = "unavailable";
          }

          setEmailEnrichProgress({ done: i + 1, total: needsEmail.length });
          setAllContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...contact } : c)));

          if (i < needsEmail.length - 1) {
            await new Promise((r) => setTimeout(r, 1200)); // 1.2s delay to avoid rate limiting
          }
        }
        setEnrichingEmails(false);
        toast.success(`Email lookup complete. Found ${emailsFound} new emails (${alreadyHaveEmail} already had emails from search).`);
      } else if (alreadyHaveEmail > 0) {
        toast.success(`${alreadyHaveEmail} contacts already had emails from search. No enrichment needed.`);
      }
    } catch (error: any) {
      toast.error(`Search failed: ${error.message}`);
      setSearching(false);
    }
  };

  // AI Contact Enrichment
  const handleEnrichSelected = async () => {
    const aiKey = getActiveKey();
    if (!aiKey) {
      toast.error("Add your AI API key in Settings to enrich contacts");
      return;
    }
    const toEnrich = allContacts.filter((c) => c.isSelected);
    if (toEnrich.length === 0) {
      toast.error("Select contacts to enrich");
      return;
    }

    setEnrichingContacts(true);
    const BATCH_SIZE = 10;

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const batch = toEnrich.slice(i, i + BATCH_SIZE);
      const summaries = batch
        .map((c) => `- ${c.firstName} ${c.lastName} | ${c.title} | ${c.companyName} | Email: ${c.email || "none"} | ${c.emailStatus}`)
        .join("\n");

      const systemPrompt = `You are a B2B sales analyst for Office Beacon, a remote staffing company.

Analyze these contacts found for the "${verticalName}" vertical and score each one for outbound sales relevance.

For each contact, return:
- relevance_score (0-100)
- relevance_tier: "high" (70-100), "medium" (40-69), "low" (0-39)
- reasoning: One sentence why this score
- is_decision_maker: true/false
- recommended_action: "priority_outreach" / "include_in_campaign" / "skip" / "linkedin_only"
- personalization_hook: One sentence for personalizing outreach

Respond ONLY with a JSON array in the same order:
[{"name":"First Last","relevance_score":85,"relevance_tier":"high","is_decision_maker":true,"reasoning":"...","recommended_action":"priority_outreach","personalization_hook":"..."}]`;

      try {
        const response = await callAIProvider(
          { provider: aiProvider, apiKey: aiKey, model: getActiveModel() },
          systemPrompt,
          [{ role: "user", content: `Analyze these contacts:\n${summaries}` }]
        );
        const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const enrichments = JSON.parse(jsonMatch[0]);
          setAllContacts((prev) =>
            prev.map((c) => {
              const bIdx = batch.findIndex((b) => b.id === c.id);
              if (bIdx >= 0 && enrichments[bIdx]) {
                const e = enrichments[bIdx];
                return {
                  ...c,
                  aiEnrichment: e,
                  relevanceScore: e.relevance_score,
                  recommendedAction: e.recommended_action,
                };
              }
              return c;
            })
          );
        }
      } catch (error) {
        console.error("Contact enrichment failed:", error);
        toast.error("AI enrichment failed for a batch");
      }

      if (i + BATCH_SIZE < toEnrich.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setEnrichingContacts(false);
    toast.success("AI enrichment complete");
  };

  // Retry email lookup for a single contact via multi-provider
  const retryEmailLookup = async (contactId: string) => {
    const contact = allContacts.find((c) => c.id === contactId);
    if (!contact) return;
    
    setAllContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, emailStatus: "finding" as const } : c));
    
    try {
      const emailResult = await lookupEmailMulti(
        contact.firstName,
        contact.lastName,
        contact.companyDomain,
        contact.apolloPersonId || undefined,
        contact.linkedinUrl || undefined,
      );
      
      if (emailResult.success && emailResult.data.length > 0) {
        const enriched = emailResult.data[0];
        setAllContacts((prev) => prev.map((c) => c.id === contactId ? {
          ...c,
          email: enriched.email,
          emailStatus: (enriched.email_status || "guessed") as any,
          phone: enriched.phone_number || enriched.sanitized_phone || enriched.mobile?.mobile || c.phone,
          linkedinUrl: enriched.linkedin_url || c.linkedinUrl,
        } : c));
        toast.success(`Found email for ${contact.firstName} ${contact.lastName}`);
      } else {
        setAllContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, emailStatus: "unavailable" as const } : c));
        toast.info(`No email found for ${contact.firstName} ${contact.lastName}`);
      }
    } catch {
      setAllContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, emailStatus: "unavailable" as const } : c));
      toast.error(`Email lookup failed for ${contact.firstName}`);
    }
  };

  const emailStatusBadge = (status: string | null) => {
    if (status === "verified") return <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">✓ Verified</Badge>;
    if (status === "guessed") return <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">~ Pattern</Badge>;
    if (status === "finding") return <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30 animate-pulse">Finding...</Badge>;
    if (status === "unavailable") return <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">No email</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Unknown</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Contacts — {verticalName}</h2>
          <p className="text-xs text-muted-foreground">Find and manage decision makers for your campaign</p>
        </div>
      </div>

      {/* Target Companies Banner */}
      {selectedCompanies.length > 0 && (
        <Collapsible>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5">
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">{selectedCompanies.length} target companies</span>
                <span className="text-[10px] text-muted-foreground">— contacts will be searched at these companies</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
                {selectedCompanies.map((c) => {
                  const tier = c.ai_tier || c.basic_tier || "T3";
                  return (
                    <span key={c.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background text-[11px]">
                      {c.logo_url && <img src={c.logo_url} alt="" className="h-3.5 w-3.5 rounded-sm object-contain" />}
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                        tier === "T1" ? "bg-success/15 text-success border-success/30" :
                        tier === "T2" ? "bg-primary/15 text-primary border-primary/30" :
                        "bg-muted text-muted-foreground"
                      }`}>{tier}</Badge>
                    </span>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* No provider warning */}
      {!providerAvailable && (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Data Provider Configured</AlertTitle>
          <AlertDescription>
            No data provider is configured for contact search. Go to{" "}
            <a href="/settings" className="underline font-medium hover:text-destructive">Settings → Data Providers</a>{" "}
            to activate one (e.g., Apollo.io or Prospeo.io).
          </AlertDescription>
        </Alert>
      )}

      {/* Search error banner */}
      {searchAuthError && (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Contact Search Failed</AlertTitle>
          <AlertDescription>{searchAuthError}</AlertDescription>
        </Alert>
      )}

      {/* Provider result badge */}
      {resultProviderInfo && (
        <div className="flex items-center gap-2 text-xs">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          {resultProviderInfo.failover ? (
            <span className="text-muted-foreground">
              <span className="text-destructive">{resultProviderInfo.failover} failed</span> → Results from <span className="font-medium text-foreground">{resultProviderInfo.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Results from <span className="font-medium text-foreground">{resultProviderInfo.name}</span></span>
          )}
        </div>
      )}

      {/* Search bar + Find More button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts by name, title, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSearchPanel(!showSearchPanel)}
          disabled={!providerAvailable}
          className="gap-2 h-9 text-sm shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Find Contacts
          {showSearchPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Search panel */}
      {showSearchPanel && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs font-medium">Buyer Persona Titles</Label>
                <TagInput tags={buyerPersonas} onChange={setBuyerPersonas} placeholder="Add title (e.g. CTO, VP Eng)..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Contacts per company</Label>
                <Select value={contactsPerCompany} onValueChange={setContactsPerCompany}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["3", "5", "10", "15", "20"].map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSearchAndMerge}
                  disabled={searching || buyerPersonas.length === 0}
                  className="w-full gap-2 h-8 text-xs"
                >
                  {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  {searching ? "Searching..." : `Search ${selectedCompanies.length} companies`}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {activeProviderName 
                ? `Using ${activeProviderName}. New contacts will appear in the list below. Duplicates are auto-filtered.`
                : "New contacts will appear in the list below. Duplicates are auto-filtered."
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email enrichment progress */}
      {enrichingEmails && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-xs font-medium flex-1">
            Looking up emails... ({emailEnrichProgress.done}/{emailEnrichProgress.total})
          </p>
          <Progress value={emailEnrichProgress.total > 0 ? (emailEnrichProgress.done / emailEnrichProgress.total) * 100 : 0} className="w-32 h-2" />
        </div>
      )}

      {/* Quick filters — title groups */}
      {allContacts.length > 0 && titleGroups.length > 1 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Filter by title:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTitleFilter(null)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                !titleFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"
              }`}
            >
              All ({allContacts.length})
            </button>
            {titleGroups.map(({ title, count }) => (
              <button
                key={title}
                onClick={() => setTitleFilter(titleFilter === title ? null : title)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  titleFilter === title
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}
              >
                {title} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter row */}
      {allContacts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {(["all", "has_email", "verified", "no_email"] as const).map((f) => (
              <Button key={f} size="sm" variant={emailFilter === f ? "default" : "outline"} onClick={() => setEmailFilter(f)} className="text-[10px] h-6 px-2">
                {f === "all" ? "All" : f === "has_email" ? "Has Email" : f === "verified" ? "Verified" : "No Email"}
              </Button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs">|</span>
          <div className="flex gap-1">
            {(["all", "priority", "enriched", "saved", "unsaved"] as const).map((f) => (
              <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)} className="text-[10px] h-6 px-2">
                {f === "all" ? "All" : f === "priority" ? "★ Priority" : f === "enriched" ? "Enriched" : f === "saved" ? "Saved" : "New"}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {allContacts.length > 0 && (
        <div className="flex items-center gap-2 py-2 border-y border-border flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">{selectedCount} of {allContacts.length} selected</span>
          <span className="text-muted-foreground text-xs">|</span>
          <button onClick={selectAllVisible} className="text-xs text-primary hover:underline">Select all visible</button>
          <button onClick={deselectAll} className="text-xs text-primary hover:underline">Deselect all</button>
          <button onClick={selectWithEmailOnly} className="text-xs text-primary hover:underline">With email only</button>
          <span className="text-muted-foreground text-xs">|</span>
          <Button
            size="sm" variant="outline"
            onClick={handleEnrichSelected}
            disabled={selectedCount === 0 || enrichingContacts}
            className="text-xs h-6 gap-1 border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            {enrichingContacts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {enrichingContacts ? "Enriching..." : `Enrich (${selectedCount})`}
          </Button>
          {unsavedCount > 0 && (
            <Button size="sm" variant="outline" onClick={saveUnsaved} className="text-xs h-6 gap-1">
              <Save className="h-3 w-3" /> Save unsaved ({unsavedCount})
            </Button>
          )}
          {selectedCount > 0 && (
            <Button
              size="sm" variant="outline"
              onClick={() => { if (confirm(`Remove ${selectedCount} contacts?`)) removeSelected(); }}
              className="text-xs h-6 gap-1 text-destructive border-destructive/20 hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" /> Remove ({selectedCount})
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Showing {filteredContacts.length} of {allContacts.length}
          </span>
        </div>
      )}

      {/* Contact list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts...
        </div>
      ) : allContacts.length === 0 && !searching ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold">No contacts yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Search for decision makers at your selected companies using your configured data provider.
          </p>
          <Button onClick={() => setShowSearchPanel(true)} disabled={!providerAvailable} className="gap-2">
            <Search className="h-4 w-4" /> Find Contacts
          </Button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {filteredContacts.map((contact) => (
            <div key={contact.id}>
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors ${
                contact.isSelected ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:bg-muted/20"
              }`}>
                <Checkbox
                  checked={contact.isSelected}
                  onCheckedChange={() => toggleSelection(contact.id)}
                  className="shrink-0"
                />
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpandedContactId(expandedContactId === contact.id ? null : contact.id)}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {contact.photoUrl ? <AvatarImage src={contact.photoUrl} /> : null}
                    <AvatarFallback className="text-[10px]">
                      {(contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{contact.firstName} {contact.lastName}</p>
                      {!contact.isSaved && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">NEW</Badge>
                      )}
                      {contact.recommendedAction === "priority_outreach" && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-success/10 text-success border-success/20">★ PRIORITY</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{contact.title} · {contact.companyName}</p>
                  </div>
                </div>

                {/* Email */}
                <div className="hidden md:flex items-center gap-2 shrink-0 min-w-[220px]">
                  {contact.emailStatus === "finding" ? (
                    <span className="text-xs text-primary animate-pulse">Finding email...</span>
                  ) : contact.email ? (
                    <div className="text-right">
                      <p className="text-[11px] font-mono truncate max-w-[160px]">{contact.email}</p>
                      {emailStatusBadge(contact.emailStatus)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {emailStatusBadge(contact.emailStatus)}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] gap-1 text-primary hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); retryEmailLookup(contact.id); }}
                        title="Retry email lookup"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </Button>
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className="shrink-0 w-10 text-center">
                  {contact.relevanceScore !== null ? (
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      contact.relevanceScore >= 70 ? "bg-success/15 text-success" :
                      contact.relevanceScore >= 40 ? "bg-primary/15 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {contact.relevanceScore}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {contact.linkedinUrl && (
                    <a href={contact.linkedinUrl.startsWith("http") ? contact.linkedinUrl : `https://${contact.linkedinUrl}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><ExternalLink className="h-3 w-3" /></Button>
                    </a>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeContact(contact.id)}
                    title="Remove contact"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedContactId === contact.id && (
                <div className="mx-4 mb-1 px-4 py-3 bg-muted/20 border border-t-0 border-border rounded-b-lg text-sm space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-mono">{contact.email || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p>{contact.phone || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Company:</span>
                      <p>{contact.companyName} ({contact.companyDomain})</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <p>{contact.isSaved ? "Saved" : "Unsaved"} · {contact.source}</p>
                    </div>
                  </div>
                  {contact.aiEnrichment && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">AI Analysis</p>
                        <p className="text-sm mt-1">{contact.aiEnrichment.reasoning}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Personalization Hook</p>
                        <p className="text-sm mt-1 italic">"{contact.aiEnrichment.personalization_hook}"</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredContacts.length === 0 && allContacts.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No contacts match your filters</p>
          )}
        </div>
      )}

      {/* Debug panel */}
      {showDebug && contactDebugInfo && (
        <details className="border border-border rounded-lg p-4">
          <summary className="text-sm font-medium cursor-pointer text-muted-foreground">
            Debug: Contact Search — {contactDebugInfo.response?.provider || "unknown"} — {contactDebugInfo.response?.attempts?.length || 0} provider(s) tried
          </summary>
          <div className="mt-3 space-y-4">
            {/* Email Stats Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold">{allContacts.filter(c => c.source === "new").length}</p>
                <p className="text-[10px] text-muted-foreground">Total Found</p>
              </div>
              <div className="bg-success/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-success">{allContacts.filter(c => c.source === "new" && c.email).length}</p>
                <p className="text-[10px] text-muted-foreground">With Email</p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-destructive">{allContacts.filter(c => c.source === "new" && !c.email).length}</p>
                <p className="text-[10px] text-muted-foreground">No Email</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{allContacts.filter(c => c.source === "new" && c.emailStatus === "verified").length}</p>
                <p className="text-[10px] text-muted-foreground">Verified</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-mono font-medium text-muted-foreground">Internal Request:</p>
              <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-32 mt-1">
                {JSON.stringify(contactDebugInfo.request, null, 2)}
              </pre>
            </div>
            {contactDebugInfo.searchAttempts?.length > 0 && (
              <div>
                <p className="text-xs font-mono font-medium text-muted-foreground mb-2">Prospeo Search Attempts:</p>
                {contactDebugInfo.searchAttempts.map((attempt: any, i: number) => (
                  <div key={i} className={`border rounded-lg p-3 mb-2 ${
                    attempt.success ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/30"
                  }`}>
                    <p className="text-xs font-mono font-semibold">
                      {attempt.success ? "✅" : "⬚"} Attempt {i + 1}: {attempt.name} → {attempt.resultCount} results{attempt.success ? " ✓" : ""}
                    </p>
                    <details className="mt-1">
                      <summary className="text-[10px] font-mono text-muted-foreground cursor-pointer">API Payload</summary>
                      <pre className="text-[10px] font-mono bg-muted p-2 rounded mt-1 overflow-auto max-h-24">
                        {JSON.stringify(attempt.filters, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
            {contactDebugInfo.rawResponses?.length > 0 && (
              <details>
                <summary className="text-xs font-mono font-medium text-muted-foreground cursor-pointer">Raw API Responses ({contactDebugInfo.rawResponses.length})</summary>
                {contactDebugInfo.rawResponses.map((raw: any, i: number) => (
                  <pre key={i} className="text-[10px] font-mono bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                    {JSON.stringify(raw, null, 2)}
                  </pre>
                ))}
              </details>
            )}
            {contactDebugInfo.response?.attempts?.map((attempt: any, i: number) => (
              <div key={i} className={`border rounded-lg p-3 ${
                attempt.success ? "border-success/30 bg-success/5" :
                attempt.error ? "border-destructive/30 bg-destructive/5" : "border-border"
              }`}>
                <p className="text-xs font-mono font-semibold">
                  {attempt.success ? "✅" : "❌"} {attempt.providerName || attempt.provider}
                </p>
                <div className="text-xs font-mono mt-1 space-y-0.5 text-muted-foreground">
                  {attempt.statusCode && <p>Status: {attempt.statusCode}</p>}
                  <p>Results: {attempt.resultCount}</p>
                  {attempt.error && <p className="text-destructive">Error: {attempt.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 bg-background border-t border-border py-3 px-4 -mx-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground space-x-2">
          <span>{selectedCount} contacts selected</span>
          <span>·</span>
          <span>{allContacts.filter((c) => c.isSelected && c.email).length} with email</span>
          <span>·</span>
          <span>{allContacts.filter((c) => c.isSelected && c.emailStatus === "verified").length} verified</span>
          <span>·</span>
          <span>{allContacts.filter((c) => c.isSelected && c.aiEnrichment).length} enriched</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack} className="gap-2 h-9">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={() => onNext(allContacts.filter(c => c.isSelected))} disabled={selectedCount === 0} className="gap-2 h-9">
            <Sparkles className="h-4 w-4" /> Generate Messages ({selectedCount}) →
          </Button>
        </div>
      </div>
    </div>
  );
}
