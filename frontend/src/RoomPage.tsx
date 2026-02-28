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
  id: string
  status: string
  target_word?: string | null
  taboo_words?: string[] | null
}

type Role = 'gm' | 'player' | null

function getStoredToken(roomId: string): { token: string | null; role: Role } {
  const token = localStorage.getItem(`taboo_room_${roomId}_token`)
  const role = (localStorage.getItem(`taboo_room_${roomId}_role`) as Role) ?? null
  return { token, role }
}

function storeToken(roomId: string, token: string, role: Role) {
  localStorage.setItem(`taboo_room_${roomId}_token`, token)
  if (role) {
    localStorage.setItem(`taboo_room_${roomId}_role`, role)
  }
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>()
  const roomId = params.roomId ?? ''

  const [{ token, role }, setTokenState] = useState<{ token: string | null; role: Role }>(() =>
    roomId ? getStoredToken(roomId) : { token: null, role: null },
  )

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinName, setJoinName] = useState(() => getStoredPlayerName())
  const [joining, setJoining] = useState(false)
  const [autoJoinFailed, setAutoJoinFailed] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [gmGameState, setGmGameState] = useState<'PREPARING' | 'PLAYING' | 'FINISHED'>('PREPARING')
  const hasAutoJoinRunRef = useRef(false)

  useEffect(() => {
    if (!roomId || roomId.trim() === '') {
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
    QRCode.toString(url, { type: 'svg', margin: 1 })
      .then(setQrSvg)
      .catch(() => setQrSvg(null))
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

  if (!roomId || roomId.trim() === '') {
    return (
      <>
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <p className="text-red-500 font-bold">[ ERROR: INVALID_SESSION_ID ]</p>
        </main>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <p className="text-slate-300 animate-pulse">[ ESTABLISHING_CONNECTION... ]</p>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <div className="ascii-border border-double px-6 py-4">
            <p className="text-red-500 font-bold mb-2">++ CRITICAL_ERROR</p>
            <p className="text-slate-300">{error}</p>
          </div>
        </main>
      </>
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
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-4">CONNECTING TO SESSION #{room.id}</h1>
            <p className="text-slate-400">Authenticating as [{getStoredPlayerName()}]...</p>
            <div className="mt-4 flex justify-center gap-2 text-blue-500">
              <span>.</span><span className="animate-pulse">.</span><span>.</span>
            </div>
          </div>
        </main>
      )
    }
    return (
      <>
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex flex-col min-h-screen">
          <header className="mb-6 w-full text-center border-b border-dashed border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-white text-center">SESSION #{room.id}</h1>
          </header>

          <section className="ascii-border border-double w-full px-4 py-6">
            <h2 className="text-xl text-blue-500 font-bold mb-4">++ AUTHENTICATION_REQUIRED</h2>

            <p className="text-sm text-slate-300 mb-6">
              ENTER YOUR DESIGNATION TO PROCEED TO THE COMMUNICATIONS ARRAY.
            </p>

            <div className="mb-6">
              <p className="text-sm text-slate-500 mb-2">QR_UPLINK:</p>
              <div className="flex flex-wrap items-center gap-4">
                {qrDataUrl && (
                  <div className="bg-white p-1">
                    <img src={qrDataUrl} alt="Scan to join room" width={100} height={100} className="block" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-300 block mb-1">DIRECT_LINK:</span>
                  <span className="font-mono text-xs break-all text-blue-400">{inviteUrl}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-1 text-lg text-white" htmlFor="join-name">[ YOUR_IDENTITY ]</label>
              <input
                type="text"
                id="join-name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="terminal-input"
                placeholder="PLAYER_NAME"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4">ERR: {error}</p>
            )}

            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="ascii-btn w-full"
            >
              {joining ? 'LINKING...' : '< JOIN />'}
            </button>
          </section>
        </main>
      </>
    )
  }

  // We have a token: show GM or player view.
  const tabooWords = room.taboo_words

  return (
    <>
      <div className="scanlines"></div>
      <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex flex-col min-h-screen">
        <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-dashed border-gray-800 pb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white mb-2">SESSION #{room.id}</h1>
            <p className="min-w-0 text-xs text-slate-500 break-all">
              UPLINK: <span className="text-blue-400">{inviteUrl}</span>
            </p>
          </div>
          {qrDataUrl && (
            <div
              className={`flex-shrink-0 bg-white p-1 transition-transform ${role === 'gm' && gmGameState !== 'PLAYING' ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
              onClick={() => {
                if (role === 'gm' && gmGameState !== 'PLAYING') {
                  setQrModalOpen(true)
                }
              }}
              title={role === 'gm' && gmGameState !== 'PLAYING' ? "Tap to enlarge QR code" : undefined}
            >
              <img src={qrDataUrl} alt="Scan to join room" width={48} height={48} className="block" />
            </div>
          )}
        </div>

        {qrModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setQrModalOpen(false)}
          >
            <div
              className="bg-white p-6 max-w-full max-h-full flex flex-col items-center justify-center rounded-xl shadow-[0_0_40px_rgba(59,130,246,0.3)] animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {qrSvg ? (
                <div
                  className="w-[85vw] h-[85vw] max-w-[600px] max-h-[600px] [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <img
                  src={qrDataUrl || ''}
                  alt="Scan to join room"
                  className="w-[85vw] h-[85vw] max-w-[600px] max-h-[600px] object-contain rounded-lg"
                />
              )}
              <p className="mt-6 text-slate-800 font-black text-2xl md:text-3xl tracking-wide uppercase">Scan to Join</p>
              <p className="text-slate-500 font-mono text-sm mt-2">{inviteUrl}</p>
              <button
                onClick={() => setQrModalOpen(false)}
                className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all text-lg w-full md:w-auto"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {role === 'gm' ? (
          <GameRoomGM
            roomId={room.id}
            targetWord={room.target_word ?? ''}
            tabooWords={tabooWords ?? []}
            token={token}
            onStateChange={setGmGameState}
          />
        ) : (
          <GameRoomPlayer roomId={room.id} token={token} />
        )}
      </main>
    </>
  )
}

