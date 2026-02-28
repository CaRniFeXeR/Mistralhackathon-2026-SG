import { useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { getApiBaseUrl } from './api'
import RoomPage from './RoomPage'

const DEFAULT_TARGET = 'elephant'
const DEFAULT_TABOO = ['animal', 'trunk', 'ivory', 'Africa', 'big']

function Home() {
  const navigate = useNavigate()
  const [targetWord, setTargetWord] = useState(DEFAULT_TARGET)
  const [tabooWords, setTabooWords] = useState<string[]>(DEFAULT_TABOO)
  const [creatorName, setCreatorName] = useState('Game Master')
  const [lastResult, setLastResult] = useState<{ message: string; transcript?: string } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateRoom = async () => {
    setError(null)
    setIsCreating(true)
    try {
      const apiBase = getApiBaseUrl()
      const response = await fetch(`${apiBase}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_word: targetWord || DEFAULT_TARGET,
          taboo_words: tabooWords,
          creator_name: creatorName || 'Game Master',
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to create room (${response.status})`)
      }
      const data: { room_id: number; invite_url: string; token: string } = await response.json()
      // Persist token/role scoped to this room so users can refresh.
      localStorage.setItem(`taboo_room_${data.room_id}_token`, data.token)
      localStorage.setItem(`taboo_room_${data.room_id}_role`, 'gm')
      // Optionally remember last result message here in the future.
      setLastResult(null)
      navigate(`/room/${data.room_id}`)
    } catch (e) {
      console.error(e)
      setError('Failed to create room. Ensure the backend is running.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
        <h1 className="text-4xl font-bold tracking-tight text-white">Taboo Game</h1>
        <p className="mt-3 text-lg text-slate-300">
          Create a game room, invite friends, then describe the secret word without saying it or the taboo words.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400">Target word</label>
            <input
              type="text"
              value={targetWord}
              onChange={(e) => setTargetWord(e.target.value.trim() || DEFAULT_TARGET)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder={DEFAULT_TARGET}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400">Taboo words (comma-separated)</label>
            <input
              type="text"
              value={tabooWords.join(', ')}
              onChange={(e) =>
                setTabooWords(
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="animal, trunk, ivory"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400">Your name</label>
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Game Master"
            />
          </div>
        </div>

        {lastResult && (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-slate-300">
            <p className="font-medium">{lastResult.message}</p>
            {lastResult.transcript && (
              <p className="mt-2 text-sm text-slate-500">
                Transcript: {lastResult.transcript.slice(0, 200)}
                {lastResult.transcript.length > 200 ? '…' : ''}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-6 py-4 font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {isCreating ? 'Creating room…' : 'Create Room'}
        </button>

        <p className="mt-4 text-xs text-slate-500">
          After creating a room, you&apos;ll get an invite URL you can share with your friends.
        </p>
      </div>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  )
}

export default App
