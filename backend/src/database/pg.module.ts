import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'

export const PG_POOL = 'PG_POOL'

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Pool({ connectionString: config.getOrThrow('DATABASE_URL') })
      },
    },
  ],
  exports: [PG_POOL],
})
export class PgModule {}
