# Google OAuth via NextAuth.js — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth via NextAuth.js as the identity layer before the vault, namespace localStorage keys by userId, and wire a /login page into the existing AppGate flow.

**Architecture:** `SessionProvider` wraps the entire app; `VaultProvider` reads the Google session to get `userId` and creates/retrieves a per-user `VaultService` instance; `AppGate` checks Google session first (redirects to `/login`), then vault state (redirects to `/setup` or `/unlock`). The vault's localStorage keys are namespaced by `userId` so multiple Google accounts on the same browser can't collide.

**Tech Stack:** Next.js 15 App Router, NextAuth.js v4 (`next-auth`), Google OAuth2, React `useSession`, existing Argon2/AES-GCM vault layer.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/auth-options.ts` | NextAuth config (GoogleProvider + session callback) — extracted for route + potential middleware reuse |
| Create | `app/api/auth/[...nextauth]/route.ts` | Catch-all NextAuth route handler |
| Create | `types/next-auth.d.ts` | Augment `Session` / `JWT` so `session.user.id` is typed |
| Create | `app/login/page.tsx` | Login page — glassmorphism card + Google sign-in button |
| Modify | `package.json` | Add `next-auth` dependency |
| Modify | `.env.local` | Add `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Modify | `app/layout.tsx` | Wrap body with `SessionProvider` |
| Modify | `lib/vault/vault-service.ts` | Accept optional `userId`; namespace META_KEY and PHASE1_MIGRATION_MAP vault-key targets |
| Modify | `lib/vault/vault-storage-adapter.ts` | Accept `userId` in `create()`; build per-user physical key map |
| Modify | `lib/vault/vault-context.tsx` | `VaultProvider` reads session → passes `userId` to `getVaultService`; `AppGate` checks Google auth first; expose `logout()` |
| Modify | `lib/vault/vault-service.test.ts` | Update tests to pass `userId` to `VaultService`; update expected key names |

---

## Task 1: Install next-auth and add env vars

**Files:**
- Modify: `prototypes/ui-shell/package.json`
- Modify: `prototypes/ui-shell/.env.local`

- [ ] **Step 1: Install next-auth**

```bash
cd prototypes/ui-shell && pnpm add next-auth
```

Expected: `next-auth` appears in `package.json` dependencies.

- [ ] **Step 2: Add env vars to .env.local**

Append to `prototypes/ui-shell/.env.local`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=REPLACE_WITH_openssl_rand_-base64_32
GOOGLE_CLIENT_ID=REPLACE_WITH_REAL_VALUE
GOOGLE_CLIENT_SECRET=REPLACE_WITH_REAL_VALUE
```

> Note: `NEXTAUTH_SECRET` must be a real random string in production. Generate locally with `openssl rand -base64 32`. The app will throw at runtime if this is missing.

- [ ] **Step 3: Commit**

```bash
cd ../..  # back to repo root
git add prototypes/ui-shell/package.json prototypes/ui-shell/pnpm-lock.yaml
git commit -m "chore(auth): add next-auth dependency"
```

---

## Task 2: NextAuth config, route handler, TypeScript types

**Files:**
- Create: `prototypes/ui-shell/lib/auth-options.ts`
- Create: `prototypes/ui-shell/app/api/auth/[...nextauth]/route.ts`
- Create: `prototypes/ui-shell/types/next-auth.d.ts`

- [ ] **Step 1: Create NextAuth config**

Create `prototypes/ui-shell/lib/auth-options.ts`:

```ts
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      // On first sign-in, `account` is present and contains the Google sub.
      // On subsequent calls token.sub is already set by NextAuth.
      if (account?.providerAccountId) {
        token.sub = `google|${account.providerAccountId}`
      }
      return token
    },
    session({ session, token }) {
      // Expose the namespaced Google sub as session.user.id
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
```

- [ ] **Step 2: Create catch-all route handler**

Create `prototypes/ui-shell/app/api/auth/[...nextauth]/route.ts`:

```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

- [ ] **Step 3: Create TypeScript session augmentation**

Create `prototypes/ui-shell/types/next-auth.d.ts`:

```ts
import type { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    sub: string
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd prototypes/ui-shell && pnpm typecheck
```

Expected: no errors related to `session.user.id`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add prototypes/ui-shell/lib/auth-options.ts \
        "prototypes/ui-shell/app/api/auth/[...nextauth]/route.ts" \
        prototypes/ui-shell/types/next-auth.d.ts
git commit -m "feat(auth): NextAuth config, Google provider route, session types"
```

---

## Task 3: SessionProvider in layout

**Files:**
- Modify: `prototypes/ui-shell/app/layout.tsx`

- [ ] **Step 1: Add SessionProvider**

The layout currently has:

```tsx
<body>
  <VaultProvider>
    <AppGate>
      {children}
    </AppGate>
  </VaultProvider>
  ...
</body>
```

Replace the `<body>` content with:

```tsx
import { SessionProvider } from 'next-auth/react'

// inside RootLayout:
<body>
  <SessionProvider>
    <VaultProvider>
      <AppGate>
        {children}
      </AppGate>
    </VaultProvider>
  </SessionProvider>
  {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
    <PaletteSwitcher />
  )}
