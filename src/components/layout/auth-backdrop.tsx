// Full-bleed photo under a dark scrim (solid navy underneath is the fallback if the image doesn't load).
// Served by the app itself (a 33 KB WebP of the photo, it was a 250 KB JPEG from a third party that also set its own cookies on visitors).
const AUTH_BG_IMAGE = "/auth-bg.webp";

/** The sign-in / complete-profile background (fixed, so it stays put while a long form scrolls over it). */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 bg-navy bg-cover bg-center" style={{ backgroundImage: `url(${AUTH_BG_IMAGE})` }}>
      <div className="absolute inset-0" style={{ background: "var(--auth-scrim)" }} />
    </div>
  );
}
