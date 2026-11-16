"use client";

import { MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { googleMapsKey, loadGoogleMaps } from "@/lib/google-maps";

/* The "Venue name" box with suggestions (port of the prototype's VenueSearchInput): type "India Habitat" or "Marriott Bangkok" and matching venues, hotels,
   universities and addresses (Google Places) drop down under the box. Picking one fills the venue name, address, city, state, country, postal code and map
   position in one go (`onPick`). Without a Maps key, or if Google can't load, it is just the plain input. */

export interface VenuePatch { venue: string; address: string; city: string; state: string; country: string; postalCode: string; lat?: number; lng?: number }

const component = (parts: google.maps.GeocoderAddressComponent[] | undefined, type: string) => (parts ?? []).find((c) => c.types.includes(type))?.long_name ?? "";

function placeToVenuePatch(place: google.maps.places.PlaceResult): VenuePatch {
  const parts = place.address_components;
  const loc = place.geometry?.location;
  return {
    venue: place.name ?? "", address: place.formatted_address ?? "",
    city: component(parts, "locality") || component(parts, "postal_town") || component(parts, "administrative_area_level_2"),
    state: component(parts, "administrative_area_level_1"), country: component(parts, "country"), postalCode: component(parts, "postal_code"),
    ...(loc ? { lat: loc.lat(), lng: loc.lng() } : {}),
  };
}

// Some places (Bangkok, Singapore…) come back with no "locality": take the city from the suggestion's text ("… Bang Rak, Bangkok, Thailand").
function cityFromDescription(description: string, country: string) {
  const parts = description.split(",").map((x) => x.trim()).filter(Boolean);
  const at = country ? parts.lastIndexOf(country) : parts.length - 1;
  return at > 0 ? parts[at - 1].replace(/\s*\d+\s*$/, "") : "";
}

interface Places { service: google.maps.places.AutocompleteService; details: google.maps.places.PlacesService; token: google.maps.places.AutocompleteSessionToken; newToken: () => google.maps.places.AutocompleteSessionToken }

export function VenueSearchInput({ id, value, onChange, onPick, placeholder, className }: { id?: string; value: string; onChange: (v: string) => void; onPick: (p: VenuePatch) => void; placeholder?: string; className?: string }) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const placesRef = useRef<Places | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seqRef = useRef(0); // the latest search; an older answer arriving late is dropped
  const enabled = Boolean(googleMapsKey());
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  const ensurePlaces = (): Promise<Places> => {
    if (placesRef.current) return Promise.resolve(placesRef.current);
    return loadGoogleMaps().then((g) => {
      placesRef.current = {
        service: new g.maps.places.AutocompleteService(), details: new g.maps.places.PlacesService(document.createElement("div")),
        newToken: () => new g.maps.places.AutocompleteSessionToken(), token: new g.maps.places.AutocompleteSessionToken(),
      };
      return placesRef.current;
    });
  };

  const search = (text: string) => {
    clearTimeout(timerRef.current);
    const n = ++seqRef.current;
    const q = text.trim();
    if (!enabled || q.length < 2) { setItems([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      ensurePlaces()
        .then((p) => new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => p.service.getPlacePredictions({ input: q, sessionToken: p.token }, (res, status) => resolve(status === "OK" ? res ?? [] : []))))
        .then((res) => { if (n === seqRef.current) { setItems(res.slice(0, 6)); setActive(-1); setLoading(false); } })
        .catch(() => { if (n === seqRef.current) { setItems([]); setLoading(false); } });
    }, 250);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const pick = (item: google.maps.places.AutocompletePrediction) => {
    seqRef.current += 1; clearTimeout(timerRef.current);
    setOpen(false); setItems([]); setLoading(false);
    const p = placesRef.current;
    if (!p) return;
    p.details.getDetails({ placeId: item.place_id, fields: ["name", "formatted_address", "address_components", "geometry"], sessionToken: p.token }, (place, status) => {
      p.token = p.newToken(); // a pick ends the billing session
      if (status === "OK" && place) {
        const patch = placeToVenuePatch(place);
        if (!patch.city) patch.city = cityFromDescription(item.description, patch.country);
        onPick(patch);
      } else onChange(item.structured_formatting?.main_text || item.description);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); e.stopPropagation(); pick(items[active]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  };

  const showList = enabled && open && (items.length > 0 || loading);
  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id} value={value} maxLength={300} placeholder={placeholder} autoComplete="off" className={className} onKeyDown={onKeyDown}
        onChange={(e) => { setOpen(true); onChange(e.target.value); search(e.target.value); }}
        onFocus={() => { if (enabled) { ensurePlaces().catch(() => undefined); if (items.length) setOpen(true); } }}
        role={enabled ? "combobox" : undefined} aria-expanded={enabled ? showList : undefined} aria-controls={enabled ? listId : undefined} aria-autocomplete={enabled ? "list" : undefined}
      />
      {showList && (
        <ul id={listId} role="listbox" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(11,16,32,0.14)" }} className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl bg-white py-1">
          {items.length === 0 && loading && <li className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-ink-faint"><Search size={13} aria-hidden="true" /> Searching venues…</li>}
          {items.map((it, i) => (
            // mousedown, not click: the input would blur (and the list close) before a click lands.
            <li key={it.place_id} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(it); }} onMouseEnter={() => setActive(i)} className={`flex cursor-pointer items-start gap-2.5 px-3.5 py-2 ${i === active ? "bg-primary-soft" : ""}`}>
              <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-navy">{it.structured_formatting?.main_text || it.description}</span>
                {it.structured_formatting?.secondary_text && <span className="block truncate text-xs text-ink-muted">{it.structured_formatting.secondary_text}</span>}
              </span>
            </li>
          ))}
          {items.length > 0 && <li className="border-t border-muted px-3.5 py-1.5 text-[10.5px] text-ink-faint">Pick one to fill the address, city and country · or keep typing your own</li>}
        </ul>
      )}
    </div>
  );
}
