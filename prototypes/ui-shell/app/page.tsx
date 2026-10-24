// app/page.tsx
import { AppShell } from '@/components/AppShell'
import type { AppView } from '@/lib/types'

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params       = await searchParams
  const initialView: AppView =
    params.view === 'menu' ? 'MENU_CLOSED' : 'WELCOME'
  return <AppShell initialView={initialView} />
}
