// LIVE TESTS -- manual execution only.
// Requires: Docker Compose stack healthy, real Google account, TOTP device.
// NOT part of pnpm test or pnpm test:integration automated runs.
// Run individual scenarios by hand following docs/local-auth-setup.md.

describe.skip('Live auth flow (manual only)', () => {
  it('1. First registration: Registrati -> Google -> TOTP enrollment -> /?view=menu', () => {
    // See docs/local-auth-setup.md checklist item 5-8
  })
  it('2. Returning login: Accedi -> Google (may skip password) -> TOTP entry -> same identity', () => {})
  it('3. Required MFA: claims param enforces ACR 2; verify in Keycloak admin console', () => {})
  it('4. Cancel flow: error=access_denied -> 400; no session created', () => {})
  it('5. Expired local session: SESSION_TTL_SECONDS=10; wait 11s; GET /me -> 401', () => {})
  it('6. Logout: session deleted; Keycloak SSO terminated; Welcome shown; re-login requires TOTP', () => {})
  it('7. Browser restart: session cookie gone; Welcome screen on next visit', () => {})
})
