# Auth Increment B-1 Implementation Plan

**Goal:** Working Google OAuth + Keycloak TOTP MFA (ACR 2) via NestJS BFF with PostgreSQL
session store, runnable from local Docker Compose. Ends when a developer can register via
Google, complete TOTP enrollment, and hold a verified ACR-2 session locally.

**Spec:** `docs/superpowers/specs/2026-10-26-auth-increment-b1-design.md`

---

## Phases

- **Phase 1 — Infrastructure & Config** — Docker Compose (postgres + keycloak), init-db.sql, PgModule, env schema additions, startup validation
- **Phase 2 — DB Migrations & Session Store** — migration runner, sessions + pending_auth SQL, PgSessionStore, TokenCrypto, SessionRecord update
- **Phase 3 — OIDC Client Service** — OidcClientService (discovery, buildAuthorizationUrl, exchangeCode, revokeToken, buildLogoutUrl), OidcModule
- **Phase 4 — Auth Controller & Guards** — /login, /register, /callback, /me, /logout endpoints; CsrfGuard; wire everything into AuthModule/AppModule
- **Phase 5 — Frontend Integration** — Next.js rewrite, middleware.ts, apiFetch.ts, useCurrentUser hook, WelcomeScreen buttons, env.local.example
- **Phase 6 — Unit Tests** — pg-session.store.spec, token-crypto.spec, oidc-client.service.spec, csrf.guard.spec, migration-runner.spec
- **Phase 7 — E2E & Integration Tests** — app.e2e-spec additions, session-store.int-spec, oidc-import.int-spec, keycloak-readiness.int-spec, auth-flow.int-spec (live/manual)
- **Phase 8 — Docs & Keycloak Realm** — agenda-realm.json, local-auth-setup.md, .env.local.example

---

<!-- phases filled below -->

---

## Phase 2 — DB Migrations & Session Store

**Goal:** Migration runner creates `sessions` and `pending_auth` tables on startup; `PgSessionStore`
replaces `InMemorySessionStore` as the `SESSION_STORE` provider; `TokenCrypto` encrypts/decrypts
tokens; `SessionRecord` carries the new fields required for logout and CSRF.

### 2.1 — `backend/migrations/001_create_sessions.sql`

New file. Immutable after commit.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id_hash                  VARCHAR(64)  PRIMARY KEY,
  user_data                JSONB        NOT NULL,
  acr                      VARCHAR(8)   NOT NULL,
  csrf_token               VARCHAR(64)  NOT NULL,
  encrypted_refresh_token  TEXT         NOT NULL,
  encrypted_id_token       TEXT         NOT NULL,
  expires_at               TIMESTAMPTZ  NOT NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
```

### 2.2 — `backend/migrations/002_create_pending_auth.sql`

New file. Immutable after commit.

```sql
CREATE TABLE IF NOT EXISTS pending_auth (
  id            VARCHAR(64)  PRIMARY KEY,
  state         VARCHAR(64)  NOT NULL UNIQUE,
  nonce         VARCHAR(64)  NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  flow          VARCHAR(16)  NOT NULL,
  expires_at    TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pending_auth_expires_at_idx ON pending_auth (expires_at);
```

### 2.3 — `backend/src/auth/migration-runner.service.ts`

New file. Implements `OnApplicationBootstrap`. Injected with `PG_POOL` and `ConfigService`.
Must run before `AppBootstrapService` attempts any app-level queries — NestJS runs
`onApplicationBootstrap` hooks in module declaration order; `AuthModule` is declared after
`PgModule` in `AppModule`, so `MigrationRunnerService` hooks run after the pool is ready.
Throws on any failure (NestJS exits non-zero).

```typescript
import { Injectable, OnApplicationBootstrap, Logger, Inject } from '@nestjs/common'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { Pool } from 'pg'
import { PG_POOL } from '../database/pg.module'

@Injectable()
export class MigrationRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationRunnerService.name)
  private readonly migrationsDir = join(__dirname, '..', '..', '..', 'migrations')

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    const client = await this.pool.connect()
    try {
      // Create tracking table in its own transaction
      await client.query('BEGIN')
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          filename   TEXT        PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await client.query('COMMIT')

      // Read migration files sorted alphabetically
      const entries = await readdir(this.migrationsDir)
      const files = entries.filter(f => f.endsWith('.sql')).sort()

      for (const filename of files) {
        const applied = await client.query(
          'SELECT 1 FROM _migrations WHERE filename = $1', [filename]
        )
        if (applied.rowCount && applied.rowCount > 0) {
          this.logger.debug(`Migration already applied: ${filename}`)
          continue
        }

        const sql = await readFile(join(this.migrationsDir, filename), 'utf-8')
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)', [filename]
        )
        await client.query('COMMIT')
        this.logger.log(`Migration applied: ${filename}`)
      }

      this.logger.log('Migrations complete')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }
}
```

**`__dirname` path note:** `nest build` outputs to `backend/dist/`. The migrations directory is
`backend/migrations/`. The relative path `join(__dirname, '..', '..', '..', 'migrations')` walks
from `dist/auth/` → `dist/` → `backend/` → `migrations/`. Verify this resolves correctly
during the integration test. If not, use `process.cwd()` + `'migrations'` as a fallback
(document the choice).

### 2.4 — `backend/src/auth/types/session-record.ts` — update

Replace the existing interface with the expanded version. The existing `expiresAt` field stays;
add `csrfToken`, `encryptedRefreshToken`, `encryptedIdToken`.

```typescript
import type { AuthenticatedUser } from './authenticated-user'

export interface SessionRecord {
  readonly user:                   AuthenticatedUser
  readonly acr:                    string
  readonly csrfToken:              string
  readonly encryptedRefreshToken:  string
  readonly encryptedIdToken:       string
  readonly expiresAt:              number   // milliseconds epoch
}
```

**Impact on `SessionGuard`:** the guard currently checks `session.expiresAt <= Date.now()`.
That check remains. The guard now also has access to `session.csrfToken` — `CsrfGuard`
(Phase 4) will read it from the already-resolved session attached to the request context.
No changes needed to `SessionGuard` itself for this phase.

**Impact on `InMemorySessionStore`:** still compiles; the interface is structural. Unit tests
for the guard that inject mock sessions must include the new fields. Update those test fixtures
in Phase 6.

### 2.5 — `backend/src/auth/token/token-crypto.ts`

New file.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTokenError'
  }
}

export class TokenCrypto {
  private readonly key: Buffer

  constructor(hexKey: string) {
    if (hexKey.length !== 64) throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters')
    this.key = Buffer.from(hexKey, 'hex')
  }

  encrypt(plaintext: string): string {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${nonce.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
  }

  decrypt(stored: string): string {
    const parts = stored.split(':')
    if (parts.length !== 3) throw new InvalidTokenError('Malformed encrypted token')
    const [nonceHex, ciphertextHex, tagHex] = parts
    try {
      const nonce = Buffer.from(nonceHex, 'hex')
      const ciphertext = Buffer.from(ciphertextHex, 'hex')
      const tag = Buffer.from(tagHex, 'hex')
      const decipher = createDecipheriv('aes-256-gcm', this.key, nonce)
      decipher.setAuthTag(tag)
      return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
    } catch {
      throw new InvalidTokenError('Decryption failed')
    }
  }
}
```

`TokenCrypto` is a plain class, not a NestJS provider — it is instantiated directly by
`PgSessionStore` and `AuthController` using the injected `TOKEN_ENCRYPTION_KEY` config value.
This avoids circular DI and keeps it testable without a NestJS test module.

### 2.6 — `backend/src/auth/providers/pg-session.store.ts`

New file. Implements `SessionStore`. Keyed by `id_hash` (SHA-256 of raw `session_id`).
The hash computation lives here; callers (including `SessionGuard`) pass the raw cookie value
and the store hashes it internally.

```typescript
import { createHash } from 'crypto'
import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'pg'
import { PG_POOL } from '../../database/pg.module'
import type { SessionStore } from '../types/session-store.interface'
import type { SessionRecord } from '../types/session-record'
import type { AuthenticatedUser } from '../types/authenticated-user'

@Injectable()
export class PgSessionStore implements SessionStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private hash(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex')
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const idHash = this.hash(sessionId)
    const result = await this.pool.query<{
      user_data: AuthenticatedUser
      acr: string
      csrf_token: string
      encrypted_refresh_token: string
      encrypted_id_token: string
      expires_at: Date
    }>(
      `SELECT user_data, acr, csrf_token, encrypted_refresh_token, encrypted_id_token, expires_at
       FROM sessions
       WHERE id_hash = $1 AND expires_at > NOW()`,
      [idHash],
    )
    if (result.rowCount === 0) return undefined
    const row = result.rows[0]
    return {
      user:                   row.user_data,
      acr:                    row.acr,
      csrfToken:              row.csrf_token,
      encryptedRefreshToken:  row.encrypted_refresh_token,
      encryptedIdToken:       row.encrypted_id_token,
      expiresAt:              row.expires_at.getTime(),
    }
  }

  async set(sessionId: string, record: SessionRecord): Promise<void> {
    const idHash = this.hash(sessionId)
    await this.pool.query(
      `INSERT INTO sessions
         (id_hash, user_data, acr, csrf_token, encrypted_refresh_token, encrypted_id_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))`,
      [
        idHash,
        JSON.stringify(record.user),
        record.acr,
        record.csrfToken,
        record.encryptedRefreshToken,
        record.encryptedIdToken,
        record.expiresAt,
      ],
    )
  }

  async delete(sessionId: string): Promise<void> {
    const idHash = this.hash(sessionId)
    await this.pool.query('DELETE FROM sessions WHERE id_hash = $1', [idHash])
  }
}
```

**Hash placement note:** `SessionGuard` currently calls `this.sessionStore.get(sessionId)` with
the raw cookie value. `PgSessionStore.get` hashes it internally. This means the guard's public
interface is unchanged — no edits to `session.guard.ts` for this phase.

### 2.7 — `backend/src/auth/auth.module.ts` — wire PgSessionStore

Replace the `InMemorySessionStore` provider with `PgSessionStore` as the `SESSION_STORE` token.
Also add `MigrationRunnerService` to providers.

Current `SESSION_STORE` provider (Increment A):
```typescript
{ provide: SESSION_STORE, useClass: InMemorySessionStore }
```

Replace with:
```typescript
{ provide: SESSION_STORE, useClass: PgSessionStore }
```

Add `MigrationRunnerService` to the `providers` array (not exported).

`PgSessionStore` injects `PG_POOL` which is provided by `PgModule` (global). No additional
imports needed in `AuthModule`.

### Verification for Phase 2

After implementing:
1. `pnpm build:api` — compiles without errors
2. `docker compose up -d` → `pnpm dev:api` — logs show "Migration applied: 001_create_sessions.sql",
   "Migration applied: 002_create_pending_auth.sql", "Migrations complete"
3. Second start: logs show "already applied" for both files (idempotency)
4. `psql agenda_app -c "\dt"` — confirms `sessions`, `pending_auth`, `_migrations` tables exist
5. `TokenCrypto` roundtrip: `encrypt` then `decrypt` returns original value (manual Node REPL test)

---

## Phase 3 — OIDC Client Service

**Goal:** `OidcClientService` performs OIDC discovery at startup and exposes the four methods
needed by `AuthController`: `buildAuthorizationUrl`, `exchangeCode`, `revokeToken`,
`buildLogoutUrl`. `OidcModule` wraps it for DI. `auth.config.ts` gains the new OIDC fields.

### 3.1 — `backend/src/config/auth.config.ts` — extend

Add the new fields consumed by `OidcClientService`. No existing fields are removed.

```typescript
export interface AuthConfig {
  // existing fields unchanged ...
  keycloakBffClientSecret: string
  tokenEncryptionKey:      string
  frontendAppUrl:          string
  databaseUrl:             string
  sessionTtlSeconds:       number  // already exists; default changes to 1800 in Phase 1
}

export const authConfig = (): { auth: AuthConfig } => ({
  auth: {
    // existing mappings unchanged ...
    keycloakBffClientSecret: process.env['KEYCLOAK_BFF_CLIENT_SECRET'] ?? '',
    tokenEncryptionKey:      process.env['TOKEN_ENCRYPTION_KEY'] ?? '',
    frontendAppUrl:          process.env['FRONTEND_APP_URL'] ?? 'http://localhost:3000/?view=menu',
    databaseUrl:             process.env['DATABASE_URL'] ?? '',
  },
})
```

### 3.2 — `backend/src/auth/oidc/oidc-client.service.ts`

New file. Implements `OnModuleInit`. All openid-client usage goes through dynamic import to
handle the ESM-only package in a CommonJS NestJS build.

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthConfig } from '../../config/auth.config'

// openid-client v6 types (ESM-only — imported dynamically at runtime)
type OidcModule = typeof import('openid-client')
type ServerMetadata = Awaited<ReturnType<OidcModule['discovery']>>

