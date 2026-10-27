import { Module } from '@nestjs/common'
import { AppConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'
import { PgModule } from './database/pg.module'
import { AppBootstrapService } from './app-bootstrap.service'

@Module({
  imports: [
    AppConfigModule,
    PgModule,
    HealthModule,
    AuthModule,
  ],
  providers: [AppBootstrapService],
})
export class AppModule {}
