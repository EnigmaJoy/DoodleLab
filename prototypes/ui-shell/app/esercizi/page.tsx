// app/esercizi/page.tsx
import type { Metadata } from 'next'
import { SECTIONS } from '@/lib/sections'
import { SectionPlaceholder } from '@/components/SectionPlaceholder'

const section = SECTIONS.find(s => s.id === 'esercizi')!
export const metadata: Metadata = { title: section.title }
export default function EserciziPage() {
  return <SectionPlaceholder label={section.label} />
}
