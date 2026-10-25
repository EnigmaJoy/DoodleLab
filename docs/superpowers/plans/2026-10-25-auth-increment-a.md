# Authentication Increment A - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a minimal NestJS backend with deny-by-default session guard enforcement,
a Keycloak JWT validation utility, a public health endpoint, and an updated Welcome UI, all
without requiring a configured identity provider.

**Architecture:** NestJS lives at `backend/` as a new pnpm workspace member alongside
`prototypes/ui-shell/`. A `SessionGuard` registered as `APP_GUARD` rejects every request
except those decorated `@Public()`. A separate `KeycloakTokenVerifier` validates raw Keycloak
JWTs (signature, issuer, audience, expiry) and is tested in isolation via a local JWKS fixture.
No real sessions are created in Increment A; the in-memory session store is always empty.

**Tech Stack:** NestJS 10, TypeScript 5 strict mode, jose v4 (JWT/JWKS), Joi (config
validation), cookie-parser, Jest + ts-jest, Supertest; Next.js 15 (Welcome UI).

---

## File map

### Created

```
backend/
  package.json
  tsconfig.json
  nest-cli.json
  .env.example
  src/
    main.ts
    app.module.ts
    config/
      config.module.ts
      auth.config.ts
    health/
      health.module.ts
      health.controller.ts
    auth/
      auth.module.ts
      guards/
        session.guard.ts
      decorators/
        public.decorator.ts
        skip-mfa.decorator.ts
        current-user.decorator.ts
      token/
        keycloak-token.verifier.ts
      types/
        authenticated-user.ts
        session-record.ts
        session-store.interface.ts
      providers/
        in-memory-session.store.ts
  test/
    jest-e2e.json
    app.e2e-spec.ts
    fixtures/
      test-keys.fixture.ts
      token.factory.ts
    unit/
      keycloak-token.verifier.spec.ts
      session.guard.spec.ts
```

### Modified

```
package.json                               -- add "backend" workspace member
prototypes/ui-shell/
  components/
    WelcomeScreen.tsx                      -- onStart -> onLogin + onRegister; unavailable state
    AppShell.tsx                           -- onStart -> onLogin + onRegister props
  app/
    globals.css                            -- .welcome-actions, .register-button, .auth-unavailable
```

---

