export interface JoinRoomSectionProps {
  joinRoomCode: string
  joinError: string | null
  onCodeChange: (value: string) => void
  onJoin: () => void
}

export default function JoinRoomSection({
  joinRoomCode,
  joinError,
  onCodeChange,
  onJoin,
}: JoinRoomSectionProps) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
      <h2 className="text-lg font-semibold text-white">Join a room</h2>
      <p className="mt-1 text-sm text-slate-400">
        Type the 5-character room code (letters/numbers) you received and jump straight into the game.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-400">Room code</label>
          <input
            type="text"
            value={joinRoomCode}
            onChange={(e) => onCodeChange(e.target.value)}
            maxLength={5}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-center text-xl font-mono tracking-[0.3em] text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="ABCDE"
          />
        </div>
        <button
          type="button"
          onClick={onJoin}
          className="w-full shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto"
        >
          Join room
        </button>
      </div>
      {joinError && <p className="mt-2 text-sm text-red-300">{joinError}</p>}
    </div>
  )
}
