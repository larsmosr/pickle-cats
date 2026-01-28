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
          className="absolute top-0 right-0 w-full h-[180px] opacity-60 rotate-180"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fill-curve"
            d="M0,0L48,42.7C96,85,192,171,288,208C384,245,480,235,576,197.3C672,160,768,96,864,80C960,64,1056,96,1152,90.7C1248,85,1344,43,1392,21.3L1440,0L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        {/* Bottom wave */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[140px] opacity-40"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fill-curve"
            d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,90.7C672,85,768,107,864,128C960,149,1056,171,1152,165.3C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
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
          className="absolute top-0 -right-20 w-[120%] h-[160px] opacity-50 rotate-180"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fill-curve"
            d="M0,0L48,42.7C96,85,192,171,288,208C384,245,480,235,576,197.3C672,160,768,96,864,80C960,64,1056,96,1152,90.7C1248,85,1344,43,1392,21.3L1440,0L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
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
        className="absolute top-0 right-0 w-full h-[200px] opacity-50 rotate-180"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="fill-curve"
          d="M0,0L48,42.7C96,85,192,171,288,208C384,245,480,235,576,197.3C672,160,768,96,864,80C960,64,1056,96,1152,90.7C1248,85,1344,43,1392,21.3L1440,0L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
      </svg>
    </div>
  )
}
