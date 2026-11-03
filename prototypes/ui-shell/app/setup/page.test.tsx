// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSetup = vi.fn()

vi.mock('@/lib/vault/vault-context', () => ({
  useVaultContext: () => ({ setup: mockSetup }),
}))

// Predictable bytes: 24 bytes all 0xab → hex "abababababababababababababababababababababababababab" (48 chars)
vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: ArrayBufferView) => {
  const u8 = arr as Uint8Array
  u8.fill(0xab)
  return u8
})

// Import after mocks
import VaultSetupPage from './page'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXPECTED_RECOVERY_CODE = 'ab'.repeat(24) // 48 chars

function setup() {
  render(<VaultSetupPage />)
}

function fillStep1(pin = '123456', confirm = '123456') {
  fireEvent.change(screen.getByTestId('pin-input'), { target: { value: pin } })
  fireEvent.change(screen.getByTestId('confirm-pin-input'), { target: { value: confirm } })
}

async function advanceToStep2(pin = '123456') {
  fillStep1(pin, pin)
  await act(async () => {
    fireEvent.click(screen.getByTestId('continua-btn'))
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockSetup.mockResolvedValue(undefined)
})

describe('VaultSetupPage — Step 1', () => {
  it('a. "Continua" is disabled when PIN is shorter than 6 chars', () => {
    setup()
    fillStep1('123', '123')
    expect((screen.getByTestId('continua-btn') as HTMLButtonElement).disabled).toBe(true)
  })

  it('a. "Continua" is disabled when PINs do not match', () => {
    setup()
    fillStep1('123456', '654321')
    expect((screen.getByTestId('continua-btn') as HTMLButtonElement).disabled).toBe(true)
  })

  it('a. "Continua" is disabled when PIN field is empty', () => {
    setup()
    expect((screen.getByTestId('continua-btn') as HTMLButtonElement).disabled).toBe(true)
  })

  it('b. "Continua" is enabled when PINs match and are >= 6 chars', () => {
    setup()
    fillStep1('securepin', 'securepin')
    expect((screen.getByTestId('continua-btn') as HTMLButtonElement).disabled).toBe(false)
  })

  it('b. "Continua" is enabled with exactly 6 matching chars', () => {
    setup()
    fillStep1('123456', '123456')
    expect((screen.getByTestId('continua-btn') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('VaultSetupPage — Step 2', () => {
  it('c. Advancing to step 2 shows the recovery code', async () => {
    setup()
    await advanceToStep2()
    expect(screen.getByTestId('recovery-code')).toBeTruthy()
    expect(screen.getByTestId('recovery-code').textContent).toBe(EXPECTED_RECOVERY_CODE)
  })

  it('c. Recovery code is exactly 48 hex characters', async () => {
    setup()
    await advanceToStep2()
    const code = screen.getByTestId('recovery-code').textContent ?? ''
    expect(code).toHaveLength(48)
    expect(/^[0-9a-f]+$/.test(code)).toBe(true)
  })

  it('d. "Inizia" is disabled until the checkbox is checked', async () => {
    setup()
    await advanceToStep2()
    expect((screen.getByTestId('inizia-btn') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByTestId('saved-checkbox'))
    expect((screen.getByTestId('inizia-btn') as HTMLButtonElement).disabled).toBe(false)
  })

  it('e. "Inizia" calls setup() with correct args and navigates to "/"', async () => {
    const testPin   = 'mypin1'
    const testEmail = 'user@example.com'

    setup()

    // Fill email in step 1
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: testEmail } })
    await advanceToStep2(testPin)

    // Check the checkbox
    fireEvent.click(screen.getByTestId('saved-checkbox'))

    // Click Inizia
    await act(async () => {
      fireEvent.click(screen.getByTestId('inizia-btn'))
    })

    expect(mockSetup).toHaveBeenCalledOnce()
    expect(mockSetup).toHaveBeenCalledWith(testPin, EXPECTED_RECOVERY_CODE, testEmail)
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('e. "Inizia" calls setup() with undefined hint when email is empty', async () => {
    const testPin = 'mypin2'

    setup()
    await advanceToStep2(testPin)

    fireEvent.click(screen.getByTestId('saved-checkbox'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('inizia-btn'))
    })

    expect(mockSetup).toHaveBeenCalledWith(testPin, EXPECTED_RECOVERY_CODE, undefined)
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})
