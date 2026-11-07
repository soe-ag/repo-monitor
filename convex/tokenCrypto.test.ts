import { describe, expect, it } from 'vitest'
import { decryptToken, encryptToken, isEncryptedToken } from './tokenCrypto'

const KEY = Buffer.alloc(32, 7).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64')

describe('tokenCrypto', () => {
  it('round-trips a token without storing it in plaintext', async () => {
    const stored = await encryptToken('ghp_secret', KEY)

    expect(isEncryptedToken(stored)).toBe(true)
    expect(stored).not.toContain('ghp_secret')
    expect(await decryptToken(stored, KEY)).toBe('ghp_secret')
  })

  it('uses a fresh IV so the same token encrypts differently each time', async () => {
    const a = await encryptToken('ghp_secret', KEY)
    const b = await encryptToken('ghp_secret', KEY)

    expect(a).not.toBe(b)
  })

  it('returns legacy plaintext tokens unchanged', async () => {
    expect(await decryptToken('ghp_legacy', KEY)).toBe('ghp_legacy')
  })

  it('fails to decrypt with a different key', async () => {
    const stored = await encryptToken('ghp_secret', KEY)

    await expect(decryptToken(stored, OTHER_KEY)).rejects.toThrow(/Could not decrypt/)
  })

  it('rejects a missing or malformed key', async () => {
    await expect(encryptToken('x', undefined)).rejects.toThrow(/TOKEN_ENCRYPTION_KEY is not set/)
    await expect(encryptToken('x', Buffer.alloc(8).toString('base64'))).rejects.toThrow(/32 bytes/)
  })
})
