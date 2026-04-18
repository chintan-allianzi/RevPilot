
-- Nurture Sequences
CREATE TABLE public.nurture_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_stage uuid NOT NULL REFERENCES public.lead_stages(id),
  vertical_id uuid REFERENCES public.verticals(id),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nurture_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read nurture_sequences" ON public.nurture_sequences FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert nurture_sequences" ON public.nurture_sequences FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update nurture_sequences" ON public.nurture_sequences FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete nurture_sequences" ON public.nurture_sequences FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Nurture Steps
CREATE TABLE public.nurture_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.nurture_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin_message', 'task')),
  subject_template text,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nurture_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read nurture_steps" ON public.nurture_steps FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert nurture_steps" ON public.nurture_steps FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update nurture_steps" ON public.nurture_steps FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete nurture_steps" ON public.nurture_steps FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Nurture Queue
CREATE TABLE public.nurture_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.nurture_steps(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.saved_contacts(id),
  email_account_id uuid REFERENCES public.email_accounts(id),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nurture_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read nurture_queue" ON public.nurture_queue FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert nurture_queue" ON public.nurture_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update nurture_queue" ON public.nurture_queue FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete nurture_queue" ON public.nurture_queue FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
