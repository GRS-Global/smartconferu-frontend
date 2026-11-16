import { getSupabase } from "@/lib/supabase";
import { friendlyAuthError, type AuthService, type SignUpInput } from "../auth";
import { AuthRequiredError, ServiceConfigError, ServiceError } from "../errors";
import { currentUser } from "./shared";

/* Sign-in against Supabase Auth, mirroring the prototype's src/data/auth.js (password, emailed code,
   resend confirmation, forgot password, sign out). Every failure becomes a ServiceError whose message
   is ready to show; a missing configuration stays a ServiceConfigError. */

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceConfigError || e instanceof ServiceError || e instanceof AuthRequiredError) throw e;
    throw new ServiceError(friendlyAuthError(e));
  }
}

function check(error: { message?: string } | null): void {
  if (error) throw new ServiceError(friendlyAuthError(error));
}

// Links in emails sent from here come back to this app: the sign-up confirmation and the one-time-code link to /login, which
// finishes the sign-in (see LoginForm), and the password-reset link to /reset-password. Each must be covered by Supabase →
// Authentication → URL Configuration (see the README).
const loginUrl = () => `${window.location.origin}/login`;
const resetPasswordUrl = () => `${window.location.origin}/reset-password`;

/** Register's details that are not columns on `profiles`; they wait in the sign-up metadata (same keys as the prototype). */
function signUpMetadata(input: SignUpInput): Record<string, unknown> {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    affiliation: input.affiliation,
    designation: input.designation,
    country: input.country,
    gender: input.gender,
    phone: input.phone,
    webPage: input.webPage,
    notifyChannels: input.notifyChannels,
    affiliations: input.affiliations,
    affiliationInstitutionId: input.affiliationInstitutionId,
    affiliationPending: input.affiliationPending,
    affiliationDepartment: input.affiliationDepartment,
    signup_pending: true,
  };
}

export const supabaseAuthService: AuthService = {
  /* Same as the prototype's signUp (src/data/auth.js). The password goes only to the Auth API (never logged, stored or put in
     a URL). With "Confirm email" on, Supabase answers an already-used address with a user that has no identities, not an error. */
  signUp: (input) => run(async () => {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: signUpMetadata(input), emailRedirectTo: loginUrl() },
    });
    check(error);
    if (data.user && data.user.identities?.length === 0) throw new ServiceError(friendlyAuthError("already registered"));
    return { needsConfirmation: !data.session };
  }),

  /* The reset link signs the person in with a recovery session (the client exchanges its code on load); updateUser then sets
     the password. Nothing is reported as changed unless Auth says so. */
  setNewPassword: (password) => run(async () => {
    const db = getSupabase();
    const { data } = await db.auth.getSession();
    if (!data.session) throw new ServiceError("This reset link has expired or was already used — please request a new one.");
    const { error } = await db.auth.updateUser({ password });
    check(error);
  }),

  signIn: (email, password) => run(async () => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    check(error);
  }),

  sendLoginCode: (email) => run(async () => {
    const { error } = await getSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: loginUrl() } });
    check(error);
  }),

  verifyLoginCode: (email, code) => run(async () => {
    const { error } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    check(error);
  }),

  // The emailed link comes back to /reset-password in this app. It is a PKCE link: it only works in the browser that asked for it.
  sendPasswordReset: (email) => run(async () => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: resetPasswordUrl() });
    if (error && !/user not found/i.test(error.message)) throw new ServiceError(friendlyAuthError(error));
  }),

  resendConfirmation: (email) => run(async () => {
    const { error } = await getSupabase().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: loginUrl() } });
    check(error);
  }),

  /* Same two steps as the prototype's changePassword (src/data/auth.js): the current password is checked first by
     signing in with it, then Supabase Auth applies the new one. Nothing is reported as changed unless updateUser succeeds.
     Passwords are only passed to the Auth API; they are never logged or stored. */
  changePassword: (currentPassword, newPassword) => run(async () => {
    const db = getSupabase();
    const user = await currentUser(db);
    if (!user.email) throw new ServiceError("This account has no email address to confirm the password against.");
    const { error: checkError } = await db.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (checkError) {
      throw new ServiceError(/invalid login credentials/i.test(checkError.message) ? "Your current password is incorrect." : friendlyAuthError(checkError));
    }
    const { error } = await db.auth.updateUser({ password: newPassword });
    check(error);
  }),

  async isSignedIn() {
    const { data, error } = await getSupabase().auth.getUser();
    if (data.user) return true;
    const unreachable = error && (error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500);
    if (unreachable) throw new ServiceError("We couldn't reach the server — check your connection and try again.");
    return false;
  },

  async signOut() {
    try {
      // Only this browser: the same account may be signed in elsewhere.
      await getSupabase().auth.signOut({ scope: "local" });
    } catch (e) {
      console.warn("Supabase sign-out failed; the local session is cleared anyway", e);
    }
  },
};
