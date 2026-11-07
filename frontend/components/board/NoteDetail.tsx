// components/board/NoteDetail.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LOCALE } from '@/lib/constants'
import { useNote, useNoteContext } from '@/lib/note-context'
import { NoteHeader } from './NoteHeader'
import { StickerList } from './StickerList'
import { DeleteConfirmModal } from '@/design-system/DeleteConfirmModal'
import { POST_IT_COLORS, STICKER_CONFIG, formatNoteDate } from '@/lib/note-utils'
import type { NoteColor, StickerKey } from '@/lib/note-types'

const COLOR_ORDER: NoteColor[]    = ['yellow', 'pink', 'mint', 'blue', 'peach']
const STICKER_ORDER: StickerKey[] = [
  'star','heart','check','exclaim','bulb','home',
  'cart','sun','lightning','clock','phone','money',
]

interface NoteDetailProps {
  id: string
}

export function NoteDetail({ id }: NoteDetailProps) {
  const router         = useRouter()
  const note           = useNote(id)
  const { dispatch }   = useNoteContext()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Not found ────────────────────────────────────────────────────────────
  if (!note) {
    return (
      <main className="note-screen">
        <header className="note-header">
          <Link href="/board" replace className="note-back-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Lavagna</span>
          </Link>
          <h1 className="note-title">Nota</h1>
          <span className="note-status" />
        </header>
        <div className="note-notfound">
          <p className="note-notfound-msg">Questa nota non è disponibile.</p>
          <p className="note-notfound-sub">
            Le note vengono conservate solo durante la sessione corrente.
          </p>
          <Link href="/board" replace className="note-notfound-btn">
            ← Torna alla Lavagna
          </Link>
        </div>
      </main>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, content: e.target.value } })
  }

  function handleColorChange(color: NoteColor) {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, color } })
  }

  function handleAddSticker(key: StickerKey) {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, stickers: [...note!.stickers, key] } })
  }

  function handleRemoveLastSticker() {
    if (note!.stickers.length === 0) return
    dispatch({ type: 'UPDATE_NOTE', payload: { id, stickers: note!.stickers.slice(0, -1) } })
  }

  function handleTogglePin() {
    dispatch({ type: 'TOGGLE_PIN', payload: { id } })
  }

  function handleDuplicate() {
    dispatch({
      type: 'ADD_NOTE',
      payload: {
        content:  note!.content,
        color:    note!.color,
        stickers: [...note!.stickers],
        pinned:   false,
        position: {
          xPct: Math.min(note!.position.xPct + 0.05, 0.85),
          yPct: Math.min(note!.position.yPct + 0.05, 0.85),
        },
      },
    })
  }

  function handleDeleteRequest() {
    setConfirmDelete(true)
  }

  function handleDeleteConfirm() {
    dispatch({ type: 'DELETE_NOTE', payload: { id } })
    router.push('/board')
  }

  function handleDeleteCancel() {
    setConfirmDelete(false)
  }

  const bg = POST_IT_COLORS[note.color]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="note-screen">
      <NoteHeader lastEditedAt={note.updatedAt !== note.createdAt ? note.updatedAt : undefined} />

      <div className="note-body">
        {/* ── Left panel: large post-it preview ── */}
        <section className="note-preview-panel" aria-label="Anteprima post-it">
          <div
            className="note-postit-preview"
            style={{ backgroundColor: bg, transform: `rotate(${note.rotation}deg)` }}
          >
            <textarea
              className="note-postit-content-area"
              value={note.content}
              onChange={handleContentChange}
              placeholder="Scrivi qui..."
              aria-label="Contenuto del post-it"
              style={{ backgroundColor: 'transparent', color: 'inherit' }}
            />
            <StickerList stickers={note.stickers} />
            {note.dueDate && (
              <div className="note-postit-date">
                {new Date(note.dueDate).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>
        </section>

        {/* ── Right panel: controls ── */}
        <section className="note-tools-panel" aria-label="Strumenti nota">

          {/* Pinned notice */}
          {note.pinned && (
            <div className="note-pinned-notice" role="status">
              <div className="note-pinned-title">Nota fissata</div>
              <div className="note-pinned-desc">
                Non verrà archiviata automaticamente. Resta qui finché non la archivi tu.
              </div>
            </div>
          )}

          {/* Tool grid */}
          <div>
            <div className="note-section-label">Azioni</div>
            <div className="note-tools-grid" style={{ marginTop: '10px' }}>
              {/* Unimplemented tools: disabled, no onClick, title explains why */}
              {[
                { label: 'Promemoria',          icon: '⏰' },
                { label: 'Collega a un giorno', icon: '📅' },
                { label: 'Checklist',           icon: '☑️' },
                { label: 'Scrivi a mano',       icon: '✍️' },
                { label: 'Aggiungi audio',      icon: '🎙️' },
                { label: 'Archivia',            icon: '📦' },
              ].map(({ label, icon }) => (
                <button
                  key={label}
                  className="note-tool-btn"
                  disabled
                  aria-disabled="true"
                  title="Non ancora disponibile"
                  style={{ opacity: 0.45, cursor: 'not-allowed' }}
                >
                  <span className="note-tool-icon" aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}

              {/* Duplica — implemented */}
              <button
                className="note-tool-btn"
                onClick={handleDuplicate}
                aria-label="Duplica nota"
              >
                <span className="note-tool-icon" aria-hidden="true">📋</span>
                <span>Duplica</span>
              </button>

              {/* Elimina — full modal confirm */}
              {confirmDelete && (
                <DeleteConfirmModal
                  title="Eliminare questa nota?"
                  chip={note.content.slice(0, 30) || 'Nota senza testo'}
                  body="La nota viene rimossa dalla lavagna. Non è possibile annullare."
                  confirmLabel="Elimina"
                  onConfirm={handleDeleteConfirm}
                  onClose={handleDeleteCancel}
                />
              )}
              <button
                className="note-tool-btn note-tool-btn--destructive"
                onClick={handleDeleteRequest}
                aria-label="Elimina nota"
              >
                <span className="note-tool-icon" aria-hidden="true">🗑️</span>
                <span>Elimina</span>
              </button>
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <div className="note-section-label">Colore</div>
            <div className="note-colors" style={{ marginTop: '10px' }}>
              {COLOR_ORDER.map(color => (
                <button
                  key={color}
                  className="note-color-swatch"
                  style={{ backgroundColor: POST_IT_COLORS[color] }}
                  aria-pressed={note.color === color}
                  aria-label={color}
                  onClick={() => handleColorChange(color)}
                />
              ))}
            </div>
          </div>

          {/* Sticker picker */}
          <div>
            <div className="note-section-label">Adesivi</div>
            <div className="note-stickers" style={{ marginTop: '10px' }}>
              {STICKER_ORDER.map(key => (
                <button
                  key={key}
                  className="note-sticker-btn"
                  style={{ background: STICKER_CONFIG[key].bg }}
                  aria-label={`Aggiungi adesivo ${key}`}
                  onClick={() => handleAddSticker(key)}
                >
                  {STICKER_CONFIG[key].emoji}
                </button>
              ))}
            </div>
            {note.stickers.length > 0 && (
              <button
                className="note-remove-sticker"
                onClick={handleRemoveLastSticker}
                style={{ marginTop: '8px' }}
              >
                Togli l'ultimo
              </button>
            )}
          </div>

          {/* Pin toggle */}
          <div>
            <button
              className="note-tool-btn"
              onClick={handleTogglePin}
              aria-pressed={note.pinned}
              style={{ width: '100%' }}
            >
              <span className="note-tool-icon">{note.pinned ? '📌' : '📍'}</span>
              <span>{note.pinned ? 'Rimuovi da fissate' : 'Fissa nota'}</span>
            </button>
          </div>

          {/* Metadata */}
          <div className="note-metadata">
            <div>Creata {formatNoteDate(note.createdAt)}</div>
            {note.updatedAt !== note.createdAt && (
              <div>Ultima modifica {formatNoteDate(note.updatedAt)}</div>
            )}
          </div>

        </section>
      </div>
    </main>
  )
}
