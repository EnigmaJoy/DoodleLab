// lib/hooks/use-calendar-navigation.ts
'use client'

import { useState, useRef } from 'react'
import {
  getDaysInMonth,
  getFirstDayOffset,
  dateString,
  prevMonth,
  nextMonth,
} from '@/lib/calendar-utils'

function todayString(): string {
  const t = new Date()
  return dateString(t.getFullYear(), t.getMonth(), t.getDate())
}

export function useCalendarNavigation() {
  const today = todayString()

  const [year,        setYear]        = useState(() => new Date().getFullYear())
  const [month,       setMonth]       = useState(() => new Date().getMonth())
  const [focusedDate, setFocusedDate] = useState<string | null>(null)
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Compute grid cells: null-padded prefix + day numbers + null-padded suffix
  const daysInMonth = getDaysInMonth(year, month)
  const firstOffset = getFirstDayOffset(year, month)
  const cells: (number | null)[] = [
    ...Array<null>(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const remainder = cells.length % 7
  if (remainder !== 0) cells.push(...Array<null>(7 - remainder).fill(null))

  function handlePrev() {
    const [y, m] = prevMonth(year, month)
    setYear(y); setMonth(m)
  }

  function handleNext() {
    const [y, m] = nextMonth(year, month)
    setYear(y); setMonth(m)
  }

  function goToToday() {
    const t = new Date()
    setYear(t.getFullYear())
    setMonth(t.getMonth())
    setFocusedDate(today)
  }

  function handleGridKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    selectedDate: string | null | undefined,
    onDayClick: (ds: string) => void,
  ) {
    const anchor    = focusedDate ?? selectedDate ?? today
    const [fy, fm, fd] = anchor.split('-').map(Number)
    const current   = new Date(fy, fm - 1, fd)
    let   newDate: Date | null = null

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
        if (focusedDate) onDayClick(focusedDate)
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

  return {
    today,
    year, month,
    focusedDate, setFocusedDate,
    cells,
    dayRefs,
    handlePrev, handleNext, goToToday,
    handleGridKeyDown,
  }
}
