# Supabase → Own Backend (Encrypted API) Migration Guide

Notes saved for later implementation. Goal: frontend ab Supabase ko seedha call karne ki jagah **apne backend** ko call kare. Request body **encrypt** hoke jaye, response **encrypted** aaye aur frontend use **decrypt** karke state me set kare (CryptoJS).

Status: **NOT implemented yet.** Sirf plan hai.

---

## 1. Current situation (kya abhi hai)

- Zyadatar data browser se **seedha Supabase (PostgREST)** ko jata hai: `src/services/supabase/*` (14 files, ~291 `.from()/.rpc()/.storage` calls).
- Auth: Supabase Auth. Access token (JWT) + refresh token **cookies** me (`@supabase/ssr`). Permissions **RLS** (Row Level Security) se.
- Sirf ye 3 server routes apne hain: `/api/send-email`, `/api/ai/[name]`, `/api/account/delete`. Inme `Authorization: Bearer <access_token>` jata hai.
- Frontend code me khud ka encryption/decryption **nahi** hai. HTTPS + JWT + RLS pe depend hai.
- `src/proxy.ts` + `src/lib/supabase-proxy.ts` har request pe `getClaims()` se session check/refresh karte hain.

## 2. Architecture ka fayda (seam)

Har module me 3 cheezein hain (example reviewer):

```
services/reviewer.ts            → interface (ReviewerService) + getReviewerService()
services/supabase/reviewer.ts   → Supabase implementation
mocks/reviewer.ts               → fake data implementation
```

UI components sirf `getReviewerService()` use karte hain. Isliye **UI nahi badalna**. Bas teesri implementation `services/api/reviewer.ts` banao aur `getXService()` me select karo.

Service files jinke liye `api/` version banana hai:
`auth, account, account-extras, author-submissions, certificates, cfps, chair, conference-requests, conferences, flyers, notifications, profile, reviewer, instructions` (+ `activity.ts`, `feedback.ts`, `paper-ai.ts`, `action-emails.ts`, jo seedha `getSupabase()` use karte hain). Chair sabse bada hai.

---

## 3. Implementation steps

### Step 1: Dependency (approval chahiye, CLAUDE.md rule)
```bash
npm i crypto-js
npm i -D @types/crypto-js
```
CryptoJS maintenance mode me hai. Alternative: Web Crypto API (`crypto.subtle`, AES-GCM), koi dependency nahi.

### Step 2: Env
```
NEXT_PUBLIC_DATA_SOURCE=api
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_API_AES_KEY=<32 chars>     # browser me dikhegi (obfuscation, secret nahi)
```
`.env.local` owner ki permission ke bina edit nahi karna (CLAUDE.md).

### Step 3: `src/lib/crypto.ts`
```ts
import CryptoJS from "crypto-js";
const KEY = CryptoJS.enc.Utf8.parse(process.env.NEXT_PUBLIC_API_AES_KEY!);

export const encrypt = (data: unknown) => {
  const iv = CryptoJS.lib.WordArray.random(16);          // har request ka naya IV
  const ct = CryptoJS.AES.encrypt(JSON.stringify(data), KEY, { iv }).toString();
  return `${CryptoJS.enc.Base64.stringify(iv)}:${ct}`;
};

export const decrypt = <T,>(payload: string): T => {
  const [iv, ct] = payload.split(":");
  const txt = CryptoJS.AES.decrypt(ct, KEY, { iv: CryptoJS.enc.Base64.parse(iv) }).toString(CryptoJS.enc.Utf8);
  return JSON.parse(txt);
};
```
Backend me **same algorithm, mode, padding, IV format, key** hona chahiye, warna decrypt fail (sabse common bug).

### Step 4: `src/lib/api-client.ts` (sab calls yahin se)
```ts
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const token = getToken();                       // backend ka login token
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",                               // GET bhi POST, taaki params encrypt ho sakein
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ payload: encrypt(body ?? {}) }),
  });
  const json = await res.json();
  if (!res.ok) throw mapError(res.status, json);  // 401 → AuthRequiredError, baaki ServiceError
  return decrypt<T>(json.payload);
}
```
Error response encrypted hoga ya plain, ye backend ke saath tay karo.

### Step 5: `src/services/api/reviewer.ts` (example)
```ts
export const apiReviewerService: ReviewerService = {
  listAssignments: (slug) => api("/reviewer/assignments", { slug }),
  loadReview: (slug, paper) => api("/reviewer/review", { slug, paper }),
  saveReview: (id, paperId, values, submit) => api("/reviewer/review/save", { id, paperId, values, submit }),
  respond: (id, accept, reason) => api("/reviewer/respond", { id, accept, reason }),
  requestExtension: (id, date, reason) => api("/reviewer/extension", { id, date, reason }),
};
```
Backend response ka shape `src/types/*.ts` ke types jaisa rakho (`ReviewDetail`, `ReviewerAssignments`, ...). Tab UI me change nahi.

