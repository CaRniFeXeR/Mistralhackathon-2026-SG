import type { GameOverData } from './types'

export const MODE_PROMPT =
  'You are playing Taboo. The player is describing a secret word without saying it or the taboo words. Guess the word based only on their description. Answer with ONLY the single word, nothing else.'

export const ASCII_PANEL_CLASS = 'ascii-border border-double'

export function parseGameOverPayload(data: Record<string, unknown>): GameOverData {
  const winnerType = data.winnerType as string | undefined
  const tabooViolation = Boolean(data.tabooViolation)
  const winnerDisplayName = (data.winnerDisplayName as string | undefined) ?? ''
  const winningGuess = (data.winningGuess as string | undefined) ?? ''
  const targetWord = (data.targetWord as string | undefined) ?? ''

  if (winnerType === 'gm_lost' || tabooViolation) {
    return { isWin: false, targetWord, reasonTitle: 'FATAL ERROR', reasonMessage: 'TABOO WORD DETECTED', outcome: 'gm_lost' }
  }
  if (winnerType === 'time_up') {
    return { isWin: false, targetWord, reasonTitle: 'TIME LIMIT REACHED', reasonMessage: "TIME'S UP", outcome: 'time_up' }
  }
  if (winnerType && winningGuess) {
    const by = winnerType === 'AI' ? 'AI' : winnerDisplayName || 'PLAYER'
    const reasonTitle = 'WINNING GUESS'
    const reasonMessage = `"${winningGuess}" BY ${by}`
    if (winnerType === 'AI') {
      return { isWin: false, targetWord, reasonTitle, reasonMessage, outcome: 'ai_won' }
    }
    return { isWin: true, targetWord, reasonTitle, reasonMessage, outcome: 'other_human_won' }
  }
  return { isWin: false, targetWord, reasonTitle: 'OUTCOME', reasonMessage: 'GAME OVER' }
}

export async function copyRoomLinkWithFallback(
  roomLink: string
): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Taboo Game Room', text: 'Join this Taboo game room', url: roomLink })
      return { ok: true }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return { ok: true }
    }
  }
  try {
    await navigator.clipboard.writeText(roomLink)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not share or copy link.' }
  }
}
