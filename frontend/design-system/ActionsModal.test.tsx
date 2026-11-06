import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionsModal } from './ActionsModal'

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
  eyebrow:     'BLOCCO FLESSIBILE',
  title:       'Focus block',
  meta:        '19:15 - 20:15 · 60 minuti',
  description: 'È tuo e flessibile.',
  items: [
    { icon: <span>⏰</span>, label: 'Cambia orario', onClick: vi.fn() },
    { icon: <span>🗑</span>, label: 'Elimina blocco', onClick: vi.fn(), danger: true },
  ],
  onClose: vi.fn(),
}

test('renders eyebrow, title, meta, description', () => {
  render(<ActionsModal {...defaults} />)
  expect(screen.getByText('BLOCCO FLESSIBILE')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Focus block' })).toBeInTheDocument()
  expect(screen.getByText('19:15 - 20:15 · 60 minuti')).toBeInTheDocument()
  expect(screen.getByText('È tuo e flessibile.')).toBeInTheDocument()
})

test('role is dialog', () => {
  render(<ActionsModal {...defaults} />)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('renders all action items', () => {
  render(<ActionsModal {...defaults} />)
  expect(screen.getByRole('button', { name: /Cambia orario/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Elimina blocco/ })).toBeInTheDocument()
})

test('clicking a non-danger item calls its onClick', async () => {
  const onClick = vi.fn()
  const items = [{ icon: <span />, label: 'Cambia orario', onClick }]
  render(<ActionsModal {...defaults} items={items} />)
  await userEvent.click(screen.getByRole('button', { name: /Cambia orario/ }))
  expect(onClick).toHaveBeenCalled()
})

test('X (Chiudi) button closes modal', async () => {
  render(<ActionsModal {...defaults} />)
  await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
  expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
})
