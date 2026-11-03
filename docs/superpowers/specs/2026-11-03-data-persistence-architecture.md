# Data Persistence Architecture — DoodleLab

## Vision

DoodleLab è un'app di produttività personale. I suoi dati (task, blocchi orari, diario, inbox, eventi calendario, note board) devono sopravvivere ai reload del browser, essere protetti da accessi non autorizzati, e in futuro sincronizzarsi tra dispositivi.

Questo documento descrive l'architettura completa in tre fasi indipendenti e incrementali. Ogni fase produce software funzionante. La fase successiva si aggiunge sopra senza riscrivere la precedente.

---

## Stato attuale (baseline)

| Entità | Storage | CRUD completo |
|--------|---------|---------------|
| Board notes | ✅ localStorage (`doodlelab:board:v2`) | ✅ sì |
| Task / TimeBlock / Focus / CheckIn / EnergyActivity | ❌ solo memoria | ✅ sì (tranne EnergyActivity update) |
| Journal entries | ❌ solo memoria | ⚠️ manca delete |
| Inbox items | ❌ solo memoria | ⚠️ manca update e delete |
| Calendar items | ❌ mock fixture hardcoded | ❌ solo lettura |

`lib/store.ts` esporta `PERSISTENCE_MODE = 'memory'` — tutti i repository vivono solo nell'istanza aperta.

---

## Architettura a tre fasi

```
Fase 1 ──────────────────────────────────────────────────────
  localStorage in chiaro
  Tutti i repository persistono su localStorage
  CalendarRepository sostituisce calendar-mock
  UI: delete evento calendario (oggi + calendario)

Fase 2 ──────────────────────────────────────────────────────
  Client vault (AES-256-GCM + Argon2id)
  I dati in localStorage diventano ciphertext
  UI: setup PIN al primo avvio, unlock sessione

Fase 3 ──────────────────────────────────────────────────────
  Backend Oracle Cloud + Google OAuth
  Vault sync cifrato multi-dispositivo
  Device authorization flow
```

La chiave di design: le Fasi 2 e 3 non cambiano i repository — cambiano solo l'adattatore di storage che i repository usano. I dati passano da `LocalStorageAdapter` → `VaultStorageAdapter` → `RemoteStorageAdapter` senza toccare la logica di business.

---

## StorageAdapter — il punto di astrazione centrale

Introdotto in **Fase 1**, è l'unico punto che cambia tra le fasi.

```ts
// lib/storage/storage-adapter.ts

export interface StorageAdapter {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}
```

### Implementazioni per fase

**Fase 1 — LocalStorageAdapter**
```ts
// lib/storage/local-storage-adapter.ts
export class LocalStorageAdapter implements StorageAdapter {
  read(key)        { return localStorage.getItem(key) }
  write(key, val)  { localStorage.setItem(key, val) }
  remove(key)      { localStorage.removeItem(key) }
}
```

**Fase 2 — VaultStorageAdapter**
```ts
// lib/storage/vault-storage-adapter.ts
// Cifra con AES-256-GCM prima di scrivere.
// Decifra con la session key tenuta in memoria.
export class VaultStorageAdapter implements StorageAdapter {
  constructor(private sessionKey: CryptoKey, private inner: LocalStorageAdapter) {}
  async read(key)       { /* decifra */ }
  async write(key, val) { /* cifra poi scrive */ }
  remove(key)           { this.inner.remove(key) }
}
```

**Fase 3 — RemoteStorageAdapter**
```ts
// lib/storage/remote-storage-adapter.ts
// Prima scrive su localStorage (cache offline), poi sincronizza su Oracle.
export class RemoteStorageAdapter implements StorageAdapter {
  constructor(private cache: VaultStorageAdapter, private api: OracleApiClient) {}
  // ...
}
```

I repository ricevono l'adattatore via iniezione nel costruttore (o via singleton factory aggiornata). Non sanno quale adattatore usano.

---

## Fase 1 — localStorage in chiaro

### Chiavi localStorage

```
doodlelab:calendar:v1   → CalendarItem[]
doodlelab:daily:v1      → { tasks, blocks, activities, checkIns }
doodlelab:journal:v1    → JournalEntry[]
doodlelab:inbox:v1      → InboxItem[]
doodlelab:board:v2      → (invariato, già gestito da note-context.tsx)
```

