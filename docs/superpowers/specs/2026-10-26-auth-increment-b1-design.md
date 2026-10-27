# Authentication Increment B-1 Design

**Goal:** Add working Google OAuth registration and login with Keycloak-enforced TOTP MFA to the
NestJS BFF, backed by a PostgreSQL session store, runnable entirely from local Docker Compose.

**Scope boundary:** B-1 ends when a developer can register via Google, complete TOTP enrollment,
and hold a verified ACR-2 session locally. OCI staging deployment is B-2 (separate spec).

---

## Section 1 - HTTP topology and routing

**Single browser-facing origin:** `http://localhost:3000` (Next.js).

NestJS runs on `http://localhost:3001` and is never accessed directly by the browser. Next.js
proxies all `/api/**` requests to NestJS via a `rewrites` rule in `next.config.ts`:

```
/api/**  ->  http://localhost:3001/api/**
```

This makes cookies set by NestJS land on the `localhost:3000` origin (the browser sees responses
as coming from Next.js). No CORS is required for browser-to-API communication.

**Exact browser URL map:**

| Step                  | Browser URL                                      | Internal destination                        |
|-----------------------|--------------------------------------------------|---------------------------------------------|
| Welcome               | `http://localhost:3000/`                         | Next.js, served without authentication      |
| Login initiation      | `http://localhost:3000/api/auth/login`           | NestJS `GET /api/auth/login`                |
| Register initiation   | `http://localhost:3000/api/auth/register`        | NestJS `GET /api/auth/register`             |
| OIDC callback         | `http://localhost:3000/api/auth/callback`        | NestJS `GET /api/auth/callback`             |
| User identity         | `http://localhost:3000/api/auth/me`              | NestJS `GET /api/auth/me`                   |
| Logout                | `http://localhost:3000/api/auth/logout` (POST)   | NestJS `POST /api/auth/logout`              |
| Authenticated view     | `http://localhost:3000/?view=menu`               | Next.js, `AppShell` renders `MENU_CLOSED`   |
| Section pages          | `http://localhost:3000/calendario` (etc.)        | Next.js, protected by middleware            |

**Routing note:** The app has no `/app` route. The authenticated view is the same page as
Welcome (`/`) with the `?view=menu` query parameter, which causes `page.tsx` to pass
`initialView: 'MENU_CLOSED'` to `AppShell`. The radial menu renders from there. Section pages
(`/calendario`, `/esercizi`, `/inbox`, `/lavagna`, `/oggi`, `/quaderno`) are the separately
routed authenticated views that the middleware protects.

**Registered OIDC redirect_uri in Keycloak:** `http://localhost:3000/api/auth/callback`
This value is stored in the realm JSON and matches what NestJS uses in authorization requests.

**Cookie attributes** (all cookies are host-bound to `localhost`; no explicit `Domain` attribute):

| Cookie       | httpOnly | SameSite | Path      | Max-Age       | Purpose                             |
|--------------|----------|----------|-----------|---------------|-------------------------------------|
| `auth_tx`    | true     | Lax      | /api/auth | 600s          | Opaque pending-auth transaction ref |
| `session_id` | true     | Strict   | /         | none (session)| Application session reference       |
| `XSRF-TOKEN` | false    | Strict   | /         | none (session)| CSRF double-submit value            |

`auth_tx` must be `SameSite=Lax` because the Keycloak redirect back to `/api/auth/callback` is
a top-level browser navigation (GET) originating from the Keycloak domain. Strict would suppress
the cookie on that cross-site navigation.

`session_id` uses `Path=/` so that it is sent on both API requests (`/api/**`) and page requests
(`/calendario`, etc.). The middleware reads it from page requests; NestJS reads it from API
requests. `Path=/api` would block the middleware from seeing it on section-page requests.

`session_id` has no `Max-Age` - it expires when the browser session ends. The session record in
PostgreSQL enforces the real absolute expiry.

**After a successful callback:** NestJS returns `302 Location: http://localhost:3000/?view=menu`.
NestJS must use the absolute URL here; the Next.js rewrite proxy does not follow redirects
internally. Use `FRONTEND_APP_URL` env var (default `http://localhost:3000/?view=menu`). The
`?view=menu` parameter causes `AppShell` to render the radial menu immediately.

---

## Section 2 - Local Docker Compose environment

**Stack** (all run via `docker compose` from `backend/`):

| Service       | Image                                  | Port  |
|---------------|----------------------------------------|-------|
| `postgres`    | `postgres:17-alpine`                   | 5432  |
| `keycloak`    | `quay.io/keycloak/keycloak:26.8.1`     | 8080  |

Both images publish `linux/amd64` and `linux/arm64` multi-arch manifests. NestJS and Next.js run
locally via `pnpm dev` - no containers for application processes in B-1.

**PostgreSQL** hosts two databases on one container:

- `keycloak` database, owned by `keycloak_user`
- `agenda_app` database, owned by `agenda_user`

The `postgres` superuser is used only during container init (`backend/docker/init-db.sql`) to
create both databases and grant ownership. After init, `agenda_user` connects with a password
from `AGENDA_DB_PASSWORD`; `keycloak_user` connects with a password from `KEYCLOAK_DB_PASSWORD`.
Neither user has cross-database access.

**Persistent volume:** PostgreSQL data is mapped to a named volume (`postgres_data`). Keycloak
data (including users, TOTP enrollment, and realm configuration) persists across `docker compose
down` and restarts. `docker compose down -v` deletes the volume (destructive, documented).

**Environment variables** are loaded from `backend/.env.local` (gitignored) via Docker Compose
`env_file: .env.local`. A committed `backend/.env.local.example` documents every required
variable with safe placeholder values. NestJS and Next.js also read `.env.local` files in their
respective directories via dotenv.

**Healthchecks:**

PostgreSQL:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 3s
  retries: 10
```

Keycloak (26.x exposes health on the **management port 9000**, not the main HTTP port 8080):
```yaml
healthcheck:
  test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /health/ready HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && grep -q 'UP' <&3"]
  interval: 10s
  timeout: 5s
  retries: 18
  start_period: 45s
