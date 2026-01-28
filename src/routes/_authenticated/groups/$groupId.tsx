// src/routes/_authenticated/groups/$groupId.tsx
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { format } from 'date-fns'
import { ArrowDown, ArrowLeft, ArrowUpDown, CalendarIcon, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { DecorativeBackground } from '@/components/decorative-background'
import { PlayerCard } from '@/components/player-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getRandomCatUrl } from '@/lib/cat-avatars'
import { cn } from '@/lib/utils'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/groups/$groupId')({
  loader: async ({ context: { queryClient }, params: { groupId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(convexQuery(api.groups.get, { id: groupId as Id<'groups'> })),
      queryClient.ensureQueryData(convexQuery(api.players.listByGroup, { groupId: groupId as Id<'groups'> })),
      queryClient.ensureQueryData(convexQuery(api.gameDays.listByGroup, { groupId: groupId as Id<'groups'> })),
    ])
  },
  head: () => ({
    meta: [
      { title: 'Group | Pickle Cats' },
      { name: 'description', content: 'Manage your pickleball group, view players, game days, and statistics.' },
      { property: 'og:title', content: 'Group | Pickle Cats' },
      { property: 'og:description', content: 'Manage your pickleball group, view players, game days, and statistics.' },
    ],
  }),
  component: GroupHubPage,
})

