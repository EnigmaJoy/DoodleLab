'use client'

import { useState, useEffect } from 'react'

export interface CurrentUser {
  sub:    string
  email?: string
  name?:  string
  acr?:   string
}

export function useCurrentUser(): CurrentUser | null | undefined {
  // undefined = loading, null = unauthenticated, CurrentUser = authenticated
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.status === 401) return null
        if (!res.ok) throw new Error(`/api/auth/me returned ${res.status}`)
        return res.json() as Promise<CurrentUser>
      })
      .then(data => { if (!cancelled) setUser(data) })
      .catch(() => { if (!cancelled) setUser(null) })
    return () => { cancelled = true }
  }, [])

  return user
}