```

Port 9000 is the Keycloak management interface (Quarkus Vert.x management server). It is not
mapped to a host port in `docker-compose.yml` - it is used only inside the container for the
healthcheck. The main application port (8080) is mapped to the host. `curl` and `wget` are not
reliably present in the UBI9-minimal image; the bash TCP redirect (`/dev/tcp`) is available.

The exact healthcheck command must be confirmed when running the pinned image for the first time.
If `/dev/tcp` is unavailable in the image's shell, fall back to installing `curl` in a custom
`Dockerfile.keycloak` layer (documented in `docs/local-auth-setup.md`).

Keycloak's `depends_on.postgres.condition: service_healthy`. NestJS startup waits for both
services to be healthy before accepting connections (documented in local setup guide; NestJS does
not itself poll Docker - the developer runs NestJS after `docker compose up -d` reports healthy).

**Application startup failures:** NestJS must terminate with a non-zero exit code if any of the
following are missing or fail:

- `DATABASE_URL` is not set
- `SESSION_SECRET` is not set
- `TOKEN_ENCRYPTION_KEY` is not set
- Database connection cannot be established on first query
- Migration runner throws (any SQL error or transaction failure)
- OIDC discovery fails (network error or unexpected issuer metadata)

Throw from `onApplicationBootstrap`; NestJS will propagate the error and exit. This is preferable
to silently starting in a degraded state.

---

## Section 3 - Keycloak realm configuration

**Version:** `quay.io/keycloak/keycloak:26.8.1` (exact tag, pinned).

**Realm JSON:** version-controlled at `backend/keycloak/agenda-realm.json`. Imported on first
Keycloak startup via `--import-realm`. If the realm already exists (normal restart with a
persistent volume), Keycloak skips import entirely - it does not overwrite or merge. Existing
users, TOTP enrollment, sessions, and realm configuration are preserved.

The realm JSON is committed without secrets. Values that differ per environment use the
`${VARIABLE}` syntax, resolved from container environment variables at import time:

```
${GOOGLE_CLIENT_ID}
${GOOGLE_CLIENT_SECRET}
${KEYCLOAK_BFF_CLIENT_SECRET}
${KEYCLOAK_REDIRECT_URI}      -- http://localhost:3000/api/auth/callback
${FRONTEND_URL}               -- http://localhost:3000
```

**Keycloak client:** `agenda-bff` (confidential, Authorization Code flow, PKCE required). Client
secret injected from `${KEYCLOAK_BFF_CLIENT_SECRET}`. Valid redirect URIs include
`${KEYCLOAK_REDIRECT_URI}`. This single client handles both login and registration flows.

**Google Identity Provider:**

- Registered as a Keycloak Identity Provider (Google OpenID Connect built-in).
- Client ID and secret injected from `${GOOGLE_CLIENT_ID}` and `${GOOGLE_CLIENT_SECRET}`.
- Account linking: `First Login Flow` = `first broker login` (Keycloak default). Creates a
  local Keycloak user and links the Google account on first login.
- **Sync Mode: `LEGACY`** (not `FORCE`). Force overwrites locally-edited profile fields on every
  token refresh, which is a silent data-loss risk. Legacy syncs only on first link.

**MFA - post-broker login flow:**

- After Google federated login, the `post-broker-login` flow requires TOTP. Users without a
  TOTP device are prompted to enroll. Users with an enrolled device enter their code.
- This is enforced by Keycloak before the authorization code is issued. NestJS never receives a
  token without ACR 2 from a correct realm configuration.
- ACR/LoA mapping in the realm: LoA Level 2 -> ACR value `"2"`. Keycloak includes `"acr": "2"`
  in ID tokens when TOTP has been satisfied in the current SSO session.

**OIDC authorization request - ACR enforcement:**

NestJS includes the `claims` parameter in every authorization request to require ACR 2
explicitly, even when an existing Keycloak SSO session is present:

```json
{"id_token": {"acr": {"essential": true, "values": ["2"]}}}
```

With `essential: true`, if Keycloak cannot satisfy ACR 2 (e.g., existing session is ACR 1 with
no TOTP), it must re-prompt for TOTP rather than issuing a degraded token. If Keycloak cannot
satisfy the essential claim at all, it returns an error to the callback. NestJS must handle this
as a 400 (authentication failure, user should retry).

**LoA Max Age (Keycloak 26.x):**

Keycloak 26.x supports a per-level LoA Max Age setting, separate from SSO Session Idle. This
allows TOTP to be re-required after N seconds have passed since the last TOTP verification, even
within an active SSO session. For B-1, LoA Level 2 Max Age is set equal to Client Session Idle
(1800s) in the realm JSON. This means: within 30 minutes of completing TOTP, a returning user
can get a new session without re-entering TOTP (the Keycloak SSO session satisfies ACR 2).
After 30 minutes, TOTP is required again. The exact realm JSON field is
`"loa"` -> `"loaMap"` -> `"2"` -> `"maxAge"`. Verify against 26.8.1 documentation during
implementation - field names may differ from older Keycloak versions.

**Registration vs Login - actual semantics:**

Both `GET /api/auth/register` and `GET /api/auth/login` initiate an authorization code flow
via Keycloak. For a realm using Google as the only IDP with no local password logins enabled,
the distinction is cosmetic: Keycloak shows a registration-flavored page vs a login-flavored
page, but both flows federate through Google and result in the same post-broker TOTP requirement.

For existing users, both flows return the existing linked account. For new users, both flows
create a new Keycloak user. The implementation must verify whether Keycloak 26.8.1 exposes a
distinct registration endpoint (e.g., `/realms/agenda/protocol/openid-connect/registrations`)
that meaningfully differs from the standard auth endpoint during the implementation task.
Do not claim distinct registration behavior until verified.

**Google SSO and RP-initiated logout:**

Terminating the Keycloak SSO session via RP-initiated logout does NOT force Google to
re-authenticate the user. Google maintains its own session independently. After Keycloak logout,
clicking Accedi will re-initiate the Keycloak flow; if the Google session is still active,
Google may redirect back to Keycloak without prompting for credentials, resulting in Keycloak
creating a new SSO session automatically. The user will still be required to complete TOTP
(because the new Keycloak SSO session has no prior ACR 2 assertion).

**Session and token lifetimes** (hardcoded in realm JSON for B-1):

| Setting                      | Value    | Seconds  |
|------------------------------|----------|----------|
| SSO Session Idle             | 30 min   | 1800     |
| SSO Session Max              | 8 hours  | 28800    |
| Client Session Idle          | 30 min   | 1800     |
| Client Session Max           | 8 hours  | 28800    |
| Access Token Lifespan        | 5 min    | 300      |
| Refresh Token (= Client Idle)| 30 min   | 1800     |

TOTP is re-prompted when the Keycloak SSO session expires (idle or max). Within an active SSO
session, TOTP is not re-prompted on every page load. This is the expected UX.

SSO Session Idle and MFA Max Age are not independently configurable in Keycloak without custom
SPI work. For B-1, SSO Session Idle (30 min) serves as the effective MFA max age.

**Keycloak startup command** (in `docker-compose.yml`):

```yaml
command: ["start-dev", "--import-realm"]
```

`start-dev` is for local development only. `start` (production hardened mode) is required for B-2.

---

## Section 4 - Pending-auth transaction (server-side PKCE and state)

PKCE verifiers, nonces, and state values must not be stored in the browser as readable JSON.
They are stored server-side in a `pending_auth` table with an opaque reference cookie.

**`pending_auth` table** (added to `001_create_sessions.sql` or a separate `002_create_pending_auth.sql`):

```sql
CREATE TABLE IF NOT EXISTS pending_auth (
  id            VARCHAR(64)  PRIMARY KEY,
  state         VARCHAR(64)  NOT NULL UNIQUE,
  nonce         VARCHAR(64)  NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  flow          VARCHAR(16)  NOT NULL,  -- 'login' or 'register'
  expires_at    TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pending_auth_expires_at_idx ON pending_auth (expires_at);
```

**Flow:**

`GET /api/auth/login` and `GET /api/auth/register`:

1. Generate: `id` (32 bytes hex), `state` (32 bytes hex), `nonce` (32 bytes hex), `code_verifier` (64 bytes hex)
2. Insert into `pending_auth` with `flow = 'login'` or `'register'`, `expires_at = now + 10 minutes`
3. Set `auth_tx` cookie to `id` (httpOnly, SameSite=Lax, Max-Age=600, Path=/api/auth)
4. Build the Keycloak authorization URL:
   - Login: standard `/protocol/openid-connect/auth` with scope `openid email profile`
   - Register: `/protocol/openid-connect/auth` with `kc_action=VERIFY_PROFILE` OR redirect to
     `/protocol/openid-connect/registrations` - the difference is cosmetic (Keycloak presents a
     registration form vs login form). Both reach the same callback. Document the chosen
     Keycloak-version-specific endpoint in `docs/local-auth-setup.md` after verifying with 26.8.1.
5. Both requests include: `claims` parameter enforcing ACR 2, `code_challenge` (S256), `code_challenge_method`, `state`, `nonce`
6. Return `302 Location: <Keycloak authorization URL>`

`GET /api/auth/callback`:

1. Read `auth_tx` cookie - if absent, return 400
2. **Atomically consume the pending-auth transaction:**
   ```sql
   DELETE FROM pending_auth
   WHERE id = $1 AND state = $2 AND expires_at > NOW()
   RETURNING nonce, code_verifier, flow
   ```
   Pass the `auth_tx` cookie value as `$1` and the URL `state` param as `$2`. If no rows are
   returned (not found, wrong state, expired, or already consumed by a concurrent request),
   return 400. There is no SELECT followed by a separate DELETE - the single DELETE RETURNING
   is the only operation. PostgreSQL row-level locking ensures only one concurrent caller can
   delete the row and receive RETURNING data.
3. Call `OidcClientService.exchangeCode()` with `code`, `code_verifier`, `nonce` from the row
4. Verify ID token claims (openid-client handles: sig, iss, aud, nonce, exp); any failure -> 400
5. Extract `sub`, `email`, `name`, `acr` from ID token claims
6. If `acr !== '2'`: return 401 (hard invariant; Keycloak should have enforced TOTP)
7. If Keycloak returned an error param (e.g., user cancelled): return 400 with no sensitive detail
8. Proceed to session creation (Section 5)

**Concurrent login attempts:** if the user starts a second login before completing the first,
the new `auth_tx` cookie overwrites the old one in the browser. The old `pending_auth` row
remains in the table until its `expires_at` passes. This is safe; only the holder of both the
`auth_tx` id AND the matching `state` parameter can consume a transaction.

**Replay prevention:** once the DELETE RETURNING executes, the row is gone. Any subsequent
callback request with the same `auth_tx` cookie finds no row and receives 400. This prevents
replay attacks on the authorization code.

---

## Section 5 - NestJS OIDC flow

**openid-client v6 compatibility note:**

openid-client v6 is ESM-only. NestJS compiles to CommonJS. The `await import('openid-client')`
pattern inside `OidcClientService.onModuleInit()` loads the ESM module lazily at runtime.
Node.js 24 supports `require(esm)` natively; `nest build` externalises `node_modules` (not
bundled), so the module is loaded by Node at runtime.

**This must be verified during Task 1 of implementation:** run `pnpm build:api && pnpm start:api`
and confirm OIDC discovery completes without ESM-related errors. If it fails, document the
exact error in the task result and resolve before proceeding.

Unit tests mock openid-client: `jest.mock('openid-client', factory, { virtual: true })`.

**`OidcClientService` (`backend/src/auth/oidc/oidc-client.service.ts`):**

Implements `OnModuleInit`. Injects `ConfigService` for OIDC config.

`onModuleInit()`:
1. `const { discovery } = await import('openid-client')`
2. `this.serverMetadata = await discovery(new URL(KEYCLOAK_ISSUER_URL), CLIENT_ID, CLIENT_SECRET)`
3. Stores the server metadata object for reuse
4. Logs "OIDC discovery complete" at INFO level (no secrets in the log)

`buildAuthorizationUrl(txId, state, nonce, codeVerifier, flow)`:
- Constructs the authorization URL with all required parameters including the `claims` parameter
- Returns the URL string

`exchangeCode(code, codeVerifier, nonce, redirectUri)`:
- Calls the token endpoint via openid-client
- Returns `{ idTokenClaims, refreshToken, idTokenRaw }` where `idTokenRaw` is the raw JWT string
  for RP-initiated logout later

`revokeToken(token, tokenTypeHint)`:
- Posts to the revocation endpoint
- Best-effort; logs a warning on failure but does not throw

`buildLogoutUrl(idTokenRaw, postLogoutRedirectUri)`:
- Constructs the RP-initiated logout URL using `end_session_endpoint` from server metadata

**Session creation** (continuation of callback steps 9-13 from Section 4):

9. Generate `sessionId` (32 bytes hex, `crypto.randomBytes(32).toString('hex')`)
10. Compute `sessionIdHash = createHash('sha256').update(sessionId).digest('hex')`
11. Encrypt `refreshToken` with AES-256-GCM using `TOKEN_ENCRYPTION_KEY` (see Section 7)
12. Encrypt `idTokenRaw` with AES-256-GCM (needed for RP-initiated logout)
13. Generate `csrfToken` (32 bytes hex)
14. Insert into `sessions` using `sessionIdHash` as the DB key
15. Set `session_id` cookie to raw `sessionId` (httpOnly, SameSite=Strict, Path=/api, no Max-Age)
16. Set `XSRF-TOKEN` cookie to `csrfToken` (httpOnly=false, SameSite=Strict, Path=/)
17. Clear `auth_tx` cookie (Max-Age=0)
18. Return `302 Location: ${FRONTEND_APP_URL}` (e.g., `http://localhost:3000/app`)

**`SessionGuard` lookup** (existing guard, updated lookup path):

The guard reads `request.cookies['session_id']`, computes its SHA-256 hash, queries
`PgSessionStore.get(hash)`. The store's `get(id)` method receives the hash as the key.
No changes to the guard's public interface; the hash computation is inside `PgSessionStore.get`.

---

## Section 6 - PostgreSQL session store + migrations

**`sessions` table** (`backend/migrations/001_create_sessions.sql`):

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id_hash                  VARCHAR(64)  PRIMARY KEY,  -- SHA-256(raw session_id)
  user_data                JSONB        NOT NULL,      -- serialised AuthenticatedUser
  acr                      VARCHAR(8)   NOT NULL,
  csrf_token               VARCHAR(64)  NOT NULL,
  encrypted_refresh_token  TEXT         NOT NULL,      -- nonce:ciphertext:tag (hex)
  encrypted_id_token       TEXT         NOT NULL,      -- nonce:ciphertext:tag (hex)
  expires_at               TIMESTAMPTZ  NOT NULL,      -- created_at + SESSION_TTL_SECONDS
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
```

**`PgSessionStore` get/set/delete:**

`get(idHash)`: `SELECT ... WHERE id_hash = $1 AND expires_at > NOW()`.
Returns `undefined` if expired.

`set(idHash, record)`: INSERT. Used only on session creation. No upsert - each login creates a
new record; logout deletes it.

`delete(idHash)`: `DELETE WHERE id_hash = $1`.

**`SessionRecord` type** (updated):
```typescript
export interface SessionRecord {
  readonly user:                   AuthenticatedUser
  readonly acr:                    string
  readonly csrfToken:              string
  readonly encryptedRefreshToken:  string
  readonly encryptedIdToken:       string
  readonly expiresAt:              number   // milliseconds epoch
}
```

**Session TTL** (`SESSION_TTL_SECONDS`, default 1800):

The local session TTL is set to match Keycloak's Client Session Idle (1800s = 30 minutes). This
ensures the local session never outlives the underlying Keycloak authorization state:

- At session creation: `expires_at = NOW() + 1800s`
- No sliding window, no UPDATE on each request
- At `expires_at`: local session expired; NestJS returns 401; user must re-authenticate

**Why no sliding window in B-1:**

A sliding idle window would allow the local session to extend past the point at which the
Keycloak refresh token has expired, creating authorization state that cannot be verified against
the provider without a token refresh implementation. Rather than implement silent token refresh
in B-1 (which requires atomic rotation, retry logic, and concurrent-request handling), B-1 adopts
a fixed absolute session TTL equal to Keycloak's Client Session Idle. The two lifetimes are
aligned by configuration.

Revocation latency: if a Keycloak administrator revokes a user's session or disables the account,
the application session remains locally valid for up to `SESSION_TTL_SECONDS` (30 minutes) after
the revocation. This is the accepted trade-off for B-1. Silent refresh with provider-state
verification is deferred to B-2.

**Session expiry handling in `SessionGuard`:**

`SessionGuard.get` returns `undefined` for expired sessions (the DB query filters by
`expires_at > NOW()`). The guard throws `UnauthorizedException` on `undefined`. The frontend
receives 401 and redirects to `/api/auth/login`.

**Migration runner** (`backend/src/auth/migration-runner.service.ts`):

Executed in `AppModule.onApplicationBootstrap`. Algorithm:

1. Create `_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)` if not exists (in a
   separate `BEGIN ... COMMIT` block before the main loop)
2. Read `*.sql` files from `backend/migrations/` sorted alphabetically
3. For each file not in `_migrations`: run its SQL in a transaction, then insert the filename
4. If any step throws, re-throw (NestJS exits non-zero)

Migration files are immutable after commit. New schema changes get new numbered files.

---

## Section 7 - Refresh token and ID token encryption

`TOKEN_ENCRYPTION_KEY` is a 32-byte AES-256-GCM key, stored as a 64-character hex string in
`.env.local`. Generated with `openssl rand -hex 32`. This key is separate from `SESSION_SECRET`.

**Encryption format** (stored in `encrypted_refresh_token` and `encrypted_id_token` columns):

```
<nonce_hex>:<ciphertext_hex>:<auth_tag_hex>
```

- `nonce`: 12 bytes random, unique per encryption operation
- Algorithm: AES-256-GCM (Node.js `crypto.createCipheriv('aes-256-gcm', keyBuffer, nonceBuffer)`)
- `auth_tag`: 16 bytes, appended after `cipher.final()`

`TokenCrypto` helper (`backend/src/auth/token/token-crypto.ts`):
- `encrypt(plaintext: string): string` - returns the colon-separated format above
- `decrypt(stored: string): string` - splits by `:`, decrypts, verifies tag, returns plaintext
- On decryption failure (bad tag, wrong key, malformed input): throws `InvalidTokenError`

When `decrypt` throws:
1. Log a WARNING with session ID hash only (no plaintext token, no key material)
2. Delete the session from the store
3. Return 401 to the client

**Key rotation:** changing `TOKEN_ENCRYPTION_KEY` invalidates all stored refresh and ID tokens.
Active sessions will fail on first refresh attempt (decrypt throws, session deleted). Users
must re-authenticate. Document this in `.env.local.example` and `docs/local-auth-setup.md`.

**Logging policy:** NestJS must never log:
- Raw `session_id` values
- Raw or encrypted tokens
- CSRF tokens
- `TOKEN_ENCRYPTION_KEY` or `SESSION_SECRET` values
- Any value from `request.cookies`

Log the SHA-256 hash of the session ID (the `id_hash`) for correlation in debug logs.

---

## Section 8 - CSRF protection

On session creation, a random `csrf_token` (32 bytes hex) is stored in the `sessions` row and
written as the `XSRF-TOKEN` cookie (httpOnly=false, SameSite=Strict, Path=/).

`CsrfGuard` is applied as `APP_GUARD` alongside `SessionGuard` (registered after it in
`AuthModule`). It runs on all state-changing requests (POST, PUT, DELETE, PATCH):

1. If the route is `@Public()`, skip
2. Read `X-CSRF-Token` header
3. Compare to `session.csrfToken` from the already-validated session (SessionGuard runs first)
4. If absent or mismatched, return 403

Next.js reads the `XSRF-TOKEN` cookie via `document.cookie` parsing and attaches
`X-CSRF-Token: <value>` on all non-GET fetch calls via the shared `apiFetch` wrapper.

---

## Section 9 - Session lifecycle

**Creation:** on successful OIDC callback (Section 5, steps 9-18). `expires_at` is set to
`NOW() + SESSION_TTL_SECONDS` (default 1800s). No updates to the session row after creation.

**Validation per request:** `SessionGuard` executes:

```sql
SELECT user_data, acr, csrf_token, encrypted_refresh_token, encrypted_id_token, expires_at
FROM sessions
WHERE id_hash = $1 AND expires_at > NOW()
```

If no rows returned (not found, expired, or deleted by concurrent logout), throw
`UnauthorizedException`. There is no row update on every request - expiry is absolute.

**Logout** (see Section 10 for full detail): delete session, clear cookies, initiate
RP-logout at Keycloak.

**Browser restart behavior:** `session_id` has no `Max-Age` - it is a session cookie that the
browser discards on close. On the next visit the user sees the Welcome screen. The orphaned
PostgreSQL row expires at `expires_at` without being queried. A periodic cleanup job (B-2+) will
prune expired rows; in B-1 they accumulate harmlessly.

**Revocation latency:** up to 1800s after Keycloak revocation or account disablement, the local
session remains valid. This is the documented and accepted B-1 trade-off. Silent refresh with
provider re-verification is B-2.

---

## Section 10 - Logout

**`POST /api/auth/logout`** (protected; requires valid session):

1. Read `session_id` cookie, compute hash, look up session
2. Decrypt `encrypted_id_token` from the session row (needed for `id_token_hint`)
3. Delete session row from `sessions`
4. Clear `session_id` cookie (Max-Age=0, Path=/, SameSite=Strict)
5. Clear `XSRF-TOKEN` cookie (Max-Age=0)
6. Best-effort: call `OidcClientService.revokeToken(decryptedRefreshToken, 'refresh_token')`
   - Revokes the refresh token at Keycloak. Logs a warning on failure; does not throw.
   - Revoking the refresh token prevents the token from being used for new access tokens but
     does **not** terminate the Keycloak SSO session.
7. Build and return the RP-initiated logout URL via `OidcClientService.buildLogoutUrl(...)`:
   ```
   {KEYCLOAK_ISSUER_URL}/protocol/openid-connect/logout
     ?id_token_hint={id_token_raw}
     &post_logout_redirect_uri={FRONTEND_URL}
     &client_id=agenda-bff
   ```
8. Return `{ logoutUrl }` as JSON (200), not a 302. The frontend is responsible for navigating to
   the logout URL, which terminates the Keycloak SSO session and redirects back to `FRONTEND_URL`.

**Why the frontend navigates instead of NestJS redirecting:**

A 302 from NestJS to the Keycloak logout URL would be followed by the browser as a GET to
Keycloak's logout page. Keycloak then redirects to `post_logout_redirect_uri` (Welcome screen).
This works for a full-page flow. For an SPA that uses `fetch`, return JSON and let the frontend
do `window.location.href = logoutUrl`. Either approach is valid; the spec uses the SPA pattern
(fetch + JS redirect) since the frontend already uses fetch for API calls.

**After RP-initiated logout:**

The user is redirected to `http://localhost:3000` (Welcome screen). Clicking Accedi starts a new
authorization request. Since the Keycloak SSO session was terminated by the RP-initiated logout,
the user must re-authenticate with Google and TOTP.

