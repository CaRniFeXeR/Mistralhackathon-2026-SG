import React from 'react'
import type { GameOverOutcome } from './types/game'

export interface GameOverScreenProps {
    isVictory: boolean
    /** When set, shows: you_won → HUMANS WIN (you!), other_human_won → HUMANS WIN (but not you), ai_won → AI WINS, defeat → DEFEAT */
    outcome?: GameOverOutcome
    targetWord?: string
    reasonTitle?: string
    reasonMessage?: string
    children?: React.ReactNode
}

function getVictoryTitle(outcome: GameOverOutcome | undefined, isVictory: boolean): string {
    if (outcome === 'you_won') return 'HUMANS WIN (you! 🎉)'
    if (outcome === 'other_human_won') return 'HUMANS WIN (but not you 😢)'
    if (outcome === 'ai_won') return 'AI WINS 😢'
    if (outcome === 'defeat') return 'DEFEAT'
    return isVictory ? 'VICTORY' : 'DEFEAT'
}

export default function GameOverScreen({
    isVictory,
    outcome,
    targetWord,
    reasonTitle,
    reasonMessage,
    children,
}: GameOverScreenProps) {
    const isAiWins = outcome === 'ai_won'
    const isHumansWin = outcome === 'you_won' || outcome === 'other_human_won' || (isVictory && !outcome)

    if (isHumansWin) {
        return (
            <div className="w-full min-w-0 flex flex-col items-center justify-center py-12 relative overflow-x-hidden overflow-y-auto">
                {/* Abstract Background Elements */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/40 rounded-full blur-[100px]"></div>
                </div>

                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-30"></div>

                <div className="text-center mb-12 relative z-10 w-full max-w-4xl min-w-0 px-2">
                    <h1 className="text-indigo-400 text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter mb-4 font-mono glitch-effect text-shadow-glow break-words">
                        {getVictoryTitle(outcome, true)}
                    </h1>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-px bg-indigo-500/50 flex-1 max-w-[100px]"></div>
                        <p className="text-indigo-300 text-xl tracking-widest font-mono uppercase bg-black/80 px-4 py-2 border border-indigo-500/30">
                            Target Acquired
                        </p>
                        <div className="h-px bg-indigo-500/50 flex-1 max-w-[100px]"></div>
                    </div>
                </div>

                {/* ASCII Art Container */}
                <div className="mb-12 border border-indigo-500/20 bg-black/40 p-4 md:p-8 rounded-sm relative group overflow-hidden w-full max-w-4xl min-w-0 mx-auto shadow-[0_0_30px_rgba(79,70,229,0.1)]">
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(79,70,229,0.05)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                    <pre className="font-mono text-indigo-400 text-[10px] sm:text-xs md:text-sm lg:text-base leading-tight whitespace-pre overflow-x-hidden overflow-y-hidden text-center text-shadow-glow max-w-full">
                        {`     _    __   _         __                               
    | |  / /  (_)  _____/ /_  ____    _____  __  __       
    | | / /  / /  / ___/ __/ / __ \  / ___/ / / / /       
    | |/ /  / /  / /__/ /_  / /_/ / / /    / /_/ /        
    |___/  /_/   \___/\__/  \____/ /_/     \__, /         
                                          /____/          `}
                    </pre>

                    {/* Corner decorations */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-500"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-500"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-500"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-500"></div>
                </div>

                {/* Stats / Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-2xl min-w-0 mb-12 font-mono text-sm relative z-10 px-4 md:px-0 mx-auto">
                    <div className="bg-black/60 border border-indigo-500/30 p-4 relative group hover:border-indigo-400 transition-colors min-w-0 overflow-hidden">
                        <div className="text-indigo-500/50 mb-1">TARGET</div>
                        <div className="text-indigo-400 text-lg uppercase break-words">{targetWord || 'UNKNOWN'}</div>
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-indigo-500"></div>
                    </div>
                    <div className="bg-black/60 border border-indigo-500/30 p-4 relative group hover:border-indigo-400 transition-colors min-w-0 overflow-hidden">
                        <div className="text-indigo-500/50 mb-1">{reasonTitle || 'OUTCOME'}</div>
                        <div className="text-indigo-400 text-lg uppercase break-words">{reasonMessage || 'SUCCESS'}</div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-indigo-500"></div>
                    </div>
                </div>

                {/* Add children (like restart sequence form) */}
                {children && <div className="relative z-10 w-full flex justify-center">{children}</div>}
            </div>
        )
    }

    // AI WINS or DEFEAT View
    const defeatTitle = getVictoryTitle(outcome, false)
    return (
        <div className="w-full min-w-0 flex flex-col items-center justify-center py-12 relative overflow-x-hidden overflow-y-auto">
            {/* Background Abstract Glow */}
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none">
                <div className="w-[600px] h-[600px] bg-amber-900 rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
                <div className="absolute w-[400px] h-[400px] bg-amber-600 rounded-full blur-[90px] mix-blend-screen opacity-30"></div>
            </div>

            <div className="text-center mb-8 relative z-10 w-full min-w-0 px-2">
                <h1 className="text-amber-500 text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter mb-4 font-mono glitch-effect text-shadow-glow break-words">
                    {defeatTitle}
                </h1>
                <p className="text-amber-400 text-lg sm:text-xl tracking-widest font-mono uppercase bg-[#1A0B1C]/80 inline-block px-4 py-2 border border-amber-500/30 break-words">
                    {isAiWins ? 'Target Acquired by AI' : 'Connection Terminated'}
                </p>
            </div>

            {/* ASCII Art Container */}
            <div className="mb-8 border border-amber-500/20 bg-[#1A0B1C]/80 p-4 md:p-8 rounded-sm relative group overflow-hidden w-full max-w-4xl min-w-0 mx-auto shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                <pre className="ascii-art text-amber-500 font-mono text-[10px] sm:text-xs md:text-sm lg:text-base leading-tight whitespace-pre overflow-x-hidden overflow-y-hidden text-center text-shadow-glow max-w-full">
                    {`      :::    :::   :::::::   :::::::::  :::::::::: :::::::: 
     :+:   :+:   :+:   :+:  :+:    :+: :+:       :+:    :+: 
    +:+  +:+    +:+   +:+  +:+    +:+ +:+       +:+         
   +#++:++     +#+   +:+  +#++:++#+  +#++:++#  +#++:++#++   
  +#+  +#+    +#+   +#+  +#+        +#+              +#+    
 #+#   #+#   #+#   #+#  #+#        #+#       #+#    #+#     
###    ###   #######   ###        ########## ########       `}
                </pre>
            </div>

            {/* Stats / Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full min-w-0 mb-12 font-mono text-sm relative z-10 mx-auto px-4 md:px-0">
                <div className="bg-[#1A0B1C] border border-amber-500/30 p-4 relative group hover:border-amber-400 transition-colors min-w-0 overflow-hidden">
                    <div className="text-amber-500/50 mb-1">TARGET</div>
                    <div className="text-amber-400 text-xl uppercase break-words">{targetWord || 'UNKNOWN'}</div>
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500"></div>
                </div>
                <div className="bg-[#1A0B1C] border border-amber-500/30 p-4 relative group hover:border-amber-400 transition-colors min-w-0 overflow-hidden">
                    <div className="text-amber-500/50 mb-1">{reasonTitle || 'FATAL ERROR'}</div>
                    <div className="text-amber-400 text-xl uppercase break-words">{reasonMessage || 'TABOO WORD DETECTED'}</div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500"></div>
                </div>
            </div>

            {children && <div className="relative z-10 w-full flex justify-center">{children}</div>}
        </div>
    )
}
