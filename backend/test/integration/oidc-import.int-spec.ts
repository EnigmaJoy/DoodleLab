export {}
const RUN = process.env['RUN_INTEGRATION_TESTS'] === 'true'
const describeIf = RUN ? describe : describe.skip

describeIf('openid-client ESM import (integration)', () => {
  it('dynamic import succeeds and exports discovery, authorizationCodeGrant, tokenRevocation as functions', async () => {
    const mod = await import('openid-client')
    expect(typeof mod.discovery).toBe('function')
    expect(typeof mod.authorizationCodeGrant).toBe('function')
    expect(typeof mod.tokenRevocation).toBe('function')
  })
})
