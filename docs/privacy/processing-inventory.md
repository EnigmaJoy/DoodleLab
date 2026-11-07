# Agenda — Inventario dei Trattamenti di Dati Personali

**Versione:** bozza  
**Data ultima revisione:** 2026-11-05  
**Ambito:** ui-shell (Next.js) — solo il frontend web

---

## 1. Trattamento: Autenticazione con Google OAuth 2.0

| Campo | Valore |
|---|---|
| **Finalità** | Identificazione e accesso dell'utente al servizio |
| **Base giuridica** | Art. 6(1)(b) GDPR — necessità contrattuale |
| **Dati trattati** | Indirizzo email Google, nome visualizzato, URL immagine profilo, Google sub (identificativo univoco, prefissato `google|`) |
| **Dove ricevuti** | Da Google LLC durante la risposta OAuth; non trasmessi dal Titolare |
| **Dove conservati** | JWT NextAuth firmato, all'interno del cookie `next-auth.session-token` |
| **Durata conservazione** | 30 giorni (valore predefinito NextAuth v4; non sovrascitto nel codice) |
| **Responsabile del trattamento** | Google LLC (autonomo) |
| **Trasferimento paesi terzi** | Sì — Google LLC, USA (DPF o SCC, da verificare) |
| **File di riferimento** | `lib/auth-options.ts`, `app/api/auth/[...nextauth]/route.ts` |

---

## 2. Trattamento: Cookie tecnici di sessione NextAuth

| Cookie | Durata | Contenuto | Finalità |
|---|---|---|---|
| `next-auth.session-token` | 30 giorni | JWT cifrato (sub, iat, exp, jti) | Mantiene la sessione autenticata tra richieste |
| `next-auth.csrf-token` | Sessione browser | Hash CSRF | Protezione CSRF (doppio invio del cookie) |
| `next-auth.callback-url` | Sessione browser | URL di reindirizzamento post-login | Reindirizzamento dopo autenticazione |

| Campo | Valore |
|---|---|
| **Base giuridica** | Art. 6(1)(f) GDPR — legittimo interesse; esenzione ePrivacy per cookie strettamente necessari |
| **Trasferimento paesi terzi** | No — i cookie rimangono sul dispositivo dell'utente |
| **File di riferimento** | `lib/auth-options.ts`, NextAuth v4 defaults |

---

## 3. Trattamento: Contenuti creati dall'utente (vault cifrato)

| Campo | Valore |
|---|---|
| **Finalità** | Persistenza locale dei contenuti inseriti dall'utente |
| **Base giuridica** | Art. 6(1)(b) GDPR — necessità contrattuale |
| **Dati trattati** | Attività, blocchi orari, eventi calendario, appunti (note), registri giornalieri |
| **Dove conservati** | `localStorage` del browser dell'utente, chiavi: `doodlelab:vault:data:{userId}:*` |
| **Cifratura** | AES-256-GCM, chiave derivata dal PIN utente con Argon2id (65 536 KB, 3 iterazioni) |
| **Trasmissione** | **Nessuna** — i dati cifrati non lasciano mai il dispositivo |
| **Durata conservazione** | Fino a cancellazione manuale o logout |
| **File di riferimento** | `lib/vault/vault-service.ts`, `lib/vault/vault-context.tsx`, `lib/storage/storage-adapter.ts` |

---

## 4. Trattamento: Metadati del vault (recovery hint)

