import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { SKIP_MFA_KEY } from '../decorators/skip-mfa.decorator'
import { SESSION_STORE } from '../types/session-store.interface'
import type { SessionStore } from '../types/session-store.interface'
import type { AuthenticatedUser } from '../types/authenticated-user'

type RequestWithUser = Request & { user?: AuthenticatedUser }

// Deny-by-default authentication guard registered as APP_GUARD.
// All routes are protected unless decorated @Public().
// Full session + identity + MFA assurance required by default.
// @SkipMfa() skips only the ACR check; session and identity remain enforced.

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject('REQUIRED_ACR') private readonly requiredAcr: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request   = context.switchToHttp().getRequest<RequestWithUser>()
    const sessionId = (request.cookies as Record<string, string> | undefined)?.['session_id']

    if (!sessionId) throw new UnauthorizedException()

    const session = await this.sessionStore.get(sessionId)

    if (!session || session.expiresAt <= Date.now()) throw new UnauthorizedException()

    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!skipMfa && session.acr !== this.requiredAcr) throw new UnauthorizedException()

    request.user = session.user
    return true
  }
}