**Backchannel logout:** out of scope for B-1. Document: NestJS does not implement a backchannel
logout endpoint. A Keycloak admin action that invalidates a session will not immediately terminate
an active application session. The application session expires at `expires_at` at the latest
(within 1800s of the revocation).

**Distinction of logout types:**

| Action                                              | Scope                             |
|-----------------------------------------------------|-----------------------------------|
| Delete session row + clear cookies                  | Ends this application session only|
| `revokeToken(refreshToken, 'refresh_token')`        | Prevents new access tokens only   |
| RP-initiated logout (end_session_endpoint)          | Terminates Keycloak SSO session   |
| Backchannel logout (out of scope)                   | Server-push invalidation          |

Revoking the refresh token does not terminate the Keycloak SSO session. RP-initiated logout does.
The implementation does both: revoke the token AND initiate provider logout.

---

## Section 11 - Welcome screen and middleware

**Welcome route (`/`) must remain accessible without authentication.** The Next.js middleware
protects only explicitly authenticated section routes.

**Existing routing structure** (verified from codebase):

- `/` - single-page entry point. `page.tsx` passes `initialView` to `AppShell`:
  - `?view=menu` -> `initialView: 'MENU_CLOSED'` -> radial menu renders
  - no param -> `initialView: 'WELCOME'` -> Welcome screen renders