Versione nel nome della chiave (`v1`, `v2`) permette di gestire migrazioni di schema future senza corrompere dati esistenti.

### CRUD gap da colmare

| Repository | Gap | Soluzione |
|------------|-----|-----------|
| DailyRepository | EnergyActivity senza update | Aggiungere `updateEnergyActivity(id, title)` |
| JournalRepository | Nessun delete | Aggiungere `deleteEntry(day)` |
| InboxRepository | Nessun update né delete | Aggiungere `updateItem(id, text)`, `deleteItem(id)` |

### CalendarRepository — design

Sostituisce le funzioni standalone di `calendar-mock.ts` con una classe repository reattiva.

**File:** `lib/calendar-repository.ts`

```ts
export type EventKind = 'event' | 'reminder' | 'note'
// 'postit' → rinominato 'note' per coerenza con il resto del codebase

export interface CalendarItem {
  id:       string
  date:     string       // YYYY-MM-DD
  kind:     EventKind
  title:    string
  time?:    string       // HH:MM
  color?:   'blue' | 'green' | 'orange' | 'purple'
  note?:    string
  groupId?: string
  detail?: {
    location?: string
    calendar?: string
    note?:     string
    alert?:    string
    origin?:   string
    alsoOn?:   string
    repeats?:  string
    timeEnd?:  string
  }
  createdAt: string      // ISO-8601 — assente nei mock, aggiunto per tutti i nuovi item
}

export interface CalendarRepository extends Observable {
  // lettura
  getItem(id: string): CalendarItem | undefined
  getItemsForDate(date: string): CalendarItem[]
  getDatesWithItems(): Set<string>
  getGroupsForDate(date: string): Map<string, CalendarItem[]>

  // scrittura
  addItem(input: NewCalendarItem): CalendarItem
  updateItem(id: string, patch: CalendarItemPatch): CalendarItem | null
  deleteItem(id: string): boolean
}
```

**Seeding dei dati fixture**

Al primo avvio, se localStorage è vuoto per la chiave `doodlelab:calendar:v1`, il repository si inizializza con i dati di `MOCK_ITEMS` da `calendar-mock.ts` e imposta un flag `seededWithFixtures: true` nel payload. Questo permette all'utente di vedere dati di esempio fin dal primo avvio, e può cancellare gli eventi mock come farebbe con quelli reali.

`calendar-mock.ts` non viene eliminato — viene mantenuto come sorgente di fixture per test e sviluppo locale. Il flag `CALENDAR_SOURCE_IS_FIXTURE` resta per indicare quando i dati provengono dalla fonte mock.

**Singleton factory**

```ts
export function getCalendarRepository(): CalendarRepository
```

Aggiornata per passare `LocalStorageAdapter` in Fase 1.

**Impatto sui chiamanti**

Tutti i file che importano da `@/lib/calendar-mock` migrano a `@/lib/calendar-repository`:
- `components/today/DayTimeline.tsx`
- `components/CalendarView.tsx`
- `lib/oggi/daily-repository.ts` (per `fixedIntervals`)
- `components/today/TimeBlockDialogs.tsx`

L'API di lettura (`getItemsForDate`, `getDatesWithItems`, `getGroupsForDate`) rimane identica per minimizzare l'impatto.

### UI: Delete evento calendario

La feature originale che ha avviato questo progetto.

**Posizione 1 — vista Oggi (DayTimeline)**

`EntryDialog` (componente locale in `DayTimeline.tsx`) mostra attualmente un `GroupItemCard` in modalità read-only. Aggiungere:
- Pulsante "Elimina" nel footer del dialog
- Confirmation dialog inline (pattern già usato da `BlockActionsDialog` in `TimeBlockDialogs.tsx`)
- Al confirm: `repo.deleteItem(entry.id)` → dialog si chiude → item scompare dalla timeline

**Posizione 2 — vista Calendario (CalendarView)**

`GroupItemCard` in `GroupDetailPanel` mostra item in modalità read-only. Aggiungere:
- Pulsante "Elimina" in ogni card
- Stessa confirmation inline
- Al confirm: `repo.deleteItem(item.id)` → card scompare dal panel → se il panel è vuoto, si chiude

