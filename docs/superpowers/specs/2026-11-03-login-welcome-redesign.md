# Login Welcome Redesign — Spec

**Date:** 2026-11-03

## Goal

Sostituire la pagina `/login` con un design che incorpora l'animazione "Welcome" e la card di accesso Google. Eliminare la WelcomeScreen ridondante. Dopo lo sblocco del vault navigare direttamente al menu radiale aperto.

---

## 1. Pagina `/login` — layout e stile

### Sfondo
Gradiente fisso (non dipende dalla palette dell'utente):
```
linear-gradient(135deg, #150d3f 0%, #3d1278 45%, #6b1f8f 75%, #8b2383 100%)
```
Due strati di glow (pseudo-elementi o div assoluti):
- **Teal glow** al centro-alto, dietro "Welcome": `radial-gradient(ellipse, rgba(80,210,230,0.22), transparent)`
- **Purple glow** in basso al centro: `radial-gradient(ellipse, rgba(170,80,255,0.25), transparent)`

### Struttura HTML
```
<div class="login-screen">
  <div class="login-glow-top" />
  <div class="login-glow-bottom" />
  <button class="login-replay-btn">Rivedi animazione</button>
  <main class="login-main">
    <h1 class="sr-only">Welcome in Agenda</h1>
    <div class="welcome-text-wrapper"> <!-- animazione Welcome -->
    <div class="login-card">           <!-- card Google -->
    <p class="login-privacy">          <!-- footer privacy -->
  </main>
</div>
```

### Pulsante "Rivedi animazione"
Posizione: `fixed`, top-right. Stile: pill glassmorphism, icona replay SVG + testo.
Disabilitato durante l'animazione (abilitato dopo `ANIM_TOTAL_MS = 3500`ms). Clic incrementa `animKey` → rimonta gli elementi animati, ripartendo da zero.

---

## 2. Sequenza animazione

| Elemento | Delay | Durata | Curva | Effetto |
|---|---|---|---|---|
| Sfondo | 0s | — | — | Visibile subito |
| Welcome stroke | 0.2s | 2.6s | `cubic-bezier(0.45,0,0.25,1)` | Tratto da sinistra a destra |
| Welcome fill | 2.3s | 0.8s | `ease` | Fill bianco sovrapposto |
| Login card | 2.6s | 0.6s | `ease` | `slide-up-fade`: fade-in + sale da +14px |
| Privacy footer | 2.9s | 0.6s | `ease` | Stessa animazione della card |

Totale: ~3.5s. Nessun loop automatico. Replay solo tramite pulsante.

```css
/* Timing aggiornati rispetto al WelcomeScreen attuale */
.welcome-stroke { animation: draw-stroke 2.6s cubic-bezier(0.45,0,0.25,1) 0.2s both; }
.welcome-fill   { animation: fill-in 0.8s ease 2.3s both; }

@keyframes slide-up-fade {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 3. Contenuto della card

- Titolo bold: *"Il tuo spazio per giorni, pensieri e idee."*
- Sottotitolo: *"Accedi per ritrovare Agenda su tutti i tuoi dispositivi."*
- Pulsante bianco con G logo: **"Accedi con Google"** → `signIn('google', { callbackUrl: '/' })`

---

## 4. Footer privacy

> "Continuando accetti l'*informativa sulla privacy* di Agenda."

Testo piccolo semitrasparente, link underlined.

---

## 5. Rimozione WelcomeScreen

- `components/WelcomeScreen.tsx` — eliminato
- `components/AppShell.tsx`:
  - `AppView` diventa `'MENU_OPEN' | 'MENU_CLOSED'` (rimosso `'WELCOME'`)
  - Rimossi: `handleStart()`, import WelcomeScreen, JSX `<WelcomeScreen>`, `useRouter`
- `app/globals.css`:
  - Rimossi: `.welcome-screen`, `.welcome-main`, `.welcome-replay-btn`, `.inizia-button`, `@keyframes welcome-button-appear`
  - Aggiornati: timing `.welcome-stroke` e `.welcome-fill` (vedi §2)
  - Aggiunti: `.login-screen`, `.login-glow-*`, `.login-replay-btn`, `.login-main`, `.login-card`, `.login-card-title`, `.login-card-sub`, `.login-google-btn`, `.login-privacy`, `@keyframes slide-up-fade`

---

## 6. Navigazione post-unlock/setup

Dopo sblocco/setup riuscito, navigare al menu radiale **già aperto**:

- `app/unlock/page.tsx`: `router.push('/')` → `router.replace('/?view=menu')`
- `app/setup/page.tsx`: `router.push('/')` → `router.replace('/?view=menu')`
- `app/page.tsx`: `params.view === 'menu' ? 'MENU_OPEN' : 'MENU_CLOSED'` (rimosso `'WELCOME'`)

### Test da aggiornare
- `app/unlock/page.test.tsx`: aggiungere `mockReplace` al mock router; aggiornare assertion da `mockPush('/')` a `mockReplace('/?view=menu')`
- `app/setup/page.test.tsx`: stessa modifica

---

## File Map

| Azione | File |
|--------|------|
| Riscrivere | `app/login/page.tsx` |
| Modificare | `app/globals.css` |
| Eliminare | `components/WelcomeScreen.tsx` |
| Modificare | `components/AppShell.tsx` |
| Modificare | `app/page.tsx` |
| Modificare | `app/unlock/page.tsx` |
| Modificare | `app/unlock/page.test.tsx` |
| Modificare | `app/setup/page.tsx` |
| Modificare | `app/setup/page.test.tsx` |
