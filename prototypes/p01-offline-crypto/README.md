# P-01 - Offline Crypto

**Stato:** laboratorio sperimentale - NON sicuro per dati personali.  
**Threat model:** [`docs/threat-model/P-01.md`](../../docs/threat-model/P-01.md)  
**Matrice dei test:** [`docs/test-results/P-01-test-matrix.md`](../../docs/test-results/P-01-test-matrix.md)  
**ADR dello strumento:** [`docs/adr/ADR-0001-vite-strumento-laboratorio-p01.md`](../../docs/adr/ADR-0001-vite-strumento-laboratorio-p01.md)

## Specifica di riferimento

Il documento integrale Master Prompt Agenda ADHD v2.3.4 è stato fornito per l'audit di
conformità del bootstrap, ma non è versionato nel repository. Nome, versione e SHA-256
del documento utilizzato sono registrati in [`specifications/README.md`](../../specifications/README.md).

Questo prototipo contiene il bootstrap tecnico, uno smoke test non invasivo e la
configurazione degli header di sicurezza per `vite preview`. Non dichiara conformità
complessiva al Master Prompt e non implementa alcun protocollo crittografico applicativo.

Le decisioni D-14, D-15 e D-19 restano aperte (Bloccanti).

Vite è uno strumento del solo laboratorio e non sostituisce Next.js nello stack di
produzione (ADR-0001).

## Contenuto attuale

