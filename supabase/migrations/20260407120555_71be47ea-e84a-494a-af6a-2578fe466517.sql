
ALTER TABLE verticals 
  ADD COLUMN IF NOT EXISTS default_min_employees TEXT DEFAULT '51',
  ADD COLUMN IF NOT EXISTS default_max_employees TEXT DEFAULT '5001',
  ADD COLUMN IF NOT EXISTS default_min_revenue TEXT DEFAULT '10000000',
  ADD COLUMN IF NOT EXISTS default_max_revenue TEXT DEFAULT '1000000000',
  ADD COLUMN IF NOT EXISTS default_locations TEXT[] DEFAULT ARRAY['United States'];

UPDATE verticals SET 
  default_min_employees = '51',
  default_max_employees = '5001',
  default_min_revenue = '10000000',
  default_max_revenue = '1000000000',
  default_locations = ARRAY['United States']
WHERE name = 'IT Help Desk';

UPDATE verticals SET 
  default_min_employees = '201',
  default_max_employees = '5001',
  default_min_revenue = '50000000',
  default_max_revenue = '1000000000',
  default_locations = ARRAY['United States']
WHERE name = 'NOC';

UPDATE verticals SET 
  default_min_employees = '201',
  default_max_employees = '10001',
  default_min_revenue = '50000000',
  default_max_revenue = '1000000000',
  default_locations = ARRAY['United States']
WHERE name = 'SOC';

UPDATE verticals SET 
  default_min_employees = '51',
  default_max_employees = '5001',
  default_min_revenue = '10000000',
  default_max_revenue = '1000000000',
  default_locations = ARRAY['United States']
WHERE name = 'Software Dev';
