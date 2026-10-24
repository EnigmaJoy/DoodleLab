# P-01 - Offline Crypto: Test Matrix

**Progetto:** DoodleLab  
**Repository:** https://github.com/EnigmaJoy/DoodleLab  
**Baseline:** Master Prompt Agenda ADHD v2.3.4 (riferimento in [`specifications/README.md`](../../specifications/README.md))  
**Branch:** `experiment/p01-offline-crypto`  
**Stato:** Pianificazione - nessun test crittografico eseguito

## 1. Obiettivo

Verificare sperimentalmente i requisiti di sicurezza, cifratura, persistenza e recupero delle chiavi previsti per P-01.

I risultati serviranno a valutare la fattibilità tecnica delle decisioni D-14, D-15 e D-19, senza modificare le decisioni di prodotto già congelate.

Questa matrice segue la struttura dell'Acceptance Test Matrix richiesta dal Master Prompt v2.3.4 (sezione 15, "Artefatti obbligatori prima del codice definitivo"): ID requisito, scenario, precondizioni, dispositivo, modalità automatica o manuale, risultato atteso, stato, evidenze.

## 2. Ambiente di test

| Elemento | Configurazione |
|---|---|
| Computer | Mac Apple Silicon |
| IDE | WebStorm |
| Browser iniziale | Safari su macOS |
| Browser da validare | Safari su iPhone (dispositivo reale, contesto HTTPS attendibile) |
| Linguaggio | TypeScript |
| API previste | Web Crypto (`crypto.subtle`), IndexedDB, WebAuthn con estensione PRF, StorageManager (`navigator.storage.persist()`, `navigator.storage.persisted()`) |
| Modalità di esecuzione delle prove crittografiche | `vite preview` con gli header di sicurezza di `vite.config.ts`, mai il dev server |
| Dati utilizzati | Esclusivamente sintetici |

Le versioni effettive di macOS, iOS, Safari, Node.js e delle dipendenze saranno registrate al momento dell'esecuzione.

Abbreviazioni dei dispositivi: **Mac** = Safari su macOS; **iPhone** = Safari su iPhone reale; **Mac + iPhone** = entrambi, con esiti registrati separatamente. I risultati su Safari macOS non valgono come prova per Safari iOS.

Stati ammessi: `Superato`, `Fallito`, `Bloccato`, `Non eseguito`.

## 3. Evidenze ambientali (ENV)

Le evidenze ENV descrivono l'ambiente di esecuzione. Non sono test crittografici e non possono essere usate come evidenza per alcun test P01-xx.

| ID | Requisito | Scenario | Precondizioni | Dispositivo | Modalità | Risultato atteso | Stato | Evidenze |
|---|---|---|---|---|---|---|---|---|
| ENV-00 | Nessuno (supporto) | Smoke test di presenza delle API: Secure Context, `crypto.subtle` e relativi metodi, `crypto.getRandomValues`, `indexedDB.open`, informazioni sul browser | Pagina P-01 servita su `localhost` o HTTPS attendibile | Mac + iPhone | Manuale (pagina P-01) con logica coperta da test automatici su ambienti sintetici | Report JSON con `evidenceId: "ENV-00"`, `scope: "api-presence-only"`, `cryptoValidated: false`. La presenza delle API non dimostra il supporto degli algoritmi | Non eseguito | - |
| ENV-01 | Master Prompt sez. 12 "Sicurezza applicativa" (CSP e security headers), applicato al solo laboratorio | Presenza degli header di sicurezza nella risposta HTTP di `vite preview` | Build eseguita | Node.js (nessun browser) | Automatica (`tests/preview-headers.test.ts`) e manuale (`curl -I`) | Tutti gli header definiti in `PREVIEW_SECURITY_HEADERS` presenti sulle risposte HTML e sugli asset | Superato (2026-10-22) | Verifica della sola presenza degli header; non dimostra l'applicazione della CSP da parte del browser. Dettagli nel report della Fase A |
| ENV-02 | Come ENV-01 | Nessuna violazione CSP nella console di Safari durante il caricamento della pagina P-01 in `vite preview` | ENV-01 superato | Mac + iPhone | Manuale (Web Inspector) | Nessun messaggio di violazione CSP; pagina funzionante | Non eseguito | - |

## 4. Test eseguibili nel prototipo isolato P-01

Nessuno di questi test può essere eseguito prima che la procedura crittografica sia specificata passo per passo e approvata (Master Prompt sez. 11, "Continuità della cattura sotto protezione crittografica"; D-14).

