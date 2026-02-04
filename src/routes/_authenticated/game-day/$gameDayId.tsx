// src/routes/_authenticated/game-day/$gameDayId.tsx
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import { ArrowLeft, ArrowLeftRight, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { generateMatchup, swapPlayer } from '@/lib/matchmaking'
import { cn } from '@/lib/utils'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/game-day/$gameDayId')({
  loader: async ({ context: { queryClient }, params: { gameDayId } }) => {
    await queryClient.ensureQueryData(convexQuery(api.gameDays.get, { id: gameDayId as Id<'gameDays'> }))
  },
  head: () => ({
    meta: [
      { title: 'Game Day | Pickle Cats' },
      { name: 'description', content: 'Track live scores, manage matchups, and record your pickleball games.' },
      { property: 'og:title', content: 'Game Day | Pickle Cats' },
      { property: 'og:description', content: 'Track live scores, manage matchups, and record your pickleball games.' },
    ],
  }),
  component: ActiveGameDayPage,
})

type Player = Doc<'players'>
type Game = Doc<'games'>

interface MatchupState {
  team1: Player[]
  team2: Player[]
  sittingOut: Player[]
}

function ActiveGameDayPage() {
  const { gameDayId } = Route.useParams()
  const navigate = useNavigate()

  const { data: gameDay } = useSuspenseQuery(convexQuery(api.gameDays.get, { id: gameDayId as Id<'gameDays'> }))
  const createGame = useMutation(api.games.create)
  const updateGame = useMutation(api.games.update)
  const removeGame = useMutation(api.games.remove)
  const completeDay = useMutation(api.gameDays.complete)
  const removeGameDay = useMutation(api.gameDays.remove)

  const [isDoubles, setIsDoubles] = useState(true)
  const [matchup, setMatchup] = useState<MatchupState | null>(null)
  const [team1Score, setTeam1Score] = useState('')
  const [team2Score, setTeam2Score] = useState('')
  const [swapDrawerOpen, setSwapDrawerOpen] = useState(false)
  const [playerToSwap, setPlayerToSwap] = useState<Player | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Open Play state
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([])
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false)
  const [slotToFill, setSlotToFill] = useState<number | null>(null) // 0-3 for team positions

  // Edit game state
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [editTeam1Score, setEditTeam1Score] = useState('')
  const [editTeam2Score, setEditTeam2Score] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete game day state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Complete day dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)

  const attendees = useMemo(() => (gameDay?.attendees ?? []) as Player[], [gameDay?.attendees])
  const games = useMemo(() => (gameDay?.games ?? []) as Game[], [gameDay?.games])

  // Generate initial matchup
  useEffect(() => {
    if (attendees.length >= 2 && !matchup) {
      const result = generateMatchup(attendees, games, isDoubles)
      setMatchup(result)
    }
  }, [attendees, games, isDoubles, matchup])

  // Regenerate when mode changes
  useEffect(() => {
    if (attendees.length >= 2) {
      const result = generateMatchup(attendees, games, isDoubles)
      setMatchup(result)
    }
    // Reset Open Play state when mode changes
    setSelectedPlayers([])
  }, [isDoubles])

  function handleSwapClick(player: Player) {
    setPlayerToSwap(player)
    setSwapDrawerOpen(true)
  }

  function handleSwapSelect(newPlayer: Player) {
    if (!playerToSwap || !matchup) return

    const result = swapPlayer(matchup, playerToSwap._id, newPlayer._id, attendees, games, isDoubles)
    setMatchup(result)
    setSwapDrawerOpen(false)
    setPlayerToSwap(null)
  }

  // Open Play helper functions
  function handleSlotClick(slotIndex: number) {
    setSlotToFill(slotIndex)
    setPlayerPickerOpen(true)
  }

  function handlePlayerSelect(player: Player) {
    if (slotToFill === null) return

    const newSelected = [...selectedPlayers]
    newSelected[slotToFill] = player
    setSelectedPlayers(newSelected)
    setPlayerPickerOpen(false)
    setSlotToFill(null)
  }

  function resetOpenPlayState() {
    setSelectedPlayers([])
    setTeam1Score('')
    setTeam2Score('')
  }

  async function handleSubmitGame() {
    const isOpenPlay = gameDay?.mode === 'open_play'

    // For Open Play, get team players from selectedPlayers array
    // For Auto Rotation, use existing matchup state
    let team1Players: Player[]
    let team2Players: Player[]

    if (isOpenPlay) {
      const playersPerTeam = isDoubles ? 2 : 1
      team1Players = selectedPlayers.slice(0, playersPerTeam).filter(Boolean)
      team2Players = selectedPlayers.slice(playersPerTeam, playersPerTeam * 2).filter(Boolean)

      // Ensure we have enough players for both teams
      if (team1Players.length !== playersPerTeam || team2Players.length !== playersPerTeam) return
    } else {
      if (!matchup) return
      team1Players = matchup.team1
      team2Players = matchup.team2
    }

    // Empty inputs default to 0 (as shown in placeholder)
    const score1 = team1Score === '' ? 0 : Number.parseInt(team1Score, 10)
    const score2 = team2Score === '' ? 0 : Number.parseInt(team2Score, 10)

    if (isNaN(score1) || isNaN(score2)) return

    setIsSubmitting(true)
    try {
      await createGame({
        gameDayId: gameDayId as Id<'gameDays'>,
        team1Ids: team1Players.map((p) => p._id),
        team2Ids: team2Players.map((p) => p._id),
        team1Score: score1,
        team2Score: score2,
      })

      if (isOpenPlay) {
        // Reset Open Play state for next game
        resetOpenPlayState()
      } else {
        // Reset for next game
        setTeam1Score('')
        setTeam2Score('')

        // Generate new matchup (will update on next render with new games)
        const newGames = [
          ...games,
          {
            team1Ids: team1Players.map((p) => p._id),
            team2Ids: team2Players.map((p) => p._id),
            team1Score: score1,
            team2Score: score2,
          } as Game,
        ]
        const result = generateMatchup(attendees, newGames, isDoubles)
        setMatchup(result)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleFinishDay() {
    await completeDay({ id: gameDayId as Id<'gameDays'> })
    navigate({
      to: '/game-day/$gameDayId/summary',
      params: { gameDayId },
    })
  }

  async function handleDeleteGameDay() {
    if (!gameDay) return
    await removeGameDay({ id: gameDayId as Id<'gameDays'> })
    navigate({ to: '/groups/$groupId', params: { groupId: gameDay.groupId } })
  }

  function handleEditGameClick(game: Game) {
    setEditingGame(game)
    setEditTeam1Score(game.team1Score.toString())
    setEditTeam2Score(game.team2Score.toString())
    setEditDrawerOpen(true)
  }

  async function handleSaveGameEdit() {
    if (!editingGame || editTeam1Score === '' || editTeam2Score === '') return

    const score1 = Number.parseInt(editTeam1Score, 10)
    const score2 = Number.parseInt(editTeam2Score, 10)

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) return

    setIsSavingEdit(true)
    try {
      await updateGame({
        id: editingGame._id,
        team1Score: score1,
        team2Score: score2,
      })
      setEditDrawerOpen(false)
      setEditingGame(null)
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleDeleteGame() {
    if (!editingGame) return
    await removeGame({ id: editingGame._id })
    setEditDrawerOpen(false)
    setEditingGame(null)
  }

  if (gameDay === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Game day not found</p>
      </div>
    )
  }

  // Empty inputs default to 0, scores must be different (no ties)
  const score1 = team1Score === '' ? 0 : Number.parseInt(team1Score, 10)
  const score2 = team2Score === '' ? 0 : Number.parseInt(team2Score, 10)
  const scoresValid = !isNaN(score1) && !isNaN(score2) && score1 !== score2

  const isOpenPlay = gameDay?.mode === 'open_play'
  const playersPerTeam = isDoubles ? 2 : 1
  const totalSlotsNeeded = playersPerTeam * 2

  // For Open Play, check if all slots are filled
  const openPlayTeamsValid =
    selectedPlayers.filter(Boolean).length === totalSlotsNeeded &&
    new Set(selectedPlayers.map((p) => p?._id)).size === totalSlotsNeeded // No duplicates

  const canSubmit = isOpenPlay
    ? openPlayTeamsValid && scoresValid
    : matchup && matchup.team1.length > 0 && matchup.team2.length > 0 && scoresValid

  // For Open Play mode, compute team slots
  const team1Slots = Array.from({ length: playersPerTeam }, (_, i) => selectedPlayers[i] ?? null)
  const team2Slots = Array.from({ length: playersPerTeam }, (_, i) => selectedPlayers[playersPerTeam + i] ?? null)

  return (
    <div className="flex-1 flex flex-col pb-24 relative">
      <DecorativeBackground variant="minimal" />

      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 relative z-10 bg-background/80 backdrop-blur-sm">
        <Link to="/groups/$groupId" params={{ groupId: gameDay.groupId }}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{format(new Date(gameDay.date), 'EEEE, MMMM d')}</h2>
          <p className="text-sm text-muted-foreground">
            {gameDay.group?.name} • {games.length} games played
          </p>
        </div>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4 mr-1" />
                Delete
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Game Day?</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete this game day?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDeleteGameDay}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="p-4 space-y-6 relative z-10">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-3 bg-card/60 backdrop-blur-sm rounded-2xl p-3 shadow-sm">
          <Label htmlFor="mode" className={cn(!isDoubles && 'text-muted-foreground', 'font-medium')}>
            Singles
          </Label>
          <Switch id="mode" checked={isDoubles} onCheckedChange={setIsDoubles} />
          <Label htmlFor="mode" className={cn(isDoubles && 'text-muted-foreground', 'font-medium')}>
            Doubles
          </Label>
        </div>

        {/* Current Matchup - conditional rendering based on mode */}
        {isOpenPlay ? (
          <Card className="shadow-md border-0 bg-card/90 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-sm text-muted-foreground font-medium">
                Game {games.length + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                {/* Team 1 */}
                <div className="space-y-2">
                  {team1Slots.map((player, index) => (
                    <button
                      key={player?._id ?? `slot-${index}`}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-1.5 p-1.5 rounded-xl cursor-pointer transition-colors',
                        player
                          ? 'bg-secondary/60 hover:bg-secondary'
                          : 'border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50',
                      )}
                      onClick={() => handleSlotClick(index)}
                    >
                      {player ? (
                        <>
                          <Avatar size="sm">
                            <AvatarImage src={player.avatarUrl} />
                            <AvatarFallback className="bg-warm text-warm-foreground">
                              {player.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{player.name}</span>
                        </>
                      ) : (
                        <>
                          <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center">
                            <Plus className="size-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm text-muted-foreground">Tap to add</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {/* VS */}
                <div className="text-lg font-bold text-muted-foreground w-8 flex items-center justify-center">VS</div>

                {/* Team 2 */}
                <div className="space-y-2">
                  {team2Slots.map((player, index) => (
                    <button
                      key={player?._id ?? `slot-${playersPerTeam + index}`}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-1.5 p-1.5 rounded-xl cursor-pointer transition-colors',
                        player
                          ? 'bg-warm/50 hover:bg-warm/70'
                          : 'border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50',
                      )}
                      onClick={() => handleSlotClick(playersPerTeam + index)}
                    >
                      {player ? (
                        <>
                          <Avatar size="sm">
                            <AvatarImage src={player.avatarUrl} />
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {player.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{player.name}</span>
                        </>
                      ) : (
                        <>
                          <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center">
                            <Plus className="size-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm text-muted-foreground">Tap to add</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Entry */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  className="text-center text-2xl h-11.5 w-full"
                  value={team1Score}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || Number.parseInt(val, 10) >= 0) {
                      setTeam1Score(val)
                    }
                  }}
                />
                <div className="text-lg font-bold text-muted-foreground w-8 flex items-center justify-center">-</div>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  className="text-center text-2xl h-11.5 w-full"
                  value={team2Score}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || Number.parseInt(val, 10) >= 0) {
                      setTeam2Score(val)
                    }
                  }}
                />
              </div>

              <Button
                className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-md h-12"
                size="lg"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmitGame}
              >
                <Check className="size-5 mr-2" />
                {isSubmitting ? 'Saving...' : 'Submit Game'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          matchup &&
          matchup.team1.length > 0 && (
            <Card className="shadow-md border-0 bg-card/90 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-center text-sm text-muted-foreground font-medium">
                  Game {games.length + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  {/* Team 1 */}
                  <div className="space-y-2">
                    {matchup.team1.map((player) => (
                      <button
                        key={player._id}
                        type="button"
                        className="flex w-full items-center gap-2 p-2.5 pr-4 rounded-xl bg-secondary/60 cursor-pointer hover:bg-secondary transition-colors"
                        onClick={() => handleSwapClick(player)}
                      >
                        <Avatar size="sm">
                          <AvatarImage src={player.avatarUrl} />
                          <AvatarFallback className="bg-warm text-warm-foreground">
                            {player.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{player.name}</span>
                        <ArrowLeftRight className="size-3 ml-auto text-muted-foreground" />
                      </button>
                    ))}
                  </div>

                  {/* VS */}
                  <div className="text-lg font-bold text-muted-foreground w-8 flex items-center justify-center">VS</div>

                  {/* Team 2 */}
                  <div className="space-y-2">
                    {matchup.team2.map((player) => (
                      <button
                        key={player._id}
                        type="button"
                        className="flex w-full items-center gap-2 p-2.5 pr-4 rounded-xl bg-warm/50 cursor-pointer hover:bg-warm/70 transition-colors"
                        onClick={() => handleSwapClick(player)}
                      >
                        <Avatar size="sm">
                          <AvatarImage src={player.avatarUrl} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground">
                            {player.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{player.name}</span>
                        <ArrowLeftRight className="size-3 ml-auto text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Score Entry */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    className="text-center text-2xl h-11.5 w-full"
                    value={team1Score}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || Number.parseInt(val, 10) >= 0) {
                        setTeam1Score(val)
                      }
                    }}
                  />
                  <div className="text-lg font-bold text-muted-foreground w-8 flex items-center justify-center">-</div>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    className="text-center text-2xl h-11.5 w-full"
                    value={team2Score}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || Number.parseInt(val, 10) >= 0) {
                        setTeam2Score(val)
                      }
                    }}
                  />
                </div>

                <Button
                  className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-md h-12"
                  size="lg"
                  disabled={!canSubmit || isSubmitting}
                  onClick={handleSubmitGame}
                >
                  <Check className="size-5 mr-2" />
                  {isSubmitting ? 'Saving...' : 'Submit Game'}
                </Button>
              </CardContent>
            </Card>
          )
        )}

        {/* Sitting Out - hide for Open Play */}
        {!isOpenPlay && matchup && matchup.sittingOut.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Sitting Out</h3>
            <div className="flex gap-2 flex-wrap">
              {matchup.sittingOut.map((player) => (
                <div key={player._id} className="flex items-center gap-2 px-3 py-2 rounded-full bg-card shadow-sm">
                  <Avatar size="sm">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback className="bg-muted text-muted-foreground">{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{player.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Previous Games */}
        {games.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Previous Games</h3>
            <div className="space-y-2">
              {[...games].reverse().map((game) => {
                const team1Players = game.team1Ids
                  .map((id) => attendees.find((p) => p._id === id))
                  .filter(Boolean) as Player[]
                const team2Players = game.team2Ids
                  .map((id) => attendees.find((p) => p._id === id))
                  .filter(Boolean) as Player[]

                return (
                  <Card
                    key={game._id}
                    size="sm"
                    className="cursor-pointer hover:bg-card/80 transition-all shadow-sm hover:shadow-md border-0 bg-card/90"
                    onClick={() => handleEditGameClick(game)}
                  >
                    <CardContent className="py-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-muted-foreground">Game {game.gameNumber}</span>
                        <div className="flex items-center gap-3">
                          {/* Team 1 avatars */}
                          <div className="flex -space-x-2">
                            {team1Players.map((player) => (
                              <Avatar
                                key={player._id}
                                size="sm"
                                className={cn(
                                  'ring-2 ring-background',
                                  game.team1Score > game.team2Score && 'ring-primary',
                                )}
                              >
                                <AvatarImage src={player.avatarUrl} />
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>

                          {/* Score */}
                          <div className="flex items-center gap-1 min-w-16 justify-center">
                            <span
                              className={cn('text-lg font-bold', game.team1Score > game.team2Score && 'text-primary')}
                            >
                              {game.team1Score}
                            </span>
                            <span className="text-muted-foreground">-</span>
                            <span
                              className={cn('text-lg font-bold', game.team2Score > game.team1Score && 'text-primary')}
                            >
                              {game.team2Score}
                            </span>
                          </div>

                          {/* Team 2 avatars */}
                          <div className="flex -space-x-2">
                            {team2Players.map((player) => (
                              <Avatar
                                key={player._id}
                                size="sm"
                                className={cn(
                                  'ring-2 ring-background',
                                  game.team2Score > game.team1Score && 'ring-primary',
                                )}
                              >
                                <AvatarImage src={player.avatarUrl} />
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>

                          <Pencil className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* View Summary Button */}
      {games.length > 0 && (
        <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <AlertDialogTrigger
            render={
              <Button
                className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg bg-foreground text-background hover:bg-foreground/90 rounded-2xl h-12 px-6 z-20"
                size="lg"
              >
                View Summary
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Game Day?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the game day as complete and show you the summary. You can still view and edit games
                afterward.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinishDay}>View Summary</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Swap Drawer */}
      <Drawer open={swapDrawerOpen} onOpenChange={setSwapDrawerOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Swap {playerToSwap?.name} with...</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
              {matchup?.sittingOut.map((player) => (
                <PlayerCard key={player._id} player={player} onClick={() => handleSwapSelect(player)} />
              ))}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Game Drawer */}
      <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle className="text-center">Edit Game {editingGame?.gameNumber}</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-6">
              {editingGame && (
                <>
                  {/* Teams with VS between */}
                  <div className="flex items-center justify-center gap-6">
                    {/* Team 1 */}
                    <div className="space-y-1">
                      {editingGame.team1Ids.map((id) => {
                        const player = attendees.find((p) => p._id === id)
                        return player ? (
                          <div key={id} className="flex items-center gap-2 text-sm">
                            <Avatar size="sm">
                              <AvatarImage src={player.avatarUrl} />
                              <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{player.name}</span>
                          </div>
                        ) : null
                      })}
                    </div>

                    {/* VS */}
                    <div className="text-lg font-bold text-muted-foreground">VS</div>

                    {/* Team 2 */}
                    <div className="space-y-1">
                      {editingGame.team2Ids.map((id) => {
                        const player = attendees.find((p) => p._id === id)
                        return player ? (
                          <div key={id} className="flex items-center gap-2 text-sm">
                            <Avatar size="sm">
                              <AvatarImage src={player.avatarUrl} />
                              <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{player.name}</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>

                  {/* Score inputs */}
                  <div className="flex items-center justify-center gap-4">
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      className="text-center text-3xl font-bold h-16 w-24 rounded-2xl"
                      value={editTeam1Score}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '' || Number.parseInt(val, 10) >= 0) {
                          setEditTeam1Score(val)
                        }
                      }}
                    />
                    <div className="text-2xl text-muted-foreground font-bold">-</div>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      className="text-center text-3xl font-bold h-16 w-24 rounded-2xl"
                      value={editTeam2Score}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '' || Number.parseInt(val, 10) >= 0) {
                          setEditTeam2Score(val)
                        }
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            <DrawerFooter>
              <Button
                onClick={handleSaveGameEdit}
                disabled={
                  editTeam1Score === '' || editTeam2Score === '' || editTeam1Score === editTeam2Score || isSavingEdit
                }
              >
                <Check className="size-4 mr-2" />
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="destructive" onClick={handleDeleteGame}>
                <Trash2 className="size-4 mr-2" />
                Delete Game
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Open Play Player Picker Drawer */}
      <Drawer open={playerPickerOpen} onOpenChange={setPlayerPickerOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Select Player</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
              {attendees
                .filter((player) => !selectedPlayers.some((p) => p?._id === player._id))
                .map((player) => (
                  <PlayerCard key={player._id} player={player} onClick={() => handlePlayerSelect(player)} />
                ))}
            </div>
            <DrawerFooter>
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
