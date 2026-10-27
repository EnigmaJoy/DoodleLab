# Local Auth Setup (B-1)

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) -- must be running before `docker compose up`
- Node.js 24+, pnpm
- A Google Cloud project with OAuth 2.0 credentials (see Section 3 for exact configuration)
- An authenticator app (Google Authenticator, Authy, 1Password TOTP, etc.)

---

## Redirect URI Architecture -- Read This First

There are **two separate redirect URIs** in the federation chain. They are NOT the same URL.
Registering the wrong one in Google Cloud Console is the most common setup mistake.

### The two-hop chain

```
Browser
  -> NestJS /api/auth/login
      -> Keycloak (authorization endpoint)
          -> Google (OAuth consent)
              -> Keycloak broker endpoint  <-- Google's redirect_uri
          -> Keycloak (post-broker OTP)
      -> NestJS /api/auth/callback         <-- Keycloak's redirect_uri (in agenda-bff client)
  -> Browser (/?view=menu)
```

### URI summary

| URI | Registered where | Who calls it |
|-----|------------------|--------------|
| `http://localhost:8080/realms/agenda/broker/google/endpoint` | **Google Cloud Console** Authorized redirect URIs | Google returns the auth code here, to Keycloak's broker endpoint |
| `http://localhost:3000/api/auth/callback` | **Keycloak** client `agenda-bff` Valid Redirect URIs | Keycloak returns the auth code here, to the NestJS BFF |

**Do not register `http://localhost:3000/api/auth/callback` in Google Cloud Console.**
Google never calls the BFF directly. Google calls Keycloak's broker endpoint.

The Keycloak broker endpoint URI pattern is:
`{keycloak-base}/realms/{realm}/broker/{idp-alias}/endpoint`

With realm=`agenda` and IDP alias=`google`:
`http://localhost:8080/realms/agenda/broker/google/endpoint`

---

## 1. Create environment files

### Step 1a -- `backend/.env.local` (REQUIRED, not committed)

This file does not exist and must be created before starting the stack.

Copy and fill in:
```
cp backend/.env.local.example backend/.env.local
```

Required values to fill in:

| Variable | How to generate |
|----------|-----------------|
| `POSTGRES_SUPERUSER_PASSWORD` | any strong password |
| `KEYCLOAK_DB_PASSWORD` | any strong password |
| `AGENDA_DB_PASSWORD` | any strong password |
| `KEYCLOAK_ADMIN_USER` | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | any password |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console (see Section 3) |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console (see Section 3) |
| `KEYCLOAK_BFF_CLIENT_SECRET` | `openssl rand -hex 16` |
| `SESSION_SECRET` | `openssl rand -hex 32` (min 32 chars) |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` (produces 64 hex chars) |

Leave these at their defaults:
```
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/agenda
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/agenda/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=agenda-bff
KEYCLOAK_AUDIENCE=agenda-bff
KEYCLOAK_REQUIRED_ACR=2
KEYCLOAK_REDIRECT_URI=http://localhost:3000/api/auth/callback
FRONTEND_URL=http://localhost:3000
SESSION_TTL_SECONDS=1800
FRONTEND_APP_URL=http://localhost:3000/?view=menu
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

KEY ROTATION WARNING: Changing `TOKEN_ENCRYPTION_KEY` invalidates all stored refresh and ID
tokens. Active sessions will fail on next use. Users must re-authenticate.

### Step 1b -- `prototypes/ui-shell/.env.local`

Add to the existing file:
```
NEXT_PUBLIC_AUTH_CONFIGURED=true
NEXT_PUBLIC_AUTH_LOGIN_URL=/api/auth/login
NEXT_PUBLIC_AUTH_REGISTER_URL=/api/auth/register
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

---

## 2. Start the Docker Compose stack

Docker Desktop (or Docker Engine) must be running before this step.

```bash
cd backend
docker compose up -d
```

Wait until both services are healthy:
```bash
docker compose ps   # both should show "healthy"
```

Expected time: ~60s on first run (Keycloak imports realm). Subsequent starts: ~15s.

### Keycloak healthcheck verification

The Keycloak container uses bash TCP to check the management port (9000, not exposed to host):

```bash
docker exec $(docker compose ps -q keycloak) bash -c \
  "exec 3<>/dev/tcp/127.0.0.1/9000 && \
   printf 'GET /health/ready HTTP/1.0\r\nHost: localhost\r\n\r\n' >&3 && \
   grep -q 'UP' <&3 && echo OK"