## Task 1: Scaffold NestJS workspace

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env.example`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Add backend to the root pnpm workspace**

Open `package.json` at the repository root. Its current content is:

```json
{
  "name": "doodlelab",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter ui-shell dev",
    "build": "pnpm --filter ui-shell build",
    "start": "pnpm --filter ui-shell start"
  }
}
```

Replace it with:

```json
{
  "name": "doodlelab",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter ui-shell dev",
    "dev:api": "pnpm --filter agenda-api dev",
    "build": "pnpm --filter ui-shell build && pnpm --filter agenda-api build",
    "start": "pnpm --filter ui-shell start",
    "start:api": "pnpm --filter agenda-api start"
  },
  "pnpm": {
    "workspaces": [
      "prototypes/ui-shell",
      "backend"
    ]
  }
}
```

- [ ] **Step 2: Create `backend/package.json`**

```json
{
  "name": "agenda-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "cookie-parser": "^1.4.6",
    "jose": "^4.15.7",
    "joi": "^17.13.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.5.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": ".",
    "testMatch": ["**/test/unit/**/*.spec.ts"],
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 3: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 4: Create `backend/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  app.use(cookieParser())
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))

  const port = process.env['PORT'] ?? 3001
  await app.listen(port)
}

void bootstrap()
```

- [ ] **Step 6: Create `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { AppConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'

@Module({
  imports: [
    AppConfigModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Create `backend/.env.example`**

```
# Keycloak - configure when realm is provisioned (D-16 pending)
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/agenda
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/agenda/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=agenda-bff
KEYCLOAK_CLIENT_SECRET=replace-with-keycloak-client-secret
KEYCLOAK_AUDIENCE=agenda-bff
KEYCLOAK_REQUIRED_ACR=2
KEYCLOAK_CALLBACK_URL=http://localhost:3001/api/auth/callback
KEYCLOAK_POST_LOGOUT_REDIRECT_URI=http://localhost:3000

# Session
SESSION_SECRET=replace-before-any-deployment
SESSION_TTL_SECONDS=3600

# CSRF and origins
ALLOWED_ORIGINS=http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

- [ ] **Step 8: Install dependencies**

Run from `backend/`:

```bash
cd backend && pnpm install
```

Expected: dependencies installed without errors.

- [ ] **Step 9: Verify TypeScript compiles (empty modules are fine)**

```bash
cd backend && pnpm typecheck
```

Expected: exits 0 (or errors only about missing module imports that will be resolved in subsequent tasks).

---

## Task 2: ConfigModule with Joi validation

**Files:**
- Create: `backend/src/config/config.module.ts`
- Create: `backend/src/config/auth.config.ts`

- [ ] **Step 1: Create `backend/src/config/auth.config.ts`**

```typescript
// Typed accessor for auth configuration values.
// Consumed by AuthModule providers via ConfigService.

export interface AuthConfig {
  keycloakIssuerUrl: string
  keycloakJwksUri: string
  keycloakClientId: string
  keycloakAudience: string
  keycloakRequiredAcr: string
  sessionSecret: string
  sessionTtlSeconds: number
  allowedOrigins: string[]
}

export const authConfig = (): { auth: AuthConfig } => ({
  auth: {
    keycloakIssuerUrl:    process.env['KEYCLOAK_ISSUER_URL'] ?? '',
    keycloakJwksUri:     process.env['KEYCLOAK_JWKS_URI'] ?? '',
    keycloakClientId:    process.env['KEYCLOAK_CLIENT_ID'] ?? '',
    keycloakAudience:    process.env['KEYCLOAK_AUDIENCE'] ?? '',
    keycloakRequiredAcr: process.env['KEYCLOAK_REQUIRED_ACR'] ?? '',
    sessionSecret:       process.env['SESSION_SECRET'] ?? '',
    sessionTtlSeconds:   parseInt(process.env['SESSION_TTL_SECONDS'] ?? '3600', 10),
    allowedOrigins:      (process.env['ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean),
  },
})
```

- [ ] **Step 2: Create `backend/src/config/config.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import * as Joi from 'joi'
import { authConfig } from './auth.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
      validationSchema: Joi.object({
        // Keycloak - allowed to be empty in Increment A (no provider configured)
        KEYCLOAK_ISSUER_URL:    Joi.string().uri().default('http://localhost:8080/realms/agenda'),
        KEYCLOAK_JWKS_URI:      Joi.string().uri().default('http://localhost:8080/realms/agenda/protocol/openid-connect/certs'),
        KEYCLOAK_CLIENT_ID:     Joi.string().default('agenda-bff'),
        KEYCLOAK_AUDIENCE:      Joi.string().default('agenda-bff'),
        KEYCLOAK_REQUIRED_ACR:  Joi.string().default('2'),
        // Session - required; app will not start without these
        SESSION_SECRET:         Joi.string().min(32).required(),
        SESSION_TTL_SECONDS:    Joi.number().integer().min(60).default(3600),
        // Origins
        ALLOWED_ORIGINS:        Joi.string().default('http://localhost:3000'),
        // Server
        PORT:                   Joi.number().integer().default(3001),
        NODE_ENV:               Joi.string().valid('development', 'production', 'test').default('development'),
      }),
      validationOptions: { abortEarly: false },
    }),
  ],
})
export class AppConfigModule {}
```

- [ ] **Step 3: Create a minimal `.env` for local dev (gitignored)**

Create `backend/.env` (this file must not be committed):

```
SESSION_SECRET=local-development-secret-min-32-characters-long
NODE_ENV=development
```

This satisfies the `SESSION_SECRET` Joi requirement so the app starts locally.

Add `backend/.env` to `backend/.gitignore` (create the file):

```
# Environment
.env
.env.local
.env.*.local

# Build output
dist/
coverage/

# Dependencies
node_modules/
```

- [ ] **Step 4: Verify the app starts without crashing**

```bash
cd backend && pnpm dev
```

Expected: NestJS starts (it will fail to bind routes until modules are wired, but should not crash with a Joi validation error). Stop with Ctrl+C.

---

## Task 3: Auth types

**Files:**
- Create: `backend/src/auth/types/authenticated-user.ts`
- Create: `backend/src/auth/types/session-record.ts`
- Create: `backend/src/auth/types/session-store.interface.ts`

- [ ] **Step 1: Create `backend/src/auth/types/authenticated-user.ts`**

```typescript
// Shape of the verified caller extracted from a valid Keycloak access token.
// Attached to request.user by SessionGuard after successful session lookup.

export interface AuthenticatedUser {
  /** Stable Keycloak subject identifier. Never a client-supplied value. */
  readonly sub: string
  /** Verified email from the Keycloak token. May be absent for some scopes. */
  readonly email?: string
  /** Display name from the Keycloak token. May be absent. */
  readonly name?: string
  /**
   * Authentication Context Reference from the Keycloak token.
   * Must equal KEYCLOAK_REQUIRED_ACR for full access.
   * Stored in the session record at session creation time; not user-controllable.
   */
  readonly acr?: string
}
```

- [ ] **Step 2: Create `backend/src/auth/types/session-record.ts`**

```typescript
import type { AuthenticatedUser } from './authenticated-user'

// Server-side session record. Stored in the session store keyed by session ID.
// The session ID (key) is an opaque random value; never stored in the record itself.

export interface SessionRecord {
  /** Verified user identity at session creation time. */
  readonly user: AuthenticatedUser
  /**
   * ACR value from the Keycloak token at session creation time.
   * Copied here so SessionGuard does not re-parse the token on every request.
   */
  readonly acr: string
  /**
   * Unix timestamp (ms) after which this session is considered expired.
   * SessionGuard rejects sessions where expiresAt < Date.now().
   */
  readonly expiresAt: number
}
```

- [ ] **Step 3: Create `backend/src/auth/types/session-store.interface.ts`**

```typescript
import type { SessionRecord } from './session-record'

// Abstraction over the session storage backend.
// Increment A uses InMemorySessionStore (always empty; all lookups return undefined).
// Increment B replaces this with a PostgreSQL-backed implementation via the SESSION_STORE token.

export const SESSION_STORE = 'SESSION_STORE'

export interface SessionStore {
  get(sessionId: string): Promise<SessionRecord | undefined>
  set(sessionId: string, record: SessionRecord): Promise<void>
  delete(sessionId: string): Promise<void>
}
```

---

## Task 4: Auth decorators

**Files:**
- Create: `backend/src/auth/decorators/public.decorator.ts`
- Create: `backend/src/auth/decorators/skip-mfa.decorator.ts`
- Create: `backend/src/auth/decorators/current-user.decorator.ts`

- [ ] **Step 1: Create `backend/src/auth/decorators/public.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common'

// Mark a route or controller as public.
// SessionGuard skips ALL checks (session, identity, MFA) for @Public() endpoints.
// Never apply @Public() to an endpoint that accesses private data.

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true)
```

- [ ] **Step 2: Create `backend/src/auth/decorators/skip-mfa.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common'

// Skip the MFA assurance check for a specific route.
// Session validity and identity verification remain enforced.
// Reserved for the MFA enrollment endpoint and explicitly approved pre-MFA routes.
// Every use requires documented justification in the PR.

export const SKIP_MFA_KEY = 'skipMfa'
export const SkipMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_MFA_KEY, true)
```

- [ ] **Step 3: Create `backend/src/auth/decorators/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../types/authenticated-user'

// Extract the verified AuthenticatedUser from the request.
// Only valid in controllers protected by SessionGuard (i.e., not @Public() routes).
// Returns undefined if called on a @Public() route.

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    return request.user
  },
)
```

---

## Task 5: Test key fixtures

**Files:**
- Create: `backend/test/fixtures/test-keys.fixture.ts`
- Create: `backend/test/fixtures/token.factory.ts`

These fixtures are committed to the repository. The keys are for testing only and have no
relation to any production key material.

- [ ] **Step 1: Create `backend/test/fixtures/test-keys.fixture.ts`**

```typescript
// Test-only RSA key pair and JWKS fixture.
// Keys are generated fresh per test run using jose. No fixed private key is committed.
// Import buildTestKeys() in a beforeAll block and pass the result to TokenFactory.

import { generateKeyPair, exportJWK } from 'jose'
import type { KeyLike } from 'jose'

export interface TestKeys {
  privateKey: KeyLike
  jwks: { keys: object[] }
  kid: string
}

// Call once in beforeAll. The returned privateKey signs tokens;
// the jwks object serves as the local JWKS fixture for createLocalJWKSet.
export async function buildTestKeys(): Promise<TestKeys> {
  const kid = 'test-rsa-key-1'
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const publicJwk = await exportJWK(publicKey)
  return {
    privateKey,
    jwks: {
      keys: [{ ...publicJwk, kid, use: 'sig', alg: 'RS256' }],
    },
    kid,
  }
}
```

- [ ] **Step 2: Create `backend/test/fixtures/token.factory.ts`**

```typescript
// Builds signed test JWTs using the test private key from buildTestKeys().
// Each named parameter defaults to a valid value; override only what the test needs.

import { SignJWT } from 'jose'
import type { KeyLike } from 'jose'

export interface TokenOptions {
  privateKey: KeyLike
  kid?: string
  iss?: string
  aud?: string | string[]
  sub?: string
  exp?: number   // seconds from now; negative = already expired
  acr?: string
  omitAcr?: boolean
}

const DEFAULT_ISS = 'http://localhost:8080/realms/agenda'
const DEFAULT_AUD = 'agenda-bff'
const DEFAULT_SUB = 'user-test-123'

export async function buildToken(opts: TokenOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const payload: Record<string, unknown> = {}
  if (!opts.omitAcr) {
    payload['acr'] = opts.acr ?? '2'
  }

  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'test-rsa-key-1' })
    .setIssuer(opts.iss ?? DEFAULT_ISS)
    .setAudience(opts.aud ?? DEFAULT_AUD)
    .setSubject(opts.sub ?? DEFAULT_SUB)
    .setIssuedAt(now)

  const expSeconds = opts.exp ?? 3600
  builder = builder.setExpirationTime(now + expSeconds)

  return builder.sign(opts.privateKey)
}
```

---

## Task 6: Keycloak token verifier (TDD)

**Files:**
- Create: `backend/test/unit/keycloak-token.verifier.spec.ts`
- Create: `backend/src/auth/token/keycloak-token.verifier.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/keycloak-token.verifier.spec.ts`:

```typescript
import { createLocalJWKSet } from 'jose'
import { buildTestKeys, TestKeys } from '../fixtures/test-keys.fixture'
import { buildToken } from '../fixtures/token.factory'
import { KeycloakTokenVerifier } from '../../src/auth/token/keycloak-token.verifier'
import type { AuthenticatedUser } from '../../src/auth/types/authenticated-user'

const ISSUER   = 'http://localhost:8080/realms/agenda'
const AUDIENCE = 'agenda-bff'

describe('KeycloakTokenVerifier', () => {
  let keys: TestKeys
  let verifier: KeycloakTokenVerifier

  beforeAll(async () => {
    keys = await buildTestKeys()
    const localJwks = createLocalJWKSet(keys.jwks as Parameters<typeof createLocalJWKSet>[0])
    verifier = new KeycloakTokenVerifier({ issuer: ISSUER, audience: AUDIENCE }, localJwks)
  })

  describe('valid token', () => {
    it('returns AuthenticatedUser for a valid token', async () => {
      const token = await buildToken({ privateKey: keys.privateKey, kid: keys.kid })
      const user: AuthenticatedUser = await verifier.verify(token)
      expect(user.sub).toBe('user-test-123')
      expect(user.acr).toBe('2')
    })

    it('returns AuthenticatedUser even when acr is absent (verifier does not check acr)', async () => {
      const token = await buildToken({ privateKey: keys.privateKey, kid: keys.kid, omitAcr: true })
      const user = await verifier.verify(token)
      expect(user.acr).toBeUndefined()
    })
  })

  describe('invalid signature', () => {
    it('rejects a token signed with a different key', async () => {
      const otherKeys = await buildTestKeys()
      const token = await buildToken({ privateKey: otherKeys.privateKey, kid: keys.kid })
      await expect(verifier.verify(token)).rejects.toThrow()
    })

    it('rejects a token with a tampered payload', async () => {
      const token = await buildToken({ privateKey: keys.privateKey, kid: keys.kid })
      // Flip a byte in the payload segment
      const parts = token.split('.')
      const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8')
      const tampered = JSON.parse(payload) as Record<string, unknown>
      tampered['sub'] = 'attacker'
      parts[1] = Buffer.from(JSON.stringify(tampered)).toString('base64url')
      await expect(verifier.verify(parts.join('.'))).rejects.toThrow()
    })
  })

  describe('invalid claims', () => {
    it('rejects a token with the wrong issuer', async () => {
      const token = await buildToken({
        privateKey: keys.privateKey, kid: keys.kid,
        iss: 'http://evil.example.com/realms/fake',
      })
      await expect(verifier.verify(token)).rejects.toThrow()
    })

    it('rejects a token with the wrong audience', async () => {
      const token = await buildToken({
        privateKey: keys.privateKey, kid: keys.kid,
        aud: 'wrong-client',
      })
      await expect(verifier.verify(token)).rejects.toThrow()
    })

    it('rejects an expired token', async () => {
      const token = await buildToken({
        privateKey: keys.privateKey, kid: keys.kid,
        exp: -10,  // expired 10 seconds ago
      })
      await expect(verifier.verify(token)).rejects.toThrow()
    })
  })

  describe('malformed input', () => {
    it('rejects an empty string', async () => {
      await expect(verifier.verify('')).rejects.toThrow()
    })

    it('rejects a non-JWT string', async () => {
      await expect(verifier.verify('not.a.jwt')).rejects.toThrow()
    })
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd backend && pnpm test -- --testPathPattern=keycloak-token.verifier
```

Expected: FAIL - `Cannot find module '../../src/auth/token/keycloak-token.verifier'`

- [ ] **Step 3: Create `backend/src/auth/token/keycloak-token.verifier.ts`**

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FlattenedJWSInput, GetKeyFunction, JWSHeaderParameters } from 'jose'
import type { AuthenticatedUser } from '../types/authenticated-user'

