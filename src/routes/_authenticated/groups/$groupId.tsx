// src/routes/_authenticated/groups/$groupId.tsx
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { fallback, zodSearchValidator } from '@tanstack/router-zod-adapter'
import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  Crown,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { DecorativeBackground } from '@/components/decorative-background'
import { PlayerCard } from '@/components/player-card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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

const statsPeriodSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('date'), date: z.string() }),
  z.object({ type: z.literal('days'), days: z.number() }),
  z.object({ type: z.literal('month'), year: z.number(), month: z.number() }),
  z.object({ type: z.literal('all') }),
])

const searchSchema = z.object({
  tab: fallback(z.enum(['game-days', 'players', 'stats']), 'game-days').default('game-days'),
  period: fallback(statsPeriodSchema, { type: 'all' }).default({ type: 'all' }),
  sortBy: fallback(
    z.enum(['adjustedWinPercentage', 'winPercentage', 'wins', 'losses', 'gamesPlayed', 'plusMinus']),
    'adjustedWinPercentage',
  ).default('adjustedWinPercentage'),
  sortDir: fallback(z.enum(['asc', 'desc']), 'desc').default('desc'),
})

type SearchParams = z.infer<typeof searchSchema>

export const Route = createFileRoute('/_authenticated/groups/$groupId')({
  validateSearch: zodSearchValidator(searchSchema),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: async ({ context: { queryClient }, params: { groupId }, deps: { period } }) => {
    await Promise.all([
      queryClient.ensureQueryData(convexQuery(api.groups.get, { id: groupId as Id<'groups'> })),
      queryClient.ensureQueryData(convexQuery(api.players.listByGroup, { groupId: groupId as Id<'groups'> })),
      queryClient.ensureQueryData(convexQuery(api.gameDays.listByGroup, { groupId: groupId as Id<'groups'> })),
      queryClient.ensureQueryData(convexQuery(api.games.getStats, { groupId: groupId as Id<'groups'>, period })),
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
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: group } = useSuspenseQuery(convexQuery(api.groups.get, { id: groupId as Id<'groups'> }))

  function setActiveTab(newTab: string) {
    if (newTab === 'stats') {
      navigate({ search: { ...search, tab: newTab } })
    } else {
      // Clear stats-specific params when leaving stats tab
      navigate({ search: { tab: newTab as SearchParams['tab'] } })
    }
  }

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

      <Tabs value={search.tab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10">
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
            <PlayerCard key={player._id} player={player} onClick={() => handleEditClick(player)} />
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
          <div className="mx-auto w-full max-w-sm">
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
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Player Drawer */}
      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
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
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive">
                      <Trash2 className="size-4 mr-2" />
                      Delete Player
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Player?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {editingPlayer?.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        if (editingPlayer) {
                          removePlayer({ id: editingPlayer._id })
                          setIsEditOpen(false)
                          setEditingPlayer(null)
                        }
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
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
  const [step, setStep] = useState<'date' | 'attendees' | 'mode'>('date')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedAttendees, setSelectedAttendees] = useState<Id<'players'>[]>([])
  const [selectedMode, setSelectedMode] = useState<'auto_rotation' | 'open_play'>('auto_rotation')
  const [isCreating, setIsCreating] = useState(false)

  const hasEnoughPlayers = players.length >= 2

  function handleOpenDrawer() {
    setStep('date')
    setSelectedDate(new Date())
    setSelectedAttendees(players.map((p) => p._id))
    setSelectedMode('auto_rotation')
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
        mode: selectedMode,
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
                    <span className="text-xs bg-success text-success-foreground px-2.5 py-1 rounded-full font-medium">
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
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>
                {step === 'date' ? 'Select Date' : step === 'attendees' ? "Who's Playing?" : 'Game Mode'}
              </DrawerTitle>
            </DrawerHeader>

            {step === 'date' && (
              <div className="p-4 flex justify-center">
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} />
              </div>
            )}

            {step === 'attendees' && (
              <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
                {players?.map((player) => (
                  <button
                    key={player._id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors',
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
                  </button>
                ))}
              </div>
            )}

            {step === 'mode' && (
              <div className="p-4 space-y-3">
                <button
                  key="auto_rotation"
                  type="button"
                  className={cn(
                    'p-4 rounded-xl cursor-pointer transition-colors border-2',
                    selectedMode === 'auto_rotation'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50',
                  )}
                  onClick={() => setSelectedMode('auto_rotation')}
                >
                  <div className="font-medium">Auto Rotation</div>
                  <div className="text-sm text-muted-foreground">Algorithm picks balanced matchups</div>
                </button>
                <button
                  key="open_play"
                  type="button"
                  className={cn(
                    'p-4 rounded-xl cursor-pointer transition-colors border-2',
                    selectedMode === 'open_play'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50',
                  )}
                  onClick={() => setSelectedMode('open_play')}
                >
                  <div className="font-medium">Open Play</div>
                  <div className="text-sm text-muted-foreground">Log games freely as they happen</div>
                </button>
              </div>
            )}

            <DrawerFooter>
              {step === 'date' ? (
                <Button onClick={() => setStep('attendees')}>Next: Select Players</Button>
              ) : step === 'attendees' ? (
                <>
                  <Button onClick={() => setStep('mode')} disabled={selectedAttendees.length < 2}>
                    Next: Choose Mode
                  </Button>
                  <Button variant="outline" onClick={() => setStep('date')}>
                    Back
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating ? 'Starting...' : 'Start Game Day'}
                  </Button>
                  <Button variant="outline" onClick={() => setStep('attendees')}>
                    Back
                  </Button>
                </>
              )}
              <DrawerClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function StatsTab({ groupId }: { groupId: Id<'groups'> }) {
  const search = Route.useSearch()
  const { period, sortBy, sortDir } = search
  const navigate = useNavigate({ from: Route.fullPath })

  const { data: stats } = useSuspenseQuery(convexQuery(api.games.getStats, { groupId, period }))

  // For date picker: extract selected date from period if it's a date type
  const selectedDate = period.type === 'date' ? new Date(period.date) : new Date()

  function updateSearch(updates: Partial<SearchParams>) {
    navigate({ search: { ...search, ...updates } })
  }

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      updateSearch({ period: { type: 'date', date: format(date, 'yyyy-MM-dd') } })
    }
  }

  function handleSort(column: SearchParams['sortBy']) {
    if (sortBy === column) {
      updateSearch({ sortDir: sortDir === 'desc' ? 'asc' : 'desc' })
    } else {
      updateSearch({ sortBy: column, sortDir: 'desc' })
    }
  }

  const sortedStats = [...stats].sort((a, b) => {
    const multiplier = sortDir === 'desc' ? 1 : -1
    const key = sortBy as keyof typeof a
    return multiplier * ((b[key] as number) - (a[key] as number))
  })

  // Find the player with highest Score (Bayesian Inference) - they get the crown
  const topScorerId = stats?.reduce((topId, stat) => {
    const top = stats.find((s) => s.player._id === topId)
    return !top || stat.adjustedWinPercentage > top.adjustedWinPercentage ? stat.player._id : topId
  }, stats[0]?.player._id)

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
          onClick={() => updateSearch({ period: { type: 'days', days: 7 } })}
        >
          7 Days
        </Button>
        <Button
          variant={period.type === 'days' && period.days === 30 ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateSearch({ period: { type: 'days', days: 30 } })}
        >
          30 Days
        </Button>
        <Button
          variant={period.type === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateSearch({ period: { type: 'all' } })}
        >
          All Time
        </Button>
      </div>

      {sortedStats.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No games in this period</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-2">#</TableHead>
              <TableHead className="pr-4">Player</TableHead>
              <TableHead className="text-center w-14 px-1">
                <Button
                  variant={sortBy === 'adjustedWinPercentage' ? 'default' : 'ghost'}
                  size="xs"
                  className="h-6 px-1.5"
                  onClick={() => handleSort('adjustedWinPercentage')}
                >
                  Score
                  {sortBy === 'adjustedWinPercentage' ? (
                    sortDir === 'desc' ? (
                      <ArrowDown className="ml-0.5 size-3" />
                    ) : (
                      <ArrowUp className="ml-0.5 size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-center w-14 px-1">
                <Button
                  variant={sortBy === 'winPercentage' ? 'default' : 'ghost'}
                  size="xs"
                  className="h-6 px-1.5"
                  onClick={() => handleSort('winPercentage')}
                >
                  W%
                  {sortBy === 'winPercentage' ? (
                    sortDir === 'desc' ? (
                      <ArrowDown className="ml-0.5 size-3" />
                    ) : (
                      <ArrowUp className="ml-0.5 size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-center w-12 px-1">
                <Button
                  variant={sortBy === 'wins' ? 'default' : 'ghost'}
                  size="xs"
                  className="h-6 px-1.5"
                  onClick={() => handleSort('wins')}
                >
                  W
                  {sortBy === 'wins' ? (
                    sortDir === 'desc' ? (
                      <ArrowDown className="ml-0.5 size-3" />
                    ) : (
                      <ArrowUp className="ml-0.5 size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-center w-12 px-1">
                <Button
                  variant={sortBy === 'losses' ? 'default' : 'ghost'}
                  size="xs"
                  className="h-6 px-1.5"
                  onClick={() => handleSort('losses')}
                >
                  L
                  {sortBy === 'losses' ? (
                    sortDir === 'desc' ? (
                      <ArrowDown className="ml-0.5 size-3" />
                    ) : (
                      <ArrowUp className="ml-0.5 size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="ml-0.5 size-3 opacity-50" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="text-center w-12 px-1">
                <Button
                  variant={sortBy === 'plusMinus' ? 'default' : 'ghost'}
                  size="xs"
                  className="h-6 px-1.5"
                  onClick={() => handleSort('plusMinus')}
                >
                  +/-
                  {sortBy === 'plusMinus' ? (
                    sortDir === 'desc' ? (
                      <ArrowDown className="ml-0.5 size-3" />
                    ) : (
                      <ArrowUp className="ml-0.5 size-3" />
                    )
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
                <TableCell className="pr-4">
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <Avatar size="sm">
                        <AvatarImage src={stat.player.avatarUrl} />
                        <AvatarFallback>{stat.player.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {stat.player._id === topScorerId && (
                        <Crown className="absolute rotate-27 -top-3.5 -right-1.5 size-5 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <span>{stat.player.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center px-1">{stat.adjustedWinPercentage.toFixed(0)}</TableCell>
                <TableCell className="text-center px-1">{stat.winPercentage.toFixed(0)}%</TableCell>
                <TableCell className="text-center px-1">{stat.wins}</TableCell>
                <TableCell className="text-center px-1">{stat.losses}</TableCell>
                <TableCell className="text-center px-1">
                  {stat.plusMinus > 0 ? '+' : ''}
                  {stat.plusMinus}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {sortedStats.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          <span className="font-bold">Score</span> = Bayesian Inference (ratings adjustment algorithm) •{' '}
          <span className="font-bold">W%</span> = Win rate • <span className="font-bold">W</span> = Wins •{' '}
          <span className="font-bold">L</span> = Losses • <span className="font-bold">+/-</span> = Point differential
        </p>
      )}
    </div>
  )
}
