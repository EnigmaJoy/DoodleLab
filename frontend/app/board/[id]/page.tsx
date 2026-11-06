// app/board/[id]/page.tsx
import type { Metadata } from 'next'
import { NoteDetail } from '@/components/board/NoteDetail'

export const metadata: Metadata = { title: 'Nota' }

export default async function NotaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <NoteDetail id={id} />
}