| ID | Requisito | Scenario | Precondizioni | Dispositivo | Modalità | Risultato atteso | Stato | Evidenze |
|---|---|---|---|---|---|---|---|---|
| P01-01 | CRYPTO-04 | Generazione della coppia di chiavi | Procedura D-14 approvata; ENV-00 ed ENV-02 eseguiti | Mac + iPhone | Manuale con supporto automatico | Generazione corretta; nessuna chiave privata persistita in chiaro | Non eseguito | - |
| P01-02 | CRYPTO-04, D-23 | Wrapping della chiave privata | P01-01; meccanismo di wrapping sperimentale approvato (D-14) | Mac + iPhone | Manuale con supporto automatico | La chiave privata persistita esiste solo in forma wrapped; nessuna copia utilizzabile senza sblocco | Non eseguito | - |
| P01-03 | CRYPTO-01, AUTH-03 (parte locale), D-10 | Cattura con lettura bloccata | P01-02; profilo in stato di lettura bloccata | Mac + iPhone | Manuale | Contenuto cifrato con la chiave pubblica prima della persistenza; nessuna chiave privata o contenuto precedente accessibile; nessun dato cancellato | Non eseguito | - |
| P01-04 | CRYPTO-03, D-24 | Lettura senza sblocco con chiave privata wrapped presente nello storage | P01-02, P01-03 | Mac + iPhone | Manuale | Impossibile decifrare senza lo sblocco previsto, nei limiti del threat model | Non eseguito | - |
| P01-05 | CRYPTO-04, D-23 | Sblocco e nuovo blocco | P01-02; meccanismo di sblocco sperimentale scelto tra P01-13 e P01-14 | Mac + iPhone | Manuale | Decifratura possibile solo durante la sessione sbloccata; dopo il nuovo blocco l'applicazione rilascia i riferimenti alla chiave privata e nuove letture falliscono. I limiti della cancellazione dalla memoria sono documentati nel threat model (R-05) | Non eseguito | - |
| P01-06 | STORE-01 (parte locale) | Chiusura e riapertura di Safari | P01-03 | Mac + iPhone | Manuale | I dati cifrati rimangono recuperabili se lo storage è conservato | Non eseguito | - |
| P01-07 | STORE-01 (esito "storage eliminato") | Perdita dello storage (dati del sito cancellati) | P01-03 | Mac + iPhone | Manuale | Perdita rilevata e comunicata; nessuna falsa garanzia di recupero; esito distinto da "persistenza rifiutata" | Non eseguito | - |
| P01-08 | AUTH-06, D-19 | Manipolazione dell'orologio: cambio manuale della data, riavvio, accesso vicino alla scadenza, scenario documentale di 45 giorni a dispositivo spento con orologio riportato vicino all'ultimo valore | P01-02; regola sperimentale del watermark descritta nella procedura approvata | Mac + iPhone | Manuale | Applicazione della regola del Master Prompt: tempo effettivo = maggiore tra ora corrente e ultima ora osservata; regressione dell'orologio = lettura bloccata come se l'accesso fosse scaduto; spostamento in avanti = accesso solo accorciato. Il tempo a dispositivo spento non è misurabile ed è registrato come limite noto (R-02) | Non eseguito | - |
| P01-09 | KEY-01 (parte locale), D-15 | Recupero della chiave privata su un secondo dispositivo | Strategia di recupero D-15 approvata; P01-02 | Mac + iPhone (due dispositivi) | Manuale | Dati cifrati leggibili dopo il recupero, soltanto mediante il meccanismo autorizzato. La verifica lato server è in I-02 | Non eseguito | - |
| P01-10 | CRYPTO-02 (parte locale) | Due profili sullo stesso dispositivo; cattura con lettura bloccata mentre è attivo un profilo | P01-03 per due profili distinti, ciascuno con la propria coppia di chiavi | Mac + iPhone | Manuale | Cattura legata al profilo bloccato in quel momento; nessuna decifratura incrociata; nessuna lettura nell'account sbagliato. La parte di sincronizzazione è in I-01 | Non eseguito | - |
| P01-11 | D-14 (alternativa passkey) | Disponibilità di WebAuthn PRF | Contesto sicuro; autenticatore di prova senza dati personali | Mac + iPhone | Manuale | Disponibilità e comportamento verificati su Safari reale; nessun supporto presunto dalla documentazione | Non eseguito | - |
| P01-12 | Nessun requisito diretto (esplorativo) | Chiave precedente con catture pendenti: rotazione simulata | P01-02, P01-03 | Mac | Manuale | Osservazione documentata. **Test esplorativo:** il Master Prompt non definisce la rotazione delle chiavi; l'esito non costituisce una decisione approvata e non modifica D-14 o D-15 | Non eseguito | - |
| P01-13 | D-14 (alternativa passphrase) | Derivazione della chiave di wrapping da passphrase sintetica; sblocco e nuovo blocco | Parametri di derivazione approvati nella procedura D-14 | Mac + iPhone | Manuale con supporto automatico | Sblocco riuscito con la passphrase corretta; rifiuto con passphrase errata; tempi di derivazione misurati e registrati | Non eseguito | - |
| P01-14 | D-14 (alternativa passkey) | Derivazione della chiave di wrapping tramite WebAuthn PRF; sblocco e nuovo blocco | P01-11 con esito positivo; parametri approvati nella procedura D-14 | Mac + iPhone | Manuale | Sblocco riuscito con l'autenticatore registrato; rifiuto con autenticatore diverso; comportamento dopo riavvio documentato | Non eseguito | - |
| P01-15 | STORE-01 (esiti della persistenza) | Richiesta di storage persistente: esiti "concessa" e "rifiutata" | Contesti di prova distinti (scheda del browser, app aggiunta alla schermata Home) | Mac + iPhone | Manuale | Esiti distinti registrati per persistenza concessa e persistenza rifiutata; nessuna promessa di permanenza. L'esito "storage eliminato" è in P01-07 | Non eseguito | - |
| P01-16 | AUTH-02 (parte locale), D-19 | Riapertura offline entro la finestra di accesso, senza rete | P01-05, P01-08 | Mac + iPhone | Manuale | Sblocco locale e accesso ai dati cifrati senza alcuna richiesta di rete; nessun dato perso. La parte relativa alla sessione online scaduta è in I-03 | Non eseguito | - |

