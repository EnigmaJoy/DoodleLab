import { Injectable, OnApplicationBootstrap, Logger, Inject } from '@nestjs/common'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { Pool } from 'pg'
import { PG_POOL } from '../database/pg.module'

@Injectable()
export class MigrationRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationRunnerService.name)
  private readonly migrationsDir = process.env['MIGRATIONS_DIR'] ?? join(__dirname, '..', '..', '..', 'migrations')

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          filename   TEXT        PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await client.query('COMMIT')

      const entries = await readdir(this.migrationsDir)
      const files = entries.filter(f => f.endsWith('.sql')).sort()

      for (const filename of files) {
        const applied = await client.query(
          'SELECT 1 FROM _migrations WHERE filename = $1', [filename]
        )
        if (applied.rowCount && applied.rowCount > 0) {
          this.logger.debug(`Migration already applied: ${filename}`)
          continue
        }

        const sql = await readFile(join(this.migrationsDir, filename), 'utf-8')
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)', [filename]
        )
        await client.query('COMMIT')
        this.logger.log(`Migration applied: ${filename}`)
      }

      this.logger.log('Migrations complete')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }
}
