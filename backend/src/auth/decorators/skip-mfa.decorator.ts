import { SetMetadata } from '@nestjs/common'

// Skip the MFA assurance check for a specific route.
// Session validity and identity verification remain enforced.
// Reserved for the MFA enrollment endpoint and explicitly approved pre-MFA routes.
// Every use requires documented justification in the PR.

export const SKIP_MFA_KEY = 'skipMfa'
export const SkipMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_MFA_KEY, true)