### Confronto tra le alternative di sblocco

La valutazione di passphrase (P01-13) e WebAuthn PRF (P01-11, P01-14) registra per ciascuna alternativa: disponibilità su Mac e iPhone, comportamento dopo riavvio e cancellazione dei dati, impatto sul recupero (D-15), esperienza d'uso e rischi residui. Il confronto alimenta un ADR; non costituisce di per sé la scelta di D-14.

## 5. Test che richiedono integrazione con altri componenti

Questi test non possono essere completati nel prototipo isolato. Le parti locali, dove esistono, sono coperte dai test P01-xx indicati.

| ID | Requisito | Scenario | Componenti necessari | Precondizioni | Dispositivo | Modalità | Risultato atteso | Stato | Evidenze |
|---|---|---|---|---|---|---|---|---|---|
| I-01 | CRYPTO-02 (sincronizzazione), D-26 | Cattura con lettura bloccata su dispositivo usato da due account, poi sincronizzazione | Autenticazione, sincronizzazione | P01-10 | Mac + iPhone | Automatica e manuale | Nessuna sincronizzazione nell'account sbagliato; sincronizzazione solo dopo sblocco e sessione online autorizzata dell'account proprietario | Non eseguito | - |
| I-02 | KEY-01 (lato server), D-15 | Recupero su secondo dispositivo con eventuale componente server | Strategia D-15 approvata; server di prova se previsto dalla strategia | P01-09 | Mac + iPhone | Automatica e manuale | Nessuna chiave privata in chiaro sul server | Non eseguito | - |
| I-03 | AUTH-02 | Riapertura offline con sessione online scaduta, entro 30 giorni | Identity provider, sessioni | P01-16 | Mac + iPhone | Manuale | Accesso offline ai dati locali; nessuna chiamata autenticata al server; nessun dato perso | Non eseguito | - |
| I-04 | AUTH-03, D-19 | Riapertura offline oltre 30 giorni dall'ultima verifica online | Identity provider (registrazione dell'ultima verifica online) | P01-03, P01-08 | Mac + iPhone | Manuale | Lettura bloccata; cattura cifrata ancora possibile; nessun dato cancellato | Non eseguito | - |
| I-05 | STORE-01 (interfaccia) | Post-it offline non sincronizzato | Interfaccia applicativa, sincronizzazione | P01-06, P01-07, P01-15 | Mac + iPhone | Manuale | Indicatore "solo su questo dispositivo"; conferma mostrata solo dopo scrittura locale verificata | Non eseguito | - |
| I-06 | VOICE-06 | Registrazione in sospeso salvata mentre l'app è bloccata | Collaborazione tra P-01 (cifratura con chiave pubblica) e P-02 (trascrizione locale) | P01-03; prototipo P-02 disponibile | iPhone | Manuale | Audio cifrato con la chiave pubblica; trascrizione dopo sblocco autorizzato; cancellazione al salvataggio del testo | Non eseguito | - |
| I-07 | AUTH-07, D-21 | Dispositivo revocato che resta offline | Revoca lato server, autenticazione | P01-02 | Mac + iPhone | Manuale | Uso locale possibile finché il dispositivo non apprende della revoca, entro i limiti del wrapping; rischio residuo documentato (R-01) | Non eseguito | - |

