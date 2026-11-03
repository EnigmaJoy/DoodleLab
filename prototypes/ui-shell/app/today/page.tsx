// app/today/page.tsx
import type { Metadata } from 'next'
import { SECTIONS } from '@/lib/sections'
import { OggiView } from '@/components/today/OggiView'

const section = SECTIONS.find(s => s.id === 'today')!
export const metadata: Metadata = { title: section.title }
export default function OggiPage() {
  return <OggiView />
}
