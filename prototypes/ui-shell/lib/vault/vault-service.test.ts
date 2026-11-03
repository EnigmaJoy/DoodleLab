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

  it('recover() with wrong-but-valid 48-hex code returns false', async () => {
    const svc = new VaultService()
    await svc.setup('my-pin-123', makeMasterKeyHex())
    svc.lock()
    // A different, syntactically valid 48-hex key — never used to encrypt this vault
    const wrongKey = makeMasterKeyHex()
    const ok = await svc.recover(wrongKey)
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('locked')
  })

  it('recover() returns false when vault is uninitialized (no meta)', async () => {
    const svc = new VaultService()
    expect(svc.getState().status).toBe('uninitialized')
    const ok = await svc.recover(makeMasterKeyHex())
    expect(ok).toBe(false)
    expect(svc.getState().status).toBe('uninitialized')
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
