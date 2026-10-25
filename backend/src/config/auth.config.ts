// Typed accessor for auth configuration values.
// Consumed by AuthModule providers via ConfigService.

export interface AuthConfig {
  keycloakIssuerUrl: string
  keycloakJwksUri: string
  keycloakClientId: string
  keycloakAudience: string
  keycloakRequiredAcr: string
  sessionSecret: string
  sessionTtlSeconds: number
  allowedOrigins: string[]
}

export const authConfig = (): { auth: AuthConfig } => ({
  auth: {
    keycloakIssuerUrl:    process.env['KEYCLOAK_ISSUER_URL'] ?? '',
    keycloakJwksUri:     process.env['KEYCLOAK_JWKS_URI'] ?? '',
    keycloakClientId:    process.env['KEYCLOAK_CLIENT_ID'] ?? '',
    keycloakAudience:    process.env['KEYCLOAK_AUDIENCE'] ?? '',
    keycloakRequiredAcr: process.env['KEYCLOAK_REQUIRED_ACR'] ?? '',
    sessionSecret:       process.env['SESSION_SECRET'] ?? '',
    sessionTtlSeconds:   parseInt(process.env['SESSION_TTL_SECONDS'] ?? '3600', 10),
    allowedOrigins:      (process.env['ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean),
  },
})
