// app/board/page.tsx
import type { Metadata } from 'next'
import { NoteBoard } from '@/components/board/NoteBoard'

export const metadata: Metadata = { title: 'Lavagna' }

export default function BoardPage() {
  return <NoteBoard />
}
