'use client'

import { useState } from 'react'
import { getDailyRepository } from '@/lib/today/daily-repository'
import { getCalendarRepository } from '@/lib/calendar-repository'
import { getTimerStore } from '@/lib/today/timer-store'
import { ActionsModal } from '@/design-system/ActionsModal'
import { DeleteConfirmModal } from '@/design-system/DeleteConfirmModal'
import { FormModal } from '@/design-system/FormModal'
import type { TimelineEntry } from '@/lib/today/timeline'
import { formatTime, parseTime, type DayKey } from '@/lib/day'
import { slotLabel } from '@/lib/today/time-blocks'
import { openPanel, useAnnounce } from './shared'
import { BlockActionsDialog } from './TimeBlockDialogs'
import { ClockIcon, HourglassIcon, TrashIcon } from './icons'

function NoteEditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function GoogleCalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function MoveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  )
}

function CheckDoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function UndoDoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  )
}

type Phase = 'actions' | 'delete' | 'reschedule' | 'add-note' | 'edit-text' | 'edit-time'

interface Props {
  entry:   TimelineEntry
  day:     DayKey
  onClose: () => void
}

const KIND_IT: Record<string, string> = {
  event:    'Appuntamento',
  block:    'Blocco flessibile',
  reminder: 'Promemoria',
  note:     'PostIt',
}

