import { supabase } from "@/integrations/supabase/client";

/**
 * Check and enqueue nurture sequences when a deal moves to a new stage.
 * Call this after any stage transition (Kanban drag, dropdown, etc.)
 */
export async function triggerNurtureSequences(
  dealId: string,
  newStageId: string,
  deal: { contact_id: string | null; assigned_to: string | null; vertical_id: string | null },
  isClosedLost: boolean
) {
  // If closed_lost → cancel ALL pending nurture entries for this deal
  if (isClosedLost) {
    await supabase
      .from("nurture_queue" as any)
      .update({ status: "cancelled" } as any)
      .eq("deal_id", dealId)
      .eq("status", "scheduled");
    return;
  }

  if (!deal.contact_id) return;

  // Find active sequences triggered by this stage
  let query = supabase
    .from("nurture_sequences" as any)
    .select("id, vertical_id")
    .eq("trigger_stage", newStageId)
    .eq("is_active", true);

  const { data: sequences } = await query;
  if (!sequences || sequences.length === 0) return;

  // Filter by vertical (null vertical_id = applies to all)
  const applicable = (sequences as any[]).filter(
    (s: any) => !s.vertical_id || s.vertical_id === deal.vertical_id
  );

  if (applicable.length === 0) return;

  // Get BDM's primary email account
  let emailAccountId: string | null = null;
  if (deal.assigned_to) {
    const { data: account } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("user_id", deal.assigned_to)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    emailAccountId = account?.id || null;
  }

  for (const seq of applicable) {
    // Check if already triggered for this deal
    const { data: existing } = await supabase
      .from("nurture_queue" as any)
      .select("id")
      .eq("deal_id", dealId)
      .in("step_id", [] as string[]) // we need to check via sequence
      .limit(1);

    // More reliable: check via steps of this sequence
    const { data: steps } = await supabase
      .from("nurture_steps" as any)
      .select("id, step_order, delay_days")
      .eq("sequence_id", (seq as any).id)
      .order("step_order");

    if (!steps || steps.length === 0) continue;

    const stepIds = (steps as any[]).map((s: any) => s.id);
    const { data: alreadyQueued } = await supabase
      .from("nurture_queue" as any)
      .select("id")
      .eq("deal_id", dealId)
      .in("step_id", stepIds)
      .limit(1);

    if (alreadyQueued && alreadyQueued.length > 0) continue;

    // Enqueue all steps
    const now = new Date();
    const entries = (steps as any[]).map((step: any) => {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + step.delay_days);
      return {
        deal_id: dealId,
        step_id: step.id,
        contact_id: deal.contact_id,
        email_account_id: emailAccountId,
        scheduled_at: scheduledAt.toISOString(),
        status: "scheduled",
      };
    });

    await supabase.from("nurture_queue" as any).insert(entries);
  }
}

/**
 * Cancel pending nurture entries for skipped sequences.
 * When a deal jumps past a trigger stage, cancel entries from sequences that were triggered by
 * stages between the old and new stage.
 */
export async function cancelSkippedNurtureEntries(
  dealId: string,
  fromStageOrder: number,
  toStageOrder: number,
  stages: { id: string; stage_order: number }[]
) {
  // Find stages that were skipped (between from and to)
  const skippedStageIds = stages
    .filter((s) => s.stage_order > fromStageOrder && s.stage_order < toStageOrder)
    .map((s) => s.id);

  if (skippedStageIds.length === 0) return;

  // Find sequences triggered by skipped stages
  const { data: skippedSeqs } = await supabase
    .from("nurture_sequences" as any)
    .select("id")
    .in("trigger_stage", skippedStageIds);

  if (!skippedSeqs || skippedSeqs.length === 0) return;

  const seqIds = (skippedSeqs as any[]).map((s: any) => s.id);

  // Find steps from those sequences
  const { data: stepsToCancel } = await supabase
    .from("nurture_steps" as any)
    .select("id")
    .in("sequence_id", seqIds);

  if (!stepsToCancel || stepsToCancel.length === 0) return;

  const stepIds = (stepsToCancel as any[]).map((s: any) => s.id);

  await supabase
    .from("nurture_queue" as any)
    .update({ status: "cancelled" } as any)
    .eq("deal_id", dealId)
    .in("step_id", stepIds)
    .eq("status", "scheduled");
}
