import React from 'react';
import { useNavigate } from 'react-router-dom';
import GameLogo from '../components/GameLogo';

const RoleSelection: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="bg-[#000000] font-display text-white overflow-hidden h-screen dark">
            <div className="relative flex h-full w-full flex-col bg-[#000000] p-6 justify-between items-center overflow-hidden">
                <div className="absolute inset-0 scanlines opacity-30 pointer-events-none"></div>

                <div className="flex flex-col items-center w-full z-10 mt-8">
                    <div className="flex justify-center [&_pre]:shadow-[0_0_20px_rgba(239,65,53,0.3)]">
                        <GameLogo size="lg" />
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


            </div>
        </div>
    );
};

export default RoleSelection;
