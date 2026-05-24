export function resolveGitHubToken(connection: { tokenSource: 'pat' | 'oauth'; token: string }) {
  if (connection.tokenSource === 'pat') {
    return connection.token
  }

  return null
}
