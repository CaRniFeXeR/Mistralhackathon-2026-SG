import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiBaseUrl } from '../api'
import tabooPresets from '../data/tabooPresets.json'
import { DEFAULT_TARGET, DEFAULT_TABOO } from '../constants/landing'
import ActionOptionButton from '../components/ActionOptionButton'
import JoinRoomSection from '../components/JoinRoomSection'
import CreateRoomSection from '../components/CreateRoomSection'
import LastResultPanel from '../components/LastResultPanel'
import ErrorAlert from '../components/ErrorAlert'

type TabooPreset = { target: string; taboo: string[] }
const presets = tabooPresets as TabooPreset[]

export type HomeSelectedAction = 'create' | 'join'

export default function Home() {
  const navigate = useNavigate()
  const [targetWord, setTargetWord] = useState(DEFAULT_TARGET)
  const [tabooWords, setTabooWords] = useState<string[]>(DEFAULT_TABOO)
  const [creatorName, setCreatorName] = useState('Game Master')
  const [selectedAction, setSelectedAction] = useState<HomeSelectedAction>('create')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ message: string; transcript?: string } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRandomize = () => {
    const preset = presets[Math.floor(Math.random() * presets.length)]
    setTargetWord(preset.target)
    setTabooWords(preset.taboo)
  }

  const handleJoinCodeChange = (raw: string) => {
    setJoinRoomCode(raw.toUpperCase().slice(0, 5))
    if (joinError) setJoinError(null)
  }

  const handleJoinRoom = () => {
    const code = joinRoomCode.trim().toUpperCase()
    if (code.length !== 5) {
      setJoinError('Room code must be 5 characters.')
      return
    }
    setJoinError(null)
    navigate(`/room/${code}`)
  }

  const handleCreateRoom = async () => {
    setError(null)
    setJoinError(null)
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
      const data: { room_id: string; invite_url: string; token: string } = await response.json()
      localStorage.setItem(`taboo_room_${data.room_id}_token`, data.token)
      localStorage.setItem(`taboo_room_${data.room_id}_role`, 'gm')
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
          Choose an option below to start a game: create a new room or join an existing one with a 5-character code.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionOptionButton
            isActive={selectedAction === 'create'}
            badgeLabel="Option 1"
            title="Create new room"
            subtitle="Set the secret word and taboo words, then share the room code."
            onClick={() => setSelectedAction('create')}
          />
          <ActionOptionButton
            isActive={selectedAction === 'join'}
            badgeLabel="Option 2"
            title="Join existing room"
            subtitle="Enter the 5-character code shown on the Game Master's screen."
            onClick={() => setSelectedAction('join')}
          />
        </div>

        {selectedAction === 'join' && (
          <JoinRoomSection
            joinRoomCode={joinRoomCode}
            joinError={joinError}
            onCodeChange={handleJoinCodeChange}
            onJoin={handleJoinRoom}
          />
        )}

        {selectedAction === 'create' && (
          <CreateRoomSection
            targetWord={targetWord}
            tabooWords={tabooWords}
            creatorName={creatorName}
            onTargetChange={(value) => setTargetWord(value.trim() || DEFAULT_TARGET)}
            onTabooChange={(value) =>
              setTabooWords(
                value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            onCreatorChange={(value) => setCreatorName(value)}
            onRandomize={handleRandomize}
          />
        )}

        {lastResult && (
          <LastResultPanel message={lastResult.message} transcript={lastResult.transcript} />
        )}

        {error && <ErrorAlert message={error} />}

        {selectedAction === 'create' && (
          <>
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="mt-8 w-full rounded-xl bg-indigo-600 px-6 py-4 font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {isCreating ? 'Creating room…' : 'Create Room'}
            </button>

            <p className="mt-4 text-xs text-slate-500">
              After creating a room, you&apos;ll get an invite URL and 5-character code you can share with your
              friends.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
