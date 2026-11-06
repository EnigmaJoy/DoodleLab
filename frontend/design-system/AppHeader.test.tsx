// design-system/AppHeader.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}))

import { AppHeader } from './AppHeader'

beforeEach(() => { vi.clearAllMocks() })

function setup(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const defaults = { returnVariant: 'back' as const, title: 'Test' }
  render(<AppHeader {...defaults} {...props} />)
}

describe('AppHeader', () => {
  it('1. returnVariant="menu" renders button aria-label "Apri menu"', () => {
    setup({ returnVariant: 'menu', onMenuOpen: vi.fn() })
    expect(screen.getByRole('button', { name: 'Apri menu' })).toBeTruthy()
  })

  it('2. returnVariant="menu" click calls onMenuOpen', () => {
    const onMenuOpen = vi.fn()
    setup({ returnVariant: 'menu', onMenuOpen })
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }))
    expect(onMenuOpen).toHaveBeenCalledOnce()
  })

  it('3. returnVariant="back" renders button aria-label "Indietro"', () => {
    setup({ returnVariant: 'back' })
    expect(screen.getByRole('button', { name: 'Indietro' })).toBeTruthy()
  })

  it('4. returnVariant="back" click calls router.back()', () => {
    setup({ returnVariant: 'back' })
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(mockBack).toHaveBeenCalledOnce()
  })

  it('5. title is rendered as h1', () => {
    setup({ title: 'Impostazioni' })
    expect(screen.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeTruthy()
  })

  it('6. meta and subtitle rendered when provided', () => {
    setup({ meta: 'lunedì 4 novembre', subtitle: '3 post-it' })
    expect(screen.getByText('lunedì 4 novembre')).toBeTruthy()
    expect(screen.getByText('3 post-it')).toBeTruthy()
  })

  it('7. SegmentedControl rendered for segmented viewControl; value change calls onChange', () => {
    const onChange = vi.fn()
    setup({
      viewControl: {
        kind:    'segmented',
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        value:   'a',
        onChange,
      },
    })
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('8. PeriodStepper rendered for stepper viewControl; callbacks wired', () => {
    const onPrev  = vi.fn()
    const onNext  = vi.fn()
    const onToday = vi.fn()
    setup({
      viewControl: { kind: 'stepper', label: 'nov 2026', onPrev, onNext, onToday },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mese precedente' }))
    expect(onPrev).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
    expect(onNext).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Vai a oggi' }))
    expect(onToday).toHaveBeenCalledOnce()
  })

  it('9. icon action rendered; click calls onClick', () => {
    const onClick = vi.fn()
    setup({
      actions: [{ kind: 'icon', label: 'Aggiungi', icon: <span>+</span>, onClick }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('10. scroll state: sentinel intersection → data-scrolled on header', () => {
    // Mock IntersectionObserver — must be a class so `new IntersectionObserver(…)` works
    let ioCallback: IntersectionObserverCallback
    const mockIo = { observe: vi.fn(), disconnect: vi.fn() }
    class MockIO {
      constructor(cb: IntersectionObserverCallback) { ioCallback = cb }
      observe   = mockIo.observe
      disconnect = mockIo.disconnect
    }
    vi.stubGlobal('IntersectionObserver', MockIO)

    setup()

    const header = document.querySelector('header')!
    expect(header.hasAttribute('data-scrolled')).toBe(false)

    act(() => {
      ioCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        mockIo as unknown as IntersectionObserver,
      )
    })

    expect(header.hasAttribute('data-scrolled')).toBe(true)

    vi.unstubAllGlobals()
  })
})