</body>
```

> `SessionProvider` must be the outermost wrapper so both `VaultProvider` and `AppGate` can call `useSession()`.

- [ ] **Step 2: Verify build**

```bash
cd prototypes/ui-shell && pnpm build
```

Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add prototypes/ui-shell/app/layout.tsx
git commit -m "feat(auth): wrap app with NextAuth SessionProvider"
```

---

## Task 4: userId-aware VaultStorageAdapter

**Files:**
- Modify: `prototypes/ui-shell/lib/vault/vault-storage-adapter.ts`

The goal: physical localStorage keys include the `userId` so two Google accounts never share encrypted data.

- [ ] **Step 1: Update VaultStorageAdapter to accept userId**

Replace the static `VAULT_KEY_MAP` constant and the `create()` signature in `vault-storage-adapter.ts`:

```ts
// Remove the static VAULT_KEY_MAP constant at the top of the file.
// Replace it with this factory:

function buildKeyMap(userId: string): Record<string, string> {
  return {
    'doodlelab:calendar:v1': `doodlelab:vault:data:${userId}:calendar:v1`,
    'doodlelab:daily:v1':    `doodlelab:vault:data:${userId}:daily:v1`,
    'doodlelab:journal:v1':  `doodlelab:vault:data:${userId}:journal:v1`,
    'doodlelab:inbox:v1':    `doodlelab:vault:data:${userId}:inbox:v1`,
    'doodlelab:board:v2':    `doodlelab:vault:data:${userId}:board:v3`,
  }
}
```

Update the class:

```ts
export class VaultStorageAdapter implements StorageAdapter {
  private readonly cache:      Map<string, string>
  private readonly key:        CryptoKey
  private readonly inner:      StorageAdapter
  private readonly writeQueue: AsyncQueue
  private readonly keyMap:     Record<string, string>

  private constructor(
    key:    CryptoKey,
    inner:  StorageAdapter,
    cache:  Map<string, string>,
    keyMap: Record<string, string>,
  ) {
    this.key        = key
    this.inner      = inner
    this.cache      = cache
    this.writeQueue = new AsyncQueue()
    this.keyMap     = keyMap
  }

  static async create(
    key:         CryptoKey,
    inner:       StorageAdapter,
    logicalKeys: string[],
    userId:      string,
  ): Promise<VaultStorageAdapter> {
    const keyMap = buildKeyMap(userId)
    const cache  = new Map<string, string>()
    for (const logicalKey of logicalKeys) {
      const vaultKey = keyMap[logicalKey] ?? logicalKey
      const raw = inner.read(vaultKey)
      if (raw !== null) {
        try {
          const ct        = JSON.parse(raw) as { iv: string; ciphertext: string }
          const plaintext = await decrypt(key, ct)
          cache.set(logicalKey, plaintext)
        } catch {
          // Corrupt or tampered data — silently skip
        }
      }
    }
    return new VaultStorageAdapter(key, inner, cache, keyMap)
  }

  read(key: string): string | null {
    return this.cache.get(key) ?? null
  }

  write(key: string, value: string): void {
    this.cache.set(key, value)
    const vaultKey = this.keyMap[key] ?? key
    this.writeQueue.enqueue(async () => {
      const ct = await encrypt(this.key, value)
      this.inner.write(vaultKey, JSON.stringify(ct))
    })
  }

  remove(key: string): void {
    this.cache.delete(key)
    const vaultKey = this.keyMap[key] ?? key
    this.writeQueue.enqueue(async () => {
      this.inner.remove(vaultKey)
    })
  }

  async destroy(): Promise<void> {
    await this.writeQueue.flush()
    this.cache.clear()
  }
}
```

