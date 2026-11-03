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
