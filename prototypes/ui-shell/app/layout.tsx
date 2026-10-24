// app/layout.tsx
import type { Metadata } from 'next'
import { Sacramento } from 'next/font/google'
import { PaletteSwitcher } from '@/dev/PaletteSwitcher'
import { PALETTE_COUNT } from '@/lib/palettes'
import './globals.css'

// Sacramento loaded via next/font: self-hosted at build time, no runtime requests.
// Build fails if the font cannot be downloaded.
const sacramento = Sacramento({
  subsets:  ['latin'],
  weight:   ['400'],
  variable: '--font-welcome',
  display:  'swap',
})

export const metadata: Metadata = {
  title: 'agenda',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pick a random palette per request. Runs server-side so the value is
  // embedded in the HTML before hydration - no client/server mismatch.
  const paletteId = String(Math.floor(Math.random() * PALETTE_COUNT) + 1)

  return (
    <html lang="it" data-palette={paletteId} className={sacramento.variable}>
      <body>
        {children}
        {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
          <PaletteSwitcher />
        )}
      </body>
    </html>
  )
}
