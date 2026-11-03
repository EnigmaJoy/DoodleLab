import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './vault-crypto'

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

describe('vault-crypto', () => {
  it('encrypt then decrypt returns the original plaintext', async () => {
    const key = await makeKey()
    const plaintext = 'hello vault — unicode: àèì'
    const ct = await encrypt(key, plaintext)
    expect(await decrypt(key, ct)).toBe(plaintext)
  })

  it('iv and ciphertext are base64url strings', async () => {
    const key = await makeKey()
    const ct = await encrypt(key, 'data')
    expect(ct.iv).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(ct.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('each encrypt call produces a different IV', async () => {
    const key = await makeKey()
    const ct1 = await encrypt(key, 'same')
    const ct2 = await encrypt(key, 'same')
    expect(ct1.iv).not.toBe(ct2.iv)
  })

  it('decrypt with tampered IV throws', async () => {
    const key = await makeKey()
    const ct = await encrypt(key, 'data')
    const badIv = ct.iv.slice(0, -4) + (ct.iv.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    await expect(decrypt(key, { ...ct, iv: badIv })).rejects.toThrow()
  })

  it('decrypt with tampered ciphertext throws', async () => {
    const key = await makeKey()
    const ct = await encrypt(key, 'data')
    // Flip the last character
    const last = ct.ciphertext.charCodeAt(ct.ciphertext.length - 1)
    const flipped = String.fromCharCode(last === 65 ? 66 : 65)  // A↔B
    const badCt = ct.ciphertext.slice(0, -1) + flipped
    await expect(decrypt(key, { ...ct, ciphertext: badCt })).rejects.toThrow()
  })
})
