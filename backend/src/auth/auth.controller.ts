import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthenticatedUser } from './types/authenticated-user'

// Minimal controller to expose GET /api/auth/me.
// The APP_GUARD rejects unauthenticated requests with 401 before this handler runs.
// Returns the verified user identity for authenticated requests (Increment B+).

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }
}
