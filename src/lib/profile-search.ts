import type { LinkKey } from "@/types/profile";

/* "Find" on My Profile › Scholar & professional profiles: look a person up by name (the prototype's shared/profileSearch.js).
   ORCID and OpenAlex have public search APIs the browser can call, so those return real matches to pick from.
   Everything else has no public search the browser can use, so Find opens that site's own people search with the name
   filled in; the person copies their profile link from there and pastes it back. */

const enc = encodeURIComponent;

const SEARCH_URL: Record<LinkKey, (q: string) => string> = {
  orcidId: (q) => `https://orcid.org/orcid-search/search?searchQuery=${enc(q)}`,
  dblpUrl: (q) => `https://dblp.org/search?q=${enc(q)}`,
  openAlexUrl: (q) => `https://api.openalex.org/authors?search=${enc(q)}`,
  researchGateUrl: (q) => `https://www.researchgate.net/search/researcher?q=${enc(q)}`,
  googleScholarUrl: (q) => `https://scholar.google.com/citations?view_op=search_authors&mauthors=${enc(q)}`,
  scopusId: () => "https://www.scopus.com/freelookup/form/author.uri",
  linkedinUrl: (q) => `https://www.linkedin.com/search/results/people/?keywords=${enc(q)}`,
  youtubeUrl: (q) => `https://www.youtube.com/results?search_query=${enc(q)}&sp=EgIQAg%253D%253D`,
  facebookUrl: (q) => `https://www.facebook.com/search/people/?q=${enc(q)}`,
  twitterUrl: (q) => `https://x.com/search?q=${enc(q)}&f=user`,
  githubUrl: (q) => `https://github.com/search?q=${enc(q)}&type=users`,
};
export const profileSearchUrl = (key: LinkKey, query: string): string => SEARCH_URL[key](query);

/** Which platforms can be searched inside the app. */
export const CAN_SEARCH_IN_APP = new Set<LinkKey>(["orcidId", "openAlexUrl"]);

export interface ProfileMatch { name: string; detail: string; value: string }

async function getJson(url: string, init: { signal?: AbortSignal; headers?: Record<string, string> } = {}): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`The search service answered ${res.status}.`);
  return res.json();
}

type Rec = Record<string, unknown>;
const SEARCHERS: Partial<Record<LinkKey, (q: string, opts: { signal?: AbortSignal }) => Promise<ProfileMatch[]>>> = {
  async openAlexUrl(q, opts) {
    const data = (await getJson(`https://api.openalex.org/authors?search=${enc(q)}&per-page=6`, opts)) as { results?: Rec[] };
    return (data.results ?? []).map((a) => {
      const inst = ((a.last_known_institutions as Rec[] | undefined)?.[0] ?? a.last_known_institution) as Rec | undefined;
      return {
        name: String(a.display_name ?? ""),
        detail: [inst?.display_name, `${a.works_count ?? 0} works`, `${a.cited_by_count ?? 0} citations`].filter(Boolean).join(" · "),
        value: String(a.id ?? "").replace("https://openalex.org/", "https://openalex.org/authors/"),
      };
    });
  },
  async orcidId(q, opts) {
    const data = (await getJson(`https://pub.orcid.org/v3.0/expanded-search/?q=${enc(q)}&start=0&rows=6`, { ...opts, headers: { Accept: "application/json" } })) as { "expanded-result"?: Rec[] };
    return (data["expanded-result"] ?? []).map((r) => ({
      name: [r["given-names"], r["family-names"]].filter(Boolean).join(" ") || String(r["orcid-id"] ?? ""),
      detail: [((r["institution-name"] as string[] | undefined) ?? []).slice(0, 2).join(", "), r["orcid-id"]].filter(Boolean).join(" · "),
      value: String(r["orcid-id"] ?? ""),
    }));
  },
};

/** `query` → matches, where `value` is what gets saved in the profile field. Throws when the service can't be reached. */
export async function searchProfiles(key: LinkKey, query: string, opts: { signal?: AbortSignal } = {}): Promise<ProfileMatch[]> {
  const run = SEARCHERS[key];
  if (!run) return [];
  return (await run(query.trim(), opts)).filter((r) => r.name && r.value);
}