@Injectable()
export class OidcClientService implements OnModuleInit {
  private readonly logger = new Logger(OidcClientService.name)
  private serverMetadata!: ServerMetadata
  private clientId!: string
  private clientSecret!: string
  private redirectUri!: string

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const auth = this.config.get<AuthConfig>('auth')!
    this.clientId     = auth.keycloakClientId
    this.clientSecret = auth.keycloakBffClientSecret
    this.redirectUri  = process.env['KEYCLOAK_REDIRECT_URI']
                        ?? 'http://localhost:3000/api/auth/callback'

    const { discovery } = await import('openid-client') as OidcModule
    this.serverMetadata = await discovery(
      new URL(auth.keycloakIssuerUrl),
      this.clientId,
      this.clientSecret,
    )
    this.logger.log('OIDC discovery complete')
  }

  buildAuthorizationUrl(params: {
    state:         string
    nonce:         string
    codeVerifier:  string
    flow:          'login' | 'register'
  }): string {
    // S256 code challenge
    const { calculatePKCECodeChallenge } = require('openid-client') as OidcModule
    // openid-client v6 exports calculatePKCECodeChallenge as sync in some builds;
    // if it returns a Promise, await it — detect at runtime.
    // Safer: build the challenge manually (spec: BASE64URL(SHA256(code_verifier)))
    const challenge = this._buildCodeChallenge(params.codeVerifier)

    const claimsParam = JSON.stringify({
      id_token: { acr: { essential: true, values: ['2'] } },
    })

    const url = new URL(this.serverMetadata.authorization_endpoint!)
    url.searchParams.set('response_type',          'code')
    url.searchParams.set('client_id',              this.clientId)
    url.searchParams.set('redirect_uri',           this.redirectUri)
    url.searchParams.set('scope',                  'openid email profile')
    url.searchParams.set('state',                  params.state)
    url.searchParams.set('nonce',                  params.nonce)
    url.searchParams.set('code_challenge',         challenge)
    url.searchParams.set('code_challenge_method',  'S256')
    url.searchParams.set('claims',                 claimsParam)

    // Register flow: add kc_action or use registrations endpoint.
    // Verify with 26.8.1 during implementation; document the chosen approach
    // in docs/local-auth-setup.md. For now, add a hint param only:
    if (params.flow === 'register') {
      url.searchParams.set('kc_idp_hint', 'google')  // skip IDP selection screen
    }

    return url.toString()
  }

  async exchangeCode(params: {
    code:          string
    codeVerifier:  string
    nonce:         string
  }): Promise<{ idTokenClaims: Record<string, unknown>; refreshToken: string; idTokenRaw: string }> {
    const { authorizationCodeGrant } = await import('openid-client') as OidcModule

    const tokens = await authorizationCodeGrant(
      this.serverMetadata,
      // openid-client v6 requires a Request-like object for the callback URL
      new URL(`${this.redirectUri}?code=${params.code}`),
      {
        pkceCodeVerifier: params.codeVerifier,
        expectedNonce:    params.nonce,
        expectedState:    undefined,  // state validated server-side via pending_auth table
      },
    )

    const idTokenClaims = tokens.claims() as Record<string, unknown>
    const refreshToken  = tokens.refresh_token ?? ''
    const idTokenRaw    = tokens.id_token ?? ''

    return { idTokenClaims, refreshToken, idTokenRaw }
  }

  async revokeToken(token: string, tokenTypeHint: 'refresh_token' | 'access_token'): Promise<void> {
    try {
      const { tokenRevocation } = await import('openid-client') as OidcModule
      await tokenRevocation(this.serverMetadata, { token, token_type_hint: tokenTypeHint })
    } catch (err) {
      this.logger.warn(`Token revocation failed (best-effort): ${(err as Error).message}`)
    }
  }

  buildLogoutUrl(idTokenRaw: string, postLogoutRedirectUri: string): string {
    const endpoint = this.serverMetadata.end_session_endpoint
    if (!endpoint) throw new Error('end_session_endpoint not present in OIDC metadata')
    const url = new URL(endpoint)
    url.searchParams.set('id_token_hint',            idTokenRaw)
    url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
    url.searchParams.set('client_id',                this.clientId)
    return url.toString()
  }

  // Manual S256 code challenge — avoids openid-client async/sync ambiguity
  private _buildCodeChallenge(verifier: string): string {
    const { createHash } = require('crypto') as typeof import('crypto')
    return createHash('sha256')
      .update(verifier)
      .digest('base64url')
  }
}
```

**openid-client v6 API note:** The exact method names (`authorizationCodeGrant`,
`tokenRevocation`) must be verified against the installed v6 package during Task 1 of
implementation (the spec-mandated ESM compatibility check). The v6 API changed significantly
from v5. If the method signatures differ from what is shown above, document the correct
signatures before proceeding to Phase 4. The unit tests (Phase 6) mock openid-client with
`{ virtual: true }` so they are immune to this; only the real integration path is affected.

**`exchangeCode` state validation note:** openid-client v6 validates `state` internally if
`expectedState` is provided. Since state is already validated server-side via the atomic
`DELETE ... WHERE state = $2` in the pending_auth lookup (Phase 4), passing
`expectedState: undefined` skips the double-check. This is intentional and documented.

### 3.3 — `backend/src/auth/oidc/oidc.module.ts`

New file. Wraps `OidcClientService` for DI.

```typescript
import { Module } from '@nestjs/common'
import { OidcClientService } from './oidc-client.service'

@Module({
  providers: [OidcClientService],
  exports:   [OidcClientService],
})
export class OidcModule {}
```

### 3.4 — `backend/src/auth/auth.module.ts` — import OidcModule

Add `OidcModule` to the `imports` array of `AuthModule`. `OidcClientService` will then be
injectable into `AuthController` (Phase 4).

```typescript
import { OidcModule } from './oidc/oidc.module'

@Module({
  imports: [OidcModule],
  // ... existing providers
})
export class AuthModule {}
```

### 3.5 — ESM compatibility verification (must run before Phase 4)

Before writing `AuthController`, verify the dynamic import works end-to-end:

1. `pnpm build:api` — confirm TypeScript compiles without errors
2. `pnpm start:api` (with Docker Compose running) — confirm log line "OIDC discovery complete"
3. If ESM error occurs (e.g., `require() of ES Module`), document the exact error and resolve:
   - Option A: `"type": "module"` is NOT appropriate for NestJS CommonJS builds
   - Option B: Verify `nest-cli.json` does not bundle `openid-client` (must be external)
   - Option C: Node 24 supports `require(esm)` natively — confirm Node version in use
   - Record the resolution in `docs/local-auth-setup.md`

### Verification for Phase 3

After implementing:
1. `pnpm build:api` — no TypeScript errors
2. `pnpm dev:api` (Docker Compose running) — "OIDC discovery complete" in logs
3. `OidcClientService.buildAuthorizationUrl(...)` called manually in a test script returns a URL
   containing `state=`, `code_challenge=`, `nonce=`, and the serialised `claims=` parameter
4. `buildLogoutUrl(...)` returns a URL containing `end_session_endpoint` host, `id_token_hint=`,
   `post_logout_redirect_uri=`

---

## Phase 4 — Auth Controller & Guards

**Goal:** All five auth endpoints are live; `CsrfGuard` is wired as `APP_GUARD` after
`SessionGuard`; `SessionGuard` is updated to attach `session` (not just `user`) to the request
so `CsrfGuard` and `AuthController` can read `csrfToken` and encrypted tokens without a second
DB lookup.

### 4.1 — Extend request type with session

`SessionGuard` currently attaches only `request.user`. `CsrfGuard` needs `request.session`
(for `csrfToken`) and `AuthController`'s logout handler needs the encrypted tokens. Attach
the full `SessionRecord` alongside the user.

Add to `backend/src/auth/types/request-with-session.ts` (new file):

```typescript
import type { Request } from 'express'
import type { AuthenticatedUser } from './authenticated-user'
import type { SessionRecord } from './session-record'

export interface RequestWithSession extends Request {
  user?:      AuthenticatedUser
  session?:   SessionRecord
  sessionId?: string   // raw cookie value, needed for PgSessionStore.delete()
}
```

Update `SessionGuard` (`session.guard.ts`) — after the successful lookup, add:

```typescript
request.session   = session          // full record for CsrfGuard / logout
request.sessionId = sessionId        // raw value for store.delete()
request.user      = session.user     // existing line, unchanged
```

No changes to the guard's `canActivate` signature or return type.

### 4.2 — `backend/src/auth/guards/csrf.guard.ts`

New file. Applied as second `APP_GUARD`. Reads `X-CSRF-Token` header and compares to
`session.csrfToken` already resolved by `SessionGuard`.

```typescript
import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import type { RequestWithSession } from '../types/request-with-session'

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<RequestWithSession>()
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) return true

    const header = req.headers['x-csrf-token']
    const token  = Array.isArray(header) ? header[0] : header

    if (!token || token !== req.session?.csrfToken) {
      throw new ForbiddenException('CSRF token mismatch')
    }
    return true
  }
}
```

### 4.3 — `backend/src/auth/auth.module.ts` — wire CsrfGuard

Add `CsrfGuard` as a second `APP_GUARD` after `SessionGuard`. NestJS processes `APP_GUARD`
providers in registration order, so `SessionGuard` runs first and populates `request.session`
before `CsrfGuard` reads it.

```typescript
import { CsrfGuard } from './guards/csrf.guard'

providers: [
  // Session store
  { provide: SESSION_STORE, useClass: PgSessionStore },
  // Required ACR
  { provide: 'REQUIRED_ACR', useFactory: ..., inject: [ConfigService] },
  // Guards (order matters: SessionGuard first)
  SessionGuard,
  { provide: APP_GUARD, useExisting: SessionGuard },
  CsrfGuard,
  { provide: APP_GUARD, useExisting: CsrfGuard },
  // Migration runner
  MigrationRunnerService,
]
```

### 4.4 — Pending-auth helpers (internal, used by controller)

These live in `backend/src/auth/providers/pending-auth.store.ts` (new file) to keep the
controller lean. Injected with `PG_POOL`.

```typescript
import { randomBytes } from 'crypto'
import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'pg'
import { PG_POOL } from '../../database/pg.module'

export interface PendingAuthRecord {
  nonce:         string
  codeVerifier:  string
  flow:          'login' | 'register'
}

@Injectable()
export class PendingAuthStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(flow: 'login' | 'register'): Promise<{ id: string; state: string; nonce: string; codeVerifier: string }> {
    const id           = randomBytes(32).toString('hex')
    const state        = randomBytes(32).toString('hex')
    const nonce        = randomBytes(32).toString('hex')
    const codeVerifier = randomBytes(64).toString('hex')
    const expiresAt    = new Date(Date.now() + 10 * 60 * 1000)  // 10 minutes

