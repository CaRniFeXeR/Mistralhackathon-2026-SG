import React from 'react';
import { useNavigate } from 'react-router-dom';
import GameLogo from '../components/GameLogo';

const GameInstructions: React.FC = () => {
    const navigate = useNavigate();

    const instructions = [
        {
            num: "[1]",
            title: "Role Selection",
            desc: "Choose to be the Game Master or a Player.",
            color: "text-blue-500",
            titleColor: "text-blue-400"
        },
        {
            num: "[2]",
            title: "Game Master",
            desc: "Describe the secret word to the AI without using taboo words.",
            color: "text-red-500",
            titleColor: "text-red-400"
        },
        {
            num: "[3]",
            title: "Players",
            desc: "Listen to the AI transcript and guess before time runs out.",
            color: "text-white",
            titleColor: "text-gray-300"
        },
        {
            num: "[4]",
            title: "Win",
            desc: "Correctly guess the word to earn points!",
            color: "text-orange-500",
            titleColor: "text-orange-400"
        }
    ];

    return (
        <div
            className="bg-black text-white h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden"
            style={{ fontFamily: "'VT323', monospace" }}
        >
            {/* Scanlines Effect Overlay */}
            <div className="scanlines"></div>

            {/* Decorative Corners */}
            <div className="absolute w-[30px] h-[30px] top-[15px] left-[15px] border-t-[4px] border-l-[4px] border-red-500 opacity-80"></div>
            <div className="absolute w-[30px] h-[30px] top-[15px] right-[15px] border-t-[4px] border-r-[4px] border-blue-500 opacity-80"></div>
            <div className="absolute w-[30px] h-[30px] bottom-[15px] left-[15px] border-b-[4px] border-l-[4px] border-blue-500 opacity-80"></div>
            <div className="absolute w-[30px] h-[30px] bottom-[15px] right-[15px] border-b-[4px] border-r-[4px] border-red-500 opacity-80"></div>

            {/* Header Section - Moved to top but not absolute to allow flex flow if needed, 
                however absolute is better for strict vertical centering of the main content */}
            <header className="absolute top-6 md:top-10 flex flex-col items-center z-10">
                <div className="transform scale-75 md:scale-100">
                    <GameLogo />
                </div>
                <div className="w-32 h-1 bg-gradient-to-r from-blue-600 via-white to-red-600 mt-2 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </header>

            {/* Instructions List - Perfectly centered vertically using flex-grow on the container's center */}
            <main className="z-10 flex flex-col gap-6 md:gap-10 max-w-3xl w-full px-4 transform -translate-y-4">
                {instructions.map((item, index) => (
                    <div key={index} className="flex gap-4 md:gap-8 items-start group">
                        <span className={`${item.color} font-black text-4xl md:text-6xl tracking-tighter shrink-0 animate-pulse`}>
                            {item.num}
                        </span>
                        <div className="flex flex-col gap-1">
                            <h2 className={`${item.titleColor} font-black uppercase text-xl md:text-3xl tracking-widest`}>
                                {item.title}:
                            </h2>
                            <p className="text-white text-lg md:text-2xl opacity-90 leading-tight">
                                {item.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </main>

            {/* Footer with Primary CTA */}
            <footer className="absolute bottom-6 md:bottom-10 flex flex-col items-center gap-6 md:gap-10 z-10">
                <button
                    id="next-btn"
                    onClick={() => navigate('/role-selection')}
                    className="group relative flex items-center justify-center gap-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black uppercase tracking-[0.2em] px-10 md:px-16 py-4 md:py-5 text-xl md:text-3xl rounded-none border-2 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-all duration-200 transform hover:scale-110 active:scale-95"
                >
                    <span className="relative z-10">NEXT</span>
                    <svg className="h-7 w-7 md:h-9 md:w-9 relative z-10 transition-transform group-hover:translate-x-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                    </svg>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                </button>

                {/* Pixel Cat Logo */}
                <div className="flex p-1 bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-lg">
                    <img alt="Pixel Cat Logo" className="h-16 md:h-24 w-auto object-contain brightness-110" src="/pixel-cat-logo.png" />
                </div>
            </footer>
        </div>
    );
};

export default GameInstructions;

