import { PostItProvider } from '@/lib/postit-context'

// The board starts empty until durable persistence is implemented.
// To run with sample data locally, temporarily import DEMO_NOTES from '@/lib/postit-utils'
// and pass initialNotes={DEMO_NOTES} — never commit that change.
export default function LavagnaLayout({ children }: { children: React.ReactNode }) {
  return <PostItProvider>{children}</PostItProvider>
}
