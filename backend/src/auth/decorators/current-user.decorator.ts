import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../types/authenticated-user'

// Extract the verified AuthenticatedUser from the request.
// Only valid in controllers protected by SessionGuard (i.e., not @Public() routes).
// Returns undefined if called on a @Public() route.

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    return request.user
  },
)
