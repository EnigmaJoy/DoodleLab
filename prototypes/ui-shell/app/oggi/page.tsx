// app/oggi/page.tsx
import type { Metadata } from 'next'
import { SECTIONS } from '@/lib/sections'
import { SectionPlaceholder } from '@/components/SectionPlaceholder'

const section = SECTIONS.find(s => s.id === 'oggi')!
export const metadata: Metadata = { title: section.title }
export default function OggiPage() {
  return <SectionPlaceholder label={section.label} />
}
