export interface StorageAdapter {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

export class LocalStorageAdapter implements StorageAdapter {
  read(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* storage full or unavailable — fail silently */
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* fail silently */
    }
  }
}
