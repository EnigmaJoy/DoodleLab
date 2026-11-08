// components/today/EntryDialog.tsx
import { useId } from 'react'
import Link from 'next/link'
import { getCalendarRepository } from '@/lib/calendar-repository'
import { type TimelineEntry } from '@/lib/today/timeline'
import { GroupItemCard } from '@/components/calendar/GroupItemCard'
import { ConfirmAction, useModal } from './shared'
import { CloseIcon } from './icons'
import { IconButton } from '@/design-system/IconButton'
import modalStyles from '@/design-system/Modal.module.css'

const KIND_LABEL: Record<string, string> = {
  event:    'Appuntamento',
  reminder: 'Promemoria',
  note:     'PostIt',
}

/** Read-only detail for calendar items, using the calendar's own card */
export function EntryDialog({ entry, onClose }: { entry: TimelineEntry; onClose: () => void }) {
  const ref     = useModal(onClose)
  const titleId = useId()
  if (entry.kind === 'block') return null
  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      className={`${modalStyles.dialog} ${modalStyles.medium}`}
      aria-labelledby={titleId}
      onClick={e => { if (e.target === e.currentTarget) ref.current?.close() }}
    >
      <div className={modalStyles.card} onClick={e => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className={modalStyles.headerText}>
            <p className={modalStyles.eyebrow}>{KIND_LABEL[entry.kind]}</p>
            <h2 id={titleId} className={modalStyles.title}>{entry.title}</h2>
          </div>
          <IconButton label="Chiudi" icon={<CloseIcon />} onClick={() => ref.current?.close()} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <GroupItemCard item={entry.source} />
          <ConfirmAction
            label="Elimina"
            question={
              entry.kind === 'reminder'
                ? 'Eliminare questo promemoria?'
                : entry.kind === 'note'
                ? 'Eliminare questa nota?'
                : 'Eliminare questo evento?'
            }
            confirmLabel="Elimina"
            onConfirm={() => {
              getCalendarRepository().deleteItem(entry.source.id)
              onClose()
            }}
          />
          <Link href="/calendar" className="today-text-btn">Apri il Calendario</Link>
        </div>
      </div>
    </dialog>
  )
}
