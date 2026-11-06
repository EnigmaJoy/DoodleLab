import type { StorageAdapter } from '../storage/storage-adapter'
import { encrypt, decrypt } from './vault-crypto'

// Builds a per-user physical key map.
// Repositories use logical keys (e.g. 'doodlelab:daily:v1').
// VaultStorageAdapter stores them under namespaced vault keys in localStorage.
function buildKeyMap(userId: string): Record<string, string> {
  return {
    'doodlelab:calendar:v1': `doodlelab:vault:data:${userId}:calendar:v1`,
    'doodlelab:daily:v1':    `doodlelab:vault:data:${userId}:daily:v1`,
    'doodlelab:journal:v1':  `doodlelab:vault:data:${userId}:journal:v1`,
    'doodlelab:inbox:v1':    `doodlelab:vault:data:${userId}:inbox:v1`,
    'doodlelab:board:v2':    `doodlelab:vault:data:${userId}:board:v3`,
  }
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
      try { await task() } catch (err) { console.error('[VaultStorageAdapter] async write failed:', err) }
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
  private readonly inner:      StorageAdapter
  private readonly writeQueue: AsyncQueue
  private readonly keyMap:     Record<string, string>

  private constructor(
    key:    CryptoKey,
    inner:  StorageAdapter,
    cache:  Map<string, string>,
    keyMap: Record<string, string>,
  ) {
    this.key        = key
    this.inner      = inner
    this.cache      = cache
    this.writeQueue = new AsyncQueue()
    this.keyMap     = keyMap
  }

  /**
   * Async factory. Builds the per-user key map, then for each logical key reads
   * the corresponding vault key from localStorage, decrypts it, and populates
   * the in-memory cache. Corrupt or missing entries are silently skipped.
   */
  static async create(
    key:         CryptoKey,
    inner:       StorageAdapter,
    logicalKeys: string[],
    userId:      string,
  ): Promise<VaultStorageAdapter> {
    const keyMap = buildKeyMap(userId)
    const cache  = new Map<string, string>()
    for (const logicalKey of logicalKeys) {
      const vaultKey = keyMap[logicalKey] ?? logicalKey
      const raw = inner.read(vaultKey)
      if (raw !== null) {
        try {
          const ct        = JSON.parse(raw) as { iv: string; ciphertext: string }
          const plaintext = await decrypt(key, ct)
          cache.set(logicalKey, plaintext)
        } catch {
          // Corrupt or tampered data — silently skip
        }
      }
    }
    return new VaultStorageAdapter(key, inner, cache, keyMap)
  }

  // ── StorageAdapter interface ───────────────────────────────────────────────

  read(key: string): string | null {
    return this.cache.get(key) ?? null
  }

  write(key: string, value: string): void {
    this.cache.set(key, value)
    const vaultKey = this.keyMap[key] ?? key
    this.writeQueue.enqueue(async () => {
      // Capture `value` at enqueue time — do NOT read from cache here.
      // Cache may have been updated by a subsequent write before this task runs.
      const ct = await encrypt(this.key, value)
      this.inner.write(vaultKey, JSON.stringify(ct))
    })
  }

  remove(key: string): void {
    this.cache.delete(key)
    const vaultKey = this.keyMap[key] ?? key
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
