"use client";

import { AlertTriangle, Layers, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { googleMapsKey, loadGoogleMaps } from "@/lib/google-maps";

/* Address search + an interactive map (the prototype's VenueMapPicker), on the Google Maps JavaScript API (Places + Geocoding). Type an address, click the map or drag the pin:
   each calls `onLocationChange` with the street, city, state, country, postal code and the pin's coordinates, for the parent form to merge in. The map follows the venue the
   form already has (a saved address, or a venue name found near the city and country: offered, never applied on its own). With no key the notice of the prototype is shown
   and the parent's own fields keep working. */

const DEFAULT_CENTER = { lat: 20, lng: 0 }; // the whole world, until a venue or an address is known
const DEFAULT_ZOOM = 2;

export interface VenueLocation { address: string; streetNumber: string; streetName: string; city: string; state: string; country: string; postalCode: string; lat: number; lng: number }
type Parts = google.maps.GeocoderAddressComponent[] | undefined;
const part = (parts: Parts, type: string) => (parts ?? []).find((c) => c.types.includes(type))?.long_name ?? "";
interface Found { location: google.maps.LatLng; viewport?: google.maps.LatLngBounds; formatted?: string; components?: Parts; placeId?: string }

/** Text → place: Geocoding first; if it is off for the key (REQUEST_DENIED) or finds nothing, ask Places (the search box needs it anyway). */
function locatePlace(geocoder: google.maps.Geocoder, places: google.maps.places.PlacesService, query: string, onGeocodingOff: () => void, cb: (r: Found | null) => void) {
  geocoder.geocode({ address: query }, (results, st) => {
    if (st === "OK" && results?.[0]) { const r = results[0]; cb({ location: r.geometry.location, viewport: r.geometry.viewport, formatted: r.formatted_address, components: r.address_components }); return; }
    if (st === "REQUEST_DENIED") onGeocodingOff();
    places.findPlaceFromQuery({ query, fields: ["place_id", "geometry", "formatted_address", "name"] }, (found, pst) => {
      const p = pst === "OK" && found?.[0];
      cb(p && p.geometry?.location ? { location: p.geometry.location, viewport: p.geometry.viewport, formatted: p.formatted_address, placeId: p.place_id } : null);
    });
  });
}

interface Suggestion { venue: string; components?: Parts; placeId?: string; formatted?: string; lat: number; lng: number }

export function VenueMapPicker({ onLocationChange, initialAddress = "", venue = "", address, city = "", country = "" }: { onLocationChange: (l: VenueLocation) => void; initialAddress?: string; venue?: string; address?: string; city?: string; country?: string }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const info = useRef<google.maps.InfoWindow | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const places = useRef<google.maps.places.PlacesService | null>(null);
  // The address this picker itself last wrote: when the form echoes it back the pin is already right and must not jump to a re-geocoded spot.
  const applied = useRef("");
  const onChange = useRef(onLocationChange);
  useEffect(() => { onChange.current = onLocationChange; }, [onLocationChange]);

  const [status, setStatus] = useState<"no-key" | "loading" | "ready" | "error">(googleMapsKey() ? "loading" : "no-key");
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [addressLine, setAddressLine] = useState(initialAddress);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [geocodingOff, setGeocodingOff] = useState(false);
  // Opening with a venue already set: the map stays covered until it is found, so it never flashes the world view first.
  const [firstFix, setFirstFix] = useState(() => [initialAddress, venue].some((v) => v.trim()));
  const located = useRef(false);

  const applyPlace = (components: Parts, formatted: string | undefined, lat: number, lng: number) => {
    setAddressLine(formatted ?? ""); setSuggestion(null); applied.current = formatted ?? "";
    onChange.current({ address: formatted ?? "", streetNumber: part(components, "street_number"), streetName: part(components, "route"), city: part(components, "locality") || part(components, "postal_town") || part(components, "administrative_area_level_2"), state: part(components, "administrative_area_level_1"), country: part(components, "country"), postalCode: part(components, "postal_code"), lat, lng });
  };
  // Using a Places match: its address parts are fetched first (Find Place does not return them).
  const accept = (s: Suggestion) => {
    const done = (components: Parts, formatted?: string) => { applyPlace(components ?? [], formatted ?? s.formatted, s.lat, s.lng); if (searchRef.current) searchRef.current.value = formatted ?? s.formatted ?? ""; };
    if (s.components || !s.placeId) { done(s.components, s.formatted); return; }
    places.current?.getDetails({ placeId: s.placeId, fields: ["address_components", "formatted_address"] }, (d, st) => (st === "OK" && d ? done(d.address_components, d.formatted_address) : done(undefined, s.formatted)));
  };

  // Build the map once.
  useEffect(() => {
    if (status !== "loading") return undefined;
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !mapDiv.current || !searchRef.current) return;
      const map = new g.maps.Map(mapDiv.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, streetViewControl: false, fullscreenControl: true, mapTypeControl: false, clickableIcons: false, gestureHandling: "cooperative" });
      const pin = new g.maps.Marker({ map, draggable: true, visible: false });
      mapObj.current = map; marker.current = pin;
      info.current = new g.maps.InfoWindow({ disableAutoPan: true, shouldFocus: false } as google.maps.InfoWindowOptions);
      geocoder.current = new g.maps.Geocoder();
      places.current = new g.maps.places.PlacesService(map);
      // Dropping or dragging the pin reads the address back from that spot (Geocoding API only).
      const pinAt = (pos: google.maps.LatLng) => {
        pin.setPosition(pos); pin.setVisible(true);
        geocoder.current?.geocode({ location: pos }, (results, st) => {
          if (st === "REQUEST_DENIED") { setGeocodingOff(true); return; }
          if (st === "OK" && results?.[0]) { applyPlace(results[0].address_components, results[0].formatted_address, pos.lat(), pos.lng()); if (searchRef.current) searchRef.current.value = results[0].formatted_address ?? ""; }
        });
      };
      pin.addListener("dragend", () => { const p = pin.getPosition(); if (p) pinAt(p); });
      map.addListener("click", (e: google.maps.MapMouseEvent) => { if (e.latLng) pinAt(e.latLng); });
      const auto = new g.maps.places.Autocomplete(searchRef.current, { fields: ["formatted_address", "address_components", "geometry"] });
      auto.addListener("place_changed", () => {
        const place = auto.getPlace(); const loc = place.geometry?.location;
        if (!loc) return;
        map.setCenter(loc); map.setZoom(16); pin.setPosition(loc); pin.setVisible(true);
        applyPlace(place.address_components, place.formatted_address, loc.lat(), loc.lng());
      });
      setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => { mapObj.current?.setMapTypeId(mapType); }, [mapType]);

  /* Follow the form: whatever venue / address / city / country it holds is shown on the map, pinned and labelled with the venue name. An address pins it (most precise);
     only a venue name is found near the city / country, pinned, and its address offered; neither: the whole world. Showing never changes the form: only the offer does, on click. */
  const liveAddress = (address ?? initialAddress).trim();
  const venueName = venue.trim();
  useEffect(() => {
    if (status !== "ready") return undefined;
    const map = mapObj.current, pin = marker.current, win = info.current;
    if (!map || !pin || !win) return undefined;
    const label = () => {
      if (!venueName) { win.close(); return; }
      const el = document.createElement("div");
      el.style.cssText = "font:600 13px/1.3 system-ui,sans-serif;color:#0B1020;padding:2px 2px 0";
      el.textContent = venueName; // text only: never HTML from a form field
      win.setContent(el); win.open({ map, anchor: pin, shouldFocus: false });
    };
    if (liveAddress && liveAddress === applied.current) { label(); return undefined; }
    const input = searchRef.current;
    if (input && document.activeElement !== input) input.value = liveAddress;
    // City and country go on the end unless the text already names them: a street on its own is ambiguous worldwide.
    const withPlace = (t: string) => [t, ...[city.trim(), country.trim()].filter((p) => p && !t.toLowerCase().includes(p.toLowerCase()))].join(", ");
    const query = liveAddress ? withPlace(liveAddress) : venueName ? withPlace(venueName) : "";
    if (!query) { pin.setVisible(false); win.close(); map.setCenter(DEFAULT_CENTER); map.setZoom(DEFAULT_ZOOM); return undefined; }
    let stale = false;
    const t = setTimeout(() => {
      if (!geocoder.current || !places.current) return;
      locatePlace(geocoder.current, places.current, query, () => setGeocodingOff(true), (r) => {
        if (stale) return;
        located.current = true; setFirstFix(false);
        if (!r) return;
        map.setCenter(r.location); map.setZoom(16); pin.setPosition(r.location); pin.setVisible(true); label();
        setSuggestion(!liveAddress && venueName ? { venue: venueName, components: r.components, placeId: r.placeId, formatted: r.formatted, lat: r.location.lat(), lng: r.location.lng() } : null);
      });
    }, located.current ? 700 : 0);
    return () => { stale = true; clearTimeout(t); };
  }, [status, liveAddress, venueName, city, country]);

  if (status === "no-key" || status === "error") {
    return (
      <div style={{ border: "1.5px dashed var(--warning-border)" }} className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-4 py-3.5">
        <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed text-warning">
          {status === "no-key"
            ? <>Map address picker isn&apos;t configured yet — add <code className="[font-family:inherit]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to <code className="[font-family:inherit]">.env.local</code> to enable it.</>
            : <>Couldn&apos;t load Google Maps (check the API key and that Maps JavaScript API / Places API / Geocoding API are enabled). You can still fill in the fields below manually.</>}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input ref={searchRef} defaultValue={initialAddress} onChange={(e) => setAddressLine(e.target.value)} placeholder={status === "loading" ? "Loading map…" : "Search for an address or place…"} disabled={status === "loading"} aria-label="Venue address" className="w-full rounded-lg border-[1.5px] border-line py-2.5 pl-9 pr-3.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary disabled:bg-slate-50" />
      </div>
      <div style={{ border: "1px solid var(--border)" }} className="relative overflow-hidden rounded-lg">
        <div ref={mapDiv} style={{ height: "clamp(360px, 60vh, 560px)", background: "var(--canvas)" }} />
        {status === "ready" && (
          <div style={{ border: "1px solid var(--border)" }} className="absolute left-2.5 top-2.5 flex overflow-hidden rounded-md bg-white text-xs font-semibold shadow-sm">
            {(["roadmap", "satellite"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setMapType(t)} style={mapType === t ? { background: "var(--primary)", color: "#FFFFFF" } : { color: "var(--ink-soft)" }} className="cursor-pointer px-2.5 py-1 capitalize">{t === "roadmap" ? "Map" : "Satellite"}</button>
            ))}
          </div>
        )}
        {(status === "loading" || firstFix) && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas text-xs font-medium text-ink-faint">{status === "loading" ? <><Layers size={14} aria-hidden="true" className="mr-1.5" /> Loading map…</> : <><MapPin size={14} aria-hidden="true" className="mr-1.5" /> Locating venue…</>}</div>
        )}
      </div>
      {geocodingOff && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs leading-snug text-warning"><AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" /><span>Clicking or dragging the pin can&apos;t fill in the address yet — enable the <b>Geocoding API</b> for this Google Maps key. Searching an address works.</span></div>
      )}
      {suggestion && !liveAddress && suggestion.venue === venueName && (
        <div style={{ border: "1px solid var(--primary-soft-border)" }} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-primary-soft px-3 py-2.5">
          <MapPin size={14} aria-hidden="true" className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1 text-xs leading-snug"><span className="font-semibold text-navy">Found “{suggestion.venue}” on the map</span><span className="block truncate text-ink-soft">{suggestion.formatted}</span></div>
          <button type="button" onClick={() => accept(suggestion)} className="h-8 shrink-0 cursor-pointer rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover">Use this address</button>
        </div>
      )}
      {addressLine && <div className="flex items-start gap-1.5 text-xs text-ink-faint"><MapPin size={12} aria-hidden="true" className="mt-0.5 shrink-0" /> {addressLine}</div>}
      <p className="text-xs text-ink-faint">The map follows the venue you enter. Search an address, or click the map to drop a pin (drag it to adjust) — city, country and other fields fill in automatically.</p>
    </div>
  );
}