| Campo | Valore |
|---|---|
| **Finalità** | Supporto al recupero del vault in caso di PIN dimenticato |
| **Base giuridica** | Art. 6(1)(b) GDPR — necessità contrattuale |
| **Dati trattati** | Suggerimento di recupero (testo libero, opzionale, immesso dall'utente); salt Argon2id; chiave master cifrata; timestamp di creazione |
| **Dove conservati** | `localStorage`, chiave: `doodlelab:vault:meta:{userId}:v1` |
| **Cifratura** | ⚠️ Il campo `recoveryHint` è conservato **in chiaro** nel metadata. Tutti gli altri campi sono cifrati. |
| **Trasmissione** | Nessuna |
| **File di riferimento** | `lib/vault/vault-service.ts` |

---

## 5. Trattamento: Preferenze UI

| Campo | Valore |
|---|---|
| **Finalità** | Personalizzazione dell'interfaccia utente |
| **Base giuridica** | Art. 6(1)(f) GDPR — legittimo interesse |
| **Dati trattati** | ID palette, flag effetti visivi, timeout blocco automatico |
| **Dove conservati** | `localStorage`, chiave: `doodlelab:preferences:v1` |
| **Cifratura** | No |
| **Trasmissione** | Nessuna |
| **File di riferimento** | `lib/PreferencesContext.tsx` |

---

## 6. Trattamento: Stato UI di sessione

| Campo | Valore |
|---|---|
| **Finalità** | Mantenimento dello stato dell'interfaccia durante la sessione |
| **Base giuridica** | Art. 6(1)(f) GDPR — legittimo interesse |
| **Dati trattati** | Stato espanso/collassato dei pannelli UI |
| **Dove conservati** | `sessionStorage`, chiave: `doodlelab:panel-state` |
| **Durata** | Solo durante la sessione del browser |
| **Trasmissione** | Nessuna |

---

## 7. Trattamenti NON presenti (da escludere dall'informativa)

- Nessun analytics (niente Google Analytics, Segment, Mixpanel, Hotjar, Sentry, ecc.)
- Nessun pixel di tracciamento
- Nessuna comunicazione di dati a server del Titolare (l'ui-shell non ha API backend collegate)
- Nessuna CDN esterna a runtime (i font Google sono auto-ospitati a build time)
- Nessuna profilazione automatizzata
- Nessun TOTP/MFA nell'ui-shell (presente nel backend, ma non connesso)
- Nessuna integrazione Google Calendar attiva
- Nessun riconoscimento vocale o trascrizione
- Nessuna sincronizzazione cloud del vault

---

## 8. Funzionalità future da NON includere nell'informativa corrente

- Vault cifrato con sincronizzazione cloud (non ancora implementato)
- Integrazione Google Calendar (non connessa)
- Riconoscimento vocale / trascrizione
- Backend NestJS / PostgreSQL (configurato ma non usato dall'ui-shell)

---

## 9. Chiarimenti richiesti al Titolare (REQUIRED BEFORE PUBLICATION)

| # | Questione | Impatto sull'informativa |
|---|---|---|
| 1 | **Identità del Titolare**: ragione sociale, sede legale, P.IVA/codice fiscale | Sezione 1 — obbligatoria ex art. 13 GDPR |
| 2 | **Contatto privacy**: indirizzo email dedicato o riferimento al Titolare | Sezione diritti degli interessati — obbligatorio |
| 3 | **DPO**: valutare obbligo ex art. 37 GDPR; se nominato, indicare nome e recapiti | Sezione 2 — obbligatoria se DPO presente |
| 4 | **Provider di hosting**: nome, paese, eventuale accordo DPA ex art. 28 GDPR | Sezione destinatari/trasferimenti |
| 5 | **Architettura Keycloak**: il codice ui-shell usa Google OAuth direttamente via NextAuth, senza Keycloak. Il backend ha Keycloak configurato. Quale è il percorso di autenticazione in produzione? | Sezione autenticazione — potenzialmente tutta da riscrivere |
| 6 | **Politica di conservazione formale**: la durata JWT di 30 giorni è il default di NextAuth (non configurata esplicitamente). È la durata intenzionale? Qual è la policy per la cancellazione dei dati vault alla chiusura dell'account? | Sezione durata conservazione |
| 7 | **Accordo di trattamento dati (DPA) con Google**: esiste un DPA firmato con Google per l'uso di Google Sign-In? Quale meccanismo di trasferimento è applicabile (DPF, SCC)? | Sezione trasferimenti internazionali |
| 8 | **Autorità di controllo competente**: Garante italiano? Altra Autorità? Dipende dal paese di stabilimento del Titolare | Sezione reclami |
| 9 | **Utenza**: l'app è destinata solo a utenti maggiorenni? Esistono limitazioni geografiche? | Eventuale sezione minori |
| 10 | **Recovery hint**: avvisare gli utenti di non inserire dati personali sensibili nel campo suggerimento (conservato in chiaro). Considerare la cifratura del campo. | Sezione contenuti dell'utente |
