import { normalizeInstitution } from "@/lib/institutions";
import type { ChairConference, ChairPaper, DecisionType } from "@/types/chair";
import type { Conference } from "@/types/conference";
import type { Tone } from "./chart-theme";

/* What the Analytics page shows (the prototype's src/chair-analytics/data.js). The prototype draws a hand-written sample for one conference
   and a small aggregate for the rest; here EVERYTHING is computed from the conference's own submitted papers (as its chair sees them), so
   nothing is made up. What the database does not hold stays `null`, and its tab shows the prototype's empty state:
   - rounds (the CFP has no rounds), master data (no shared author / organisation database) and multi-year trends (a conference here is one
     edition) have no data;
   - countries, institutions, regions and authors come from the authors' declared country and affiliation, so they are only as complete as
     what authors typed. A paper whose authors gave no country is left out of the country, region and domestic / international figures. */

export interface Summary {
  totalPapers: number; uniqueAuthors: number; countries: number | null; organizations: number | null;
  accepted: number; rejected: number; conditionallyAccepted: number; awaitingDecision: number; underReview: number;
  acceptanceRate: number;
  domesticPapers: number | null; internationalPapers: number | null; domesticPct: number | null; internationalPct: number | null;
  domesticAccepted: number; internationalAccepted: number; domesticRejected: number; internationalRejected: number;
  domesticAcceptRate: number; internationalAcceptRate: number;
  domesticCountry: string;
}
export interface DecisionRow { label: string; count: number; tone: Tone }
export interface KeywordRow { keyword: string; count: number }
export interface AuthorStats {
  unique: number; repeatAuthors: number; repeatAuthorsPct: number;
  avgAuthorsPerPaper: number; maxAuthorsOnPaper: number;
  singleAuthorPapers: number; singleAuthorPapersPct: number; multiAuthorPapers: number;
  avgSubmissionsPerAuthor: number; maxSubmissionsByAuthor: number;
  singlePaperAuthors: number; multiPaperAuthors: number;
  submissionsPerAuthorHistogram: Array<{ bucket: string; authors: number }>;
  authorsPerSubmissionHistogram: Array<{ bucket: string; papers: number }>;
}
export interface InstitutionRow { rank: number; name: string; country: string; submitted: number; accepted: number }
export interface CountryRow { country: string; region: string; papersSubmitted: number; papersAccepted: number; affiliations: number; acceptanceRate: number; authorsSubmitted: number; authorsAccepted: number }
export interface RegionRow { region: string; papersSubmitted: number; papersAccepted: number; countries: number; acceptanceRate: number; sharePct: number; authorsSubmitted: number; authorsAccepted: number }

export interface AnalyticsData {
  summary: Summary;
  submissionsOverTime: Array<{ date: string; cumulative: number }> | null;
  peakDay: { date: string; count: number } | null;
  submissionWindowDays: number;
  submissionsPerDay: Array<{ date: string; count: number }> | null;
  decisionBreakdown: DecisionRow[];
  topKeywords: KeywordRow[];
  keywordStats: { listed: number; unique: number; mentions: number } | null;
  authors: AuthorStats | null;
  institutions: { unique: number; domestic: number; international: number; table: InstitutionRow[] } | null;
  countries: { unique: number; leadingCountry: { country: string; papers: number; sharePct: number }; table: CountryRow[] } | null;
  region: { regionsWithPapers: number; leadingRegion: { region: string; papers: number; sharePct: number }; table: RegionRow[] } | null;
}

