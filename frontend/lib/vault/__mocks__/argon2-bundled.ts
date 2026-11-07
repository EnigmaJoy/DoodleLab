/**
 * Vitest test double for argon2-browser/dist/argon2-bundled.min.js.
 * Replaces Argon2id WASM with HMAC-SHA-256 so the adapter tests run
 * without a browser WASM environment. The real Argon2id runs in production.
 */
import type Argon2Browser from 'argon2-browser'

const ArgonType = { Argon2d: 0, Argon2i: 1, Argon2id: 2 }

const hash: typeof Argon2Browser['hash'] = async ({ pass, salt, hashLen = 32 }) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    typeof pass === 'string' ? new TextEncoder().encode(pass) : pass,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const rawSalt = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, rawSalt)
  const full = new Uint8Array(sig)
  const truncated = full.slice(0, hashLen)
  return {
    hash: truncated,
    hashHex: Array.from(truncated).map(b => b.toString(16).padStart(2, '0')).join(''),
    encoded: '',
  }
}

const argon2Mock: typeof Argon2Browser = {
  ArgonType,
  hash,
  verify: async () => undefined,
  unloadRuntime: () => undefined,
}

export default argon2Mock
