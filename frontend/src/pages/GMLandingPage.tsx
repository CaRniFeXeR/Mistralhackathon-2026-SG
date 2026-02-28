import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiBaseUrl } from '../api'
import tabooPresets from '../data/tabooPresets.json'
import { DEFAULT_TARGET, DEFAULT_TABOO } from '../constants/landing'
import CreateRoomSection from '../components/CreateRoomSection'
import ErrorAlert from '../components/ErrorAlert'

type TabooPreset = { target: string; taboo: string[] }
const presets = tabooPresets as TabooPreset[]

export default function GMLandingPage() {
  const navigate = useNavigate()
  const [targetWord, setTargetWord] = useState(DEFAULT_TARGET)
  const [tabooWords, setTabooWords] = useState<string[]>(DEFAULT_TABOO)
  const [creatorName, setCreatorName] = useState('GAME MASTER')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRandomize = () => {
    const preset = presets[Math.floor(Math.random() * presets.length)]
    setTargetWord(preset.target)
    setTabooWords(preset.taboo)
  }

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
      const data: { room_id: string; invite_url: string; token: string } = await response.json()
      localStorage.setItem(`taboo_room_${data.room_id}_token`, data.token)
      localStorage.setItem(`taboo_room_${data.room_id}_role`, 'gm')
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
      <div className="bg-[#000000] font-display text-white overflow-hidden h-screen dark flex flex-col items-center justify-start overflow-y-auto">
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 z-10 flex flex-col" data-purpose="terminal-container">
          <header className="mb-8 text-center" data-purpose="header-section">
            <div className="flex flex-col items-center justify-center mb-4 space-y-0">
              <pre className="whitespace-pre text-[10px] sm:text-[12px] leading-none text-red-500 font-bold mb-2">
                {`  █████  ██ 
  ██  ██ ██ 
  ██████ ██ 
  ██  ██ ██ 
  ██  ██ ██ 
  `}
              </pre>
              <pre className="whitespace-pre text-[8px] sm:text-[10px] leading-none text-blue-500 font-bold mb-2">
                {`  ██   ██ ███████  █████  ██████  ██████  
  ██   ██ ██      ██   ██ ██   ██ ██   ██ 
  ███████ █████   ███████ ██████  ██   ██ 
  ██   ██ ██      ██   ██ ██   ██ ██   ██ 
  ██   ██ ███████ ██   ██ ██   ██ ██████  
  `}
              </pre>
              <pre className="whitespace-pre text-[8px] sm:text-[10px] leading-none text-white font-bold">
                {`  ████████ ██   ██  █████  ████████ 
     ██    ██   ██ ██   ██    ██    
     ██    ███████ ███████    ██    
     ██    ██   ██ ██   ██    ██    
     ██    ██   ██ ██   ██    ██    
  `}
              </pre>
            </div>
            <h1 className="sr-only">TABOO GAME - AI HEARD THAT</h1>
            <p className="mt-6 text-sm tracking-tight border-y border-dashed border-gray-800 py-2 text-white">
              CREATE A ROOM, INVITE FRIENDS, THEN DESCRIBE THE SECRET WORD WITHOUT SAYING IT OR THE TABOO WORDS.
            </p>
          </header>

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

          {error && <ErrorAlert message={error} />}

          <div className="pt-4">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="ascii-btn w-full disabled:opacity-50"
            >
              {isCreating ? 'PROCESSING...' : '< CREATE_ROOM_001 />'}
            </button>

            <footer className="mt-8 text-center text-xs text-gray-500" data-purpose="system-status">
              <div className="mb-2">------------------------------------------</div>
              <div>SYSTEM STATUS: <span className="text-blue-500">READY</span></div>
              <div>CONNECTION: SECURE_SOCKET_LAYER</div>
              <div className="mt-4">INVITE URL GENERATION ENABLED POST-CREATION.</div>
            </footer>
          </div>

          <div className="flex justify-center mt-6 pb-8">
            <img alt="Game Logo" className="max-w-[150px] sm:max-w-[180px] h-auto object-contain opacity-80" src="{cat_logo_src}" />
          </div>
        </main>
      </div>
    </>
  )
}
