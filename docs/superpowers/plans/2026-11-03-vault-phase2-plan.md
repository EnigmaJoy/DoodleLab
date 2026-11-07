# Client Vault (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cifra tutti i dati in localStorage con AES-256-GCM + Argon2id, aggiungendo PIN setup/unlock e recovery code.

**Architecture:** Two-level key architecture — PIN derives a key via Argon2id that encrypts the master key; the master key encrypts all data. VaultStorageAdapter maintains an in-memory plaintext cache to keep StorageAdapter sync, persisting asynchronously via AsyncQueue. VaultProvider + AppGate gate the app behind PIN entry.

**Tech Stack:** `argon2-browser` (WASM), Web Crypto API (AES-256-GCM), Next.js App Router (Client Components), vitest/jsdom.

**Working directory:** `prototypes/ui-shell/` — all file paths, npm commands, and test runs are relative to this directory.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `lib/vault/vault-crypto.ts` | AES-256-GCM encrypt/decrypt, base64url helpers |
| Create | `lib/vault/vault-crypto.test.ts` | Round-trip, tamper detection |
| Create | `lib/vault/argon2-adapter.ts` | Argon2id WASM wrapper → CryptoKey |
| Create | `lib/vault/argon2-adapter.test.ts` | WASM tests (skipIf no WebAssembly) |
| Create | `lib/vault/vault-storage-adapter.ts` | StorageAdapter with in-memory cache + AsyncQueue |
| Create | `lib/vault/vault-storage-adapter.test.ts` | Cache sync, persist, round-trip, destroy |
| Modify | `lib/store.ts` | Add `registerReset`, `resetAllRepositories`, `setStorageAdapter`, `getStorageAdapter` |
| Create | `lib/vault/vault-service.ts` | VaultService lifecycle, migration Phase 1→2, auto-lock |
| Create | `lib/vault/vault-service.test.ts` | Setup/unlock/lock/recover state machine (argon2 mocked) |
| Modify | `lib/calendar-repository.ts` | Factory: call `registerReset`, use `getStorageAdapter()` |
| Modify | `lib/oggi/daily-repository.ts` | Same factory pattern |
| Modify | `lib/journal/journal-repository.ts` | Same factory pattern |
| Modify | `lib/inbox/inbox-repository.ts` | Same factory pattern |
| Create | `lib/vault/vault-context.tsx` | VaultProvider + AppGate + useVaultContext |
| Modify | `lib/note-context.tsx` | Accept optional `StorageAdapter` prop, replace direct localStorage calls |
| Create | `app/setup/page.tsx` | Two-step vault setup UI |
| Create | `app/unlock/page.tsx` | PIN unlock + recovery section UI |
| Modify | `app/layout.tsx` | Wrap body with VaultProvider |

---

## Task 1: Install argon2-browser

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd prototypes/ui-shell && npm install argon2-browser
```

Expected output: `added 1 package` (argon2-browser includes its WASM bundle).

- [ ] **Step 2: Verify it was added**

Check `package.json` — `argon2-browser` should appear in `dependencies`.

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass (same count as before).

- [ ] **Step 4: Commit**

```bash
git add prototypes/ui-shell/package.json prototypes/ui-shell/package-lock.json
git commit -m "feat(vault): add argon2-browser dependency"
```

---

## Task 2: vault-crypto.ts

**Files:**
- Create: `lib/vault/vault-crypto.ts`
- Create: `lib/vault/vault-crypto.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/vault/vault-crypto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './vault-crypto'

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

