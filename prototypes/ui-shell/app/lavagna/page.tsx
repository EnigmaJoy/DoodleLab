// app/lavagna/page.tsx
import type { Metadata } from 'next'
import { SECTIONS } from '@/lib/sections'
import { SectionPlaceholder } from '@/components/SectionPlaceholder'

const section = SECTIONS.find(s => s.id === 'lavagna')!
export const metadata: Metadata = { title: section.title }
export default function LavagnaPage() {
  return <SectionPlaceholder label={section.label} />
}
