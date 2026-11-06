// app/privacy/page.tsx
// Public route — no authentication required.
// This page is accessible before login and by authenticated users alike.
// It is intended as the privacy policy URL for Google OAuth branding settings.
//
// ⚠️  BOZZA INTERNA — NON PUBBLICARE FINO ALL'APPROVAZIONE LEGALE
//     Tutti i riquadri arancioni contengono informazioni mancanti.
//     Sostituire ogni riquadro con il contenuto corretto prima della pubblicazione.

import Link from 'next/link'
import type { Metadata } from 'next'
import styles from './Privacy.module.css'

export const metadata: Metadata = {
  title: 'Informativa sulla Privacy — Agenda',
  description: 'Informativa sul trattamento dei dati personali di Agenda, ai sensi degli artt. 12 e 13 del Regolamento (UE) 2016/679.',
}

// Last revision date — update this when the notice is modified.
const LAST_REVISION = '2026-11-05'

export default function PrivacyPage() {
  return (
    <div className={styles.root}>

      {/* ── Top navigation ───────────────────────────────────────── */}
      <nav className={styles.topNav} aria-label="Navigazione pagina">
        <Link href="/login" className={styles.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Agenda
        </Link>
      </nav>

      {/* ── Main content card ─────────────────────────────────────── */}
      <main className={styles.card}>

        {/* Title block */}
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>Informativa sulla Privacy</h1>
          <p className={styles.subtitle}>
            Ai sensi degli articoli 12 e 13 del Regolamento (UE) 2016/679 (GDPR)
          </p>
          <span className={styles.revisionDate}>
            Ultima revisione: {LAST_REVISION}
          </span>
        </div>

        <div className={styles.body}>

          {/* ── 1. Titolare del trattamento ─────────────────────── */}
          <h2>1. Titolare del trattamento</h2>

          <Required label="REQUIRED BEFORE PUBLICATION — Titolare del trattamento">
            Indicare la denominazione o il nome completo del titolare, la sede legale,
            il numero di partita IVA o codice fiscale, e un indirizzo e-mail dedicato
            per le richieste in materia di privacy (es. privacy@example.com).
            Queste informazioni sono obbligatorie ai sensi dell&apos;art. 13, par. 1, lett. a, GDPR.
          </Required>

          <p>
            Il trattamento dei dati personali degli utenti dell&apos;applicazione Agenda è effettuato
            dal Titolare del trattamento indicato di seguito.
          </p>

          {/* ── 2. DPO ─────────────────────────────────────────── */}
          <h2>2. Responsabile della protezione dei dati (DPO)</h2>

          <Required label="REQUIRED BEFORE PUBLICATION — DPO">
            Valutare se l&apos;obbligo di nomina del DPO si applica ai sensi dell&apos;art. 37 GDPR.
            Se il DPO è stato nominato, indicarne nome e recapiti (e-mail e/o indirizzo postale).
            Se la nomina non è obbligatoria e non è stata effettuata, indicare:
            &ldquo;L&apos;applicazione non ha designato un DPO in quanto non ricorrono le condizioni
            di cui all&apos;art. 37 GDPR.&rdquo;
          </Required>

          {/* ── 3. Dati personali trattati ───────────────────────── */}
          <h2>3. Dati personali trattati e finalità del trattamento</h2>

          <h3>3.1 Autenticazione con Google</h3>

          <p>
            L&apos;applicazione utilizza il protocollo OAuth 2.0 / OpenID Connect di Google per
            consentire l&apos;accesso degli utenti. Al momento dell&apos;autenticazione, Google trasmette
            all&apos;applicazione le seguenti informazioni del profilo:
          </p>
          <ul>
            <li>indirizzo e-mail associato all&apos;account Google;</li>
            <li>nome visualizzato (display name);</li>
            <li>URL dell&apos;immagine del profilo;</li>
            <li>identificativo univoco dell&apos;account Google (<em>sub</em>).</li>
          </ul>
          <p>
            Questi dati sono utilizzati esclusivamente per identificare l&apos;utente all&apos;interno
            dell&apos;applicazione. Nessuna informazione di profilo Google viene trasmessa a server
            del Titolare né conservata in basi di dati del Titolare. L&apos;identificativo univoco
            viene memorizzato, in forma cifrata, all&apos;interno del cookie di sessione descritto
            al punto 3.2.
          </p>

          <Required label="REQUIRED BEFORE PUBLICATION — Architettura Keycloak">
            Il codice attuale dell&apos;applicazione (ui-shell) utilizza Google OAuth direttamente
            tramite la libreria NextAuth, senza intermediazione di Keycloak.
            Se nell&apos;ambiente di produzione Keycloak è presente nel percorso di autenticazione,
            questa sezione deve essere integrata con: (a) l&apos;identità del server Keycloak,
            (b) i dati ricevuti da Keycloak, (c) se Keycloak agisce come responsabile del trattamento
            o come titolare autonomo.
          </Required>

          <p>
            <strong>Base giuridica:</strong>{' '}
            Art. 6, par. 1, lett. b, GDPR — il trattamento è necessario all&apos;esecuzione
            del contratto di servizio di cui l&apos;utente è parte.
          </p>

          <h3>3.2 Cookie tecnici di sessione</h3>
          <p>
            Per il funzionamento dell&apos;autenticazione l&apos;applicazione imposta i seguenti
            cookie tecnici:
          </p>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nome cookie</th>
                  <th scope="col">Durata</th>
                  <th scope="col">Contenuto</th>
                  <th scope="col">Finalità</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>next-auth.session-token</code></td>
                  <td>30 giorni</td>
                  <td>JWT cifrato con identificativo utente e scadenza</td>
                  <td>Mantiene la sessione autenticata tra le richieste</td>
                </tr>
                <tr>
                  <td><code>next-auth.csrf-token</code></td>
                  <td>Sessione</td>
                  <td>Hash di sicurezza</td>
                  <td>Protezione contro attacchi CSRF</td>
                </tr>
                <tr>
                  <td><code>next-auth.callback-url</code></td>
                  <td>Sessione</td>
                  <td>URL di reindirizzamento</td>
                  <td>Reindirizzamento post-autenticazione</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            I cookie sopra indicati sono strettamente necessari al funzionamento del servizio:
            senza di essi non è possibile accedere all&apos;applicazione. In produzione su connessione
            HTTPS sono impostati con i flag <code>HttpOnly</code>, <code>Secure</code>{' '}
            e <code>SameSite=Lax</code>.
          </p>
          <p>
            <strong>Base giuridica:</strong>{' '}
            Art. 6, par. 1, lett. f, GDPR — legittimo interesse del Titolare al funzionamento
            sicuro del servizio. L&apos;uso di questi cookie rientra nell&apos;esenzione per cookie
            strettamente necessari ai sensi dell&apos;art. 5, par. 3, della Direttiva 2002/58/CE
            (Direttiva ePrivacy), recepita in Italia dal D.Lgs. 196/2003 come modificato dal
            D.Lgs. 101/2018. Non è richiesto il consenso.
          </p>

          <h3>3.3 Contenuti creati dall&apos;utente</h3>
          <p>
            I contenuti inseriti dall&apos;utente nell&apos;applicazione — comprendenti attività,
            blocchi orari, eventi del calendario, appunti e note, registri giornalieri — sono
            conservati esclusivamente sul dispositivo dell&apos;utente, all&apos;interno della
            memoria locale del browser (<em>localStorage</em>).
          </p>
          <p>
            La cifratura dei dati avviene interamente lato client, mediante l&apos;algoritmo
            AES-256-GCM, con chiave derivata dal PIN scelto dall&apos;utente tramite la funzione
            di derivazione Argon2id. I dati cifrati non vengono mai trasmessi al Titolare né
            ad alcun servizio esterno.
          </p>
          <p>
            Il campo &ldquo;suggerimento di recupero&rdquo; (<em>recovery hint</em>), qualora
            l&apos;utente scelga facoltativamente di impostarlo, è conservato in forma non cifrata
            nella memoria locale del browser. Si raccomanda di non inserire in tale campo
            informazioni personali sensibili.
          </p>
          <p>
            <strong>Base giuridica:</strong>{' '}
            Art. 6, par. 1, lett. b, GDPR — il trattamento è necessario all&apos;esecuzione
            del contratto di servizio.
          </p>

          <h3>3.4 Preferenze dell&apos;interfaccia utente</h3>
          <p>
            Le impostazioni dell&apos;interfaccia scelte dall&apos;utente (palette di colori,
            effetti visivi, timeout di blocco automatico) sono conservate in forma non cifrata
            nella memoria locale del browser. Questi dati non vengono trasmessi al Titolare.
          </p>
          <p>
            <strong>Base giuridica:</strong>{' '}
            Art. 6, par. 1, lett. f, GDPR — legittimo interesse del Titolare a fornire
            un&apos;esperienza utente coerente.
          </p>

          {/* ── 4. Durata della conservazione ────────────────────── */}
          <h2>4. Durata della conservazione</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Dato</th>
                  <th scope="col">Durata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cookie di sessione NextAuth (<code>session-token</code>)</td>
                  <td>30 giorni dalla firma del token JWT</td>
                </tr>
                <tr>
                  <td>Contenuti cifrati nel vault (localStorage)</td>
                  <td>Fino alla cancellazione manuale da parte dell&apos;utente</td>
                </tr>
                <tr>
                  <td>Preferenze UI (localStorage)</td>
                  <td>Fino alla cancellazione manuale o al logout</td>
                </tr>
                <tr>
                  <td>Stato UI di sessione (sessionStorage)</td>
                  <td>Fino alla chiusura della scheda/finestra del browser</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Required label="REQUIRED BEFORE PUBLICATION — Politica di conservazione">
            Definire e documentare una politica formale di conservazione.
            In particolare: (a) la durata JWT di 30 giorni è quella predefinita dalla libreria
            NextAuth e non è stata configurata esplicitamente — confermare che sia la durata
            intenzionale oppure ridurla; (b) definire la procedura per la cancellazione dei
            dati vault su richiesta dell&apos;interessato (attualmente non è presente una funzione
            di eliminazione account nell&apos;applicazione).
          </Required>

          {/* ── 5. Destinatari ───────────────────────────────────── */}
          <h2>5. Destinatari dei dati</h2>

          <p>
            I dati personali degli utenti non sono venduti né ceduti a terzi per finalità di
            marketing o profilazione.
          </p>
          <p>
            L&apos;unico soggetto terzo che riceve dati personali in relazione all&apos;uso
            dell&apos;applicazione è:
          </p>
          <ul>
            <li>
              <strong>Google LLC</strong> (1600 Amphitheatre Parkway, Mountain View, CA 94043, USA):
              destinatario dei dati di autenticazione nel contesto del servizio Google Sign-In /
              OAuth 2.0. Google tratta i dati secondo la propria Informativa sulla privacy
              (disponibile su <a href="https://policies.google.com/privacy"
              target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>) e agisce
              come titolare autonomo del trattamento rispetto ai propri servizi.
            </li>
          </ul>

          <Required label="REQUIRED BEFORE PUBLICATION — Provider di hosting">
            Indicare il nome e il paese del provider di hosting dell&apos;applicazione.
            Se i dati di sessione (cookie) transitano per server di hosting, il fornitore
            deve essere qualificato come responsabile del trattamento ex art. 28 GDPR e deve
            essere stipulato un apposito accordo DPA.
          </Required>

          {/* ── 6. Trasferimenti verso paesi terzi ───────────────── */}
          <h2>6. Trasferimenti verso paesi terzi</h2>

          <p>
            L&apos;autenticazione tramite Google Sign-In comporta un trasferimento di dati verso
            gli Stati Uniti, dove Google LLC ha la propria sede principale. I contenuti creati
            dall&apos;utente e le preferenze UI non vengono mai trasferiti al di fuori del
            dispositivo dell&apos;utente.
          </p>

          <Required label="REQUIRED BEFORE PUBLICATION — Meccanismo di trasferimento Google">
            Verificare e indicare il meccanismo applicabile per il trasferimento dei dati verso
            Google LLC: (a) Decisione di adeguatezza — Data Privacy Framework UE-USA (Decisione
            della Commissione Europea del 10 luglio 2023), se Google LLC risulta iscritta al DPF;
            oppure (b) Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea.
            Verificare inoltre se il provider di hosting comporta trasferimenti al di fuori
            dell&apos;UE/SEE e indicare le garanzie appropriate.
          </Required>

          {/* ── 7. Necessità del conferimento ────────────────────── */}
          <h2>7. Necessità del conferimento dei dati</h2>

          <p>
            Il conferimento dei dati di autenticazione tramite Google è necessario per utilizzare
            il servizio Agenda. In assenza di un account Google con cui effettuare l&apos;accesso
            non è possibile utilizzare l&apos;applicazione.
          </p>
          <p>
            L&apos;impostazione di un suggerimento di recupero e la personalizzazione
            dell&apos;interfaccia sono facoltative.
          </p>

          {/* ── 8. Diritti dell'interessato ─────────────────────── */}
          <h2>8. Diritti dell&apos;interessato</h2>

          <p>
            In qualità di interessato, l&apos;utente ha il diritto di:
          </p>
          <ul>
            <li><strong>accedere</strong> ai propri dati personali (art. 15 GDPR);</li>
            <li><strong>rettificare</strong> dati inesatti o incompleti (art. 16 GDPR);</li>
            <li>
              <strong>cancellare</strong> i propri dati personali, nei casi previsti
              dall&apos;art. 17 GDPR (&ldquo;diritto all&apos;oblio&rdquo;);
            </li>
            <li>
              <strong>limitare</strong> il trattamento, nei casi previsti dall&apos;art. 18 GDPR;
            </li>
            <li>
              <strong>ricevere in formato strutturato e portabile</strong> i propri dati,
              nei casi previsti dall&apos;art. 20 GDPR;
            </li>
            <li>
              <strong>opporsi</strong> al trattamento basato su legittimo interesse,
              per motivi legati alla propria situazione particolare (art. 21 GDPR).
            </li>
          </ul>
          <p>
            Per esercitare i propri diritti l&apos;utente può contattare il Titolare del
            trattamento ai recapiti indicati al punto 1.
          </p>
          <p>
            Si ricorda che i contenuti creati dall&apos;utente sono cifrati e conservati
            esclusivamente sul dispositivo dell&apos;utente: il Titolare non ha accesso
            tecnico a tali dati e non è in grado di fornirne copia o di cancellarli
            autonomamente. L&apos;utente può cancellare i propri contenuti direttamente
            dall&apos;applicazione o cancellando la memoria locale del browser.
          </p>

          {/* ── 9. Reclamo all'Autorità di controllo ─────────────── */}
          <h2>9. Diritto di proporre reclamo</h2>

          <p>
            L&apos;utente ha il diritto di proporre reclamo all&apos;Autorità di controllo
            competente per la protezione dei dati personali.
          </p>

          <Required label="REQUIRED BEFORE PUBLICATION — Autorità di controllo competente">
            Indicare l&apos;Autorità di controllo competente in base al paese di stabilimento
            del Titolare. Se il Titolare è stabilito in Italia, l&apos;Autorità competente è:
          </Required>

          <p>
            <strong>Garante per la Protezione dei Dati Personali</strong><br />
            Piazza Venezia 11, 00187 Roma<br />
            Telefono: +39 06 696771<br />
            E-mail: <a href="mailto:garante@gpdp.it">garante@gpdp.it</a><br />
            Sito web:{' '}
            <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">
              www.garanteprivacy.it
            </a>
          </p>

          {/* ── 10. Decisioni automatizzate ──────────────────────── */}
          <h2>10. Decisioni automatizzate e profilazione</h2>

          <p>
            L&apos;applicazione Agenda non effettua trattamenti che comportino decisioni basate
            unicamente sul trattamento automatizzato, inclusa la profilazione, che producano
            effetti giuridici o incidano in modo analogo significativamente sull&apos;interessato
            (art. 22 GDPR).
          </p>

          {/* ── 11. Modifiche ────────────────────────────────────── */}
          <h2>11. Modifiche alla presente informativa</h2>

          <p>
            Il Titolare si riserva il diritto di modificare la presente informativa in qualsiasi
            momento, anche in relazione all&apos;evoluzione normativa o a modifiche dell&apos;applicazione.
            Le modifiche saranno pubblicate in questa pagina con aggiornamento della data di
            ultima revisione indicata in intestazione. Per le modifiche sostanziali, laddove
            possibile, verrà fornita una comunicazione adeguata agli utenti.
          </p>

        </div>
      </main>
    </div>
  )
}

// ── Internal helper: Required-before-publication warning box ────────────────
// This component renders only in the internal draft.
// Delete each <Required> element and replace with the actual content
// before making the page publicly accessible.

function Required({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.required} role="note" aria-label={`Informazione mancante: ${label}`}>
      <span className={styles.requiredIcon} aria-hidden="true">⚠️</span>
      <div className={styles.requiredText}>
        <strong>REQUIRED BEFORE PUBLICATION — {label}</strong>
        {children}
      </div>
    </div>
  )
}