    await this.pool.query(
      `INSERT INTO pending_auth (id, state, nonce, code_verifier, flow, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, state, nonce, codeVerifier, flow, expiresAt],
    )
    return { id, state, nonce, codeVerifier }
  }

  /** Atomically consume the row. Returns undefined if not found, expired, or state mismatch. */
  async consume(id: string, state: string): Promise<PendingAuthRecord | undefined> {
    const result = await this.pool.query<{
      nonce: string; code_verifier: string; flow: string
    }>(
      `DELETE FROM pending_auth
       WHERE id = $1 AND state = $2 AND expires_at > NOW()
       RETURNING nonce, code_verifier, flow`,
      [id, state],
    )
    if (result.rowCount === 0) return undefined
    const row = result.rows[0]
    return {
      nonce:        row.nonce,
      codeVerifier: row.code_verifier,
      flow:         row.flow as 'login' | 'register',
    }
  }
}
```

Add `PendingAuthStore` to `AuthModule` providers (not exported).

### 4.5 — `backend/src/auth/auth.controller.ts` — replace with full implementation

Replace the existing minimal controller entirely. All five endpoints. `@Public()` on the three
unauthenticated routes (`/login`, `/register`, `/callback`).

```typescript
import {
  Controller, Get, Post, Req, Res, HttpCode, HttpStatus,
  BadRequestException, UnauthorizedException, Logger, Inject,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes, createHash } from 'crypto'
import type { Response } from 'express'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthenticatedUser } from './types/authenticated-user'
import type { RequestWithSession } from './types/request-with-session'
import { SESSION_STORE } from './types/session-store.interface'
import type { SessionStore } from './types/session-store.interface'
import { OidcClientService } from './oidc/oidc-client.service'
import { PendingAuthStore } from './providers/pending-auth.store'
import { TokenCrypto } from './token/token-crypto'
import type { AuthConfig } from '../config/auth.config'

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)
  private readonly crypto: TokenCrypto
  private readonly sessionTtlMs: number
  private readonly frontendAppUrl: string
  private readonly frontendUrl: string

  constructor(
    private readonly oidc:          OidcClientService,
    private readonly pendingAuth:   PendingAuthStore,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    private readonly config:        ConfigService,
  ) {
    const auth = config.get<AuthConfig>('auth')!
    this.crypto        = new TokenCrypto(auth.tokenEncryptionKey)
    this.sessionTtlMs  = (auth.sessionTtlSeconds ?? 1800) * 1000
    this.frontendAppUrl = auth.frontendAppUrl
    this.frontendUrl   = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'
  }

  // ── GET /api/auth/login ────────────────────────────────────────────────────
  @Public()
  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    await this._initiateFlow('login', res)
  }

  // ── GET /api/auth/register ─────────────────────────────────────────────────
  @Public()
  @Get('register')
  async register(@Res() res: Response): Promise<void> {
    await this._initiateFlow('register', res)
  }

  // ── GET /api/auth/callback ─────────────────────────────────────────────────
  @Public()
  @Get('callback')
  async callback(@Req() req: RequestWithSession, @Res() res: Response): Promise<void> {
    const cookies = req.cookies as Record<string, string>
    const txId    = cookies['auth_tx']
    if (!txId) throw new BadRequestException('Missing auth transaction')

    // Check for provider error (user cancelled, etc.)
    const query = req.query as Record<string, string>
    if (query['error']) throw new BadRequestException('Authentication cancelled or failed')

    const code  = query['code']
    const state = query['state']
    if (!code || !state) throw new BadRequestException('Missing code or state')

    // Atomic consume — validates id + state + expiry in one query
    const pending = await this.pendingAuth.consume(txId, state)
    if (!pending) throw new BadRequestException('Invalid or expired auth transaction')

    // Exchange code for tokens
    let tokenResult: Awaited<ReturnType<OidcClientService['exchangeCode']>>
    try {
      tokenResult = await this.oidc.exchangeCode({
        code,
        codeVerifier: pending.codeVerifier,
        nonce:        pending.nonce,
      })
    } catch (err) {
      this.logger.warn(`Token exchange failed: ${(err as Error).message}`)
      throw new BadRequestException('Token exchange failed')
    }

    const { idTokenClaims, refreshToken, idTokenRaw } = tokenResult
    const acr = idTokenClaims['acr'] as string | undefined
    if (acr !== '2') throw new UnauthorizedException('ACR 2 not satisfied')

    // Build session
    const sessionId   = randomBytes(32).toString('hex')
    const csrfToken   = randomBytes(32).toString('hex')
    const expiresAt   = Date.now() + this.sessionTtlMs

    const user: AuthenticatedUser = {
      sub:   idTokenClaims['sub']   as string,
      email: idTokenClaims['email'] as string | undefined,
      name:  idTokenClaims['name']  as string | undefined,
      acr,
    }

    await this.sessionStore.set(sessionId, {
      user,
      acr,
      csrfToken,
      encryptedRefreshToken: this.crypto.encrypt(refreshToken),
      encryptedIdToken:      this.crypto.encrypt(idTokenRaw),
      expiresAt,
    })

    // Clear auth_tx, set session cookies
    res
      .cookie('auth_tx', '', {
        httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 0,
      })
      .cookie('session_id', sessionId, {
        httpOnly: true, sameSite: 'strict', path: '/',
      })
      .cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false, sameSite: 'strict', path: '/',
      })
      .redirect(302, this.frontendAppUrl)
  }

  // ── GET /api/auth/me ───────────────────────────────────────────────────────
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }

  // ── POST /api/auth/logout ──────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: RequestWithSession, @Res() res: Response): Promise<void> {
    const session   = req.session!
    const sessionId = req.sessionId!

    // Decrypt ID token for RP-initiated logout hint
    let idTokenRaw = ''
    let refreshToken = ''
    try {
      idTokenRaw   = this.crypto.decrypt(session.encryptedIdToken)
      refreshToken = this.crypto.decrypt(session.encryptedRefreshToken)
    } catch {
      // Log hash only — never log raw cookie or token values
      const hash = createHash('sha256').update(sessionId).digest('hex')
      this.logger.warn(`Failed to decrypt tokens for session ${hash}`)
    }

    // Delete local session first
    await this.sessionStore.delete(sessionId)

    // Best-effort token revocation
    if (refreshToken) {
      await this.oidc.revokeToken(refreshToken, 'refresh_token')
    }

    // Build RP-initiated logout URL
    const logoutUrl = this.oidc.buildLogoutUrl(idTokenRaw, this.frontendUrl)

    // Clear cookies
    res
      .cookie('session_id', '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 })
      .cookie('XSRF-TOKEN', '', { httpOnly: false, sameSite: 'strict', path: '/', maxAge: 0 })
      .json({ logoutUrl })
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private async _initiateFlow(flow: 'login' | 'register', res: Response): Promise<void> {
    const { id, state, nonce, codeVerifier } = await this.pendingAuth.create(flow)

    const authUrl = this.oidc.buildAuthorizationUrl({ state, nonce, codeVerifier, flow })

    res
      .cookie('auth_tx', id, {
        httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 600,
      })
      .redirect(302, authUrl)
  }
}
```

**Cookie `domain` note:** no `domain` attribute is set on any cookie. All cookies are
host-bound to `localhost`. This matches the spec (Section 1, "no explicit Domain attribute").

**`session_id` Path note:** set to `Path=/` (not `Path=/api`) so the Next.js middleware can
read it on section-page requests (e.g., `/calendario`). This matches spec Section 1.

### 4.6 — `backend/src/auth/auth.module.ts` — full updated state

After all phases 2–4 changes, `AuthModule` should look like:

```typescript
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AuthController }     from './auth.controller'
import { SessionGuard }       from './guards/session.guard'
import { CsrfGuard }          from './guards/csrf.guard'
import { PgSessionStore }     from './providers/pg-session.store'
import { PendingAuthStore }   from './providers/pending-auth.store'
import { MigrationRunnerService } from './migration-runner.service'
import { OidcModule }         from './oidc/oidc.module'
import { SESSION_STORE }      from './types/session-store.interface'
import type { AuthConfig }    from '../config/auth.config'

@Module({
  imports: [OidcModule],
  controllers: [AuthController],
  providers: [
    { provide: SESSION_STORE, useClass: PgSessionStore },
    {
      provide: 'REQUIRED_ACR',
      useFactory: (config: ConfigService): string =>
        config.get<AuthConfig>('auth')?.keycloakRequiredAcr ?? '2',
      inject: [ConfigService],
    },
    SessionGuard,
    { provide: APP_GUARD, useExisting: SessionGuard },
    CsrfGuard,
    { provide: APP_GUARD, useExisting: CsrfGuard },
    PgSessionStore,
    PendingAuthStore,
    MigrationRunnerService,
  ],
})
export class AuthModule {}
```

**`PgSessionStore` provider note:** it appears twice — once as `SESSION_STORE` token and once
as a class provider (so it can be injected directly by `AuthController` for logout). The class
provider entry creates the single instance; the token entry aliases it. Alternatively, provide
only the token and inject `SESSION_STORE` in the controller — this is cleaner. Preferred:

```typescript
{ provide: SESSION_STORE, useClass: PgSessionStore },
// AuthController injects SESSION_STORE token, not the class directly
```

Update `AuthController` constructor to `@Inject(SESSION_STORE)` (already shown in 4.5).

### Verification for Phase 4

After implementing:
1. `pnpm build:api` — no TypeScript errors
2. `GET /api/auth/login` → 302, `Location` starts with Keycloak issuer URL, `auth_tx` cookie set
3. `GET /api/auth/register` → 302, `auth_tx` cookie set
4. `GET /api/auth/me` (no session) → 401
5. `POST /api/auth/logout` (no session) → 401
6. `POST /api/auth/logout` (no CSRF header, valid session) → 403
7. Full manual login flow (requires Docker Compose + Google account) → see Phase 8 checklist

---

## Phase 5 — Frontend Integration

**Goal:** Next.js proxies `/api/**` to NestJS; the middleware protects section pages; the
WelcomeScreen buttons navigate to the real auth endpoints; `apiFetch` attaches the CSRF header
on mutating requests; `useCurrentUser` polls `/api/auth/me`. No new pages; no changes to
animations, gradients, palettes, or section navigation.

### 5.1 — `prototypes/ui-shell/next.config.ts` — add API rewrite

Replace the current empty config:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source:      '/api/:path*',
        destination: `${process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3001'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
```

**Why this works for cookies:** Next.js rewrites proxy the request server-side and forward the
response (including `Set-Cookie` headers) back to the browser as if the response came from
`localhost:3000`. The browser sees `Set-Cookie` on the `localhost:3000` origin. No CORS needed.

**Redirect forwarding note:** Next.js rewrites do NOT follow redirects server-side — they
forward the 302 response to the browser, which then follows it. NestJS returns
`302 Location: http://localhost:3000/?view=menu` (absolute URL). The browser follows it
directly to Next.js. This is the correct behaviour for the login/callback flow.

### 5.2 — `prototypes/ui-shell/middleware.ts`

New file at the root of the `ui-shell` package (alongside `next.config.ts`). Next.js App
Router picks up `middleware.ts` from the package root automatically.

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/calendario', '/esercizi', '/inbox', '/lavagna', '/oggi', '/quaderno'],
}

export default function middleware(req: NextRequest): NextResponse {
  const session = req.cookies.get('session_id')
  if (!session) {
    return NextResponse.redirect(new URL('/api/auth/login', req.url))
  }
  return NextResponse.next()
}
```

**No redirect loops:**
- `/` — not in `matcher`; always accessible
- `/api/auth/login` — not in `matcher`; forwarded to NestJS via rewrite
- `/api/auth/callback` — not in `matcher`; forwarded to NestJS
- Section pages with no `session_id` → redirect to `/api/auth/login` → NestJS → Keycloak
- After login, NestJS redirects to `/?view=menu` — not in `matcher`, renders the radial menu

**Presence-only check:** the middleware only checks cookie presence. NestJS validates the
session on every API call. A stale or forged cookie passes the middleware but receives 401 from
NestJS; the frontend handles 401 by redirecting to `/api/auth/login`.

**`session_id` Path=/ requirement:** the spec sets `session_id` with `Path=/`. This means the
browser sends it with page requests to `/calendario` etc. (not just `/api/**`). The middleware
can read it because it arrives with the page request. If `Path=/api` were used, the browser
would not send the cookie with page requests and the middleware check would always fail.

### 5.3 — `prototypes/ui-shell/lib/apiFetch.ts`

New file.

```typescript
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const csrfToken = getCookie('XSRF-TOKEN')
  const method    = (init.method ?? 'GET').toUpperCase()
  const headers   = new Headers(init.headers)

  if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  return fetch(url, { ...init, headers, credentials: 'include' })
}
```

`credentials: 'include'` ensures session cookies are sent on cross-origin fetch calls. Since
all `/api/**` calls are same-origin (proxied via Next.js rewrite), this is redundant but
harmless and correct for future B-2 changes.

### 5.4 — `prototypes/ui-shell/hooks/useCurrentUser.ts`

New file. Calls `GET /api/auth/me` once on mount. Returns the user or `null`. A 401 response
is treated as "not authenticated" (returns `null`). Other errors are not swallowed — they
propagate as thrown errors for the caller to handle.

```typescript
'use client'

import { useState, useEffect } from 'react'

export interface CurrentUser {
  sub:    string
  email?: string
  name?:  string
  acr?:   string
}

export function useCurrentUser(): CurrentUser | null | undefined {
  // undefined = loading, null = unauthenticated, CurrentUser = authenticated
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.status === 401) return null
        if (!res.ok) throw new Error(`/api/auth/me returned ${res.status}`)
        return res.json() as Promise<CurrentUser>
      })
      .then(data => { if (!cancelled) setUser(data) })
      .catch(() => { if (!cancelled) setUser(null) })
    return () => { cancelled = true }
  }, [])

  return user
}
```

**Where this hook is used:** the spec places `useCurrentUser` in an `AuthProvider` context
inside `AppShell`. For B-1 the hook is defined here; wiring it into `AppShell` via a context
provider is part of this phase (see 5.5). The hook is not yet called from section pages —
those pages rely on the middleware presence check + NestJS 401 for protection.

### 5.5 — `components/AppShell.tsx` — wire auth

`AppShell` already has `handleLogin` and `handleRegister` using
`NEXT_PUBLIC_AUTH_LOGIN_URL` / `NEXT_PUBLIC_AUTH_REGISTER_URL`. In B-1 those env vars will be
set to `/api/auth/login` and `/api/auth/register`. No code change needed for the navigation
itself — only the env vars need to be set.

**What does need a change:** the `useCurrentUser` hook should be called inside `AppShell` so
the radial menu can show user identity (or react to a 401). Add it as an internal call; do
not yet expose it via a React context unless required by an existing consumer. Keep the change
minimal — one `useCurrentUser()` call near the top of the component body, result available for
future use. Do not add UI that reads from it yet (no regressions to existing layout).

```typescript
// Add near top of AppShell component body, after existing hooks:
import { useCurrentUser } from '@/hooks/useCurrentUser'
// ...
const currentUser = useCurrentUser()
// currentUser is available for future UI use; not rendered in B-1
void currentUser  // prevent unused-variable lint warning
```

**No other changes to `AppShell`** — no gradient, palette, animation, or section navigation
changes.

### 5.6 — `prototypes/ui-shell/.env.local.example`

New committed file (the real `.env.local` is gitignored and already exists with
`NEXT_PUBLIC_SHOW_PALETTE_SWITCHER=true`). The example documents all auth-related vars:

```
# Auth
NEXT_PUBLIC_AUTH_CONFIGURED=true
NEXT_PUBLIC_AUTH_LOGIN_URL=/api/auth/login
NEXT_PUBLIC_AUTH_REGISTER_URL=/api/auth/register

# NestJS proxy target (used in next.config.ts rewrites)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Palette switcher (existing)
NEXT_PUBLIC_SHOW_PALETTE_SWITCHER=true
```

**Local `.env.local` update:** the developer must add the new vars to their real
`prototypes/ui-shell/.env.local`. Document this in `docs/local-auth-setup.md` (Phase 8).

**`NEXT_PUBLIC_AUTH_CONFIGURED=true`:** `WelcomeScreen` gates both buttons on this flag.
Without it the buttons show the "Autenticazione non ancora disponibile" message instead of
navigating. Set it to `true` once the Docker Compose stack and NestJS are running.

### 5.7 — No changes needed

The following files are NOT touched in Phase 5:
- `app/page.tsx` — already reads `?view=menu` and passes `initialView` to `AppShell`
- `app/layout.tsx` — no auth wrapper needed at layout level
- Section `page.tsx` files — protected by middleware; no changes
- `RadialMenu`, `RadialMenuItem`, `SectionPlaceholder`, `CalendarView` — untouched

### Verification for Phase 5

After implementing:
1. `pnpm dev` (in `prototypes/ui-shell/`) — Next.js starts on :3000
2. `GET http://localhost:3000/api/auth/login` — browser proxied to NestJS, redirects to Keycloak (requires Docker Compose + NestJS running)
3. `GET http://localhost:3000/calendario` (no session cookie) — middleware redirects to `/api/auth/login`
4. `GET http://localhost:3000/` — Welcome screen renders, no redirect
5. After login, `/?view=menu` — radial menu renders, existing animations intact
6. `POST /api/auth/logout` via `apiFetch` — `X-CSRF-Token` header attached automatically

---

## Phase 6 — Unit Tests

**Goal:** Five new unit test files, all runnable with `pnpm test` (no Docker, no network). The
existing `session.guard.spec.ts` needs `makeRecord` updated for the new `SessionRecord` fields.

### 6.0 — Update existing `session.guard.spec.ts`

`makeRecord` currently builds `{ user, acr, expiresAt }`. The `SessionRecord` interface now
requires `csrfToken`, `encryptedRefreshToken`, `encryptedIdToken`. Update the helper so
existing tests compile:

```typescript
function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    user:                   { sub: 'user-abc', acr: REQUIRED_ACR },
    acr:                    REQUIRED_ACR,
    csrfToken:              'csrf-token-value',
    encryptedRefreshToken:  'nonce:cipher:tag',
    encryptedIdToken:       'nonce:cipher:tag',
    expiresAt:              Date.now() + 60_000,
    ...overrides,
  }
}
```

No test logic changes — only the fixture. All 12 existing tests must continue to pass.

### 6.1 — `backend/test/unit/token-crypto.spec.ts`

```typescript
import { TokenCrypto, InvalidTokenError } from '../../src/auth/token/token-crypto'

const VALID_KEY = 'a'.repeat(64)  // 64 hex chars, all 'a' — valid AES-256 key for testing

describe('TokenCrypto', () => {
  let crypto: TokenCrypto

  beforeEach(() => { crypto = new TokenCrypto(VALID_KEY) })

  it('encrypt + decrypt roundtrip returns identical plaintext', () => {
    const plaintext = 'refresh-token-value-xyz'
    expect(crypto.decrypt(crypto.encrypt(plaintext))).toBe(plaintext)
  })

  it('two encrypt calls on the same plaintext produce different ciphertext (unique nonces)', () => {
    const plaintext = 'same-value'
    expect(crypto.encrypt(plaintext)).not.toBe(crypto.encrypt(plaintext))
  })

  it('decrypt with a different key throws InvalidTokenError', () => {
    const encrypted = crypto.encrypt('secret')
    const other     = new TokenCrypto('b'.repeat(64))
    expect(() => other.decrypt(encrypted)).toThrow(InvalidTokenError)
  })

  it('decrypt with tampered ciphertext bytes throws InvalidTokenError', () => {
    const [nonce, cipher, tag] = crypto.encrypt('secret').split(':')
    // Flip first byte of ciphertext
    const badCipher = (parseInt(cipher.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')
                      + cipher.slice(2)
    expect(() => crypto.decrypt(`${nonce}:${badCipher}:${tag}`)).toThrow(InvalidTokenError)
  })

  it('decrypt with tampered auth tag throws InvalidTokenError', () => {
    const [nonce, cipher, tag] = crypto.encrypt('secret').split(':')
    const badTag = (parseInt(tag.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')
                   + tag.slice(2)
    expect(() => crypto.decrypt(`${nonce}:${cipher}:${badTag}`)).toThrow(InvalidTokenError)
  })

  it('decrypt on malformed string (wrong colon segments) throws InvalidTokenError', () => {
    expect(() => crypto.decrypt('onlyone')).toThrow(InvalidTokenError)
    expect(() => crypto.decrypt('one:two')).toThrow(InvalidTokenError)
    expect(() => crypto.decrypt('one:two:three:four')).toThrow(InvalidTokenError)
  })

  it('constructor throws when key is not 64 hex characters', () => {
    expect(() => new TokenCrypto('tooshort')).toThrow()
    expect(() => new TokenCrypto('a'.repeat(63))).toThrow()
    expect(() => new TokenCrypto('a'.repeat(65))).toThrow()
  })
})
```

### 6.2 — `backend/test/unit/pg-session.store.spec.ts`

Mocks `pg.Pool.query` directly — no real database.

```typescript
import { PgSessionStore } from '../../src/auth/providers/pg-session.store'
import { createHash } from 'crypto'
import type { SessionRecord } from '../../src/auth/types/session-record'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const RAW_ID  = 'raw-session-id-value'
const ID_HASH = sha256(RAW_ID)

function makeRecord(): SessionRecord {
  return {
    user:                   { sub: 'user-1', email: 'u@example.com' },
    acr:                    '2',
    csrfToken:              'csrf-abc',
    encryptedRefreshToken:  'nonce:cipher:tag',
    encryptedIdToken:       'nonce:cipher:tag',
    expiresAt:              Date.now() + 60_000,
  }
}

function makePool(queryResult: { rows: unknown[]; rowCount: number }) {
  return { query: jest.fn().mockResolvedValue(queryResult) }
}

describe('PgSessionStore', () => {
  describe('get', () => {
    it('returns a SessionRecord when a valid row is found', async () => {
      const record = makeRecord()
      const row = {
        user_data:               record.user,
        acr:                     record.acr,
        csrf_token:              record.csrfToken,
        encrypted_refresh_token: record.encryptedRefreshToken,
        encrypted_id_token:      record.encryptedIdToken,
        expires_at:              new Date(record.expiresAt),
      }
      const pool  = makePool({ rows: [row], rowCount: 1 })
      const store = new PgSessionStore(pool as never)

      const result = await store.get(RAW_ID)

      expect(result).toMatchObject({ user: record.user, acr: '2', csrfToken: 'csrf-abc' })
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id_hash = $1'),
        [ID_HASH],
      )
    })

    it('returns undefined when no row is returned (expired filtered by DB)', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      expect(await store.get(RAW_ID)).toBeUndefined()
    })

    it('returns undefined when rowCount is 0 regardless of rows array', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      expect(await store.get('any-id')).toBeUndefined()
    })
  })

  describe('set', () => {
    it('executes INSERT with SHA-256 hash of the raw session ID, not the raw value', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      await store.set(RAW_ID, makeRecord())

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/INSERT INTO sessions/)
      expect(params[0]).toBe(ID_HASH)     // first param is the hash
      expect(params[0]).not.toBe(RAW_ID)  // not the raw value
    })
  })

  describe('delete', () => {
    it('executes DELETE with the hashed ID', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      await store.delete(RAW_ID)

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/DELETE FROM sessions/)
      expect(params[0]).toBe(ID_HASH)
    })
  })
})
```

### 6.3 — `backend/test/unit/migration-runner.spec.ts`

Mocks `pg.Pool` client and `fs/promises`. Because `MigrationRunnerService` calls `readdir` and
`readFile` from `fs/promises`, mock those at the module level.

```typescript
import { MigrationRunnerService } from '../../src/auth/migration-runner.service'

// Mock fs/promises before importing the service
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}))
import { readdir, readFile } from 'fs/promises'

function makeClient(queryResults: Array<{ rows: unknown[]; rowCount: number }>) {
  let callCount = 0
  return {
    query:   jest.fn().mockImplementation(() => Promise.resolve(queryResults[callCount++] ?? { rows: [], rowCount: 0 })),
    release: jest.fn(),
  }
}

function makePool(client: ReturnType<typeof makeClient>) {
  return { connect: jest.fn().mockResolvedValue(client) }
}

describe('MigrationRunnerService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates _migrations table if it does not exist', async () => {
    const client  = makeClient([{ rows: [], rowCount: 0 }])
    const pool    = makePool(client)
    ;(readdir as jest.Mock).mockResolvedValue([])

    const svc = new MigrationRunnerService(pool as never)
    await svc.onApplicationBootstrap()

    const queries = (client.query as jest.Mock).mock.calls.map(([q]: [string]) => q)
    expect(queries.some((q: string) => q.includes('CREATE TABLE IF NOT EXISTS _migrations'))).toBe(true)
  })

  it('applies SQL files in strict alphabetical order', async () => {
    // Files listed out of order — service must sort them
    ;(readdir as jest.Mock).mockResolvedValue(['002_b.sql', '001_a.sql'])
    ;(readFile as jest.Mock).mockResolvedValue('SELECT 1;')

    // Already-applied check returns 0 rows for both files
    const client = makeClient([
      { rows: [], rowCount: 0 }, // BEGIN for _migrations table
      { rows: [], rowCount: 0 }, // CREATE _migrations
      { rows: [], rowCount: 0 }, // COMMIT
      { rows: [], rowCount: 0 }, // SELECT 1 FROM _migrations WHERE filename = '001_a.sql'
      { rows: [], rowCount: 0 }, // BEGIN
      { rows: [], rowCount: 0 }, // SQL content
      { rows: [], rowCount: 0 }, // INSERT _migrations
      { rows: [], rowCount: 0 }, // COMMIT
      { rows: [], rowCount: 0 }, // SELECT 1 FROM _migrations WHERE filename = '002_b.sql'
      { rows: [], rowCount: 0 }, // BEGIN
      { rows: [], rowCount: 0 }, // SQL content
      { rows: [], rowCount: 0 }, // INSERT _migrations
      { rows: [], rowCount: 0 }, // COMMIT
    ])
    const pool = makePool(client)
    const svc  = new MigrationRunnerService(pool as never)
    await svc.onApplicationBootstrap()

    // readFile must be called with 001 before 002
    const fileCalls = (readFile as jest.Mock).mock.calls.map(([p]: [string]) => p)
    expect(fileCalls[0]).toMatch(/001_a\.sql/)
    expect(fileCalls[1]).toMatch(/002_b\.sql/)
  })

  it('does not re-apply files already recorded in _migrations', async () => {
    ;(readdir as jest.Mock).mockResolvedValue(['001_a.sql'])
    ;(readFile as jest.Mock).mockResolvedValue('SELECT 1;')

    // SELECT returns a row -> already applied
    const client = makeClient([
      { rows: [], rowCount: 0 }, // BEGIN
      { rows: [], rowCount: 0 }, // CREATE _migrations
      { rows: [], rowCount: 0 }, // COMMIT
      { rows: [{ '?column?': 1 }], rowCount: 1 }, // SELECT 1 FROM _migrations -> found
    ])
    const pool = makePool(client)
    const svc  = new MigrationRunnerService(pool as never)
    await svc.onApplicationBootstrap()

    expect(readFile).not.toHaveBeenCalled()
  })

  it('throws when a SQL file execution returns an error', async () => {
    ;(readdir as jest.Mock).mockResolvedValue(['001_a.sql'])
    ;(readFile as jest.Mock).mockResolvedValue('INVALID SQL;')

    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN (_migrations)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE _migrations
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT -> not applied
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(new Error('syntax error')),// SQL fails
      release: jest.fn(),
    }
    const pool = makePool(client)
    const svc  = new MigrationRunnerService(pool as never)
    await expect(svc.onApplicationBootstrap()).rejects.toThrow('syntax error')
  })
})
```

### 6.4 — `backend/test/unit/oidc-client.service.spec.ts`

Uses `jest.mock('openid-client', factory, { virtual: true })` — the real ESM package is never
loaded during unit tests.

```typescript
// Must be defined before any imports that trigger the mock registry
const mockDiscovery   = jest.fn()
const mockCodeGrant   = jest.fn()
const mockRevocation  = jest.fn()

jest.mock('openid-client', () => ({
  discovery:              mockDiscovery,
  authorizationCodeGrant: mockCodeGrant,
  tokenRevocation:        mockRevocation,
}), { virtual: true })

import { OidcClientService } from '../../src/auth/oidc/oidc-client.service'
import { ConfigService }     from '@nestjs/config'

const ISSUER  = 'http://localhost:8080/realms/agenda'
const CLIENT  = 'agenda-bff'
const SECRET  = 'bff-secret'

function makeConfig(): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      keycloakIssuerUrl:      ISSUER,
      keycloakClientId:       CLIENT,
      keycloakBffClientSecret: SECRET,
      keycloakRequiredAcr:    '2',
    }),
  } as unknown as ConfigService
}

function makeServerMetadata(overrides: Record<string, string> = {}) {
  return {
    authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
    end_session_endpoint:   `${ISSUER}/protocol/openid-connect/logout`,
    ...overrides,
  }
}

describe('OidcClientService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('onModuleInit calls discovery() with the configured issuer URL', async () => {
    mockDiscovery.mockResolvedValue(makeServerMetadata())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()
    expect(mockDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining(ISSUER) }),
      CLIENT,
      SECRET,
    )
  })

  it('buildAuthorizationUrl returns a URL containing state, code_challenge, and nonce', async () => {
    mockDiscovery.mockResolvedValue(makeServerMetadata())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const url = new URL(svc.buildAuthorizationUrl({
      state: 'test-state', nonce: 'test-nonce',
      codeVerifier: 'a'.repeat(64), flow: 'login',
    }))
    expect(url.searchParams.get('state')).toBe('test-state')
    expect(url.searchParams.get('nonce')).toBe('test-nonce')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('buildAuthorizationUrl URL contains the serialised claims parameter', async () => {
    mockDiscovery.mockResolvedValue(makeServerMetadata())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const url    = new URL(svc.buildAuthorizationUrl({
      state: 's', nonce: 'n', codeVerifier: 'v'.repeat(64), flow: 'login',
    }))
    const claims = JSON.parse(url.searchParams.get('claims') ?? '{}') as Record<string, unknown>
    expect(claims).toMatchObject({
      id_token: { acr: { essential: true, values: ['2'] } },
    })
  })

  it('exchangeCode calls the mocked token endpoint with code and codeVerifier', async () => {
    mockDiscovery.mockResolvedValue(makeServerMetadata())
    mockCodeGrant.mockResolvedValue({
      claims:        () => ({ sub: 'u1', acr: '2', nonce: 'n' }),
      refresh_token: 'rt',
      id_token:      'raw-jwt',
    })
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const result = await svc.exchangeCode({ code: 'code-abc', codeVerifier: 'cv', nonce: 'n' })
    expect(mockCodeGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ href: expect.stringContaining('code=code-abc') }),
      expect.objectContaining({ pkceCodeVerifier: 'cv', expectedNonce: 'n' }),
    )
    expect(result.idTokenClaims['acr']).toBe('2')
    expect(result.refreshToken).toBe('rt')
    expect(result.idTokenRaw).toBe('raw-jwt')
  })

  it('revokeToken does not throw when the revocation endpoint returns a network error', async () => {
    mockDiscovery.mockResolvedValue(makeServerMetadata())
    mockRevocation.mockRejectedValue(new Error('network failure'))
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()
    await expect(svc.revokeToken('token', 'refresh_token')).resolves.not.toThrow()
  })

  it('buildLogoutUrl contains id_token_hint and post_logout_redirect_uri', async () => {
    mockDiscovery.mockResolvedValue(makeServerMetadata())
    const svc = new OidcClientService(makeConfig())
    await svc.onModuleInit()

    const url = new URL(svc.buildLogoutUrl('raw-id-token', 'http://localhost:3000'))
    expect(url.searchParams.get('id_token_hint')).toBe('raw-id-token')
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000')
    expect(url.searchParams.get('client_id')).toBe(CLIENT)
  })
})
```

### 6.5 — `backend/test/unit/csrf.guard.spec.ts`

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CsrfGuard } from '../../src/auth/guards/csrf.guard'
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator'
import type { RequestWithSession } from '../../src/auth/types/request-with-session'
import type { SessionRecord } from '../../src/auth/types/session-record'

const VALID_TOKEN = 'valid-csrf-token-value'

function makeSession(): SessionRecord {
  return {
    user: { sub: 'u1' }, acr: '2',
    csrfToken:             VALID_TOKEN,
    encryptedRefreshToken: 'nonce:cipher:tag',
    encryptedIdToken:      'nonce:cipher:tag',
    expiresAt:             Date.now() + 60_000,
  }
}

function makeContext(options: {
  method:    string
  headers?:  Record<string, string>
  session?:  SessionRecord
  isPublic?: boolean
}): ExecutionContext {
  const req: Partial<RequestWithSession> = {
    method:  options.method,
    headers: (options.headers ?? {}) as ReturnType<Request['headers']['get']> as never,
    session: options.session,
  }
  const isPublic = options.isPublic ?? false
  return {
    switchToHttp:  () => ({ getRequest: () => req }),
    getHandler:    () => ({}),
    getClass:      () => ({}),
    _reflectorResp: isPublic,
  } as unknown as ExecutionContext
}

function makeReflector(isPublic: boolean): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector
}

describe('CsrfGuard', () => {
  it('@Public() route — CSRF check is skipped entirely', () => {
    const guard = new CsrfGuard(makeReflector(true))
    const ctx   = makeContext({ method: 'POST', isPublic: true })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('GET request — CSRF check is skipped', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({ method: 'GET', session: makeSession() })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('HEAD request — CSRF check is skipped', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({ method: 'HEAD', session: makeSession() })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('valid X-CSRF-Token header matching session.csrfToken — guard passes', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({
      method:  'POST',
      headers: { 'x-csrf-token': VALID_TOKEN },
      session: makeSession(),
    })
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('missing X-CSRF-Token header — throws ForbiddenException', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({ method: 'POST', session: makeSession() })
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })

  it('mismatched token value — throws ForbiddenException', () => {
    const guard = new CsrfGuard(makeReflector(false))
    const ctx   = makeContext({
      method:  'DELETE',
      headers: { 'x-csrf-token': 'wrong-token' },
      session: makeSession(),
    })
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })
})
```

### 6.6 — Jest config: add integration test pattern

Add a separate Jest config `backend/test/jest-integration.json` for integration tests (Phase 7).
Add a `test:integration` script to `backend/package.json`:

```json
"test:integration": "RUN_INTEGRATION_TESTS=true jest --config test/jest-integration.json"
```

```json
// test/jest-integration.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testMatch": ["**/test/integration/**/*.int-spec.ts"],
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "testEnvironment": "node",
  "testTimeout": 30000
}
```

### Verification for Phase 6

```bash
cd backend && pnpm test
```

Expected: all unit tests pass (existing 12 + 5 new files). Zero integration tests run under
`pnpm test` (they live in `test/integration/`, matched only by `jest-integration.json`).

---

## Phase 7 — E2E & Integration Tests

**Goal:** E2E tests cover all auth endpoint contracts without real Keycloak or PostgreSQL
(mocked stores). Integration tests verify real DB behaviour. Live tests are documented as
manual-only checklists.

### 7.1 — `backend/test/app.e2e-spec.ts` — append new auth cases

The existing file tests `GET /api/health` and baseline 401 behaviour. Add new `describe` blocks
after the existing ones. Do NOT change the existing `beforeAll` setup — `AppModule` is imported
as-is, but override the auth-related providers with mocks via `overrideProvider`.

**Approach:** replace `SESSION_STORE` and `PendingAuthStore` with in-memory test doubles, and
override `OidcClientService` with a mock. The migration runner must be suppressed (no DB in
e2e). Use `overrideProvider(MigrationRunnerService)` with a no-op.

```typescript
// At top of the new test module setup for auth tests:
const mockOidc = {
  buildAuthorizationUrl: jest.fn().mockReturnValue('http://keycloak/auth?state=s&code_challenge=c&nonce=n'),
  exchangeCode:          jest.fn(),
  revokeToken:           jest.fn().mockResolvedValue(undefined),
  buildLogoutUrl:        jest.fn().mockReturnValue('http://keycloak/logout?id_token_hint=x&post_logout_redirect_uri=http://localhost:3000'),
}
```

**Test module setup for auth e2e suite** (separate `describe` block with its own `beforeAll`):

```typescript
describe('Auth endpoints (e2e)', () => {
  let app: INestApplication
  let sessionStore: InMemorySessionStore   // or a simple Map-based double
  let pendingStore: Map<string, PendingAuthRow>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MigrationRunnerService)
        .useValue({ onApplicationBootstrap: async () => undefined })
      .overrideProvider(AppBootstrapService)
        .useValue({ onApplicationBootstrap: async () => undefined })
      .overrideProvider(OidcClientService)
        .useValue(mockOidc)
      .overrideProvider(SESSION_STORE)
        .useValue(inMemorySessionStore)
      .overrideProvider(PendingAuthStore)
        .useValue(inMemoryPendingAuthStore)
      .overrideProvider(PG_POOL)
        .useValue({ query: jest.fn(), connect: jest.fn() })
      .compile()

    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => { await app.close() })
  // ... tests below
})
```

**Tests — `GET /api/auth/login`:**

```typescript
it('returns 302; Location header starts with Keycloak issuer URL', async () => {
  const res = await request(app.getHttpServer()).get('/api/auth/login')
  expect(res.status).toBe(302)
  expect(res.headers['location']).toMatch(/^http:\/\/keycloak/)
})