- `/calendario`, `/esercizi`, `/inbox`, `/lavagna`, `/oggi`, `/quaderno` - section pages

The app has no `/app` route. The authenticated "app" view is `/?view=menu`. Section pages are
the routed views that require authentication.

**`prototypes/ui-shell/middleware.ts`:**

```typescript
export const config = {
  matcher: ['/calendario', '/esercizi', '/inbox', '/lavagna', '/oggi', '/quaderno'],
}

export default function middleware(req: NextRequest) {
  const session = req.cookies.get('session_id')
  if (!session) {
    return NextResponse.redirect(new URL('/api/auth/login', req.url))
  }
  return NextResponse.next()
}
```

Only the section pages are protected. `/`, `/api/**`, and `/_next/**` are never intercepted by
the middleware.

The middleware performs a presence-only check on `session_id` (now `Path=/` so the browser sends
it with page requests). The backend validates the session on every API call. A stale cookie will
pass middleware but receive 401 from NestJS. The frontend handles 401 by redirecting to login.

**No redirect loops:**

- `/` - not matched; always accessible (Welcome or radial menu based on `?view`)
- `/calendario` etc. - matched; redirects to `/api/auth/login` if no cookie
- `/api/auth/login` - not matched; proxied to NestJS by Next.js rewrite
- Post-login: NestJS redirects to `/?view=menu`, middleware does not match `/`, user sees menu

