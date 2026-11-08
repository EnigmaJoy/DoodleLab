// lib/hooks/use-calendar-overlay.ts
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface UseCalendarOverlayOptions {
  dayRefs:     React.MutableRefObject<Map<string, HTMLButtonElement>>
  returnFocus: (el?: HTMLElement | null) => void
}

export function useCalendarOverlay({ dayRefs, returnFocus }: UseCalendarOverlayOptions) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [openGroupId,  setOpenGroupId]  = useState<string | null>(null)

  const overlayCloseRef  = useRef<HTMLButtonElement | null>(null)
  const groupCloseRef    = useRef<HTMLButtonElement | null>(null)
  const chipRefs         = useRef<Map<string, HTMLButtonElement>>(new Map())
  const timelinePanelRef = useRef<HTMLDivElement | null>(null)
  const groupPanelRef    = useRef<HTMLDivElement | null>(null)

  // Focus overlay close button when overlay opens
  useEffect(() => {
    if (selectedDate !== null) overlayCloseRef.current?.focus()
  }, [selectedDate])

  // Focus group close button when group opens
  useEffect(() => {
    if (openGroupId !== null) groupCloseRef.current?.focus()
  }, [openGroupId])

  // Escape key: close group first, then close overlay
  const handleOverlayKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (openGroupId !== null) {
      const chip = chipRefs.current.get(openGroupId)
      setOpenGroupId(null)
      returnFocus(chip)
    } else {
      setSelectedDate(null)
      setOpenGroupId(null)
    }
  }, [openGroupId, returnFocus])

  useEffect(() => {
    if (selectedDate === null) return
    document.addEventListener('keydown', handleOverlayKeyDown)
    return () => document.removeEventListener('keydown', handleOverlayKeyDown)
  }, [selectedDate, handleOverlayKeyDown])

  function openDay(ds: string) {
    setSelectedDate(ds)
    setOpenGroupId(null)
  }

  function clearOverlay() {
    setSelectedDate(null)
    setOpenGroupId(null)
  }

  function closeOverlay() {
    const last = selectedDate
    clearOverlay()
    if (last) returnFocus(dayRefs.current.get(last))
  }

  function openGroup(gid: string) {
    setOpenGroupId(gid)
  }

  function closeGroup() {
    const chip = chipRefs.current.get(openGroupId ?? '')
    setOpenGroupId(null)
    returnFocus(chip)
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) closeOverlay()
  }

  return {
    selectedDate,
    openGroupId,
    overlayCloseRef,
    groupCloseRef,
    chipRefs,
    timelinePanelRef,
    groupPanelRef,
    openDay,
    clearOverlay,
    closeOverlay,
    openGroup,
    closeGroup,
    handleBackdropClick,
  }
}
