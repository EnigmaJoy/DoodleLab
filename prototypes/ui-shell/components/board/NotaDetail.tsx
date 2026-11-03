// components/board/NotaDetail.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LOCALE } from '@/lib/constants'
import { usePostIt, usePostItContext } from '@/lib/postit-context'
import { NotaHeader } from './NotaHeader'
import { POST_IT_COLORS, STICKER_CONFIG, formatNoteDate } from '@/lib/postit-utils'
import type { PostItColor, StickerKey } from '@/lib/postit-types'

const COLOR_ORDER: PostItColor[]  = ['yellow', 'pink', 'mint', 'blue', 'peach']
const STICKER_ORDER: StickerKey[] = [
  'star','heart','check','exclaim','bulb','home',
  'cart','sun','lightning','clock','phone','money',
]

interface NotaDetailProps {
  id: string
}

export function NotaDetail({ id }: NotaDetailProps) {
  const router         = useRouter()
  const note           = usePostIt(id)
  const { dispatch }   = usePostItContext()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Not found ────────────────────────────────────────────────────────────
  if (!note) {
    return (
      <main className="nota-screen">
        <header className="nota-header">
          <Link href="/board" replace className="nota-back-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Lavagna</span>
          </Link>
          <h1 className="nota-title">Nota</h1>
          <span className="nota-status" />
        </header>
        <div className="nota-notfound">
          <p className="nota-notfound-msg">Questa nota non è disponibile.</p>
          <p className="nota-notfound-sub">
            Le note vengono conservate solo durante la sessione corrente.
          </p>
          <Link href="/board" replace className="nota-notfound-btn">
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

  function handleColorChange(color: PostItColor) {
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
    <main className="nota-screen">
      <NotaHeader lastEditedAt={note.updatedAt !== note.createdAt ? note.updatedAt : undefined} />

      <div className="nota-body">
        {/* ── Left panel: large post-it preview ── */}
        <section className="nota-preview-panel" aria-label="Anteprima post-it">
          <div
            className="nota-postit-preview"
            style={{ backgroundColor: bg, transform: `rotate(${note.rotation}deg)` }}
          >
            <textarea
              className="nota-postit-content-area"
              value={note.content}
              onChange={handleContentChange}
              placeholder="Scrivi qui..."
              aria-label="Contenuto del post-it"
              style={{ backgroundColor: 'transparent', color: 'inherit' }}
            />
            {note.stickers.length > 0 && (
              <div className="postit-stickers" aria-hidden="true">
                {note.stickers.map((key) => (
                  <span
                    key={key}
                    className="postit-sticker"
                    style={{ background: STICKER_CONFIG[key].bg }}
                  >
                    {STICKER_CONFIG[key].emoji}
                  </span>
                ))}
              </div>
            )}
            {note.dueDate && (
              <div className="nota-postit-date">
                {new Date(note.dueDate).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>
        </section>

        {/* ── Right panel: controls ── */}
        <section className="nota-tools-panel" aria-label="Strumenti nota">

          {/* Pinned notice */}
          {note.pinned && (
            <div className="nota-pinned-notice" role="status">
              <div className="nota-pinned-title">Nota fissata</div>
              <div className="nota-pinned-desc">
                Non verrà archiviata automaticamente. Resta qui finché non la archivi tu.
              </div>
            </div>
          )}

          {/* Tool grid */}
          <div>
            <div className="nota-section-label">Azioni</div>
            <div className="nota-tools-grid" style={{ marginTop: '10px' }}>
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
                  className="nota-tool-btn"
                  disabled
                  aria-disabled="true"
                  title="Non ancora disponibile"
                  style={{ opacity: 0.45, cursor: 'not-allowed' }}
                >
                  <span className="nota-tool-icon" aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}

              {/* Duplica — implemented */}
              <button
                className="nota-tool-btn"
                onClick={handleDuplicate}
                aria-label="Duplica nota"
              >
                <span className="nota-tool-icon" aria-hidden="true">📋</span>
                <span>Duplica</span>
              </button>

              {/* Elimina — inline confirm, no window.confirm */}
              {confirmDelete ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    background: 'rgba(255,220,220,0.95)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                  role="alertdialog"
                  aria-label="Conferma eliminazione"
                >
                  <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>
                    Eliminare questa nota? Non è possibile annullare.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="nota-tool-btn nota-tool-btn--destructive"
                      onClick={handleDeleteConfirm}
                      style={{ flex: 1 }}
                    >
                      Sì, elimina
                    </button>
                    <button
                      className="nota-tool-btn"
                      onClick={handleDeleteCancel}
                      style={{ flex: 1 }}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="nota-tool-btn nota-tool-btn--destructive"
                  onClick={handleDeleteRequest}
                  aria-label="Elimina nota"
                >
                  <span className="nota-tool-icon" aria-hidden="true">🗑️</span>
                  <span>Elimina</span>
                </button>
              )}
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <div className="nota-section-label">Colore</div>
            <div className="nota-colors" style={{ marginTop: '10px' }}>
              {COLOR_ORDER.map(color => (
                <button
                  key={color}
                  className="nota-color-swatch"
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
            <div className="nota-section-label">Adesivi</div>
            <div className="nota-stickers" style={{ marginTop: '10px' }}>
              {STICKER_ORDER.map(key => (
                <button
                  key={key}
                  className="nota-sticker-btn"
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
                className="nota-remove-sticker"
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
              className="nota-tool-btn"
              onClick={handleTogglePin}
              aria-pressed={note.pinned}
              style={{ width: '100%' }}
            >
              <span className="nota-tool-icon">{note.pinned ? '📌' : '📍'}</span>
              <span>{note.pinned ? 'Rimuovi da fissate' : 'Fissa nota'}</span>
            </button>
          </div>

          {/* Metadata */}
          <div className="nota-metadata">
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