```

If this fails (bash or /dev/tcp unavailable in the image), fall back to a Dockerfile.keycloak
that installs curl and use:
```yaml
test: ["CMD", "curl", "-f", "http://localhost:9000/health/ready"]
```

### Verify Postgres databases exist

```bash
docker exec -it $(docker compose ps -q postgres) \
  psql -U postgres -c "\l" 2>/dev/null | grep -E 'keycloak|agenda_app'
```

Expected output: both `keycloak` and `agenda_app` databases listed.

---

## 3. Google Cloud Console configuration

### Step 3a -- Create OAuth 2.0 credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials
2. Click "Create Credentials" -> "OAuth 2.0 Client ID"
3. Application type: **Web application**
4. Name: e.g., `Agenda ADHD Local Dev`

### Step 3b -- Add the CORRECT redirect URI

Under **Authorized redirect URIs**, add ONLY:
```
http://localhost:8080/realms/agenda/broker/google/endpoint
```

**Do NOT add** `http://localhost:3000/api/auth/callback` here. That URI belongs in
Keycloak's client configuration, not in Google's.

### Step 3c -- OAuth consent screen

If the app is in "Testing" mode, add your Google account as a test user:
Google Cloud Console -> OAuth consent screen -> Test users -> Add users.

Without this, Google will block the login with an "unverified app" error for accounts
not on the test user list.

### Step 3d -- Copy credentials to backend/.env.local

After creating the OAuth client, copy the Client ID and Client Secret into:
```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

---

## 4. Verify Keycloak realm after first start

The imported realm JSON (`backend/keycloak/agenda-realm.json`) is a skeleton that provides
the base structure. After Keycloak starts with `--import-realm`, verify these in the admin
console at `http://localhost:8080/admin` (log in with KEYCLOAK_ADMIN_USER / KEYCLOAK_ADMIN_PASSWORD):

### Step 4a -- Verify realm imported correctly

- Realm "agenda" exists and is enabled
- Client `agenda-bff` exists:
  - Access Type: Confidential
  - Standard Flow: ON, Implicit: OFF, Direct Access: OFF
  - Valid Redirect URIs: `http://localhost:3000/api/auth/callback`
  - Valid Post-Logout URIs: `http://localhost:3000`
  - Advanced -> PKCE Code Challenge Method: `S256`

### Step 4b -- Verify Google Identity Provider

- Identity Providers -> google exists
- Redirect URI shown by Keycloak for Google: verify it matches
  `http://localhost:8080/realms/agenda/broker/google/endpoint`
  (Keycloak displays this in the IDP settings -- copy it verbatim to Google Cloud Console)
- First Broker Login Flow: `first broker login`
- Post Login Flow: `post broker login with otp`

### Step 4c -- Verify post-broker OTP flow

Authentication -> Flows -> "post broker login with otp":
- Must exist as a top-level flow
- Must have execution: OTP Form, requirement: REQUIRED

If missing, create it manually:
1. Authentication -> Flows -> Add flow
2. Name: `post broker login with otp`, Type: Generic
3. Add execution -> OTP Form -> set to REQUIRED
4. Identity Providers -> google -> Advanced -> Post Login Flow: select `post broker login with otp`

### Step 4d -- Verify ACR/LoA mapping

The realm JSON sets `acr.loa.map = {"2":"2"}` in realm attributes. Verify in:
Realm Settings -> (Advanced tab or Security tab depending on Keycloak 26.x UI) -> LoA

This maps the client's requested ACR value "2" to internal LoA level 2.