it('response sets auth_tx cookie with HttpOnly and SameSite=Lax', async () => {
  const res = await request(app.getHttpServer()).get('/api/auth/login')
  const setCookie: string[] = res.headers['set-cookie'] ?? []
  const txCookie = setCookie.find(c => c.startsWith('auth_tx='))
  expect(txCookie).toBeTruthy()
  expect(txCookie).toMatch(/HttpOnly/i)
  expect(txCookie).toMatch(/SameSite=Lax/i)
})

it('auth_tx value is an opaque hex string (not JSON, not a JWT)', async () => {
  const res = await request(app.getHttpServer()).get('/api/auth/login')
  const setCookie: string[] = res.headers['set-cookie'] ?? []
  const txCookie = setCookie.find(c => c.startsWith('auth_tx='))!
  const value = txCookie.split(';')[0].split('=')[1]
  expect(value).toMatch(/^[0-9a-f]+$/)
  expect(() => JSON.parse(value)).toThrow()
  expect(value.split('.').length).not.toBe(3)  // not a JWT
})
```

**Tests — `GET /api/auth/register`:**

```typescript
it('returns 302 and sets auth_tx cookie', async () => {
  const res = await request(app.getHttpServer()).get('/api/auth/register')
  expect(res.status).toBe(302)
  const setCookie: string[] = res.headers['set-cookie'] ?? []
  expect(setCookie.some(c => c.startsWith('auth_tx='))).toBe(true)
})
```

**Tests — `GET /api/auth/callback` error cases (no mocked pending_auth row needed):**

```typescript
it('no auth_tx cookie -> 400', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?code=x&state=y')
  expect(res.status).toBe(400)
})

