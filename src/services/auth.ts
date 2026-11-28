/** Everything Register adds to the account besides the sign-in itself: the name, and the details that wait in the
 *  sign-up metadata until the first session exists (see applySignupDetails in services/supabase/profile.ts). */
export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  affiliation: string;
  designation: string;
  country: string;
  /** Kept with the profile details (`details.city`). */
  city: string;
  gender: string;
  phone: string;
  webPage: string;
  notifyChannels: string[];
  affiliations: unknown[];
  affiliationInstitutionId: string | null;
  affiliationPending: boolean;
  affiliationDepartment: string;
}

/** What the login, register and reset-password screens need. Only the Supabase implementation exists: mock mode has no accounts. */
export interface AuthService {
  /** Own backend only: the second step of a sign-in that threw `MfaRequiredError`. Takes the 6-digit code of the authenticator app or a recovery code. */
  verifyMfa?(code: string): Promise<void>;
  /** Creates the account. Resolves `needsConfirmation: true` when Supabase has "Confirm email" on (the person must click the
   *  emailed link first) and `false` when a session already exists. An email that is already registered throws a ServiceError. */
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  /** Sets the new password for the recovery session an emailed reset link started. Throws a ServiceError with a message to show. */
  setNewPassword(password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  /** Emails a one-time code (and a sign-in link) to an existing account — never creates one. */
  sendLoginCode(email: string): Promise<void>;
  verifyLoginCode(email: string, code: string): Promise<void>;
  /** Always resolves when the request went out, so the form doesn't reveal which emails have accounts. */
  sendPasswordReset(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  /** Changes the signed-in user's password. Checks the current password first (re-authentication) and resolves only
   *  when Supabase Auth has actually applied the new one; otherwise throws a ServiceError with a message to show. */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Asks the auth server whether this browser still has a valid session. Throws if it can't be reached. */
  isSignedIn(): Promise<boolean>;
  /** Ends this browser's session. Never throws: signing out locally must always work. */
  signOut(): Promise<void>;
}

/** Supabase auth errors → a sentence for the user (same wording as the prototype's `friendly`). */
export function friendlyAuthError(error: unknown): string {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : (error as { message?: string } | null)?.message ?? "";
  const wait = msg.match(/after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds before asking for another email.`;
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox for the link.";
  if (/already registered|already been registered|user already exists/i.test(msg)) return "An account with this email already exists. Try signing in instead.";
  if (/signups not allowed for otp|user not found/i.test(msg)) return "No account found with this email. Please register first.";
  if (/token has expired|otp_expired|invalid.*otp/i.test(msg)) return "That code is wrong or has expired — request a new one.";
  if (/email address .* is invalid|invalid email/i.test(msg)) return "Please enter a valid email address.";
  if (/email rate limit/i.test(msg)) return "Too many emails have been sent from this site just now — please try again later.";
  if (/should be different|same_password/i.test(msg)) return "Your new password must be different from the current one.";
  if (/password should be at least|weak password|weak_password/i.test(msg)) return "Password is too short or too weak — use at least 6 characters.";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts — please wait a minute and try again.";
  if (/failed to fetch|network|load failed/i.test(msg)) return "Can't reach the server — check your internet connection.";
  return msg || "Something went wrong — please try again.";
}
