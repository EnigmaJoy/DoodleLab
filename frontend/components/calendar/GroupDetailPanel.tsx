// components/calendar/GroupDetailPanel.tsx
import { useEffect } from 'react'
import { type CalendarItem } from '@/lib/calendar-repository'
import { formatDayShort } from '@/lib/calendar-utils'
import { CloseIcon } from './icons'
import { GroupItemCard } from './GroupItemCard'

interface GroupDetailPanelProps {
  date:         string
  groupId:      string
  items:        CalendarItem[]
  onClose:      () => void
  onDeleteItem: (id: string) => void
  panelRef?:    React.RefObject<HTMLDivElement | null>
  closeRef?:    React.RefObject<HTMLButtonElement | null>
}
export function GroupDetailPanel({ date, items, onClose, onDeleteItem, panelRef, closeRef }: GroupDetailPanelProps) {
  useEffect(() => {
    if (items.length === 0) onClose()
  }, [items.length, onClose])

  const times     = items.map(i => i.time).filter(Boolean) as string[]
  const minT      = times.length ? times.reduce((a, b) => a < b ? a : b) : ''
  const maxT      = times.length ? times.reduce((a, b) => a > b ? a : b) : ''
  const timeRange = minT && maxT && minT !== maxT ? `${minT} – ${maxT}` : minT
  const subtitle  = [timeRange, `${items.length} elementi`].filter(Boolean).join(' · ')

  return (
    <div className="cal-group-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Dettaglio gruppo">
      <div className="cal-panel-header">
        <div>
          <div className="cal-panel-day-name">{formatDayShort(date)}</div>
          <div className="cal-panel-title">{subtitle}</div>
        </div>
        <div className="cal-panel-actions">
          <button
            ref={closeRef}
            type="button"
            className="cal-panel-btn"
            onClick={onClose}
            aria-label="Chiudi dettaglio gruppo"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="cal-group-detail-list">
        {items.map(item => (
          <GroupItemCard key={item.id} item={item} onDelete={() => onDeleteItem(item.id)} />
        ))}
      </div>
    </div>
  )
}
