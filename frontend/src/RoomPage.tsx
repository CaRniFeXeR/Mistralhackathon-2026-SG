import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { getApiBaseUrl } from './api'
import GameRoomGM from './GameRoomGM'
import GameRoomPlayer from './GameRoomPlayer'

const STORED_PLAYER_NAME_KEY = 'taboo_player_name'

function getStoredPlayerName(): string {
  return (localStorage.getItem(STORED_PLAYER_NAME_KEY) ?? '').trim()
}

function hasStoredPlayerName(): boolean {
  return getStoredPlayerName().length > 0
}

interface RoomInfo {
  id: number
  status: string
  target_word?: string | null
  taboo_words?: string[] | null
}

type Role = 'gm' | 'player' | null

function getStoredToken(roomId: number): { token: string | null; role: Role } {
  const token = localStorage.getItem(`taboo_room_${roomId}_token`)
  const role = (localStorage.getItem(`taboo_room_${roomId}_role`) as Role) ?? null
  return { token, role }
}

function storeToken(roomId: number, token: string, role: Role) {
  localStorage.setItem(`taboo_room_${roomId}_token`, token)
  if (role) {
    localStorage.setItem(`taboo_room_${roomId}_role`, role)
  }
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>()
  const roomId = Number(params.roomId)

  const [{ token, role }, setTokenState] = useState<{ token: string | null; role: Role }>(() =>
    Number.isFinite(roomId) ? getStoredToken(roomId) : { token: null, role: null },
  )

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinName, setJoinName] = useState(() => getStoredPlayerName())
  const [joining, setJoining] = useState(false)
  const [autoJoinFailed, setAutoJoinFailed] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const hasAutoJoinRunRef = useRef(false)

  useEffect(() => {
    if (!Number.isFinite(roomId)) {
      setError('Invalid room id')
      setLoading(false)
      return
    }

    const fetchRoom = async () => {
      setLoading(true)
      setError(null)
      try {
        const apiBase = getApiBaseUrl()
        const headers: HeadersInit = {}
        const currentToken = getStoredToken(roomId).token
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`
        }
        const response = await fetch(`${apiBase}/rooms/${roomId}`, { headers })
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Room not found')
          }
          throw new Error(`Failed to load room (${response.status})`)
        }
        const data = (await response.json()) as RoomInfo
        setRoom(data)
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Failed to load room')
      } finally {
        setLoading(false)
      }
    }

    fetchRoom()
  }, [roomId])

  useEffect(() => {
    hasAutoJoinRunRef.current = false
  }, [roomId])

  useEffect(() => {
    if (!room) return
    const url = `${window.location.origin}${window.location.pathname}#/room/${room.id}`
    QRCode.toDataURL(url, { width: 120, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [room])

  useEffect(() => {
    if (!room || token || !hasStoredPlayerName() || hasAutoJoinRunRef.current) return
    hasAutoJoinRunRef.current = true
    const name = getStoredPlayerName()
    setJoining(true)
    setError(null)
    setAutoJoinFailed(false)
    const apiBase = getApiBaseUrl()
    fetch(`${apiBase}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to join room (${response.status})`)
        return response.json() as Promise<{ token: string }>
      })
      .then((data) => {
        storeToken(roomId, data.token, 'player')
        setTokenState({ token: data.token, role: 'player' })
      })
      .catch((e) => {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Failed to join room')
        setAutoJoinFailed(true)
      })
      .finally(() => setJoining(false))
  }, [room, roomId, token])

  const handleJoin = async () => {
    if (!joinName.trim()) return
    setJoining(true)
    setError(null)
    try {
      const apiBase = getApiBaseUrl()
      const response = await fetch(`${apiBase}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim() }),
      })
      if (!response.ok) {
        throw new Error(`Failed to join room (${response.status})`)
      }
      const data = (await response.json()) as { token: string }
      localStorage.setItem(STORED_PLAYER_NAME_KEY, joinName.trim())
      storeToken(roomId, data.token, 'player')
      setTokenState({ token: data.token, role: 'player' })
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to join room')
    } finally {
      setJoining(false)
    }
  }

  if (!Number.isFinite(roomId)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
        <p className="text-red-200">Invalid room id.</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
        <p className="text-slate-300">Loading room…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-red-500/40 bg-red-900/40 px-6 py-4 text-red-50">
          {error}
        </div>
      </main>
    )
  }

  if (!room) {
    return null
  }

  const inviteUrl = `${window.location.origin}${window.location.pathname}#/room/${room.id}`

  if (!token) {
    const showJoinForm = !hasStoredPlayerName() || autoJoinFailed
    if (!showJoinForm) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">Join Room #{room.id}</h1>
            <p className="mt-6 text-slate-300">Joining as {getStoredPlayerName()}…</p>
            <div className="mt-4 flex justify-center">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </main>
      )
    }
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
          <h1 className="text-3xl font-bold tracking-tight text-white">Join Room #{room.id}</h1>
          <p className="mt-3 text-slate-300">
            The Game Master created this room with target word and taboo words. Enter your name to join and start
            guessing.
          </p>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-300 flex flex-wrap items-center gap-4">
            {qrDataUrl && (
              <div className="flex-shrink-0 rounded-lg border border-slate-600 bg-white p-1.5">
                <img src={qrDataUrl} alt="Scan to join room" width={100} height={100} className="block" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-slate-100">Invite link: </span>
              <span className="font-mono text-xs break-all text-slate-400">{inviteUrl}</span>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-400">Your name</label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Player name"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {joining ? 'Joining…' : 'Join Room'}
          </button>
        </div>
      </main>
    )
  }

  // We have a token: show GM or player view.
  const tabooWords = room.taboo_words

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center px-6 py-12">
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-white">Taboo Room #{room.id}</h1>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {qrDataUrl && (
          <div className="flex-shrink-0 rounded-lg border border-slate-600 bg-white p-1.5">
            <img src={qrDataUrl} alt="Scan to join room" width={88} height={88} className="block" />
          </div>
        )}
        <p className="min-w-0 text-sm text-slate-400">
          Share this invite link with friends: <span className="font-mono break-all text-slate-300">{inviteUrl}</span>
        </p>
      </div>
      {role === 'gm' ? (
        <GameRoomGM
          roomId={room.id}
          targetWord={room.target_word ?? ''}
          tabooWords={tabooWords ?? []}
          token={token}
        />
      ) : (
        <GameRoomPlayer roomId={room.id} token={token} />
      )}
    </main>
  )
}

