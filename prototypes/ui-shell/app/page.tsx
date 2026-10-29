// app/page.tsx
import { AppShell } from '@/components/AppShell'
import type { AppView } from '@/lib/types'
import { parseAuthError } from '@/lib/welcome-state'

interface Props {
  searchParams: Promise<{ view?: string | string[]; auth_error?: string | string[] }>
}

export default async function Home({ searchParams }: Props) {
  const params       = await searchParams
  const initialView: AppView =
    params.view === 'menu' ? 'MENU_CLOSED' : 'WELCOME'
  const authError = parseAuthError(params.auth_error)
  return <AppShell initialView={initialView} authError={authError} />
}
