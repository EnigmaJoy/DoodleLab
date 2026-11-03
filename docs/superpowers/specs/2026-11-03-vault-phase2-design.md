# Client Vault (Phase 2) — Design Spec

## Obiettivo

Cifrare tutti i dati persistiti in localStorage con AES-256-GCM, proteggendoli con un PIN derivato via Argon2id. I dati sono illeggibili senza il PIN. L'architettura è zero-knowledge: nessun dato in chiaro mai su disco.

Questo documento descrive esclusivamente Phase 2. Phase 1 (localStorage in chiaro) è già implementata sul branch `features/localStorage-life-cycle`. Phase 3 (Oracle Cloud + Google OAuth) è separata.

---

## Decisioni chiave

| Decisione | Scelta | Motivazione |
|-----------|--------|-------------|
| KDF | Argon2id via WASM (`argon2-browser`) | Resistenza GPU/ASIC superiore a PBKDF2 |
| Cifratura | AES-256-GCM (Web Crypto API) | Nativa nel browser, AEAD, IV random per ogni write |
| Recovery code | 48 caratteri hex | Semplice, nessuna dipendenza da wordlist |
| StorageAdapter | Rimane sincrona | Nessun impatto sui repository esistenti |
| Architettura chiave | Due livelli (PIN → chiave-master → dati) | Cambio PIN senza ricifrare tutti i dati |
| Auto-lock | Inattività 30 min + tab nascosta | `visibilitychange` + `setTimeout` resettato |

---

## Architettura a due livelli di chiave

```
PIN ──→ Argon2id(PIN, salt) ──→ chiave-PIN (CryptoKey, AES-256-GCM)
                                       │
                            decifra ───┤
                                       ▼
                              chiave-master (48 hex = 24 byte)
                                       │
                            cifra ─────┤
                                       ▼
                              dati applicazione
```

- **chiave-master**: 24 byte casuali generati al setup. Cifra e decifra tutti i dati.
- **chiave-PIN**: derivata da Argon2id ogni volta che l'utente inserisce il PIN. Cifra la chiave-master.
- **recovery code**: la chiave-master in hex (48 chars). Chi lo possiede accede ai dati senza PIN.
- Cambiare PIN = ricifrare solo la chiave-master (1 operazione), non tutti i dati.

**Dati salvati in localStorage (in chiaro):**
```
doodlelab:vault:meta:v1  →  {
  encryptedMasterKey: { iv, ciphertext },  // chiave-master cifrata con chiave-PIN
  salt:               string,              // base64, 16 byte — per Argon2id
  recoveryHint?:      string,              // email opzionale, in chiaro
  createdAt:          string               // ISO-8601
}
```

**Dati cifrati in localStorage:**
```
doodlelab:vault:calendar:v1  →  { iv, ciphertext }
doodlelab:vault:daily:v1     →  { iv, ciphertext }
doodlelab:vault:journal:v1   →  { iv, ciphertext }
doodlelab:vault:inbox:v1     →  { iv, ciphertext }
doodlelab:vault:board:v3     →  { iv, ciphertext }
```

Ogni write genera un nuovo IV casuale (12 byte). Il ciphertext include il tag di autenticazione GCM (128 bit).

---

## File da creare

```
lib/vault/
  argon2-adapter.ts          — wrapper asincrono su argon2-browser
  vault-crypto.ts            — encrypt/decrypt con AES-256-GCM
  vault-service.ts           — ciclo di vita session key, setup/unlock/lock/recover
  vault-storage-adapter.ts   — StorageAdapter sincrona con cache plaintext + async persist
  vault-context.tsx          — React context che espone state/setup/unlock/lock/recover

app/
  unlock/page.tsx            — UnlockScreen
  setup/page.tsx             — VaultSetupScreen
```

Dipendenza npm da aggiungere: `argon2-browser` (~270 KB WASM, unica nuova dipendenza di produzione).

---

## `argon2-adapter.ts`