**After successful authentication:** NestJS redirects to `http://localhost:3000/?view=menu`.
`AppShell` renders `MENU_CLOSED` (radial menu). No changes to radial menu, palettes, animations,
or section navigation.

**Existing vault protection:** the encrypted local vault (Increment A) is independent of
the identity provider. Vault keys are derived from local user-entered material, not from
OAuth tokens. Connecting an identity provider does not alter vault keys, does not overwrite
the vault, and does not silently rebind it to a Keycloak account.

---

## Section 12 - Next.js integration

Next.js communicates with NestJS only via HTTP. No direct database or Keycloak access.

**`next.config.ts` rewrites:**

```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3001'}/api/:path*`,
    },
  ]
}
```

`NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:3001` for local dev.

**`useCurrentUser()` hook:** calls `GET /api/auth/me` on first render. Returns
`{ sub, email, name } | null`. Held in a React context provided by `AuthProvider` in `AppShell`.
A 401 response clears the user context; the consuming component redirects to `/api/auth/login`.

**`lib/apiFetch.ts` (CSRF header wrapper):**

```typescript
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const csrfToken = getCookie('XSRF-TOKEN')
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }
  return fetch(url, { ...init, headers, credentials: 'include' })
}
```

**Login / Register buttons:** `WelcomeScreen` uses `window.location.href` for both Accedi
and Registrati, pointing to `/api/auth/login` and `/api/auth/register` respectively.
These are NestJS endpoints (proxied via Next.js rewrites). No handcrafted Keycloak URLs in
the frontend.

**Environment variables (`prototypes/ui-shell/.env.local.example`):**

```
NEXT_PUBLIC_AUTH_CONFIGURED=true
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

