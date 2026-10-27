import { createHash } from 'crypto'
import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'pg'
import { PG_POOL } from '../../database/pg.module'
import type { SessionStore } from '../types/session-store.interface'
import type { SessionRecord } from '../types/session-record'
import type { AuthenticatedUser } from '../types/authenticated-user'

@Injectable()
export class PgSessionStore implements SessionStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private hash(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex')
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const idHash = this.hash(sessionId)
    const result = await this.pool.query<{
      user_data: AuthenticatedUser
      acr: string
      csrf_token: string
      encrypted_refresh_token: string
      encrypted_id_token: string
      expires_at: Date
    }>(
      `SELECT user_data, acr, csrf_token, encrypted_refresh_token, encrypted_id_token, expires_at
       FROM sessions
       WHERE id_hash = $1 AND expires_at > NOW()`,
      [idHash],
    )
    if (result.rowCount === 0) return undefined
    const row = result.rows[0]
    return {
      user:                   row.user_data,
      acr:                    row.acr,
      csrfToken:              row.csrf_token,
      encryptedRefreshToken:  row.encrypted_refresh_token,
      encryptedIdToken:       row.encrypted_id_token,
      expiresAt:              row.expires_at.getTime(),
    }
  }

  async set(sessionId: string, record: SessionRecord): Promise<void> {
    const idHash = this.hash(sessionId)
    await this.pool.query(
      `INSERT INTO sessions
         (id_hash, user_data, acr, csrf_token, encrypted_refresh_token, encrypted_id_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))`,
      [
        idHash,
        JSON.stringify(record.user),
        record.acr,
        record.csrfToken,
        record.encryptedRefreshToken,
        record.encryptedIdToken,
        record.expiresAt,
      ],
    )
  }

  async delete(sessionId: string): Promise<void> {
    const idHash = this.hash(sessionId)
    await this.pool.query('DELETE FROM sessions WHERE id_hash = $1', [idHash])
  }
}
