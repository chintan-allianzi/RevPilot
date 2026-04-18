import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, profile, isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [calendarLink, setCalendarLink] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [salesNavUrl, setSalesNavUrl] = useState("");
  const [emailSignature, setEmailSignature] = useState("");

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name || "");
        setTitle((data as any).title || "Business Development Manager");
        setPhone((data as any).phone || "");
        setCalendarLink((data as any).calendar_link || "");
        setLinkedinUrl((data as any).linkedin_url || "");
        setSalesNavUrl((data as any).linkedin_sales_nav_url || "");
        setEmailSignature((data as any).email_signature || "");
      });
  }, [open, user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        title,
        phone,
        calendar_link: calendarLink,
        linkedin_url: linkedinUrl,
        linkedin_sales_nav_url: salesNavUrl,
        email_signature: emailSignature,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", user.id);

    setSaving(false);
    if (error) toast.error("Failed to save profile");
    else {
      toast.success("Profile updated");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
            {fullName?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-medium">{fullName || "User"}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {isAdmin ? "Admin" : "BDM"}
              </Badge>
              <span className="text-xs text-muted-foreground">{profile?.email}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+1 555 123 4567" />
            </div>
            <div>
              <Label className="text-xs">Calendar Link</Label>
              <Input value={calendarLink} onChange={(e) => setCalendarLink(e.target.value)} className="mt-1" placeholder="https://calendly.com/..." />
            </div>
          </div>

          <div>
            <Label className="text-xs">LinkedIn Profile</Label>
            <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="mt-1" placeholder="https://linkedin.com/in/..." />
          </div>

          <div>
            <Label className="text-xs">Sales Navigator URL</Label>
            <Input value={salesNavUrl} onChange={(e) => setSalesNavUrl(e.target.value)} className="mt-1" placeholder="https://linkedin.com/sales/..." />
          </div>

          <div>
            <Label className="text-xs">Email Signature</Label>
            <textarea
              value={emailSignature}
              onChange={(e) => setEmailSignature(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm min-h-[80px] bg-background"
              placeholder={"Best regards,\nYour Name\nOffice Beacon | officebeacon.com"}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