it('Keycloak returned error param (user cancelled) -> 400', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?error=access_denied')
    .set('Cookie', 'auth_tx=some-tx-id')
  expect(res.status).toBe(400)
})

it('state param does not match stored state -> 400', async () => {
  // Seed a pending_auth row with state='correct-state'
  inMemoryPendingAuthStore.seed('tx-id-1', {
    id: 'tx-id-1', state: 'correct-state', nonce: 'n',
    codeVerifier: 'cv', flow: 'login',
    expiresAt: new Date(Date.now() + 60_000),
  })
  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?code=c&state=wrong-state')
    .set('Cookie', 'auth_tx=tx-id-1')
  expect(res.status).toBe(400)
})

it('auth_tx references an expired pending_auth row -> 400', async () => {
  inMemoryPendingAuthStore.seed('tx-expired', {
    id: 'tx-expired', state: 'state-x', nonce: 'n',
    codeVerifier: 'cv', flow: 'login',
    expiresAt: new Date(Date.now() - 1000),  // already expired
  })
  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?code=c&state=state-x')
    .set('Cookie', 'auth_tx=tx-expired')
  expect(res.status).toBe(400)
})
```

**Tests — `GET /api/auth/callback` success (mocked token exchange, acr=2):**

```typescript
it('valid callback -> 302 to FRONTEND_APP_URL; correct cookies set', async () => {
  mockOidc.exchangeCode.mockResolvedValueOnce({
    idTokenClaims: { sub: 'u1', email: 'u@test.com', acr: '2', nonce: 'n' },
    refreshToken:  'rt',
    idTokenRaw:    'raw-jwt',
  })
  inMemoryPendingAuthStore.seed('tx-ok', {
    id: 'tx-ok', state: 'state-ok', nonce: 'n',
    codeVerifier: 'cv', flow: 'login',
    expiresAt: new Date(Date.now() + 60_000),
  })

  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?code=code-abc&state=state-ok')
    .set('Cookie', 'auth_tx=tx-ok')

  expect(res.status).toBe(302)
  const setCookie: string[] = res.headers['set-cookie'] ?? []

  const sessionCookie = setCookie.find(c => c.startsWith('session_id='))!
  expect(sessionCookie).toMatch(/HttpOnly/i)
  expect(sessionCookie).toMatch(/SameSite=Strict/i)
  expect(sessionCookie).toMatch(/Path=\//i)
  expect(sessionCookie).not.toMatch(/Max-Age/i)  // session cookie, no max-age

  const csrfCookie = setCookie.find(c => c.startsWith('XSRF-TOKEN='))!
  expect(csrfCookie).not.toMatch(/HttpOnly/i)    // must be JS-readable
  expect(csrfCookie).toMatch(/SameSite=Strict/i)
  expect(csrfCookie).toMatch(/Path=\//i)

  const txCookie = setCookie.find(c => c.startsWith('auth_tx='))!
  expect(txCookie).toMatch(/Max-Age=0/i)         // cleared
})
```

**Tests — `GET /api/auth/callback` ACR failures:**

```typescript
it('acr absent from ID token claims -> 401', async () => {
  mockOidc.exchangeCode.mockResolvedValueOnce({
    idTokenClaims: { sub: 'u1', nonce: 'n' },  // no acr
    refreshToken: 'rt', idTokenRaw: 'raw',
  })
  inMemoryPendingAuthStore.seed('tx-no-acr', {
    id: 'tx-no-acr', state: 'state-no-acr', nonce: 'n',
    codeVerifier: 'cv', flow: 'login',
    expiresAt: new Date(Date.now() + 60_000),
  })
  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?code=c&state=state-no-acr')
    .set('Cookie', 'auth_tx=tx-no-acr')
  expect(res.status).toBe(401)
})

it('acr present but !== "2" -> 401', async () => {
  mockOidc.exchangeCode.mockResolvedValueOnce({
    idTokenClaims: { sub: 'u1', acr: '1', nonce: 'n' },
    refreshToken: 'rt', idTokenRaw: 'raw',
  })
  inMemoryPendingAuthStore.seed('tx-acr1', {
    id: 'tx-acr1', state: 'state-acr1', nonce: 'n',
    codeVerifier: 'cv', flow: 'login',
    expiresAt: new Date(Date.now() + 60_000),
  })
  const res = await request(app.getHttpServer())
    .get('/api/auth/callback?code=c&state=state-acr1')
    .set('Cookie', 'auth_tx=tx-acr1')
  expect(res.status).toBe(401)
})
```

**Tests — concurrent/replay protection (two requests, same `auth_tx`):**

```typescript
it('second call with already-consumed auth_tx -> 400', async () => {
  mockOidc.exchangeCode.mockResolvedValueOnce({
    idTokenClaims: { sub: 'u1', acr: '2', nonce: 'n' },
    refreshToken: 'rt', idTokenRaw: 'raw',
  })
  inMemoryPendingAuthStore.seed('tx-replay', {
    id: 'tx-replay', state: 'state-replay', nonce: 'n',
    codeVerifier: 'cv', flow: 'login',
    expiresAt: new Date(Date.now() + 60_000),
  })

  const first = await request(app.getHttpServer())
    .get('/api/auth/callback?code=c&state=state-replay')
    .set('Cookie', 'auth_tx=tx-replay')
  expect(first.status).toBe(302)

  // Same auth_tx, same state — row was consumed by first request
  const second = await request(app.getHttpServer())
    .get('/api/auth/callback?code=c&state=state-replay')
    .set('Cookie', 'auth_tx=tx-replay')
  expect(second.status).toBe(400)
})
```

**Tests — `POST /api/auth/logout`:**

```typescript
it('POST /api/auth/logout without session -> 401', async () => {
  const res = await request(app.getHttpServer()).post('/api/auth/logout')
  expect(res.status).toBe(401)
})

it('POST /api/auth/logout with valid session -> 200; logoutUrl in body; cookies cleared', async () => {
  // Inject a session into the store directly
  const sessionId = 'test-session-id'
  const crypto    = new TokenCrypto(process.env['TOKEN_ENCRYPTION_KEY'] ?? 'a'.repeat(64))
  await inMemorySessionStore.set(sessionId, {
    user:                   { sub: 'u1', acr: '2' },
    acr:                    '2',
    csrfToken:              'csrf-val',
    encryptedRefreshToken:  crypto.encrypt('refresh-token'),
    encryptedIdToken:       crypto.encrypt('id-token-raw'),
    expiresAt:              Date.now() + 60_000,
  })

  const res = await request(app.getHttpServer())
    .post('/api/auth/logout')
    .set('Cookie', `session_id=${sessionId}; XSRF-TOKEN=csrf-val`)
    .set('X-CSRF-Token', 'csrf-val')

  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('logoutUrl')
  expect(res.body.logoutUrl).toContain('id_token_hint')
  expect(res.body.logoutUrl).toContain('post_logout_redirect_uri')

  const setCookie: string[] = res.headers['set-cookie'] ?? []
  expect(setCookie.some(c => c.match(/session_id=.*Max-Age=0/i))).toBe(true)
  expect(setCookie.some(c => c.match(/XSRF-TOKEN=.*Max-Age=0/i))).toBe(true)
})
```

### 7.2 — `backend/test/integration/session-store.int-spec.ts`

Skipped unless `RUN_INTEGRATION_TESTS=true` and `DATABASE_URL` is set. Uses a real `pg.Pool`.

```typescript
// Skip entire file if integration tests not enabled
const RUN = process.env['RUN_INTEGRATION_TESTS'] === 'true'
const describeIf = RUN ? describe : describe.skip

describeIf('PgSessionStore + MigrationRunner (integration)', () => {
  let pool: Pool
  let store: PgSessionStore
  let migrator: MigrationRunnerService

  beforeAll(async () => {
    pool     = new Pool({ connectionString: process.env['DATABASE_URL'] })
    store    = new PgSessionStore(pool)
    migrator = new MigrationRunnerService(pool)
    await migrator.onApplicationBootstrap()
  })

  afterAll(async () => { await pool.end() })

  it('migration runner creates sessions and pending_auth tables', async () => {
    const res = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('sessions', 'pending_auth', '_migrations')`
    )
    const names = res.rows.map((r: { table_name: string }) => r.table_name)
    expect(names).toContain('sessions')
    expect(names).toContain('pending_auth')
    expect(names).toContain('_migrations')
  })

  it('running migration runner twice does not fail or insert duplicate _migrations rows', async () => {
    await expect(migrator.onApplicationBootstrap()).resolves.not.toThrow()
    const res = await pool.query('SELECT COUNT(*) FROM _migrations')
    const firstCount = parseInt(res.rows[0].count, 10)
    await migrator.onApplicationBootstrap()
    const res2 = await pool.query('SELECT COUNT(*) FROM _migrations')
    expect(parseInt(res2.rows[0].count, 10)).toBe(firstCount)  // no duplicates
  })

  describe('PgSessionStore', () => {
    const rawId = 'integration-test-session-id'

    afterEach(async () => { await store.delete(rawId) })

    it('set then get returns the stored SessionRecord', async () => {
      const record: SessionRecord = {
        user:                   { sub: 'int-user-1', email: 'i@test.com' },
        acr:                    '2',
        csrfToken:              'csrf-int',
        encryptedRefreshToken:  'n:c:t',
        encryptedIdToken:       'n:c:t',
        expiresAt:              Date.now() + 60_000,
      }
      await store.set(rawId, record)
      const result = await store.get(rawId)
      expect(result?.user.sub).toBe('int-user-1')
      expect(result?.csrfToken).toBe('csrf-int')
    })

    it('get on an expired session returns undefined', async () => {
      const record: SessionRecord = {
        user: { sub: 'exp-user' }, acr: '2',
        csrfToken: 'c', encryptedRefreshToken: 'n:c:t', encryptedIdToken: 'n:c:t',
        expiresAt: Date.now() - 1000,  // already expired
      }
      await store.set(rawId, record)
      expect(await store.get(rawId)).toBeUndefined()
    })

    it('delete then get returns undefined', async () => {
      const record: SessionRecord = {
        user: { sub: 'del-user' }, acr: '2',
        csrfToken: 'c', encryptedRefreshToken: 'n:c:t', encryptedIdToken: 'n:c:t',
        expiresAt: Date.now() + 60_000,
      }
      await store.set(rawId, record)
      await store.delete(rawId)
      expect(await store.get(rawId)).toBeUndefined()
    })
  })

  describe('Atomic pending-auth consumption', () => {
    it('two concurrent DELETE calls: exactly one succeeds, the other returns no row', async () => {
      const id    = 'atomic-test-id'
      const state = 'atomic-state'
      await pool.query(
        `INSERT INTO pending_auth (id, state, nonce, code_verifier, flow, expires_at)
         VALUES ($1, $2, 'n', 'cv', 'login', NOW() + INTERVAL '10 minutes')`,
        [id, state],
      )

      // Fire two concurrent DELETEs
      const [r1, r2] = await Promise.all([
        pool.query(
          `DELETE FROM pending_auth WHERE id = $1 AND state = $2 AND expires_at > NOW() RETURNING id`,
          [id, state],
        ),
        pool.query(
          `DELETE FROM pending_auth WHERE id = $1 AND state = $2 AND expires_at > NOW() RETURNING id`,
          [id, state],
        ),
      ])

      const successCount = [r1, r2].filter(r => r.rowCount === 1).length
      const emptyCount   = [r1, r2].filter(r => r.rowCount === 0).length
      expect(successCount).toBe(1)
      expect(emptyCount).toBe(1)
    })
  })
})
```

### 7.3 — `backend/test/integration/oidc-import.int-spec.ts`

Verifies the real `openid-client` package loads without ESM errors in the NestJS runtime.

```typescript
const RUN = process.env['RUN_INTEGRATION_TESTS'] === 'true'
const describeIf = RUN ? describe : describe.skip

describeIf('openid-client ESM import (integration)', () => {
  it('dynamic import succeeds and exports discovery as a function', async () => {
    const mod = await import('openid-client')
    expect(typeof mod.discovery).toBe('function')
    expect(typeof mod.authorizationCodeGrant).toBe('function')
    expect(typeof mod.tokenRevocation).toBe('function')
  })
})
```

### 7.4 — `backend/test/integration/keycloak-readiness.int-spec.ts`

Verifies the management port healthcheck works with the pinned image. Requires running
Keycloak container (`docker compose up -d`).

```typescript
const RUN = process.env['RUN_INTEGRATION_TESTS'] === 'true'
const describeIf = RUN ? describe : describe.skip

describeIf('Keycloak management port healthcheck (integration)', () => {
  it('GET http://localhost:9000/health/ready returns 200 with status UP', async () => {
    const res  = await fetch('http://localhost:9000/health/ready')
    const body = await res.json() as { status: string }
    expect(res.status).toBe(200)
    expect(body.status).toBe('UP')
  })
})
```

**Note:** Port 9000 is NOT mapped to the host in `docker-compose.yml` (management-only). To
run this test you must either:
1. Temporarily add `"9000:9000"` to the Keycloak service ports in `docker-compose.yml`, OR
2. Run the test via `docker exec keycloak bash -c "..."` instead

Document the chosen approach in `docs/local-auth-setup.md`. The test file uses `fetch` against
`localhost:9000` which requires option 1. If the port should stay unexposed, replace the test
with a `docker exec` shell assertion instead of a Jest test.

### 7.5 — `backend/test/integration/auth-flow.int-spec.ts`

Manual-only live test file. Not run by any automated suite.

```typescript
// LIVE TESTS — manual execution only.
// Requires: Docker Compose stack healthy, real Google account, TOTP device.
// NOT part of pnpm test or pnpm test:integration.
// Run individual scenarios by hand following docs/local-auth-setup.md.

describe.skip('Live auth flow (manual only)', () => {
  it('1. First registration: Registrati -> Google -> TOTP enrollment -> /?view=menu', () => {
    // See docs/local-auth-setup.md checklist item 5–8
  })
  it('2. Returning login: Accedi -> Google (may skip password) -> TOTP entry -> same identity', () => {})
  it('3. Required MFA: claims param enforces ACR 2; verify in Keycloak admin console', () => {})
  it('4. Cancel flow: error=access_denied -> 400; no session created', () => {})
  it('5. Expired local session: SESSION_TTL_SECONDS=10; wait 11s; GET /me -> 401', () => {})
  it('6. Logout: session deleted; Keycloak SSO terminated; Welcome shown; re-login requires TOTP', () => {})
  it('7. Browser restart: session cookie gone; Welcome screen on next visit', () => {})
})
```

### Verification for Phase 7

```bash
# Unit + e2e (no Docker)
cd backend && pnpm test && pnpm test:e2e

# Integration (requires Docker Compose healthy + DATABASE_URL set)
RUN_INTEGRATION_TESTS=true pnpm test:integration
```

Expected:
- All unit tests pass (no change from Phase 6)
- E2e: existing health + 401 tests pass; new auth endpoint tests pass
- Integration: migration, session store, atomicity, ESM import tests pass
- `auth-flow.int-spec.ts` is entirely skipped (`describe.skip`)

---

## Phase 8 — Docs & Keycloak Realm

**Goal:** `backend/keycloak/agenda-realm.json` is a valid Keycloak 26.x realm export that
imports cleanly on first start; `docs/local-auth-setup.md` is a complete developer runbook;
`backend/.env.local.example` is the canonical reference for all required environment variables.

### 8.1 — `backend/keycloak/agenda-realm.json`

The realm JSON is committed without secrets. Variable substitution (`${VAR}`) is resolved by
Keycloak at import time from the container environment.

**Generating vs hand-authoring:** the safest approach is to:
1. Start Keycloak without `--import-realm` using a minimal config
2. Configure the realm manually in the admin console (see 8.1a checklist)
3. Export the realm via admin console → Realm settings → Export → include clients and groups
4. Commit the exported JSON, replacing secret values with `${VAR}` placeholders

This avoids hand-authoring a 500+ line JSON and ensures 26.8.1 compatibility. Document this
procedure in `docs/local-auth-setup.md`.

**8.1a — Realm configuration checklist (manual, in admin console):**

```
Realm name:           agenda
Display name:         Agenda

── Sessions ──────────────────────────────────────────────────────
SSO Session Idle:            30 minutes
SSO Session Max:             8 hours
Client Session Idle:         30 minutes
Client Session Max:          8 hours
Access Token Lifespan:       5 minutes

── Authentication ────────────────────────────────────────────────
Required actions (global):   Configure OTP (enabled, not default)

── Identity Providers ────────────────────────────────────────────
Add: Google
  Client ID:        ${GOOGLE_CLIENT_ID}
  Client Secret:    ${GOOGLE_CLIENT_SECRET}
  First Login Flow: first broker login
  Sync Mode:        LEGACY   ← NOT force

── Post-Broker Login Flow ────────────────────────────────────────
Authentication > Flows > "post broker login" (copy built-in)
Add step: OTP Form  (REQUIRED)
Assign to Google IDP as "Post Login Flow"

── Clients ───────────────────────────────────────────────────────
Client ID:            agenda-bff
Client Protocol:      openid-connect
Access Type:          confidential
Standard Flow:        ON
Implicit Flow:        OFF
Direct Access Grants: OFF
PKCE Method:          S256   (Advanced Settings)
Client Secret:        ${KEYCLOAK_BFF_CLIENT_SECRET}
Valid Redirect URIs:  ${KEYCLOAK_REDIRECT_URI}
Valid Post-Logout URIs: ${FRONTEND_URL}
Web Origins:          ${FRONTEND_URL}

── LoA / ACR Mapping ─────────────────────────────────────────────
Realm Settings > Security Defenses > (or Authentication > Policies)
LoA Level 2:  ACR value "2",  Max Age 1800s

── Realm JSON substitution variables ─────────────────────────────
After export, replace literal secrets with:
  <google_client_id>      → ${GOOGLE_CLIENT_ID}
  <google_client_secret>  → ${GOOGLE_CLIENT_SECRET}
  <bff_client_secret>     → ${KEYCLOAK_BFF_CLIENT_SECRET}
  <redirect_uri>          → ${KEYCLOAK_REDIRECT_URI}
  <frontend_url>          → ${FRONTEND_URL}
```

**8.1b — Key realm JSON fields to verify (26.8.1 specifics):**

```jsonc
{
  "realm": "agenda",
  "enabled": true,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 28800,
  "clientSessionIdleTimeout": 1800,
  "clientSessionMaxLifespan": 28800,
  "accessTokenLifespan": 300,

  // LoA map — field names MUST be verified against 26.8.1 documentation.
  // In Keycloak 26.x the structure may be under "attributes" as a flat string:
  // "attributes": { "acr.loa.map": "{\"2\":\"2\"}", "client.session.idle.timeout": "1800" }
  // OR under a dedicated "loa" block — confirm during implementation.

  "clients": [{
    "clientId": "agenda-bff",
    "secret": "${KEYCLOAK_BFF_CLIENT_SECRET}",
    "redirectUris": ["${KEYCLOAK_REDIRECT_URI}"],
    "webOrigins": ["${FRONTEND_URL}"],
    "attributes": {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "${FRONTEND_URL}"
    }
  }],

  "identityProviders": [{
    "alias": "google",
    "providerId": "google",
    "enabled": true,
    "firstBrokerLoginFlowAlias": "first broker login",
    "postBrokerLoginFlowAlias": "post broker login with otp",
    "config": {
      "clientId": "${GOOGLE_CLIENT_ID}",
      "clientSecret": "${GOOGLE_CLIENT_SECRET}",
      "syncMode": "LEGACY"
    }
  }]
}
```

**Registration endpoint — verify during implementation:**

Keycloak 26.x may expose `/realms/agenda/protocol/openid-connect/registrations` as a distinct
endpoint that renders a registration-themed page. Test with the pinned image:

```bash
curl -v "http://localhost:8080/realms/agenda/protocol/openid-connect/registrations?client_id=agenda-bff&response_type=code&redirect_uri=http://localhost:3000/api/auth/callback"
```

If it returns a valid redirect (302 to Google with Keycloak's registration UI), use it in
`OidcClientService.buildAuthorizationUrl` for `flow === 'register'`. If it returns 404 or
behaves identically to the standard auth endpoint, document this in `docs/local-auth-setup.md`
and remove the `kc_idp_hint` workaround from Phase 3.

### 8.2 — `docs/local-auth-setup.md`

New file. Complete developer runbook. Sections:

```markdown
# Local Auth Setup (B-1)

## Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js 24+, pnpm
- A Google Cloud project with OAuth 2.0 credentials
  (Authorized redirect URI: http://localhost:3000/api/auth/callback)
- An authenticator app (Google Authenticator, Authy, 1Password TOTP, etc.)

## 1. Create environment files

### backend/.env.local
Copy backend/.env.local.example to backend/.env.local and fill in:

  POSTGRES_SUPERUSER_PASSWORD   — any strong password
  KEYCLOAK_DB_PASSWORD          — any strong password
  AGENDA_DB_PASSWORD            — any strong password
  GOOGLE_CLIENT_ID              — from Google Cloud console
  GOOGLE_CLIENT_SECRET          — from Google Cloud console
  KEYCLOAK_BFF_CLIENT_SECRET    — any random string (openssl rand -hex 16)
  SESSION_SECRET                — openssl rand -hex 32 (min 32 chars)
  TOKEN_ENCRYPTION_KEY          — openssl rand -hex 32 (produces 64 hex chars)

  ⚠ KEY ROTATION WARNING: changing TOKEN_ENCRYPTION_KEY invalidates all stored
    refresh and ID tokens. Active sessions will fail on next use. Users must
    re-authenticate. Document key rotation events in your ops runbook.

### prototypes/ui-shell/.env.local
Add to the existing file:
  NEXT_PUBLIC_AUTH_CONFIGURED=true
  NEXT_PUBLIC_AUTH_LOGIN_URL=/api/auth/login
  NEXT_PUBLIC_AUTH_REGISTER_URL=/api/auth/register
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

## 2. Start the Docker Compose stack

  cd backend
  docker compose up -d

Wait until both services are healthy:
  docker compose ps   # both show "healthy"

Expected time: ~60s on first run (Keycloak imports realm). Subsequent starts: ~15s.

## 3. First-time Keycloak setup

On first start with a new postgres_data volume, Keycloak imports agenda-realm.json.
If the realm already exists (volume persists), import is skipped — existing users,
TOTP, and sessions are preserved.

To reset completely: docker compose down -v  (DESTROYS ALL DATA)

## 4. Start the application services

Terminal 1 (NestJS):
  cd backend && pnpm dev

Confirm startup log lines:
  - "Migration applied: 001_create_sessions.sql"
  - "Migration applied: 002_create_pending_auth.sql"
  - "Migrations complete"
  - "OIDC discovery complete"
  - "Database connection verified"

Terminal 2 (Next.js):
  cd prototypes/ui-shell && pnpm dev

## 5. Registration walkthrough (first time)

1. Open http://localhost:3000  — Welcome screen, no redirect
2. Click "Prima volta qui? Registrati"
3. Browser navigates to /api/auth/register → NestJS → Keycloak registration page
4. Sign in with Google
5. Keycloak prompts TOTP enrollment — scan QR with authenticator app
6. Enter the 6-digit code to confirm enrollment
7. Browser redirects to http://localhost:3000/?view=menu
8. Radial menu renders — gradients, animations, section navigation intact

Verify session:
  GET http://localhost:3000/api/auth/me
  → { "sub": "...", "email": "...", "name": "...", "acr": "2" }

## 6. Login walkthrough (returning user)

1. Click "Accedi" on Welcome screen
2. Sign in with Google (may skip password if Google session active)
3. Enter TOTP code (not re-enrollment)
4. Redirect to /?view=menu — same identity confirmed

## 7. Logout

1. POST http://localhost:3000/api/auth/logout  (with CSRF header from apiFetch)
2. Response: { "logoutUrl": "http://localhost:8080/realms/agenda/..." }
3. Frontend navigates to logoutUrl
4. Keycloak terminates SSO session, redirects to http://localhost:3000
5. Welcome screen shown. Next Accedi requires Google + TOTP.

## 8. Known limitations (B-1)

- Revocation latency: up to 30 minutes after Keycloak revocation/account disable,
  the local application session remains valid. Silent refresh is B-2.
- Backchannel logout: not implemented. Admin revocation does not immediately end
  application sessions.
- No sliding window: sessions expire absolutely after SESSION_TTL_SECONDS (1800s).
  After expiry, GET /api/auth/me returns 401 and the user must re-authenticate.
- Google SSO: RP-initiated logout terminates the Keycloak session but not Google's.
  If the Google session is still active, the next login may skip the Google password
  prompt but will still require TOTP (new Keycloak SSO session = no ACR 2 yet).

## 9. Keycloak registration endpoint (26.8.1 specific)

Verify whether /realms/agenda/protocol/openid-connect/registrations is supported:

  curl -v "http://localhost:8080/realms/agenda/protocol/openid-connect/registrations\
    ?client_id=agenda-bff&response_type=code\
    &redirect_uri=http://localhost:3000/api/auth/callback"

If 302 → a distinct registration UI is available; update OidcClientService accordingly.
If 404 or identical to /auth → document here and use the standard auth endpoint for both
login and registration flows.

## 10. Healthcheck verification (pinned image)

The Keycloak healthcheck uses bash TCP redirect to port 9000 (management port):

  docker exec <keycloak_container_id> bash -c \
    "exec 3<>/dev/tcp/127.0.0.1/9000 && \
     printf 'GET /health/ready HTTP/1.0\r\nHost: localhost\r\n\r\n' >&3 && \
     grep -q 'UP' <&3 && echo OK"

If this fails (bash or /dev/tcp unavailable in the image), fall back to a custom
Dockerfile.keycloak that installs curl and use:
  test: ["CMD", "curl", "-f", "http://localhost:9000/health/ready"]

Document the working command here after verifying with the pinned image.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| NestJS exits on start | Missing required env var | Check Joi validation error in logs |
| "OIDC discovery failed" | Keycloak not healthy or wrong ISSUER_URL | docker compose ps; check KEYCLOAK_ISSUER_URL |
| 400 on callback | Expired or replayed auth_tx | Retry login from the beginning |
| 401 after long inactivity | Session expired (30 min TTL) | Re-authenticate |
| Section page redirects to login | session_id cookie absent or Path mismatch | Check Path=/ on session_id cookie |
| CSRF 403 on logout | X-CSRF-Token header not sent | Ensure apiFetch is used for POST calls |
| TOTP not prompted | post-broker-login flow misconfigured | Verify realm JSON OTP step |
```

### 8.3 — Final file map verification

Before closing out Phase 8, verify every file in the spec's file map exists:

**New files checklist:**
- [ ] `backend/docker-compose.yml`
- [ ] `backend/docker/init-db.sh`
- [ ] `backend/.env.local.example`
- [ ] `backend/keycloak/agenda-realm.json`
- [ ] `backend/migrations/001_create_sessions.sql`
- [ ] `backend/migrations/002_create_pending_auth.sql`
- [ ] `backend/src/database/pg.module.ts`
- [ ] `backend/src/auth/providers/pg-session.store.ts`
- [ ] `backend/src/auth/providers/pending-auth.store.ts`
- [ ] `backend/src/auth/token/token-crypto.ts`
- [ ] `backend/src/auth/oidc/oidc-client.service.ts`
- [ ] `backend/src/auth/oidc/oidc.module.ts`
- [ ] `backend/src/auth/guards/csrf.guard.ts`
- [ ] `backend/src/auth/migration-runner.service.ts`
- [ ] `backend/src/auth/types/request-with-session.ts`
- [ ] `backend/test/unit/pg-session.store.spec.ts`
- [ ] `backend/test/unit/token-crypto.spec.ts`
- [ ] `backend/test/unit/oidc-client.service.spec.ts`
- [ ] `backend/test/unit/csrf.guard.spec.ts`
- [ ] `backend/test/unit/migration-runner.spec.ts`
- [ ] `backend/test/integration/session-store.int-spec.ts`
- [ ] `backend/test/integration/oidc-import.int-spec.ts`
- [ ] `backend/test/integration/keycloak-readiness.int-spec.ts`
- [ ] `backend/test/integration/auth-flow.int-spec.ts`
- [ ] `backend/test/jest-integration.json`
- [ ] `prototypes/ui-shell/middleware.ts`
- [ ] `prototypes/ui-shell/lib/apiFetch.ts`
- [ ] `prototypes/ui-shell/hooks/useCurrentUser.ts`
- [ ] `prototypes/ui-shell/.env.local.example`
- [ ] `docs/local-auth-setup.md`

**Modified files checklist:**
- [ ] `backend/src/auth/auth.module.ts`
- [ ] `backend/src/auth/auth.controller.ts`
- [ ] `backend/src/auth/types/session-record.ts`
- [ ] `backend/src/app.module.ts`
- [ ] `backend/src/config/config.module.ts`
- [ ] `backend/src/config/auth.config.ts`
- [ ] `backend/src/auth/guards/session.guard.ts`
- [ ] `backend/src/main.ts` (CORS removal if needed)
- [ ] `backend/test/app.e2e-spec.ts`
- [ ] `backend/test/unit/session.guard.spec.ts`
- [ ] `backend/package.json`
- [ ] `prototypes/ui-shell/next.config.ts`
- [ ] `prototypes/ui-shell/components/AppShell.tsx`

### Verification for Phase 8 — Acceptance criteria gate

Run through spec Section 14 acceptance criteria:

```
AC1:  GET /                   → 200, Welcome screen, no redirect
AC2:  Registrati              → 302 to Keycloak, auth_tx cookie set (no raw secrets in browser)
AC3:  Google OAuth            → Keycloak IDP handles federated login
AC4:  TOTP enforcement        → post-broker-login flow requires OTP
AC5:  ACR 2 session           → session_id HttpOnly Strict Path=/; PostgreSQL row has acr='2'
AC6:  /?view=menu             → radial menu, no regressions
AC7:  /api/auth/me            → user identity; section pages redirect if no cookie; 401 if invalid
AC8:  Logout                  → session deleted, token revoked, RP-logout, Welcome screen
AC9:  Returning login         → same identity, TOTP required (new Keycloak session)
AC10: Browser restart         → session cookie gone, Welcome shown
AC11: No mock auth            → real Google credentials used
AC12: Vault intact            → encrypted local vault unchanged
AC13: Replay rejected         → second callback with same auth_tx → 400
AC14: Revocation latency      → documented; up to 1800s
```

---

## Phase 1 — Infrastructure & Config

**Goal:** Docker Compose stack (postgres + keycloak) runs and is healthy; PgModule provides a
`pg.Pool` to the NestJS DI container; config schema accepts all new env vars; app exits non-zero
if required vars are missing or connections fail on startup.

### 1.1 — `backend/docker-compose.yml`

Create from scratch. No existing file.

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD}
    volumes:
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10

  keycloak:
    image: quay.io/keycloak/keycloak:26.8.1
    command: ["start-dev", "--import-realm"]
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: keycloak_user
      KC_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD}
      KC_BOOTSTRAP_ADMIN_USERNAME: ${KEYCLOAK_ADMIN_USER}
      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      KEYCLOAK_BFF_CLIENT_SECRET: ${KEYCLOAK_BFF_CLIENT_SECRET}
      KEYCLOAK_REDIRECT_URI: ${KEYCLOAK_REDIRECT_URI}
      FRONTEND_URL: ${FRONTEND_URL}
    volumes:
      - ./keycloak/agenda-realm.json:/opt/keycloak/data/import/agenda-realm.json:ro
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /health/ready HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && grep -q 'UP' <&3"]
      interval: 10s
      timeout: 5s
      retries: 18
      start_period: 45s
    env_file:
      - .env.local

volumes:
  postgres_data:
```

Notes:
- Management port 9000 is NOT mapped to the host (healthcheck-only). Only 8080 is exposed.
- `env_file: .env.local` is on the keycloak service only; postgres reads individual `environment`
  keys. NestJS reads its own `backend/.env.local` via dotenv; it does not use Docker env_file.
- `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` replaces deprecated
  `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` in Keycloak 26.x. Verify during implementation;
  fall back to the old names if 26.8.1 still accepts them.

### 1.2 — `backend/docker/init-db.sql`

Runs once on first container start (via `docker-entrypoint-initdb.d`). Creates both databases
and their owners. Postgres superuser only touches this file.

```sql
-- Create users
CREATE USER keycloak_user WITH PASSWORD :'KEYCLOAK_DB_PASSWORD';
CREATE USER agenda_user   WITH PASSWORD :'AGENDA_DB_PASSWORD';

-- Create databases
CREATE DATABASE keycloak OWNER keycloak_user;
CREATE DATABASE agenda_app OWNER agenda_user;

-- Revoke public access
REVOKE ALL ON DATABASE keycloak   FROM PUBLIC;
REVOKE ALL ON DATABASE agenda_app FROM PUBLIC;
```

**Implementation note:** Docker Compose cannot pass shell env vars as psql bind parameters to
`initdb` scripts. The standard approach is to use plain string interpolation in the SQL or to
template the file at container startup via an entrypoint script. The simplest reliable approach
for B-1 is to use `POSTGRES_INITDB_ARGS` or to pass passwords via environment variables read by
a custom entrypoint.

**Recommended approach:** Use a shell-based init script (`init-db.sh`) instead of `init-db.sql`,
which sources the env vars naturally:

```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE USER keycloak_user WITH PASSWORD '$KEYCLOAK_DB_PASSWORD';
  CREATE USER agenda_user   WITH PASSWORD '$AGENDA_DB_PASSWORD';
  CREATE DATABASE keycloak  OWNER keycloak_user;
  CREATE DATABASE agenda_app OWNER agenda_user;
  REVOKE ALL ON DATABASE keycloak   FROM PUBLIC;
  REVOKE ALL ON DATABASE agenda_app FROM PUBLIC;
EOSQL
```

Mount as `./docker/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh`. Make executable
(`chmod +x`). The postgres entrypoint runs `.sh` files as bash and `.sql` files via psql;
shell scripts have access to container environment variables.

Set `KEYCLOAK_DB_PASSWORD` and `AGENDA_DB_PASSWORD` in `backend/.env.local` and pass them
to the postgres service via explicit `environment:` keys in `docker-compose.yml`:
```yaml
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD}
      KEYCLOAK_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD}
      AGENDA_DB_PASSWORD: ${AGENDA_DB_PASSWORD}
```

### 1.3 — `backend/.env.local.example`

New file (committed). Documents every required variable with safe placeholder values.
Never contains real secrets. Real values go in `backend/.env.local` (gitignored).

```
# PostgreSQL
POSTGRES_SUPERUSER_PASSWORD=changeme_postgres
KEYCLOAK_DB_PASSWORD=changeme_keycloak_db
AGENDA_DB_PASSWORD=changeme_agenda_db
DATABASE_URL=postgresql://agenda_user:changeme_agenda_db@localhost:5432/agenda_app

# Keycloak admin (Docker Compose only)
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=changeme_admin

# Keycloak OIDC (NestJS)
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/agenda
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/agenda/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=agenda-bff
KEYCLOAK_AUDIENCE=agenda-bff
KEYCLOAK_REQUIRED_ACR=2
KEYCLOAK_BFF_CLIENT_SECRET=changeme_bff_secret

# Google OAuth (Keycloak IDP config)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Keycloak realm import
KEYCLOAK_REDIRECT_URI=http://localhost:3000/api/auth/callback
FRONTEND_URL=http://localhost:3000

# Session (NestJS)
SESSION_SECRET=changeme_session_secret_min_32_chars_long
SESSION_TTL_SECONDS=1800
FRONTEND_APP_URL=http://localhost:3000/?view=menu

# Token encryption (NestJS) — generate with: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=changeme_64_hex_chars_aes256_key_generate_with_openssl

# Server
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

**KEY ROTATION WARNING** (include in the example file as a comment):
Changing `TOKEN_ENCRYPTION_KEY` invalidates all stored refresh and ID tokens. Active sessions
will fail on next use. Users must re-authenticate.

### 1.4 — `backend/src/config/config.module.ts` — Joi schema additions

Add to the existing `validationSchema` in `AppConfigModule`:

```typescript
// Database
DATABASE_URL:           Joi.string().uri().required(),

// Token encryption
TOKEN_ENCRYPTION_KEY:   Joi.string().length(64).required(),  // 64 hex chars = 32 bytes

// OIDC (BFF client secret — existing KEYCLOAK_* vars stay)
KEYCLOAK_BFF_CLIENT_SECRET: Joi.string().required(),

// Frontend redirect
FRONTEND_APP_URL:       Joi.string().uri().default('http://localhost:3000/?view=menu'),
```

Change `SESSION_TTL_SECONDS` default from `3600` to `1800` (aligns with Keycloak Client Session
Idle).

Remove `ALLOWED_ORIGINS` from required schema (CORS is disabled in B-1; keep with default for
forward compatibility but do not enforce).

### 1.5 — `backend/src/database/pg.module.ts`

New file. Provides `pg.Pool` as a global injectable token `PG_POOL`.

```typescript
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'

export const PG_POOL = 'PG_POOL'

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Pool({ connectionString: config.getOrThrow('DATABASE_URL') })
      },
    },
  ],
  exports: [PG_POOL],
})
export class PgModule {}
```

`@Global()` means any module that imports `PgModule` exposes `PG_POOL` to all other modules
without re-importing. Import `PgModule` in `AppModule`.

### 1.6 — `backend/src/app.module.ts` — add PgModule

```typescript
import { PgModule } from './database/pg.module'

@Module({
  imports: [
    AppConfigModule,
    PgModule,          // <-- add
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
```

### 1.7 — Startup validation in `main.ts`

The spec requires NestJS to exit non-zero if `DATABASE_URL`, `SESSION_SECRET`, or
`TOKEN_ENCRYPTION_KEY` are missing or if the DB connection fails on first query. Joi validation
in `AppConfigModule` handles the "missing" case (aborts before bootstrap). The DB connection
test belongs in a bootstrap hook.

Add `AppBootstrapService` (`backend/src/app-bootstrap.service.ts`) that implements
`OnApplicationBootstrap`:

```typescript
import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from './database/pg.module'

@Injectable()
export class AppBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppBootstrapService.name)

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.pool.query('SELECT 1')  // throws on connection failure -> NestJS exits non-zero
    this.logger.log('Database connection verified')
  }
}
```

Add `AppBootstrapService` to the `providers` array of `AppModule`.

**Note:** OIDC discovery failure (`OidcClientService.onModuleInit`) also causes non-zero exit by
the same mechanism — NestJS propagates errors thrown from lifecycle hooks. No additional wiring
needed for that case.

### 1.8 — `backend/package.json` — add dependencies

Add to `dependencies`:
- `pg` — PostgreSQL client
- `openid-client` — OIDC/OAuth2 client (v6, ESM)

Add to `devDependencies`:
- `@types/pg`

Install with `pnpm add pg openid-client` and `pnpm add -D @types/pg` from `backend/`.

### Verification for Phase 1

After implementing:
1. `docker compose -f backend/docker-compose.yml up -d` — both services reach `healthy`
2. `psql postgresql://agenda_user:<pwd>@localhost:5432/agenda_app -c "SELECT 1"` — succeeds
3. `pnpm build:api` — compiles without errors
4. Start NestJS without `DATABASE_URL` — Joi validation error, non-zero exit
5. Start NestJS with bad `DATABASE_URL` — `AppBootstrapService` throws, non-zero exit