**Pattern di conferma** (coerente con TimeBlock delete):
```
[Elimina]  →  "Eliminare questo evento?" [Annulla] [Elimina]
```

**Reattività**: `CalendarView` e `DayTimeline` già usano `getItemsForDate()` inline (non via `useRepository`). Con il nuovo `CalendarRepository` che estende `ChangeNotifier`, i componenti dovranno sottoscriversi via `useRepository(getCalendarRepository())` per ricevere gli aggiornamenti reattivi dopo una delete.

---

## Fase 2 — Client Vault (E2EE locale)

### Stack crittografico

| Operazione | Algoritmo | Note |
|------------|-----------|------|
| Derivazione chiave da PIN | **Argon2id** (via WASM) | Resistente a GPU/ASIC. Parametri: memoria 64MB, iterazioni 3, parallelismo 1 |
| Cifratura dati | **AES-256-GCM** | IV casuale per ogni write. Tag di autenticazione incluso (AEAD) |
| Generazione ID sicuri | `crypto.randomUUID()` | Già usato in `lib/store.ts` |
| Salt | 16 byte casuali, salvati in chiaro accanto al ciphertext | Necessario per Argon2id |

### Struttura del vault

Il vault è un singolo oggetto JSON cifrato per ogni chiave storage. Ogni dominio ha la sua chiave:

```
doodlelab:vault:calendar:v1  →  { iv, salt, ciphertext }
doodlelab:vault:daily:v1     →  { iv, salt, ciphertext }
doodlelab:vault:journal:v1   →  { iv, salt, ciphertext }
doodlelab:vault:inbox:v1     →  { iv, salt, ciphertext }
doodlelab:vault:board:v3     →  { iv, salt, ciphertext }  ← migrazione da board:v2
```

La session key (la chiave AES-256 derivata dal PIN) viene tenuta in memoria in un `CryptoKey` non estraibile. Non viene mai scritta su disco.

### Session lifecycle

```
App load
  ↓
VaultContext: stato = 'locked'
  ↓
Mostra UnlockScreen (inserisci PIN)
  ↓
PIN → Argon2id(PIN, salt) → session key in memoria
  ↓
Carica e decifra tutti i repository
  ↓
stato = 'unlocked' → app normale
  ↓
Inattività (es. 15 min) o lock manuale
  ↓
session key eliminata dalla memoria
  ↓
stato = 'locked' → mostra UnlockScreen
```

### Primo avvio

```
App load → nessun vault esistente
  ↓
Mostra VaultSetupScreen
  ↓
Utente sceglie un PIN (min 6 caratteri)
  ↓
Genera salt → Argon2id(PIN, salt) → session key
  ↓
Genera recovery code (24 parole BIP-39 o 48 caratteri hex)
  ↓
Mostra recovery code → utente lo salva
  ↓
Migra dati esistenti da localStorage in chiaro → cifra con session key
  ↓
App normale
```

Il recovery code permette di ricreare la session key senza PIN (per recupero su nuovo dispositivo in Fase 3).

### File nuovi

```
lib/vault/
  argon2.ts          — wrapper WASM per Argon2id
  vault-crypto.ts    — cifra/decifra con AES-256-GCM
  vault-service.ts   — gestisce session key, lock/unlock, first setup
  vault-context.tsx  — React context: { state, unlock, lock, setup }
lib/storage/
  vault-storage-adapter.ts  — implementa StorageAdapter usando vault-service
```

### Migrazione Fase 1 → Fase 2

Al primo avvio con vault abilitato, `VaultService` legge i dati in chiaro dalle chiavi `doodlelab:*:v1`, li cifra, li scrive sulle chiavi `doodlelab:vault:*:v1`, poi cancella le chiavi plaintext originali. Operazione one-shot, non reversibile.

---

## Fase 3 — Backend Oracle + Google OAuth

### Componenti

**Autenticazione**: Google OAuth via NextAuth.js (o Next.js Route Handlers custom). L'identità Google è separata dalla chiave crittografica — il server non vede mai il vault plaintext.

**Backend**: Node.js su Oracle Cloud Infrastructure (OCI). Free tier include 2 VM Always Free + 10GB Object Storage.