export interface VerifierConfig {
  issuer:   string
  audience: string
}

type JwksProvider = GetKeyFunction<JWSHeaderParameters, FlattenedJWSInput>

// Validates a raw Keycloak access token.
// Used at OIDC callback time (Increment B) to validate before creating a session.
// Also used in unit tests via a local JWKS fixture.
//
// Does NOT check the ACR claim. ACR assurance is the responsibility of SessionGuard,
// which reads the ACR value stored in the session record at session creation time.

export class KeycloakTokenVerifier {
  private readonly jwks: JwksProvider

  constructor(
    private readonly config: VerifierConfig,
    jwksProviderOrUri: JwksProvider | string,
  ) {
    this.jwks = typeof jwksProviderOrUri === 'string'
      ? createRemoteJWKSet(new URL(jwksProviderOrUri))
      : jwksProviderOrUri
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer:   this.config.issuer,
      audience: this.config.audience,
    })

    if (typeof payload['sub'] !== 'string' || !payload['sub']) {
      throw new Error('Token is missing required sub claim')
    }

    return {
      sub:   payload['sub'],
      email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
      name:  typeof payload['name'] === 'string'  ? payload['name']  : undefined,
      acr:   typeof payload['acr']  === 'string'  ? payload['acr']   : undefined,
    }
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd backend && pnpm test -- --testPathPattern=keycloak-token.verifier
```

Expected: all 8 tests pass.

---

## Task 7: In-memory session store

**Files:**
- Create: `backend/src/auth/providers/in-memory-session.store.ts`

No TDD for the store itself — it is a simple Map wrapper tested implicitly via SessionGuard tests.

- [ ] **Step 1: Create `backend/src/auth/providers/in-memory-session.store.ts`**

```typescript
import type { SessionRecord } from '../types/session-record'
import type { SessionStore } from '../types/session-store.interface'

