export const MOCK_CAMPAIGNS = [
  { id: "1", name: "OB-NOC-SOC-Tier1-Apr2026", vertical: "NOC", status: "active", contacts: 48, sent: 192, opened: 87, replied: 12, bounced: 3 },
  { id: "2", name: "OB-HelpDesk-Tier1-Mar2026", vertical: "IT Help Desk", status: "active", contacts: 65, sent: 260, opened: 124, replied: 18, bounced: 5 },
  { id: "3", name: "OB-SOC-Tier2-Mar2026", vertical: "SOC", status: "paused", contacts: 32, sent: 96, opened: 41, replied: 6, bounced: 2 },
  { id: "4", name: "OB-Dev-Tier1-Feb2026", vertical: "Software Dev", status: "completed", contacts: 55, sent: 220, opened: 110, replied: 22, bounced: 4 },
];

export const MOCK_CONTACTS = [
  {
    id: "1", first_name: "Pradeep", last_name: "Nair", title: "Founding CTO", email: "pradeep@armada.ai", email_status: "verified",
    company: "Armada", domain: "armada.ai", industry: "Edge AI / Infrastructure", employees: "150", growth_12mo: 67.7, growth_24mo: 137.0,
    intent_level: "VERY HIGH", tier: "T1", intent_score: 85, linkedin_url: "linkedin.com/in/pradeepnair83/",
    vertical: "NOC+SOC", sequence_status: "step_2", linkedin_status: "not_sent",
    email_subject: "Armada's NOC+SOC team — 24/7 coverage at 65% less",
    linkedin_connection: "Hi Pradeep — I'm with Office Beacon, we help fast-growing tech companies build 24/7 NOC+SOC teams at 65% less than US staffing.",
  },
  {
    id: "2", first_name: "David", last_name: "Ftacnik", title: "Sr Dir IT, Network & Security Ops", email: "dftacnik@keepersecurity.com", email_status: "verified",
    company: "Keeper Security", domain: "keepersecurity.com", industry: "Cybersecurity / PAM", employees: "350", growth_12mo: 41.3, growth_24mo: 89.2,
    intent_level: "VERY HIGH", tier: "T1", intent_score: 72, linkedin_url: "linkedin.com/in/david-ftacnik-3a385435/",
    vertical: "SOC", sequence_status: "step_1", linkedin_status: "not_sent",
    email_subject: "Keeper Security's SOC team — 24/7 coverage at 65% less",
    linkedin_connection: "Hi David — noticed Keeper Security is scaling security ops. Office Beacon helps companies like yours build 24/7 SOC teams.",
  },
  {
    id: "3", first_name: "Shane", last_name: "Barney", title: "CISO", email: "sbarney@healthequity.com", email_status: "verified",
    company: "HealthEquity", domain: "healthequity.com", industry: "Fintech / Healthcare", employees: "3500", growth_12mo: 12.1, growth_24mo: 28.4,
    intent_level: "HIGH", tier: "T2", intent_score: 48, linkedin_url: "linkedin.com/in/shanebarney/",
    vertical: "SOC", sequence_status: "not_sent", linkedin_status: "not_sent",
    email_subject: "HealthEquity SOC — extend coverage without extending budget",
    linkedin_connection: "Hi Shane — I help CISOs build dedicated 24/7 SOC teams at a fraction of US staffing costs. SOC 2 compliant.",
  },
  {
    id: "4", first_name: "Maria", last_name: "Chen", title: "VP of IT", email: "mchen@acmetech.com", email_status: "pattern_match",
    company: "Acme Technologies", domain: "acmetech.com", industry: "SaaS", employees: "220", growth_12mo: 25.3, growth_24mo: 55.1,
    intent_level: "HIGH", tier: "T2", intent_score: 52, linkedin_url: "linkedin.com/in/mariachen/",
    vertical: "IT Help Desk", sequence_status: "step_3", linkedin_status: "connected",
    email_subject: "Acme Technologies — cut help desk costs 65% with dedicated remote team",
    linkedin_connection: "Hi Maria — your team at Acme is growing fast. Would love to share how we help VPs of IT scale support without scaling costs.",
  },
  {
    id: "5", first_name: "James", last_name: "Rodriguez", title: "Director of Engineering", email: "jrodriguez@cloudnative.io", email_status: "verified",
    company: "CloudNative", domain: "cloudnative.io", industry: "Cloud Infrastructure", employees: "180", growth_12mo: 44.2, growth_24mo: 102.0,
    intent_level: "VERY HIGH", tier: "T1", intent_score: 78, linkedin_url: "linkedin.com/in/jamesrodriguez-eng/",
    vertical: "Software Dev", sequence_status: "step_1", linkedin_status: "not_sent",
    email_subject: "CloudNative engineering — dedicated devs at 60% less",
    linkedin_connection: "Hi James — CloudNative's growth is impressive. We provide dedicated remote engineering teams that work exclusively on your codebase.",
  },
];

export const MOCK_LINKEDIN_TASKS = [
  { id: "1", contact: MOCK_CONTACTS[0], task_type: "connection_request", message: MOCK_CONTACTS[0].linkedin_connection, status: "pending", scheduled_date: "2026-04-07" },
  { id: "2", contact: MOCK_CONTACTS[1], task_type: "connection_request", message: MOCK_CONTACTS[1].linkedin_connection, status: "pending", scheduled_date: "2026-04-07" },
  { id: "3", contact: MOCK_CONTACTS[2], task_type: "connection_request", message: MOCK_CONTACTS[2].linkedin_connection, status: "pending", scheduled_date: "2026-04-07" },
  { id: "4", contact: MOCK_CONTACTS[3], task_type: "dm", message: "Thanks for connecting, Maria! I wanted to share a quick case study...", status: "pending", scheduled_date: "2026-04-07" },
  { id: "5", contact: MOCK_CONTACTS[4], task_type: "connection_request", message: MOCK_CONTACTS[4].linkedin_connection, status: "completed", scheduled_date: "2026-04-06" },
];
