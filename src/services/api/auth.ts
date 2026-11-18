import { TERMS_VERSION } from "@/lib/config";
import { api, ApiError, asBrokenLink, hasAccessToken, refreshSession, setAccessToken } from "@/lib/api-client";
import type { AuthService, SignUpInput } from "../auth";
import { MfaRequiredError, ServiceError } from "../errors";

/* AuthService against the own backend (Backend/src/modules/auth). Plain JSON; the backend's messages are ready to show.
   Differences from Supabase (the UI keeps working unchanged):
   - Confirmation / reset links carry a one-time `token` query parameter (read from the URL here).
   - Two-step verification: a sign-in that answers `mfaRequired` throws MfaRequiredError; the screen then asks for the code and calls verifyMfa. */

interface SignInResponse { accessToken?: string; mfaRequired?: true; message?: string }

/** Keeps the session a sign-in answered with, or asks for the second step. Also used by the other flows that end in a session (merge, provider sign-in). */
export function startSession(r: SignInResponse): void {
  if (r.mfaRequired) throw new MfaRequiredError(r.message);
  if (!r.accessToken) throw new ServiceError("Something went wrong — please try again.");
  setAccessToken(r.accessToken);
}

const urlToken = (): string => {
  const p = new URLSearchParams(window.location.search);
  return p.get("token") ?? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") ?? "";
};

export const apiAuthService: AuthService = {
  async verifyMfa(code) {
    // The pending challenge travels in the backend's own cookie; only the code is sent.
    startSession(await api<SignInResponse>("/auth/mfa/verify", { auth: false, body: { code: code.trim() } }));
  },

  async signUp(input: SignUpInput) {
    const { firstName, lastName, email, password, affiliation, designation, country, ...details } = input;
    await api("/auth/register", {
      auth: false,
      body: {
        email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim(),
        affiliation: affiliation || null, designation: designation || null, country: country || null,
        termsVersion: TERMS_VERSION, details,
      },
    });
    return { needsConfirmation: true };
  },

  async setNewPassword(password) {
    const token = urlToken();
    if (!token) throw new ServiceError("This reset link is incomplete or has expired — request a new one.");
    try { await api("/auth/password/reset", { auth: false, body: { token, password } }); }
    catch (e) { throw asBrokenLink(e, "This reset link has expired or was already used. Go back to sign in and choose Forgot password? to get a new one."); }
  },

  async signIn(email, password) {
    startSession(await api<SignInResponse>("/auth/sign-in", { auth: false, body: { email: email.trim(), password } }));
  },

  async sendLoginCode(email) {
    await api("/auth/sign-in/code", { auth: false, body: { email: email.trim() } });
  },

  async verifyLoginCode(email, code) {
    startSession(await api<SignInResponse>("/auth/sign-in/code/verify", { auth: false, body: { email: email.trim(), code: code.trim() } }));
  },

  async sendPasswordReset(email) {
    await api("/auth/password/forgot", { auth: false, body: { email: email.trim() } });
  },

  async resendConfirmation(email) {
    await api("/auth/verify-email/resend", { auth: false, body: { email: email.trim() } });
  },

  async changePassword(currentPassword, newPassword) {
    // An account without a password yet (created through Google, …) sets one without a current password.
    await api("/auth/password/change", { body: { currentPassword: currentPassword || undefined, newPassword } });
  },

  async isSignedIn() {
    return hasAccessToken() || (await refreshSession());
  },

  async signOut() {
    try { await api("/auth/sign-out", { auth: false, method: "POST" }); } catch { /* signing out locally must always work */ }
    setAccessToken(null);
  },
};

export { ApiError };

/** The "Confirm my email" link: the backend confirms the address and signs the person in. */
export async function confirmEmail(token: string): Promise<void> {
  let r: SignInResponse;
  try { r = await api<SignInResponse>("/auth/verify-email", { auth: false, body: { token } }); }
  catch (e) { throw asBrokenLink(e, "This link has expired or was already used. Sign in to get a new one."); }
  startSession(r);
}