- [ ] **Step 2: Update vault-storage-adapter.test.ts**

The existing tests call `VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)` (no userId) and expect physical keys like `'doodlelab:vault:daily:v1'`. After the change, `userId` is required and physical keys are namespaced.

Replace every `VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)` call with `VaultStorageAdapter.create(key, inner, LOGICAL_KEYS, 'test-user')` and update expected physical key strings:

- `'doodlelab:vault:daily:v1'` → `'doodlelab:vault:data:test-user:daily:v1'`
- `'doodlelab:vault:board:v3'` → `'doodlelab:vault:data:test-user:board:v3'`

(There are 9 `create()` calls and 4 physical-key string assertions to update.)

- [ ] **Step 3: Run storage adapter tests**

```bash
cd prototypes/ui-shell && pnpm test vault-storage-adapter
```

Expected: all 8 tests pass.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add prototypes/ui-shell/lib/vault/vault-storage-adapter.ts \
        prototypes/ui-shell/lib/vault/vault-storage-adapter.test.ts
git commit -m "feat(vault): namespace physical storage keys by userId"
```

---

## Task 5: userId-aware VaultService

**Files:**
- Modify: `prototypes/ui-shell/lib/vault/vault-service.ts`

- [ ] **Step 1: Parameterize VaultService with userId**

Replace the constants and class definition at the top of `vault-service.ts`:

```ts
// ── Constants ────────────────────────────────────────────────────────────────

function metaKey(userId: string): string {
  return `doodlelab:vault:meta:${userId}:v1`
}

// Logical keys that repositories use — VaultStorageAdapter maps these to vault keys
const VAULT_LOGICAL_KEYS = [
  'doodlelab:calendar:v1',
  'doodlelab:daily:v1',
  'doodlelab:journal:v1',
  'doodlelab:inbox:v1',
  'doodlelab:board:v2',
]

// Phase 1 key → Phase 2 vault key (used only for one-time migration in setup())
// Physical vault keys are now userId-namespaced.
function phase1MigrationMap(userId: string): Record<string, string> {
  return {
    'doodlelab:calendar:v1': `doodlelab:vault:data:${userId}:calendar:v1`,
    'doodlelab:daily:v1':    `doodlelab:vault:data:${userId}:daily:v1`,
    'doodlelab:journal:v1':  `doodlelab:vault:data:${userId}:journal:v1`,
    'doodlelab:inbox:v1':    `doodlelab:vault:data:${userId}:inbox:v1`,
    'doodlelab:board:v2':    `doodlelab:vault:data:${userId}:board:v3`,
  }
}
```

Update the `VaultService` class constructor and `setup()`:

```ts
export class VaultService extends ChangeNotifier {
  private _state: VaultState
  private readonly inner  = new LocalStorageAdapter()
  private readonly userId: string

  // ... (keep existing private fields: inactivityTimer, INACTIVITY_MS, event handlers)

  constructor(userId: string) {
    super()
    this.userId = userId
    const meta  = this.inner.read(metaKey(userId))
    this._state = meta ? { status: 'locked' } : { status: 'uninitialized' }
  }

  // In setup(), replace the PHASE1_MIGRATION_MAP loop:
  async setup(pin: string, masterKeyHex: string, recoveryHint?: string): Promise<void> {
    // ... (keep existing key derivation and encryption unchanged)
    
    // One-time migration: use userId-namespaced target keys
    for (const [phase1Key, vaultKey] of Object.entries(phase1MigrationMap(this.userId))) {
      const raw = this.inner.read(phase1Key)
      if (raw !== null) {
        const ct = await encrypt(masterKey, raw)
        this.inner.write(vaultKey, JSON.stringify(ct))
        this.inner.remove(phase1Key)
      }
    }

    const meta: VaultMeta = {
      encryptedMasterKey,
      salt:      toBase64(salt),
      recoveryHint,
      createdAt: new Date().toISOString(),
      verifierCiphertext,
    }
    this.inner.write(metaKey(this.userId), JSON.stringify(meta))

    await this.activateWithMasterKey(masterKey)
  }

