import { ChangeNotifier, resetAllRepositories, setStorageAdapter } from '../store'
import { deriveKey } from './argon2-adapter'
import { encrypt, decrypt } from './vault-crypto'
import { VaultStorageAdapter } from './vault-storage-adapter'
import { LocalStorageAdapter } from '../storage/local-storage-adapter'

// ── Constants ────────────────────────────────────────────────────────────────

function metaKey(userId: string): string {
  return `doodlelab:vault:meta:${userId}:v1`
}

// Logical keys that repositories use — VaultStorageAdapter maps these to vault keys
const VAULT_LOGICAL_KEYS = [
  'doodlelab:calendar:v1',
  'doodlelab:daily:v1',
  'doodlelab:journal:v1',
  'doodlelab:inbox:v1',
  'doodlelab:board:v2',
]

// Phase 1 key → Phase 2 vault key (used only for one-time migration in setup())
// Physical vault keys are now userId-namespaced.
function phase1MigrationMap(userId: string): Record<string, string> {
  return {
    'doodlelab:calendar:v1': `doodlelab:vault:data:${userId}:calendar:v1`,
    'doodlelab:daily:v1':    `doodlelab:vault:data:${userId}:daily:v1`,
    'doodlelab:journal:v1':  `doodlelab:vault:data:${userId}:journal:v1`,
    'doodlelab:inbox:v1':    `doodlelab:vault:data:${userId}:inbox:v1`,
    'doodlelab:board:v2':    `doodlelab:vault:data:${userId}:board:v3`,
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface VaultMeta {
  encryptedMasterKey:  { iv: string; ciphertext: string }
  salt:                string   // base64, 16 bytes
  recoveryHint?:       string
  createdAt:           string
  verifierCiphertext?: { iv: string; ciphertext: string }
}

export type VaultState =
  | { status: 'uninitialized' }
  | { status: 'locked' }
  | { status: 'unlocked'; adapter: VaultStorageAdapter }

// ── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

async function importMasterKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(hex).buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── VaultService ──────────────────────────────────────────────────────────────

export class VaultService extends ChangeNotifier {
  private _state: VaultState
  private readonly inner  = new LocalStorageAdapter()
  private readonly userId: string

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null
  private readonly INACTIVITY_MS = 30 * 60 * 1000

  private readonly onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.hidden) this.lock()
  }

  private readonly onActivity = (): void => {
    this.resetInactivityTimer()
  }

  constructor(userId: string) {
    super()
    this.userId = userId
    const meta  = this.inner.read(metaKey(userId))
    this._state = meta ? { status: 'locked' } : { status: 'uninitialized' }
  }

  getState(): VaultState {
    return this._state
  }

  /**
   * First-run setup. Receives a pre-generated masterKeyHex (shown to the user
   * as the recovery code). Derives a PIN key via Argon2id, encrypts the master
   * key with it, migrates Phase 1 plaintext data, and saves VaultMeta.
   */
  async setup(
    pin:          string,
    masterKeyHex: string,
    recoveryHint?: string,
  ): Promise<void> {
    const salt      = crypto.getRandomValues(new Uint8Array(16))
    const pinKey    = await deriveKey(pin, salt)
    const masterKey = await importMasterKey(masterKeyHex)

    const encryptedMasterKey  = await encrypt(pinKey, masterKeyHex)
    const verifierCiphertext  = await encrypt(masterKey, 'vault-ok')

    // One-time migration: Phase 1 plaintext → encrypted vault keys
    for (const [phase1Key, vaultKey] of Object.entries(phase1MigrationMap(this.userId))) {
      const raw = this.inner.read(phase1Key)
      if (raw !== null) {
        const ct = await encrypt(masterKey, raw)
        this.inner.write(vaultKey, JSON.stringify(ct))
        this.inner.remove(phase1Key)
      }
    }

    const meta: VaultMeta = {
      encryptedMasterKey,
      salt:               toBase64(salt),
      recoveryHint,
      createdAt:          new Date().toISOString(),
      verifierCiphertext,
    }
    this.inner.write(metaKey(this.userId), JSON.stringify(meta))

    await this.activateWithMasterKey(masterKey)
  }

  /**
   * Returns true on success. Returns false (without throwing) if the PIN is wrong.
   */
  async unlock(pin: string): Promise<boolean> {
    try {
      const metaRaw = this.inner.read(metaKey(this.userId))
      if (metaRaw === null) return false
      const meta = JSON.parse(metaRaw) as VaultMeta

      const salt         = fromBase64(meta.salt)
      const pinKey       = await deriveKey(pin, salt)
      const masterKeyHex = await decrypt(pinKey, meta.encryptedMasterKey)
      const masterKey    = await importMasterKey(masterKeyHex)

      await this.activateWithMasterKey(masterKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * Uses the recovery code (= master key hex) directly to unlock.
   * Returns false if the code is not a valid 64-char hex string.
   */
  async recover(recoveryCode: string): Promise<boolean> {
    try {
      const metaRaw = this.inner.read(metaKey(this.userId))
      if (metaRaw === null) return false
      if (!/^[0-9a-fA-F]{64}$/.test(recoveryCode)) return false
      const meta       = JSON.parse(metaRaw) as VaultMeta
      const masterKey  = await importMasterKey(recoveryCode)
      if (meta.verifierCiphertext) {
        let plaintext: string
        try {
          plaintext = await decrypt(masterKey, meta.verifierCiphertext)
        } catch {
          return false
        }
        if (plaintext !== 'vault-ok') return false
      }
      await this.activateWithMasterKey(masterKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * Destroys the in-memory adapter (drains pending writes), clears the storage
   * adapter, resets all repository singletons.
   */
  lock(): void {
    if (this._state.status === 'uninitialized') return
    if (this._state.status === 'unlocked') {
      void this._state.adapter.destroy()
    }
    this.removeAutoLockListeners()
    setStorageAdapter(null)
    resetAllRepositories()
    this._state = { status: 'locked' }
    this.notify()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async activateWithMasterKey(masterKey: CryptoKey): Promise<void> {
    const adapter = await VaultStorageAdapter.create(
      masterKey,
      this.inner,
      VAULT_LOGICAL_KEYS,
      this.userId,       // ← NEW 4th argument
    )
    setStorageAdapter(adapter)
    resetAllRepositories()
    this._state = { status: 'unlocked', adapter }
    this.notify()
    this.startAutoLock()
  }

  private startAutoLock(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('pointermove', this.onActivity)
    window.addEventListener('keydown', this.onActivity)
    this.resetInactivityTimer()
  }

  private removeAutoLockListeners(): void {
    if (typeof document === 'undefined') return
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('pointermove', this.onActivity)
    window.removeEventListener('keydown', this.onActivity)
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer)
      this.inactivityTimer = null
    }
  }

  private resetInactivityTimer(): void {
    if (typeof document === 'undefined') return
    if (this.inactivityTimer !== null) clearTimeout(this.inactivityTimer)
    this.inactivityTimer = setTimeout(() => this.lock(), this.INACTIVITY_MS)
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

const vaultServiceCache = new Map<string, VaultService>()

export function getVaultService(userId: string): VaultService {
  if (!vaultServiceCache.has(userId)) {
    vaultServiceCache.set(userId, new VaultService(userId))
  }
  return vaultServiceCache.get(userId)!
}
