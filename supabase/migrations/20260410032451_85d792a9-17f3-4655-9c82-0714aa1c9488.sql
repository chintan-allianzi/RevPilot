
CREATE TABLE public.email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_queue_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contact_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_positive BOOLEAN,
  sentiment TEXT,
  notes TEXT,
  assigned_to UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage replies"
  ON public.email_replies
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_email_replies_campaign ON public.email_replies(campaign_id);
CREATE INDEX idx_email_replies_read ON public.email_replies(is_read);
CREATE INDEX idx_email_replies_from_email ON public.email_replies(from_email);
