import { PgSessionStore } from '../../src/auth/providers/pg-session.store'
import { createHash } from 'crypto'
import type { SessionRecord } from '../../src/auth/types/session-record'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const RAW_ID  = 'raw-session-id-value'
const ID_HASH = sha256(RAW_ID)

function makeRecord(): SessionRecord {
  return {
    user:                   { sub: 'user-1', email: 'u@example.com' },
    acr:                    '2',
    csrfToken:              'csrf-abc',
    encryptedRefreshToken:  'nonce:cipher:tag',
    encryptedIdToken:       'nonce:cipher:tag',
    expiresAt:              Date.now() + 60_000,
  }
}

function makePool(queryResult: { rows: unknown[]; rowCount: number }) {
  return { query: jest.fn().mockResolvedValue(queryResult) }
}

describe('PgSessionStore', () => {
  describe('get', () => {
    it('returns a SessionRecord when a valid row is found', async () => {
      const record = makeRecord()
      const row = {
        user_data:               record.user,
        acr:                     record.acr,
        csrf_token:              record.csrfToken,
        encrypted_refresh_token: record.encryptedRefreshToken,
        encrypted_id_token:      record.encryptedIdToken,
        expires_at:              new Date(record.expiresAt),
      }
      const pool  = makePool({ rows: [row], rowCount: 1 })
      const store = new PgSessionStore(pool as never)

      const result = await store.get(RAW_ID)

      expect(result).toMatchObject({ user: record.user, acr: '2', csrfToken: 'csrf-abc' })
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id_hash = $1'),
        [ID_HASH],
      )
    })

    it('returns undefined when no row is returned (expired filtered by DB)', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      expect(await store.get(RAW_ID)).toBeUndefined()
    })

    it('returns undefined when rowCount is 0 regardless of rows array', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      expect(await store.get('any-id')).toBeUndefined()
    })
  })

  describe('set', () => {
    it('executes INSERT with SHA-256 hash of the raw session ID, not the raw value', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      await store.set(RAW_ID, makeRecord())

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/INSERT INTO sessions/)
      expect(params[0]).toBe(ID_HASH)
      expect(params[0]).not.toBe(RAW_ID)
    })
  })

  describe('delete', () => {
    it('executes DELETE with the hashed ID', async () => {
      const pool  = makePool({ rows: [], rowCount: 0 })
      const store = new PgSessionStore(pool as never)
      await store.delete(RAW_ID)

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/DELETE FROM sessions/)
      expect(params[0]).toBe(ID_HASH)
    })
  })
})
