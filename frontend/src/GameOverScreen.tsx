import React from 'react'

export interface GameOverScreenProps {
    isVictory: boolean
    targetWord?: string
    reasonTitle?: string
    reasonMessage?: string
    children?: React.ReactNode
}

export default function GameOverScreen({
    isVictory,
    targetWord,
    reasonTitle,
    reasonMessage,
    children,
}: GameOverScreenProps) {
    if (isVictory) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-12 relative overflow-hidden">
                {/* Abstract Background Elements */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-900/40 rounded-full blur-[100px]"></div>
                </div>

                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-30"></div>

                <div className="text-center mb-12 relative z-10 w-full max-w-4xl">
                    <h1 className="text-emerald-400 text-6xl md:text-8xl font-black tracking-tighter mb-4 font-mono glitch-effect text-shadow-glow">
                        VICTORY
                    </h1>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-px bg-emerald-500/50 flex-1 max-w-[100px]"></div>
                        <p className="text-emerald-300 text-xl tracking-widest font-mono uppercase bg-black/80 px-4 py-2 border border-emerald-500/30">
                            Target Acquired
                        </p>
                        <div className="h-px bg-emerald-500/50 flex-1 max-w-[100px]"></div>
                    </div>
                </div>

                {/* ASCII Art Container */}
                <div className="mb-12 border border-emerald-500/20 bg-black/40 p-6 md:p-8 rounded-sm relative group overflow-hidden w-full max-w-4xl mx-auto shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(16,185,129,0.05)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                    <pre className="font-mono text-emerald-400 text-xs md:text-sm lg:text-base leading-tight whitespace-pre overflow-x-auto overflow-y-hidden text-center text-shadow-glow max-w-full">
                        {`     _    __   _         __                               
    | |  / /  (_)  _____/ /_  ____    _____  __  __       
    | | / /  / /  / ___/ __/ / __ \  / ___/ / / / /       
    | |/ /  / /  / /__/ /_  / /_/ / / /    / /_/ /        
    |___/  /_/   \___/\__/  \____/ /_/     \__, /         
                                          /____/          `}
                    </pre>

                    {/* Corner decorations */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-500"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-500"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-500"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-500"></div>
                </div>

                {/* Stats / Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-2xl mb-12 font-mono text-sm relative z-10 px-4 md:px-0 mx-auto">
                    <div className="bg-black/60 border border-emerald-500/30 p-4 relative group hover:border-emerald-400 transition-colors">
                        <div className="text-emerald-500/50 mb-1">TARGET</div>
                        <div className="text-emerald-400 text-lg uppercase">{targetWord || 'UNKNOWN'}</div>
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500"></div>
                    </div>
                    <div className="bg-black/60 border border-emerald-500/30 p-4 relative group hover:border-emerald-400 transition-colors">
                        <div className="text-emerald-500/50 mb-1">{reasonTitle || 'OUTCOME'}</div>
                        <div className="text-emerald-400 text-lg uppercase">{reasonMessage || 'SUCCESS'}</div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-500"></div>
                    </div>
                </div>

                {/* Add children (like restart sequence form) */}
                {children && <div className="relative z-10 w-full flex justify-center">{children}</div>}
            </div>
        )
    }

    // Defeat View
    return (
        <div className="w-full flex flex-col items-center justify-center py-12 relative overflow-hidden">
            {/* Background Abstract Glow */}
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none">
                <div className="w-[600px] h-[600px] bg-[#FF3366] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
                <div className="absolute w-[400px] h-[400px] bg-[#FF0033] rounded-full blur-[90px] mix-blend-screen opacity-30"></div>
            </div>

            <div className="text-center mb-8 relative z-10">
                <h1 className="text-[#FF3366] text-6xl md:text-8xl font-black tracking-tighter mb-4 font-mono glitch-effect text-shadow-glow">
                    DEFEAT
                </h1>
                <p className="text-[#FF3366] text-xl tracking-widest font-mono uppercase bg-[#1A0B1C]/80 inline-block px-4 py-2 border border-[#FF3366]/30">
                    Connection Terminated
                </p>
            </div>

            {/* ASCII Art Container */}
            <div className="mb-8 border border-[#FF3366]/20 bg-[#1A0B1C]/80 p-6 md:p-8 rounded-sm relative group overflow-hidden w-full max-w-4xl mx-auto shadow-[0_0_30px_rgba(255,51,102,0.1)]">
                <pre className="ascii-art text-[#FF3366] font-mono text-xs md:text-sm lg:text-base leading-tight whitespace-pre overflow-x-auto overflow-y-hidden text-center text-shadow-glow max-w-full">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full mb-12 font-mono text-sm relative z-10 mx-auto px-4 md:px-0">
                <div className="bg-[#1A0B1C] border border-[#FF3366]/30 p-4 relative group hover:border-[#FF3366] transition-colors">
                    <div className="text-[#FF3366]/50 mb-1">TARGET</div>
                    <div className="text-[#FF3366] text-xl uppercase">{targetWord || 'UNKNOWN'}</div>
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#FF3366]"></div>
                </div>
                <div className="bg-[#1A0B1C] border border-[#FF3366]/30 p-4 relative group hover:border-[#FF3366] transition-colors">
                    <div className="text-[#FF3366]/50 mb-1">{reasonTitle || 'FATAL ERROR'}</div>
                    <div className="text-[#FF3366] text-xl uppercase">{reasonMessage || 'TABOO WORD DETECTED'}</div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#FF3366]"></div>
                </div>
            </div>

            {children && <div className="relative z-10 w-full flex justify-center">{children}</div>}
        </div>
    )
}
