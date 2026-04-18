import type { IntentConfiguration } from "@/components/campaign/IntentSignalsStep";

export interface CompanyData {
  organization_headcount_twelve_month_growth?: number;
  organization_headcount_twenty_four_month_growth?: number;
  relevant_job_count?: number;
  has_intent_signal_account?: boolean;
  intent_signal_account?: {
    domain_aggregates?: { domain: string }[];
  };
  industry?: string;
  organization_revenue?: number;
  naics_codes?: string[];
}

export interface IntentResult {
  level: string;
  tier: string;
  score: number;
  color: string;
}

const HIGH_NEED_INDUSTRIES = [
  "cybersecurity", "telecom", "data center", "fintech",
  "healthtech", "saas", "iot", "aerospace", "biotech",
];

/**
 * Original fixed scoring — used when no custom config is provided.
 */
export function calculateIntent(company: CompanyData): IntentResult {
  let score = 0;

  const staffingNaics = ["56131", "56132"];
  if (company.naics_codes?.some((n) => staffingNaics.includes(n))) {
    return { level: "EXCLUDED", tier: "SKIP", score: -1, color: "#9E9E9E" };
  }

  const g12 = (company.organization_headcount_twelve_month_growth ?? 0) * 100;
  const g24 = (company.organization_headcount_twenty_four_month_growth ?? 0) * 100;

  if (g12 >= 30) score += 40;
  else if (g12 >= 20) score += 30;
  else if (g12 >= 15) score += 25;
  else if (g12 >= 10) score += 20;
  else if (g12 >= 5) score += 10;
  else if (g12 < 0) score -= 5;

  if (g24 >= 50) score += 30;
  else if (g24 >= 30) score += 20;
  else if (g24 >= 15) score += 10;

  const relevantJobs = company.relevant_job_count ?? 0;
  if (relevantJobs >= 5) score += 20;
  else if (relevantJobs >= 3) score += 15;
  else if (relevantJobs >= 1) score += 10;

  if (company.has_intent_signal_account) {
    const intentData = company.intent_signal_account;
    if (intentData?.domain_aggregates?.some((d) => d.domain === "officebeacon.com")) {
      score += 25;
    }
  }

  if (HIGH_NEED_INDUSTRIES.some((i) => company.industry?.toLowerCase().includes(i))) {
    score += 10;
  }

  const rev = company.organization_revenue ?? 0;
  if (rev >= 200000000) score += 10;
  else if (rev >= 50000000) score += 5;

  if (score >= 60) return { level: "VERY HIGH", tier: "T1", score, color: "hsl(var(--tier-t1))" };
  if (score >= 35) return { level: "HIGH", tier: "T2", score, color: "hsl(var(--tier-t2))" };
  return { level: "MEDIUM", tier: "T3", score, color: "hsl(var(--tier-t3))" };
}

/**
 * Configurable scoring — uses the signal weights & thresholds from the Intent & Signals step.
 */
export function calculateConfigurableScore(
  company: { growth12mo: number; growth24mo: number; relevantJobCount: number; industry?: string },
  config: IntentConfiguration
): { score: number; tier: "T1" | "T2" | "T3" } {
  let score = 0;

  for (const signal of config.signals.filter((s) => s.enabled)) {
    switch (signal.id) {
      case "headcount_growth_12mo": {
        const g = company.growth12mo;
        const min = signal.config.minimumGrowth ?? 10;
        const bonus = signal.config.bonusThreshold ?? 25;
        if (g >= min) {
          score += signal.weight * Math.min(g / 50, 1);
          if (g >= bonus) score += signal.weight * 0.3;
        }
        break;
      }
      case "headcount_growth_24mo": {
        const g = company.growth24mo;
        const min = signal.config.minimumGrowth ?? 15;
        if (g >= min) {
          score += signal.weight * Math.min(g / 60, 1);
        }
        break;
      }
      case "active_job_postings": {
        const jobs = company.relevantJobCount;
        if (jobs >= 1) score += signal.weight * Math.min(jobs / 5, 1);
        break;
      }
      case "multiple_openings": {
        const min = signal.config.minimumOpenings ?? 3;
        if (company.relevantJobCount >= min) score += signal.weight;
        break;
      }
      case "industry_complexity": {
        const industries: string[] = signal.config.industries || [];
        if (industries.some((i) => company.industry?.toLowerCase().includes(i.toLowerCase()))) {
          score += signal.weight;
        }
        break;
      }
      // Other signals (remote_work, outsourcing, tech_stack, custom) are evaluated by AI enrichment
      default:
        break;
    }
  }

  score = Math.min(Math.round(score), 100);
  const tier: "T1" | "T2" | "T3" = score >= config.tierThresholds.t1 ? "T1" : score >= config.tierThresholds.t2 ? "T2" : "T3";
  return { score, tier };
}
