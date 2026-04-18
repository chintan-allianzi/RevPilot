
-- Company settings for CAN-SPAM footer
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT 'Office Beacon',
  company_address TEXT DEFAULT '1234 Business Ave, Suite 100, New York, NY 10001',
  company_website TEXT DEFAULT 'https://officebeacon.com',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.company_settings (company_name, company_address, company_website)
VALUES ('Office Beacon', '1234 Business Ave, Suite 100, New York, NY 10001', 'https://officebeacon.com');

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read company_settings" ON public.company_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage company_settings" ON public.company_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Email opt-outs tracking
CREATE TABLE IF NOT EXISTS public.email_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'unsubscribed',
  opted_out_at TIMESTAMPTZ DEFAULT NOW(),
  contact_id TEXT,
  campaign_id UUID,
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.email_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage optouts" ON public.email_optouts
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can insert optouts" ON public.email_optouts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read optouts" ON public.email_optouts
  FOR SELECT USING (true);

CREATE INDEX idx_email_optouts_email ON public.email_optouts(email);

-- Add opt-out columns to saved_contacts
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE;
ALTER TABLE public.saved_contacts ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;
