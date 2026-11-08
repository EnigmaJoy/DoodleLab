// components/calendar/TimelinePanel.tsx
import { type CalendarItem } from '@/lib/calendar-repository'
import { getDayNameFull, formatDayShort } from '@/lib/calendar-utils'
import { LayersIcon, GridIcon, CloseIcon } from './icons'

const TIMELINE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

function padHour(h: number): string {
  return String(h).padStart(2, '0') + ':00'
}

function itemHour(time: string): number {
  return parseInt(time.split(':')[0], 10)
}

// ─── GroupChip ────────────────────────────────────────────────────────────────

interface GroupChipProps {
  groupId:  string
  count:    number
  onClick:  () => void
  chipRef?: React.RefObject<HTMLButtonElement | null>
}
function GroupChip({ groupId, count, onClick, chipRef }: GroupChipProps) {
  return (
    <button
      ref={chipRef}
      type="button"
      className="cal-group-chip"
      onClick={onClick}
      aria-label={`Gruppo ${count} elementi`}
      data-group-id={groupId}
    >
      <span className="cal-group-count" aria-hidden="true">{count}</span>
      <span>elementi</span>
      <LayersIcon size={14} color="rgba(255,255,255,0.65)" />
    </button>
  )
}

// ─── TimelinePanel ────────────────────────────────────────────────────────────

interface TimelinePanelProps {
  date:        string
  items:       CalendarItem[]
  groups:      Map<string, CalendarItem[]>
  onGroupOpen: (gid: string) => void
  onClose:     () => void
  panelRef?:   React.RefObject<HTMLDivElement | null>
  closeRef?:   React.RefObject<HTMLButtonElement | null>
  chipRefs:    React.MutableRefObject<Map<string, HTMLButtonElement>>
}
export function TimelinePanel({
  date, items, groups, onGroupOpen, onClose,
  panelRef, closeRef, chipRefs,
}: TimelinePanelProps) {
  const dayName  = getDayNameFull(date)
  const dayShort = formatDayShort(date)

  const renderedGroups = new Set<string>()

  return (
    <div className="cal-timeline-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`Dettaglio ${dayShort}`}>
      <div className="cal-panel-header">
        <div>
          <div className="cal-panel-day-name">{dayName}</div>
          <div className="cal-panel-date">{dayShort}</div>
        </div>
        <div className="cal-panel-actions">
          <button
            type="button"
            className="cal-panel-btn"
            onClick={onClose}
            aria-label="Torna alla griglia"
            title="Griglia"
          >
            <GridIcon size={16} />
          </button>
          <button
            ref={closeRef}
            type="button"
            className="cal-panel-btn"
            onClick={onClose}
            aria-label="Chiudi overlay"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="cal-timeline">
        {TIMELINE_HOURS.map(hour => {
          const hourStr   = padHour(hour)
          const slotItems = items.filter(i => !i.groupId && i.time && itemHour(i.time) === hour)

          const slotGroups: Array<{ gid: string; groupItems: CalendarItem[] }> = []
          for (const [gid, groupItems] of groups.entries()) {
            if (renderedGroups.has(gid)) continue
            const firstTime = groupItems.map(i => i.time).filter(Boolean)[0]
            if (firstTime && itemHour(firstTime) === hour) {
              slotGroups.push({ gid, groupItems })
              renderedGroups.add(gid)
            }
          }

          const hasContent = slotItems.length > 0 || slotGroups.length > 0

          return (
            <div key={hour} className="cal-hour-row">
              <div className="cal-hour-label">{hourStr}</div>
              <div className="cal-hour-content">
                {slotItems.map(item => (
                  <div key={item.id} className={`cal-timeline-item cal-timeline-item--${item.kind}`}>
                    <span style={{ fontSize: '0.7rem', marginRight: '0.375rem', opacity: 0.7 }}>{item.time}</span>
                    {item.title}
                  </div>
                ))}
                {slotGroups.map(({ gid, groupItems }) => {
                  const chipRef: React.RefObject<HTMLButtonElement | null> = {
                    get current() { return chipRefs.current.get(gid) ?? null },
                    set current(el: HTMLButtonElement | null) {
                      if (el) chipRefs.current.set(gid, el)
                      else    chipRefs.current.delete(gid)
                    },
                  }
                  return (
                    <GroupChip
                      key={gid}
                      groupId={gid}
                      count={groupItems.length}
                      onClick={() => onGroupOpen(gid)}
                      chipRef={chipRef}
                    />
                  )
                })}
                {!hasContent && <div style={{ minHeight: '4px' }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
