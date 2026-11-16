// Full-bleed photo under a dark scrim (solid navy underneath is the fallback if the image doesn't load).
const AUTH_BG_IMAGE = "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=1920";

/** The sign-in / complete-profile background (fixed, so it stays put while a long form scrolls over it). */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 bg-navy bg-cover bg-center" style={{ backgroundImage: `url(${AUTH_BG_IMAGE})` }}>
      <div className="absolute inset-0" style={{ background: "var(--auth-scrim)" }} />
    </div>
  );
}
