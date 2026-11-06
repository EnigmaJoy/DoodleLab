// argon2-bundled.min.js has the WASM binary embedded as a base64 data URI —
// no separate WASM fetch, no require('fs'), safe to bundle with Next.js / Turbopack.
// The import is deferred inside deriveKey() so the heavy WASM initialization
// only happens when the user actually enters their PIN, never during SSR or build.
import type Argon2Browser from 'argon2-browser'

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

let _argon2: typeof Argon2Browser | null = null

async function loadArgon2(): Promise<typeof Argon2Browser> {
  if (_argon2) return _argon2
  // Dynamic import keeps the bundled WASM out of the initial JS bundle and
  // prevents Turbopack from trying to process argon2.wasm as a native module.
  const mod = await import('argon2-browser/dist/argon2-bundled.min.js' as string) as
    { default?: typeof Argon2Browser } & typeof Argon2Browser
  _argon2 = mod.default ?? (mod as unknown as typeof Argon2Browser)
  return _argon2
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
  const argon2 = await loadArgon2()
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
  const hashBuf = new Uint8Array(result.hash).buffer as ArrayBuffer
  return crypto.subtle.importKey(
    'raw',
    hashBuf,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}
