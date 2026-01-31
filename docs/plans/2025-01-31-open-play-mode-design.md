# Open Play Mode Design

## Overview

Add a second game day mode called "Open Play" for casual sessions where players just log games as they happen, without algorithmic matchmaking.

## Mode Names

- **Auto Rotation**: Algorithm picks balanced matchups (current behavior)
- **Open Play**: Log games freely as they happen

## Data Model

Add `mode` field to `gameDays` table:

```typescript
mode: v.union(v.literal("auto_rotation"), v.literal("open_play"))
```

Default: `"auto_rotation"` (preserves current behavior)

No changes to `games` table - games recorded identically regardless of mode.

## Game Day Creation Flow

1. **Step 1 - Date**: Select date (unchanged)
2. **Step 2 - Attendees**: Select who's playing (unchanged)
3. **Step 3 - Mode** (new): Choose between Auto Rotation and Open Play
4. Tap "Start" → navigate to game day page

Default selection: Auto Rotation.

## Open Play Experience

### Court Area
- Reuses existing court visualization
- All player slots start empty with "Tap to add" placeholder
- Tapping a slot opens player picker (attendee list)
- Already-selected players disabled in picker
- Singles/Doubles toggle works the same

### Score Entry
- Same score input as Auto Rotation
- Submit disabled until all slots filled and scores entered

### After Submitting
- Court resets to empty (all slots cleared)
- Scores reset to 0
- Ready for next game immediately

### Games List
- Same "Previous Games" section below court
- Edit/delete functionality unchanged

## What Stays the Same

- Auto Rotation mode: completely unchanged
- Attendee management during game day
- Game editing and deletion
- "Complete Game Day" action
- Game Day Summary page
- Stats calculations and leaderboards (all games count equally)
- Singles/Doubles toggle

## Files to Modify

1. `convex/schema.ts` - Add mode field
2. `convex/gameDays.ts` - Accept mode in create, return in get
3. `src/routes/_authenticated/groups/$groupId.tsx` - Add mode selection step
4. `src/routes/_authenticated/game-day/$gameDayId.tsx` - Conditional rendering based on mode
