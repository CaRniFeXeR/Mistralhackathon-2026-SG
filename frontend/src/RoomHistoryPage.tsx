import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from './api'

interface RoomHistoryGuess {
  id: number
  guess_text: string
  is_win: boolean
  source?: string | null
  display_name?: string | null
  created_at: string
}

interface RoomHistoryResponse {
  id: string
  status: string
  target_word?: string | null
  taboo_words: string[]
  final_transcript?: string | null
  winning_guess?: string | null
  winner_type?: string | null
  winner_user_id?: string | null
  winner_display_name?: string | null
  time_remaining_seconds?: number | null
  started_at?: string | null
  ended_at?: string | null
  created_at: string
  guesses: RoomHistoryGuess[]
}

type Role = 'gm' | 'player' | null

function getStoredToken(roomId: string): { token: string | null; role: Role } {
  const token = localStorage.getItem(`taboo_room_${roomId}_token`)
  const role = (localStorage.getItem(`taboo_room_${roomId}_role`) as Role) ?? null
  return { token, role }
}

export default function RoomHistoryPage() {
  const params = useParams<{ roomId: string }>()
  const roomId = params.roomId ?? ''

  const [{ token, role }] = useState<{ token: string | null; role: Role }>(() =>
    roomId ? getStoredToken(roomId) : { token: null, role: null },
  )

  const [history, setHistory] = useState<RoomHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId || roomId.trim() === '') {
      setError('Invalid room id')
      setLoading(false)
      return
    }
    if (!token || role !== 'gm') {
      setError('History is only available to the Game Master for this room.')
      setLoading(false)
      return
    }

    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const apiBase = getApiBaseUrl()
        const response = await fetch(`${apiBase}/rooms/${roomId}/history`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Room not found')
          }
          if (response.status === 403) {
            throw new Error('History is only available to the Game Master for this room.')
          }
          throw new Error(`Failed to load history (${response.status})`)
        }
        const data = (await response.json()) as RoomHistoryResponse
        setHistory(data)
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Failed to load history')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [roomId, token, role])

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
          <p className="text-slate-300 animate-pulse">[ LOADING_SESSION_HISTORY... ]</p>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <div className="ascii-border border-double px-6 py-4 space-y-3 w-full max-w-xl">
            <p className="text-red-500 font-bold">++ HISTORY_UNAVAILABLE</p>
            <p className="text-slate-300">{error}</p>
            <div className="pt-2">
              <Link
                to={`/room/${roomId}`}
                className="ascii-btn inline-flex items-center justify-center px-4 py-2 text-sm"
              >
                &lt; BACK_TO_SESSION /&gt;
              </Link>
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!history) {
    return null
  }

  const startedAt = history.started_at ? new Date(history.started_at) : null
  const endedAt = history.ended_at ? new Date(history.ended_at) : null
  const createdAt = history.created_at ? new Date(history.created_at) : null

  return (
    <>
      <div className="scanlines"></div>
      <main className="max-w-3xl w-full p-4 md:p-8 mx-auto flex flex-col min-h-screen space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-gray-800 pb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              SESSION #{history.id} &mdash; HISTORY
            </h1>
            <p className="text-xs text-slate-500">
              STATUS:{' '}
              <span className="text-blue-400 font-semibold uppercase">{history.status}</span>
            </p>
            {createdAt && (
              <p className="text-xs text-slate-500">
                CREATED:{' '}
                <span className="text-slate-300">
                  {createdAt.toLocaleString()}
                </span>
              </p>
            )}
            {startedAt && (
              <p className="text-xs text-slate-500">
                STARTED:{' '}
                <span className="text-slate-300">
                  {startedAt.toLocaleString()}
                </span>
              </p>
            )}
            {endedAt && (
              <p className="text-xs text-slate-500">
                ENDED:{' '}
                <span className="text-slate-300">
                  {endedAt.toLocaleString()}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/room/${roomId}`}
              className="ascii-btn text-xs px-3 py-2"
            >
              &lt; BACK_TO_SESSION /&gt;
            </Link>
          </div>
        </header>

        <section className="ascii-border border-double p-4 space-y-3">
          <h2 className="text-sm text-blue-500 font-bold tracking-widest">
            [ TARGET_PROFILE ]
          </h2>
          <p className="text-slate-300 text-lg font-bold uppercase">
            {history.target_word || 'UNKNOWN'}
          </p>
          {history.taboo_words && history.taboo_words.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-red-400 font-bold tracking-widest mb-1">
                RESTRICTED_TERMS:
              </p>
              <div className="flex flex-wrap gap-2">
                {history.taboo_words.map((word) => (
                  <span
                    key={word}
                    className="px-2 py-1 bg-red-900/30 text-red-400 text-xs border border-red-500/50 line-through uppercase"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
          {history.winner_type && history.winning_guess && (
            <div className="pt-2 text-xs text-emerald-400">
              OUTCOME:{' '}
              <span className="font-semibold">
                {history.winner_type === 'AI'
                  ? 'AI'
                  : history.winner_display_name || 'PLAYER'}{' '}
                guessed &quot;{history.winning_guess}&quot;
              </span>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
          <section className="ascii-border border-double p-4 flex flex-col h-[320px]">
            <h2 className="text-sm text-blue-500 font-bold tracking-widest mb-2">
              [ FINAL_TRANSCRIPT ]
            </h2>
            <div className="flex-1 overflow-y-auto font-mono text-sm text-green-400 leading-relaxed uppercase pr-2">
              {history.final_transcript && history.final_transcript.trim().length > 0 ? (
                history.final_transcript
              ) : (
                <span className="text-slate-600 opacity-50">
                  &gt; NO_TRANSCRIPT_RECORDED
                </span>
              )}
            </div>
          </section>

          <section className="ascii-border border-double p-4 flex flex-col h-[320px]">
            <h2 className="text-sm text-blue-500 font-bold tracking-widest mb-2">
              [ GUESS_FEED ]
            </h2>
            <p className="text-xs text-slate-500 mb-2">
              TOTAL_GUESSES:{' '}
              <span className="text-slate-300 font-semibold">
                {history.guesses.length}
              </span>
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {history.guesses.length === 0 && (
                <p className="text-slate-700 text-xs py-2">
                  &gt; NO_GUESSES_RECORDED
                </p>
              )}
              {history.guesses.map((g) => {
                const fromAi = (g.source ?? '').toUpperCase() === 'AI'
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-xs ${
                      g.is_win
                        ? 'bg-emerald-500/20 border-emerald-500/50'
                        : fromAi
                          ? 'bg-indigo-900/40 border-indigo-400/40'
                          : 'bg-slate-800/40 border-slate-700/40'
                    }`}
                  >
                    <span className="font-mono text-slate-500 shrink-0">
                      {new Date(g.created_at).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-bold tracking-wide flex-1 ${
                        g.is_win ? 'text-emerald-300' : 'text-slate-200'
                      }`}
                    >
                      {g.guess_text}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${
                        fromAi
                          ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-100'
                          : 'bg-amber-500/20 border-amber-400/50 text-amber-100'
                      }`}
                    >
                      {fromAi ? 'AI' : g.display_name || 'PLAYER'}
                    </span>
                    {g.is_win && (
                      <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-widest shrink-0">
                        WIN
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

