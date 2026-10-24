// app/calendario/page.tsx
import type { Metadata } from 'next'
import { CalendarView } from '@/components/CalendarView'

export const metadata: Metadata = { title: 'Calendario' }

export default function CalendarioPage() {
  return <CalendarView />
}
