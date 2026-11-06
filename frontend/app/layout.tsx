// app/layout.tsx
import type { Metadata } from 'next'
import { Caveat, Sacramento, Kalam, Figtree } from 'next/font/google'
import { PaletteSwitcher } from '@/dev/PaletteSwitcher'
import { PALETTE_COUNT } from '@/lib/palettes'
import { Providers } from './providers'
import './globals.css'

// Sacramento loaded via next/font: self-hosted at build time, no runtime requests.
// Build fails if the font cannot be downloaded.
const sacramento = Sacramento({
  subsets:  ['latin'],
  weight:   ['400'],
  variable: '--font-welcome',
  display:  'swap',
})

// Kalam: natural handwriting font for post-it content — readable but human.
const kalam = Kalam({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  variable: '--font-postit',
  display:  'swap',
})

const caveat = Caveat({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  variable: '--font-caveat',
  display:  'swap',
})

const figtree = Figtree({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  variable: '--font-figtree',
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
    <html lang="it" data-palette={paletteId} className={`${sacramento.variable} ${kalam.variable} ${caveat.variable} ${figtree.variable}`}>
      <body>
        <Providers>
          {children}
        </Providers>
        {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
          <PaletteSwitcher />
        )}
      </body>
    </html>
  )
}
