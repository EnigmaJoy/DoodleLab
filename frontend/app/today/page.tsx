// app/today/page.tsx
import type { Metadata } from 'next'
import { SECTIONS } from '@/lib/sections'
import { TodayView } from '@/components/today/TodayView'

const section = SECTIONS.find(s => s.id === 'today')!
export const metadata: Metadata = { title: section.title }
export default function TodayPage() {
  return <TodayView />
}
