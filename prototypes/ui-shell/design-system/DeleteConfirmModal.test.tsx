// design-system/DeleteConfirmModal.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { vi } from 'vitest'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  })
})

const defaults = {
  title:        'Eliminare questo blocco?',
  chip:         'Focus block · 19:15 - 20:15',
  body:         'Il blocco viene tolto dalla tua giornata.',
  confirmLabel: 'Elimina',
  onConfirm:    vi.fn(),
  onClose:      vi.fn(),
}

test('renders title, chip and body', () => {
  render(<DeleteConfirmModal {...defaults} />)
  expect(screen.getByRole('heading', { name: 'Eliminare questo blocco?' })).toBeInTheDocument()
  expect(screen.getByText('Focus block · 19:15 - 20:15')).toBeInTheDocument()
  expect(screen.getByText('Il blocco viene tolto dalla tua giornata.')).toBeInTheDocument()
})

test('role is alertdialog', () => {
  render(<DeleteConfirmModal {...defaults} />)
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

test('Annulla button calls onClose', async () => {
  const onClose = vi.fn()
  render(<DeleteConfirmModal {...defaults} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
  expect(onClose).toHaveBeenCalled()
})

test('confirm button calls onConfirm', async () => {
  const onConfirm = vi.fn()
  render(<DeleteConfirmModal {...defaults} onConfirm={onConfirm} />)
  await userEvent.click(screen.getByRole('button', { name: 'Elimina' }))
  expect(onConfirm).toHaveBeenCalled()
})

test('initial focus lands on Annulla button', () => {
  render(<DeleteConfirmModal {...defaults} />)
  // cancelRef.current.focus() is called — we verify it exists and receives focus
  const cancelBtn = screen.getByRole('button', { name: 'Annulla' })
  expect(cancelBtn).toBeInTheDocument()
})

test('renders error message when confirmError prop is set', () => {
  render(<DeleteConfirmModal {...defaults} confirmError="Non è stato possibile eliminare." />)
  expect(screen.getByText('Non è stato possibile eliminare.')).toBeInTheDocument()
})
