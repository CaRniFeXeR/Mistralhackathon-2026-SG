type GameLogoProps = {
  className?: string
  /** 'default' or 'lg' for role selection / focal pages so logo isn't squeezed */
  size?: 'default' | 'lg'
}

const sizeClasses = {
  default: {
    ai: 'text-[10px] sm:text-[12px]',
    rest: 'text-[8px] sm:text-[10px]',
  },
  lg: {
    ai: 'text-[14px] sm:text-[18px]',
    rest: 'text-[12px] sm:text-[14px]',
  },
}

export default function GameLogo({ className = '', size = 'default' }: GameLogoProps) {
  const sizes = sizeClasses[size]
  return (
    <div className={`flex flex-col items-center justify-center space-y-0 w-max ${className}`}>
      <pre className={`whitespace-pre leading-none text-red-500 font-bold mb-2 ${sizes.ai}`}>
        {`  █████  ██ 
  ██  ██ ██ 
  ██████ ██ 
  ██  ██ ██ 
  ██  ██ ██ 
  `}
      </pre>
      <pre className={`whitespace-pre leading-none text-blue-500 font-bold mb-2 ${sizes.rest}`}>
        {`  ██   ██ ███████  █████  ██████  ██████  
  ██   ██ ██      ██   ██ ██   ██ ██   ██ 
  ███████ █████   ███████ ██████  ██   ██ 
  ██   ██ ██      ██   ██ ██   ██ ██   ██ 
  ██   ██ ███████ ██   ██ ██   ██ ██████  
  `}
      </pre>
      <pre className={`whitespace-pre leading-none text-white font-bold ${sizes.rest}`}>
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
