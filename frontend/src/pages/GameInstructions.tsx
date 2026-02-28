import React from 'react';
import { useNavigate } from 'react-router-dom';

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
                    {/* "AI" Title in Red */}
                    <div className="text-6xl font-black text-red-600 tracking-tighter leading-none mb-1" style={{ textShadow: "2px 2px #000" }}>
                        AI
                    </div>
                    {/* "HEARD" Title in Blue */}
                    <div className="text-4xl font-black text-blue-600 tracking-widest leading-none mb-1">
                        HEARD
                    </div>
                    {/* "THAT" Title in White */}
                    <div className="text-5xl font-black text-white tracking-widest leading-none">
                        THAT
                    </div>
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
                {/* Pixel Cat Logo Placeholder */}
                <div className="mb-4 p-1 bg-gray-800 rounded">
                    <img alt="Pixel Cat Logo" className="h-12 w-auto object-contain" src="data:image/png;base64,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" />
                </div>
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
            </footer>
        </div>
    );
};

export default GameInstructions;
