// @vitest-environment node
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
