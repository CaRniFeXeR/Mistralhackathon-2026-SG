import { useState } from 'react'
import GameRoom from './GameRoom'

const DEFAULT_TARGET = 'elephant'
const DEFAULT_TABOO = ['animal', 'trunk', 'ivory', 'Africa', 'big']
const MODE_PROMPT =
  'You are playing Taboo. The player is describing a secret word without saying it or the taboo words. Guess the word based only on their description. Answer with ONLY the single word, nothing else.'

type Screen = 'lobby' | 'game'

function App() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [targetWord, setTargetWord] = useState(DEFAULT_TARGET)
  const [tabooWords, setTabooWords] = useState<string[]>(DEFAULT_TABOO)
  const [lastResult, setLastResult] = useState<{ message: string; transcript?: string } | null>(null)

  const startGame = () => {
    setLastResult(null)
    setScreen('game')
  }

  const handleWin = (timeLeft: number, transcript: string, winningGuess: string) => {
    setLastResult({
      message: `AI guessed "${winningGuess}" with ${timeLeft}s left!`,
      transcript,
    })
    setScreen('lobby')
  }

  const handleEnd = (message: string, transcript: string) => {
    setLastResult({ message, transcript })
    setScreen('lobby')
  }

  if (screen === 'game') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center px-6 py-12">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-white">Taboo Game</h1>
        <GameRoom
          targetWord={targetWord}
          tabooWords={tabooWords}
          modePrompt={MODE_PROMPT}
          onWin={handleWin}
          onEnd={handleEnd}
        />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
        <h1 className="text-4xl font-bold tracking-tight text-white">Taboo Game</h1>
        <p className="mt-3 text-lg text-slate-300">
          Describe the secret word without saying it or the taboo words. The AI will try to guess.
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
                    .filter(Boolean)
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="animal, trunk, ivory"
            />
          </div>
        </div>

        {lastResult && (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-slate-300">
            <p className="font-medium">{lastResult.message}</p>
            {lastResult.transcript && (
              <p className="mt-2 text-sm text-slate-500">Transcript: {lastResult.transcript.slice(0, 200)}
                {lastResult.transcript.length > 200 ? '…' : ''}</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={startGame}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-6 py-4 font-bold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Start Challenge
        </button>
      </div>
    </main>
  )
}

export default App