```ts
export interface Argon2Params {
  memory:      number   // KB — default 65536 (64 MB)
  iterations:  number   // default 3
  parallelism: number   // default 1
  hashLength:  number   // default 32
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  params?: Partial<Argon2Params>
): Promise<CryptoKey>
// Internamente: argon2.hash() → 32 byte raw → importKey come AES-256-GCM non estraibile
```

Parametri default: memoria 64 MB, 3 iterazioni, parallelismo 1. Allineati alle raccomandazioni OWASP 2023 per Argon2id.

---

## `vault-crypto.ts`

```ts
export interface VaultCiphertext {
  iv:         string   // base64url, 12 byte
  ciphertext: string   // base64url, AES-256-GCM output + auth tag
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string
): Promise<VaultCiphertext>

export async function decrypt(
  key: CryptoKey,
  data: VaultCiphertext
): Promise<string>
// Lancia DOMException se auth tag fallisce (tampering o chiave sbagliata)
```

---

## `vault-service.ts`

### Stato

```ts
type VaultState =
  | { status: 'uninitialized' }
  | { status: 'locked' }
  | { status: 'unlocked'; adapter: VaultStorageAdapter }

// Chiavi dei repository da cifrare/decifrare
const VAULT_KEYS = [
  'doodlelab:vault:calendar:v1',
  'doodlelab:vault:daily:v1',
  'doodlelab:vault:journal:v1',
  'doodlelab:vault:inbox:v1',
  'doodlelab:vault:board:v3',
]
```

### API pubblica

```ts
export class VaultService extends ChangeNotifier {
  getState(): VaultState

  // Primo avvio: riceve la master key (già pre-generata e mostrata all'utente nell'UI),
  // deriva chiave-PIN da Argon2id, cifra master key, migra dati Phase 1, salva VaultMeta.
  async setup(pin: string, masterKeyHex: string, recoveryHint?: string): Promise<void>

  // Avvii successivi: legge VaultMeta, deriva chiave-PIN, decifra master key,
  // costruisce VaultStorageAdapter con dati decifrati.
  // Restituisce false se PIN sbagliato (decrypt lancia).
  async unlock(pin: string): Promise<boolean>

  // Recovery: usa recovery code come master key diretta (48 hex → 24 byte → CryptoKey)
  async recover(recoveryCode: string): Promise<boolean>

  // Distrugge session key e cache plaintext. Chiama resetAllRepositories().
  lock(): void
}
```

### Migrazione Phase 1 → Phase 2

Chiamata una volta sola durante `setup()`:
1. Per ogni chiave Phase 1 (`doodlelab:calendar:v1`, `doodlelab:daily:v1`, `doodlelab:journal:v1`, `doodlelab:inbox:v1`, `doodlelab:board:v2`):
   - Legge il valore plaintext
   - Lo cifra con la chiave-master
   - Scrive nella chiave vault corrispondente
   - Cancella la chiave Phase 1
2. Operazione one-shot non reversibile.

### Auto-lock

```ts
private readonly INACTIVITY_MS = 30 * 60 * 1000   // 30 minuti

// Al momento dell'unlock:
// 1. document.addEventListener('visibilitychange', onVisibility)
//    → se document.hidden: this.lock()
// 2. resetInactivityTimer() chiamato su ogni 'pointermove' e 'keydown' su window
//    → clearTimeout(timer); timer = setTimeout(() => this.lock(), INACTIVITY_MS)

// Al lock: removeEventListener, clearTimeout
```

---

## `vault-storage-adapter.ts`

