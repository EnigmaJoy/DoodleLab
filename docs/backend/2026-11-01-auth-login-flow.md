# Auth — Login Flow Technical Analysis (2026-11-01)

How the end-to-end authentication flow works in the current backend on the
`feature/oauth` branch.

---

## Overview

Authentication is a BFF (Backend For Frontend) OAuth 2.0 Authorization Code
flow with PKCE. The NestJS backend acts as the confidential OAuth client.
Tokens never reach the browser; the browser only holds opaque session cookies.

```
Browser → NestJS BFF → Keycloak → Google OAuth → Keycloak → NestJS BFF → Browser
```

MFA is enforced at two levels:
- **Keycloak level** — the post-broker login flow requires OTP (ACR 2 / LOA 2)
  after every Google authentication.
- **Application level** — the session guard rejects sessions whose stored
  `acr` value is not `"2"`.

---

## Actors and Components

| Component | Role |
|-----------|------|
| **Browser** | Holds only `session_id` (httpOnly) and `XSRF-TOKEN` cookies |
| **NestJS BFF** (`AuthController`) | Drives the OAuth flow, creates/destroys sessions |
| **Keycloak** | Identity provider, enforces MFA, issues OIDC tokens |
| **Google OAuth** | External IdP, federated through Keycloak |
| **PostgreSQL** | Stores `pending_auth` (in-flight transactions) and `sessions` |

---

## Login Flow — Step by Step

### 1. Initiate (`GET /api/auth/login`)

`AuthController._initiateFlow('login')` runs:

1. `PendingAuthStore.create('login')` inserts a row into `pending_auth` with:
   - `id` — 32-byte random hex (becomes the `auth_tx` cookie value)
   - `state` — 32-byte random hex (CSRF protection for the callback)
   - `nonce` — 32-byte random hex (replay protection for the ID token)
   - `code_verifier` — 64-byte random hex (PKCE, never leaves the server)
   - `expires_at` — 10 minutes from now
2. `OidcClientService.buildAuthorizationUrl(...)` constructs the Keycloak
   authorization URL with:
   - `response_type=code`, `scope=openid email profile`
   - `state`, `nonce`, `code_challenge` (S256 hash of verifier), `kc_idp_hint=google`
   - `claims={"id_token":{"acr":{"essential":true,"values":["2"]}}}` — requests ACR 2
3. Response sets `auth_tx=<id>` cookie (`httpOnly`, `sameSite=lax`,
   `path=/api/auth`, 10 min TTL) and 302-redirects to Keycloak.

### 2. Keycloak + Google authentication

Keycloak receives the authorization request and:

1. Redirects to Google OAuth (because `kc_idp_hint=google`).
2. User authenticates with Google.
3. Google redirects back to Keycloak with an authorization code.
4. Keycloak exchanges the Google code internally and creates a federated session.
5. Keycloak runs the **post-broker login flow** (`post broker login with otp`):
   - **Condition — Level of Authentication** (LOA ≥ 2): current LOA is 0
     (fresh session), so the condition is satisfied — the sub-flow executes.
   - **OTP Form**: if the user has no TOTP configured, the `CONFIGURE_TOTP`
     required action fires (one-time setup, user scans a QR code and verifies
     a code). On subsequent logins the form just asks for the current OTP code.
   - After successful OTP, Keycloak sets LOA 2 on the session.
6. Keycloak 302-redirects to the registered `redirect_uri`
   (`http://localhost:3000/api/auth/callback`) with `code`, `state`, and
   `iss` query parameters.

### 3. Callback (`GET /api/auth/callback`)

`AuthController.callback(...)` runs:

1. Reads `auth_tx` from the request cookies. Returns `missing_auth_tx` error
   if absent.
2. Checks for `error` query param (e.g. `access_denied` from cancelled flow).
3. Extracts `code`, `state`, and `iss` from the query string.
4. `PendingAuthStore.consume(txId, state)` atomically deletes the
   `pending_auth` row, verifying `id`, `state`, and `expires_at > NOW()`.
   Returns `undefined` (→ `invalid_pending_auth` error) if the row is missing,
   the state doesn't match, or it has expired.
5. `OidcClientService.exchangeCode(...)` calls `authorizationCodeGrant` from
   `openid-client` v6 with:
   - A reconstructed callback URL containing `code` and `iss` (required by
     RFC 9207 — the library validates issuer identity).
   - `pkceCodeVerifier` — proves this is the same client that initiated the flow.
   - `expectedNonce` — verifies the ID token's `nonce` claim matches the stored value.
   - `skipStateCheck` — state was already verified by `consume()` above.
6. Keycloak's token endpoint returns `access_token`, `refresh_token`, and
   `id_token`. openid-client validates the ID token signature, `nonce`,
   expiry, and issuer.
7. ACR check: `idTokenClaims['acr'] !== '2'` → `acr_not_satisfied` error.
8. On success, the controller:
   - Generates a random `sessionId` (32 bytes) and `csrfToken` (32 bytes).
   - Encrypts both `refresh_token` and `id_token` with AES-256-GCM
     (`TokenCrypto`) using `TOKEN_ENCRYPTION_KEY`.
   - Calls `PgSessionStore.set(sessionId, record)` — stores `SHA-256(sessionId)`
     as the lookup key in the `sessions` table (raw session ID never stored).
   - Clears `auth_tx` cookie (maxAge 0).
   - Sets `session_id` cookie (`httpOnly`, `sameSite=strict`, `/`, no expiry
     header — expires with the browser session; TTL enforced server-side).
   - Sets `XSRF-TOKEN` cookie (readable by JS, used for CSRF protection).
   - 302-redirects to `FRONTEND_APP_URL`.

