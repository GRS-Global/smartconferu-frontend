/* Thin loader for the Google Maps JS API (+ the Places library), shared by anything that needs an address search or a map (Conference Details, Create Conference). It adds
   the <script> tag at most once per page and shares the in-flight promise, so concurrent callers resolve together. The key is NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a public,
   referrer-restricted browser key). Maps JavaScript API, Places API and Geocoding API have to be switched on for it in Google Cloud. */

let loadPromise: Promise<typeof google> | null = null;

export const googleMapsKey = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window !== "undefined" && window.google?.maps?.places) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;
  const key = googleMapsKey();
  if (!key) return Promise.reject(new Error("missing-api-key"));
  loadPromise = new Promise((resolve, reject) => {
    const cb = "__grsGoogleMapsLoaded";
    (window as unknown as Record<string, unknown>)[cb] = () => { delete (window as unknown as Record<string, unknown>)[cb]; resolve(window.google); };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${cb}`;
    script.async = true;
    script.onerror = () => { loadPromise = null; reject(new Error("failed-to-load")); };
    document.head.appendChild(script);
  });
  return loadPromise;
}
