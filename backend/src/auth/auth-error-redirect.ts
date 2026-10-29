export const AUTH_ERROR_CODES = ['cancelled', 'failed'] as const
export type AuthErrorCode = typeof AUTH_ERROR_CODES[number]

export function authErrorRedirectUrl(frontendUrl: string, code: AuthErrorCode): string {
  return new URL('/?auth_error=' + code, frontendUrl).toString()
}
