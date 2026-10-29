import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Vitest runs from the package root (prototypes/ui-shell).
const SRC_PATH = resolve(process.cwd(), 'public/welcome-intro.js')

function run() {
  // Execute the static file exactly as the browser would (classic script, global scope).
  new Function(readFileSync(SRC_PATH, 'utf8'))()
}

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const attr = () => document.documentElement.hasAttribute('data-welcome-intro')

beforeEach(() => {
  vi.useFakeTimers()
  document.documentElement.removeAttribute('data-welcome-intro')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-welcome-intro')
})

describe('public/welcome-intro.js', () => {
  it('motion allowed and visible: sets the attribute, removes it after 3400ms', () => {
    stubMatchMedia(false)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    run()
    expect(attr()).toBe(true)
    vi.advanceTimersByTime(3399)
    expect(attr()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(attr()).toBe(false)
  })

  it('reduced motion: never sets the attribute', () => {
    stubMatchMedia(true)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    run()
    expect(attr()).toBe(false)
  })

  it('hidden document: never sets the attribute', () => {
    stubMatchMedia(false)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    run()
    expect(attr()).toBe(false)
  })

  it('matchMedia throwing: does not throw and does not set the attribute', () => {
    vi.stubGlobal('matchMedia', () => { throw new Error('boom') })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    expect(run).not.toThrow()
    expect(attr()).toBe(false)
  })

  it('is plain ES5 with no data embedded', () => {
    const src = readFileSync(SRC_PATH, 'utf8')
    expect(src).not.toMatch(/=>|\bconst\b|\blet\b|`/)
  })
})
