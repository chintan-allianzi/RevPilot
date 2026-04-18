export interface ICPConfig {
  apollo_job_titles: string[];
  buyer_titles: string[];
  buyer_seniorities: string[];
  roles_to_staff: string[];
  us_cost: string;
  ob_cost: string;
  savings: string;
  pitch: string;
  tools_to_reference: string[];
  exclude_industries: string[];
  company_size: string[];
  min_revenue: number;
  min_jobs: number;
}

export interface VerticalConfig {
  id: string;
  name: string;
  description: string;
  savings: string;
  isDefault: boolean;
  icon?: string;
  jobTitlesToSearch: string[];
  buyerPersonas: string[];
  usCostRange: string;
  obCostRange: string;
  techStack: string[];
  sellingPoints: string[];
  // Default ICP filter values
  defaultMinEmployees?: string;
  defaultMaxEmployees?: string;
  defaultMinRevenue?: string;
  defaultMaxRevenue?: string;
  defaultLocations?: string[];
  // Legacy fields for backward compatibility
  apollo_job_titles: string[];
  buyer_titles: string[];
  buyer_seniorities: string[];
  roles_to_staff: string[];
  us_cost: string;
  ob_cost: string;
  pitch: string;
  tools_to_reference: string[];
  exclude_industries: string[];
  company_size: string[];
  min_revenue: number;
  min_jobs: number;
}

function icpToVertical(name: string, icp: ICPConfig, icon?: string): VerticalConfig {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    description: icp.pitch,
    savings: icp.savings,
    isDefault: true,
    icon,
    jobTitlesToSearch: [...icp.apollo_job_titles],
    buyerPersonas: [...icp.buyer_titles],
    usCostRange: icp.us_cost,
    obCostRange: icp.ob_cost,
    techStack: [...icp.tools_to_reference],
    sellingPoints: [],
    // Legacy
    apollo_job_titles: icp.apollo_job_titles,
    buyer_titles: icp.buyer_titles,
    buyer_seniorities: icp.buyer_seniorities,
    roles_to_staff: icp.roles_to_staff,
    us_cost: icp.us_cost,
    ob_cost: icp.ob_cost,
    pitch: icp.pitch,
    tools_to_reference: icp.tools_to_reference,
    exclude_industries: icp.exclude_industries,
    company_size: icp.company_size,
    min_revenue: icp.min_revenue,
    min_jobs: icp.min_jobs,
  };
}

export const ICP_CONFIG: Record<string, ICPConfig> = {
  "IT Help Desk": {
    apollo_job_titles: ["help desk", "IT support", "technical support", "desktop support", "service desk", "IT help desk"],
    buyer_titles: ["VP IT", "IT Director", "Director of IT", "Head of IT", "CIO", "VP Operations", "COO", "CTO"],
    buyer_seniorities: ["c_suite", "vp", "director"],
    roles_to_staff: ["Help Desk Analyst", "Service Desk Analyst", "Desktop Support", "IT Support Specialist", "L1/L2 Tech Support"],
    us_cost: "$55K-$65K + benefits",
    ob_cost: "$12K-$20K all-in",
    savings: "65-70%",
    pitch: "L1/L2 support, ticket triage, password resets, 24/7 coverage",
    tools_to_reference: ["ServiceNow", "Zendesk", "Jira Service Management", "Freshdesk"],
    exclude_industries: ["staffing", "recruiting", "employment services"],
    company_size: ["51,200", "201,500", "501,1000"],
    min_revenue: 5000000,
    min_jobs: 3,
  },
  "NOC": {
    apollo_job_titles: ["NOC analyst", "NOC engineer", "NOC technician", "network operations center", "NOC support", "network monitoring"],
    buyer_titles: ["VP IT", "VP Infrastructure", "Director Network Ops", "CTO", "VP Engineering", "Director of IT", "Head of IT Ops"],
    buyer_seniorities: ["c_suite", "vp", "director"],
    roles_to_staff: ["NOC L1 Analyst", "NOC L2 Engineer", "NOC L3 Engineer", "Network Monitoring Analyst", "NOC Shift Lead"],
    us_cost: "$50K-$90K + benefits",
    ob_cost: "$12K-$28K all-in",
    savings: "65-75%",
    pitch: "24/7 network monitoring, alert triage, remote troubleshooting",
    tools_to_reference: ["SolarWinds", "Nagios", "PRTG", "Datadog", "Zabbix", "PagerDuty"],
    exclude_industries: ["staffing", "recruiting"],
    company_size: ["51,200", "201,500", "501,1000"],
    min_revenue: 5000000,
    min_jobs: 3,
  },
  "SOC": {
    apollo_job_titles: ["SOC analyst", "SOC engineer", "security operations center", "SOC support", "SIEM analyst", "threat analyst", "security operations", "incident response analyst"],
    buyer_titles: ["CISO", "VP Security", "Director of Security Operations", "Head of InfoSec", "Chief Information Security Officer", "VP IT Security", "CTO"],
    buyer_seniorities: ["c_suite", "vp", "director"],
    roles_to_staff: ["SOC L1 Analyst", "SOC L2 Analyst", "SOC L3 Threat Hunter", "SIEM Administrator", "Incident Response Analyst", "Vulnerability Analyst"],
    us_cost: "$55K-$140K + benefits",
    ob_cost: "$14K-$50K all-in",
    savings: "65-75%",
    pitch: "24/7 SIEM monitoring, threat detection, incident response",
    tools_to_reference: ["Splunk", "IBM QRadar", "Microsoft Sentinel", "CrowdStrike", "SentinelOne", "Palo Alto Cortex XSOAR", "Rapid7 InsightIDR"],
    exclude_industries: ["staffing", "recruiting"],
    company_size: ["51,200", "201,500", "501,1000"],
    min_revenue: 5000000,
    min_jobs: 3,
  },
  "Software Dev": {
    apollo_job_titles: ["software engineer", "full stack developer", "frontend developer", "backend developer", "devops engineer", "data engineer", "mobile developer", "QA engineer"],
    buyer_titles: ["CTO", "VP Engineering", "Director of Engineering", "VP Technology", "Head of Engineering"],
    buyer_seniorities: ["c_suite", "vp", "director"],
    roles_to_staff: ["Full Stack Developer", "Frontend Developer", "Backend Developer", "DevOps Engineer", "Mobile Developer", "Data Engineer", "QA Engineer"],
    us_cost: "$120K-$180K + benefits",
    ob_cost: "$30K-$60K all-in",
    savings: "50-70%",
    pitch: "Dedicated remote developers, your stack, your processes, your code reviews",
    tools_to_reference: ["GitHub", "GitLab", "Jira", "VS Code", "AWS", "Azure", "Docker", "Kubernetes"],
    exclude_industries: ["staffing", "recruiting"],
    company_size: ["51,200", "201,500"],
    min_revenue: 5000000,
    min_jobs: 3,
  },
};

export const DEFAULT_VERTICALS: VerticalConfig[] = [
  icpToVertical("IT Help Desk", ICP_CONFIG["IT Help Desk"], "headphones"),
  icpToVertical("NOC", ICP_CONFIG["NOC"], "network"),
  icpToVertical("SOC", ICP_CONFIG["SOC"], "shield"),
  icpToVertical("Software Dev", ICP_CONFIG["Software Dev"], "code"),
];

export const VERTICALS = Object.keys(ICP_CONFIG);
