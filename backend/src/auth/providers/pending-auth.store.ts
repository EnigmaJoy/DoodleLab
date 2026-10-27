import { randomBytes } from 'crypto'
import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'pg'
import { PG_POOL } from '../../database/pg.module'

export interface PendingAuthRecord {
  nonce:         string
  codeVerifier:  string
  flow:          'login' | 'register'
}

@Injectable()
export class PendingAuthStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(flow: 'login' | 'register'): Promise<{ id: string; state: string; nonce: string; codeVerifier: string }> {
    const id           = randomBytes(32).toString('hex')
    const state        = randomBytes(32).toString('hex')
    const nonce        = randomBytes(32).toString('hex')
    const codeVerifier = randomBytes(64).toString('hex')
    const expiresAt    = new Date(Date.now() + 10 * 60 * 1000)

    await this.pool.query(
      `INSERT INTO pending_auth (id, state, nonce, code_verifier, flow, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, state, nonce, codeVerifier, flow, expiresAt],
    )
    return { id, state, nonce, codeVerifier }
  }

  async consume(id: string, state: string): Promise<PendingAuthRecord | undefined> {
    const result = await this.pool.query<{
      nonce: string; code_verifier: string; flow: string
    }>(
      `DELETE FROM pending_auth
       WHERE id = $1 AND state = $2 AND expires_at > NOW()
       RETURNING nonce, code_verifier, flow`,
      [id, state],
    )
    if (result.rowCount === 0) return undefined
    const row = result.rows[0]
    return {
      nonce:        row.nonce,
      codeVerifier: row.code_verifier,
      flow:         row.flow as 'login' | 'register',
    }
  }
}
