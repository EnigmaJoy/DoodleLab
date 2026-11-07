import { NoteProvider } from '@/lib/note-context'

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <NoteProvider>{children}</NoteProvider>
}