describe('vault-crypto', () => {
  it('encrypt then decrypt returns the original plaintext', async () => {
    const key = await makeKey()
    const plaintext = 'hello vault — unicode: àèì'
    const ct = await encrypt(key, plaintext)
    expect(await decrypt(key, ct)).toBe(plaintext)
  })

  it('iv and ciphertext are base64url strings', async () => {
    const key = await makeKey()
    const ct = await encrypt(key, 'data')
    expect(ct.iv).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(ct.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('each encrypt call produces a different IV', async () => {
    const key = await makeKey()
    const ct1 = await encrypt(key, 'same')
    const ct2 = await encrypt(key, 'same')
    expect(ct1.iv).not.toBe(ct2.iv)
  })

  it('decrypt with tampered IV throws', async () => {
    const key = await makeKey()
    const ct = await encrypt(key, 'data')
    const badIv = ct.iv.slice(0, -4) + (ct.iv.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    await expect(decrypt(key, { ...ct, iv: badIv })).rejects.toThrow()
  })

  it('decrypt with tampered ciphertext throws', async () => {
    const key = await makeKey()
    const ct = await encrypt(key, 'data')
    // Flip the last character
    const last = ct.ciphertext.charCodeAt(ct.ciphertext.length - 1)
    const flipped = String.fromCharCode(last === 65 ? 66 : 65)  // A↔B
    const badCt = ct.ciphertext.slice(0, -1) + flipped
    await expect(decrypt(key, { ...ct, ciphertext: badCt })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/vault-crypto.test.ts
```

Expected: FAIL — `Cannot find module './vault-crypto'`

- [ ] **Step 3: Implement vault-crypto.ts**

Create `lib/vault/vault-crypto.ts`:

```ts
export interface VaultCiphertext {
  iv:         string   // base64url, 12 byte
  ciphertext: string   // base64url, AES-256-GCM output + 16-byte auth tag
}

function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function fromBase64url(str: string): Uint8Array {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<VaultCiphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  )
  return {
    iv:         toBase64url(iv.buffer),
    ciphertext: toBase64url(ciphertextBuf),
  }
}

export async function decrypt(
  key: CryptoKey,
  data: VaultCiphertext,
): Promise<string> {
  const iv = fromBase64url(data.iv)
  const ciphertext = fromBase64url(data.ciphertext)
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(plainBuf)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/vault-crypto.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add prototypes/ui-shell/lib/vault/vault-crypto.ts prototypes/ui-shell/lib/vault/vault-crypto.test.ts
git commit -m "feat(vault): AES-256-GCM encrypt/decrypt with base64url encoding"
```

---

## Task 3: argon2-adapter.ts

**Files:**
- Create: `lib/vault/argon2-adapter.ts`
- Create: `lib/vault/argon2-adapter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/vault/argon2-adapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveKey } from './argon2-adapter'

const salt = new Uint8Array(16).fill(1)

describe('argon2-adapter', () => {
  it.skipIf(!globalThis.WebAssembly)(
    'returns a non-extractable AES-GCM CryptoKey',
    async () => {
      const key = await deriveKey('test-password', salt)
      expect(key.type).toBe('secret')
      expect(key.algorithm.name).toBe('AES-GCM')
      expect(key.extractable).toBe(false)
    },
  )

  it.skipIf(!globalThis.WebAssembly)(
    'same password + salt produce equivalent keys (encrypt/decrypt round-trip)',
    async () => {
      const key1 = await deriveKey('my-pin', salt)
      const key2 = await deriveKey('my-pin', salt)
      const iv = new Uint8Array(12)
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        new TextEncoder().encode('hello'),
      )
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ct)
      expect(new TextDecoder().decode(pt)).toBe('hello')
    },
  )

  it.skipIf(!globalThis.WebAssembly)(
    'different passwords produce different keys',
    async () => {
      const key1 = await deriveKey('pin-a', salt)
      const key2 = await deriveKey('pin-b', salt)
      const iv = new Uint8Array(12)
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        new TextEncoder().encode('data'),
      )
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ct),
      ).rejects.toThrow()
    },
  )
})
```

- [ ] **Step 2: Run tests to verify they fail (or skip if no WASM)**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/argon2-adapter.test.ts
```

Expected: FAIL — `Cannot find module './argon2-adapter'`. (If jsdom has no WebAssembly all 3 tests skip — that is also acceptable.)

- [ ] **Step 3: Implement argon2-adapter.ts**

Create `lib/vault/argon2-adapter.ts`:

```ts
import argon2 from 'argon2-browser'

export interface Argon2Params {
  memory:      number   // KB, default 65536 (64 MB)
  iterations:  number   // default 3
  parallelism: number   // default 1
  hashLength:  number   // default 32 bytes
}

const DEFAULTS: Argon2Params = {
  memory:      65536,
  iterations:  3,
  parallelism: 1,
  hashLength:  32,
}

/**
 * Derives a non-extractable AES-256-GCM CryptoKey from a password and salt
 * using Argon2id (OWASP 2023 parameters by default).
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  params?: Partial<Argon2Params>,
): Promise<CryptoKey> {
  const p = { ...DEFAULTS, ...params }
  const result = await argon2.hash({
    pass:        password,
    salt:        salt,
    type:        argon2.ArgonType.Argon2id,
    mem:         p.memory,
    time:        p.iterations,
    parallelism: p.parallelism,
    hashLen:     p.hashLength,
  })
  return crypto.subtle.importKey(
    'raw',
    result.hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/argon2-adapter.test.ts
```

Expected: all 3 pass (or all 3 skip if WASM unavailable in jsdom — both outcomes are correct).

- [ ] **Step 5: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add prototypes/ui-shell/lib/vault/argon2-adapter.ts prototypes/ui-shell/lib/vault/argon2-adapter.test.ts
git commit -m "feat(vault): Argon2id WASM wrapper deriveKey → AES-GCM CryptoKey"
```

---

## Task 4: vault-storage-adapter.ts

**Files:**
- Create: `lib/vault/vault-storage-adapter.ts`
- Create: `lib/vault/vault-storage-adapter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/vault/vault-storage-adapter.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { VaultStorageAdapter } from './vault-storage-adapter'
import { LocalStorageAdapter } from '../storage/local-storage-adapter'

// Derive a test key via PBKDF2 (no Argon2 WASM needed)
async function makeKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.deriveBits(
    {
      name:       'PBKDF2',
      hash:       'SHA-256',
      salt:       new TextEncoder().encode('test-salt'),
      iterations: 1,
    },
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('test-password'),
      'PBKDF2',
      false,
      ['deriveBits'],
    ),
    256,
  )
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

const LOGICAL_KEYS = ['doodlelab:daily:v1', 'doodlelab:board:v2']

beforeEach(() => { localStorage.clear() })

describe('VaultStorageAdapter', () => {
  it('read() returns null for a missing key', async () => {
    const key = await makeKey()
    const adapter = await VaultStorageAdapter.create(key, new LocalStorageAdapter(), LOGICAL_KEYS)
    expect(adapter.read('doodlelab:daily:v1')).toBeNull()
  })

  it('write() updates cache synchronously — read() reflects it immediately', async () => {
    const key = await makeKey()
    const adapter = await VaultStorageAdapter.create(key, new LocalStorageAdapter(), LOGICAL_KEYS)
    adapter.write('doodlelab:daily:v1', '{"tasks":[]}')
    expect(adapter.read('doodlelab:daily:v1')).toBe('{"tasks":[]}')
  })

  it('write() persists encrypted ciphertext to localStorage after flush', async () => {
    const inner = new LocalStorageAdapter()
    const key = await makeKey()
    const adapter = await VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)
    adapter.write('doodlelab:daily:v1', '{"tasks":[]}')
    await adapter.destroy()
    // Vault key (not logical key) must exist and not be plaintext
    const stored = inner.read('doodlelab:vault:daily:v1')
    expect(stored).not.toBeNull()
    expect(stored).not.toContain('tasks')  // must be ciphertext
  })

  it('board:v2 logical key is persisted under vault:board:v3', async () => {
    const inner = new LocalStorageAdapter()
    const key = await makeKey()
    const adapter = await VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)
    adapter.write('doodlelab:board:v2', '{"notes":[]}')
    await adapter.destroy()
    expect(inner.read('doodlelab:vault:board:v3')).not.toBeNull()
    expect(inner.read('doodlelab:board:v2')).toBeNull()   // logical key must NOT be written plaintext
  })

  it('create() decrypts and loads existing vault data', async () => {
    const inner = new LocalStorageAdapter()
    const key = await makeKey()
    // Write with first adapter
    const a1 = await VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)
    a1.write('doodlelab:daily:v1', '{"tasks":["x"]}')
    await a1.destroy()
    // Load with second adapter
    const a2 = await VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)
    expect(a2.read('doodlelab:daily:v1')).toBe('{"tasks":["x"]}')
  })

  it('destroy() drains the queue then clears the cache', async () => {
    const key = await makeKey()
    const adapter = await VaultStorageAdapter.create(key, new LocalStorageAdapter(), LOGICAL_KEYS)
    adapter.write('doodlelab:daily:v1', 'some data')
    await adapter.destroy()
    expect(adapter.read('doodlelab:daily:v1')).toBeNull()
  })

  it('remove() deletes from cache synchronously and from localStorage after flush', async () => {
    const inner = new LocalStorageAdapter()
    const key = await makeKey()
    const adapter = await VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)
    adapter.write('doodlelab:daily:v1', 'data')
    await adapter.destroy()
    // Re-create and remove
    const a2 = await VaultStorageAdapter.create(key, inner, LOGICAL_KEYS)
    a2.remove('doodlelab:daily:v1')
    expect(a2.read('doodlelab:daily:v1')).toBeNull()  // cache cleared sync
    await a2.destroy()
    expect(inner.read('doodlelab:vault:daily:v1')).toBeNull()  // storage removed
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/vault-storage-adapter.test.ts
```

Expected: FAIL — `Cannot find module './vault-storage-adapter'`

- [ ] **Step 3: Implement vault-storage-adapter.ts**

Create `lib/vault/vault-storage-adapter.ts`:

```ts
import type { StorageAdapter } from '../storage/storage-adapter'
import type { LocalStorageAdapter } from '../storage/local-storage-adapter'
import { encrypt, decrypt } from './vault-crypto'

// Maps logical keys (used by repositories) to encrypted vault keys (in localStorage)
const VAULT_KEY_MAP: Record<string, string> = {
  'doodlelab:calendar:v1': 'doodlelab:vault:calendar:v1',
  'doodlelab:daily:v1':    'doodlelab:vault:daily:v1',
  'doodlelab:journal:v1':  'doodlelab:vault:journal:v1',
  'doodlelab:inbox:v1':    'doodlelab:vault:inbox:v1',
  'doodlelab:board:v2':    'doodlelab:vault:board:v3',
}

// ── AsyncQueue ───────────────────────────────────────────────────────────────
// FIFO queue that runs async tasks one at a time, preventing concurrent writes
// to the same localStorage key.

class AsyncQueue {
  private queue:   Array<() => Promise<void>> = []
  private running = false

  enqueue(task: () => Promise<void>): void {
    this.queue.push(task)
    if (!this.running) void this.drain()
  }

  private async drain(): Promise<void> {
    this.running = true
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      try { await task() } catch { /* swallow individual write errors */ }
    }
    this.running = false
  }

  /** Resolves after all currently-enqueued tasks complete. */
  flush(): Promise<void> {
    return new Promise(resolve => {
      this.enqueue(async () => { resolve() })
    })
  }
}

