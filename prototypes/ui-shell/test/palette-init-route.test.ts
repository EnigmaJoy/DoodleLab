import { describe, expect, it } from 'vitest'
import { GET, dynamic } from '@/app/palette-init.js/route'
import { buildPaletteInitScript } from '@/lib/paletteInitScript'

describe('palette-init.js route', () => {
  it('serves the script as JavaScript', async () => {
    const res = await GET()
    expect(res.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8')
    expect(await res.text()).toBe(buildPaletteInitScript())
  })
  it('forces revalidation', async () => {
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  })
  it('is force-static', () => {
    expect(dynamic).toBe('force-static')
  })
})
