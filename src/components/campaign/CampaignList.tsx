import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Plus, Play, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CampaignRow {
  id: string;
  name: string;
  status: string | null;
  contacts_count: number | null;
  created_at: string | null;
  assigned_to: string | null;
  settings: any;
  vertical: { name: string } | null;
  assignee: { full_name: string } | null;
}

interface Props {
  onNewCampaign: () => void;
  onContinueCampaign: (campaignId: string, phase: number) => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-primary/15 text-primary border-primary/30",
};

export default function CampaignList({ onNewCampaign, onContinueCampaign }: Props) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select("id, name, status, contacts_count, created_at, assigned_to, settings, vertical:verticals(name)")
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch assignee names
      const assigneeIds = [...new Set((data as any[]).map((c) => c.assigned_to).filter(Boolean))];
      let assigneeMap: Record<string, string> = {};
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", assigneeIds);
        if (profiles) {
          assigneeMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
        }
      }

      setCampaigns(
        (data as any[]).map((c) => ({
          ...c,
          vertical: c.vertical,
          assignee: c.assigned_to ? { full_name: assigneeMap[c.assigned_to] || "Unknown" } : null,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { loadCampaigns(); }, []);

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    await supabase.from("campaigns").update({ name: renameName.trim() }).eq("id", renameId);
    toast.success("Campaign renamed");
    setRenameId(null);
    loadCampaigns();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("email_queue").delete().eq("campaign_id", deleteId);
    await supabase.from("campaigns").delete().eq("id", deleteId);
    toast.success("Campaign deleted");
    setDeleteId(null);
    setDeleting(false);
    loadCampaigns();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no campaigns, caller should skip to builder
  if (campaigns.length === 0) {
    // Signal parent — this shouldn't render but just in case
    return null;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={onNewCampaign} className="gap-2">
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const lastPhase = (c.settings as any)?.phase || 1;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.vertical?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] capitalize ${statusColors[c.status || "draft"] || statusColors.draft}`}>
                        {c.status || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.contacts_count || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.assignee?.full_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => onContinueCampaign(c.id, lastPhase)}
                        >
                          <Play className="h-3 w-3" /> Continue
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setRenameId(c.id); setRenameName(c.name); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Campaign</DialogTitle>
            <DialogDescription>Enter a new name for this campaign.</DialogDescription>
          </DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} placeholder="Campaign name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign and all associated queued emails. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