**Critical note on ACR 2 and post-broker OTP:**
Keycloak 26.x returns `acr=2` in the ID token when the session satisfies LoA level 2.
For the post-broker OTP flow to result in `acr=2`, Keycloak must associate the OTP
authenticator with LoA level 2. Verify this behavior by:

1. Completing a test login
2. Checking the ID token claims (NestJS logs the token exchange; check for `acr` field)
3. If `acr` is absent or not `"2"`, the LoA mapping needs additional browser flow configuration:
   - Authentication -> Flows -> Browser -> Add step: "Condition - Level of Authentication"
   - Under the condition, add OTP Form as the level-2 authenticator
   - This is the Keycloak 26.x mechanism for step-up authentication on `claims` requests

### Step 4e -- Verify Required Actions

Authentication -> Required Actions -> "Configure OTP" should be Enabled (not default).
This allows first-time TOTP enrollment during the post-broker flow.

### Step 4f -- Registration endpoint (Keycloak 26.8.1 specific)

Test whether a dedicated registration endpoint is available:

```bash
curl -sv "http://localhost:8080/realms/agenda/protocol/openid-connect/registrations\
?client_id=agenda-bff&response_type=code\
&redirect_uri=http://localhost:3000/api/auth/callback" 2>&1 | grep -E "^< HTTP|Location:"
```

- If `302` with a Location header -> registration UI available; update `OidcClientService`
  in `backend/src/auth/oidc/oidc-client.service.ts` to use `registrations` endpoint for
  `flow === 'register'` (replace the `kc_idp_hint` approach)
- If `404` or same as standard auth endpoint -> document here; keep `kc_idp_hint` workaround

---

## 5. Start the application services

Terminal 1 (NestJS):
```bash
cd backend && pnpm dev
```

Confirm all of these startup log lines appear:
```
Migration applied: 001_create_sessions.sql
Migration applied: 002_create_pending_auth.sql
Migrations complete
OIDC discovery complete
Database connection verified
```

If "OIDC discovery complete" is missing, Keycloak is not yet healthy -- wait and retry.

Terminal 2 (Next.js):
```bash
cd prototypes/ui-shell && pnpm dev
```

---

## 6. Registration walkthrough (first time)

1. Open `http://localhost:3000` -- Welcome screen must appear with no redirect
2. Click "Prima volta qui? Registrati"
3. Browser navigates to `/api/auth/register` -> NestJS -> Keycloak
4. Keycloak redirects to Google (you may see the Google consent screen)
5. Sign in with your Google account (must be on the test users list if app is in Testing mode)
6. Keycloak prompts TOTP enrollment -- scan the QR code with your authenticator app
7. Enter the 6-digit code to confirm enrollment
8. Browser redirects to `http://localhost:3000/?view=menu`
9. Radial menu renders; all existing animations and section navigation must be intact

Verify ACR 2 session via browser DevTools or curl:
```bash
# Use the session_id cookie value from DevTools -> Application -> Cookies
curl -b "session_id=<your-session-id>" http://localhost:3000/api/auth/me
# Expected: {"sub":"...","email":"...","name":"...","acr":"2"}
```

If `acr` is not `"2"`, see Step 4d for LoA mapping configuration.

---

## 7. Login walkthrough (returning user)

1. Click "Accedi" on Welcome screen
2. Sign in with Google (may skip password if Google session is still active)
3. Keycloak prompts for TOTP code (not re-enrollment -- TOTP already configured)
4. Redirect to `/?view=menu` -- identity matches registration (same `sub` value)

---

## 8. Logout

1. Frontend calls `POST /api/auth/logout` via `apiFetch` (CSRF header included automatically)
2. Response: `{ "logoutUrl": "http://localhost:8080/realms/agenda/..." }`
3. Frontend navigates to `logoutUrl`
4. Keycloak terminates SSO session, redirects to `http://localhost:3000`
5. Welcome screen shown
6. Next "Accedi" requires Google + TOTP again (new Keycloak session has no ACR 2 yet)

---

## 9. Running integration tests