  // In unlock(), replace the meta read:
  async unlock(pin: string): Promise<boolean> {
    try {
      const metaRaw = this.inner.read(metaKey(this.userId))
      // ... rest unchanged
    } catch {
      return false
    }
  }

  // In recover(), replace the meta read:
  async recover(recoveryCode: string): Promise<boolean> {
    try {
      const metaRaw = this.inner.read(metaKey(this.userId))
      // ... rest unchanged
    } catch {
      return false
    }
  }

  // In activateWithMasterKey(), pass userId to VaultStorageAdapter:
  private async activateWithMasterKey(masterKey: CryptoKey): Promise<void> {
    const adapter = await VaultStorageAdapter.create(
      masterKey,
      this.inner,
      VAULT_LOGICAL_KEYS,
      this.userId,       // ← NEW
    )
    // ... rest unchanged
  }
}
```

Update the singleton factory:

```ts
const vaultServiceCache = new Map<string, VaultService>()

export function getVaultService(userId: string): VaultService {
  if (!vaultServiceCache.has(userId)) {
    vaultServiceCache.set(userId, new VaultService(userId))
  }
  return vaultServiceCache.get(userId)!
}
```

- [ ] **Step 2: Commit**

```bash
cd ../..
git add prototypes/ui-shell/lib/vault/vault-service.ts
git commit -m "feat(vault): parameterize VaultService with userId, namespace localStorage keys"
```

---

## Task 6: Update vault-service tests

**Files:**
- Modify: `prototypes/ui-shell/lib/vault/vault-service.test.ts`

- [ ] **Step 1: Update all VaultService instantiations to pass userId**

Change every `new VaultService()` to `new VaultService('test-user')`.

The expected key names change:
- `'doodlelab:vault:meta:v1'` → `'doodlelab:vault:meta:test-user:v1'`
- `'doodlelab:vault:daily:v1'` → `'doodlelab:vault:data:test-user:daily:v1'`
- `'doodlelab:vault:journal:v1'` → `'doodlelab:vault:data:test-user:journal:v1'`

Full updated test file `prototypes/ui-shell/lib/vault/vault-service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/vault/argon2-adapter', () => ({
  deriveKey: async (password: string, salt: Uint8Array) => {
    const material = new TextEncoder().encode(
      password + Array.from(salt).join(','),
    )
    const raw = await crypto.subtle.digest('SHA-256', material)
    return crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  },
}))

import { VaultService } from './vault-service'

const TEST_USER = 'test-user'

function makeMasterKeyHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

beforeEach(() => {
  localStorage.clear()
})

