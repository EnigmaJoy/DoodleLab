import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { SessionGuard } from './guards/session.guard'
import { InMemorySessionStore } from './providers/in-memory-session.store'
import { SESSION_STORE } from './types/session-store.interface'
import type { AuthConfig } from '../config/auth.config'

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: SESSION_STORE,
      useClass: InMemorySessionStore,
    },
    {
      provide: 'REQUIRED_ACR',
      useFactory: (config: ConfigService): string =>
        config.get<AuthConfig>('auth')?.keycloakRequiredAcr ?? '2',
      inject: [ConfigService],
    },
    SessionGuard,
    {
      provide:    APP_GUARD,
      useExisting: SessionGuard,
    },
  ],
})
export class AuthModule {}