```ts
export class VaultStorageAdapter implements StorageAdapter {
  private readonly cache:       Map<string, string>
  private readonly key:         CryptoKey
  private readonly inner:       LocalStorageAdapter
  private readonly writeQueue:  AsyncQueue   // serializza writes, evita race conditions

  // Costruzione async — chiamata da VaultService dopo aver ottenuto la master key
  static async create(
    key: CryptoKey,
    inner: LocalStorageAdapter,
    storageKeys: string[]
  ): Promise<VaultStorageAdapter>
  // Per ogni storageKey: legge ciphertext da inner, decifra, popola cache.
  // Se chiave assente o decrypt fallisce: cache entry assente (repository → first run).

  // Interfaccia sincrona (StorageAdapter)
  read(key: string): string | null     // → cache.get(key) ?? null
  write(key: string, value: string): void
    // 1. cache.set(key, value)          ← sync, immediato
    // 2. queue.enqueue(encrypt + inner.write)  ← async, background
  remove(key: string): void
    // 1. cache.delete(key)
    // 2. queue.enqueue(inner.remove)

  // Chiamato da VaultService.lock() — drena la queue poi svuota cache
  async destroy(): Promise<void>
}
```

**`AsyncQueue`**: coda FIFO che esegue task async uno alla volta. Impedisce scritture concorrenti sullo stesso key. Implementata in `lib/vault/vault-storage-adapter.ts` come classe privata (non esportata).

---

## `vault-context.tsx`

```ts
export type VaultContextValue = {
  state:   VaultState
  setup:   (pin: string, hint?: string) => Promise<string>   // → recovery code
  unlock:  (pin: string) => Promise<boolean>
  recover: (code: string) => Promise<boolean>
  lock:    () => void
}

export function VaultProvider({ children }: { children: ReactNode }): ReactNode
export function useVaultContext(): VaultContextValue
```

**`VaultProvider`** registra un listener su `VaultService` (che estende `ChangeNotifier`) per propagare i cambi di stato a React. Wrappa tutta l'app in `app/layout.tsx`.

**`AppGate`** — componente interno a `VaultProvider`:
```tsx
function AppGate({ children }) {
  const { state } = useVaultContext()
  if (state.status === 'uninitialized') return <redirect to="/setup" />
  if (state.status === 'locked')        return <redirect to="/unlock" />
  return children
}
```

### Reset repository al lock

```ts
// lib/store.ts — nuova funzione esportata
export function resetAllRepositories(): void
// Azzera i singleton: instance = null in ogni factory
// (calendar, daily, journal, inbox)
// Dopo il prossimo unlock, getXxxRepository() reinizializzerà con VaultStorageAdapter
```

---

## UI

### `app/unlock/page.tsx` — UnlockScreen

**States:** `pin: string`, `error: string | null`, `loading: boolean`

**Flow principale:**
```
[Campo PIN, type="password"]
[Sblocca]  → loading → unlock(pin)
  → false: error = "PIN non corretto"
  → true:  AppGate reindirizza a '/'
```

**Sezione recovery (espandibile):**
```
[Ho dimenticato il PIN ▾]
  [Recovery code, 48 caratteri]
  [Recupera accesso]  → recover(code) → true: AppGate reindirizza a '/'
                                      → false: "Codice non valido"
```

### `app/setup/page.tsx` — VaultSetupScreen

**Step 1 — PIN:**
```
[PIN, min 6 caratteri, type="password"]
[Conferma PIN]
[Email (opzionale) — "per recupero futuro"]
[Continua]  → valida: pin === confirm && pin.length >= 6
```

**Step 2 — Recovery code:**
```
"Salva questo codice in un posto sicuro.
 Senza di esso e senza il PIN, i tuoi
 dati sono irrecuperabili."

[48 caratteri hex]   [Copia]

[☐ Ho salvato il codice di recupero]   ← obbligatoria
[Inizia]  → disabled finché checkbox non checked
          → setup(pin, email) → loader "Creazione vault..."
          → AppGate reindirizza a '/'
```

Il recovery code nel Step 2 viene pre-generato (`crypto.getRandomValues(new Uint8Array(24))` → hex, 48 chars) appena si entra nel Step 2 e mostrato subito all'utente. Al click su "Inizia", l'UI chiama `setup(pin, masterKeyHex, email)` passando il codice già generato. `VaultService.setup()` lo usa come master key — non ne genera uno nuovo.

---

## Testing

### Strategia per WASM