export function TodayItemModal({ entry, day, onClose }: Props) {
  const announce = useAnnounce()
  const [phase,       setPhase]       = useState<Phase>('actions')
  const [deleteError, setDeleteError] = useState<string | undefined>()
  const [draftText,   setDraftText]   = useState('')
  const [draftTime,   setDraftTime]   = useState('')

  const rangeStr = entry.hasEnd
    ? `${formatTime(entry.start)} - ${formatTime(entry.end)}`
    : formatTime(entry.start)

  // ── Block ─────────────────────────────────────────────────────────────────
  if (entry.kind === 'block') {
    const block = entry.source

    if (phase === 'reschedule') {
      return (
        <BlockActionsDialog
          blockId={block.id}
          isPast={false}
          isToday={true}
          now={new Date()}
          onClose={onClose}
        />
      )
    }

    if (phase === 'delete') {
      return (
        <DeleteConfirmModal
          title="Eliminare questo blocco?"
          chip={`${block.title} · ${slotLabel(block)}`}
          body="Il blocco viene tolto dalla tua giornata. Appuntamenti e attività restano come sono."
          confirmLabel="Elimina"
          confirmError={deleteError}
          onConfirm={() => {
            const repo   = getDailyRepository()
            const result = repo.deleteTimeBlock(block.id)
            if (result.ok) {
              announce(`Blocco eliminato: ${block.title}`)
              onClose()
            } else {
              setDeleteError('Non è stato possibile eliminare il blocco.')
            }
          }}
          onClose={onClose}
        />
      )
    }

    return (
      <ActionsModal
        eyebrow={KIND_IT.block}
        title={block.title}
        meta={slotLabel(block)}
        description="È tuo e flessibile: non è un appuntamento e non viene inviato a nessun calendario esterno."
        onClose={onClose}
        items={[
          {
            icon:    <ClockIcon />,
            label:   'Cambia orario',
            onClick: () => setPhase('reschedule'),
          },
          {
            icon:    <NoteEditIcon />,
            label:   'Modifica titolo',
            onClick: () => setPhase('reschedule'),
          },
          {
            icon:    <HourglassIcon />,
            label:   `Avvia timer da ${block.duration} min`,
            onClick: () => {
              getTimerStore().startFor(block.duration, block.title)
              openPanel('timer')
              announce(`Timer da ${block.duration} minuti avviato per ${block.title}`)
              onClose()
            },
          },
          {
            icon:    <TrashIcon />,
            label:   'Elimina blocco',
            onClick: () => setPhase('delete'),
            danger:  true,
          },
        ]}
      />
    )
  }

  // ── Event (Appuntamento) ─────────────────────────────────────────────────
  if (entry.kind === 'event') {
    if (phase === 'add-note') {
      const calRepo  = getCalendarRepository()
      const item     = calRepo.getItem(entry.source.id)
      const existing = item?.detail?.note ?? ''
      return (
        <FormModal
          title="Nota per te"
          confirmLabel="Salva"
          confirmDisabled={!draftText.trim()}
          onClose={onClose}
          onConfirm={() => {
            const calRepo = getCalendarRepository()
            const current = calRepo.getItem(entry.source.id)
            calRepo.updateItem(entry.source.id, {
              detail: { ...current?.detail, note: draftText.trim() },
            })
            announce(`Nota salvata per ${entry.title}`)
            onClose()
          }}
        >
          <textarea
            data-autofocus
            data-draft
            className="today-form-textarea"
            placeholder="Scrivi una nota privata…"
            defaultValue={existing}
            rows={4}
            onChange={e => setDraftText(e.target.value)}
          />
        </FormModal>
      )
    }

    return (
      <ActionsModal
        eyebrow={KIND_IT.event}
        title={entry.title}
        meta={rangeStr}
        description="Arriva da Google Calendar: orario e titolo si cambiano lì, così i due calendari restano uguali."
        onClose={onClose}
        items={[
          {
            icon:    <GoogleCalIcon />,
            label:   'Apri in Google Calendar',
            onClick: () => {
              window.open('https://calendar.google.com', '_blank', 'noopener')
              onClose()
            },
          },
          {
            icon:    <NoteEditIcon />,
            label:   'Aggiungi una nota per te',
            onClick: () => { setDraftText(''); setPhase('add-note') },
          },
        ]}
      />
    )
  }

  // ── Note (PostIt) ────────────────────────────────────────────────────────
  if (entry.kind === 'note') {
    if (phase === 'delete') {
      return (
        <DeleteConfirmModal
          title="Eliminare questo post-it?"
          chip={`${entry.title} · ${rangeStr}`}
          body="Il post-it viene rimosso dalla tua giornata. Nient'altro viene modificato."
          confirmLabel="Elimina"
          confirmError={deleteError}
          onConfirm={() => {
            try {
              getCalendarRepository().deleteItem(entry.source.id)
              announce(`Post-it eliminato: ${entry.title}`)
              onClose()
            } catch {
              setDeleteError('Non è stato possibile eliminare il post-it.')
            }
          }}
          onClose={onClose}
        />
      )
    }

    if (phase === 'edit-text') {
      return (
        <FormModal
          title="Modifica post-it"
          confirmLabel="Salva"
          confirmDisabled={!draftText.trim()}
          onClose={onClose}
          onConfirm={() => {
            getCalendarRepository().updateItem(entry.source.id, { title: draftText.trim() })
            announce(`Post-it aggiornato`)
            onClose()
          }}
        >
          <textarea
            data-autofocus
            data-draft
            className="today-form-textarea"
            placeholder="Testo del post-it…"
            defaultValue={entry.title}
            rows={4}
            onChange={e => setDraftText(e.target.value)}
          />
        </FormModal>
      )
    }

    if (phase === 'edit-time') {
      const currentTime = entry.source.time ?? formatTime(entry.start)
      return (
        <FormModal
          title="Cambia orario"
          confirmLabel="Salva"
          confirmDisabled={!draftTime || parseTime(draftTime) === null}
          onClose={onClose}
          onConfirm={() => {
            const mins = parseTime(draftTime)
            if (mins === null) return
            getCalendarRepository().updateItem(entry.source.id, { time: draftTime })
            announce(`Orario aggiornato: ${draftTime}`)
            onClose()
          }}
        >
          <input
            data-autofocus
            type="time"
            className="today-form-time-input"
            defaultValue={currentTime}
            onChange={e => setDraftTime(e.target.value)}
          />
        </FormModal>
      )
    }

    return (
      <ActionsModal
        eyebrow={KIND_IT.note}
        title={entry.title}
        meta={rangeStr}
        description="Un appunto legato a quest'ora. Puoi spostarlo in Lavagna se non riguarda più oggi."
        onClose={onClose}
        items={[
          {
            icon:    <NoteEditIcon />,
            label:   'Modifica testo',
            onClick: () => { setDraftText(entry.title); setPhase('edit-text') },
          },
          {
            icon:    <ClockIcon />,
            label:   'Cambia orario',
            onClick: () => { setDraftTime(entry.source.time ?? formatTime(entry.start)); setPhase('edit-time') },
          },
          {
            icon:    <MoveIcon />,
            label:   'Sposta in Lavagna',
            // TODO: implement move to board
            onClick: () => { announce('Funzione in arrivo'); onClose() },
          },
          {
            icon:    <TrashIcon />,
            label:   'Elimina post-it',
            onClick: () => setPhase('delete'),
            danger:  true,
          },
        ]}
      />
    )
  }

  // ── Reminder ─────────────────────────────────────────────────────────────
  const isDone = entry.source.note === '[fatto]'

  if (phase === 'delete') {
    return (
      <DeleteConfirmModal
        title="Eliminare questo promemoria?"
        chip={`${entry.title} · ${rangeStr}`}
        body="Il promemoria viene rimosso dalla tua giornata. Nient'altro viene modificato."
        confirmLabel="Elimina"
        confirmError={deleteError}
        onConfirm={() => {
          try {
            getCalendarRepository().deleteItem(entry.source.id)
            announce(`Promemoria eliminato: ${entry.title}`)
            onClose()
          } catch {
            setDeleteError('Non è stato possibile eliminare il promemoria.')
          }
        }}
        onClose={onClose}
      />
    )
  }

  if (phase === 'edit-text') {
    return (
      <FormModal
        title="Modifica promemoria"
        confirmLabel="Salva"
        confirmDisabled={!draftText.trim()}
        onClose={onClose}
        onConfirm={() => {
          getCalendarRepository().updateItem(entry.source.id, { title: draftText.trim() })
          announce(`Promemoria aggiornato`)
          onClose()
        }}
      >
        <textarea
          data-autofocus
          data-draft
          className="today-form-textarea"
          placeholder="Testo del promemoria…"
          defaultValue={entry.title}
          rows={3}
          onChange={e => setDraftText(e.target.value)}
        />
      </FormModal>
    )
  }

  return (
    <ActionsModal
      eyebrow={KIND_IT.reminder}
      title={entry.title}
      meta={rangeStr}
      description={isDone ? 'Hai già segnato questo promemoria come fatto.' : 'Un promemoria per quest\'ora. Se lo segni come fatto resta visibile, barrato.'}
      onClose={onClose}
      items={[
        isDone
          ? {
              icon:    <UndoDoneIcon />,
              label:   'Riapri promemoria',
              onClick: () => {
                getCalendarRepository().updateItem(entry.source.id, { note: undefined })
                announce(`Promemoria riaperto: ${entry.title}`)
                onClose()
              },
            }
          : {
              icon:    <CheckDoneIcon />,
              label:   'Segna come fatto',
              onClick: () => {
                getCalendarRepository().updateItem(entry.source.id, { note: '[fatto]' })
                announce(`Promemoria segnato come fatto: ${entry.title}`)
                onClose()
              },
            },
        {
          icon:    <NoteEditIcon />,
          label:   'Modifica',
          onClick: () => { setDraftText(entry.title); setPhase('edit-text') },
        },
        {
          icon:    <ClockIcon />,
          label:   'Cambia orario',
          // TODO: implement reschedule for reminders
          onClick: () => { announce('Funzione in arrivo'); onClose() },
        },
        {
          icon:    <TrashIcon />,
          label:   'Elimina promemoria',
          onClick: () => setPhase('delete'),
          danger:  true,
        },
      ]}
    />
  )
}
