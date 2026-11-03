import { describe, expect, it } from 'vitest'
import { LocalStorageAdapter, type StorageAdapter } from './storage-adapter'

describe('LocalStorageAdapter', () => {
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
})
