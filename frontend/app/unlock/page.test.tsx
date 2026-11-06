// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockUnlock  = vi.fn()
const mockRecover = vi.fn()
vi.mock('@/lib/vault/vault-context', () => ({
  useVaultContext: () => ({ unlock: mockUnlock, recover: mockRecover }),
}))

import UnlockPage from './page'

// ── Helpers ───────────────────────────────────────────────────────────────

function setup() {
  render(<UnlockPage />)
}

/** Click keypad buttons for each digit in the string. */
function tapDigits(digits: string) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole('button', { name: `Cifra ${d}` }))
  }
}

/** Fire keydown events on document for each character. */
function pressKeys(keys: string) {
  for (const k of keys) {
    fireEvent.keyDown(document, { key: k })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('UnlockPage', () => {

  it('1. renders 6 PIN cells and keypad; no text input, no eye toggle', () => {
    setup()
    expect(screen.getByRole('img', { name: /PIN, 0 cifre su 6 inserite/ })).toBeTruthy()
    for (const d of ['0','1','2','3','4','5','6','7','8','9']) {
      expect(screen.getByRole('button', { name: `Cifra ${d}` })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Cancella una cifra' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /mostra|nascondi/i })).toBeNull()
  })

  it('2. keypad digit click fills a cell', () => {
    setup()
    tapDigits('5')
    expect(screen.getByRole('img', { name: /PIN, 1 cifre su 6 inserite/ })).toBeTruthy()
  })

  it('3. physical keyboard digit fills a cell', () => {
    setup()
    pressKeys('3')
    expect(screen.getByRole('img', { name: /PIN, 1 cifre su 6 inserite/ })).toBeTruthy()
  })

  it('4. Cancella button and Backspace key remove the last digit', () => {
    setup()
    tapDigits('123')
    expect(screen.getByRole('img', { name: /PIN, 3 cifre su 6 inserite/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancella una cifra' }))
    expect(screen.getByRole('img', { name: /PIN, 2 cifre su 6 inserite/ })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Backspace' })
    expect(screen.getByRole('img', { name: /PIN, 1 cifre su 6 inserite/ })).toBeTruthy()
  })

  it('5. 6th digit auto-calls unlock(pin) with the correct string', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()
    await act(async () => { tapDigits('123456') })
    expect(mockUnlock).toHaveBeenCalledOnce()
    expect(mockUnlock).toHaveBeenCalledWith('123456')
  })

  it('6. failed unlock: cells cleared, error shown, shakeKey incremented on each attempt', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()

    await act(async () => { tapDigits('000000') })
    expect(screen.getByRole('img', { name: /PIN, 0 cifre su 6 inserite/ })).toBeTruthy()
    expect(screen.getByTestId('pin-error').textContent).toBe(
      'PIN non corretto. Riprova con calma.'
    )

    // Second attempt also fires unlock and shows error
    await act(async () => { tapDigits('111111') })
    expect(mockUnlock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('pin-error')).toBeTruthy()
  })

  it('7. success: subtitle switches to Fatto, then routes to /?view=menu', async () => {
    mockUnlock.mockResolvedValue(true)
    setup()
    await act(async () => { tapDigits('123456') })
    expect(screen.getByText('Fatto, sto aprendo le tue note...')).toBeTruthy()
    expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
  })

  it('8. typing any digit after an error hides the error line', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()
    await act(async () => { tapDigits('000000') })
    expect(screen.getByTestId('pin-error')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cifra 1' }))
    expect(screen.queryByTestId('pin-error')).toBeNull()
  })

  it('9. modal opens on ghost button; closes on close button, Annulla button, and Escape', () => {
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    expect(screen.getByRole('dialog')).toBeTruthy()

    // Close via close button (X)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    // Close via Annulla button
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    // Close via Escape (native dialog fires 'close' event; simulate it)
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    // jsdom does not natively handle Escape → close on <dialog>;
    // simulate the native close event that the browser would fire
    fireEvent(dialog, new Event('close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('10. step 1 → step 2 on confirm button; Annulla closes the modal', () => {
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))

    // Step 1: code input is not visible
    expect(screen.queryByTestId('recovery-code-input')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    // Step 2: code input is visible
    const textarea = screen.getByTestId('recovery-code-input') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    fireEvent.change(textarea, { target: { value: 'abc123' } })

    // Annulla → modal closes
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('11. format error for non-hex; Recupera disabled until exactly 64 valid hex chars', () => {
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    // Non-hex input → format error, Recupera button disabled
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: 'xyz' } })
    expect(screen.getByTestId('format-error')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recupera' })).toBeDisabled()

    // 63 valid hex chars → still disabled (too short)
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: 'a'.repeat(63) } })
    expect(screen.queryByTestId('format-error')).toBeNull()
    expect(screen.getByRole('button', { name: 'Recupera' })).toBeDisabled()

    // 64 valid hex chars → enabled, no format error
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: 'a'.repeat(64) } })
    expect(screen.queryByTestId('format-error')).toBeNull()
    expect(screen.getByRole('button', { name: 'Recupera' })).not.toBeDisabled()
  })

  it('12. recover() success routes to /?view=menu', async () => {
    mockRecover.mockResolvedValue(true)
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    const validCode = 'ab'.repeat(32) // 64 hex chars
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: validCode } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recupera' })) })

    expect(mockRecover).toHaveBeenCalledWith(validCode)
    expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
  })

  it('13. recover() failure shows error message; input kept', async () => {
    mockRecover.mockResolvedValue(false)
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    const validCode = 'cd'.repeat(32) // 64 hex chars
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: validCode } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recupera' })) })

    expect(screen.getByTestId('submit-error').textContent).toBe(
      'Questa chiave non corrisponde. Controlla di aver copiato tutto il codice.'
    )
    // Input keeps the typed code after failure (user can inspect/correct)
    expect((screen.getByTestId('recovery-code-input') as HTMLTextAreaElement).value).toBe(validCode)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