**Storage**: Il backend riceve e restituisce ciphertext. Può usare:
- OCI Object Storage (semplice, nessuno schema da gestire)
- MySQL HeatWave (free su OCI, più strutturato per query)

### Architettura zero-knowledge

```
Client                          Oracle Backend
──────                          ─────────────
PIN → session key               Non vede mai:
  ↓                               - il PIN
dati → AES-GCM encrypt            - la session key
  ↓                               - i dati in chiaro
ciphertext ──── HTTPS POST ──→  Salva ciphertext
                                   per utente X
ciphertext ◄─── HTTPS GET ────  Ritorna ciphertext
  ↓
AES-GCM decrypt → dati
```

### Multi-dispositivo

**Dispositivo già autorizzato**: Google login → backend ritorna ciphertext → client decifra con PIN. Un solo step esplicito per l'utente (Google login). Il PIN potrebbe essere cached nel Credential Manager di Windows (via WebAuthn come convenience layer, non come fonte della chiave crittografica).

**Nuovo dispositivo**: Google login → backend vede device non autorizzato → chiede recovery code (generato in Fase 2 al setup) → verifica → dispositivo autorizzato → da quel momento login normale.

**Revoca dispositivo**: Pannello "I miei dispositivi" → revoca → il backend invalida la sessione del device revocato.

### RemoteStorageAdapter

```ts
class RemoteStorageAdapter implements StorageAdapter {
  constructor(
    private cache: VaultStorageAdapter,   // localStorage come cache offline
    private api: OracleApiClient,
    private userId: string
  ) {}

  read(key): string | null {
    // Prima controlla cache locale, poi (se online) sincronizza da Oracle
  }
  write(key, val): void {
    this.cache.write(key, val)            // scrivi subito in cache
    this.api.push(userId, key, val)       // push asincrono a Oracle
  }
}
```

Offline-first: l'app funziona sempre dalla cache locale. Il sync con Oracle avviene in background quando la connessione è disponibile.

---

## Piano di implementazione (fasi)

### Fase 1 — Scope

1. `lib/storage/storage-adapter.ts` — interfaccia + LocalStorageAdapter
2. `lib/calendar-repository.ts` — nuovo repository reattivo con CRUD, seeding fixture, localStorage
3. Aggiornare `lib/store.ts`: `PERSISTENCE_MODE = 'local'`
4. Aggiornare `lib/oggi/daily-repository.ts`: persistenza localStorage + `updateEnergyActivity`
5. Aggiornare `lib/journal/journal-repository.ts`: persistenza localStorage + `deleteEntry`
6. Aggiornare `lib/inbox/inbox-repository.ts`: persistenza localStorage + `deleteItem` + `updateItem`
7. Aggiornare tutti i chiamanti di `calendar-mock`: migrazione a `calendar-repository`
8. UI: delete button in `EntryDialog` (DayTimeline) + `GroupItemCard` (CalendarView) con confirmation
9. UI: `useRepository(getCalendarRepository())` nei componenti che mostrano eventi

### Fase 2 — Scope (separato)

1. Implementare Argon2id via WASM
2. VaultService + VaultContext
3. VaultStorageAdapter
4. UI: UnlockScreen + VaultSetupScreen + recovery code
5. Migrazione automatica Fase 1 → Fase 2

### Fase 3 — Scope (separato)

1. NextAuth.js + Google OAuth
2. Oracle backend (OCI, Node.js)
3. OracleApiClient + RemoteStorageAdapter
4. Multi-device authorization flow
5. UI: device management panel

---

## Vincoli e decisioni

- **calendar-mock.ts non viene eliminato** — resta come fixture per test e development. I dati fixture vengono iniettati nel CalendarRepository solo al primo avvio (localStorage vuoto).
- **board notes (`doodlelab:board:v2`)** — già funzionanti con localStorage. In Fase 2 vengono migrati al vault cambiando solo l'adapter. Non si tocca `note-context.tsx` prima di allora.
- **Nessun dato sensibile in URL o query string** — mai.
- **Fallback silenzioso** — se localStorage non è disponibile (es. incognito mode), i repository degradano a in-memory senza errori visibili.
- **Schema versioning** — ogni chiave include `v1`, `v2` ecc. Le migrazioni di schema sono gestite dal repository che le possiede, non da un sistema centralizzato.
