// app/layout.tsx
import type { Metadata } from 'next'
import { Figtree, Sacramento } from 'next/font/google'
import { PaletteSwitcher } from '@/dev/PaletteSwitcher'
import { DEFAULT_PALETTE_ID } from '@/lib/palettes'
import './palettes.css'
import './globals.css'

// Fonts loaded via next/font: self-hosted at build time, no runtime requests.
// Build fails if a font cannot be downloaded.
const sacramento = Sacramento({
  subsets:  ['latin'],
  weight:   ['400'],
  variable: '--font-welcome',
  display:  'swap',
})

const figtree = Figtree({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  variable: '--font-ui',
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
  return (
    <html
      lang="it"
      data-palette={DEFAULT_PALETTE_ID}
      suppressHydrationWarning
      className={`${sacramento.variable} ${figtree.variable}`}
    >
      <head>
        {/* Same-origin synchronous script: restores the stored palette before first paint. */}
        <script src="/palette-init.js" />
        {/* Same-origin synchronous script: enables the Welcome intro before first paint
            (skipped under reduced motion or in a background tab). */}
        <script src="/welcome-intro.js" />
      </head>
      <body>
        {children}
        {process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && (
          <PaletteSwitcher />
        )}
      </body>
    </html>
  )
}
