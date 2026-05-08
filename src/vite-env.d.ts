/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATANEST_SERVER: string
  readonly VITE_CORE_SERVER: string
  readonly VITE_METRIQ_SERVER: string
  readonly VITE_AIVOX_SERVER: string
  readonly VITE_JESOOS_SERVER: string
  readonly VITE_KEYCLOAK_URL: string
  readonly VITE_KEYCLOAK_REALM: string
  readonly VITE_KEYCLOAK_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
