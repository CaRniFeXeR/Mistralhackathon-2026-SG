import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JoinRoomSection from '../components/JoinRoomSection'
import GameLogo from '../components/GameLogo'

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
    <div className="bg-[#000000] font-display text-white h-screen flex flex-col items-center justify-center">
      <div className="scanlines" />
      <main className="max-w-md w-full p-6 z-10 flex flex-col items-center gap-8">
        <h1 className="sr-only">AI HEARD THAT — Join</h1>

        <GameLogo />

        <JoinRoomSection
          joinRoomCode={joinRoomCode}
          joinError={joinError}
          onCodeChange={handleJoinCodeChange}
          onJoin={handleJoinRoom}
        />
      </main>
    </div>
  )
}
