import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JoinRoomSection from '../components/JoinRoomSection'

export default function PlayerJoinPage() {
  const navigate = useNavigate()
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

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

  return (
    <>
      <div className="bg-[#000000] font-display text-white overflow-hidden h-screen dark flex flex-col items-center justify-start overflow-y-auto">
        <div className="scanlines"></div>
        <main className="max-w-2xl w-full p-4 md:p-8 z-10 flex flex-col items-center" data-purpose="terminal-container">
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

          <JoinRoomSection
            joinRoomCode={joinRoomCode}
            joinError={joinError}
            onCodeChange={handleJoinCodeChange}
            onJoin={handleJoinRoom}
          />

          <div className="flex justify-center mt-12 w-full pb-8">
            <img alt="Game Logo" className="max-w-[150px] sm:max-w-[180px] h-auto object-contain opacity-80" src="{cat_logo_src}" />
          </div>
        </main>
      </div>
    </>
  )
}
