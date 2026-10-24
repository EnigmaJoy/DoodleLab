# ADR-0001 - Vite come strumento del laboratorio P-01

**Stato:** Proposto (preliminare) - da approvare  
**Data:** 2026-10-22  
**Ambito:** esclusivamente il prototipo isolato `prototypes/p01-offline-crypto`  
**Baseline:** Master Prompt Agenda ADHD v2.3.4 (riferimento in [`specifications/README.md`](../../specifications/README.md))  
**Decisioni collegate:** D-02 (stack, Congelata), D-14, D-15, D-19 (Bloccanti, non toccate da questo ADR)

## Riepilogo

- **Decisione:** il laboratorio P-01 usa Vite, TypeScript strict e Vitest senza framework UI.
- **Non decide:** lo stack di produzione, che resta quello di D-02 (PWA, Next.js, NestJS, PostgreSQL, pg-boss).
- **Rischi:** trasferire alla futura applicazione risultati che dipendono dallo strumento (CSP, header HTTP, service worker).
- **Da approvare:** l'utilizzo di Vite come strumento del solo laboratorio, già autorizzato nel prompt di bootstrap di P-01 e qui registrato formalmente.

## Contesto

Il Master Prompt v2.3.4 fissa lo stack in D-02 (sezione 11, "Tecnologie preferite") e stabilisce che ogni scostamento va motivato e approvato. Lo stesso documento ammette e richiede prototipi isolati prima del codice definitivo, con la regola che nessun prototipo diventa codice di produzione (sezione 13, "Incrementi interni e release completa").

P-01 deve verificare in Safari le primitive Web Crypto, IndexedDB, WebAuthn PRF e StorageManager. Queste API appartengono al browser e non al framework.

## Decisione

Per il solo laboratorio P-01 si usano:

- Vite come dev server, build e server di anteprima (`vite preview`) con header di sicurezza
- TypeScript strict
- Vitest per i test automatici
- Nessun framework UI e nessuna dipendenza runtime

Vite non sostituisce Next.js nello stack di produzione. La decisione sullo stack definitivo resta quella del Master Prompt v2.3.4 (D-02, Congelata).

## Alternative considerate

| Alternativa | Vantaggi | Svantaggi |
|---|---|---|
| Next.js (stack di produzione) | Stessi meccanismi di header e build della futura app | Server, routing e rendering lato server non necessari per verificare API del browser; più dipendenze e superficie; rischio di trasformare il prototipo in base di produzione |
| HTML statico senza strumenti | Nessuna dipendenza | Nessun TypeScript strict, nessun test automatico, nessun server con header configurabili |
| Vite (scelta) | Dipendenze minime, TypeScript strict, `vite preview` con header configurabili, test integrati | Pipeline diversa da quella di produzione |

## Conseguenze

- I risultati sulle primitive Web Crypto, IndexedDB, WebAuthn PRF e StorageManager sono valutabili indipendentemente dal framework, entro i limiti del browser, della versione e del dispositivo su cui sono stati osservati.
- I risultati relativi a CSP, header HTTP e service worker non sono automaticamente trasferibili alla futura applicazione Next.js: la configurazione degli header, la gestione degli script inline e la registrazione dei service worker differiscono e andranno verificate di nuovo.
- Il dev server di Vite non applica la CSP del laboratorio (vedi README di P-01): le prove crittografiche si eseguono solo su `vite preview`.
- Il codice di P-01 non viene promosso a produzione.

## Rischi residui

- Un esito positivo su Vite potrebbe essere letto come esito positivo per Next.js: ogni risultato dipendente dallo strumento va marcato come tale nella matrice dei test.
- Le dipendenze di sviluppo (Vite, Vitest, TypeScript) restano parte della superficie di supply chain del laboratorio, anche se non incluse nel bundle eseguito nel browser.
- Le differenze tra `vite preview` e un hosting HTTPS reale (necessario per iPhone) non sono ancora valutate.
