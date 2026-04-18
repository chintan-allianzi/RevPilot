
-- Create verticals table
CREATE TABLE public.verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  savings TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  icon TEXT,
  job_titles_to_search TEXT[] DEFAULT '{}',
  buyer_personas TEXT[] DEFAULT '{}',
  us_cost_range TEXT,
  ob_cost_range TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  selling_points TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_companies table
CREATE TABLE public.saved_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  employees INTEGER,
  revenue TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  location TEXT,
  description TEXT,
  logo_url TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  apollo_org_id TEXT,
  founded_year INTEGER,
  growth_12mo DECIMAL,
  growth_24mo DECIMAL,
  tech_stack TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  basic_score INTEGER DEFAULT 0,
  basic_tier TEXT DEFAULT 'T3',
  ai_enrichment JSONB,
  ai_tier TEXT,
  ai_score INTEGER,
  is_enriched BOOLEAN DEFAULT FALSE,
  enriched_at TIMESTAMPTZ,
  status TEXT DEFAULT 'new',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, vertical_id)
);

CREATE INDEX idx_saved_companies_vertical ON public.saved_companies(vertical_id);
CREATE INDEX idx_saved_companies_status ON public.saved_companies(status);
CREATE INDEX idx_saved_companies_tier ON public.saved_companies(ai_tier);

-- Create saved_contacts table
CREATE TABLE public.saved_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.saved_companies(id) ON DELETE CASCADE,
  vertical_id UUID REFERENCES public.verticals(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  email TEXT,
  email_status TEXT,
  phone TEXT,
  linkedin_url TEXT,
  photo_url TEXT,
  apollo_person_id TEXT,
  email_subject TEXT,
  email_body TEXT,
  linkedin_connection TEXT,
  linkedin_dm TEXT,
  messages_generated BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'new',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, vertical_id)
);

CREATE INDEX idx_saved_contacts_company ON public.saved_contacts(company_id);
CREATE INDEX idx_saved_contacts_vertical ON public.saved_contacts(vertical_id);
CREATE INDEX idx_saved_contacts_status ON public.saved_contacts(status);

-- Enable RLS with permissive policies (no auth yet)
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for verticals" ON public.verticals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for saved_companies" ON public.saved_companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for saved_contacts" ON public.saved_contacts FOR ALL USING (true) WITH CHECK (true);

-- Seed default verticals
INSERT INTO public.verticals (name, description, savings, is_default, icon, job_titles_to_search, buyer_personas, us_cost_range, ob_cost_range, tech_stack, selling_points) VALUES
('IT Help Desk', 'L1/L2 support, ticket triage, password resets, 24/7 coverage', '65-70%', TRUE, 'headphones',
 ARRAY['help desk analyst', 'IT support specialist', 'desktop support', 'technical support'],
 ARRAY['VP IT', 'CIO', 'CTO', 'IT Director'],
 '$55K-$65K', '$12K-$20K',
 ARRAY['ServiceNow', 'Zendesk', 'Jira Service Management', 'Freshdesk'],
 ARRAY['24/7 help desk coverage at 65% less', 'L1/L2 ticket resolution', 'Trained on your tools and SLAs']),

('NOC', '24/7 network monitoring, alert triage, remote troubleshooting', '65-75%', TRUE, 'network',
 ARRAY['NOC analyst', 'NOC engineer', 'network monitoring', 'network operations'],
 ARRAY['VP IT', 'VP Infrastructure', 'CTO', 'Director of IT Operations'],
 '$50K-$90K', '$12K-$28K',
 ARRAY['SolarWinds', 'Nagios', 'PRTG', 'Datadog'],
 ARRAY['24/7 NOC coverage at 65-75% less', 'Alert triage and escalation', 'Remote troubleshooting']),

('SOC', '24/7 SIEM monitoring, threat detection, incident response', '65-75%', TRUE, 'shield',
 ARRAY['SOC analyst', 'SIEM analyst', 'threat analyst', 'security analyst'],
 ARRAY['CISO', 'VP Security', 'CTO', 'Director of Security'],
 '$55K-$140K', '$14K-$50K',
 ARRAY['Splunk', 'IBM QRadar', 'Microsoft Sentinel', 'CrowdStrike'],
 ARRAY['24/7 SOC monitoring at 65-75% less', 'SIEM management and tuning', 'Incident response and escalation']),

('Software Dev', 'Dedicated remote developers, your stack, your processes, your code reviews', '50-70%', TRUE, 'code',
 ARRAY['software engineer', 'full stack developer', 'devops engineer', 'backend developer'],
 ARRAY['CTO', 'VP Engineering', 'Director of Engineering', 'Head of Product'],
 '$120K-$180K', '$30K-$60K',
 ARRAY['GitHub', 'GitLab', 'Jira', 'VS Code'],
 ARRAY['Dedicated developers at 50-70% less', 'Full stack, DevOps, QA teams', 'Embedded in your processes']);
