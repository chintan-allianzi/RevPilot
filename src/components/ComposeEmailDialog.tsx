import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPrimaryEmailAccount } from "@/lib/primary-inbox";
import { generateEmailFooter } from "@/lib/email-footer";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Loader2, AlertTriangle, Lock } from "lucide-react";

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user ID of the BDM who should send (deal's assigned_to). Falls back to current user. */
  sendAsUserId?: string;
  /** Pre-filled recipient email */
  toEmail?: string;
  /** Pre-filled recipient name */
  toName?: string;
  /** Pre-filled subject */
  subject?: string;
  /** Pre-filled body */
  body?: string;
  /** Deal ID for activity logging */
  dealId?: string;
  /** Activity type for logging (default: email_sent) */
  activityType?: string;
  /** Campaign ID for footer */
  campaignId?: string;
  /** For threading: the gmail_message_id of the previous email */
  inReplyToMessageId?: string;
  /** Called after successful send */
  onSent?: () => void;
}

export default function ComposeEmailDialog({
  open,
  onOpenChange,
  sendAsUserId,
  toEmail = "",
  toName = "",
  subject: initialSubject = "",
  body: initialBody = "",
  dealId,
  activityType = "email_sent",
  campaignId,
  inReplyToMessageId,
  onSent,
}: ComposeEmailDialogProps) {
  const { user } = useAuth();

  const [primaryAccount, setPrimaryAccount] = useState<any>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [to, setTo] = useState(toEmail);
  const [subjectField, setSubjectField] = useState(initialSubject);
  const [bodyField, setBodyField] = useState(initialBody);
  const [sending, setSending] = useState(false);

  // Reset fields when dialog opens with new props
  useEffect(() => {
    if (open) {
      setTo(toEmail);
      setSubjectField(initialSubject);
      setBodyField(initialBody);
      setAccountError(null);
      loadPrimaryAccount();
    }
  }, [open, toEmail, initialSubject, initialBody]);

  const loadPrimaryAccount = async () => {
    setLoadingAccount(true);
    const userId = sendAsUserId || user?.id;
    if (!userId) {
      setAccountError("No user context");
      setLoadingAccount(false);
      return;
    }

    const account = await getPrimaryEmailAccount(userId);
    if (!account) {
      // Try to get the BDM's name for the error message
      let bdmName = "you";
      if (sendAsUserId && sendAsUserId !== user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", sendAsUserId)
          .maybeSingle();
        if (profile) bdmName = profile.full_name;
      }
      setAccountError(`No Gmail account connected for ${bdmName}. Connect one in Settings to send emails.`);
      setPrimaryAccount(null);
    } else {
      setPrimaryAccount(account);
      setAccountError(null);
    }
    setLoadingAccount(false);
  };

  const handleSend = async () => {
    if (!to.trim()) { toast.error("Enter a recipient email"); return; }
    if (!subjectField.trim()) { toast.error("Enter a subject"); return; }
    if (!bodyField.trim()) { toast.error("Enter a message body"); return; }
    if (!primaryAccount) { toast.error("No Gmail account available"); return; }

    setSending(true);

    try {
      // Get company settings for footer
      const { data: compSettings } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      // Get sender profile
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name, email_signature")
        .eq("id", primaryAccount.user_id)
        .maybeSingle();

      const senderName = primaryAccount.display_name || senderProfile?.full_name || "Office Beacon";

      // Build footer
      const footer = await generateEmailFooter({
        senderName,
        senderEmail: primaryAccount.email,
        companyName: compSettings?.company_name || undefined,
        companyAddress: compSettings?.company_address || undefined,
        companyWebsite: compSettings?.company_website || undefined,
        recipientEmail: to,
        campaignId,
      });

      // Append signature if available
      let fullBody = bodyField.replace(/\n/g, "<br/>");
      if (senderProfile?.email_signature) {
        fullBody += `<br/><br/>${senderProfile.email_signature}`;
      }
      fullBody += footer;

      // Send via gmail-oauth edge function
      const { data: sendResult, error: sendError } = await supabase.functions.invoke("gmail-oauth", {
        body: {
          action: "send",
          email_account_id: primaryAccount.id,
          to,
          subject: subjectField,
          body: fullBody,
          replyToMessageId: inReplyToMessageId || undefined,
        },
      });

      if (sendError || !sendResult?.success) {
        const errMsg = sendResult?.error || sendError?.message || "Failed to send email";
        // Check if token expired
        if (errMsg.includes("invalid_grant") || errMsg.includes("Token has been expired")) {
          toast.error(`Gmail connection expired for ${primaryAccount.email}. Please reconnect in Settings.`);
        } else {
          toast.error(errMsg);
        }
        setSending(false);
        return;
      }

      // Log as deal activity
      if (dealId) {
        await supabase.from("deal_activities").insert({
          deal_id: dealId,
          activity_type: activityType,
          subject: subjectField,
          description: bodyField.slice(0, 300),
          created_by: user?.id,
          metadata: {
            gmail_message_id: sendResult.gmail_message_id,
            gmail_thread_id: sendResult.gmail_thread_id,
            to_email: to,
            from_email: primaryAccount.email,
          },
        });
      }

      toast.success("Email sent");
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Compose Email
          </DialogTitle>
        </DialogHeader>

        {accountError && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{accountError}</span>
          </div>
        )}

        <div className="space-y-3 py-1">
          {/* From */}
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-muted/40 rounded-lg border border-border">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">
                {loadingAccount ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : primaryAccount ? (
                  <>
                    {primaryAccount.display_name && (
                      <span className="font-medium">{primaryAccount.display_name} </span>
                    )}
                    <span className="text-muted-foreground">&lt;{primaryAccount.email}&gt;</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No account available</span>
                )}
              </span>
            </div>
          </div>

          {/* To */}
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@company.com"
              className="mt-1"
            />
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subjectField}
              onChange={(e) => setSubjectField(e.target.value)}
              placeholder="Email subject..."
              className="mt-1"
            />
          </div>

          {/* Body */}
          <div>
            <Label className="text-xs text-muted-foreground">Message</Label>
            <textarea
              value={bodyField}
              onChange={(e) => setBodyField(e.target.value)}
              placeholder="Write your email..."
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm min-h-[160px] bg-background resize-y"
            />
            <p className="text-[10px] text-muted-foreground mt-1">CAN-SPAM footer and your email signature will be added automatically.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !primaryAccount || loadingAccount}
            className="gap-1.5"
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
