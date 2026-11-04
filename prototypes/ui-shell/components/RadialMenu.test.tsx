// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { createRef } from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { RadialMenu } from './RadialMenu'
import { MENU_ITEMS } from '@/lib/constants'

// ── Helper ────────────────────────────────────────────────────────────────

function setup(isOpen = false) {
  const onOpen         = vi.fn()
  const onClose        = vi.fn()
  const onExitRequest  = vi.fn()
  render(
    <RadialMenu
      visible={true}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      onExitRequest={onExitRequest}
      firstItemRef={createRef()}
      firstFallbackItemRef={createRef()}
      centerButtonRef={createRef()}
    />,
  )
  return { onOpen, onClose, onExitRequest }
}

beforeEach(() => { vi.clearAllMocks() })

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RadialMenu', () => {

  it('1. renders a nav with aria-label "Navigazione principale"', () => {
    setup()
    expect(screen.getByRole('navigation', { name: 'Navigazione principale' })).toBeTruthy()
  })

  it('2. renders 6 radial items each with --angle CSS var and data-id', () => {
    setup()
    for (const item of MENU_ITEMS) {
      const el = document.querySelector(`[data-id="${item.id}"]`) as HTMLElement | null
      expect(el, `missing item ${item.id}`).toBeTruthy()
      const angle = el!.style.getPropertyValue('--angle')
      expect(angle, `--angle missing on ${item.id}`).not.toBe('')
      // --angle is (item.angle - 90)deg; first item (angle=0) → -90deg
      const expected = `${item.angle - 90}deg`
      expect(angle).toBe(expected)
    }
  })

  it('3. renders fallback list with 6 labelled links', () => {
    setup()
    const fallback = screen.getByRole('list', { name: 'Navigazione - lista' })
    expect(fallback).toBeTruthy()
    for (const item of MENU_ITEMS) {
      expect(fallback.querySelector(`a[href="/${item.id}"]`), `missing fallback link for ${item.id}`).toBeTruthy()
    }
  })

  it('4. palette CSS vars injected on root nav', () => {
    setup()
    const nav = screen.getByRole('navigation')
    expect(nav.style.getPropertyValue('--bg-from')).not.toBe('')
    expect(nav.style.getPropertyValue('--glow-1')).not.toBe('')
  })

  it('5. center button click calls onOpen when closed', () => {
    const { onOpen } = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('6. center button click calls onClose when open', () => {
    const { onClose } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi menu' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('7. Escape key calls onClose when menu is open', () => {
    const { onClose } = setup(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('8. Escape key does nothing when menu is already closed', () => {
    const { onClose } = setup(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('9. glow divs have data-glow attribute', () => {
    setup()
    const glows = document.querySelectorAll('[data-glow]')
    expect(glows.length).toBe(3)
  })

  it('10. satellite row is not present when menu is closed', () => {
    setup(false)
    expect(screen.queryByText('Impostazioni')).toBeNull()
  })

  it('11. satellite row renders when menu is open', () => {
    setup(true)
    expect(screen.getByText('Impostazioni')).toBeTruthy()
    expect(screen.getByText('Esci')).toBeTruthy()
  })

  it('12. Impostazioni satellite links to /settings', () => {
    setup(true)
    const link = screen.getByRole('link', { name: 'Impostazioni' })
    expect(link.getAttribute('href')).toBe('/settings')
  })

  it('13. Esci satellite calls onExitRequest', () => {
    const { onExitRequest } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }))
    expect(onExitRequest).toHaveBeenCalledOnce()
  })

})
