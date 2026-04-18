/**
 * Apollo.io adapter — wraps existing apollo-api.ts and apollo-search.ts logic
 * into the common provider adapter interface.
 * After searching contacts, automatically runs bulk enrichment to get emails.
 */
import { CompanyIntelligence, ICPFilters } from "@/lib/company-types";
import {
  searchCompaniesViaProxy,
  searchDecisionMakers,
  enrichPerson,
  bulkEnrichPeople,
  normalizePerson,
  extractPeopleFromResponse,
} from "@/lib/apollo-api";
import { searchApolloCompanies } from "@/lib/apollo-search";

export interface ProviderSearchResult {
  provider: string;
  success: boolean;
  data: any[];
  error?: string;
  statusCode?: number;
  debug?: any;
}

export async function searchCompanies(apiKey: string, filters: ICPFilters): Promise<ProviderSearchResult> {
  try {
    const { companies, debug } = await searchApolloCompanies(apiKey, filters);
    return {
      provider: "apollo",
      success: companies.length > 0,
      data: companies,
      statusCode: 200,
      debug,
    };
  } catch (err: any) {
    const status = err.message?.includes("403") ? 403 : err.message?.includes("429") ? 429 : 500;
    return {
      provider: "apollo",
      success: false,
      data: [],
      error: err.message,
      statusCode: status,
    };
  }
}

export async function searchContacts(
  apiKey: string,
  domains: string[],
  titles: string[],
  perCompany: number
): Promise<ProviderSearchResult> {
  try {
    const result = await searchDecisionMakers({
      apiKey,
      companyDomains: domains,
      buyerPersonaTitles: titles,
      perCompany,
    });
    const authFailed = (result as any).authFailed === true;
    if (authFailed) {
      return {
        provider: "apollo",
        success: false,
        data: [],
        error: "Apollo API authentication failed (403). Check API key or plan.",
        statusCode: 403,
        debug: result.debug,
      };
    }

    let people = result.people;

    // Apollo search often returns contacts WITHOUT emails.
    // Run bulk enrichment to resolve actual email addresses.
    if (people.length > 0) {
      const enrichDetails = people.map((p: any) => {
        const person = p.person || p;
        const org = person.organization || p.organization || {};
        return {
          id: person.id || undefined,
          first_name: person.first_name || undefined,
          last_name: person.last_name || undefined,
          name: person.name || undefined,
          domain: org.primary_domain || org.domain || person.organization_domain || undefined,
          linkedin_url: person.linkedin_url || undefined,
        };
      }).filter((d: any) => d.id || d.linkedin_url || (d.first_name && d.domain));

      if (enrichDetails.length > 0) {
        try {
          const enrichResult = await bulkEnrichPeople({ apiKey, details: enrichDetails });

          // Merge enriched data back into search results
          if (enrichResult.matches.length > 0) {
            const enrichedById = new Map<string, any>();
            for (const match of enrichResult.matches) {
              if (match?.id) enrichedById.set(match.id, match);
            }

            people = people.map((p: any) => {
              const person = p.person || p;
              const enriched = enrichedById.get(person.id);
              if (enriched) {
                // Merge enriched fields into the original record
                return {
                  ...p,
                  ...(p.person ? {} : enriched),
                  person: p.person ? { ...p.person, ...enriched } : undefined,
                  email: enriched.email || person.email || undefined,
                  primary_email: enriched.primary_email || person.primary_email || undefined,
                  phone_number: enriched.phone_number || person.phone_number || undefined,
                  sanitized_phone: enriched.sanitized_phone || person.sanitized_phone || undefined,
                  last_name: enriched.last_name || person.last_name || undefined,
                  first_name: enriched.first_name || person.first_name || undefined,
                };
              }
              return p;
            });
          }

          // Add enrichment debug info
          const withEmailAfter = people.filter((p: any) => {
            const person = p.person || p;
            return person.email || person.primary_email;
          }).length;

          return {
            provider: "apollo",
            success: people.length > 0,
            data: people,
            statusCode: 200,
            debug: {
              searchDebug: result.debug,
              enrichDebug: enrichResult.debug,
              searchResultCount: result.people.length,
              enrichedCount: enrichResult.matches.length,
              withEmailAfterEnrich: withEmailAfter,
            },
          };
        } catch (enrichErr: any) {
          console.warn("Apollo bulk enrichment failed, returning search results only:", enrichErr.message);
        }
      }
    }

    return {
      provider: "apollo",
      success: people.length > 0,
      data: people,
      statusCode: 200,
      debug: result.debug,
    };
  } catch (err: any) {
    return {
      provider: "apollo",
      success: false,
      data: [],
      error: err.message,
      statusCode: 500,
    };
  }
}

export async function lookupEmail(
  apiKey: string,
  firstName: string,
  lastName: string,
  domain: string,
  personId?: string,
  linkedinUrl?: string
): Promise<ProviderSearchResult> {
  try {
    const person = await enrichPerson({
      apiKey,
      personId,
      firstName,
      lastName,
      organizationDomain: domain,
      linkedinUrl,
    });
    if (person?.email) {
      return { provider: "apollo", success: true, data: [person], statusCode: 200 };
    }
    return { provider: "apollo", success: false, data: [], statusCode: 200, error: "No email found" };
  } catch (err: any) {
    return { provider: "apollo", success: false, data: [], error: err.message, statusCode: 500 };
  }
}

export async function testConnection(
  apiKey: string
): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const { searchCompaniesViaProxy } = await import("@/lib/apollo-api");
    const result = await searchCompaniesViaProxy({
      apiKey,
      searchBody: { per_page: 1, page: 1 },
    });

    if (result.status === 401) {
      return { ok: false, status: 401, message: "Invalid API key" };
    }
    if (result.status === 403) {
      return { ok: false, status: 403, message: "API key doesn't have permission for people search. Please create a Master Key in Apollo (Settings → Integrations → API → toggle 'Set as master key')" };
    }
    if (!result.ok && result.status !== 200) {
      return { ok: false, status: result.status, message: `Connected but got error: ${result.status}. Key may be valid — try running a search in the Campaign Builder.` };
    }

    return { ok: result.ok, status: result.status, message: result.ok ? "Connected" : `Error ${result.status}` };
  } catch (err: any) {
    return { ok: false, status: 0, message: err.message };
  }
}
