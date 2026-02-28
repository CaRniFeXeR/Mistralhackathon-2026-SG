import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiBaseUrl } from '../api'

interface PastGameEntry {
  id: number
  room_id: string
  target_word: string
  taboo_words: string[]
  started_at: string
  ended_at: string | null
  winner_type: string | null
  winning_guess: string | null
  final_transcript: string | null
}

export default function GamesHistoryPage() {
  const [games, setGames] = useState<PastGameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [exportingAll, setExportingAll] = useState(false)

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true)
      setError(null)
      try {
        const apiBase = getApiBaseUrl()
        const response = await fetch(`${apiBase}/games`)
        if (!response.ok) {
          throw new Error(`Failed to load games (${response.status})`)
        }
        const data = (await response.json()) as PastGameEntry[]
        setGames(data)
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Failed to load past games')
      } finally {
        setLoading(false)
      }
    }
    fetchGames()
  }, [])

  async function handleExport(gameId: number, format: 'csv' | 'json') {
    setExportingId(gameId)
    try {
      const apiBase = getApiBaseUrl()
      const url = `${apiBase}/games/${gameId}/ai-guess-export?format=${format}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`)
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `ai-guess-history-${gameId}.${format}`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingId(null)
    }
  }

  async function handleExportAll() {
    setExportingAll(true)
    try {
      const apiBase = getApiBaseUrl()
      const response = await fetch(`${apiBase}/games/export-all`)
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`)
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? 'all-games-export.json'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingAll(false)
    }
  }

  if (loading) {
    return (
      <>
        <div className="scanlines" />
        <main className="max-w-3xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <p className="text-slate-300 animate-pulse">[ LOADING_PAST_GAMES... ]</p>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="scanlines" />
        <main className="max-w-2xl w-full p-4 md:p-8 mx-auto flex items-center justify-center min-h-screen">
          <div className="ascii-border border-double px-6 py-4 space-y-3 w-full max-w-xl">
            <p className="text-red-500 font-bold">++ ERROR</p>
            <p className="text-slate-300">{error}</p>
            <div className="pt-2">
              <Link to="/" className="ascii-btn inline-flex items-center justify-center px-4 py-2 text-sm">
                &lt; BACK /&gt;
              </Link>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <div className="scanlines" />
      <main className="max-w-3xl w-full p-4 md:p-8 mx-auto flex flex-col min-h-screen space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-gray-800 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            PAST GAMES &mdash; AI GUESS EXPORT
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exportingAll || games.length === 0}
              onClick={handleExportAll}
              className="ascii-btn text-xs px-3 py-2 disabled:opacity-50"
            >
              {exportingAll ? '...' : 'DOWNLOAD ALL'}
            </button>
            <Link to="/" className="ascii-btn text-xs px-3 py-2">
              &lt; BACK /&gt;
            </Link>
          </div>
        </header>

        <p className="text-slate-400 text-sm">
          Finished room rounds. Export AI guess history (prompt input, LLM output, ground truth) as CSV or JSON.
        </p>

        {games.length === 0 ? (
          <div className="ascii-border border-double p-6 text-center text-slate-500">
            <p>NO_PAST_GAMES_RECORDED</p>
            <p className="text-xs mt-2">Complete at least one room game to see it here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {games.map((g) => {
              const startedAt = g.started_at ? new Date(g.started_at) : null
              const endedAt = g.ended_at ? new Date(g.ended_at) : null
              const isExporting = exportingId === g.id
              return (
                <li key={g.id} className="ascii-border border-double p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-blue-500 font-mono text-sm">#{g.id}</span>
                      <span className="text-slate-400 mx-2">|</span>
                      <span className="text-slate-300 font-semibold uppercase">{g.target_word}</span>
                      <span className="text-slate-500 text-xs ml-2">room {g.room_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => handleExport(g.id, 'csv')}
                        className="ascii-btn text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        {isExporting ? '...' : 'EXPORT CSV'}
                      </button>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => handleExport(g.id, 'json')}
                        className="ascii-btn text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        EXPORT JSON
                      </button>
                    </div>
                  </div>
                  {g.taboo_words.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {g.taboo_words.map((w) => (
                        <span
                          key={w}
                          className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs border border-red-500/50 line-through"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    {startedAt && <span>Started {startedAt.toLocaleString()}</span>}
                    {endedAt && (
                      <>
                        <span className="mx-2">|</span>
                        <span>Ended {endedAt.toLocaleString()}</span>
                      </>
                    )}
                    {g.winner_type && (
                      <>
                        <span className="mx-2">|</span>
                        <span className="text-emerald-500/80">Winner: {g.winner_type}</span>
                        {g.winning_guess && (
                          <span className="text-slate-400"> &quot;{g.winning_guess}&quot;</span>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
