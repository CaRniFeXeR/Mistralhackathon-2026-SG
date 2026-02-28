type GameLogoProps = {
  className?: string
}

export default function GameLogo({ className = '' }: GameLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center space-y-0 ${className}`}>
      <pre className="whitespace-pre text-[10px] sm:text-[12px] leading-none text-red-500 font-bold mb-2">
        {`  █████  ██ 
  ██  ██ ██ 
  ██████ ██ 
  ██  ██ ██ 
  ██  ██ ██ 
  `}
      </pre>
      <pre className="whitespace-pre text-[8px] sm:text-[10px] leading-none text-blue-500 font-bold mb-2">
        {`  ██   ██ ███████  █████  ██████  ██████  
  ██   ██ ██      ██   ██ ██   ██ ██   ██ 
  ███████ █████   ███████ ██████  ██   ██ 
  ██   ██ ██      ██   ██ ██   ██ ██   ██ 
  ██   ██ ███████ ██   ██ ██   ██ ██████  
  `}
      </pre>
      <pre className="whitespace-pre text-[8px] sm:text-[10px] leading-none text-white font-bold">
        {`  ████████ ██   ██  █████  ████████ 
     ██    ██   ██ ██   ██    ██    
     ██    ███████ ███████    ██    
     ██    ██   ██ ██   ██    ██    
     ██    ██   ██ ██   ██    ██    
  `}
      </pre>
    </div>
  )
}
