import { GoogleAuth } from 'google-auth-library'

const requireIamAuth = process.env.OCR_REQUIRE_IAM_AUTH === 'true'

let cachedAuth: GoogleAuth | null = null

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
    const auth = getAuth()
    const audience = new URL(targetUrl).origin
    const client = await auth.getIdTokenClient(audience)
    const idHeaders = await client.getRequestHeaders()
    const authHeader = idHeaders.Authorization || idHeaders.authorization
    if (authHeader) {
      headers.Authorization = authHeader
    }
  }

  return headers
}
