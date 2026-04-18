
-- 1. lead_stages reference table
CREATE TABLE public.lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key text UNIQUE NOT NULL,
  stage_name text NOT NULL,
  stage_order integer NOT NULL,
  stage_type text NOT NULL CHECK (stage_type IN ('lead', 'opportunity', 'closed')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read lead_stages" ON public.lead_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lead_stages" ON public.lead_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed lead_stages
INSERT INTO public.lead_stages (stage_key, stage_name, stage_order, stage_type, description) VALUES
  ('new_lead', 'New Lead', 1, 'lead', 'Outbound reply received, not yet qualified'),
  ('mql', 'Marketing Qualified Lead', 2, 'lead', 'Showed interest (positive reply, clicked, engaged)'),
  ('sal', 'Sales Accepted Lead', 3, 'lead', 'BDM accepted and began outreach'),
  ('meeting_scheduled', 'Meeting Scheduled', 4, 'opportunity', 'Discovery/intro call booked'),
  ('meeting_completed', 'Meeting Completed', 5, 'opportunity', 'Discovery call done, evaluating fit'),
  ('sql', 'Sales Qualified Lead', 6, 'opportunity', 'Confirmed need, budget, authority, timeline'),
  ('proposal_sent', 'Proposal Sent', 7, 'opportunity', 'Pricing/proposal delivered'),
  ('negotiation', 'Negotiation', 8, 'opportunity', 'Terms being discussed'),
  ('closed_won', 'Closed Won', 9, 'closed', 'Deal signed'),
  ('closed_lost', 'Closed Lost', 10, 'closed', 'Deal lost — capture reason');

-- 2. deals table
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.saved_contacts(id),
  company_id uuid REFERENCES public.saved_companies(id),
  campaign_id uuid REFERENCES public.campaigns(id),
  vertical_id uuid REFERENCES public.verticals(id),
  stage_id uuid NOT NULL REFERENCES public.lead_stages(id),
  deal_name text NOT NULL,
  deal_value numeric,
  currency text NOT NULL DEFAULT 'USD',
  expected_close_date date,
  assigned_to uuid,
  lost_reason text,
  won_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read deals" ON public.deals FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update deals" ON public.deals FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete deals" ON public.deals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at trigger for deals
CREATE OR REPLACE FUNCTION public.update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_deals_updated_at();

-- 3. deal_stage_history table
CREATE TABLE public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.lead_stages(id),
  to_stage_id uuid NOT NULL REFERENCES public.lead_stages(id),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  time_in_previous_stage_hours numeric
);

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read deal_stage_history" ON public.deal_stage_history FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert deal_stage_history" ON public.deal_stage_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 4. deal_activities table
CREATE TABLE public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  subject text,
  description text,
  activity_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  metadata jsonb
);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read deal_activities" ON public.deal_activities FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert deal_activities" ON public.deal_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update deal_activities" ON public.deal_activities FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete deal_activities" ON public.deal_activities FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. deal_tasks table
CREATE TABLE public.deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date timestamptz NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  assigned_to uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read deal_tasks" ON public.deal_tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert deal_tasks" ON public.deal_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update deal_tasks" ON public.deal_tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete deal_tasks" ON public.deal_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
