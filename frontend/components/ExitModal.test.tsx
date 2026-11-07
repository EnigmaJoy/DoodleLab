// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { ExitModal } from './ExitModal'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  })
  vi.clearAllMocks()
})

describe('ExitModal', () => {

  it('1. renders dialog when isOpen=true', () => {
    const onClose   = vi.fn()
    const onConfirm = vi.fn()
    render(<ExitModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Uscire da Agenda?')).toBeTruthy()
  })

  it('2. does not render dialog content when isOpen=false', () => {
    const onClose   = vi.fn()
    const onConfirm = vi.fn()
    render(<ExitModal isOpen={false} onClose={onClose} onConfirm={onConfirm} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('3. "Annulla" button calls onClose', async () => {
    const onClose   = vi.fn()
    const onConfirm = vi.fn()
    render(<ExitModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('4. "Esci" button calls onConfirm', async () => {
    const onClose   = vi.fn()
    const onConfirm = vi.fn()
    render(<ExitModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('5. scrim click calls onClose', async () => {
    const onClose   = vi.fn()
    const onConfirm = vi.fn()
    render(<ExitModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)
    const dialog = screen.getByRole('alertdialog')
    await userEvent.click(dialog)
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('6. dialog has proper ARIA attributes', () => {
    const onClose   = vi.fn()
    const onConfirm = vi.fn()
    render(<ExitModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
  })

})
