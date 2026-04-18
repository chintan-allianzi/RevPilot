export interface CompanyIntelligence {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: number;
  revenue: string;
  revenueRaw?: number;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  description: string;
  growth12mo: number;
  growth24mo: number;
  relevantJobPostings: string[];
  relevantJobCount: number;
  techStack: string[];
  linkedinUrl: string;
  logoUrl: string;
  apolloOrgId: string;

  // Basic scoring (instant, before AI)
  basicScore: number;
  basicTier: "T1" | "T2" | "T3" | "EXCLUDE";

  // AI enrichment (optional — populated after AI analysis)
  aiScore?: number;
  aiTier?: "T1" | "T2" | "T3" | "EXCLUDE";
  aiEnriched?: boolean;
  aiEnriching?: boolean;
  aiFailed?: boolean;
  intentSignals?: IntentSignal[];
  outsourcingReadiness?: OutsourcingReadiness;
  techStackMatch?: TechStackMatch;
  recommendedAngle?: string;
  riskFactors?: string[];
  tierReasoning?: string;
  aiEnrichment?: any;

  // Selection
  selected?: boolean;
}

export interface IntentSignal {
  signal: string;
  strength: "strong" | "moderate" | "weak";
  icon: "hiring" | "growth" | "tech" | "funding" | "news";
}

export interface OutsourcingReadiness {
  score: "high" | "medium" | "low";
  reasons: string[];
  remote_indicators: boolean;
}

export interface TechStackMatch {
  matched: string[];
  total_relevant: number;
  match_percentage: number;
}

export interface ICPFilters {
  jobTitles: string[];
  companyMinSize: string;
  companyMaxSize: string;
  revenueMin: string;
  revenueMax: string;
  locations: string[];
  industriesToInclude: string[];
  industriesToExclude: string[];
  buyerPersonas: string[];
  techStack: string[];
  growthSignals: {
    hiringRelevant: boolean;
    headcountGrowth: boolean;
    recentFunding: boolean;
    newOffices: boolean;
  };
  resultsLimit: number;
  page?: number;
}

export const COMPANY_SIZE_OPTIONS = [
  { value: "1", label: "1-10" },
  { value: "11", label: "11-50" },
  { value: "51", label: "51-200" },
  { value: "201", label: "201-500" },
  { value: "501", label: "501-1,000" },
  { value: "1001", label: "1,001-5,000" },
  { value: "5001", label: "5,001-10,000" },
  { value: "10001", label: "10,000+" },
];

export const REVENUE_OPTIONS = [
  { value: "0", label: "Under $1M" },
  { value: "1000000", label: "$1M-$10M" },
  { value: "10000000", label: "$10M-$50M" },
  { value: "50000000", label: "$50M-$100M" },
  { value: "100000000", label: "$100M-$500M" },
  { value: "500000000", label: "$500M-$1B" },
  { value: "1000000000", label: "$1B+" },
];

export const SUGGESTED_INDUSTRIES = [
  "Technology",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
];

export const COMMON_INDUSTRIES = [
  'Accounting',
  'Airlines/Aviation',
  'Automotive',
  'Aviation & Aerospace',
  'Banking',
  'Biotechnology',
  'Building Materials',
  'Chemical',
  'Civil Engineering',
  'Commercial Real Estate',
  'Computer Software',
  'Construction',
  'Consumer Electronics',
  'Consumer Goods',
  'Defense & Space',
  'E-Learning',
  'Education Management',
  'Electrical/Electronic Manufacturing',
  'Energy',
  'Entertainment',
  'Environmental Services',
  'Financial Services',
  'Food & Beverages',
  'Government Administration',
  'Health, Wellness and Fitness',
  'Higher Education',
  'Hospital & Health Care',
  'Hospitality',
  'Human Resources',
  'Import and Export',
  'Industrial Automation',
  'Information Technology and Services',
  'Insurance',
  'Internet',
  'Investment Banking',
  'Investment Management',
  'Law Practice',
  'Legal Services',
  'Leisure, Travel & Tourism',
  'Logistics and Supply Chain',
  'Luxury Goods & Jewelry',
  'Machinery',
  'Management Consulting',
  'Maritime',
  'Marketing and Advertising',
  'Mechanical or Industrial Engineering',
  'Media Production',
  'Medical Devices',
  'Medical Practice',
  'Mining & Metals',
  'Nonprofit Organization Management',
  'Oil & Energy',
  'Online Media',
  'Outsourcing/Offshoring',
  'Packaging and Containers',
  'Pharmaceuticals',
  'Plastics',
  'Primary/Secondary Education',
  'Printing',
  'Professional Training & Coaching',
  'Publishing',
  'Real Estate',
  'Renewables & Environment',
  'Research',
  'Restaurants',
  'Retail',
  'Security and Investigations',
  'Semiconductors',
  'Staffing and Recruiting',
  'Supermarkets',
  'Telecommunications',
  'Textiles',
  'Transportation/Trucking/Railroad',
  'Utilities',
  'Venture Capital & Private Equity',
  'Veterinary',
  'Warehousing',
  'Wholesale',
  'Wine and Spirits',
  'Wireless',
];
