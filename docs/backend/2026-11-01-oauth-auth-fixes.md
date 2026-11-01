# OAuth / Auth Backend — Bug Fixes (2026-11-01)

Analysis and resolution of the issues encountered getting the backend to build
and the Google + TOTP OAuth flow to complete successfully on the
`feature/oauth` branch.

---

## 1. Build output in wrong location (`dist/src/…` instead of `dist/`)

**Symptom:** `pnpm run start` failed with `Cannot find module '…/dist/main'`.
After a successful build the compiled files were nested under `dist/src/`
instead of `dist/`.

**Root cause:** No `tsconfig.build.json` existed. `nest build` fell back to
`tsconfig.json`, which had no `rootDir`. TypeScript therefore treated the
repository root as the source root and mirrored the full directory tree
(`src/`, `test/`, …) inside `dist/`.

**Fix:** Created `backend/tsconfig.build.json` that extends `tsconfig.json`
and adds:
- `rootDir: "./src"` — constrains compilation to `src/` so output lands
  directly in `dist/`
- `exclude: ["node_modules", "test", "dist", "**/*spec.ts"]` — keeps test
  files out of the production build
- `tsBuildInfoFile: "./dist/tsconfig.build.tsbuildinfo"` — stores the
  incremental cache inside `dist/` (see issue 2)

---

## 2. Incremental build producing no output after first clean

**Symptom:** `pnpm run build` exited with no errors but `dist/` was absent.

**Root cause:** TypeScript's incremental compiler writes `.tsbuildinfo` to the
project root by default (`tsconfig.build.tsbuildinfo`, `tsconfig.tsbuildinfo`).
`nest-cli.json`'s `deleteOutDir: true` only deletes `dist/`, so the cache
survived every clean build and told TypeScript "nothing changed — skip emit".

**Fix:** Set `tsBuildInfoFile: "./dist/tsconfig.build.tsbuildinfo"` in
`tsconfig.build.json`. The file now lives inside `dist/` and is wiped on every
build. Stale root-level `.tsbuildinfo` files were also deleted manually.

---

## 3. TypeScript error — `symbol` not assignable to `string | unique symbol`

**Symptom:** `nest build` failed with:

```
src/auth/oidc/oidc-client.service.ts:84:9 - error TS2322:
Type 'symbol' is not assignable to type 'string | unique symbol | undefined'.
```

**Root cause:** `skipStateCheck` exported by `openid-client` is a
`unique symbol`. TypeScript's structural typing does not allow a plain
`symbol` to satisfy `typeof skipStateCheck` (a *specific* unique symbol
type), even though the runtime values are identical.

**Fix:** Cast at the call site:
```ts
expectedState: skipStateCheck as unknown as string
```
The runtime identity check inside `openid-client` (`expectedState ===
skipStateCheck`) still works correctly because the cast only affects the
TypeScript type, not the value.

---

## 4. Missing `MIGRATIONS_DIR` — server crash on boot

**Symptom:** Application started but crashed immediately with:

```
Error: ENOENT: no such file or directory, scandir
'C:\…\DoodleLab\migrations'
```

**Root cause:** `MigrationRunnerService` defaulted the migrations path to
`join(__dirname, '..', '..', '..', 'migrations')`. With `__dirname` resolving
to `dist/auth/`, the three `..` traversals landed at the project root
(`DoodleLab/`), not inside `backend/`.

**Fix:** Added to `.env.local` (local-only, not committed):
```
MIGRATIONS_DIR=C:\Users\Grace\IdeaProjects\DoodleLab\backend\migrations
```

---

## 5. Token exchange failing — `invalid response encountered` (missing `iss`)

**Symptom:** Login reached the `/api/auth/callback` route but failed with:

```
WARN [AuthController] token_exchange error: invalid response encountered
       | cause: response parameter "iss" (issuer) missing
```

**Root cause:** `openid-client` v6 enforces RFC 9207 (Authorization Server
Issuer Identification). Keycloak includes an `iss` query parameter in the
authorization callback URL. The code was manually constructing the URL
passed to `authorizationCodeGrant` with only the `code` parameter, omitting
`iss`. The library refused to proceed without it.

**Fix:**

`auth.controller.ts` — extract `iss` from the callback query string:
```ts
const iss = typeof query['iss'] === 'string' ? query['iss'] : undefined
```

`oidc-client.service.ts` — accept `iss?` in `exchangeCode` and include it
in the URL:
```ts
if (params.iss) u.searchParams.set('iss', params.iss)
```

---

## 6. `acr_not_satisfied` — Keycloak returning `acr: "1"` instead of `"2"`

**Symptom:** Token exchange succeeded but the callback rejected the session:

```
WARN [AuthController] Auth callback failed: failed (acr_not_satisfied)
DEBUG [AuthController] id_token acr="1" type=string
```

**Root cause:** The `post broker login with otp` Keycloak flow contained a
single top-level `auth-otp-form` execution with no Level of Assurance (LOA)
configuration. Keycloak has no way to know that completing this OTP step
should count as LOA 2, so it defaults to ACR 1 regardless of the `claims`
parameter requesting `acr: { essential: true, values: ["2"] }`.

**Fix:** Restructured the post-broker flow into a CONDITIONAL sub-flow
containing:

1. **Condition — Level of Authentication** (REQUIRED, `loa-condition-level=2`,
   `loa-max-age=86400`) — evaluates to *true* when the current LOA is below 2,
   triggering the sub-flow.
2. **OTP Form** (REQUIRED, `userSetupAllowed=true`) — prompts for (or
   configures) TOTP. After successful completion Keycloak sets LOA 2, which
   maps to `acr: "2"` via the realm's `acr.loa.map: {"2":"2"}` attribute.

The running Keycloak instance was updated live via the Admin REST API.
`backend/keycloak/agenda-realm.json` was updated with the same structure so
future fresh deployments inherit the correct configuration automatically.

**Flow structure after fix:**
```
post broker login with otp  (basic-flow, top-level)
└── otp-loa2  (basic-flow, CONDITIONAL)
    ├── Condition - Level of Authentication  (REQUIRED, loa-condition-level=2)
    └── OTP Form  (REQUIRED, userSetupAllowed=true)
```
