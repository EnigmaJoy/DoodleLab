// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockUnlock  = vi.fn()
const mockRecover = vi.fn()

vi.mock('@/lib/vault/vault-context', () => ({
  useVaultContext: () => ({ unlock: mockUnlock, recover: mockRecover }),
}))

// Import after mocks
import VaultUnlockPage from './page'

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  render(<VaultUnlockPage />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VaultUnlockPage', () => {
  it('a. PIN field and Sblocca button render', () => {
    setup()
    expect(screen.getByTestId('pin-input')).toBeTruthy()
    expect(screen.getByTestId('sblocca-btn')).toBeTruthy()
    expect(screen.getByTestId('sblocca-btn').textContent).toBe('Sblocca')
  })

  it('b. Successful unlock calls unlock(pin) and navigates to "/"', async () => {
    mockUnlock.mockResolvedValue(true)
    setup()

    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '123456' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('sblocca-btn'))
    })

    expect(mockUnlock).toHaveBeenCalledOnce()
    expect(mockUnlock).toHaveBeenCalledWith('123456')
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('c. Failed unlock shows "PIN non corretto" error', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()

    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: 'wrongpin' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('sblocca-btn'))
    })

    expect(mockUnlock).toHaveBeenCalledOnce()
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByTestId('error-msg').textContent).toBe('PIN non corretto')
  })

  it('d. Recovery section is hidden by default', () => {
    setup()
    expect(screen.queryByTestId('recovery-input')).toBeNull()
    expect(screen.queryByTestId('recupera-btn')).toBeNull()
  })

  it('e. Recovery section shows when toggle clicked', () => {
    setup()
    fireEvent.click(screen.getByTestId('recovery-toggle'))
    expect(screen.getByTestId('recovery-input')).toBeTruthy()
    expect(screen.getByTestId('recupera-btn')).toBeTruthy()
  })

  it('f. Successful recover calls recover(code) and navigates to "/"', async () => {
    mockRecover.mockResolvedValue(true)
    setup()

    // Open recovery section
    fireEvent.click(screen.getByTestId('recovery-toggle'))

    const testCode = 'ab'.repeat(24) // 48 chars
    fireEvent.change(screen.getByTestId('recovery-input'), { target: { value: testCode } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('recupera-btn'))
    })

    expect(mockRecover).toHaveBeenCalledOnce()
    expect(mockRecover).toHaveBeenCalledWith(testCode)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('g. Failed recover shows "Codice non valido" error', async () => {
    mockRecover.mockResolvedValue(false)
    setup()

    // Open recovery section
    fireEvent.click(screen.getByTestId('recovery-toggle'))

    fireEvent.change(screen.getByTestId('recovery-input'), { target: { value: 'badcode' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('recupera-btn'))
    })

    expect(mockRecover).toHaveBeenCalledOnce()
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByTestId('error-msg').textContent).toBe('Codice non valido')
  })
})
