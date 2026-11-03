// lib/store.ts
// Minimal change-notification primitive for repositories, compatible with
// React's useSyncExternalStore (subscribe + monotonically increasing version).

import type { StorageAdapter } from './storage/storage-adapter'
import { LocalStorageAdapter } from './storage/local-storage-adapter'

export class ChangeNotifier {
  private listeners = new Set<() => void>()
  private _version  = 0

  get version(): number {
    return this._version
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getVersion = (): number => this._version

  protected notify(): void {
    this._version++
    for (const listener of this.listeners) listener()
  }
}

let idCounter = 0

/** Stable, collision-resistant identifier for locally created entities */
export function createId(prefix: string): string {
  idCounter++
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${idCounter}`
  return `${prefix}_${random}`
}

/**
 * Persistence mode for this increment.
 * 'local' = data is persisted to localStorage and survives page reloads.
 */
export const PERSISTENCE_MODE = 'local' as const

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
// Each repository factory calls registerReset() once at module load to register
// a callback that nulls its singleton. VaultService calls resetAllRepositories()
// on lock and after unlock so repositories reinitialize with the current adapter.

const _resetCallbacks: Array<() => void> = []

export function registerReset(fn: () => void): void {
  _resetCallbacks.push(fn)
}

export function resetAllRepositories(): void {
  for (const fn of _resetCallbacks) fn()
}