```bash
cd backend

# Unit tests (no Docker required)
pnpm test

# E2E tests (no Docker required -- uses mocked auth providers)
pnpm test:e2e

# Integration tests (requires Docker Compose healthy + DATABASE_URL set)
RUN_INTEGRATION_TESTS=true \
  DATABASE_URL=postgresql://agenda_user:<AGENDA_DB_PASSWORD>@localhost:5432/agenda_app \
  pnpm test:integration
```

Note: `test/integration/auth-flow.int-spec.ts` is `describe.skip` -- execute manually
following Sections 6-8 of this guide.

---

## 10. Known limitations (B-1)

- **Revocation latency:** up to 30 minutes after Keycloak revocation or account disable,
  the local application session remains valid. Silent refresh is B-2.
- **Backchannel logout:** not implemented. Admin revocation does not immediately end
  application sessions.
- **No sliding window:** sessions expire absolutely after SESSION_TTL_SECONDS (1800s).
  After expiry, GET /api/auth/me returns 401 and the user must re-authenticate.
- **Google SSO continuity:** RP-initiated logout terminates the Keycloak session but not
  Google's. If the Google session is still active, the next login may skip the Google
  password prompt but will still require TOTP (new Keycloak session = no ACR 2 yet).
- **Secure flag:** session cookies do not set `secure: true`; that requires HTTPS (B-2).
- **ACR 2 LoA enforcement:** requires live Keycloak verification (see Step 4d). If Keycloak
  does not return `acr=2` after post-broker OTP, the BFF will correctly reject with 401
  (fail-safe), but the auth flow will not complete until LoA is configured correctly.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| NestJS exits on start | Missing required env var | Check Joi validation error in logs |
| "OIDC discovery failed" | Keycloak not healthy or wrong ISSUER_URL | `docker compose ps`; check `KEYCLOAK_ISSUER_URL` |
| 400 on callback | Expired or replayed `auth_tx` | Retry login from the beginning |
| 401 after long inactivity | Session expired (30 min TTL) | Re-authenticate |
| Section page redirects to login | `session_id` cookie absent or `Path` mismatch | Check `Path=/` on `session_id` cookie in DevTools |
| CSRF 403 on logout | `X-CSRF-Token` header not sent | Ensure `apiFetch` is used for POST calls |
| TOTP not prompted | post-broker-login flow not bound to Google IDP | Verify Step 4c |
| `acr` missing or not "2" in `/api/auth/me` | LoA mapping not configured | Verify Step 4d |
| Keycloak healthcheck failing | Port 9000 not accessible from container | Use bash TCP exec command in Section 2 |
| Google `redirect_uri_mismatch` error | Wrong URI in Google Cloud Console | Register `http://localhost:8080/realms/agenda/broker/google/endpoint` |
| Google "unverified app" error | Account not in test users list | Add to OAuth consent screen -> Test users |
| Docker daemon not responding | Docker Desktop is not running | Start Docker Desktop and wait for the whale icon to be ready |

---

## 12. Realm JSON notes

The committed `backend/keycloak/agenda-realm.json` is a **skeleton** that Keycloak imports
on first start. It provides the base structure but requires verification and potentially
manual completion of:

- Post-broker OTP flow binding to Google IDP (Step 4c)
- LoA/ACR step-up browser flow (Step 4d)

For a production-ready realm, generate a full export from the admin console after manual
configuration (Realm Settings -> Export, include clients and groups), then replace secret
values with `${VAR}` placeholders before committing.

Variable substitution in the skeleton:
- `${KEYCLOAK_BFF_CLIENT_SECRET}` -- BFF client secret
- `${GOOGLE_CLIENT_ID}` -- Google OAuth client ID
- `${GOOGLE_CLIENT_SECRET}` -- Google OAuth client secret
- `${KEYCLOAK_REDIRECT_URI}` -- NestJS BFF callback (`http://localhost:3000/api/auth/callback`)
- `${FRONTEND_URL}` -- Next.js origin (`http://localhost:3000`)
