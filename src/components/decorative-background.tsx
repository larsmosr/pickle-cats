// src/components/decorative-background.tsx
import { cn } from '@/lib/utils'

interface DecorativeBackgroundProps {
  variant?: 'default' | 'login' | 'minimal'
  className?: string
}

export function DecorativeBackground({ variant = 'default', className }: DecorativeBackgroundProps) {
  if (variant === 'login') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        {/* Top wave - flipped */}
        <svg
          className="absolute top-0 right-0 w-full h-[400px] opacity-60 rotate-180"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fill-curve"
            d="M0,160L40,133.3C80,107,160,53,240,48C320,43,400,85,480,106.7C560,128,640,128,720,117.3C800,107,880,85,960,96C1040,107,1120,149,1200,181.3C1280,213,1360,235,1400,245.3L1440,256L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
          />
        </svg>
        {/* Bottom wave */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[400px] opacity-40"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fill-curve"
            d="M0,160L40,133.3C80,107,160,53,240,48C320,43,400,85,480,106.7C560,128,640,128,720,117.3C800,107,880,85,960,96C1040,107,1120,149,1200,181.3C1280,213,1360,235,1400,245.3L1440,256L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
          />
        </svg>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        {/* Top right wave - flipped */}
        <svg
          className="absolute top-0 -right-20 w-[120%] h-[400px] opacity-50 rotate-180"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fill-curve"
            d="M0,160L40,133.3C80,107,160,53,240,48C320,43,400,85,480,106.7C560,128,640,128,720,117.3C800,107,880,85,960,96C1040,107,1120,149,1200,181.3C1280,213,1360,235,1400,245.3L1440,256L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
          />
        </svg>
      </div>
    )
  }

  // Default variant - full page decorations
  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {/* Top wave - flipped */}
      <svg
        className="absolute top-0 -right-20 w-[120%] h-[400px] opacity-50 rotate-180"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="fill-curve"
          d="M0,160L40,133.3C80,107,160,53,240,48C320,43,400,85,480,106.7C560,128,640,128,720,117.3C800,107,880,85,960,96C1040,107,1120,149,1200,181.3C1280,213,1360,235,1400,245.3L1440,256L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
        />
      </svg>
    </div>
  )
}
