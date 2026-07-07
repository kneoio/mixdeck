type KeycloakConfig = {
  url: string
  realm: string
  clientId: string
}

type AppConfig = {
  datanestServer: string
  coreServer: string
  aivoxServer: string
  jesoosServer: string
  nivaroServer: string
  stripePublishableKey: string
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
  coreServer: normalizeUrl(readEnvString('VITE_CORE_SERVER', readRequiredEnvString('VITE_DATANEST_SERVER'))),
  aivoxServer: normalizeUrl(readRequiredEnvString('VITE_AIVOX_SERVER')),
  jesoosServer: normalizeUrl(readRequiredEnvString('VITE_JESOOS_SERVER')),
  nivaroServer: normalizeUrl(readEnvString('VITE_NIVARO_SERVER', '')),
  stripePublishableKey: readEnvString('VITE_STRIPE_PUBLISHABLE_KEY', ''),
  keycloak: {
    url: normalizeUrl(readEnvString('VITE_KEYCLOAK_URL', 'https://auth.semantyca.com')),
    realm: readEnvString('VITE_KEYCLOAK_REALM', 'master'),
    clientId: readEnvString('VITE_KEYCLOAK_CLIENT_ID', 'mixdeck'),
  }
}
