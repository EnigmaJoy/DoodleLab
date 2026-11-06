// app/page.tsx
import { AppShell } from '@/components/AppShell'
import type { AppView } from '@/components/AppShell'

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params       = await searchParams
  const initialView: AppView =
    params.view === 'menu' ? 'MENU_OPEN' : 'MENU_CLOSED'
  return <AppShell initialView={initialView} />
}
