"use client";

import { useEffect, useState } from "react";
import { countryCodeOf } from "@/lib/country-codes";

/* States and cities by country, from the free `country-state-city` data. The data is big, so it is loaded only when a form that asks
   for a state or city is opened (dynamic import), and only suggests: the people can always type their own. */

type Lib = typeof import("country-state-city");
let lib: Promise<Lib> | null = null;
const load = () => (lib ??= import("country-state-city"));

const uniq = (names: string[]) => Array.from(new Set(names.map((n) => n.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

/** State / region suggestions for a country name (empty while loading, for "Other", or for a country the data doesn't know). */
export function useStateOptions(country: string): string[] {
  const [out, setOut] = useState<{ key: string; names: string[] }>({ key: "", names: [] });
  useEffect(() => {
    const code = countryCodeOf(country);
    if (!code) return;
    let live = true;
    void load().then(({ State }) => { if (live) setOut({ key: country, names: uniq(State.getStatesOfCountry(code).map((s) => s.name)) }); }).catch(() => undefined);
    return () => { live = false; };
  }, [country]);
  return out.key === country ? out.names : [];
}

/** City suggestions: the cities of the chosen state when it is one of the known states, otherwise those of the whole country. */
export function useCityOptions(country: string, state: string): string[] {
  const [out, setOut] = useState<{ key: string; names: string[] }>({ key: "", names: [] });
  const key = `${country}|${state.trim().toLowerCase()}`;
  useEffect(() => {
    const code = countryCodeOf(country);
    if (!code) return;
    let live = true;
    void load().then(({ City, State }) => {
      if (!live) return;
      const wanted = state.trim().toLowerCase();
      const known = wanted ? State.getStatesOfCountry(code).find((s) => s.name.toLowerCase() === wanted) : undefined;
      const cities = known ? City.getCitiesOfState(code, known.isoCode) : City.getCitiesOfCountry(code) ?? [];
      setOut({ key, names: uniq(cities.map((c) => c.name)) });
    }).catch(() => undefined);
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return out.key === key ? out.names : [];
}
