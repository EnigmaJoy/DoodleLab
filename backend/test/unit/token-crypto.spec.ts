import { TokenCrypto, InvalidTokenError } from '../../src/auth/token/token-crypto'

const VALID_KEY = 'a'.repeat(64)

describe('TokenCrypto', () => {
  let crypto: TokenCrypto

  beforeEach(() => { crypto = new TokenCrypto(VALID_KEY) })

  it('encrypt + decrypt roundtrip returns identical plaintext', () => {
    const plaintext = 'refresh-token-value-xyz'
    expect(crypto.decrypt(crypto.encrypt(plaintext))).toBe(plaintext)
  })

  it('two encrypt calls on the same plaintext produce different ciphertext (unique nonces)', () => {
    const plaintext = 'same-value'
    expect(crypto.encrypt(plaintext)).not.toBe(crypto.encrypt(plaintext))
  })

  it('decrypt with a different key throws InvalidTokenError', () => {
    const encrypted = crypto.encrypt('secret')
    const other     = new TokenCrypto('b'.repeat(64))
    expect(() => other.decrypt(encrypted)).toThrow(InvalidTokenError)
  })

  it('decrypt with tampered ciphertext bytes throws InvalidTokenError', () => {
    const [nonce, cipher, tag] = crypto.encrypt('secret').split(':')
    const badCipher = (parseInt(cipher.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')
                      + cipher.slice(2)
    expect(() => crypto.decrypt(`${nonce}:${badCipher}:${tag}`)).toThrow(InvalidTokenError)
  })

  it('decrypt with tampered auth tag throws InvalidTokenError', () => {
    const [nonce, cipher, tag] = crypto.encrypt('secret').split(':')
    const badTag = (parseInt(tag.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')
                   + tag.slice(2)
    expect(() => crypto.decrypt(`${nonce}:${cipher}:${badTag}`)).toThrow(InvalidTokenError)
  })

  it('decrypt on malformed string (wrong colon segments) throws InvalidTokenError', () => {
    expect(() => crypto.decrypt('onlyone')).toThrow(InvalidTokenError)
    expect(() => crypto.decrypt('one:two')).toThrow(InvalidTokenError)
    expect(() => crypto.decrypt('one:two:three:four')).toThrow(InvalidTokenError)
  })

  it('constructor throws when key is not 64 hex characters', () => {
    expect(() => new TokenCrypto('tooshort')).toThrow()
    expect(() => new TokenCrypto('a'.repeat(63))).toThrow()
    expect(() => new TokenCrypto('a'.repeat(65))).toThrow()
  })
})
