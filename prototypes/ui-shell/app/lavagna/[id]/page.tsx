// app/lavagna/[id]/page.tsx
import type { Metadata } from 'next'
import { NotaDetail } from '@/components/lavagna/NotaDetail'

export const metadata: Metadata = { title: 'Nota' }

export default async function NotaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <NotaDetail id={id} />
}
