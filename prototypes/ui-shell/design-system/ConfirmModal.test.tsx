// design-system/ConfirmModal.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmModal } from './ConfirmModal'
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
  title: 'Uscire da Agenda?',
  body:  'Agenda si blocca.',
  confirmLabel: 'Esci',
  onConfirm: vi.fn(),
  onClose:   vi.fn(),
}

test('renders title and body', () => {
  render(<ConfirmModal {...defaults} />)
  expect(screen.getByRole('heading', { name: 'Uscire da Agenda?' })).toBeInTheDocument()
  expect(screen.getByText('Agenda si blocca.')).toBeInTheDocument()
})

test('role is alertdialog', () => {
  render(<ConfirmModal {...defaults} />)
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

test('Annulla button calls onClose via dialog.close()', async () => {
  const onClose = vi.fn()
  render(<ConfirmModal {...defaults} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
  expect(onClose).toHaveBeenCalled()
})

test('confirm button calls onConfirm', async () => {
  const onConfirm = vi.fn()
  render(<ConfirmModal {...defaults} onConfirm={onConfirm} />)
  await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
  expect(onConfirm).toHaveBeenCalled()
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
})

test('scrim click (click on dialog element itself) calls close', async () => {
  render(<ConfirmModal {...defaults} />)
  const dialog = screen.getByRole('alertdialog')
  // simulate click on the dialog element (not on the inner card)
  await userEvent.click(dialog)
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
})

test('dialog is opened with showModal on mount', () => {
  render(<ConfirmModal {...defaults} />)
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
})
