// src/components/player-card.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Doc } from '../../convex/_generated/dataModel'

interface PlayerCardProps {
  player: Doc<'players'>
  size?: 'sm' | 'default' | 'lg'
  className?: string
  onClick?: () => void
  selected?: boolean
}

export function PlayerCard({ player, size = 'default', className, onClick, selected }: PlayerCardProps) {
  const sizeClasses = {
    sm: 'p-2 gap-2',
    default: 'p-3 gap-3',
    lg: 'p-4 gap-4',
  }

  const avatarSize = {
    sm: 'sm' as const,
    default: 'default' as const,
    lg: 'lg' as const,
  }

  return (
    <div
      className={cn(
        'flex items-center rounded-xl bg-card ring-1 ring-foreground/10 transition-all',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:bg-muted active:scale-[0.98]',
        selected && 'ring-2 ring-primary bg-primary/5',
        className,
      )}
      onClick={onClick}
    >
      <Avatar size={avatarSize[size]}>
        <AvatarImage src={player.avatarUrl} alt={player.name} />
        <AvatarFallback>{player.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className={cn('font-medium truncate', size === 'sm' && 'text-sm', size === 'lg' && 'text-lg')}>
        {player.name}
      </span>
    </div>
  )
}
