export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '')
  }

  const wsPort = import.meta.env.VITE_WS_PORT as string | undefined
  if (wsPort) {
    const protocol = window.location.protocol
    const host = window.location.hostname
    return `${protocol}//${host}:${wsPort}/api`
  }

  return '/api'
}

