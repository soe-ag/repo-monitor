// AES-256-GCM encryption for GitHub tokens stored in Convex.
// The key lives in the Convex environment variable TOKEN_ENCRYPTION_KEY
// (base64-encoded, 32 bytes). Generate one with: openssl rand -base64 32

const PREFIX = 'enc:v1:'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(rawKey: string | undefined): Promise<CryptoKey> {
  if (!rawKey) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set in the Convex environment. Generate one with `openssl rand -base64 32` and set it with `npx convex env set TOKEN_ENCRYPTION_KEY <value>`.'
    )
  }

  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = fromBase64(rawKey.trim())
  } catch {
    throw new Error('TOKEN_ENCRYPTION_KEY must be base64-encoded.')
  }
  if (bytes.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.')
  }

  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(PREFIX)
}

export async function encryptToken(
  plaintext: string,
  rawKey: string | undefined = process.env.TOKEN_ENCRYPTION_KEY
): Promise<string> {
  const key = await importKey(rawKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  return `${PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`
}

/**
 * Decrypts a stored token. Values without the encryption prefix are legacy
 * plaintext tokens and are returned unchanged; they are re-saved encrypted the
 * next time the connection is saved.
 */
export async function decryptToken(
  stored: string,
  rawKey: string | undefined = process.env.TOKEN_ENCRYPTION_KEY
): Promise<string> {
  if (!isEncryptedToken(stored)) return stored

  const [ivPart, dataPart] = stored.slice(PREFIX.length).split(':')
  if (!ivPart || !dataPart) throw new Error('Stored GitHub token is malformed.')

  const key = await importKey(rawKey)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      key,
      fromBase64(dataPart)
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new Error(
      'Could not decrypt the stored GitHub token. The encryption key may have changed; reconnect your PAT.'
    )
  }
}