---

## Section 13 - Testing strategy

**Legend:**
- `[unit]` - runs in `pnpm test` (no external dependencies)
- `[int]` - skipped unless `RUN_INTEGRATION_TESTS=true` and `DATABASE_URL` set (requires PostgreSQL)
- `[live]` - manual only; requires real running Keycloak + Google account; not automated

---

**Existing unit tests (unchanged):**
- `test/unit/session.guard.spec.ts` (12 tests) [unit]
- `test/unit/keycloak-token.verifier.spec.ts` (9 tests) [unit]

---

**`test/unit/pg-session.store.spec.ts`** [unit] - mocks `pg.Pool.query`:

- `get` - valid session, `expires_at` in future -> returns `SessionRecord`
- `get` - `expires_at` in past -> returns `undefined` (DB WHERE clause filters it)
- `get` - no row returned -> returns `undefined`
- `set` - executes INSERT with the SHA-256 hash of the provided id, not the raw value
- `delete` - executes DELETE with hashed id

---

**`test/unit/token-crypto.spec.ts`** [unit]:

- `encrypt` + `decrypt` roundtrip returns identical plaintext
- `decrypt` with incorrect key throws `InvalidTokenError`
- `decrypt` with tampered ciphertext bytes throws `InvalidTokenError`
- `decrypt` with tampered auth tag throws `InvalidTokenError`
- Two `encrypt` calls on the same plaintext produce different ciphertext (unique nonces)
- `decrypt` on malformed string (wrong number of colon segments) throws `InvalidTokenError`

---

