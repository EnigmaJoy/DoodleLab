// components/SectionPlaceholder.tsx
import Link from 'next/link'

interface Props { label: string }

export function SectionPlaceholder({ label }: Props) {
  return (
    <main className="section-placeholder">
      <h1>{label}</h1>
      <p className="not-implemented">
        Questa sezione non e ancora implementata.
      </p>
      <Link href="/?view=menu" replace className="back-link">
        Torna al menu
      </Link>
    </main>
  )
}
