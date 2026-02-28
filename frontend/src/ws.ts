export function buildWsBase(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsPort = import.meta.env.VITE_WS_PORT as string | undefined
  const host = wsPort ? `${window.location.hostname}:${wsPort}` : window.location.host
  return `${protocol}//${host}`
}

export function buildGameWsUrl(): string {
  return `${buildWsBase()}/ws/game`
}

export function buildRoomWsUrl(roomId: string, token: string): string {
  const base = buildWsBase()
  const encodedToken = encodeURIComponent(token)
  return `${base}/ws/room/${roomId}?token=${encodedToken}`
}