describe('VaultService', () => {
  it('state is "uninitialized" on first run (no vault meta)', () => {
    const svc = new VaultService(TEST_USER)
    expect(svc.getState().status).toBe('uninitialized')
  })

  it('state is "locked" when vault meta exists', () => {
    localStorage.setItem(
      `doodlelab:vault:meta:${TEST_USER}:v1`,
      JSON.stringify({
        encryptedMasterKey: { iv: 'a', ciphertext: 'b' },
        salt:               btoa('saltsalt'),
        createdAt:          '2026-01-01T00:00:00.000Z',
      }),
    )
    const svc = new VaultService(TEST_USER)
    expect(svc.getState().status).toBe('locked')
  })

  it('setup() transitions to "unlocked"', async () => {
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', makeMasterKeyHex())
    expect(svc.getState().status).toBe('unlocked')
  })

  it('setup() then lock() then unlock() with correct PIN → "unlocked"', async () => {
    const masterKeyHex = makeMasterKeyHex()
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', masterKeyHex)
    svc.lock()
    expect(svc.getState().status).toBe('locked')
    const ok = await svc.unlock('my-pin-123')
    expect(ok).toBe(true)
    expect(svc.getState().status).toBe('unlocked')
  })

  it('unlock() with wrong PIN returns false and stays "locked"', async () => {
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', makeMasterKeyHex())
    svc.lock()
    const ok = await svc.unlock('wrong-pin')
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('locked')
  })

  it('lock() transitions to "locked"', async () => {
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', makeMasterKeyHex())
    expect(svc.getState().status).toBe('unlocked')
    svc.lock()
    expect(svc.getState().status).toBe('locked')
  })

  it('recover() with valid 64-hex recovery code → "unlocked"', async () => {
    const masterKeyHex = makeMasterKeyHex()
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', masterKeyHex)
    svc.lock()
    const ok = await svc.recover(masterKeyHex)
    expect(ok).toBe(true)
    expect(svc.getState().status).toBe('unlocked')
  })

  it('recover() with invalid code (non-hex) returns false', async () => {
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', makeMasterKeyHex())
    svc.lock()
    const ok = await svc.recover('not-a-valid-recovery-code')
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('locked')
  })

  it('recover() with wrong-but-valid 64-hex code returns false', async () => {
    const svc = new VaultService(TEST_USER)
    await svc.setup('my-pin-123', makeMasterKeyHex())
    svc.lock()
    const wrongKey = makeMasterKeyHex()
    const ok = await svc.recover(wrongKey)
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('locked')
  })

  it('recover() returns false when vault is uninitialized (no meta)', async () => {
    const svc = new VaultService(TEST_USER)
    expect(svc.getState().status).toBe('uninitialized')
    const ok = await svc.recover(makeMasterKeyHex())
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('uninitialized')
  })

  it('setup() migrates Phase 1 plaintext data to userId-namespaced vault keys', async () => {
    localStorage.setItem('doodlelab:daily:v1', '{"tasks":[]}')
    localStorage.setItem('doodlelab:journal:v1', '[]')
    const svc = new VaultService(TEST_USER)
    await svc.setup('pin-123', makeMasterKeyHex())
    // Phase 1 keys must be deleted
    expect(localStorage.getItem('doodlelab:daily:v1')).toBeNull()
    expect(localStorage.getItem('doodlelab:journal:v1')).toBeNull()
    // Vault keys must exist and be userId-namespaced
    expect(localStorage.getItem(`doodlelab:vault:data:${TEST_USER}:daily:v1`)).not.toBeNull()
    expect(localStorage.getItem(`doodlelab:vault:data:${TEST_USER}:journal:v1`)).not.toBeNull()
  })

  it('notify() is called on setup, lock, and unlock', async () => {
    const svc = new VaultService(TEST_USER)
    const listener = vi.fn()
    svc.subscribe(listener)

    await svc.setup('pin-123', makeMasterKeyHex())
    expect(listener).toHaveBeenCalledTimes(1)

    svc.lock()
    expect(listener).toHaveBeenCalledTimes(2)

    await svc.unlock('pin-123')
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('two VaultService instances with different userIds are independent', async () => {
    const keyA = makeMasterKeyHex()
    const svcA = new VaultService('user-a')
    const svcB = new VaultService('user-b')
    await svcA.setup('pin-a', keyA)
    // B sees no vault for user-b
    expect(svcB.getState().status).toBe('uninitialized')
    // A's meta key is not visible to B
    expect(localStorage.getItem('doodlelab:vault:meta:user-b:v1')).toBeNull()
    expect(localStorage.getItem('doodlelab:vault:meta:user-a:v1')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd prototypes/ui-shell && pnpm test vault-service
```

Expected: all 11 tests pass.

- [ ] **Step 3: Run all vault tests**

```bash
cd prototypes/ui-shell && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add prototypes/ui-shell/lib/vault/vault-service.test.ts
git commit -m "test(vault): update tests for userId-parameterized VaultService"
```

---

## Task 7: VaultProvider + AppGate with Google auth check

**Files:**
- Modify: `prototypes/ui-shell/lib/vault/vault-context.tsx`

The key changes:
1. `VaultProvider` reads session and creates/gets the per-user `VaultService`
2. `AppGate` checks Google session before vault state; exposes `logout()`
3. `VaultContextValue` gains a `logout()` method

- [ ] **Step 1: Rewrite vault-context.tsx**

```ts
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { getVaultService, type VaultState } from '@/lib/vault/vault-service'

// ── Types ─────────────────────────────────────────────────────────────────────

export type VaultContextValue = {
  state:   VaultState
  setup:   (pin: string, masterKeyHex: string, hint?: string) => Promise<void>
  unlock:  (pin: string) => Promise<boolean>
  recover: (code: string) => Promise<boolean>
  lock:    () => void
  logout:  () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextValue | null>(null)

// ── VaultProvider ─────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }): ReactNode {
  const { data: session } = useSession()
  const userId            = session?.user?.id ?? null

  // Derive the VaultService for the current user (null if not logged in yet).
  const vaultService = userId ? getVaultService(userId) : null

  const [state, setState] = useState<VaultState>(() =>
    vaultService ? vaultService.getState() : { status: 'uninitialized' },
  )

  // Re-subscribe whenever userId changes (login / logout).
  useEffect(() => {
    if (!vaultService) {
      setState({ status: 'uninitialized' })
      return
    }
    // Sync state immediately in case vaultService already has a state.
    setState(vaultService.getState())
    const unsubscribe = vaultService.subscribe(() => {
      setState(vaultService.getState())
    })
    return unsubscribe
  }, [vaultService])

  const setup = useCallback(
    (pin: string, masterKeyHex: string, hint?: string): Promise<void> => {
      if (!vaultService) return Promise.reject(new Error('Not authenticated'))
      return vaultService.setup(pin, masterKeyHex, hint)
    },
    [vaultService],
  )

  const unlock = useCallback(
    (pin: string): Promise<boolean> => {
      if (!vaultService) return Promise.resolve(false)
      return vaultService.unlock(pin)
    },
    [vaultService],
  )

  const recover = useCallback(
    (code: string): Promise<boolean> => {
      if (!vaultService) return Promise.resolve(false)
      return vaultService.recover(code)
    },
    [vaultService],
  )

  const lock = useCallback((): void => {
    vaultService?.lock()
  }, [vaultService])

  const logout = useCallback(async (): Promise<void> => {
    // Lock vault first (clears in-memory key), then invalidate Google session.
    vaultService?.lock()
    await signOut({ callbackUrl: '/login' })
  }, [vaultService])

  return (
    <VaultContext.Provider value={{ state, setup, unlock, recover, lock, logout }}>
      {children}
    </VaultContext.Provider>
  )
}

// ── useVaultContext ───────────────────────────────────────────────────────────

export function useVaultContext(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVaultContext must be used inside VaultProvider')
  return ctx
}

// ── AppGate ───────────────────────────────────────────────────────────────────

const VAULT_PATHS = new Set(['/setup', '/unlock'])
const AUTH_PATHS  = new Set(['/login'])

export function AppGate({ children }: { children: ReactNode }): ReactNode {
  const { data: session, status: authStatus } = useSession()
  const { state: vaultState }                 = useVaultContext()
  const router                                = useRouter()
  const pathname                              = usePathname()

  const isVaultPage = VAULT_PATHS.has(pathname)
  const isAuthPage  = AUTH_PATHS.has(pathname)

  useEffect(() => {
    // Still loading session — wait.
    if (authStatus === 'loading') return

    // Not logged in with Google → go to login (unless already there).
    if (!session && !isAuthPage) {
      router.replace('/login')
      return
    }

    // Logged in. Check vault state (skip on vault-setup pages to avoid loops).
    if (session && !isVaultPage && !isAuthPage) {
      if (vaultState.status === 'uninitialized') router.replace('/setup')
      else if (vaultState.status === 'locked')   router.replace('/unlock')
    }
  }, [authStatus, session, vaultState.status, router, isVaultPage, isAuthPage])

  // Show nothing while session is loading.
  if (authStatus === 'loading') return null

  // Always render auth pages and vault pages.
  if (isAuthPage || isVaultPage) return <>{children}</>

  // Render app only when fully authenticated + vault unlocked.
  if (session && vaultState.status === 'unlocked') return <>{children}</>

  return null
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd prototypes/ui-shell && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add prototypes/ui-shell/lib/vault/vault-context.tsx
git commit -m "feat(auth): VaultProvider reads session for userId, AppGate adds Google auth check"
```

---

## Task 8: Create /login page

**Files:**
- Create: `prototypes/ui-shell/app/login/page.tsx`

The login page matches the existing glassmorphism card style from `/setup` and `/unlock`.

- [ ] **Step 1: Create login page**

Create `prototypes/ui-shell/app/login/page.tsx`:

```tsx
'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router                    = useRouter()

  // If already authenticated, redirect to home.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  const containerStyle: React.CSSProperties = {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '2rem',
    background:     'linear-gradient(135deg, var(--gradient-start, #581c87), var(--gradient-end, #be123c))',
    color:          'var(--text-primary, #ffffff)',
    fontFamily:     'system-ui, sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    background:     'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(8px)',
    borderRadius:   '1rem',
    border:         '1px solid rgba(255,255,255,0.20)',
    padding:        '2rem',
    width:          '100%',
    maxWidth:       '420px',
    display:        'flex',
    flexDirection:  'column',
    gap:            '1.5rem',
    alignItems:     'center',
  }

  const btnStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.75rem',
    padding:        '0.75rem 1.5rem',
    borderRadius:   '0.5rem',
    border:         'none',
    background:     'var(--btn-surface, rgba(255,255,255,0.90))',
    color:          'var(--btn-label, #1a1a1a)',
    fontWeight:     700,
    fontSize:       '1rem',
    cursor:         'pointer',
    width:          '100%',
    justifyContent: 'center',
    transition:     'opacity 150ms ease',
  }

  if (status === 'loading') return null

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>agenda</h1>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
          Accedi per aprire il tuo vault personale
        </p>
        <button
          style={btnStyle}
          onClick={() => signIn('google', { callbackUrl: '/' })}
          data-testid="google-signin-btn"
        >
          {/* Google "G" logo */}
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.1 29.5 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/>
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.4 19.1 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#FBBC05" d="M24 44c5.4 0 10.3-1.8 14-4.9l-6.5-5.4C29.5 35.5 26.9 36 24 36c-5.4 0-10-3.4-11.6-8.1l-7 5.4C8.9 39.9 15.9 44 24 44z"/>
            <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.9 2.5-2.6 4.6-4.9 5.9l6.5 5.4C41.2 36.3 44.5 30.7 44.5 24c0-1.3-.1-2.7-.2-4z"/>
          </svg>
          Accedi con Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd ../..
git add prototypes/ui-shell/app/login/page.tsx
git commit -m "feat(auth): add /login page with Google sign-in button"
```

---

## Task 9: Logout in vault context — expose via AppShell

The spec requires: lock vault → then sign out. `logout()` is already defined in `VaultContextValue` (Task 7). This task wires a logout action to the existing UI.

**Files:**
- Modify: `prototypes/ui-shell/components/AppShell.tsx`

- [ ] **Step 1: Add logout button to AppShell**

The RadialMenu is the main navigation. Add a small logout button in the AppShell, visible when the menu is open:

```tsx
// At the top of AppShell.tsx, add:
import { useVaultContext } from '@/lib/vault/vault-context'

// Inside the AppShell function, before the return:
const { logout } = useVaultContext()

// In the JSX, after <RadialMenu .../>:
{view !== 'WELCOME' && (
  <button
    onClick={logout}
    style={{
      position:   'fixed',
      bottom:     '1.5rem',
      right:      '1.5rem',
      background: 'rgba(255,255,255,0.12)',
      border:     '1px solid rgba(255,255,255,0.25)',
      borderRadius: '0.5rem',
      color:      'rgba(255,255,255,0.75)',
      fontSize:   '0.8rem',
      padding:    '0.4rem 0.75rem',
      cursor:     'pointer',
    }}
    aria-label="Esci"
  >
    Esci
  </button>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd prototypes/ui-shell && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add prototypes/ui-shell/components/AppShell.tsx
git commit -m "feat(auth): add logout button to AppShell"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd prototypes/ui-shell && pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Build check**

```bash
cd prototypes/ui-shell && pnpm build
```

Expected: build completes. Any missing env vars (`GOOGLE_CLIENT_ID` etc.) will produce a warning, not a build error — that's expected for local dev without real credentials.

- [ ] **Step 3: Manual smoke test** (requires real Google credentials in .env.local)

1. `pnpm dev` → open `http://localhost:3000`
2. → Should redirect to `/login`
3. Click "Accedi con Google" → Google OAuth flow → redirected back to `/`
4. → Should redirect to `/setup` (vault uninitialized)
5. Create PIN → should land at `/`
6. Lock vault (wait 30 min or close tab) → should redirect to `/unlock`
7. Unlock with PIN → land at `/`
8. Click "Esci" → vault locked, redirected to `/login`
9. Sign in again → vault shows "locked" (not "uninitialized") → redirect to `/unlock`
10. Open in second Google account (incognito) → different vault (independent localStorage namespace)
