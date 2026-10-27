import { Pool } from 'pg'
import { PgSessionStore } from '../../src/auth/providers/pg-session.store'
import { MigrationRunnerService } from '../../src/auth/migration-runner.service'
import type { SessionRecord } from '../../src/auth/types/session-record'

const RUN = process.env['RUN_INTEGRATION_TESTS'] === 'true'
const describeIf = RUN ? describe : describe.skip

describeIf('PgSessionStore + MigrationRunner (integration)', () => {
  let pool: Pool
  let store: PgSessionStore
  let migrator: MigrationRunnerService

  beforeAll(async () => {
    pool     = new Pool({ connectionString: process.env['DATABASE_URL'] })
    store    = new PgSessionStore(pool as never)
    migrator = new MigrationRunnerService(pool as never)
    await migrator.onApplicationBootstrap()
  })

  afterAll(async () => { await pool.end() })

  it('migration runner creates sessions and pending_auth tables', async () => {
    const res = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('sessions', 'pending_auth', '_migrations')`
    )
    const names = (res.rows as { table_name: string }[]).map(r => r.table_name)
    expect(names).toContain('sessions')
    expect(names).toContain('pending_auth')
    expect(names).toContain('_migrations')
  })

  it('running migration runner twice does not fail or insert duplicate rows', async () => {
    await expect(migrator.onApplicationBootstrap()).resolves.not.toThrow()
    const res = await pool.query('SELECT COUNT(*) FROM _migrations')
    const firstCount = parseInt((res.rows[0] as { count: string }).count, 10)
    await migrator.onApplicationBootstrap()
    const res2 = await pool.query('SELECT COUNT(*) FROM _migrations')
    expect(parseInt((res2.rows[0] as { count: string }).count, 10)).toBe(firstCount)
  })

  describe('PgSessionStore', () => {
    const rawId = 'integration-test-session-id'

    afterEach(async () => { await store.delete(rawId) })

    it('set then get returns the stored SessionRecord', async () => {
      const record: SessionRecord = {
        user:                   { sub: 'int-user-1', email: 'i@test.com' },
        acr:                    '2',
        csrfToken:              'csrf-int',
        encryptedRefreshToken:  'n:c:t',
        encryptedIdToken:       'n:c:t',
        expiresAt:              Date.now() + 60_000,
      }
      await store.set(rawId, record)
      const result = await store.get(rawId)
      expect(result?.user.sub).toBe('int-user-1')
      expect(result?.csrfToken).toBe('csrf-int')
    })

    it('get on an expired session returns undefined', async () => {
      const record: SessionRecord = {
        user: { sub: 'exp-user' }, acr: '2',
        csrfToken: 'c', encryptedRefreshToken: 'n:c:t', encryptedIdToken: 'n:c:t',
        expiresAt: Date.now() - 1000,
      }
      await store.set(rawId, record)
      expect(await store.get(rawId)).toBeUndefined()
    })

    it('delete then get returns undefined', async () => {
      const record: SessionRecord = {
        user: { sub: 'del-user' }, acr: '2',
        csrfToken: 'c', encryptedRefreshToken: 'n:c:t', encryptedIdToken: 'n:c:t',
        expiresAt: Date.now() + 60_000,
      }
      await store.set(rawId, record)
      await store.delete(rawId)
      expect(await store.get(rawId)).toBeUndefined()
    })
  })

  describe('Atomic pending-auth consumption', () => {
    it('two concurrent DELETEs: exactly one succeeds', async () => {
      const id    = 'atomic-test-id'
      const state = 'atomic-state'
      await pool.query(
        `INSERT INTO pending_auth (id, state, nonce, code_verifier, flow, expires_at)
         VALUES ($1, $2, 'n', 'cv', 'login', NOW() + INTERVAL '10 minutes')`,
        [id, state],
      )

      const [r1, r2] = await Promise.all([
        pool.query(
          `DELETE FROM pending_auth WHERE id = $1 AND state = $2 AND expires_at > NOW() RETURNING id`,
          [id, state],
        ),
        pool.query(
          `DELETE FROM pending_auth WHERE id = $1 AND state = $2 AND expires_at > NOW() RETURNING id`,
          [id, state],
        ),
      ])

      const successCount = [r1, r2].filter(r => r.rowCount === 1).length
      expect(successCount).toBe(1)
    })
  })
})
