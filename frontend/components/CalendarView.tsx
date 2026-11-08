// components/CalendarView.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/design-system/AppHeader'
import { getCalendarRepository, type CalendarItem } from '@/lib/calendar-repository'
import { useRepository } from '@/components/today/shared'
import { formatMonthYear, dateString } from '@/lib/calendar-utils'
import { useFocusReturn } from '@/lib/hooks/use-focus-return'
import { useCalendarNavigation } from '@/lib/hooks/use-calendar-navigation'
import { useCalendarOverlay } from '@/lib/hooks/use-calendar-overlay'
import { GroupDetailPanel } from '@/components/calendar/GroupDetailPanel'
import { TimelinePanel } from '@/components/calendar/TimelinePanel'

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function CalendarView() {
  const router      = useRouter()
  const returnFocus = useFocusReturn()
  const calRepo     = useRepository(getCalendarRepository())
  const nav         = useCalendarNavigation()
  const overlay     = useCalendarOverlay({ dayRefs: nav.dayRefs, returnFocus })

  // Focus the grid cell when focusedDate changes (only while overlay is closed)
  useEffect(() => {
    if (!nav.focusedDate || overlay.selectedDate !== null) return
    nav.dayRefs.current.get(nav.focusedDate)?.focus()
  }, [nav.focusedDate, overlay.selectedDate])

  function handleDayClick(ds: string) {
    overlay.openDay(ds)
    nav.setFocusedDate(ds)
  }

  function handleGoToToday() {
    nav.goToToday()
    overlay.clearOverlay()
  }

  const overlayItems   = overlay.selectedDate ? calRepo.getItemsForDate(overlay.selectedDate)   : []
  const overlayGroups  = overlay.selectedDate ? calRepo.getGroupsForDate(overlay.selectedDate)  : new Map<string, CalendarItem[]>()
  const openGroupItems = overlay.openGroupId  ? (overlayGroups.get(overlay.openGroupId) ?? [])  : []

  return (
    <div className="calendar-screen">
      <AppHeader
        returnVariant="menu"
        onMenuOpen={() => router.replace('/?view=menu')}
        title={formatMonthYear(nav.year, nav.month)}
        titleLive={true}
        viewControl={{
          kind:    'stepper',
          label:   formatMonthYear(nav.year, nav.month),
          onPrev:  nav.handlePrev,
          onNext:  nav.handleNext,
          onToday: handleGoToToday,
        }}
      />

      <div className="cal-body">
        <section className="cal-grid-section" aria-label="Griglia del calendario">
          <div className="cal-day-headers" role="row" aria-hidden="true">
            {DAY_HEADERS.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
          </div>

          <div
            className="cal-grid"
            role="grid"
            aria-label={formatMonthYear(nav.year, nav.month)}
            onKeyDown={e => nav.handleGridKeyDown(e, overlay.selectedDate, handleDayClick)}
          >
            {nav.cells.map((day, idx) => {
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

              const ds         = dateString(nav.year, nav.month, day)
              const isToday    = ds === nav.today
              const isSelected = ds === overlay.selectedDate
              const isFocusTab = nav.focusedDate ? ds === nav.focusedDate : isToday

              const dayItems     = calRepo.getItemsForDate(ds)
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
                      if (el) nav.dayRefs.current.set(ds, el)
                      else    nav.dayRefs.current.delete(ds)
                    }}
                    type="button"
                    className={btnClass}
                    onClick={() => handleDayClick(ds)}
                    tabIndex={isFocusTab ? 0 : -1}
                    aria-label={[
                      `${day} ${formatMonthYear(nav.year, nav.month)}`,
                      isToday             ? 'oggi'      : null,
                      dayItems.length > 0 ? 'ha eventi' : null,
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

      {overlay.selectedDate !== null && (
        <div
          className="cal-overlay-backdrop"
          onClick={overlay.handleBackdropClick}
          aria-label="Sfondo overlay, clicca per chiudere"
        >
          <div className="cal-overlay-panels" onClick={e => e.stopPropagation()}>
            <TimelinePanel
              date={overlay.selectedDate}
              items={overlayItems}
              groups={overlayGroups}
              onGroupOpen={overlay.openGroup}
              onClose={overlay.closeOverlay}
              panelRef={overlay.timelinePanelRef}
              closeRef={overlay.overlayCloseRef}
              chipRefs={overlay.chipRefs}
            />
            {overlay.openGroupId !== null && (
              <GroupDetailPanel
                date={overlay.selectedDate}
                groupId={overlay.openGroupId}
                items={openGroupItems}
                onClose={overlay.closeGroup}
                onDeleteItem={id => calRepo.deleteItem(id)}
                panelRef={overlay.groupPanelRef}
                closeRef={overlay.groupCloseRef}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
