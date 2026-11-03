import { PostItProvider } from '@/lib/postit-context'

export default function LavagnaLayout({ children }: { children: React.ReactNode }) {
  return <PostItProvider>{children}</PostItProvider>
}
