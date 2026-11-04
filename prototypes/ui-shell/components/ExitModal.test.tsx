// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ExitModal } from './ExitModal'

function setup(isOpen: boolean) {
  const onClose   = vi.fn()
  const onConfirm = vi.fn()
  render(<ExitModal isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} />)
  return { onClose, onConfirm }
}

beforeEach(() => { vi.clearAllMocks() })

describe('ExitModal', () => {

  it('1. renders dialog when isOpen=true', () => {
    setup(true)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Vuoi uscire?')).toBeTruthy()
  })

  it('2. does not render dialog content when isOpen=false', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('3. "Annulla" button calls onClose', () => {
    const { onClose } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('4. "Esci" button calls onConfirm', () => {
    const { onConfirm } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('5. Escape key calls onClose when open', () => {
    const { onClose } = setup(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('6. dialog has aria-modal and aria-labelledby', () => {
    setup(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('exit-modal-title')
    expect(document.getElementById('exit-modal-title')).toBeTruthy()
  })

})
