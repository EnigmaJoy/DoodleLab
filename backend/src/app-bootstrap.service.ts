import { Injectable, OnApplicationBootstrap, Logger, Inject } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from './database/pg.module'

@Injectable()
export class AppBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppBootstrapService.name)

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.pool.query('SELECT 1')
      this.logger.log('Database connection verified')
    } catch (err) {
      this.logger.error(`Database connection failed: ${(err as Error).message}`)
      throw err
    }
  }
}
