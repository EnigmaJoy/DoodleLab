// components/calendar/GroupItemCard.tsx
import { type CalendarItem } from '@/lib/calendar-repository'
import { ConfirmAction } from '@/components/today/shared'

interface GroupItemCardProps {
  item:      CalendarItem
  onDelete?: () => void
}
export function GroupItemCard({ item, onDelete }: GroupItemCardProps) {
  const isPostit   = item.kind === 'note'
  const isEvent    = item.kind === 'event'
  const isReminder = item.kind === 'reminder'

  const badgeClass = isEvent
    ? 'cal-group-item-badge--event'
    : isReminder
    ? 'cal-group-item-badge--reminder'
    : 'cal-group-item-badge--note'

  const badgeLabel = isEvent ? 'EVENTO' : isReminder ? 'PROMEMORIA' : 'NOTA'

  const cardClass = [
    'cal-group-item-card',
    isPostit ? 'cal-group-item-card--note' : '',
  ].filter(Boolean).join(' ')

  const timeDisplay = item.time
    ? (item.detail?.timeEnd ? `${item.time} – ${item.detail.timeEnd}` : item.time)
    : null

  return (
    <div className={cardClass}>
      <div className="cal-group-item-header">
        <span className={`cal-group-item-badge ${badgeClass}`}>{badgeLabel}</span>
        {timeDisplay && (
          <span className="cal-group-item-time">{timeDisplay}</span>
        )}
      </div>

      <p className="cal-group-item-title">{item.title}</p>

      {isPostit && item.note && (
        <p className="cal-group-item-note">{item.note}</p>
      )}

      <div className="cal-group-item-footer">
        {isEvent && item.detail?.location && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Luogo</span>
            <span className="cal-group-item-detail-value">{item.detail.location}</span>
          </div>
        )}
        {isEvent && item.detail?.calendar && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Calendario</span>
            <span className="cal-group-item-detail-value">{item.detail.calendar}</span>
          </div>
        )}
        {isEvent && item.detail?.note && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Note</span>
            <span className="cal-group-item-detail-value">{item.detail.note}</span>
          </div>
        )}
        {isReminder && item.detail?.location && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Luogo</span>
            <span className="cal-group-item-detail-value">{item.detail.location}</span>
          </div>
        )}
        {isReminder && item.detail?.alert && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Avviso</span>
            <span className="cal-group-item-detail-value">{item.detail.alert}</span>
          </div>
        )}
        {isReminder && item.detail?.repeats && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Ripete</span>
            <span className="cal-group-item-detail-value">{item.detail.repeats}</span>
          </div>
        )}
        {isPostit && item.detail?.origin && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Origine</span>
            <span className="cal-group-item-detail-value">{item.detail.origin}</span>
          </div>
        )}
        {isPostit && item.detail?.alsoOn && (
          <div className="cal-group-item-detail">
            <span className="cal-group-item-detail-label">Anche su</span>
            <span className="cal-group-item-detail-value">{item.detail.alsoOn}</span>
          </div>
        )}
      </div>

      {onDelete && (
        <div className="cal-group-item-actions">
          <ConfirmAction
            label="Elimina"
            question={
              item.kind === 'reminder'
                ? 'Eliminare questo promemoria?'
                : item.kind === 'note'
                ? 'Eliminare questa nota?'
                : 'Eliminare questo evento?'
            }
            confirmLabel="Elimina"
            onConfirm={onDelete}
          />
        </div>
      )}
    </div>
  )
}
