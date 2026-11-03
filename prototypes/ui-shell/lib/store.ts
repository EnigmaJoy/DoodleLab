// lib/store.ts
// Minimal change-notification primitive for repositories, compatible with
// React's useSyncExternalStore (subscribe + monotonically increasing version).

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
