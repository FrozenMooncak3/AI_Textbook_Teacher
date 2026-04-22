import { GoogleAuth, type IdTokenClient } from 'google-auth-library'

const requireIamAuth = process.env.OCR_REQUIRE_IAM_AUTH === 'true'

let cachedAuth: GoogleAuth | null = null
const clientCache = new Map<string, IdTokenClient>()

function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    const credentialsJson = process.env.GCP_SA_KEY_JSON
    if (credentialsJson) {
      cachedAuth = new GoogleAuth({
        credentials: JSON.parse(credentialsJson),
      })
    } else {
      cachedAuth = new GoogleAuth()
    }
  }
  return cachedAuth
}

export async function buildOcrHeaders(targetUrl: string): Promise<Record<string, string>> {
  const appToken = process.env.OCR_SERVER_TOKEN || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Token': appToken,
  }

  if (requireIamAuth) {
    const audience = new URL(targetUrl).origin
    let client = clientCache.get(audience)
    if (!client) {
      const auth = getAuth()
      client = await auth.getIdTokenClient(audience)
      clientCache.set(audience, client)
    }
    const idHeaders = await client.getRequestHeaders()
    const authHeader = idHeaders.Authorization || idHeaders.authorization
    if (authHeader) {
      headers.Authorization = authHeader
    }
  }

  return headers
}
