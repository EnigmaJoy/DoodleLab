// Serves the pre-paint palette script from the same origin (CSP-ready: no inline script).
import { buildPaletteInitScript } from '@/lib/paletteInitScript'

export const dynamic = 'force-static'

export function GET() {
  return new Response(buildPaletteInitScript(), {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // Unversioned URL: always revalidate so a deploy is never masked by a stale CDN/proxy copy.
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