**`test/unit/oidc-client.service.spec.ts`** [unit] - `jest.mock('openid-client', ..., { virtual: true })`:

- `onModuleInit` calls `discovery()` with the configured issuer URL
- `buildAuthorizationUrl` returns a URL containing `state`, `code_challenge`, `nonce`
- `buildAuthorizationUrl` URL contains the serialised `claims` parameter
- `exchangeCode` calls the mocked token endpoint with the code and code_verifier
- `revokeToken` calls the mocked revocation endpoint and does not throw on a network error
- `buildLogoutUrl` URL contains `id_token_hint` and `post_logout_redirect_uri`

---

**`test/unit/csrf.guard.spec.ts`** [unit]:

- `@Public()` route - CSRF check is skipped entirely
- Valid `X-CSRF-Token` header matching `session.csrfToken` -> guard passes
- Missing `X-CSRF-Token` header -> throws `ForbiddenException`
- Mismatched token value -> throws `ForbiddenException`

---

**`test/unit/migration-runner.spec.ts`** [unit] - mocks `pg.Pool.query`:

- Creates `_migrations` table when it does not exist
- Applies SQL files in strict alphabetical order
- Does not re-apply files already recorded in `_migrations` (idempotency check)
- Throws when a SQL file execution returns an error (does not silently swallow)

---

**`test/app.e2e-spec.ts` - new e2e cases** [unit] (no Keycloak or PostgreSQL; uses mocked stores):

`GET /api/auth/login`:
- Returns 302; `Location` header starts with `KEYCLOAK_ISSUER_URL`
- Response sets `auth_tx` cookie with `HttpOnly`, `SameSite=Lax`
- `auth_tx` value is an opaque hex string (not JSON, not a JWT)

`GET /api/auth/register`:
- Returns 302
- `Location` header differs from the login `Location` (register flow uses different param)
- Response sets `auth_tx` cookie

Cookie visibility after callback (injected session, `auth_tx` pre-seeded in store):
- `GET /api/auth/callback` with valid state and mocked token exchange (acr=2) -> 302 to
  `FRONTEND_APP_URL`
- Response sets `session_id` cookie: `HttpOnly`, `SameSite=Strict`, `Path=/`
- Response sets `XSRF-TOKEN` cookie: not httpOnly, `SameSite=Strict`, `Path=/`
- `auth_tx` cookie is cleared (`Max-Age=0`) in the response

`GET /api/auth/callback` - no `auth_tx` cookie -> 400
`GET /api/auth/callback` - state param does not match stored state -> 400
`GET /api/auth/callback` - `auth_tx` references an expired pending_auth row -> 400
`GET /api/auth/callback` - Keycloak returned `error` param (user cancelled) -> 400
`GET /api/auth/callback` - `acr` absent from ID token claims -> 401
`GET /api/auth/callback` - `acr` present but `!== '2'` -> 401

**Concurrent and replay protection** (two requests with same `auth_tx`):
- First call (matching state, not expired) -> succeeds; row deleted from pending_auth
- Second call (same `auth_tx`, same state) -> 400 (row already consumed)

`POST /api/auth/logout` - no session cookie -> 401
`POST /api/auth/logout` - valid session injected into store:
- Returns 200 with `{ logoutUrl }` in body
- `logoutUrl` contains end_session_endpoint URL, `id_token_hint`, `post_logout_redirect_uri`
- Response `Set-Cookie` clears `session_id` (Max-Age=0, Path=/) and `XSRF-TOKEN` (Max-Age=0)

---

**`test/integration/session-store.int-spec.ts`** [int] (requires real PostgreSQL):

- Migration runner creates both `sessions` and `pending_auth` tables
- `set` followed by `get` returns the stored `SessionRecord`
- `get` on an expired session (`expires_at` in the past) returns `undefined`
- `delete` followed by `get` returns `undefined`
- Running migration runner twice does not fail and does not insert duplicate `_migrations` rows

**Atomic pending-auth consumption** [int]:
- Insert one `pending_auth` row
- Execute two concurrent `DELETE ... WHERE id = $1 AND state = $2 AND expires_at > NOW() RETURNING *`
  calls in parallel
- Exactly one call receives a row; the other receives zero rows
- Confirms atomicity of single-use consumption under concurrency

---

**`test/integration/oidc-import.int-spec.ts`** [int]:

- `await import('openid-client')` succeeds without ESM/CJS errors in the NestJS runtime
- The returned module exports `discovery` as a function
- This test is NOT the `virtual: true` unit mock - it imports the real installed package

---

**`test/integration/keycloak-readiness.int-spec.ts`** [int] (requires running Keycloak):

- `GET http://localhost:9000/health/ready` returns HTTP 200 with body containing `"status":"UP"`
- Confirms management port 9000 is reachable inside the container via the bash TCP healthcheck
  (run manually by `docker exec` to verify the command works with the pinned image)

---

**`test/integration/auth-flow.int-spec.ts`** [live] - manual only, not automated:

These scenarios require a real Google account, TOTP device, and running Docker Compose stack.
Document each step as a checklist item in `docs/local-auth-setup.md`. They are not part of
`pnpm test` or `pnpm test:integration`. Mark the file clearly:

```typescript
// LIVE TESTS - manual execution only. Requires: Docker Compose stack healthy,
// real Google account, TOTP device. NOT part of any automated test suite.
```

Scenarios to document and verify manually:

1. **First registration** - Registrati -> Google login -> TOTP enrollment -> redirect to `/?view=menu`;
   `session_id` cookie present with `Path=/`; radial menu renders without regressions
2. **Returning login** - Accedi -> Google login (may skip password if Google session active) ->
   TOTP code entry (not re-enrollment) -> same identity; `acr=2` confirmed via `/api/auth/me`
3. **Required MFA** - authorization request includes `claims` parameter; inspect Keycloak admin
   console to confirm ACR 2 is in the issued ID token
4. **Authentication cancellation** - user clicks Cancel on Google auth page; callback receives
   `error=access_denied`; NestJS returns 400; user returned to error state (no session created)
