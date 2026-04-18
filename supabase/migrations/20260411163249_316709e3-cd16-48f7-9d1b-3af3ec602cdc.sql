
-- Create data_providers table
CREATE TABLE public.data_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_key text NOT NULL UNIQUE,
  provider_name text NOT NULL,
  provider_type text[] NOT NULL DEFAULT '{}',
  api_key text,
  is_active boolean NOT NULL DEFAULT false,
  priority_order integer NOT NULL DEFAULT 99,
  config jsonb,
  last_health_check timestamptz,
  health_status text NOT NULL DEFAULT 'unchecked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_providers ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins manage data_providers"
ON public.data_providers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated can read
CREATE POLICY "Auth read data_providers"
ON public.data_providers
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Seed default providers
INSERT INTO public.data_providers (provider_key, provider_name, provider_type, priority_order, is_active) VALUES
  ('apollo', 'Apollo.io', ARRAY['company_search','company_enrichment','contact_search','contact_enrichment','email_lookup'], 1, false),
  ('clay', 'Clay', ARRAY['company_enrichment','contact_search','contact_enrichment','email_lookup'], 2, false),
  ('seamless_ai', 'Seamless.AI', ARRAY['contact_search','contact_enrichment','email_lookup'], 3, false),
  ('zoominfo', 'ZoomInfo', ARRAY['company_search','company_enrichment','contact_search','contact_enrichment','email_lookup'], 4, false);
