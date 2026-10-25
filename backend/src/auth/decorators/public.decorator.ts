import { SetMetadata } from '@nestjs/common'

// Mark a route or controller as public.
// SessionGuard skips ALL checks (session, identity, MFA) for @Public() endpoints.
// Never apply @Public() to an endpoint that accesses private data.

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true)
