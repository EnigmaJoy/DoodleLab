import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE_ID, PALETTES, PALETTE_STORAGE_KEY, isPaletteId } from '@/lib/palettes'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const EXPECTED = [
  ['argilla-petrolio', 'Argilla e petrolio', '#C2410C', '#0F766E', ['#FB923C', '#2DD4BF', '#FDBA74'], '#9A3412'],
  ['notte-lavanda', 'Notte e lavanda', '#1E3A8A', '#6D28D9', ['#818CF8', '#C084FC', '#38BDF8'], '#2E2370'],
  ['bosco-laguna', 'Bosco e laguna', '#14532D', '#0E7490', ['#4ADE80', '#22D3EE', '#86EFAC'], '#14532D'],
  ['tramonto', 'Tramonto', '#9F1239', '#C2410C', ['#FB7185', '#FB923C', '#FDA4AF'], '#9F1239'],
  ['inchiostro', 'Inchiostro', '#1F2328', '#2F5BD3', ['#60A5FA', '#818CF8', '#93C5FD'], '#1F2328'],
  ['prugna-corallo', 'Prugna e corallo', '#581C87', '#BE123C', ['#C084FC', '#FB7185', '#F0ABFC'], '#581C87'],
  ['oliva-ambra', 'Oliva e ambra', '#3F6212', '#A16207', ['#A3E635', '#FBBF24', '#FDE68A'], '#3F6212'],
  ['ardesia-salvia', 'Ardesia e salvia', '#334155', '#3F6B5E', ['#94A3B8', '#6EE7B7', '#A7F3D0'], '#334155'],
] as const

function parseBlocks(css: string, selectorRe: RegExp) {
  const out: Record<string, Record<string, string>> = {}
  for (const m of css.matchAll(selectorRe)) {
    const props: Record<string, string> = {}
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) props[d[1]] = d[2].trim().toLowerCase()
    out[m[1]] = props
  }
  return out
}

const expectedProps = (p: (typeof EXPECTED)[number]) => ({
  '--bg-from': p[2].toLowerCase(), '--bg-to': p[3].toLowerCase(),
  '--glow-1': p[4][0].toLowerCase(), '--glow-2': p[4][1].toLowerCase(), '--glow-3': p[4][2].toLowerCase(),
  '--ink': p[5].toLowerCase(),
})

describe('palettes', () => {
  it('PALETTES matches the specified table', () => {
    expect(PALETTES.map(p => [p.id, p.name, p.from, p.to, [...p.glow], p.ink])).toEqual(
      EXPECTED.map(e => [e[0], e[1], e[2], e[3], [...e[4]], e[5]]),
    )
  })

  it('default is notte-lavanda and storage key is agenda.palette', () => {
    expect(DEFAULT_PALETTE_ID).toBe('notte-lavanda')
    expect(PALETTE_STORAGE_KEY).toBe('agenda.palette')
  })

  it('isPaletteId validates', () => {
    expect(isPaletteId('tramonto')).toBe(true)
    expect(isPaletteId('3')).toBe(false)
    expect(isPaletteId(3)).toBe(false)
    expect(isPaletteId(null)).toBe(false)
  })

  it('palettes.css matches lib/palettes.ts', () => {
    const blocks = parseBlocks(read('app/palettes.css'), /\[data-palette="([^"]+)"\]\s*\{([^}]*)\}/g)
    expect(Object.keys(blocks).sort()).toEqual(PALETTES.map(p => p.id).sort())
    for (const e of EXPECTED) expect(blocks[e[0]]).toEqual(expectedProps(e))
  })

  it('default palette vars also apply on :root', () => {
    const blocks = parseBlocks(read('app/palettes.css'), /(:root)\s*\{([^}]*)\}/g)
    const def = EXPECTED.find(e => e[0] === 'notte-lavanda')!
    expect(blocks[':root']).toEqual(expectedProps(def))
  })

  it('globals.css has no numeric palette selectors or legacy tokens', () => {
    const css = read('app/globals.css')
    expect(css).not.toMatch(/data-palette="\d/)
    expect(css).not.toContain('--gradient-start')
    expect(css).not.toContain('--gradient-end')
  })
})
