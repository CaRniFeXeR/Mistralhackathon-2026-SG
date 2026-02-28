import React from 'react';
import { useNavigate } from 'react-router-dom';
import GameLogo from '../components/GameLogo';

const GameInstructions: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div
            className="bg-black text-white h-screen flex flex-col justify-between p-6 relative"
            style={{ fontFamily: "'Courier New', Courier, monospace", overflow: "hidden" }}
        >
            {/* Decorative Corners */}
            <div className="absolute w-[20px] h-[20px] top-[10px] left-[10px] border-t-[3px] border-l-[3px] border-red-500"></div>
            <div className="absolute w-[20px] h-[20px] top-[10px] right-[10px] border-t-[3px] border-r-[3px] border-blue-500"></div>
            <div className="absolute w-[20px] h-[20px] bottom-[10px] left-[10px] border-b-[3px] border-l-[3px] border-blue-500"></div>
            <div className="absolute w-[20px] h-[20px] bottom-[10px] right-[10px] border-b-[3px] border-r-[3px] border-red-500"></div>



            {/* Header Section */}
            <header className="text-center mb-4">
                <div className="flex flex-col items-center">
                    <GameLogo />
                </div>
                {/* Decorative horizontal line */}
                <div className="w-24 h-1 bg-blue-600 mx-auto mt-4"></div>
            </header>

            {/* Instructions List */}
            <main className="flex-grow flex flex-col justify-center space-y-4 px-2">
                {/* Step 1 */}
                <div className="flex items-start" style={{ lineHeight: 1.25 }}>
                    <span className="text-blue-500 font-bold mr-3">[1]</span>
                    <p className="text-sm">
                        <span className="text-blue-400 font-bold uppercase">Role Selection:</span>{' '}
                        Choose to be the Game Master or a Player.
                    </p>
                </div>
                {/* Step 2 */}
                <div className="flex items-start" style={{ lineHeight: 1.25 }}>
                    <span className="text-red-500 font-bold mr-3">[2]</span>
                    <p className="text-sm">
                        <span className="text-red-400 font-bold uppercase">Game Master:</span>{' '}
                        Describe the secret word to the AI without using taboo words.
                    </p>
                </div>
                {/* Step 3 */}
                <div className="flex items-start" style={{ lineHeight: 1.25 }}>
                    <span className="text-white font-bold mr-3">[3]</span>
                    <p className="text-sm">
                        <span className="font-bold uppercase">Players:</span>{' '}
                        Listen to the AI transcript and guess before time runs out.
                    </p>
                </div>
                {/* Step 4 */}
                <div className="flex items-start" style={{ lineHeight: 1.25 }}>
                    <span className="text-orange-500 font-bold mr-3">[4]</span>
                    <p className="text-sm">
                        <span className="text-orange-400 font-bold uppercase">Win:</span>{' '}
                        Correctly guess the word to earn points!
                    </p>
                </div>
            </main>

            {/* Footer with Primary CTA */}
            <footer className="text-center mt-4 flex flex-col items-center pb-4">
                <button
                    id="next-btn"
                    onClick={() => navigate('/role-selection')}
                    className="flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black uppercase tracking-widest px-10 py-4 text-xl rounded-none border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all duration-150"
                    style={{ minWidth: '200px', letterSpacing: '0.15em' }}
                >
                    NEXT
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                    </svg>
                </button>
                {/* Pixel Cat Logo Placeholder */}
                <div className="mb-4 p-1 bg-gray-800 rounded">
                    <img alt="Pixel Cat Logo" className="h-12 w-auto object-contain" src="/pixel-cat-logo.png" />
                </div>

            </footer>
        </div>
    );
};

export default GameInstructions;
