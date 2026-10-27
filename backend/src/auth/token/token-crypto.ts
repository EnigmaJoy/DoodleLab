import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTokenError'
  }
}

export class TokenCrypto {
  private readonly key: Buffer

  constructor(hexKey: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters')
    this.key = Buffer.from(hexKey, 'hex')
    if (this.key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY decoded to unexpected length')
  }

  encrypt(plaintext: string): string {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${nonce.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
  }

  decrypt(stored: string): string {
    const parts = stored.split(':')
    if (parts.length !== 3) throw new InvalidTokenError('Malformed encrypted token')
    const [nonceHex, ciphertextHex, tagHex] = parts
    try {
      const nonce = Buffer.from(nonceHex, 'hex')
      const ciphertext = Buffer.from(ciphertextHex, 'hex')
      const tag = Buffer.from(tagHex, 'hex')
      const decipher = createDecipheriv('aes-256-gcm', this.key, nonce)
      decipher.setAuthTag(tag)
      return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
    } catch {
      throw new InvalidTokenError('Decryption failed')
    }
  }
}