- `src/smoke-check.ts` - evidenza ambientale **ENV-00**: verifica la sola presenza di
  Secure Context, `crypto.subtle` (con l'elenco dei metodi), `crypto.getRandomValues` e
  `indexedDB.open`, e raccoglie user agent, vendor, `maxTouchPoints` e origin per la
  riproducibilità. Non invoca Web Crypto, non genera chiavi, non apre database, non salva
  nulla e non effettua richieste di rete.
- `src/main.ts` - mostra il report in pagina (solo `textContent`, nessun HTML da stringhe).
- `vite.config.ts` - `PREVIEW_SECURITY_HEADERS`, gli header di sicurezza di `vite preview`.
- `tests/smoke-check.test.ts` - test Vitest con ambienti sintetici, incluso un test che
  verifica che nessuna API crittografica o IndexedDB venga invocata.
- `tests/preview-headers.test.ts` - evidenza **ENV-01**: esegue una build in
  `node_modules/.tmp/preview-headers-test`, avvia `vite preview` sulla porta 4180 e verifica
  gli header nelle risposte HTTP della pagina e degli asset.

### Ambito dello smoke test (ENV-00)

Il report JSON dichiara il proprio ambito:

```json
{ "evidenceId": "ENV-00", "scope": "api-presence-only", "cryptoValidated": false, "allApisExposed": true }
```

- `allApisExposed: true` significa soltanto che le API controllate esistono.
- La presenza di `crypto.subtle.wrapKey` non dimostra il supporto di algoritmi specifici
  (ad esempio RSA-OAEP, AES-GCM, PBKDF2, HKDF) né il comportamento di `extractable`.
- La presenza di `indexedDB.open` non dimostra disponibilità reale, quota o politica di eviction.
- ENV-00 è un'evidenza ambientale separata: non vale come evidenza per alcun test
  P01-xx, che restano `Non eseguito`.

## Dipendenze

Solo `devDependencies`, versioni esatte:

| Pacchetto | Versione | Motivazione |
|---|---|---|
| `vite` | 8.3.4 | Dev server e build. Scelta la 8.3.4 invece della 8.3.5, pubblicata meno di 7 giorni prima del bootstrap |
| `typescript` | 7.0.2 | Typecheck strict (`tsc --noEmit`) |
| `vitest` | 5.0.5 | Test runner integrato con Vite, nessuna emulazione DOM necessaria |

Nessuna libreria crittografica: si usano esclusivamente le API standard del browser.

`pnpm audit` senza vulnerabilità note indica soltanto l'assenza di advisory pubblicati
alla data del controllo: non è una garanzia di sicurezza delle dipendenze.

## Requisiti

- Node.js 24.22.1 (vedi `.nvmrc` nella radice)
- pnpm 10.34.7 tramite `npx`, senza installazione globale

## Comandi

Dalla radice del repository:

```sh
nvm use
npx --yes pnpm@10.34.7 install --frozen-lockfile
npx --yes pnpm@10.34.7 p01:typecheck
npx --yes pnpm@10.34.7 p01:test
npx --yes pnpm@10.34.7 p01:build
npx --yes pnpm@10.34.7 p01:dev
```

Oppure dalla cartella `prototypes/p01-offline-crypto` con `npx --yes pnpm@10.34.7 <dev|typecheck|test|build|preview>`.

## Avvio in Safari su Mac

1. Avviare `npx --yes pnpm@10.34.7 p01:dev` dalla radice.
2. Aprire in Safari `http://localhost:5173/`.
   Il server ascolta solo su `localhost` (porta fissa 5173): `http://localhost` è un
   Secure Context, quindi `crypto.subtle` è disponibile anche senza HTTPS.
   Usare `localhost`, non l'indirizzo IP della rete locale.
3. Verificare che le tre righe risultino `Esposta`.
4. Il blocco JSON in fondo alla pagina può essere copiato come evidenza ENV-00
   (non contiene dati personali né segreti; contiene lo user agent).

Il dev server serve solo allo sviluppo: le prove crittografiche future si eseguono
esclusivamente su `vite preview` (vedi sotto).

## Modalità preview e header di sicurezza

```sh
npx --yes pnpm@10.34.7 p01:build
cd prototypes/p01-offline-crypto
npx --yes pnpm@10.34.7 preview
```

Aprire `http://localhost:4173/` in Safari. Il server di anteprima ascolta solo su
`localhost` e invia questi header (definiti in `PREVIEW_SECURITY_HEADERS`):

| Header | Valore |
|---|---|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |

`connect-src 'none'` impedisce alla pagina di aprire connessioni di rete: un esperimento
che tentasse una richiesta produrrebbe una violazione CSP visibile in Web Inspector.

Verifica manuale degli header:

```sh
curl -s -D - -o /dev/null http://localhost:4173/
```

La verifica automatica è in `tests/preview-headers.test.ts` (ENV-01). Entrambe controllano
che gli header siano presenti nella risposta HTTP, non che Safari li applichi: l'assenza
di violazioni CSP nella console di Safari è l'evidenza manuale ENV-02.

### Differenze rispetto al dev server

| Aspetto | `vite` (dev, porta 5173) | `vite preview` (porta 4173) |
|---|---|---|
| CSP e header di sicurezza | Assenti | Presenti |
| Codice servito | Moduli sorgente trasformati al volo, client HMR | Build di produzione statica |
| Connessioni | WebSocket HMR verso il server | Nessuna richiesta oltre agli asset statici |
| Stili | Iniettati come `<style>` inline dal client Vite | File CSS esterno |
| Uso ammesso | Sviluppo dell'interfaccia | Prove ed evidenze |

Il dev server non può usare la stessa CSP: il client HMR richiede una connessione
WebSocket e gli stili inline richiederebbero `style-src 'unsafe-inline'`.

### Limiti

- La CSP riduce la superficie di attacco XSS ma non è una difesa completa contro XSS o
  contro la compromissione dell'origine: non protegge da codice malevolo servito dalla
  stessa origine, da dipendenze compromesse incluse nel bundle o da estensioni del browser.
- `frame-ancestors` è efficace solo come header HTTP; `X-Frame-Options` è il fallback.
- `vite preview` accetta richieste CORS da altre origini `localhost` (comportamento
  predefinito di Vite). Le risposte sono asset statici senza dati.
- Questi header valgono per il laboratorio: non sono automaticamente trasferibili alla
  futura applicazione Next.js (ADR-0001).

## Avvio in WebStorm

1. Aprire la cartella `DoodleLab`.
2. Settings > Languages & Frameworks > Node.js: selezionare l'interprete
   `~/.nvm/versions/node/v24.22.1/bin/node`.
3. Settings > Languages & Frameworks > Node.js > Package manager: indicare pnpm
   (WebStorm rileva `packageManager` dal `package.json` della radice tramite Corepack;
   in alternativa usare il terminale integrato con i comandi sopra).
4. Settings > Languages & Frameworks > TypeScript: usare la versione del progetto
   (`prototypes/p01-offline-crypto/node_modules/typescript`).
5. Dal pannello npm del `package.json` della radice eseguire `p01:dev`, poi aprire
   `http://localhost:5173/` in Safari.

## iPhone Safari

Le prove su iPhone NON possono essere eseguite con questa configurazione:

- dal telefono il Mac è raggiungibile solo tramite IP di rete, e `http://<ip-del-mac>`
  non è un Secure Context, quindi `crypto.subtle` non sarebbe esposto;
- il dev server è intenzionalmente vincolato a `localhost`.

Serviranno un ambiente HTTPS con certificato attendibile per iOS e verifiche sul
dispositivo reale. La scelta dell'ambiente HTTPS (certificato locale, tunnel o hosting
di prova) è una decisione ancora da approvare: nessun servizio esterno è stato configurato.
I risultati ottenuti su Safari macOS non valgono come prova per Safari iOS.