function GroupHubPage() {
  const { groupId } = Route.useParams()
  const { data: group } = useSuspenseQuery(convexQuery(api.groups.get, { id: groupId as Id<'groups'> }))
  const [activeTab, setActiveTab] = useState('game-days')

  if (group === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col relative">
      <DecorativeBackground variant="minimal" />

      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 relative z-10 bg-background/80 backdrop-blur-sm">
        <Link to="/groups">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold flex-1">{group.name}</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10">
        <TabsList className="mx-4 mt-4 w-fit bg-card/80 backdrop-blur-sm shadow-sm">
          <TabsTrigger value="game-days">Game Days</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="game-days" className="flex-1 mt-0 p-4">
          <GameDaysTab groupId={groupId as Id<'groups'>} onNavigateToPlayers={() => setActiveTab('players')} />
        </TabsContent>

        <TabsContent value="players" className="flex-1 mt-0 p-4">
          <PlayersTab groupId={groupId as Id<'groups'>} />
        </TabsContent>

        <TabsContent value="stats" className="flex-1 mt-0 p-4">
          <StatsTab groupId={groupId as Id<'groups'>} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PlayersTab({ groupId }: { groupId: Id<'groups'> }) {
  const { data: players } = useSuspenseQuery(convexQuery(api.players.listByGroup, { groupId }))
  const createPlayer = useMutation(api.players.create)
  const removePlayer = useMutation(api.players.remove)
  const updatePlayer = useMutation(api.players.update)

  const [isOpen, setIsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<{
    _id: Id<'players'>
    name: string
    avatarUrl: string
  } | null>(null)
  const [newName, setNewName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function getUsedAvatars(excludePlayerId?: Id<'players'>) {
    if (!players) return []
    return players.filter((p) => p._id !== excludePlayerId).map((p) => p.avatarUrl)
  }

  function loadNewAvatar(excludePlayerId?: Id<'players'>) {
    setAvatarUrl(getRandomCatUrl(getUsedAvatars(excludePlayerId)))
  }

  function handleOpenDrawer() {
    setNewName('')
    loadNewAvatar()
    setIsOpen(true)
  }

  async function handleCreate() {
    if (!newName.trim() || !avatarUrl) return
    setIsCreating(true)
    try {
      await createPlayer({
        groupId,
        name: newName.trim(),
        avatarUrl,
      })
      setIsOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  function handleEditClick(player: typeof editingPlayer) {
    if (!player) return
    setEditingPlayer(player)
    setNewName(player.name)
    setAvatarUrl(player.avatarUrl)
    setIsEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editingPlayer || !newName.trim()) return
    setIsSaving(true)
    try {
      await updatePlayer({
        id: editingPlayer._id,
        name: newName.trim(),
        avatarUrl,
      })
      setIsEditOpen(false)
      setEditingPlayer(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="pb-24">
      {players.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No players yet</p>
          <p className="text-muted-foreground text-sm">Add players to start tracking games</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {players.map((player) => (
            <div key={player._id} className="relative group">
              <PlayerCard player={player} onClick={() => handleEditClick(player)} />
              <Button
                variant="destructive"
                size="icon-xs"
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  removePlayer({ id: player._id })
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Player Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg bg-foreground text-background hover:bg-foreground/90 rounded-2xl h-12 px-6"
            size="lg"
            onClick={handleOpenDrawer}
          >
            <Plus className="size-5 mr-2" />
            Add Player
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add New Player</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="size-40 ring-4 ring-primary/20">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-4xl">?</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" onClick={() => loadNewAvatar()}>
                <RefreshCw className="size-4 mr-2" />
                New Cat
              </Button>
            </div>
            <Input placeholder="Player name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DrawerFooter>
            <Button onClick={handleCreate} disabled={!newName.trim() || !avatarUrl || isCreating}>
              {isCreating ? 'Adding...' : 'Add Player'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Edit Player Drawer */}
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Player</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="size-40 ring-4 ring-primary/20">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-4xl">{newName.charAt(0) || '?'}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" onClick={() => loadNewAvatar(editingPlayer?._id)}>
                <RefreshCw className="size-4 mr-2" />
                New Cat
              </Button>
            </div>
            <Input placeholder="Player name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DrawerFooter>
            <Button onClick={handleSaveEdit} disabled={!newName.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function GameDaysTab({ groupId, onNavigateToPlayers }: { groupId: Id<'groups'>; onNavigateToPlayers: () => void }) {
  const { data: gameDays } = useSuspenseQuery(convexQuery(api.gameDays.listByGroup, { groupId }))
  const { data: players } = useSuspenseQuery(convexQuery(api.players.listByGroup, { groupId }))
  const createGameDay = useMutation(api.gameDays.create)
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'date' | 'attendees'>('date')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedAttendees, setSelectedAttendees] = useState<Id<'players'>[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const hasEnoughPlayers = players.length >= 2

  function handleOpenDrawer() {
    setStep('date')
    setSelectedDate(new Date())
    setSelectedAttendees([])
    setIsOpen(true)
  }

  function toggleAttendee(playerId: Id<'players'>) {
    setSelectedAttendees((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId],
    )
  }

  async function handleCreate() {
    if (selectedAttendees.length < 2) return
    setIsCreating(true)
    try {
      const id = await createGameDay({
        groupId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        attendeeIds: selectedAttendees,
      })
      setIsOpen(false)
      navigate({ to: '/game-day/$gameDayId', params: { gameDayId: id } })
    } finally {
      setIsCreating(false)
    }
  }

  // Show prompt to add players first if not enough players
  if (!hasEnoughPlayers) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
        <Users className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">You need at least 2 players to start a game day</p>
          <p className="text-muted-foreground text-sm mt-1">Add some players first</p>
        </div>
        <Button onClick={onNavigateToPlayers}>
          <Plus className="size-4 mr-2" />
          Add Players
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {gameDays.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No game days yet</p>
          <p className="text-muted-foreground text-sm">Start a new game day to begin tracking</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {gameDays.map((gameDay) => (
            <Link
              key={gameDay._id}
              to={gameDay.isComplete ? '/game-day/$gameDayId/summary' : '/game-day/$gameDayId'}
              params={{ gameDayId: gameDay._id }}
            >
              <Card className="hover:bg-card/80 transition-all cursor-pointer shadow-sm hover:shadow-md border-0 bg-card/90">
                <CardContent className="py-0 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{format(new Date(gameDay.date), 'EEEE, MMMM d')}</p>
                    <p className="text-sm text-muted-foreground">{gameDay.gameCount} games played</p>
                  </div>
                  {gameDay.isComplete && (
                    <span className="text-xs bg-warm text-warm-foreground px-2.5 py-1 rounded-full font-medium">
                      Complete
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg bg-foreground text-background hover:bg-foreground/90 rounded-2xl h-12 px-6"
            size="lg"
            onClick={handleOpenDrawer}
            disabled={players.length < 2}
          >
            <Plus className="size-5 mr-2" />
            New Game Day
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{step === 'date' ? 'Select Date' : "Who's Playing?"}</DrawerTitle>
          </DrawerHeader>

          {step === 'date' ? (
            <div className="p-4 flex justify-center">
              <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} />
            </div>
          ) : (
            <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
              {players?.map((player) => (
                <div
                  key={player._id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                    selectedAttendees.includes(player._id)
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'bg-card ring-1 ring-foreground/10 hover:bg-muted/50',
                  )}
                  onClick={() => toggleAttendee(player._id)}
                >
                  <Checkbox
                    checked={selectedAttendees.includes(player._id)}
                    onCheckedChange={() => toggleAttendee(player._id)}
                  />
                  <Avatar size="sm">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{player.name}</span>
                </div>
              ))}
            </div>
          )}

          <DrawerFooter>
            {step === 'date' ? (
              <Button onClick={() => setStep('attendees')}>Next: Select Players</Button>
            ) : (
              <>
                <Button onClick={handleCreate} disabled={selectedAttendees.length < 2 || isCreating}>
                  {isCreating ? 'Starting...' : `Start with ${selectedAttendees.length} Players`}
                </Button>
                <Button variant="outline" onClick={() => setStep('date')}>
                  Back
                </Button>
              </>
            )}
            <DrawerClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

type StatsPeriod =
  | { type: 'date'; date: string }
  | { type: 'days'; days: number }
  | { type: 'month'; year: number; month: number }
  | { type: 'all' }

function StatsTab({ groupId }: { groupId: Id<'groups'> }) {
  const today = new Date()
  const [period, setPeriod] = useState<StatsPeriod>({
    type: 'date',
    date: format(today, 'yyyy-MM-dd'),
  })
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [sortBy, setSortBy] = useState<'winPercentage' | 'wins' | 'losses' | 'gamesPlayed' | 'plusMinus'>(
    'winPercentage',
  )

  const stats = useQuery(api.games.getStats, { groupId, period })

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      setSelectedDate(date)
      setPeriod({ type: 'date', date: format(date, 'yyyy-MM-dd') })
    }
  }

  const sortedStats = stats
    ? [...stats].sort((a, b) => {
        if (sortBy === 'losses') return b.losses - a.losses
        return b[sortBy] - a[sortBy]
      })
    : []

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger
            render={(props) => (
              <Button {...props} variant={period.type === 'date' ? 'default' : 'outline'} size="sm">
                <CalendarIcon className="size-4 mr-1" />
                {period.type === 'date' ? format(selectedDate, 'MMM d') : 'Date'}
              </Button>
            )}
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} />
          </PopoverContent>
        </Popover>
        <Button
          variant={period.type === 'days' && period.days === 7 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod({ type: 'days', days: 7 })}
        >
          7 Days
        </Button>
        <Button
          variant={period.type === 'days' && period.days === 30 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod({ type: 'days', days: 30 })}
        >
          30 Days
        </Button>
        <Button
          variant={period.type === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod({ type: 'all' })}
        >
          All Time
        </Button>
      </div>

      {stats === undefined ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : sortedStats.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No games in this period</p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-2">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right w-14 px-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-1 text-primary"
                  onClick={() => setSortBy('winPercentage')}
                >
                  W%
                  {sortBy === 'winPercentage' ? (
                    <ArrowDown className="ml-0.5 size-3" />
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-right w-12 px-1">
                <Button variant="ghost" size="sm" className="h-8 px-1 text-primary" onClick={() => setSortBy('wins')}>
                  W
                  {sortBy === 'wins' ? (
                    <ArrowDown className="ml-0.5 size-3" />
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-right w-12 px-1">
                <Button variant="ghost" size="sm" className="h-8 px-1 text-primary" onClick={() => setSortBy('losses')}>
                  L
                  {sortBy === 'losses' ? (
                    <ArrowDown className="ml-0.5 size-3" />
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-right w-12 px-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-1 text-primary"
                  onClick={() => setSortBy('plusMinus')}
                >
                  +/-
                  {sortBy === 'plusMinus' ? (
                    <ArrowDown className="ml-0.5 size-3" />
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map((stat, index) => (
              <TableRow key={stat.player._id}>
                <TableCell className="font-medium px-2 w-8">{index + 1}</TableCell>
                <TableCell className="overflow-hidden max-w-[100px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar size="sm" className="shrink-0">
                      <AvatarImage src={stat.player.avatarUrl} />
                      <AvatarFallback>{stat.player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[70px]">{stat.player.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right px-1">{stat.winPercentage.toFixed(0)}%</TableCell>
                <TableCell className="text-right px-1">{stat.wins}</TableCell>
                <TableCell className="text-right px-1">{stat.losses}</TableCell>
                <TableCell className="text-right px-1">
                  {stat.plusMinus > 0 ? '+' : ''}
                  {stat.plusMinus}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
