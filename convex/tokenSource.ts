import { decryptToken } from './tokenCrypto'

export async function resolveGitHubToken(connection: {
  tokenSource: 'pat' | 'oauth'
  token: string
}) {
  if (connection.tokenSource === 'pat') {
    return await decryptToken(connection.token)
  }

  return null
}
