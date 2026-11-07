# Vercel Deploy Setup

**Data:** 2026-11-06  
**Branch di produzione:** `dev`  
**URL produzione:** https://aera-roan.vercel.app

---

## Struttura monorepo

Prima di questo setup la Next.js app si trovava in `prototypes/ui-shell/`. È stata rinominata in `frontend/` per riflettere lo stato attuale del progetto (non più prototipo).

```
DoodleLab/
├── frontend/       ← Next.js app (ex prototypes/ui-shell)
├── backend/        ← NestJS (scaffolding, non ancora attivo)
├── docs/
├── package.json    ← script root (pnpm dev/build/start delegano a frontend)
└── pnpm-workspace.yaml
```

`pnpm dev` dalla root avvia il dev server di `frontend/` senza necessità di `cd`.

---

## Vercel — configurazione progetto

| Impostazione | Valore |
|---|---|
| Repository | `EnigmaJoy/DoodleLab` |
| Root Directory | `frontend` |
| Framework | Next.js (rilevato automaticamente via `vercel.json`) |
| Production Branch | `dev` |
| Package Manager | pnpm (rilevato da `pnpm-lock.yaml`) |

Il file `frontend/vercel.json` dichiara esplicitamente il framework:

```json
{ "framework": "nextjs" }
```

---

## Google OAuth — URI autorizzati

Nella Google Cloud Console, nel client OAuth, sono registrati:

**Authorized JavaScript origins**
- `http://localhost:3000` ← sviluppo locale
- `https://aera-roan.vercel.app` ← produzione

**Authorized redirect URIs**
- `http://localhost:3000/api/auth/callback/google`
- `https://aera-roan.vercel.app/api/auth/callback/google`

> Nota: Google non accetta IP grezzi come redirect URI. Per testare su dispositivi fisici sulla stessa rete locale usare ngrok (`ngrok http 3000`) e registrare temporaneamente il dominio ngrok.

---

## Environment variables

Variabili da configurare sia in `.env.local` (locale) che nelle Vercel Environment Variables (produzione):

| Chiave | Note |
|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` in locale, `https://aera-roan.vercel.app` su Vercel |
| `NEXTAUTH_SECRET` | stringa casuale, uguale in entrambi gli ambienti |
| `GOOGLE_CLIENT_ID` | dalla Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | dalla Google Cloud Console |

---

## Fix applicati durante il setup

| Problema | Causa | Soluzione |
|---|---|---|
| `ERESOLVE` su `@types/node` | vitest 5.x richiede `^22`, il package aveva `^20` | Aggiornato a `^22` in `frontend/package.json` |
| Type error `note.title` | Proprietà rimossa durante refactor, rimasto un riferimento in `NoteDetail.tsx` | Sostituito con `note.content.slice(0, 30)` |
| `No Output Directory named "dist"` | Preset "Other" selezionato durante creazione progetto | Aggiunto `frontend/vercel.json` con `{ "framework": "nextjs" }` |
| Lockfile duplicato | `package-lock.json` di npm rimasto da versione precedente | Eliminato `frontend/package-lock.json` |
