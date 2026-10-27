import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import * as Joi from 'joi'
import { authConfig } from './auth.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [authConfig],
      validationSchema: Joi.object({
        // Keycloak - allowed to be empty in Increment A (no provider configured)
        KEYCLOAK_ISSUER_URL:    Joi.string().uri().default('http://localhost:8080/realms/agenda'),
        KEYCLOAK_JWKS_URI:      Joi.string().uri().default('http://localhost:8080/realms/agenda/protocol/openid-connect/certs'),
        KEYCLOAK_CLIENT_ID:     Joi.string().default('agenda-bff'),
        KEYCLOAK_AUDIENCE:      Joi.string().default('agenda-bff'),
        KEYCLOAK_REQUIRED_ACR:  Joi.string().default('2'),
        // Session - required; app will not start without these
        SESSION_SECRET:         Joi.string().min(32).required(),
        SESSION_TTL_SECONDS:    Joi.number().integer().min(60).default(1800),
        // Origins
        ALLOWED_ORIGINS:        Joi.string().default('http://localhost:3000'),
        // Database
        DATABASE_URL:               Joi.string().uri().required(),
        // Token encryption
        TOKEN_ENCRYPTION_KEY:       Joi.string().length(64).required(),
        // OIDC (BFF client secret)
        KEYCLOAK_BFF_CLIENT_SECRET: Joi.string().required(),
        // Frontend redirect
        FRONTEND_APP_URL:           Joi.string().uri().default('http://localhost:3000/?view=menu'),
        // Server
        PORT:                   Joi.number().integer().default(3001),
        NODE_ENV:               Joi.string().valid('development', 'production', 'test').default('development'),
      }),
      validationOptions: { abortEarly: false },
    }),
  ],
})
export class AppConfigModule {}