## 6. Test fuori ambito per P-01

Questi test non possono essere dichiarati superati sulla base di P-01.

| ID | Requisito | Motivazione | Responsabile |
|---|---|---|---|
| AUTH-05 | D-21, D-25 | Revoca server-side, blocco locale e cancellazione autorizzata richiedono componenti server e autenticazione | Fase 4 "Fondamenta" (autenticazione e MFA) e Security & Privacy Specification |
| AUTH-08 | D-25 | Il rifiuto della riattivazione con sole credenziali richiede il server di autorizzazione dei dispositivi | Fase 4 "Fondamenta" e Security & Privacy Specification |
| SYNC-04 | D-26 | Richiede un server di sincronizzazione di prova, outbox e riconciliazione tramite `operation_id`. Rinviato | Database & Sync Specification; fase 9 (offline e sincronizzazione) |
| AUTH-04 | Stati di autenticazione | Outbox di A con accesso come B: richiede autenticazione e sincronizzazione | Fase 4 e Database & Sync Specification |

## 7. Corrispondenza con il Master Prompt

| Requisito | Test P-01 (isolato) | Test di integrazione | Fuori ambito |
|---|---|---|---|
| CRYPTO-01 | P01-03 | - | - |
| CRYPTO-02 | P01-10 | I-01 | - |
| CRYPTO-03 | P01-04 | - | - |
| CRYPTO-04 | P01-01, P01-02, P01-05 | - | - |
| KEY-01 | P01-09 | I-02 | - |
| AUTH-02 | P01-16 | I-03 | - |
| AUTH-03 | P01-03, P01-08 | I-04 | - |
| AUTH-06 | P01-08 | - | - |
| AUTH-07 | - | I-07 | - |
| STORE-01 | P01-06, P01-07, P01-15 | I-05 | - |
| VOICE-06 | - | I-06 | - |
| AUTH-04 | - | - | Sezione 6 |
| AUTH-05 | - | - | Sezione 6 |
| AUTH-08 | - | - | Sezione 6 |
| SYNC-04 | - | - | Sezione 6 |

Corrispondenza con le decisioni (Master Prompt, Allegato A): D-14 e D-23 -> P01-01, P01-02, P01-05, P01-11, P01-13, P01-14; D-15 -> P01-09, I-02; D-19 -> P01-08, P01-16, I-04; D-24 -> P01-03, P01-04; D-25 -> AUTH-05, AUTH-08 (fuori ambito); D-26 -> P01-10, I-01, SYNC-04 (fuori ambito).

## 8. Regole di esecuzione

Per ciascun test registrare:

- Data dell'esecuzione
- Dispositivo e versioni software
- Precondizioni
- Procedura riproducibile
- Risultato osservato
- Stato: superato, fallito, bloccato o non eseguito
- Evidenze tecniche senza contenuti personali o chiavi segrete
- Problemi e rischi residui

Nessun test può essere dichiarato superato senza esecuzione ed evidenza.

Le evidenze ENV non sostituiscono le evidenze dei test P01-xx o I-xx.

## 9. Criterio di completamento

P-01 potrà essere valutato soltanto quando:

1. Le prove crittografiche essenziali saranno state eseguite.
2. I limiti di Safari saranno documentati.
3. Saranno confrontate le alternative di sblocco.
4. Il recupero delle chiavi sarà stato verificato.
5. I rischi residui saranno stati registrati.
6. Sarà disponibile un ADR con raccomandazione motivata.

Il completamento del prototipo non autorizza automaticamente l'utilizzo del codice in produzione.

## 10. Esito finale

**Stato complessivo:** NON VALIDATO

**Decisione tecnica:** DA DETERMINARE

**ADR collegato:** Da creare dopo le prove. ADR-0001 riguarda soltanto lo strumento di laboratorio (Vite), non la decisione crittografica.