// ── VaultStorageAdapter ──────────────────────────────────────────────────────

export class VaultStorageAdapter implements StorageAdapter {
  private readonly cache:      Map<string, string>
  private readonly key:        CryptoKey
  private readonly inner:      LocalStorageAdapter
  private readonly writeQueue: AsyncQueue

  private constructor(
    key:   CryptoKey,
    inner: LocalStorageAdapter,
    cache: Map<string, string>,
  ) {
    this.key        = key
    this.inner      = inner
    this.cache      = cache
    this.writeQueue = new AsyncQueue()
  }

  /**
   * Async factory. For each logical key, reads the corresponding vault key
   * from localStorage, decrypts it, and populates the in-memory cache.
   * If a vault entry is absent or decryption fails, that cache entry is omitted
   * (repository sees first-run state).
   */
  static async create(
    key:         CryptoKey,
    inner:       LocalStorageAdapter,
    logicalKeys: string[],
  ): Promise<VaultStorageAdapter> {
    const cache = new Map<string, string>()
    for (const logicalKey of logicalKeys) {
      const vaultKey = VAULT_KEY_MAP[logicalKey] ?? logicalKey
      const raw = inner.read(vaultKey)
      if (raw !== null) {
        try {
          const ct = JSON.parse(raw) as { iv: string; ciphertext: string }
          const plaintext = await decrypt(key, ct)
          cache.set(logicalKey, plaintext)
        } catch {
          // Corrupt or tampered data — silently skip
        }
      }
    }
    return new VaultStorageAdapter(key, inner, cache)
  }

  // ── StorageAdapter interface ───────────────────────────────────────────────

  read(key: string): string | null {
    return this.cache.get(key) ?? null
  }

  write(key: string, value: string): void {
    this.cache.set(key, value)
    const vaultKey = VAULT_KEY_MAP[key] ?? key
    this.writeQueue.enqueue(async () => {
      const ct = await encrypt(this.key, value)
      this.inner.write(vaultKey, JSON.stringify(ct))
    })
  }

  remove(key: string): void {
    this.cache.delete(key)
    const vaultKey = VAULT_KEY_MAP[key] ?? key
    this.writeQueue.enqueue(async () => {
      this.inner.remove(vaultKey)
    })
  }

