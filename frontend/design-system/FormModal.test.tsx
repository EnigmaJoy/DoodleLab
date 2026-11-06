// design-system/FormModal.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormModal } from './FormModal'
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
  title:        'Nuova attività',
  confirmLabel: 'Aggiungi',
  onConfirm:    vi.fn(),
  onClose:      vi.fn(),
  children:     <input data-testid="field" />,
}

test('renders title and children', () => {
  render(<FormModal {...defaults} />)
  expect(screen.getByRole('heading', { name: 'Nuova attività' })).toBeInTheDocument()
  expect(screen.getByTestId('field')).toBeInTheDocument()
})

test('role is dialog', () => {
  render(<FormModal {...defaults} />)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('X (Chiudi) button calls onClose', async () => {
  const onClose = vi.fn()
  render(<FormModal {...defaults} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
  expect(onClose).toHaveBeenCalled()
})

test('Annulla button calls onClose', async () => {
  const onClose = vi.fn()
  render(<FormModal {...defaults} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
  expect(onClose).toHaveBeenCalled()
})

test('confirm button calls onConfirm', async () => {
  const onConfirm = vi.fn()
  render(<FormModal {...defaults} onConfirm={onConfirm} />)
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
  expect(onConfirm).toHaveBeenCalled()
})

test('confirm button is disabled when confirmDisabled=true', () => {
  render(<FormModal {...defaults} confirmDisabled />)
  expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeDisabled()
})

test('scrim click closes when preventScrimClose is false', async () => {
  render(<FormModal {...defaults} preventScrimClose={false} />)
  await userEvent.click(screen.getByRole('dialog'))
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
})

test('scrim click does nothing when preventScrimClose is true', async () => {
  render(<FormModal {...defaults} preventScrimClose={true} />)
  await userEvent.click(screen.getByRole('dialog'))
  expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled()
})
