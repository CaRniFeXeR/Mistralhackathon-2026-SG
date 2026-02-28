import React from 'react';
import { useNavigate } from 'react-router-dom';

const RoleSelection: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="bg-[#000000] font-display text-white overflow-hidden h-screen dark">
            <div className="relative flex h-full w-full flex-col bg-[#000000] p-6 justify-between items-center overflow-hidden">
                <div className="absolute inset-0 scanlines opacity-30 pointer-events-none"></div>
                
                <div className="flex flex-col items-center w-full z-10 mt-8">
                    <div className="text-5xl font-black leading-none tracking-tighter text-center uppercase">
                        <img alt="AI HEARD THAT" className="h-48 w-auto object-contain mb-2 shadow-[0_0_20px_rgba(239,65,53,0.3)]" src="{ai_logo_src}" />
                    </div>
                    <div className="h-1.5 w-32 bg-accent-blue my-6"></div>
                    <h3 className="text-white tracking-[0.2em] text-lg font-bold leading-tight px-4 text-center uppercase">
                        &lt; CHOOSE YOUR ROLE &gt;
                    </h3>
                </div>

                <div className="flex flex-col gap-8 w-full max-w-xs z-10">
                    <button 
                        onClick={() => navigate('/gm')}
                        className="ascii-border-blue group flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden bg-accent-blue text-white text-xl font-black leading-normal tracking-[0.1em] w-full py-6 transition-transform active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-blue-800"
                    >
                        <span className="truncate">[ GAME MASTER ]</span>
                    </button>
                    <button 
                        onClick={() => navigate('/join')}
                        className="ascii-border-red group flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden bg-primary text-white text-xl font-black leading-normal tracking-[0.1em] w-full py-6 transition-transform active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-red-700"
                    >
                        <span className="truncate">[ PLAYER ]</span>
                    </button>
                </div>

                <div className="flex flex-col items-center w-full mb-8 gap-4 z-10">
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-accent-blue">terminal</span>
                            <p className="text-white text-xs font-bold leading-normal tracking-widest uppercase">
                                SYSTEM STATUS: READY
                            </p>
                        </div>
                        <p className="text-[10px] font-mono text-white/40">V.2.0.4-STABLE</p>
                    </div>
                    <div className="flex justify-center w-full mt-2">
                        <img alt="Pixel Cat Logo" className="w-20 h-auto object-contain opacity-80" src="{cat_logo_src}" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelection;