/* The prototype's loose regional grouping (India kept as its own region, being the host of most of its conferences). Anything not listed is "Other". */
const REGIONS: Record<string, string[]> = {
  India: ["India"],
  China: ["China", "Hong Kong", "Macao", "Macau"],
  Russia: ["Russia"],
  "South & Southeast Asia": ["Afghanistan", "Bangladesh", "Bhutan", "Maldives", "Nepal", "Pakistan", "Sri Lanka", "Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines", "Singapore", "Thailand", "Timor-Leste", "Vietnam"],
  "North Asia": ["Japan", "Taiwan", "South Korea", "North Korea", "Mongolia"],
  "Middle East": ["Bahrain", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey", "United Arab Emirates", "Yemen"],
  "North America": ["United States", "Canada", "Mexico", "Belize", "Costa Rica", "El Salvador", "Guatemala", "Honduras", "Nicaragua", "Panama", "Cuba", "Dominican Republic", "Haiti", "Jamaica", "Trinidad and Tobago", "Bahamas", "Barbados"],
  "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"],
  "CIS Countries": ["Armenia", "Azerbaijan", "Belarus", "Kazakhstan", "Kyrgyzstan", "Moldova", "Tajikistan", "Turkmenistan", "Uzbekistan"],
  "Australia & New Zealand": ["Australia", "New Zealand"],
  Africa: ["Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Chad", "Congo", "Egypt", "Eritrea", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Senegal", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"],
  Europe: ["Albania", "Andorra", "Austria", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City"],
};
const REGION_OF: Record<string, string> = Object.fromEntries(Object.entries(REGIONS).flatMap(([region, list]) => list.map((c) => [c, region])));
export const regionOf = (country: string): string => REGION_OF[country] ?? "Other";

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const rate = (part: number, whole: number) => (whole ? round1((part / whole) * 100) : 0);
const authorKey = (a: { email: string; name: string }) => (a.email.trim().toLowerCase() || a.name.trim().toLowerCase());
const dayOf = (label: string | null): Date | null => {
  if (!label) return null;
  const d = new Date(label);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const shortDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const mostCommon = (counts: Map<string, number>): string => [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

type Decision = "Accepted" | "Conditional Accept" | "Rejected" | "Hold" | "Revision" | "Flag Clear" | "No Decision Yet";
function decisionOf(p: ChairPaper, types: DecisionType[]): Decision {
  const label = types.find((t) => t.id === p.decisionTypeId)?.label ?? "";
  switch (p.outcome) {
    case "accept": case "registered": return /conditional/i.test(label) ? "Conditional Accept" : "Accepted";
    case "reject": return "Rejected";
    case "revise": return "Revision";
    case "waitlist": return "Hold";
    case "plagiarism_clear": return "Flag Clear";
    default: return "No Decision Yet";
  }
}

export function buildAnalytics(data: ChairConference, conference: Conference): AnalyticsData {
  const papers = data.papers.filter((p) => !p.withdrawn);
  const verdict = new Map(papers.map((p) => [p.dbId, decisionOf(p, data.decisionTypes)]));
  const isAccepted = (p: ChairPaper) => verdict.get(p.dbId) === "Accepted";
  const count = (d: Decision) => papers.filter((p) => verdict.get(p.dbId) === d).length;
  const total = papers.length;
  const accepted = count("Accepted");
  const rejected = count("Rejected");
  const conditional = count("Conditional Accept");

  const authorKeys = new Set(papers.flatMap((p) => p.authors.map(authorKey)));
  const countriesOf = (p: ChairPaper) => [...new Set(p.authors.map((a) => a.country.trim()).filter(Boolean))];
  const hasCountry = papers.some((p) => countriesOf(p).length > 0);
  const host = conference.country.trim();

  // Domestic = the paper's lead author (the corresponding author, else the first) is from the conference's country.
  const lead = (p: ChairPaper) => (p.authors.find((a) => a.corresponding) ?? p.authors[0])?.country.trim() ?? "";
  const known = papers.filter((p) => lead(p));
  const domestic = hasCountry && host ? known.filter((p) => lead(p) === host) : null;
  const international = hasCountry && host ? known.filter((p) => lead(p) !== host) : null;
  const split = (list: ChairPaper[] | null) => ({
    accepted: list ? list.filter(isAccepted).length : 0,
    rejected: list ? list.filter((p) => verdict.get(p.dbId) === "Rejected").length : 0,
  });
  const dom = split(domestic);
  const intl = split(international);

  // Organisations: authors' affiliations, grouped the way the institution search treats them (case / punctuation ignored).
  const affiliationKeys = new Set(papers.flatMap((p) => p.authors.map((a) => normalizeInstitution(a.affiliation))).filter(Boolean));

  const summary: Summary = {
    totalPapers: total, uniqueAuthors: authorKeys.size, countries: hasCountry ? new Set(papers.flatMap(countriesOf)).size : null, organizations: affiliationKeys.size || null,
    accepted, rejected, conditionallyAccepted: conditional, awaitingDecision: 0, underReview: total - accepted - rejected - conditional,
    acceptanceRate: rate(accepted, accepted + rejected),
    domesticPapers: domestic ? domestic.length : null, internationalPapers: international ? international.length : null,
    domesticPct: domestic && known.length ? rate(domestic.length, known.length) : domestic ? 0 : null,
    internationalPct: international && known.length ? rate(international.length, known.length) : international ? 0 : null,
    domesticAccepted: dom.accepted, internationalAccepted: intl.accepted, domesticRejected: dom.rejected, internationalRejected: intl.rejected,
    domesticAcceptRate: rate(dom.accepted, dom.accepted + dom.rejected), internationalAcceptRate: rate(intl.accepted, intl.accepted + intl.rejected),
    domesticCountry: host,
  };

  // Submissions over time and per day (from the date each paper was submitted).
  const days = papers.map((p) => dayOf(p.submittedAt)).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime());
  let submissionsOverTime: AnalyticsData["submissionsOverTime"] = null;
  let submissionsPerDay: AnalyticsData["submissionsPerDay"] = null;
  let peakDay: AnalyticsData["peakDay"] = null;
  let submissionWindowDays = 0;
  if (days.length && days[0].getTime() !== days[days.length - 1].getTime()) {
    const first = days[0];
    const last = days[days.length - 1];
    submissionWindowDays = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;
    const perDay = Array.from({ length: submissionWindowDays }, (_, i) => { const d = new Date(first); d.setDate(d.getDate() + i); return { d, count: 0 }; });
    for (const d of days) perDay[Math.round((d.getTime() - first.getTime()) / 86400000)].count += 1;
    submissionsPerDay = perDay.map((x) => ({ date: shortDay(x.d), count: x.count }));
    const peak = perDay.reduce((best, x) => (x.count > best.count ? x : best), perDay[0]);
    peakDay = { date: peak.d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), count: peak.count };
    // Cumulative total on each day something was submitted (thinned to about 30 points on a long window).
    let running = 0;
    const points = perDay.filter((x) => x.count > 0).map((x) => ({ date: shortDay(x.d), cumulative: (running += x.count) }));
    const step = Math.ceil(points.length / 30);
    submissionsOverTime = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }

  const decisionBreakdown: DecisionRow[] = [
    { label: "Accepted", count: accepted, tone: "success" },
    { label: "Conditional Accept", count: conditional, tone: "warning" },
    { label: "Rejected", count: rejected, tone: "danger" },
    { label: "Hold", count: count("Hold"), tone: "neutral" },
    { label: "Revision", count: count("Revision"), tone: "neutral" },
    { label: "Flag Clear", count: count("Flag Clear"), tone: "neutral" },
    { label: "No Decision Yet", count: count("No Decision Yet"), tone: "neutral" },
  ];

  // Keywords: counted without regard to case, shown as first written.
  const tally = new Map<string, { keyword: string; count: number }>();
  for (const p of papers) for (const k of new Set(p.keywords.map((x) => x.trim()).filter(Boolean))) {
    const key = k.toLowerCase();
    const cur = tally.get(key);
    if (cur) cur.count += 1; else tally.set(key, { keyword: k, count: 1 });
  }
  const allKeywords = [...tally.values()].sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
  const topKeywords = allKeywords.slice(0, 25);
  const keywordStats = allKeywords.length ? { listed: topKeywords.length, unique: allKeywords.length, mentions: allKeywords.reduce((s, k) => s + k.count, 0) } : null;

  // Authors.
  let authors: AuthorStats | null = null;
  if (total && authorKeys.size) {
    const perAuthor = new Map<string, number>();
    for (const p of papers) for (const k of new Set(p.authors.map(authorKey))) perAuthor.set(k, (perAuthor.get(k) ?? 0) + 1);
    const authorCounts = papers.map((p) => new Set(p.authors.map(authorKey)).size);
    const subs = [...perAuthor.values()];
    const single = authorCounts.filter((n) => n === 1).length;
    const repeat = subs.filter((n) => n >= 2).length;
    const bucket = (n: number, cap: number) => (n >= cap ? `${cap}+` : String(n));
    authors = {
      unique: perAuthor.size, repeatAuthors: repeat, repeatAuthorsPct: rate(repeat, perAuthor.size),
      avgAuthorsPerPaper: round2(authorCounts.reduce((a, b) => a + b, 0) / total), maxAuthorsOnPaper: Math.max(...authorCounts),
      singleAuthorPapers: single, singleAuthorPapersPct: rate(single, total), multiAuthorPapers: total - single,
      avgSubmissionsPerAuthor: round2(subs.reduce((a, b) => a + b, 0) / subs.length), maxSubmissionsByAuthor: Math.max(...subs),
      singlePaperAuthors: subs.length - repeat, multiPaperAuthors: repeat,
      submissionsPerAuthorHistogram: ["1", "2", "3", "4", "5", "6", "7", "8+"].map((b) => ({ bucket: b, authors: subs.filter((n) => bucket(n, 8) === b).length })),
      authorsPerSubmissionHistogram: ["1", "2", "3", "4", "5", "6", "7", "8", "9+"].map((b) => ({ bucket: b, papers: authorCounts.filter((n) => bucket(n, 9) === b).length })),
    };
  }

  // Institutions.
  let institutions: AnalyticsData["institutions"] = null;
  if (affiliationKeys.size) {
    const group = new Map<string, { names: Map<string, number>; countries: Map<string, number>; papers: Set<string>; accepted: Set<string> }>();
    for (const p of papers) for (const a of p.authors) {
      const key = normalizeInstitution(a.affiliation);
      if (!key) continue;
      const g = group.get(key) ?? { names: new Map(), countries: new Map(), papers: new Set(), accepted: new Set() };
      bump(g.names, a.affiliation.trim());
      if (a.country.trim()) bump(g.countries, a.country.trim());
      g.papers.add(p.dbId);
      if (isAccepted(p)) g.accepted.add(p.dbId);
      group.set(key, g);
    }
    const table = [...group.values()]
      .map((g) => ({ name: mostCommon(g.names), country: mostCommon(g.countries), submitted: g.papers.size, accepted: g.accepted.size }))
      .sort((a, b) => b.submitted - a.submitted || b.accepted - a.accepted || a.name.localeCompare(b.name))
      .map((r, i) => ({ rank: i + 1, ...r }));
    const dom = host ? table.filter((r) => r.country === host).length : 0;
    institutions = { unique: table.length, domestic: dom, international: table.length - dom, table };
  }

  // Countries and regions.
  let countries: AnalyticsData["countries"] = null;
  let region: AnalyticsData["region"] = null;
  if (hasCountry && total) {
    const byCountry = new Map<string, { papers: Set<string>; accepted: Set<string>; affiliations: Set<string>; authors: Set<string>; acceptedAuthors: Set<string> }>();
    for (const p of papers) for (const a of p.authors) {
      const c = a.country.trim();
      if (!c) continue;
      const g = byCountry.get(c) ?? { papers: new Set(), accepted: new Set(), affiliations: new Set(), authors: new Set(), acceptedAuthors: new Set() };
      g.papers.add(p.dbId);
      g.authors.add(authorKey(a));
      const aff = normalizeInstitution(a.affiliation);
      if (aff) g.affiliations.add(aff);
      if (isAccepted(p)) { g.accepted.add(p.dbId); g.acceptedAuthors.add(authorKey(a)); }
      byCountry.set(c, g);
    }
    const table: CountryRow[] = [...byCountry.entries()]
      .map(([country, g]) => ({
        country, region: regionOf(country), papersSubmitted: g.papers.size, papersAccepted: g.accepted.size, affiliations: g.affiliations.size,
        acceptanceRate: rate(g.accepted.size, g.papers.size), authorsSubmitted: g.authors.size, authorsAccepted: g.acceptedAuthors.size,
      }))
      .sort((a, b) => b.papersSubmitted - a.papersSubmitted || a.country.localeCompare(b.country));
    const top = table[0];
    countries = { unique: table.length, leadingCountry: { country: top.country, papers: top.papersSubmitted, sharePct: rate(top.papersSubmitted, total) }, table };

    const byRegion = new Map<string, { papers: Set<string>; accepted: Set<string>; countries: Set<string>; authors: Set<string>; acceptedAuthors: Set<string> }>();
    for (const p of papers) for (const a of p.authors) {
      const c = a.country.trim();
      if (!c) continue;
      const r = regionOf(c);
      const g = byRegion.get(r) ?? { papers: new Set(), accepted: new Set(), countries: new Set(), authors: new Set(), acceptedAuthors: new Set() };
      g.papers.add(p.dbId);
      g.countries.add(c);
      g.authors.add(authorKey(a));
      if (isAccepted(p)) { g.accepted.add(p.dbId); g.acceptedAuthors.add(authorKey(a)); }
      byRegion.set(r, g);
    }
    const regionTable: RegionRow[] = [...byRegion.entries()]
      .map(([r, g]) => ({
        region: r, papersSubmitted: g.papers.size, papersAccepted: g.accepted.size, countries: g.countries.size,
        acceptanceRate: rate(g.accepted.size, g.papers.size), sharePct: rate(g.papers.size, total), authorsSubmitted: g.authors.size, authorsAccepted: g.acceptedAuthors.size,
      }))
      .sort((a, b) => b.papersSubmitted - a.papersSubmitted || a.region.localeCompare(b.region));
    const lead0 = regionTable[0];
    region = { regionsWithPapers: regionTable.length, leadingRegion: { region: lead0.region, papers: lead0.papersSubmitted, sharePct: lead0.sharePct }, table: regionTable };
  }

  return { summary, submissionsOverTime, peakDay, submissionWindowDays, submissionsPerDay, decisionBreakdown, topKeywords, keywordStats, authors, institutions, countries, region };
}
