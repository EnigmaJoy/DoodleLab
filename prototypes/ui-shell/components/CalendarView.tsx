// components/CalendarView.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/design-system/AppHeader'
import { getCalendarRepository, type CalendarItem } from '@/lib/calendar-repository'
import { ConfirmAction, useRepository } from '@/components/today/shared'
import {
  getDaysInMonth,
  getFirstDayOffset,
  formatMonthYear,
  dateString,
  prevMonth,
  nextMonth,
  getDayNameFull,
  formatDayShort,
} from '@/lib/calendar-utils'
import { useFocusReturn } from '@/lib/hooks/use-focus-return'

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const TIMELINE_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]

function todayString(): string {
  const t = new Date()
  return dateString(t.getFullYear(), t.getMonth(), t.getDate())
}

function padHour(h: number): string {
  return String(h).padStart(2, '0') + ':00'
}

function itemHour(time: string): number {
  return parseInt(time.split(':')[0], 10)
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface LayersIconProps {
  size?: number
  color?: string
}
function LayersIcon({ size = 16, color = 'currentColor' }: LayersIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="7" width="12" height="6" rx="1.5" stroke={color} strokeWidth="1.5" fill="none"/>
      <rect x="2" y="3" width="12" height="6" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5"/>
    </svg>
  )
}

interface GridIconProps { size?: number }
function GridIcon({ size = 18 }: GridIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="10" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="2" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
    </svg>
  )
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ─── GroupChip ──────────────────────────────────────────────────────────────