`argon2-browser` richiede WASM. In jsdom (vitest), il WASM potrebbe non essere disponibile o richiedere flag speciali. Approccio:

**Mock di `argon2-adapter.ts` nei test unitari:**
```ts
// in test setup o vi.mock():
vi.mock('@/lib/vault/argon2-adapter', () => ({
  deriveKey: async (password: string, salt: Uint8Array) =>
    crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    )
}))
```

I test di `argon2-adapter.ts` stesso vengono marcati `it.skipIf(!globalThis.WebAssembly, ...)`.

### File di test

**`lib/vault/vault-crypto.test.ts`:**
- encrypt → decrypt restituisce il plaintext originale
- decrypt con IV modificato lancia
- decrypt con ciphertext modificato lancia

**`lib/vault/vault-service.test.ts`** (con argon2-adapter mockato):
- setup() con PIN valido → restituisce recovery code 48 hex chars
- setup() poi unlock() con PIN corretto → stato 'unlocked'
- unlock() con PIN sbagliato → false, stato rimane 'locked'
- lock() → stato 'locked', chiama resetAllRepositories()
- recover() con recovery code corretto → stato 'unlocked'
- recover() con codice sbagliato → false

**`lib/vault/vault-storage-adapter.test.ts`** (CryptoKey reale via PBKDF2 nel setup):
- write() aggiorna cache immediatamente (read() sync dopo write)
- write() persiste in localStorage dopo await flushQueue()
- read() per chiave assente → null
- destroy() svuota la cache (read() → null dopo destroy)
- create() carica dati esistenti da localStorage (round-trip)

---

## Vincoli e decisioni

- **`argon2-browser`** è l'unica nuova dipendenza di produzione. Nessuna libreria di cifratura aggiuntiva — tutto il resto usa Web Crypto API nativa.
- **`CryptoKey` non estraibile** (`extractable: false`): la session key non può essere serializzata o esportata da JS. Chi legge la memoria del processo non può estrarre la chiave raw.
- **Nessun dato in chiaro su disco** dopo la migrazione Phase 1 → Phase 2. Le chiavi Phase 1 vengono cancellate immediatamente dopo la cifratura.
- **Tab nascosta = lock immediato**: `visibilitychange` → `document.hidden` → lock. Questo include anche la chiusura della tab e la navigazione fuori dalla pagina (beforeunload non è necessario: `hidden` arriva prima).
- **Inactività**: 30 minuti fissi, non configurabile in Phase 2.
- **Email**: raccolta opzionale durante setup, salvata in chiaro in `VaultMeta.recoveryHint`. Non usata in Phase 2. Preparata per il flusso di recupero Phase 3.
- **`lib/crypto/`** (directory esistente ma vuota): non usata in Phase 2. I file vault vanno in `lib/vault/`.
- **board notes** (`doodlelab:board:v2`): migrata a `doodlelab:vault:board:v3` durante setup. `note-context.tsx` attualmente chiama `localStorage` direttamente — va refactorizzato per accettare un `StorageAdapter` opzionale (fallback a `LocalStorageAdapter` se non fornito). Questo è un task esplicito in Phase 2 (task 10 nel piano di implementazione).

---

## Piano di implementazione (scope Phase 2)

1. Aggiungere dipendenza `argon2-browser` al `package.json`
2. `lib/vault/vault-crypto.ts` + test
3. `lib/vault/argon2-adapter.ts` + mock/test
4. `lib/vault/vault-storage-adapter.ts` + test
5. `lib/vault/vault-service.ts` + test + `resetAllRepositories()` in `lib/store.ts`
6. `lib/vault/vault-context.tsx`
7. `app/setup/page.tsx` — VaultSetupScreen
8. `app/unlock/page.tsx` — UnlockScreen
9. Integrare `VaultProvider` + `AppGate` in `app/layout.tsx`
10. Refactoring `lib/note-context.tsx`: accetta `StorageAdapter` opzionale, sostituisce le chiamate dirette a `localStorage`