  /**
   * Drains all pending writes then clears the cache. Called by VaultService.lock().
   */
  async destroy(): Promise<void> {
    await this.writeQueue.flush()
    this.cache.clear()
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/vault-storage-adapter.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add prototypes/ui-shell/lib/vault/vault-storage-adapter.ts prototypes/ui-shell/lib/vault/vault-storage-adapter.test.ts
git commit -m "feat(vault): VaultStorageAdapter with in-memory cache and AsyncQueue"
```

---

## Task 5: store.ts extensions + repository factory updates

Extend `lib/store.ts` with the reset registry and storage adapter registry. Update the four repository factories to register themselves and use `getStorageAdapter()` instead of `new LocalStorageAdapter()`.

**Files:**
- Modify: `lib/store.ts`
- Modify: `lib/calendar-repository.ts`
- Modify: `lib/oggi/daily-repository.ts`
- Modify: `lib/journal/journal-repository.ts`
- Modify: `lib/inbox/inbox-repository.ts`

- [ ] **Step 1: Extend lib/store.ts**

Add these exports at the end of `lib/store.ts`:

```ts
import type { StorageAdapter } from './storage/storage-adapter'
import { LocalStorageAdapter } from './storage/local-storage-adapter'

// ── Storage adapter registry ─────────────────────────────────────────────────
// VaultService calls setStorageAdapter(vaultAdapter) after unlock and
// setStorageAdapter(null) before lock. Repositories call getStorageAdapter()
// in their factory functions when creating a new instance.

let _adapter: StorageAdapter | null = null
const _fallback = new LocalStorageAdapter()

export function setStorageAdapter(adapter: StorageAdapter | null): void {
  _adapter = adapter
}

export function getStorageAdapter(): StorageAdapter {
  return _adapter ?? _fallback
}

// ── Repository reset registry ─────────────────────────────────────────────────
// Each repository factory calls registerReset() once to register a callback
// that nulls its singleton. VaultService calls resetAllRepositories() on lock
// and after unlock so repositories reinitialize with the current adapter.

const _resetCallbacks: Array<() => void> = []

export function registerReset(fn: () => void): void {
  _resetCallbacks.push(fn)
}

export function resetAllRepositories(): void {
  for (const fn of _resetCallbacks) fn()
}
```

- [ ] **Step 2: Update lib/calendar-repository.ts factory**

Find the factory and the `let instance` declaration near the bottom of `lib/calendar-repository.ts`. Replace them with:

```ts
import { ChangeNotifier, createId, registerReset, getStorageAdapter } from './store'
```

Replace the existing import from `'./store'` so it includes `registerReset` and `getStorageAdapter`.

Then replace the factory block:

```ts
let instance: LocalCalendarRepository | null = null

registerReset(() => { instance = null })

export function getCalendarRepository(): CalendarRepository {
  if (!instance) {
    instance = new LocalCalendarRepository(getStorageAdapter())
  }
  return instance
}
```

Remove the now-unused `import { LocalStorageAdapter } from './storage/local-storage-adapter'` line if it was only used in the factory.

- [ ] **Step 3: Update lib/oggi/daily-repository.ts factory**

In `lib/oggi/daily-repository.ts`, update the import from `'../store'` to include `registerReset` and `getStorageAdapter`. Remove the import of `LocalStorageAdapter` if used only in the factory.

Replace the factory block at the bottom:

```ts
let dailyInstance: LocalDailyRepository | null = null

registerReset(() => { dailyInstance = null })

export function getDailyRepository(options?: DailyRepositoryOptions): DailyRepository {
  if (!dailyInstance) {
    dailyInstance = new LocalDailyRepository({ storage: getStorageAdapter(), ...options })
  }
  return dailyInstance
}
```

- [ ] **Step 4: Update lib/journal/journal-repository.ts factory**

Same pattern. Import `registerReset` and `getStorageAdapter` from `'../store'`. Replace factory:

```ts
let journalInstance: LocalJournalRepository | null = null

registerReset(() => { journalInstance = null })

export function getJournalRepository(): JournalRepository {
  if (!journalInstance) {
    journalInstance = new LocalJournalRepository(getStorageAdapter())
  }
  return journalInstance
}
```

- [ ] **Step 5: Update lib/inbox/inbox-repository.ts factory**

Same pattern. Import `registerReset` and `getStorageAdapter` from `'../store'`. Replace factory:

```ts
let inboxInstance: LocalInboxRepository | null = null

registerReset(() => { inboxInstance = null })

export function getInboxRepository(): InboxRepository {
  if (!inboxInstance) {
    inboxInstance = new LocalInboxRepository(getStorageAdapter())
  }
  return inboxInstance
}
```

- [ ] **Step 6: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass. The factories still work with the fallback `LocalStorageAdapter` when no vault adapter is set.

- [ ] **Step 7: Commit**

```bash
git add prototypes/ui-shell/lib/store.ts \
        prototypes/ui-shell/lib/calendar-repository.ts \
        prototypes/ui-shell/lib/oggi/daily-repository.ts \
        prototypes/ui-shell/lib/journal/journal-repository.ts \
        prototypes/ui-shell/lib/inbox/inbox-repository.ts
git commit -m "feat(vault): storage adapter registry and repository reset callbacks in store.ts"
```

---

## Task 6: vault-service.ts

**Files:**
- Create: `lib/vault/vault-service.ts`
- Create: `lib/vault/vault-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/vault/vault-service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock argon2-adapter BEFORE importing vault-service (vi.mock is hoisted)
vi.mock('@/lib/vault/argon2-adapter', () => ({
  deriveKey: async (password: string, salt: Uint8Array) => {
    // Deterministic stand-in: SHA-256(password + salt bytes) → AES-GCM key
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

function makeMasterKeyHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

beforeEach(() => {
  localStorage.clear()
})

describe('VaultService', () => {
  it('state is "uninitialized" on first run (no vault meta)', () => {
    const svc = new VaultService()
    expect(svc.getState().status).toBe('uninitialized')
  })

  it('state is "locked" when vault meta exists', () => {
    localStorage.setItem(
      'doodlelab:vault:meta:v1',
      JSON.stringify({
        encryptedMasterKey: { iv: 'a', ciphertext: 'b' },
        salt:               btoa('saltsalt'),
        createdAt:          '2026-01-01T00:00:00.000Z',
      }),
    )
    const svc = new VaultService()
    expect(svc.getState().status).toBe('locked')
  })

  it('setup() transitions to "unlocked"', async () => {
    const svc = new VaultService()
    await svc.setup('my-pin-123', makeMasterKeyHex())
    expect(svc.getState().status).toBe('unlocked')
  })

  it('setup() then lock() then unlock() with correct PIN → "unlocked"', async () => {
    const masterKeyHex = makeMasterKeyHex()
    const svc = new VaultService()
    await svc.setup('my-pin-123', masterKeyHex)
    svc.lock()
    expect(svc.getState().status).toBe('locked')
    const ok = await svc.unlock('my-pin-123')
    expect(ok).toBe(true)
    expect(svc.getState().status).toBe('unlocked')
  })

  it('unlock() with wrong PIN returns false and stays "locked"', async () => {
    const svc = new VaultService()
    await svc.setup('my-pin-123', makeMasterKeyHex())
    svc.lock()
    const ok = await svc.unlock('wrong-pin')
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('locked')
  })

  it('lock() transitions to "locked"', async () => {
    const svc = new VaultService()
    await svc.setup('my-pin-123', makeMasterKeyHex())
    expect(svc.getState().status).toBe('unlocked')
    svc.lock()
    expect(svc.getState().status).toBe('locked')
  })

  it('recover() with valid 48-hex recovery code → "unlocked"', async () => {
    const masterKeyHex = makeMasterKeyHex()
    const svc = new VaultService()
    await svc.setup('my-pin-123', masterKeyHex)
    svc.lock()
    const ok = await svc.recover(masterKeyHex)
    expect(ok).toBe(true)
    expect(svc.getState().status).toBe('unlocked')
  })

  it('recover() with invalid code (non-hex) returns false', async () => {
    const svc = new VaultService()
    await svc.setup('my-pin-123', makeMasterKeyHex())
    svc.lock()
    const ok = await svc.recover('not-a-valid-recovery-code')
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('locked')
  })

  it('setup() migrates Phase 1 plaintext data to vault keys', async () => {
    // Plant Phase 1 data
    localStorage.setItem('doodlelab:daily:v1', '{"tasks":[]}')
    localStorage.setItem('doodlelab:journal:v1', '[]')
    const svc = new VaultService()
    await svc.setup('pin-123', makeMasterKeyHex())
    // Phase 1 keys must be deleted
    expect(localStorage.getItem('doodlelab:daily:v1')).toBeNull()
    expect(localStorage.getItem('doodlelab:journal:v1')).toBeNull()
    // Vault keys must exist
    expect(localStorage.getItem('doodlelab:vault:daily:v1')).not.toBeNull()
    expect(localStorage.getItem('doodlelab:vault:journal:v1')).not.toBeNull()
  })

  it('notify() is called on setup, lock, and unlock', async () => {
    const svc = new VaultService()
    const listener = vi.fn()
    svc.subscribe(listener)

    await svc.setup('pin-123', makeMasterKeyHex())
    expect(listener).toHaveBeenCalledTimes(1)

    svc.lock()
    expect(listener).toHaveBeenCalledTimes(2)

    await svc.unlock('pin-123')
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/vault-service.test.ts
```

Expected: FAIL — `Cannot find module './vault-service'`

- [ ] **Step 3: Implement vault-service.ts**

Create `lib/vault/vault-service.ts`:

```ts
import { ChangeNotifier, resetAllRepositories, setStorageAdapter } from '../store'
import { deriveKey } from './argon2-adapter'
import { encrypt, decrypt } from './vault-crypto'
import { VaultStorageAdapter } from './vault-storage-adapter'
import { LocalStorageAdapter } from '../storage/local-storage-adapter'

// ── Constants ────────────────────────────────────────────────────────────────

const META_KEY = 'doodlelab:vault:meta:v1'

// Logical keys that repositories use — VaultStorageAdapter maps these to vault keys
const VAULT_LOGICAL_KEYS = [
  'doodlelab:calendar:v1',
  'doodlelab:daily:v1',
  'doodlelab:journal:v1',
  'doodlelab:inbox:v1',
  'doodlelab:board:v2',
]

// Phase 1 key → Phase 2 vault key (used only for one-time migration in setup())
const PHASE1_MIGRATION_MAP: Record<string, string> = {
  'doodlelab:calendar:v1': 'doodlelab:vault:calendar:v1',
  'doodlelab:daily:v1':    'doodlelab:vault:daily:v1',
  'doodlelab:journal:v1':  'doodlelab:vault:journal:v1',
  'doodlelab:inbox:v1':    'doodlelab:vault:inbox:v1',
  'doodlelab:board:v2':    'doodlelab:vault:board:v3',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface VaultMeta {
  encryptedMasterKey: { iv: string; ciphertext: string }
  salt:               string   // base64, 16 bytes
  recoveryHint?:      string
  createdAt:          string
}

export type VaultState =
  | { status: 'uninitialized' }
  | { status: 'locked' }
  | { status: 'unlocked'; adapter: VaultStorageAdapter }

// ── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0))
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

async function importMasterKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(hex),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── VaultService ──────────────────────────────────────────────────────────────

export class VaultService extends ChangeNotifier {
  private _state: VaultState
  private readonly inner = new LocalStorageAdapter()

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null
  private readonly INACTIVITY_MS = 30 * 60 * 1000

  private readonly onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.hidden) this.lock()
  }

  private readonly onActivity = (): void => {
    this.resetInactivityTimer()
  }

  constructor() {
    super()
    const meta = this.inner.read(META_KEY)
    this._state = meta ? { status: 'locked' } : { status: 'uninitialized' }
  }

  getState(): VaultState {
    return this._state
  }

  /**
   * First-run setup. Receives a pre-generated masterKeyHex (shown to the user
   * as the recovery code). Derives a PIN key via Argon2id, encrypts the master
   * key with it, migrates Phase 1 plaintext data, and saves VaultMeta.
   */
  async setup(
    pin:          string,
    masterKeyHex: string,
    recoveryHint?: string,
  ): Promise<void> {
    const salt      = crypto.getRandomValues(new Uint8Array(16))
    const pinKey    = await deriveKey(pin, salt)
    const masterKey = await importMasterKey(masterKeyHex)

    const encryptedMasterKey = await encrypt(pinKey, masterKeyHex)

    // One-time migration: Phase 1 plaintext → encrypted vault keys
    for (const [phase1Key, vaultKey] of Object.entries(PHASE1_MIGRATION_MAP)) {
      const raw = this.inner.read(phase1Key)
      if (raw !== null) {
        const ct = await encrypt(masterKey, raw)
        this.inner.write(vaultKey, JSON.stringify(ct))
        this.inner.remove(phase1Key)
      }
    }

    const meta: VaultMeta = {
      encryptedMasterKey,
      salt:          toBase64(salt),
      recoveryHint,
      createdAt:     new Date().toISOString(),
    }
    this.inner.write(META_KEY, JSON.stringify(meta))

    await this.activateWithMasterKey(masterKey)
  }

  /**
   * Returns true on success. Returns false (without throwing) if the PIN is wrong.
   */
  async unlock(pin: string): Promise<boolean> {
    try {
      const metaRaw = this.inner.read(META_KEY)
      if (metaRaw === null) return false
      const meta = JSON.parse(metaRaw) as VaultMeta

      const salt      = fromBase64(meta.salt)
      const pinKey    = await deriveKey(pin, salt)
      const masterKeyHex = await decrypt(pinKey, meta.encryptedMasterKey)
      const masterKey = await importMasterKey(masterKeyHex)

      await this.activateWithMasterKey(masterKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * Uses the recovery code (= master key hex) directly to unlock.
   * Returns false if the code is not a valid 48-char hex string.
   */
  async recover(recoveryCode: string): Promise<boolean> {
    try {
      if (!/^[0-9a-fA-F]{48}$/.test(recoveryCode)) return false
      const masterKey = await importMasterKey(recoveryCode)
      await this.activateWithMasterKey(masterKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * Destroys the in-memory adapter (drains pending writes), clears the storage
   * adapter, resets all repository singletons.
   */
  lock(): void {
    if (this._state.status === 'unlocked') {
      void this._state.adapter.destroy()
    }
    this.removeAutoLockListeners()
    setStorageAdapter(null)
    resetAllRepositories()
    this._state = { status: 'locked' }
    this.notify()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async activateWithMasterKey(masterKey: CryptoKey): Promise<void> {
    const adapter = await VaultStorageAdapter.create(
      masterKey,
      this.inner,
      VAULT_LOGICAL_KEYS,
    )
    setStorageAdapter(adapter)
    resetAllRepositories()
    this._state = { status: 'unlocked', adapter }
    this.notify()
    this.startAutoLock()
  }

  private startAutoLock(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('pointermove', this.onActivity)
    window.addEventListener('keydown', this.onActivity)
    this.resetInactivityTimer()
  }

  private removeAutoLockListeners(): void {
    if (typeof document === 'undefined') return
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('pointermove', this.onActivity)
    window.removeEventListener('keydown', this.onActivity)
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer)
      this.inactivityTimer = null
    }
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer !== null) clearTimeout(this.inactivityTimer)
    this.inactivityTimer = setTimeout(() => this.lock(), this.INACTIVITY_MS)
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let vaultServiceInstance: VaultService | null = null

export function getVaultService(): VaultService {
  vaultServiceInstance ??= new VaultService()
  return vaultServiceInstance
}
```

- [ ] **Step 4: Run vault-service tests**

```bash
cd prototypes/ui-shell && npx vitest run lib/vault/vault-service.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add prototypes/ui-shell/lib/vault/vault-service.ts prototypes/ui-shell/lib/vault/vault-service.test.ts
git commit -m "feat(vault): VaultService setup/unlock/lock/recover with Phase 1 migration and auto-lock"
```

---

## Task 7: vault-context.tsx

**Files:**
- Create: `lib/vault/vault-context.tsx`

No unit tests for this file — it's a React context wrapper tested via integration through the UI.

- [ ] **Step 1: Create lib/vault/vault-context.tsx**

```tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { getVaultService, type VaultState } from './vault-service'

// ── Context shape ─────────────────────────────────────────────────────────────

export type VaultContextValue = {
  state:   VaultState
  setup:   (pin: string, masterKeyHex: string, hint?: string) => Promise<void>
  unlock:  (pin: string) => Promise<boolean>
  recover: (code: string) => Promise<boolean>
  lock:    () => void
}

const VaultContext = createContext<VaultContextValue | null>(null)

// ── AppGate ───────────────────────────────────────────────────────────────────
// Rendered inside VaultProvider. Redirects to /setup or /unlock when the vault
// is not ready. Only renders children when state is 'unlocked'.

function AppGate({
  state,
  children,
}: {
  state:    VaultState
  children: ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    if (state.status === 'uninitialized') router.replace('/setup')
    else if (state.status === 'locked')   router.replace('/unlock')
  }, [state.status, router])

  if (state.status !== 'unlocked') return null
  return <>{children}</>
}

// ── VaultProvider ─────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }): ReactNode {
  const service = getVaultService()

  const state = useSyncExternalStore(
    service.subscribe,
    service.getState.bind(service),
    service.getState.bind(service),
  )

  const setup   = useCallback(
    (pin: string, masterKeyHex: string, hint?: string) =>
      service.setup(pin, masterKeyHex, hint),
    [service],
  )
  const unlock  = useCallback((pin: string)  => service.unlock(pin),   [service])
  const recover = useCallback((code: string) => service.recover(code), [service])
  const lock    = useCallback(() => service.lock(), [service])

  return (
    <VaultContext.Provider value={{ state, setup, unlock, recover, lock }}>
      <AppGate state={state}>{children}</AppGate>
    </VaultContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVaultContext(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVaultContext must be used inside VaultProvider')
  return ctx
}
```

- [ ] **Step 2: Run full test suite (verify nothing broke)**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add prototypes/ui-shell/lib/vault/vault-context.tsx
git commit -m "feat(vault): VaultProvider, AppGate, and useVaultContext"
```

---

## Task 8: note-context.tsx refactor

Replace direct `localStorage` calls in `lib/note-context.tsx` with a `StorageAdapter` (optional prop, defaults to `getStorageAdapter()`).

**Files:**
- Modify: `lib/note-context.tsx`

- [ ] **Step 1: Update lib/note-context.tsx**

Replace the entire file with the following (changes: import StorageAdapter + getStorageAdapter, update `loadFromStorage` and `saveToStorage` to accept an adapter, update `NoteProvider` props and usage):

```tsx
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { Note, NoteAction, NoteState } from './note-types'
import { generateRotation } from './note-utils'
import type { StorageAdapter } from './storage/storage-adapter'
import { getStorageAdapter } from './store'

const STORAGE_KEY = 'doodlelab:board:v2'

function loadFromStorage(adapter: StorageAdapter): NoteState | null {
  try {
    const raw = adapter.read(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { notes?: unknown; mode?: unknown }
    if (!Array.isArray(parsed.notes)) return null
    const mode = parsed.mode === 'grid' ? 'grid' : 'free'
    return { notes: parsed.notes as Note[], mode }
  } catch {
    return null
  }
}

function saveToStorage(adapter: StorageAdapter, state: NoteState): void {
  try {
    adapter.write(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────────

export function noteReducer(state: NoteState, action: NoteAction): NoteState {
  switch (action.type) {
    case 'ADD_NOTE': {
      const now: string = new Date().toISOString()
      const note: Note = {
        id:        crypto.randomUUID(),
        content:   '',
        color:     'yellow',
        rotation:  generateRotation(),
        position:  { xPct: 0.35, yPct: 0.35 },
        stickers:  [],
        pinned:    false,
        createdAt: now,
        updatedAt: now,
        ...action.payload,
      }
      return { ...state, notes: [...state.notes, note] }
    }

    case 'UPDATE_NOTE': {
      const { id, ...fields } = action.payload
      const { position: _, ...safeFields } = fields as typeof fields & { position?: unknown }
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === id
            ? { ...n, ...safeFields, updatedAt: new Date().toISOString() }
            : n
        ),
      }
    }

    case 'MOVE_NOTE': {
      const { id, xPct, yPct } = action.payload
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === id ? { ...n, position: { xPct, yPct } } : n
        ),
      }
    }

    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(n => n.id !== action.payload.id),
      }

    case 'TOGGLE_PIN':
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === action.payload.id ? { ...n, pinned: !n.pinned } : n
        ),
      }

    case 'SET_VIEW':
      return { ...state, mode: action.payload.mode }

    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface NoteContextValue {
  state:    NoteState
  dispatch: Dispatch<NoteAction>
}

const NoteContext = createContext<NoteContextValue | null>(null)

export function NoteProvider({
  children,
  initialNotes = [],
  adapter,
}: {
  children:      ReactNode
  initialNotes?: Note[]
  adapter?:      StorageAdapter
}) {
  const resolvedAdapter = adapter ?? getStorageAdapter()
  const seed: NoteState = { notes: initialNotes, mode: 'free' }
  const [state, dispatch] = useReducer(
    noteReducer,
    seed,
    (s) => loadFromStorage(resolvedAdapter) ?? s,
  )

  useEffect(() => {
    saveToStorage(resolvedAdapter, state)
  }, [state, resolvedAdapter])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return (
    <NoteContext.Provider value={value}>
      {children}
    </NoteContext.Provider>
  )
}

export function useNoteContext(): NoteContextValue {
  const ctx = useContext(NoteContext)
  if (!ctx) throw new Error('useNoteContext must be used inside NoteProvider')
  return ctx
}

/** Returns a single note by id, or undefined (e.g. after refresh). */
export function useNote(id: string): Note | undefined {
  const { state } = useNoteContext()
  return state.notes.find(n => n.id === id)
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add prototypes/ui-shell/lib/note-context.tsx
git commit -m "feat(vault): note-context uses StorageAdapter instead of localStorage directly"
```

---

## Task 9: app/setup/page.tsx — VaultSetupScreen

**Files:**
- Create: `app/setup/page.tsx`

- [ ] **Step 1: Create app/setup/page.tsx**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useVaultContext } from '@/lib/vault/vault-context'

type Step = 1 | 2

function generateMasterKeyHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function VaultSetupPage() {
  const { setup } = useVaultContext()

  const [step,           setStep]          = useState<Step>(1)
  const [pin,            setPin]           = useState('')
  const [confirmPin,     setConfirmPin]    = useState('')
  const [email,          setEmail]         = useState('')
  const [pinError,       setPinError]      = useState<string | null>(null)
  const [masterKeyHex,   setMasterKeyHex]  = useState('')
  const [copied,         setCopied]        = useState(false)
  const [confirmed,      setConfirmed]     = useState(false)
  const [loading,        setLoading]       = useState(false)

  // Step 1 → Step 2: validate PIN and generate recovery code
  const handleContinue = () => {
    if (pin.length < 6) {
      setPinError('Il PIN deve avere almeno 6 caratteri.')
      return
    }
    if (pin !== confirmPin) {
      setPinError('I PIN non corrispondono.')
      return
    }
    setPinError(null)
    setMasterKeyHex(generateMasterKeyHex())
    setStep(2)
  }

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(masterKeyHex).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [masterKeyHex])

  const handleStart = async () => {
    if (!confirmed) return
    setLoading(true)
    try {
      await setup(pin, masterKeyHex, email || undefined)
      // AppGate will redirect to '/' once state becomes 'unlocked'
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    return (
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1>Crea il tuo vault</h1>
        <p>Scegli un PIN per proteggere i tuoi dati.</p>

        <label>
          PIN
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        <label style={{ marginTop: 12, display: 'block' }}>
          Conferma PIN
          <input
            type="password"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        <label style={{ marginTop: 12, display: 'block' }}>
          Email (opzionale — per recupero futuro)
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        {pinError && (
          <p style={{ color: 'red', marginTop: 8 }}>{pinError}</p>
        )}

        <button
          onClick={handleContinue}
          style={{ marginTop: 20, width: '100%' }}
        >
          Continua
        </button>
      </main>
    )
  }

  // Step 2: show recovery code
  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Salva il codice di recupero</h1>
      <p>
        Senza il PIN e senza questo codice, i tuoi dati sono irrecuperabili.
        Salvalo in un posto sicuro.
      </p>

      <div style={{
        fontFamily: 'monospace',
        fontSize: 14,
        wordBreak: 'break-all',
        background: '#f4f4f4',
        padding: 12,
        borderRadius: 6,
        marginTop: 16,
      }}>
        {masterKeyHex}
      </div>

      <button onClick={handleCopy} style={{ marginTop: 8 }}>
        {copied ? 'Copiato!' : 'Copia'}
      </button>

      <label style={{ marginTop: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
        />
        Ho salvato il codice di recupero
      </label>

      <button
        onClick={handleStart}
        disabled={!confirmed || loading}
        style={{ marginTop: 16, width: '100%' }}
      >
        {loading ? 'Creazione vault…' : 'Inizia'}
      </button>
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add prototypes/ui-shell/app/setup/page.tsx
git commit -m "feat(vault): VaultSetupScreen two-step UI (PIN + recovery code)"
```

---

## Task 10: app/unlock/page.tsx — UnlockScreen

**Files:**
- Create: `app/unlock/page.tsx`

- [ ] **Step 1: Create app/unlock/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useVaultContext } from '@/lib/vault/vault-context'

export default function UnlockPage() {
  const { unlock, recover } = useVaultContext()

  const [pin,           setPin]          = useState('')
  const [pinError,      setPinError]     = useState<string | null>(null)
  const [pinLoading,    setPinLoading]   = useState(false)

  const [showRecovery,  setShowRecovery] = useState(false)
  const [recoveryCode,  setRecoveryCode] = useState('')
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const handleUnlock = async () => {
    if (!pin) return
    setPinLoading(true)
    setPinError(null)
    try {
      const ok = await unlock(pin)
      if (!ok) setPinError('PIN non corretto.')
      // On success, AppGate redirects to '/'
    } finally {
      setPinLoading(false)
    }
  }

  const handleRecover = async () => {
    if (!recoveryCode) return
    setRecoveryLoading(true)
    setRecoveryError(null)
    try {
      const ok = await recover(recoveryCode.trim())
      if (!ok) setRecoveryError('Codice non valido.')
      // On success, AppGate redirects to '/'
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Sblocca il vault</h1>

      <label>
        PIN
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleUnlock() }}
          autoFocus
          autoComplete="current-password"
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>

      {pinError && (
        <p style={{ color: 'red', marginTop: 8 }}>{pinError}</p>
      )}

      <button
        onClick={handleUnlock}
        disabled={pinLoading || !pin}
        style={{ marginTop: 16, width: '100%' }}
      >
        {pinLoading ? 'Sblocco…' : 'Sblocca'}
      </button>

      <div style={{ marginTop: 32 }}>
        <button
          onClick={() => setShowRecovery(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
        >
          Ho dimenticato il PIN {showRecovery ? '▴' : '▾'}
        </button>

        {showRecovery && (
          <div style={{ marginTop: 12 }}>
            <label>
              Recovery code (48 caratteri)
              <input
                type="text"
                value={recoveryCode}
                onChange={e => setRecoveryCode(e.target.value)}
                maxLength={48}
                autoComplete="off"
                style={{ display: 'block', width: '100%', marginTop: 4, fontFamily: 'monospace' }}
              />
            </label>

            {recoveryError && (
              <p style={{ color: 'red', marginTop: 8 }}>{recoveryError}</p>
            )}

            <button
              onClick={handleRecover}
              disabled={recoveryLoading || !recoveryCode}
              style={{ marginTop: 12, width: '100%' }}
            >
              {recoveryLoading ? 'Recupero…' : 'Recupera accesso'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add prototypes/ui-shell/app/unlock/page.tsx
git commit -m "feat(vault): UnlockScreen with PIN field and collapsible recovery section"
```

---

## Task 11: Integrate VaultProvider in app/layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add VaultProvider to app/layout.tsx**

Add the import and wrap `{children}` with `VaultProvider`. The current `body` content is:

```tsx
<body>
  {children}
  {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
    <PaletteSwitcher />
  )}
</body>
```

Replace with:

```tsx
import { VaultProvider } from '@/lib/vault/vault-context'

// ... (inside the body)
<body>
  <VaultProvider>
    {children}
  </VaultProvider>
  {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
    <PaletteSwitcher />
  )}
</body>
```

The full updated `app/layout.tsx`:

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Caveat, Sacramento, Kalam } from 'next/font/google'
import { PaletteSwitcher } from '@/dev/PaletteSwitcher'
import { VaultProvider } from '@/lib/vault/vault-context'
import { PALETTE_COUNT } from '@/lib/palettes'
import './globals.css'

const sacramento = Sacramento({
  subsets:  ['latin'],
  weight:   ['400'],
  variable: '--font-welcome',
  display:  'swap',
})

const kalam = Kalam({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  variable: '--font-postit',
  display:  'swap',
})

const caveat = Caveat({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  variable: '--font-caveat',
  display:  'swap',
})

export const metadata: Metadata = {
  title: 'agenda',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const paletteId = String(Math.floor(Math.random() * PALETTE_COUNT) + 1)

  return (
    <html lang="it" data-palette={paletteId} className={`${sacramento.variable} ${kalam.variable} ${caveat.variable}`}>
      <body>
        <VaultProvider>
          {children}
        </VaultProvider>
        {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
          <PaletteSwitcher />
        )}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd prototypes/ui-shell && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run TypeScript check**

```bash
cd prototypes/ui-shell && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prototypes/ui-shell/app/layout.tsx
git commit -m "feat(vault): integrate VaultProvider and AppGate in root layout"
```

---

## Self-Review Checklist

Before starting execution, verify plan coverage against the spec (`docs/superpowers/specs/2026-11-03-vault-phase2-design.md`):

| Spec requirement | Task |
|-----------------|------|
| `argon2-browser` dependency | Task 1 |
| `vault-crypto.ts` + tests (round-trip, tamper IV, tamper ct) | Task 2 |
| `argon2-adapter.ts` + WASM tests (skipIf) | Task 3 |
| `VaultStorageAdapter` with AsyncQueue + key mapping | Task 4 |
| `VaultMeta` + `VaultState` types | Task 6 |
| `VaultService.setup()` with Phase 1 migration | Task 6 |
| `VaultService.unlock()` | Task 6 |
| `VaultService.lock()` + `resetAllRepositories()` | Task 6 |
| `VaultService.recover()` | Task 6 |
| Auto-lock (visibilitychange + inactivity 30 min) | Task 6 |
| `registerReset` + `setStorageAdapter` in store.ts | Task 5 |
| Repository factories use `getStorageAdapter()` | Task 5 |
| `VaultProvider` + `AppGate` + `useVaultContext` | Task 7 |
| `note-context.tsx` refactor | Task 8 |
| `VaultSetupScreen` two-step (PIN + recovery code) | Task 9 |
| `UnlockScreen` (PIN + collapsible recovery) | Task 10 |
| `VaultProvider` in `app/layout.tsx` | Task 11 |
| Recovery code = 48 hex chars = master key | Tasks 6, 9 |
| `CryptoKey` non-extractable | Tasks 3, 6 |
| Two-level key architecture | Task 6 |
