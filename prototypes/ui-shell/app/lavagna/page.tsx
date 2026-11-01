import type { Metadata } from 'next'
import { LavagnaBoard } from '@/components/lavagna/LavagnaBoard'

export const metadata: Metadata = { title: 'Lavagna' }

export default function LavagnaPage() {
  return <LavagnaBoard />
}