---

## Per-Request Authentication

Every protected route goes through two guards registered as global
`APP_GUARD`s:

### `SessionGuard`

1. Checks for `@Public()` decorator — if present, skips all auth.
2. Reads `session_id` cookie from the request.
3. `PgSessionStore.get(sessionId)` — looks up `SHA-256(sessionId)` in the DB,
   filters out expired rows.
4. Checks `session.expiresAt > Date.now()` (belt-and-suspenders; the SQL
   also filters).
5. Checks `session.acr === requiredAcr` (`"2"`) unless the route has
   `@SkipMfa()`.
6. Attaches `session`, `sessionId`, and `user` to the request object.

### `CsrfGuard`

- Skips `@Public()` routes and safe HTTP methods (GET, HEAD, OPTIONS).
- For state-changing methods (POST, PUT, DELETE, PATCH), reads the
  `X-CSRF-Token` request header and compares it to `session.csrfToken` using
  `timingSafeEqual` (constant-time comparison prevents timing attacks).

---

## Logout (`POST /api/auth/logout`)

1. Decrypts `encryptedIdToken` and `encryptedRefreshToken` from the session.
2. Deletes the session row from PostgreSQL.
3. Revokes the refresh token at Keycloak's token revocation endpoint
   (best-effort; errors are logged but don't block logout).
4. Clears `session_id` and `XSRF-TOKEN` cookies.
5. Returns `{ logoutUrl }` — the frontend must navigate to this URL to end
   the Keycloak SSO session (front-channel logout via `end_session_endpoint`
   with `id_token_hint` and `post_logout_redirect_uri`).

---

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Tokens never in browser | Only opaque `session_id` cookie is issued |
| Session fixation prevention | New `sessionId` generated on every login |
| Session ID not stored in DB | Only `SHA-256(sessionId)` stored; DB breach doesn't expose live sessions |
| Refresh / ID tokens at rest | AES-256-GCM encrypted with server-side key |
| CSRF protection | Double-submit pattern: `session.csrfToken` vs `X-CSRF-Token` header, constant-time compared |
| PKCE | `code_challenge` / `code_verifier` pair prevents authorization code interception |
| Nonce | Prevents ID token replay attacks |
| State | Prevents CSRF on the callback; validated by `PendingAuthStore.consume()` |
| ACR 2 enforcement | Both Keycloak (LOA 2 flow) and the session guard enforce MFA |
| Pending auth expiry | `pending_auth` rows expire after 10 minutes |
| Session expiry | Configurable via `SESSION_TTL_SECONDS` (default 1800 s); enforced in DB query and guard |

---

## Error Codes

Failures in the callback redirect the browser to
`FRONTEND_URL/?auth_error=<code>`:

| Code | Meaning |
|------|---------|
| `cancelled` | User cancelled (Keycloak returned `access_denied`) |
| `failed` | Any other failure (see `reason` in the server WARN log) |

Internal `reason` values logged server-side: `missing_auth_tx`,
`idp_error`, `missing_code_or_state`, `invalid_pending_auth`,
`token_exchange`, `acr_not_satisfied`.

---

## Database Tables

### `pending_auth`
Transient. One row per in-flight login attempt, deleted on consume or expiry.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `auth_tx` cookie value |
| `state` | text | Keycloak `state` parameter |
| `nonce` | text | OIDC nonce |
| `code_verifier` | text | PKCE verifier |
| `flow` | text | `'login'` or `'register'` |
| `expires_at` | timestamptz | 10 min TTL |

### `sessions`
One row per authenticated session.

| Column | Type | Notes |
|--------|------|-------|
| `id_hash` | text PK | `SHA-256(sessionId)` |
| `user_data` | jsonb | `{ sub, email, name, acr }` |
| `acr` | text | Must be `"2"` for full access |
| `csrf_token` | text | Compared against `X-CSRF-Token` header |
| `encrypted_refresh_token` | text | AES-256-GCM, `nonce:ciphertext:tag` |
| `encrypted_id_token` | text | AES-256-GCM, used for logout |
| `expires_at` | timestamptz | `SESSION_TTL_SECONDS` from login |

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `KEYCLOAK_ISSUER_URL` | OIDC discovery base URL |
| `KEYCLOAK_CLIENT_ID` | OAuth client ID (`agenda-bff`) |
| `KEYCLOAK_BFF_CLIENT_SECRET` | Client secret for token exchange |
| `KEYCLOAK_REDIRECT_URI` | Registered callback URL |
| `KEYCLOAK_REQUIRED_ACR` | Required ACR value (`"2"`) |
| `TOKEN_ENCRYPTION_KEY` | 64-hex-char AES-256 key for token encryption at rest |
| `SESSION_TTL_SECONDS` | Session lifetime in seconds (default 1800) |
| `FRONTEND_APP_URL` | Post-login redirect target |
| `FRONTEND_URL` | Post-logout redirect target |
