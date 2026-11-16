/* Visual QA only (NEXT_PUBLIC_MOCK_FIXTURES=parity): the prototype's headline conference "isbm2026" has no mock data of its
   own, so the author / chair / reviewer mocks answer for it with the rich demo conference below. Row CONTENT therefore differs
   from the prototype by design; the point is that both apps show populated tables and forms so layout and components can be
   compared. Without the env var this is the identity function and nothing changes. */
export const PARITY = process.env.NEXT_PUBLIC_MOCK_FIXTURES === "parity";
export const PARITY_ALIAS_FROM = "isbm2026";
export const PARITY_ALIAS_TO = "demo-dsai-2027";
export const mockSlug = (slug: string): string => (PARITY && slug === PARITY_ALIAS_FROM ? PARITY_ALIAS_TO : slug);
