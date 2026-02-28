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
import GameLogo from '../components/GameLogo'

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
    <>
      <div className="scanlines"></div>
      <main className="max-w-2xl w-full p-4 md:p-8" data-purpose="terminal-container">
        <header className="mb-8 text-center" data-purpose="header-section">
          <GameLogo className="mb-4" />
          <h1 className="sr-only">TABOO GAME - AI HEARD THAT</h1>
          <p className="mt-6 text-sm tracking-tight border-y border-dashed border-gray-800 py-2 text-white">
            CREATE A ROOM, INVITE FRIENDS, THEN DESCRIBE THE SECRET WORD WITHOUT SAYING IT OR THE TABOO WORDS.
          </p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionOptionButton
            isActive={selectedAction === 'create'}
            badgeLabel="Option 1"
            title="CREATE"
            subtitle="Set the secret word and taboo words, then share the room code."
            onClick={() => setSelectedAction('create')}
          />
          <ActionOptionButton
            isActive={selectedAction === 'join'}
            badgeLabel="Option 2"
            title="JOIN"
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
          <div className="pt-4">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="ascii-btn w-full disabled:opacity-50"
            >
              {isCreating ? 'PROCESSING...' : '< CREATE_ROOM />'}
            </button>

            <footer className="mt-8 text-center text-xs text-gray-500" data-purpose="system-status">
              <div className="mb-2">------------------------------------------</div>
              <div>SYSTEM STATUS: <span className="text-blue-500">READY</span></div>
              <div>CONNECTION: SECURE_SOCKET_LAYER</div>
              <div className="mt-4">INVITE URL GENERATION ENABLED POST-CREATION.</div>
            </footer>
          </div>
        )}
      </main>
    </>
  )
}
