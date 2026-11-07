import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageAdapter } from './storage-adapter'
import { LocalStorageAdapter } from './local-storage-adapter'

describe('LocalStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes and reads a value', () => {
    const adapter = new LocalStorageAdapter()
    adapter.write('test-key', 'test-value')
    expect(adapter.read('test-key')).toBe('test-value')
  })

  it('returns null for an unknown key', () => {
    const adapter = new LocalStorageAdapter()
    expect(adapter.read('unknown-key-12345')).toBeNull()
  })

  it('removes a value and returns null on subsequent read', () => {
    const adapter = new LocalStorageAdapter()
    adapter.write('remove-key', 'to-remove')
    expect(adapter.read('remove-key')).toBe('to-remove')
    adapter.remove('remove-key')
    expect(adapter.read('remove-key')).toBeNull()
  })

  it('implements StorageAdapter interface', () => {
    const adapter: StorageAdapter = new LocalStorageAdapter()
    adapter.write('interface-test', 'value')
    expect(adapter.read('interface-test')).toBe('value')
    adapter.remove('interface-test')
    expect(adapter.read('interface-test')).toBeNull()
  })

  it('returns null when localStorage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('unavailable')
    })
    const adapter = new LocalStorageAdapter()
    expect(adapter.read('any')).toBeNull()
  })
})
