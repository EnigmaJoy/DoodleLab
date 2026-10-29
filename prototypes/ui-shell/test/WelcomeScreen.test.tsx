import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import type { AuthErrorCode } from '@/lib/welcome-state'

const NETWORK_COPY =
  'Non riesco a raggiungere Google in questo momento. Controlla la connessione e riprova.'

function setup(opts: { authError?: AuthErrorCode | null; authConfigured?: boolean } = {}) {
  const onLogin = vi.fn()
  const utils = render(
    <WelcomeScreen
      visible
      authError={opts.authError ?? null}
      onLogin={onLogin}
      authConfigured={opts.authConfigured ?? true}
    />,
  )
  const root = utils.container.firstElementChild as HTMLElement
  return { ...utils, onLogin, root }
}

function googleButton() {
  return screen.getByRole('button', { name: /accedi con google/i })
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WelcomeScreen - initial render', () => {
  it('shows the headings, copy, button and info rows', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome in Agenda' }).className)
      .toContain('sr-only')
    expect(screen.getByRole('heading', { level: 2, name: 'Il tuo spazio per giorni, pensieri e idee.' }))
      .toBeTruthy()
    expect(screen.getByText('Accedi per ritrovare Agenda su tutti i tuoi dispositivi.')).toBeTruthy()
    expect(googleButton()).toBeTruthy()
    expect(screen.getByText('Il calendario lo colleghi dopo, solo se vuoi.')).toBeTruthy()
    const strong = screen.getByText('non vengono mai inviati a Google')
    expect(strong.tagName).toBe('STRONG')
    expect(strong.parentElement!.textContent).toBe(
      'Note, diario ed esercizi restano in Agenda e non vengono mai inviati a Google.',
    )
  })

  it('has no register, guest, cancel, privacy or calendar controls', () => {
    setup()
    for (const re of [/registrati/i, /senza account/i, /annulla/i, /privacy/i, /calendario/i]) {
      expect(screen.queryByRole('button', { name: re })).toBeNull()
      expect(screen.queryByRole('link', { name: re })).toBeNull()
    }
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('the card content region is a polite live region', () => {
    const { container } = setup()
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('is hidden, inert and aria-hidden when not visible', () => {
    const { container } = render(
      <WelcomeScreen visible={false} authError={null} onLogin={() => {}} authConfigured />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('screen')
    expect(root.hasAttribute('data-hidden')).toBe(true)
    expect(root.hasAttribute('inert')).toBe(true)
    expect(root.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('WelcomeScreen - sign in', () => {
  it('calls onLogin exactly once, even when the button is activated again while busy', () => {
    const { onLogin } = setup()
    const btn = googleButton()
    fireEvent.click(btn)
    // Further activations of the (now disabled, busy) button must not navigate again.
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(googleButton().getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain("Reindirizzamento all'accesso sicuro…")
  })

  it('busy: the button keeps its G logo and label, is disabled, and the spinner sits in the card', () => {
    const { container } = setup()
    fireEvent.click(googleButton())
    const btn = googleButton()
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.querySelector('svg.google-btn-logo')).not.toBeNull()
    expect(btn.querySelector('.welcome-spinner')).toBeNull()
    const spinner = container.querySelector('.welcome-spinner')
    expect(spinner).not.toBeNull()
    expect(spinner!.getAttribute('aria-hidden')).toBe('true')
    // Spinner precedes the status text.
    const status = screen.getByRole('status')
    expect(spinner!.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offline: does not call onLogin and shows the network error', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { onLogin } = setup()
    fireEvent.click(googleButton())
    expect(onLogin).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain(NETWORK_COPY)
    expect(screen.getByRole('heading', { level: 2, name: 'Accesso non completato' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Riprova ad accedere con Google' })).toBeTruthy()
  })

  it('not configured: shows the unavailable message and does not call onLogin', () => {
    const { onLogin } = setup({ authConfigured: false })
    fireEvent.click(googleButton())
    expect(onLogin).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Autenticazione non ancora disponibile.')
    expect(screen.getByRole('heading', { level: 2, name: 'Accesso non completato' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Riprova ad accedere con Google' })).toBeTruthy()
  })

  it('not configured: keyboard focus stays on the same button, now the retry button', () => {
    setup({ authConfigured: false })
    const btn = googleButton()
    btn.focus()
    fireEvent.click(btn)
    const retry = screen.getByRole('button', { name: 'Riprova ad accedere con Google' })
    expect(retry).toBe(btn)
    expect(document.activeElement).toBe(retry)
  })

  it('offline: keyboard focus stays on the same button, now the retry button', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    setup()
    const btn = googleButton()
    btn.focus()
    fireEvent.click(btn)
    const retry = screen.getByRole('button', { name: 'Riprova ad accedere con Google' })
    expect(retry).toBe(btn)
    expect(document.activeElement).toBe(retry)
  })

  it('a repeated failed retry re-mounts the alert so it is announced again', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    setup()
    fireEvent.click(googleButton())
    const first = screen.getByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Riprova ad accedere con Google' }))
    const second = screen.getByRole('alert')
    expect(second).not.toBe(first)
    expect(second.textContent).toContain(NETWORK_COPY)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('retry from the error state signs in when back online', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { onLogin } = setup()
    fireEvent.click(googleButton())
    online.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Riprova ad accedere con Google' }))
    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('pageshow persisted resets busy state', () => {
    const { onLogin } = setup()
    fireEvent.click(googleButton())
    expect(googleButton().getAttribute('aria-busy')).toBe('true')
    const ev = new Event('pageshow')
    Object.defineProperty(ev, 'persisted', { value: true })
    act(() => { window.dispatchEvent(ev) })
    const btn = screen.getByRole('button', { name: 'Accedi con Google' })
    expect(btn.getAttribute('aria-busy')).not.toBe('true')
    expect(btn.hasAttribute('disabled')).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(btn)
    expect(onLogin).toHaveBeenCalledTimes(2)
  })
})

describe('WelcomeScreen - auth_error feedback', () => {
  it('cancelled: status line, no alert', () => {
    setup({ authError: 'cancelled' })
    expect(screen.getByRole('status').textContent).toContain(
      'Accesso annullato: puoi riprovare quando vuoi.',
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('failed: alert with the failure copy', () => {
    setup({ authError: 'failed' })
    expect(screen.getByRole('alert').textContent).toContain(
      "Non è stato possibile completare l'accesso. Riprova.",
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Accesso non completato' })).toBeTruthy()
  })

  it('auth_error stripped from URL', () => {
    window.history.replaceState(null, '', '/?auth_error=failed')
    setup({ authError: 'failed' })
    expect(window.location.search).toBe('')
  })

  it('keeps other query params when stripping auth_error', () => {
    window.history.replaceState(null, '', '/?a=1&auth_error=cancelled&b=2')
    setup({ authError: 'cancelled' })
    expect(window.location.search).toBe('?a=1&b=2')
  })
})

describe('WelcomeScreen - decoration', () => {
  it('the handwriting SVG is decorative', () => {
    const { container } = setup()
    const svg = container.querySelector('svg.welcome-handwriting')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
    expect(within(container).queryByText('Welcome')).toBeNull()
  })

  it('never adds an intro class itself (the intro is gated by public/welcome-intro.js)', () => {
    const { root } = setup()
    expect(root.className).not.toMatch(/intro/)
  })

  it('content cross-fade runs only on state changes, not on first paint', () => {
    const { container } = setup()
    expect(container.querySelector('.welcome-card-content--swap')).toBeNull()
    fireEvent.click(googleButton())
    expect(container.querySelector('.welcome-card-content--swap')).not.toBeNull()
  })

  it('errore shows a decorative icon before the heading', () => {
    setup({ authError: 'failed' })
    const icon = document.querySelector('.welcome-error-icon')
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute('aria-hidden')).toBe('true')
  })
})
