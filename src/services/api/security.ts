import { api, asBrokenLink, setAccessToken } from "@/lib/api-client";
import { startSession } from "./auth";

/* Account security through the own backend (Backend/src/modules/auth/account.controller.ts): two-step verification, signed-in devices, the
   sign-in email address and connecting a new provider-only sign-in to an existing account. Messages from the backend are ready to show. */

export interface MfaStatus { enabled: boolean; recoveryCodesLeft: number; /** Super admins must turn it on. */ required: boolean }
export interface TotpSetup { secret: string; otpauthUrl: string }
export interface SessionInfo {
  id: string; current: boolean; signedInAt: string; lastActiveAt: string; expiresAt: string;
  userAgent: string | null; ipAddress: string | null; mfaVerified: boolean;
}

/* ---- two-step verification ---- */
export const mfaStatus = () => api<MfaStatus>("/auth/mfa");
/** Starts setting up an authenticator app; it stays off until a first code is confirmed with `enableTotp`. */
export const beginTotpSetup = () => api<TotpSetup>("/auth/mfa/totp/setup", { method: "POST", body: {} });
/** Confirms the first code. Resolves the recovery codes (shown once). The backend signs the other devices out and answers a fresh token for this one. */
export async function enableTotp(code: string): Promise<string[]> {
  const r = await api<{ recoveryCodes: string[]; accessToken: string }>("/auth/mfa/totp/enable", { method: "POST", body: { code: code.trim() } });
  setAccessToken(r.accessToken);
  return r.recoveryCodes;
}
export const disableTotp = (code: string) => api("/auth/mfa/totp/disable", { method: "POST", body: { code: code.trim() } });
/** Replaces the recovery codes (the old ones stop working). Resolves the new ones, shown once. */
export async function newRecoveryCodes(code: string): Promise<string[]> {
  return (await api<{ recoveryCodes: string[] }>("/auth/mfa/recovery-codes", { method: "POST", body: { code: code.trim() } })).recoveryCodes;
}

/* ---- signed-in devices ---- */
export const listSessions = () => api<SessionInfo[]>("/auth/sessions");
export const signOutDevice = (id: string) => api(`/auth/sessions/${id}`, { method: "DELETE" });
/** Ends every session of the account, this one too: the caller sends the person to sign in. */
export async function signOutEverywhere(): Promise<void> {
  await api("/auth/sign-out/everywhere", { method: "POST" });
  setAccessToken(null, false);
}

/* ---- sign-in email address ---- */
/** Emails a confirmation link to the new address. The password is required when the account has one. */
export const requestEmailChange = (newEmail: string, currentPassword?: string) =>
  api("/auth/email/change", { method: "POST", body: { newEmail: newEmail.trim(), currentPassword: currentPassword || undefined } });
/** The emailed link (public: it works without being signed in). */
export async function confirmEmailChange(token: string): Promise<void> {
  try { await api("/auth/email/change/confirm", { auth: false, method: "POST", body: { token } }); }
  catch (e) { throw asBrokenLink(e, "This link has expired or was already used. Please ask for a new one in Settings."); }
}

/* ---- connecting a new provider-only sign-in (e.g. ORCID, which gives no email) to the account that owns an address ---- */
export const requestMerge = (email: string) => api("/auth/account/merge", { method: "POST", body: { email: email.trim() } });
/** Moves this sign-in to the other account and signs in to it (throws MfaRequiredError when that account has two-step verification). */
export async function completeMerge(email: string, code: string): Promise<void> {
  startSession(await api<{ accessToken?: string; mfaRequired?: true; message?: string }>("/auth/account/merge/verify", { method: "POST", body: { email: email.trim(), code: code.trim() } }));
}
