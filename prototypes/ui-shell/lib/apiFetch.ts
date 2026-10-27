function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const csrfToken = getCookie('XSRF-TOKEN')
  const method    = (init.method ?? 'GET').toUpperCase()
  const headers   = new Headers(init.headers)

  if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  return fetch(url, { ...init, headers, credentials: 'include' })
}
