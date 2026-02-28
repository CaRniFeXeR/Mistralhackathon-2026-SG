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
    <section className="ascii-border border-double w-full px-2 mt-8" data-purpose="join-room-section">
      <div className="mb-4">
        <h2 className="text-xl text-blue-500 font-bold mb-2">++ JOIN_EXISTING_ROOM</h2>
        <p className="text-sm text-gray-300">
          TYPE THE 5-CHARACTER ROOM CODE YOU RECEIVED AND JUMP STRAIGHT INTO THE GAME.
        </p>
      </div>

      <div className="space-y-4">
        <div className="input-group">
          <label className="block mb-1 text-lg text-white" htmlFor="room-code">[ SESSION_ID ]</label>
          <div className="flex gap-2">
            <input
              type="text"
              id="room-code"
              value={joinRoomCode}
              onChange={(e) => onCodeChange(e.target.value)}
              maxLength={5}
              className="terminal-input font-bold tracking-[0.3em] flex-grow text-center"
              placeholder="ABCDE"
            />
          </div>
        </div>

        {joinError && <p className="text-red-500 text-sm">{joinError}</p>}

        <div className="pt-2">
          <button
            type="button"
            onClick={onJoin}
            className="ascii-btn w-full"
          >
            &lt; INITIATE_JOIN_PROTOCOL /&gt;
          </button>
        </div>
      </div>
    </section>
  )
}
