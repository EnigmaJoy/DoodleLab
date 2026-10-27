import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { timingSafeEqual } from 'crypto'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import type { RequestWithSession } from '../types/request-with-session'

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<RequestWithSession>()
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) return true

    const header   = req.headers['x-csrf-token']
    const token    = Array.isArray(header) ? header[0] : header
    const expected = req.session?.csrfToken

    if (
      !token ||
      !expected ||
      token.length !== expected.length ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    ) {
      throw new ForbiddenException('CSRF token mismatch')
    }
    return true
  }
}
