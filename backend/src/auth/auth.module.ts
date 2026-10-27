import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AuthController }         from './auth.controller'
import { SessionGuard }           from './guards/session.guard'
import { CsrfGuard }              from './guards/csrf.guard'
import { PgSessionStore }         from './providers/pg-session.store'
import { PendingAuthStore }       from './providers/pending-auth.store'
import { MigrationRunnerService } from './migration-runner.service'
import { OidcModule }             from './oidc/oidc.module'
import { SESSION_STORE }          from './types/session-store.interface'
import type { AuthConfig }        from '../config/auth.config'

@Module({
  imports: [OidcModule],
  controllers: [AuthController],
  providers: [
    { provide: SESSION_STORE, useClass: PgSessionStore },
    {
      provide: 'REQUIRED_ACR',
      useFactory: (config: ConfigService): string =>
        config.get<AuthConfig>('auth')?.keycloakRequiredAcr ?? '2',
      inject: [ConfigService],
    },
    SessionGuard,
    { provide: APP_GUARD, useExisting: SessionGuard },
    CsrfGuard,
    { provide: APP_GUARD, useExisting: CsrfGuard },
    PendingAuthStore,
    MigrationRunnerService,
  ],
})
export class AuthModule {}
