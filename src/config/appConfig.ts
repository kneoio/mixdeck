type KeycloakConfig = {
  url: string
  realm: string
  clientId: string
}

type AppConfig = {
  datanestServer: string
  metriqServer: string
  keycloak: KeycloakConfig
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function readEnvString(key: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[key]
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }
  return fallback
}

function readRequiredEnvString(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key]
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }
  throw new Error(`Missing required environment variable: ${String(key)}`)
}

export const appConfig: AppConfig = {
  datanestServer: normalizeUrl(readRequiredEnvString('VITE_DATANEST_SERVER')),
  metriqServer: normalizeUrl(readRequiredEnvString('VITE_METRIQ_SERVER')),
  keycloak: {
    url: normalizeUrl(readEnvString('VITE_KEYCLOAK_URL', 'https://auth.semantyca.com')),
    realm: readEnvString('VITE_KEYCLOAK_REALM', 'master'),
    clientId: readEnvString('VITE_KEYCLOAK_CLIENT_ID', 'mixdeck'),
  }
}
