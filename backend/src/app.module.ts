import { Module } from '@nestjs/common'
import { AppConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'

@Module({
  imports: [
    AppConfigModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
