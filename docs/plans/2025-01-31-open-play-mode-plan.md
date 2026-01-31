# Open Play Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Open Play" game day mode where users log games manually without algorithmic matchmaking.

**Architecture:** Add a `mode` field to `gameDays` table. Creation flow gets a mode selection step. Game day page conditionally renders Auto Rotation (existing) or Open Play (tap-to-fill empty court) UI based on mode.

**Tech Stack:** Convex (backend), React, TanStack Router, shadcn/ui components

---

## Task 1: Add mode field to schema

**Files:**
- Modify: `convex/schema.ts:17-25`

**Step 1: Update gameDays table definition**

Add the mode field with union type:

```typescript
gameDays: defineTable({
  groupId: v.id("groups"),
  date: v.string(),
  attendeeIds: v.array(v.id("players")),
  isComplete: v.boolean(),
  mode: v.union(v.literal("auto_rotation"), v.literal("open_play")),
  createdAt: v.number(),
})
  .index("by_group", ["groupId"])
  .index("by_group_and_date", ["groupId", "date"]),
```

**Step 2: Verify schema pushes correctly**

Run: `npx convex dev` (should already be running, check for errors)
Expected: No schema errors

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add mode field to gameDays schema"
```

---

## Task 2: Update gameDays.create mutation

**Files:**
- Modify: `convex/gameDays.ts:59-75`

**Step 1: Add mode parameter to create mutation**

```typescript
export const create = mutation({
  args: {
    groupId: v.id("groups"),
    date: v.string(),
    attendeeIds: v.array(v.id("players")),
    mode: v.union(v.literal("auto_rotation"), v.literal("open_play")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("gameDays", {
      groupId: args.groupId,
      date: args.date,
      attendeeIds: args.attendeeIds,
      isComplete: false,
      mode: args.mode,
      createdAt: Date.now(),
    });
    return id;
  },
});
```

**Step 2: Verify no type errors**

Run: `npx convex dev` (check output)
Expected: No errors

**Step 3: Commit**

```bash
git add convex/gameDays.ts
git commit -m "feat: accept mode parameter in gameDays.create"
```

---

## Task 3: Add mode selection step to game day creation

**Files:**
- Modify: `src/routes/_authenticated/groups/$groupId.tsx:310-473`

**Step 1: Add mode state and update step type**

In `GameDaysTab`, update state:

```typescript
const [step, setStep] = useState<'date' | 'attendees' | 'mode'>('date')
const [selectedMode, setSelectedMode] = useState<'auto_rotation' | 'open_play'>('auto_rotation')
```

**Step 2: Update handleCreate to pass mode**

```typescript
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
```

**Step 3: Update handleOpenDrawer to reset mode**

```typescript
function handleOpenDrawer() {
  setStep('date')
  setSelectedDate(new Date())
  setSelectedAttendees([])
  setSelectedMode('auto_rotation')
  setIsOpen(true)
}
```

**Step 4: Add mode selection UI in drawer**

Update the drawer content to handle the new step. After the attendees step, add mode selection:

```tsx
{step === 'mode' && (
  <div className="p-4 space-y-3">
    <div
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
    </div>
    <div
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
    </div>
  </div>
)}
```

**Step 5: Update footer buttons for mode step**

```tsx
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
```

**Step 6: Update drawer title**

```tsx
<DrawerTitle>
  {step === 'date' ? 'Select Date' : step === 'attendees' ? "Who's Playing?" : 'Game Mode'}
</DrawerTitle>
```

**Step 7: Test manually**

- Create a new game day
- Verify 3 steps: date → attendees → mode
- Select each mode option to verify UI feedback
- Complete creation with each mode

**Step 8: Commit**

```bash
git add src/routes/_authenticated/groups/\$groupId.tsx
git commit -m "feat: add mode selection step to game day creation"
```

---

## Task 4: Add Open Play UI to game day page

**Files:**
- Modify: `src/routes/_authenticated/game-day/$gameDayId.tsx`

**Step 1: Add state for Open Play player selection**

Add after existing state declarations (~line 75):

```typescript
// Open Play state
const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([])
const [playerPickerOpen, setPlayerPickerOpen] = useState(false)
const [slotToFill, setSlotToFill] = useState<number | null>(null) // 0-3 for team positions
```

**Step 2: Create helper functions for Open Play**

Add after existing helper functions:

```typescript
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
```

**Step 3: Update handleSubmitGame for Open Play**

Modify `handleSubmitGame` to handle both modes:

```typescript
async function handleSubmitGame() {
  const isOpenPlay = gameDay?.mode === 'open_play'

  // Get team players based on mode
  const team1Players = isOpenPlay
    ? selectedPlayers.slice(0, isDoubles ? 2 : 1)
    : matchup?.team1 ?? []
  const team2Players = isOpenPlay
    ? selectedPlayers.slice(isDoubles ? 2 : 1)
    : matchup?.team2 ?? []

  if (team1Players.length === 0 || team2Players.length === 0) return

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
      // Reset for next game in Open Play
      resetOpenPlayState()
    } else {
      // Auto Rotation: reset scores and generate new matchup
      setTeam1Score('')
      setTeam2Score('')
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
```

**Step 4: Create OpenPlayMatchupCard component**

Add before the return statement:

```typescript
function OpenPlayMatchupCard() {
  const requiredPlayers = isDoubles ? 4 : 2
  const team1Size = isDoubles ? 2 : 1
  const team1 = selectedPlayers.slice(0, team1Size)
  const team2 = selectedPlayers.slice(team1Size, requiredPlayers)

  const score1 = team1Score === '' ? 0 : Number.parseInt(team1Score, 10)
  const score2 = team2Score === '' ? 0 : Number.parseInt(team2Score, 10)
  const scoresValid = !isNaN(score1) && !isNaN(score2) && score1 !== score2
  const allSlotsFilled = selectedPlayers.filter(Boolean).length === requiredPlayers
  const canSubmit = allSlotsFilled && scoresValid

  return (
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
            {Array.from({ length: team1Size }).map((_, i) => {
              const player = team1[i]
              return player ? (
                <button
                  key={player._id}
                  type="button"
                  className="flex w-full items-center gap-2 p-2.5 pr-4 rounded-xl bg-secondary/60 cursor-pointer hover:bg-secondary transition-colors"
                  onClick={() => handleSlotClick(i)}
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
              ) : (
                <button
                  key={`empty-t1-${i}`}
                  type="button"
                  className="flex w-full items-center gap-2 p-2.5 pr-4 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleSlotClick(i)}
                >
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="size-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Tap to add</span>
                </button>
              )
            })}
          </div>

          {/* VS */}
          <div className="text-lg font-bold text-muted-foreground w-8 flex items-center justify-center">
            VS
          </div>

          {/* Team 2 */}
          <div className="space-y-2">
            {Array.from({ length: team1Size }).map((_, i) => {
              const slotIndex = team1Size + i
              const player = team2[i]
              return player ? (
                <button
                  key={player._id}
                  type="button"
                  className="flex w-full items-center gap-2 p-2.5 pr-4 rounded-xl bg-warm/50 cursor-pointer hover:bg-warm/70 transition-colors"
                  onClick={() => handleSlotClick(slotIndex)}
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
              ) : (
                <button
                  key={`empty-t2-${i}`}
                  type="button"
                  className="flex w-full items-center gap-2 p-2.5 pr-4 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleSlotClick(slotIndex)}
                >
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="size-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Tap to add</span>
                </button>
              )
            })}
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
          <div className="text-lg font-bold text-muted-foreground w-8 flex items-center justify-center">
            -
          </div>
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
}
```

**Step 5: Add Plus icon import**

Update imports at top of file:

```typescript
import { ArrowLeft, ArrowLeftRight, Check, Pencil, Plus, Trash2 } from 'lucide-react'
```

**Step 6: Conditionally render matchup card based on mode**

Replace the current matchup card section (around line 280-371) with:

```tsx
{/* Current Matchup */}
{gameDay?.mode === 'open_play' ? (
  <OpenPlayMatchupCard />
) : (
  matchup && matchup.team1.length > 0 && (
    // ... existing Auto Rotation card code ...
  )
)}
```

**Step 7: Hide "Sitting Out" section for Open Play**

Wrap the sitting out section with mode check:

```tsx
{/* Sitting Out - only show for Auto Rotation */}
{gameDay?.mode !== 'open_play' && matchup && matchup.sittingOut.length > 0 && (
  // ... existing sitting out code ...
)}
```

**Step 8: Add player picker drawer for Open Play**

Add before the closing `</div>` of the main container:

```tsx
{/* Open Play Player Picker Drawer */}
<Drawer open={playerPickerOpen} onOpenChange={setPlayerPickerOpen}>
  <DrawerContent>
    <div className="mx-auto w-full max-w-sm">
      <DrawerHeader>
        <DrawerTitle>Select Player</DrawerTitle>
      </DrawerHeader>
      <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
        {attendees
          .filter((p) => !selectedPlayers.some((sp) => sp?._id === p._id))
          .map((player) => (
            <PlayerCard
              key={player._id}
              player={player}
              onClick={() => handlePlayerSelect(player)}
            />
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
```

**Step 9: Reset Open Play state when mode changes**

Update the isDoubles effect to also reset Open Play state:

```typescript
useEffect(() => {
  if (attendees.length >= 2) {
    if (gameDay?.mode !== 'open_play') {
      const result = generateMatchup(attendees, games, isDoubles)
      setMatchup(result)
    }
    // Reset open play selection when switching modes
    setSelectedPlayers([])
  }
}, [isDoubles])
```

**Step 10: Test manually**

- Create an Open Play game day
- Verify empty slots appear with "Tap to add"
- Tap slots and select players
- Verify already-selected players don't appear in picker
- Submit a game and verify it resets to empty
- Verify scores and previous games work correctly

**Step 11: Commit**

```bash
git add src/routes/_authenticated/game-day/\$gameDayId.tsx
git commit -m "feat: add Open Play UI with tap-to-fill court"
```

---

## Task 5: Handle existing game days without mode field

**Files:**
- Modify: `convex/schema.ts:17-25`
- Modify: `src/routes/_authenticated/game-day/$gameDayId.tsx`

**Step 1: Make mode field optional in schema**

Update the schema to allow existing records:

```typescript
gameDays: defineTable({
  groupId: v.id("groups"),
  date: v.string(),
  attendeeIds: v.array(v.id("players")),
  isComplete: v.boolean(),
  mode: v.optional(v.union(v.literal("auto_rotation"), v.literal("open_play"))),
  createdAt: v.number(),
})
```

**Step 2: Default to auto_rotation in UI when mode is undefined**

In `$gameDayId.tsx`, update mode checks to handle undefined:

```typescript
// Replace: gameDay?.mode === 'open_play'
// With: gameDay?.mode === 'open_play'

// Replace: gameDay?.mode !== 'open_play'
// With: gameDay?.mode !== 'open_play'
```

The existing checks already handle this correctly since `undefined !== 'open_play'` is true.

**Step 3: Commit**

```bash
git add convex/schema.ts src/routes/_authenticated/game-day/\$gameDayId.tsx
git commit -m "feat: make mode field optional for backwards compatibility"
```

---

## Task 6: Final testing and cleanup

**Step 1: Test full flow**

1. Create Auto Rotation game day - verify existing behavior unchanged
2. Create Open Play game day - verify new tap-to-fill UI
3. Switch singles/doubles in both modes
4. Submit multiple games in both modes
5. Verify stats work correctly for both modes
6. Verify game day summary works for both modes

**Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in testing"
```
