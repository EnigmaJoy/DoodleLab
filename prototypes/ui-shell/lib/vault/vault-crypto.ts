export interface VaultCiphertext {
  iv:         string   // base64url, 12 byte
  ciphertext: string   // base64url, AES-256-GCM output + 16-byte auth tag
}

function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function fromBase64url(str: string): Uint8Array {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<VaultCiphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoded,
  )
  return {
    iv:         toBase64url(iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength)),
    ciphertext: toBase64url(ciphertextBuf),
  }
}

export async function decrypt(
  key: CryptoKey,
  data: VaultCiphertext,
): Promise<string> {
  if (!data.iv || !data.ciphertext) {
    throw new TypeError('VaultCiphertext fields must be non-empty strings')
  }
  const iv = fromBase64url(data.iv)
  const ciphertext = fromBase64url(data.ciphertext)
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(plainBuf)
}
