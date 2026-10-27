import type { Request } from 'express'
import type { AuthenticatedUser } from './authenticated-user'
import type { SessionRecord } from './session-record'

export interface RequestWithSession extends Request {
  user?:      AuthenticatedUser
  session?:   SessionRecord
  sessionId?: string
}
