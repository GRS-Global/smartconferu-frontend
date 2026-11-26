// Marketing home page nav (ported from the prototype's home-main.js): swaps "Log in" for "Dashboard" + "Log out" when the visitor
// already has a session with the own backend. The session lives in the backend's httpOnly refresh cookie, so the only way to know is to
// ask for a new access token (POST /auth/refresh); the API address comes from /home-config (set at build time from NEXT_PUBLIC_API_URL).

// Lucide's "layout-dashboard" and "log-out" glyphs, as on the rest of this page (24x24, currentColor, stroke-width 2).
const DASHBOARD_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`;
const LOGOUT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>`;

function buildAuthedLinks(iconOnly, signOut) {
  const dashboardLink = document.createElement("a");
  dashboardLink.href = "/dashboard";
  dashboardLink.className = iconOnly ? "btn btn-outline btn-icon" : "btn btn-outline";
  dashboardLink.title = "Go to Dashboard";
  dashboardLink.setAttribute("aria-label", "Go to Dashboard");
  dashboardLink.innerHTML = iconOnly ? DASHBOARD_ICON : `${DASHBOARD_ICON} Dashboard`;

  const logoutLink = document.createElement("a");
  logoutLink.href = "#";
  logoutLink.className = iconOnly ? "btn btn-ghost btn-icon" : "btn btn-outline";
  logoutLink.title = "Log out";
  logoutLink.setAttribute("aria-label", "Log out");
  logoutLink.innerHTML = iconOnly ? LOGOUT_ICON : `${LOGOUT_ICON} Log out`;
  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut();
    window.location.reload();
  });
  return [dashboardLink, logoutLink];
}

async function initNavAuthState() {
  let api;
  try { api = (await (await fetch("/home-config", { cache: "no-store" })).json()).api; } catch { return; }
  if (!api) return;
  let token;
  try {
    const res = await fetch(`${api}/api/v1/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) return; // not signed in (or the API is unreachable): keep "Log in"
    token = (await res.json()).accessToken;
  } catch { return; }
  const signOut = () => fetch(`${api}/api/v1/auth/sign-out`, { method: "POST", credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {});

  const loginLink = document.getElementById("navLoginLink");
  if (loginLink) loginLink.replaceWith(...buildAuthedLinks(true, signOut));
  const mobileLoginLink = document.getElementById("navLoginLinkMobile");
  if (mobileLoginLink) mobileLoginLink.replaceWith(...buildAuthedLinks(false, signOut));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void initNavAuthState());
else void initNavAuthState();