5. **Expired local session** - set `SESSION_TTL_SECONDS=10` in `.env.local`; log in; wait 11s;
   `GET /api/auth/me` returns 401; clicking a section link redirects to login
6. **Logout sequence** - click logout; application session deleted; Keycloak SSO terminated;
   browser lands on Welcome; clicking Accedi requires Google + TOTP again
7. **Browser restart** - log in; close browser; reopen `http://localhost:3000`; Welcome appears
   (session cookie gone); login required

---

**Local verification checklist (in `docs/local-auth-setup.md`):**

1. `docker compose -f backend/docker-compose.yml up -d` - wait until both services healthy
2. `pnpm dev:api` - confirm logs: "Migrations applied" and "OIDC discovery complete"
3. `pnpm dev` (from `prototypes/ui-shell/`) - Next.js starts on :3000
4. Visit `http://localhost:3000` - Welcome screen renders, Accedi / Registrati visible, no redirect
5. Click Registrati - `auth_tx` cookie set, browser redirects to Keycloak
6. Complete Google login - Keycloak prompts TOTP enrollment (first registration only)
7. Enroll TOTP with authenticator app - redirect to `http://localhost:3000/?view=menu`
8. Radial menu renders; existing gradients, palettes, animations unchanged
9. `GET http://localhost:3000/api/auth/me` returns `{ sub, email, name }` with `acr: "2"`
10. Click logout - application session deleted, browser navigates to Keycloak end_session URL,
    then returns to `http://localhost:3000` (Welcome screen)
11. Click Accedi - Keycloak requires Google + TOTP (SSO session ended by RP-initiated logout)
12. Complete Google + TOTP - same identity, redirect to `/?view=menu`, radial menu renders
13. Close browser; reopen `http://localhost:3000` - Welcome screen (session cookie expired)
14. Confirm existing encrypted local vault (if present) is unchanged

---

## Section 14 - Acceptance criteria

B-1 is complete when all of the following hold:

1. Welcome (`http://localhost:3000/`) is accessible without authentication and does not redirect.
2. Registrati starts a valid server-initiated OIDC flow (NestJS generates and stores PKCE, state,
   nonce; no raw secrets in browser cookies).
3. Google OAuth authentication completes via the Keycloak IDP.
4. Keycloak enforces TOTP enrollment (first registration) or TOTP verification (returning login).
5. NestJS creates an application session with `acr === '2'`, stores it in PostgreSQL; the
   `session_id` cookie has `HttpOnly`, `SameSite=Strict`, `Path=/`.
6. Browser lands at `http://localhost:3000/?view=menu`; existing radial menu renders without
   regressions (gradients, palettes, animations, section navigation intact).
7. `GET /api/auth/me` returns user identity. Section pages redirect to login when no session
   cookie is present. Protected API routes reject unauthenticated requests with 401.
8. Logout: local session deleted, refresh token revoked (best-effort), Keycloak SSO terminated
   via RP-initiated logout, user returns to Welcome screen.
9. Returning login (Accedi after logout): Google + TOTP (or Google-only if Google session
   satisfies LoA 2 within LoA Max Age) restores the same Keycloak identity.
10. Browser restart clears the session cookie; next visit shows Welcome screen.
11. No mock authentication is used in the acceptance flow; real Google credentials are required.
12. Existing encrypted local vault data is not modified, overwritten, or silently rebound.
13. Concurrent or replayed OIDC callbacks are rejected (atomic pending-auth consumption verified).
14. Session revocation latency is documented: up to 1800s after Keycloak revocation.

---

## File map

**New files:**
- `backend/docker-compose.yml`
- `backend/docker/init-db.sql`
- `backend/.env.local.example`
- `backend/keycloak/agenda-realm.json`
- `backend/migrations/001_create_sessions.sql`
- `backend/migrations/002_create_pending_auth.sql`
- `backend/src/database/pg.module.ts`
- `backend/src/auth/providers/pg-session.store.ts`
- `backend/src/auth/token/token-crypto.ts`
- `backend/src/auth/oidc/oidc-client.service.ts`
- `backend/src/auth/oidc/oidc.module.ts`
- `backend/src/auth/guards/csrf.guard.ts`
- `backend/src/auth/migration-runner.service.ts`
- `backend/test/unit/pg-session.store.spec.ts`
- `backend/test/unit/token-crypto.spec.ts`
- `backend/test/unit/oidc-client.service.spec.ts`
- `backend/test/unit/csrf.guard.spec.ts`
- `backend/test/unit/migration-runner.spec.ts`
- `backend/test/integration/session-store.int-spec.ts`
- `backend/test/integration/oidc-import.int-spec.ts`
- `backend/test/integration/keycloak-readiness.int-spec.ts`
- `backend/test/integration/auth-flow.int-spec.ts`
- `prototypes/ui-shell/middleware.ts`
- `prototypes/ui-shell/lib/apiFetch.ts`
- `prototypes/ui-shell/.env.local.example`
- `docs/local-auth-setup.md`

**Modified files:**
- `backend/src/auth/auth.module.ts` - add OidcModule, PgSessionStore, CsrfGuard, MigrationRunner
- `backend/src/auth/auth.controller.ts` - add /login, /register, /callback, /logout
- `backend/src/auth/types/session-record.ts` - add csrfToken, encrypted tokens, expiresAt (single expiry)
- `backend/src/app.module.ts` - add PgModule
- `backend/src/main.ts` - no CORS (same-origin via Next.js proxy)
- `backend/src/config/config.module.ts` - add TOKEN_ENCRYPTION_KEY, DATABASE_URL, SESSION_TTL_SECONDS,
  FRONTEND_APP_URL, OIDC vars to Joi schema
- `backend/test/app.e2e-spec.ts` - add auth endpoint tests, cookie attribute checks, concurrency tests
- `prototypes/ui-shell/next.config.ts` - add /api/** rewrite to NestJS
- `backend/package.json` - add openid-client, pg, @types/pg
