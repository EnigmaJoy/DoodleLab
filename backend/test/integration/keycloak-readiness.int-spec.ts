export {}
const RUN = process.env['RUN_INTEGRATION_TESTS'] === 'true'
const describeIf = RUN ? describe : describe.skip

// Note: Keycloak management port 9000 is not exposed to the host.
// To run this test, temporarily add "9000:9000" to keycloak ports in docker-compose.yml
// OR run via docker exec -- see docs/local-auth-setup.md.
describeIf('Keycloak management port healthcheck (integration)', () => {
  it('GET http://localhost:9000/health/ready returns 200 with status UP', async () => {
    const res  = await fetch('http://localhost:9000/health/ready')
    const body = await res.json() as { status: string }
    expect(res.status).toBe(200)
    expect(body.status).toBe('UP')
  })
})