interface GroupChipProps {
  groupId: string
  count:   number
  onClick: () => void
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

// ─── GroupItemCard ──────────────────────────────────────────────────────────

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

// ─── GroupDetailPanel ───────────────────────────────────────────────────────

interface GroupDetailPanelProps {
  date:          string
  groupId:       string
  items:         CalendarItem[]
  onClose:       () => void
  onDeleteItem:  (id: string) => void
  panelRef?:     React.RefObject<HTMLDivElement | null>
  closeRef?:     React.RefObject<HTMLButtonElement | null>
}
function GroupDetailPanel({ date, items, onClose, onDeleteItem, panelRef, closeRef }: GroupDetailPanelProps) {
  useEffect(() => {
    if (items.length === 0) onClose()
  }, [items.length, onClose])

  const times  = items.map(i => i.time).filter(Boolean) as string[]
  const minT   = times.length ? times.reduce((a, b) => a < b ? a : b) : ''
  const maxT   = times.length ? times.reduce((a, b) => a > b ? a : b) : ''
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

// ─── TimelinePanel ──────────────────────────────────────────────────────────

interface TimelinePanelProps {
  date:         string
  items:        CalendarItem[]
  groups:       Map<string, CalendarItem[]>
  onGroupOpen:  (gid: string) => void
  onClose:      () => void
  panelRef?:    React.RefObject<HTMLDivElement | null>
  closeRef?:    React.RefObject<HTMLButtonElement | null>
  chipRefs:     React.MutableRefObject<Map<string, HTMLButtonElement>>
}
function TimelinePanel({
  date, items, groups, onGroupOpen, onClose,
  panelRef, closeRef, chipRefs,
}: TimelinePanelProps) {
  const dayName = getDayNameFull(date)
  const dayShort = formatDayShort(date)

  // Build a set of groupIds already rendered so we render each group chip once
  const renderedGroups = new Set<string>()

  return (
    <div className="cal-timeline-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`Dettaglio ${dayShort}`}>
      {/* Panel header */}
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

      {/* Timeline */}
      <div className="cal-timeline">
        {TIMELINE_HOURS.map(hour => {
          const hourStr = padHour(hour)
          // Items at this hour (without a groupId)
          const slotItems = items.filter(
            i => !i.groupId && i.time && itemHour(i.time) === hour
          )
          // Groups whose first item falls in this hour slot
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
                  <div
                    key={item.id}
                    className={`cal-timeline-item cal-timeline-item--${item.kind}`}
                  >
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

// ─── CalendarView ───────────────────────────────────────────────────────────

export function CalendarView() {
  const router  = useRouter()
  const today   = todayString()
  const calRepo = useRepository(getCalendarRepository())

  const [year,         setYear]         = useState(() => new Date().getFullYear())
  const [month,        setMonth]        = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [openGroupId,  setOpenGroupId]  = useState<string | null>(null)
  const [focusedDate,  setFocusedDate]  = useState<string | null>(null)

  const dayRefs        = useRef<Map<string, HTMLButtonElement>>(new Map())
  const overlayCloseRef = useRef<HTMLButtonElement | null>(null)
  const groupCloseRef   = useRef<HTMLButtonElement | null>(null)
  const chipRefs        = useRef<Map<string, HTMLButtonElement>>(new Map())
  const timelinePanelRef = useRef<HTMLDivElement | null>(null)
  const groupPanelRef    = useRef<HTMLDivElement | null>(null)

  const returnFocus = useFocusReturn()

  const datesWithItems = calRepo.getDatesWithItems()

  // Focus the grid cell when focusedDate changes (only when overlay is closed)
  useEffect(() => {
    if (!focusedDate || selectedDate !== null) return
    dayRefs.current.get(focusedDate)?.focus()
  }, [focusedDate, selectedDate])

  // Focus overlay close button when overlay opens
  useEffect(() => {
    if (selectedDate !== null) {
      overlayCloseRef.current?.focus()
    }
  }, [selectedDate])

  // Focus group close button when group opens
  useEffect(() => {
    if (openGroupId !== null) {
      groupCloseRef.current?.focus()
    }
  }, [openGroupId])

  // Keyboard handler for overlay
  const handleOverlayKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (openGroupId !== null) {
      // Close group, refocus its chip
      const chip = chipRefs.current.get(openGroupId)
      setOpenGroupId(null)
      // chip focus happens after re-render; we need a tiny defer
      returnFocus(chip)
    } else {
      setSelectedDate(null)
      setOpenGroupId(null)
    }
  }, [openGroupId])

  useEffect(() => {
    if (selectedDate === null) return
    document.addEventListener('keydown', handleOverlayKeyDown)
    return () => document.removeEventListener('keydown', handleOverlayKeyDown)
  }, [selectedDate, handleOverlayKeyDown])

  // Build grid cells
  const daysInMonth = getDaysInMonth(year, month)
  const firstOffset = getFirstDayOffset(year, month)
  const cells: (number | null)[] = [
    ...Array<null>(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const remainder = cells.length % 7
  if (remainder !== 0) cells.push(...Array<null>(7 - remainder).fill(null))

  function goToToday() {
    const t = new Date()
    setYear(t.getFullYear())
    setMonth(t.getMonth())
    setSelectedDate(null)
    setFocusedDate(today)
  }

  function handlePrev() {
    const [y, m] = prevMonth(year, month)
    setYear(y); setMonth(m)
  }

  function handleNext() {
    const [y, m] = nextMonth(year, month)
    setYear(y); setMonth(m)
  }

  function handleDayClick(ds: string) {
    setSelectedDate(ds)
    setOpenGroupId(null)
    setFocusedDate(ds)
  }

  function handleCloseOverlay() {
    const last = selectedDate
    setSelectedDate(null)
    setOpenGroupId(null)
    if (last) {
      returnFocus(dayRefs.current.get(last))
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    // Only close if the click was directly on the backdrop, not the panels
    if (e.target === e.currentTarget) {
      handleCloseOverlay()
    }
  }

  function handleGroupOpen(gid: string) {
    setOpenGroupId(gid)
  }

  function handleGroupClose() {
    const chip = chipRefs.current.get(openGroupId ?? '')
    setOpenGroupId(null)
    returnFocus(chip)
  }

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const anchor = focusedDate ?? selectedDate ?? today
    const [fy, fm, fd] = anchor.split('-').map(Number)
    const current = new Date(fy, fm - 1, fd)
    let newDate: Date | null = null

    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault()
        newDate = new Date(current)
        newDate.setDate(newDate.getDate() - 1)
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        newDate = new Date(current)
        newDate.setDate(newDate.getDate() + 1)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        newDate = new Date(current)
        newDate.setDate(newDate.getDate() - 7)
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        newDate = new Date(current)
        newDate.setDate(newDate.getDate() + 7)
        break
      }
      case 'Home': {
        e.preventDefault()
        newDate = new Date(current)
        const offset = (current.getDay() + 6) % 7
        newDate.setDate(newDate.getDate() - offset)
        break
      }
      case 'End': {
        e.preventDefault()
        newDate = new Date(current)
        const offset = (current.getDay() + 6) % 7
        newDate.setDate(newDate.getDate() + (6 - offset))
        break
      }
      case 'PageUp': {
        e.preventDefault()
        handlePrev()
        return
      }
      case 'PageDown': {
        e.preventDefault()
        handleNext()
        return
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (focusedDate) handleDayClick(focusedDate)
        return
      }
      default:
        return
    }

    if (!newDate) return
    const nd = dateString(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
    if (newDate.getMonth() !== month || newDate.getFullYear() !== year) {
      setYear(newDate.getFullYear())
      setMonth(newDate.getMonth())
    }
    setFocusedDate(nd)
  }

  // Items for the selected day (used by overlay)
  const overlayItems  = selectedDate ? calRepo.getItemsForDate(selectedDate) : []
  const overlayGroups = selectedDate ? calRepo.getGroupsForDate(selectedDate) : new Map<string, CalendarItem[]>()
  const openGroupItems = openGroupId ? (overlayGroups.get(openGroupId) ?? []) : []

  return (
    <div className="calendar-screen">
      <AppHeader
        returnVariant="menu"
        onMenuOpen={() => router.push('/?view=menu')}
        title={formatMonthYear(year, month)}
        titleLive={true}
        viewControl={{
          kind:    'stepper',
          label:   formatMonthYear(year, month),
          onPrev:  handlePrev,
          onNext:  handleNext,
          onToday: goToToday,
        }}
      />

      {/* ── Body: full-height grid ── */}
      <div className="cal-body">
        <section className="cal-grid-section" aria-label="Griglia del calendario">
          {/* Day-of-week headers */}
          <div className="cal-day-headers" role="row" aria-hidden="true">
            {DAY_HEADERS.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div
            className="cal-grid"
            role="grid"
            aria-label={formatMonthYear(year, month)}
            onKeyDown={handleGridKeyDown}
          >
            {cells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    role="gridcell"
                    aria-hidden="true"
                    className="cal-cell cal-cell--empty"
                  />
                )
              }

              const ds         = dateString(year, month, day)
              const isToday    = ds === today
              const isSelected = ds === selectedDate
              const isFocusTab = focusedDate ? ds === focusedDate : isToday

              const dayItems = calRepo.getItemsForDate(ds)
              const visibleItems = dayItems.slice(0, 2)
              const moreCount    = dayItems.length - visibleItems.length

              const btnClass = [
                'cal-cell',
                isToday    && 'cal-cell--today',
                isSelected && 'cal-cell--selected',
              ].filter(Boolean).join(' ')

              return (
                <div key={ds} role="gridcell">
                  <button
                    ref={el => {
                      if (el) dayRefs.current.set(ds, el)
                      else    dayRefs.current.delete(ds)
                    }}
                    type="button"
                    className={btnClass}
                    onClick={() => handleDayClick(ds)}
                    tabIndex={isFocusTab ? 0 : -1}
                    aria-label={[
                      `${day} ${formatMonthYear(year, month)}`,
                      isToday              ? 'oggi'       : null,
                      dayItems.length > 0  ? 'ha eventi'  : null,
                    ].filter(Boolean).join(', ')}
                    aria-current={isToday ? 'date' : undefined}
                  >
                    <span className="cal-day-number">{day}</span>
                    {visibleItems.map(item => (
                      <span
                        key={item.id}
                        className={`cal-item-chip cal-item-chip--${item.kind}`}
                        aria-hidden="true"
                      >
                        {item.title}
                      </span>
                    ))}
                    {moreCount > 0 && (
                      <span className="cal-more" aria-hidden="true">+{moreCount}</span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Day Overlay ── */}
      {selectedDate !== null && (
        <div
          className="cal-overlay-backdrop"
          onClick={handleBackdropClick}
          aria-label="Sfondo overlay, clicca per chiudere"
        >
          <div className="cal-overlay-panels" onClick={e => e.stopPropagation()}>
            <TimelinePanel
              date={selectedDate}
              items={overlayItems}
              groups={overlayGroups}
              onGroupOpen={handleGroupOpen}
              onClose={handleCloseOverlay}
              panelRef={timelinePanelRef}
              closeRef={overlayCloseRef}
              chipRefs={chipRefs}
            />
            {openGroupId !== null && (
              <GroupDetailPanel
                date={selectedDate}
                groupId={openGroupId}
                items={openGroupItems}
                onClose={handleGroupClose}
                onDeleteItem={(id) => calRepo.deleteItem(id)}
                panelRef={groupPanelRef}
                closeRef={groupCloseRef}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