// In-memory session store for Increment A.
// Always empty at startup; no OIDC callback populates it yet.
// All authenticated requests return 401 because lookups return undefined.
// Replace with a PostgreSQL-backed implementation in Increment B via the SESSION_STORE token.

export class InMemorySessionStore implements SessionStore {
  private readonly store = new Map<string, SessionRecord>()

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    return this.store.get(sessionId)
  }

  async set(sessionId: string, record: SessionRecord): Promise<void> {
    this.store.set(sessionId, record)
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}
```

---

## Task 8: SessionGuard (TDD)

**Files:**
- Create: `backend/test/unit/session.guard.spec.ts`
- Create: `backend/src/auth/guards/session.guard.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/session.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SessionGuard } from '../../src/auth/guards/session.guard'
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator'
import { SKIP_MFA_KEY } from '../../src/auth/decorators/skip-mfa.decorator'
import type { SessionRecord } from '../../src/auth/types/session-record'
import type { SessionStore } from '../../src/auth/types/session-store.interface'

const REQUIRED_ACR = '2'

// --- helpers ---

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    user:      { sub: 'user-abc', acr: REQUIRED_ACR },
    acr:       REQUIRED_ACR,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  }
}

function makeContext(options: {
  cookies?: Record<string, string>
  metadata?: Record<string, boolean>
}): ExecutionContext {
  const request = { cookies: options.cookies ?? {}, user: undefined as unknown }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler:   () => ({}),
    getClass:     () => ({}),
    _request:     request,
  } as unknown as ExecutionContext
}

