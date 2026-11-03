import { NoteProvider } from '@/lib/note-context'

export default function LavagnaLayout({ children }: { children: React.ReactNode }) {
  return <NoteProvider>{children}</NoteProvider>
}
