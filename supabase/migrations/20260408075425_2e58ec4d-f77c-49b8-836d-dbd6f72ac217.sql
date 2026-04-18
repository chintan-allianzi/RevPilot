
-- Add profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_sales_nav_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Business Development Manager';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_link TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vertical_id UUID REFERENCES verticals(id),
  status TEXT DEFAULT 'draft',
  instantly_campaign_id TEXT,
  assigned_to UUID,
  contacts_count INTEGER DEFAULT 0,
  linkedin_tasks_count INTEGER DEFAULT 0,
  settings JSONB,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage campaigns" ON campaigns FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Create linkedin_tasks table
CREATE TABLE IF NOT EXISTS linkedin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT,
  vertical_id UUID REFERENCES verticals(id),
  task_type TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending',
  scheduled_date DATE,
  completed_at TIMESTAMPTZ,
  assigned_to UUID,
  contact_name TEXT,
  contact_title TEXT,
  contact_company TEXT,
  contact_linkedin_url TEXT,
  contact_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE linkedin_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage linkedin_tasks" ON linkedin_tasks FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_linkedin_tasks_assigned ON linkedin_tasks(assigned_to);
CREATE INDEX idx_linkedin_tasks_status ON linkedin_tasks(status, scheduled_date);