function makeReflector(metadata: Record<string, boolean>): Reflector {
  return {
    getAllAndOverride: (_key: string) => metadata[_key] ?? false,
  } as unknown as Reflector
}

function makeStore(session?: SessionRecord): SessionStore {
  return {
    get:    async (_id: string) => session,
    set:    async () => undefined,
    delete: async () => undefined,
  }
}

// --- tests ---

describe('SessionGuard', () => {
  describe('@Public() routes', () => {
    it('allows requests to @Public() routes without any cookie', async () => {
      const guard = new SessionGuard(
        makeReflector({ [IS_PUBLIC_KEY]: true }),
        makeStore(),
        REQUIRED_ACR,
      )
      const ctx = makeContext({})
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })
  })

  describe('missing or invalid session', () => {
    it('throws UnauthorizedException when no session cookie is present', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: {} })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when session cookie is present but not in the store', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(undefined),  // store returns undefined
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'unknown-id' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when the session is expired', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ expiresAt: Date.now() - 1000 })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'expired-id' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('MFA assurance', () => {
    it('throws UnauthorizedException when the session ACR is absent', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ acr: '' })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'session-1' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws UnauthorizedException when the session ACR does not match the required value', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord({ acr: '1' })),  // '1' is basic auth, not TOTP
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'session-2' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('allows a valid session with the correct ACR value', async () => {
      const guard = new SessionGuard(
        makeReflector({}),
        makeStore(makeRecord()),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'valid-session' } }) as unknown as ExecutionContext & { _request: { user: unknown } }
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      // User is attached to the request
      expect((ctx as unknown as { _request: { user: unknown } })._request.user).toMatchObject({ sub: 'user-abc' })
    })
  })

  describe('@SkipMfa() routes', () => {
    it('allows a valid session without the required ACR on a @SkipMfa() route', async () => {
      const guard = new SessionGuard(
        makeReflector({ [SKIP_MFA_KEY]: true }),
        makeStore(makeRecord({ acr: '1' })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'low-acr-session' } })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })

    it('still throws UnauthorizedException on @SkipMfa() when no cookie is present', async () => {
      const guard = new SessionGuard(
        makeReflector({ [SKIP_MFA_KEY]: true }),
        makeStore(),
        REQUIRED_ACR,
      )
      const ctx = makeContext({})
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('still throws UnauthorizedException on @SkipMfa() when the session is expired', async () => {
      const guard = new SessionGuard(
        makeReflector({ [SKIP_MFA_KEY]: true }),
        makeStore(makeRecord({ expiresAt: Date.now() - 1000 })),
        REQUIRED_ACR,
      )
      const ctx = makeContext({ cookies: { session_id: 'expired' } })
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('error response sanitization', () => {
    it('throws a plain UnauthorizedException without leaking session or token details', async () => {
      const guard = new SessionGuard(makeReflector({}), makeStore(), REQUIRED_ACR)
      const ctx   = makeContext({ cookies: { session_id: 'bad' } })
      let caught: unknown
      try {
        await guard.canActivate(ctx)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(UnauthorizedException)
      const body = (caught as UnauthorizedException).getResponse()
      const bodyStr = JSON.stringify(body)
      expect(bodyStr).not.toContain('bad')        // no session ID
      expect(bodyStr).not.toContain('session_id') // no cookie name
    })
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd backend && pnpm test -- --testPathPattern=session.guard
```

Expected: FAIL - `Cannot find module '../../src/auth/guards/session.guard'`

- [ ] **Step 3: Create `backend/src/auth/guards/session.guard.ts`**

```typescript
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { SKIP_MFA_KEY } from '../decorators/skip-mfa.decorator'
import { SESSION_STORE } from '../types/session-store.interface'
import type { SessionStore } from '../types/session-store.interface'
import type { AuthenticatedUser } from '../types/authenticated-user'

type RequestWithUser = Request & { user?: AuthenticatedUser }

// Deny-by-default authentication guard registered as APP_GUARD.
// All routes are protected unless decorated @Public().
// Full session + identity + MFA assurance required by default.
// @SkipMfa() skips only the ACR check; session and identity remain enforced.

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject('REQUIRED_ACR') private readonly requiredAcr: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request   = context.switchToHttp().getRequest<RequestWithUser>()
    const sessionId = (request.cookies as Record<string, string> | undefined)?.['session_id']

    if (!sessionId) throw new UnauthorizedException()

    const session = await this.sessionStore.get(sessionId)

    if (!session || session.expiresAt < Date.now()) throw new UnauthorizedException()

    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!skipMfa && session.acr !== this.requiredAcr) throw new UnauthorizedException()

    request.user = session.user
    return true
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd backend && pnpm test -- --testPathPattern=session.guard
```

Expected: all 12 tests pass.

---

## Task 9: Health module, AuthModule wiring and e2e tests

**Files:**
- Create: `backend/src/health/health.module.ts`
- Create: `backend/src/health/health.controller.ts`
- Create: `backend/src/auth/auth.module.ts`
- Create: `backend/test/jest-e2e.json`
- Create: `backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Create `backend/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): { status: string } {
    return { status: 'ok' }
  }
}
```

- [ ] **Step 2: Create `backend/src/health/health.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 3: Create `backend/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { SessionGuard } from './guards/session.guard'
import { InMemorySessionStore } from './providers/in-memory-session.store'
import { SESSION_STORE } from './types/session-store.interface'
import type { AuthConfig } from '../config/auth.config'

@Module({
  providers: [
    {
      provide: SESSION_STORE,
      useClass: InMemorySessionStore,
    },
    {
      provide: 'REQUIRED_ACR',
      useFactory: (config: ConfigService): string =>
        config.get<AuthConfig>('auth')?.keycloakRequiredAcr ?? '2',
      inject: [ConfigService],
    },
    SessionGuard,
    {
      provide:    APP_GUARD,
      useExisting: SessionGuard,
    },
  ],
})
export class AuthModule {}
```

- [ ] **Step 4: Create `backend/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testMatch": ["**/test/app.e2e-spec.ts"],
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node"
}
```

- [ ] **Step 5: Create `backend/test/app.e2e-spec.ts`**

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as cookieParser from 'cookie-parser'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Agenda API (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/health', () => {
    it('returns 200 with status ok without any authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'ok' })
    })
  })

  describe('protected endpoints', () => {
    it('GET /api/auth/me returns 401 without any cookie', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('GET /api/auth/me returns 401 with a fabricated session_id cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'session_id=fabricated-session-that-does-not-exist')
      expect(res.status).toBe(401)
    })

    it('GET /api/auth/me returns 401 when a raw Bearer token is supplied in the Authorization header', async () => {
      // The session guard does not read Bearer tokens; only session cookies are accepted.
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer some.fake.jwt')
      expect(res.status).toBe(401)
    })

    it('401 response body does not contain session or token details', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'session_id=leaking-test')
      expect(res.status).toBe(401)
      const body = JSON.stringify(res.body)
      expect(body).not.toContain('leaking-test')
      expect(body).not.toContain('session_id')
      expect(body).not.toContain('stack')
    })
  })
})
```

Note: `GET /api/auth/me` does not exist as a controller yet. NestJS returns 404 for unknown routes,
but the `APP_GUARD` runs before route matching and returns 401 first when no valid session exists.
Verify this is the case; if NestJS returns 404 before the guard runs, add a minimal
`AuthController` with a `@Get('me')` endpoint that returns `@CurrentUser()`.

- [ ] **Step 6: Add a minimal AuthController so the guard runs before 404**

If the e2e test above fails with 404 instead of 401, create
`backend/src/auth/auth.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthenticatedUser } from './types/authenticated-user'

// Minimal controller to expose GET /api/auth/me.
// The APP_GUARD rejects unauthenticated requests with 401 before this handler runs.
// Returns the verified user identity for authenticated requests (Increment B+).

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }
}
```

Then add `AuthController` to `AuthModule`:

```typescript
// backend/src/auth/auth.module.ts -- add controllers: [AuthController]
import { AuthController } from './auth.controller'

@Module({
  controllers: [AuthController],
  providers: [ /* ... existing providers ... */ ],
})
export class AuthModule {}
```

- [ ] **Step 7: Run all unit tests**

```bash
cd backend && pnpm test
```

Expected: all tests in `test/unit/` pass.

- [ ] **Step 8: Run e2e tests**

```bash
cd backend && pnpm test:e2e
```

Expected: all 5 e2e tests pass. If any fail with 404 instead of 401, complete Step 6 above first.

---

## Task 10: Welcome UI update

**Files:**
- Modify: `prototypes/ui-shell/components/WelcomeScreen.tsx`
- Modify: `prototypes/ui-shell/components/AppShell.tsx`
- Modify: `prototypes/ui-shell/app/globals.css`

- [ ] **Step 1: Update `prototypes/ui-shell/components/WelcomeScreen.tsx`**

Replace the full file:

```tsx
// components/WelcomeScreen.tsx
'use client'

import { useState, useEffect } from 'react'

// Must match the total CSS animation duration (0.3s delay + 3.6s last keyframe end).
const ANIM_TOTAL_MS = 4000

// Auth is available only when the environment variable is explicitly set to 'true'.
// Both Accedi and Registrati are disabled until a real identity provider is configured.
const AUTH_CONFIGURED = process.env['NEXT_PUBLIC_AUTH_CONFIGURED'] === 'true'

interface WelcomeScreenProps {
  visible:    boolean
  onLogin:    () => void
  onRegister: () => void
}

export function WelcomeScreen({ visible, onLogin, onRegister }: WelcomeScreenProps) {
  const [animKey,       setAnimKey]       = useState(0)
  const [buttonReady,   setButtonReady]   = useState(false)
  const [authUnavailable, setAuthUnavailable] = useState(false)

  useEffect(() => {
    setButtonReady(false)
    setAuthUnavailable(false)

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setButtonReady(true)
      return
    }

    const t = window.setTimeout(() => setButtonReady(true), ANIM_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [animKey])

  function handleLogin() {
    if (!AUTH_CONFIGURED) { setAuthUnavailable(true); return }
    onLogin()
  }

  function handleRegister() {
    if (!AUTH_CONFIGURED) { setAuthUnavailable(true); return }
    onRegister()
  }

  return (
    <div
      className="screen welcome-screen"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
    >
      <main className="welcome-main">
        {/* Accessible heading: screen readers announce "Welcome", visual text is decorative */}
        <h1 className="sr-only">Welcome</h1>

        {/* Tap / click anywhere on the text to replay from the beginning */}
        <button
          className="welcome-replay-btn"
          type="button"
          onClick={() => setAnimKey(k => k + 1)}
          aria-label="Riproduci l'animazione di benvenuto"
        >
          <div className="welcome-text-wrapper" aria-hidden="true">
            <span key={`stroke-${animKey}`} className="welcome-stroke">Welcome</span>
            <span key={`fill-${animKey}`}   className="welcome-fill">Welcome</span>
          </div>
        </button>

        <div className="welcome-actions">
          <button
            key={`login-${animKey}`}
            className={`inizia-button${buttonReady ? ' ready' : ''}`}
            type="button"
            onClick={handleLogin}
            tabIndex={buttonReady ? 0 : -1}
            aria-hidden={buttonReady ? undefined : true}
          >
            Accedi
          </button>

          <button
            key={`register-${animKey}`}
            className={`register-button${buttonReady ? ' ready' : ''}`}
            type="button"
            onClick={handleRegister}
            tabIndex={buttonReady ? 0 : -1}
            aria-hidden={buttonReady ? undefined : true}
          >
            Prima volta qui? Registrati
          </button>

          {authUnavailable && (
            <p role="alert" className="auth-unavailable">
              Autenticazione non ancora disponibile.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update `prototypes/ui-shell/components/AppShell.tsx`**

Replace `handleStart`, `onStart`, and the `WelcomeScreen` render call:

```tsx
// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AppView } from '@/lib/types'
import { WelcomeScreen } from './WelcomeScreen'
import { RadialMenu } from './RadialMenu'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)
  const router          = useRouter()

  // prevViewRef distinguishes mount from genuine in-app transitions.
  // - On initial mount: prevView is null -> skip focus assignment.
  // - On Strict Mode double-invoke: prevView === view -> skip.
  // - On genuine transition: prevView !== view -> assign focus.
  const prevViewRef          = useRef<AppView | null>(null)
  const firstItemRef         = useRef<HTMLAnchorElement | null>(null)
  const firstFallbackItemRef = useRef<HTMLAnchorElement | null>(null)
  const centerButtonRef      = useRef<HTMLButtonElement | null>(null)

  // Increment B: redirect to NestJS /api/auth/login which initiates the Keycloak OIDC flow.
  // On successful authentication, Keycloak redirects back to /api/auth/callback, NestJS
  // creates a session, and the browser is redirected to /?view=menu.
  function handleLogin() {
    const loginUrl = process.env['NEXT_PUBLIC_AUTH_LOGIN_URL']
    if (loginUrl) {
      window.location.href = loginUrl
    }
    // AUTH_CONFIGURED=false: WelcomeScreen shows the unavailable state before calling this.
    // This handler is only reached when AUTH_CONFIGURED=true.
  }

  function handleRegister() {
    const registerUrl = process.env['NEXT_PUBLIC_AUTH_REGISTER_URL']
    if (registerUrl) {
      window.location.href = registerUrl
    }
  }

  function getFirstMenuItemRef(): HTMLAnchorElement | null {
    if (typeof window === 'undefined') return firstItemRef.current
    const isFallback = window.matchMedia('(max-width: 500px)').matches
    return isFallback ? firstFallbackItemRef.current : firstItemRef.current
  }

  useEffect(() => {
    const prevView      = prevViewRef.current
    prevViewRef.current = view

    if (prevView === null) return
    if (prevView === view) return

    if (view === 'MENU_OPEN') {
      getFirstMenuItemRef()?.focus()
    } else if (view === 'MENU_CLOSED') {
      centerButtonRef.current?.focus()
    }
  }, [view])

  return (
    <>
      <WelcomeScreen
        visible={view === 'WELCOME'}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
      <RadialMenu
        visible={view !== 'WELCOME'}
        isOpen={view === 'MENU_OPEN'}
        onOpen={() => setView('MENU_OPEN')}
        onClose={() => setView('MENU_CLOSED')}
        firstItemRef={firstItemRef}
        firstFallbackItemRef={firstFallbackItemRef}
        centerButtonRef={centerButtonRef}
      />
    </>
  )
}
```

- [ ] **Step 3: Add CSS to `prototypes/ui-shell/app/globals.css`**

Append after the `.inizia-button:focus-visible` block (after line 234 in the current file,
before the `@keyframes welcome-button-appear` block at line 236):

```css
/* Welcome action container: stacks Accedi and Registrati with consistent spacing */
.welcome-actions {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            12px;
}

/* Secondary registration action - visually subordinate to Accedi */
.register-button {
  min-height:     44px;
  min-width:      44px;
  padding:        0 24px;
  border-radius:  22px;
  background:     transparent;
  color:          rgba(255, 255, 255, 0.80);
  border:         1px solid rgba(255, 255, 255, 0.45);
  font-size:      0.875rem;
  font-weight:    500;
  letter-spacing: 0.03em;
  cursor:         pointer;
  animation:      welcome-button-appear 600ms ease 3.4s both;
}

.register-button:not(.ready) {
  pointer-events: none;
}

.register-button:hover {
  color:        rgba(255, 255, 255, 1);
  border-color: rgba(255, 255, 255, 0.70);
}

.register-button:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
  box-shadow:     0 0 0 1px var(--focus-ring-bg);
}

/* Inline unavailable state shown when auth is not yet configured */
.auth-unavailable {
  color:       rgba(255, 220, 100, 0.95);
  font-size:   0.875rem;
  text-align:  center;
  line-height: 1.5;
  max-width:   280px;
}
```

- [ ] **Step 4: Verify ui-shell builds and starts**

```bash
cd prototypes/ui-shell && pnpm build
```

Expected: build completes without TypeScript errors.

```bash
cd prototypes/ui-shell && pnpm dev
```

Open `http://localhost:3000`. After the animation completes, two buttons appear: "Accedi" and
"Prima volta qui? Registrati". Clicking either shows "Autenticazione non ancora disponibile."
in yellow text below the buttons. The radial menu, palette switcher and all section routes
work exactly as before.

---

## Task 11: Full build and test verification

- [ ] **Step 1: Run all NestJS unit tests**

```bash
cd backend && pnpm test
```

Expected: all tests in `test/unit/` pass.

```
PASS test/unit/keycloak-token.verifier.spec.ts
PASS test/unit/session.guard.spec.ts

Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
```

- [ ] **Step 2: Run NestJS e2e tests**

```bash
cd backend && pnpm test:e2e
```

Expected:

```
PASS test/app.e2e-spec.ts
  Agenda API (e2e)
    GET /api/health
      - returns 200 with status ok without any authentication
    protected endpoints
      - GET /api/auth/me returns 401 without any cookie
      - GET /api/auth/me returns 401 with a fabricated session_id cookie
      - GET /api/auth/me returns 401 when a raw Bearer token is supplied
      - 401 response body does not contain session or token details

Tests: 5 passed, 5 total
```

- [ ] **Step 3: Run NestJS TypeScript check**

```bash
cd backend && pnpm typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 4: Run NestJS build**

```bash
cd backend && pnpm build
```

Expected: `dist/` is populated without errors.

- [ ] **Step 5: Run ui-shell TypeScript check**

```bash
cd prototypes/ui-shell && pnpm typecheck 2>&1 || pnpm exec tsc --noEmit
```

Expected: exits 0 with no errors.

- [ ] **Step 6: Start both services together and verify no conflicts**

In one terminal:
```bash
cd backend && pnpm dev
```

In another terminal:
```bash
cd prototypes/ui-shell && pnpm dev
```

Verify:
- `http://localhost:3001/api/health` returns `{"status":"ok"}`
- `http://localhost:3001/api/auth/me` returns `401`
- `http://localhost:3000` shows the Welcome screen with "Accedi" and "Prima volta qui? Registrati"
- Clicking either button shows "Autenticazione non ancora disponibile."
- Radial menu, palette switcher, calendar and all section routes are unaffected

---

## Pending tests (require live Keycloak - recorded here for Increment B)

The following tests are marked `it.todo` in their respective spec files. Do not claim
them as passing.

- Real Keycloak token with ACR `"2"` accepted by `KeycloakTokenVerifier`
- Token with ACR `"1"` (Google login without TOTP) rejected by session creation
- Token with missing ACR rejected by session creation
- Expired Keycloak access token triggers silent refresh; subsequent request succeeds
- Failed token refresh (revoked Keycloak session) returns 401 and deletes local session
- Logout deletes session, clears cookie, and initiates RP-initiated logout redirect
- Backchannel logout notification triggers session deletion
- Two authenticated users cannot access each other's resources

---

## Architecture decisions recorded

| Decision | Choice | Rationale |
|---|---|---|
| JWT library | `jose` v4 | CJS-compatible, standards-compliant, handles JWKS natively |
| Session store | In-memory Map | Always empty in Increment A; PostgreSQL in Increment B |
| MFA check location | SessionGuard (stored ACR) | ACR checked at session creation; stored value used per-request to avoid re-parsing token |
| OIDC client type | Confidential (`agenda-bff`) | Tokens never in browser; client secret held by NestJS only |
| Cookie path | `/` | Required for Next.js middleware to read the session cookie on page navigations |
| ACR value | `KEYCLOAK_REQUIRED_ACR` env var | Exact value emitted by Keycloak depends on realm configuration; verify during Increment B |