### Step 6: Switch
`src/lib/config.ts`: `DataSource = "supabase" | "mock" | "api"`.
Har `getXService()` me:
```ts
if (DATA_SOURCE === "api") return (await import("./api/reviewer")).apiReviewerService;
```
Project rule: **silent fallback nahi**. Ek time pe ek hi source.

### Step 7: Baaki 13 services same pattern se
Recommendation: pehle **reviewer** (5 methods) end-to-end chala ke verify karo, phir baaki.

---

## 4. Flow (implementation ke baad)

```
Component (e.g. review-form-page.tsx)
   │  getReviewerService().saveReview(...)
   ▼
services/api/reviewer.ts
   │  api("/reviewer/review/save", data)
   ▼
lib/api-client.ts
   │  1. data → JSON → AES encrypt → "iv:ciphertext"
   │  2. POST { payload } + Authorization: Bearer <token>   (HTTPS)
   ▼
Own Backend
   │  3. token verify → user pehchano
   │  4. payload decrypt → validate
   │  5. permission check (RLS ki jagah ab backend karega)
   │  6. DB operation
   │  7. response encrypt → { payload }
   ▼
lib/api-client.ts
   │  8. decrypt → typed object
   ▼
Service → Hook (e.g. use-review-detail.ts) → React state → UI
```

---

## 5. Dhyan dene wali cheezein (risks / TODO)

1. **Authentication badalna padega**: login/register/reset password abhi Supabase Auth (`services/supabase/auth.ts`, `features/auth/components/*`). Backend me login API chahiye. Token HttpOnly cookie me rakhna localStorage se safe. Ye "auth behaviour change" hai, **owner approval chahiye** (CLAUDE.md).
2. **`src/proxy.ts` + `src/lib/supabase-proxy.ts`**: abhi Supabase cookie check karte hain. Naye token/cookie ke hisaab se badalna hoga, warna har page `/login` pe redirect karega.
3. **RLS khatam, permissions backend me**: "reviewer sirf apne papers dekhe" jaise rules ab **har endpoint me backend ko enforce karne honge**. Sabse risky hissa; ek bhi check chhoota to data leak.
4. **File upload/download** (`.storage`: paper PDFs, photos, signed links): badi files ko CryptoJS+base64 se encrypt karna slow/memory-heavy. Multipart upload ya signed URL rakho, sirf metadata encrypt karo.
5. **Error mapping**: `services/supabase/shared.ts` ka `fail()` Supabase errors ko user-friendly message me badalta hai. Backend error codes ke liye `mapError()` banao. `AuthRequiredError` / `ServiceError` / `ServiceConfigError` (`services/errors.ts`) wahi use karo.
6. **Existing `/api/*` routes** (send-email, ai, account/delete) Supabase JWT verify karte hain; unhe bhi naye token pe shift karna hoga.
7. **Integrity**: CryptoJS default AES-CBC me tampering detect nahi hoti. Ya **HMAC add karo** (encrypt-then-MAC) ya **AES-GCM** (Web Crypto). Backend me bhi same.
8. **Key security**: `NEXT_PUBLIC_API_AES_KEY` browser me visible, to ye **obfuscation** hai. Asli security = HTTPS + token verify + backend permission checks. Agar real encryption chahiye: per-session key exchange (RSA/ECDH), key hardcode nahi.
9. **GET requests**: params bhi encrypt karne hon to sab POST karo (ya query ko ek encrypted `q` param me bhejo).
10. **Mock mode** (`NEXT_PUBLIC_DATA_SOURCE=mock`) UI kaam ke liye rahega; use mat todo.

---

## 6. Implement karne se pehle decide karna hai

1. Backend ke **endpoints list** aur request/response shapes?
2. **Auth**: Bearer token ya HttpOnly cookie? Login/refresh/logout endpoints?
3. **Encryption format**: AES mode (CBC/GCM), padding, IV kaise bheja, key kahan se, HMAC?
4. Error responses encrypted ya plain?
5. File storage kaise hoga (backend multipart / S3 signed URL)?
6. `crypto-js` dependency approval (ya Web Crypto)?
7. Migration order: reviewer → author → chair → baaki.

## 7. Related files (reference)

- `src/lib/config.ts` (DATA_SOURCE), `src/lib/supabase.ts`, `src/lib/supabase-proxy.ts`, `src/proxy.ts`
- `src/services/*.ts` (interfaces), `src/services/supabase/*.ts` (current impl), `src/services/errors.ts`, `src/services/supabase/shared.ts`
- `src/services/paper-ai.ts`, `action-emails.ts`, `account.ts` (Bearer token wale calls)
- `src/app/api/*` (server routes)
- `CLAUDE.md`, `PORT-PLAN.md` (project rules)
