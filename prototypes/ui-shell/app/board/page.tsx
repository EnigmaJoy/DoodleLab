// app/board/page.tsx
import type { Metadata } from 'next'
import { LavagnaBoard } from '@/components/board/LavagnaBoard'

export const metadata: Metadata = { title: 'Lavagna' }

export default function LavagnaPage() {
  return <LavagnaBoard />
}
