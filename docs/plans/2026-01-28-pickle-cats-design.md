# Pickle Cats - Pickleball Group Manager

A mobile-first web app for managing pickleball groups, tracking games, and viewing stats.

## Overview

Single-password app containing multiple playing groups. Each group has players (with cat avatars), game days, and statistics. The app handles matchmaking to ensure variety in partner/opponent combinations and generates shareable game day summaries.

---

## Data Model

### Tables (Convex)

**`groups`**
| Field | Type | Description |
|-------|------|-------------|
| name | string | Group name (e.g., "Tuesday Crew") |
| createdAt | number | Timestamp |

**`players`**
| Field | Type | Description |
|-------|------|-------------|
| groupId | Id<"groups"> | Parent group |
| name | string | Player name |
| avatarUrl | string | Cat image URL from thecatapi.com |
| createdAt | number | Timestamp |

**`gameDays`**
| Field | Type | Description |
|-------|------|-------------|
| groupId | Id<"groups"> | Parent group |
| date | string | ISO date string (YYYY-MM-DD) |
| attendeeIds | Id<"players">[] | Players who showed up |
| isComplete | boolean | Whether day is finished |
| createdAt | number | Timestamp |

**`games`**
| Field | Type | Description |
|-------|------|-------------|
| gameDayId | Id<"gameDays"> | Parent game day |
| team1Ids | Id<"players">[] | Team 1 player(s) - 1 or 2 |
| team2Ids | Id<"players">[] | Team 2 player(s) - 1 or 2 |
| team1Score | number | Team 1 final score |
| team2Score | number | Team 2 final score |
| gameNumber | number | Order within the day |
| createdAt | number | Timestamp |

### Authentication

- Single password stored as Convex environment variable
- On correct password, generate session token (random string)
- Store token in localStorage
- Convex mutations/queries don't require auth (password protects app entry only)

---

## App Flow

### Screen: Login (`/`)
- Password input field
- Submit button
- On correct password → store session token → redirect to `/groups`
- On incorrect → show error, stay on page

### Screen: Groups List (`/groups`)
- Header: "Pickle Cats" with cat logo
- List of group cards showing:
  - Group name
  - Player count
  - Last game day date
- Tap group → navigate to group hub
- Bottom: "Create Group" button → opens drawer with name input

### Screen: Group Hub (`/groups/$groupId`)
- Header: Group name with back button
- Three tabs:

**Tab 1: Players**
- Grid of player cards (avatar + name)
- Tap player → options to remove
- "Add Player" button → drawer with:
  - Name input
  - Cat avatar (auto-fetched from thecatapi.com)
  - "New Cat" button to regenerate avatar
  - Save button

**Tab 2: Game Days**
- List of past game days showing:
  - Date
  - Games played count
  - "Complete" badge if finished
- Tap game day → view summary (if complete) or resume (if active)
- "New Game Day" button → date picker (defaults to today) → select attendees → start

**Tab 3: Stats**
- Period selector:
  - Date picker (defaults to today) for single-day view
  - "7 Days" - last 7 days rolling
  - "Month" - current calendar month
  - "All-Time" - everything
- Leaderboard table:
  - Columns: Rank, Player (avatar + name), Win %, Wins, Losses, Games, +/-
  - Tap column header to sort by that column
  - Default sort: Win % descending

### Screen: Attendee Selection (modal/drawer)
- Shown when starting new game day
- List of all group players with checkboxes
- Each row: checkbox, avatar, name
- "Start Game Day" button (disabled if < 2 selected)

### Screen: Active Game Day (`/game-day/$gameDayId`)
- Header: Date with back button
- Mode toggle: Singles (1v1) / Doubles (2v2) - defaults to Doubles

**Current Matchup Section:**
- Two sides showing teams:
  - Each player shown as card with avatar + name
  - For doubles: two player cards stacked per side
- "Swap" button on each player → opens player picker to swap with sitting-out or other player
- Swapping a player automatically recalculates the optimal matchup

**Score Entry:**
- Two large score inputs (one per team)
- "Submit Game" button
- Validates both scores are entered

**Sitting Out Section (if > 4 players for doubles, > 2 for singles):**
- Shows players currently sitting out with avatars + names
- Indicates who has sat out longest

**Completed Games List:**
- Scrollable list below
- Each game shows: Game #, Team 1 vs Team 2 with scores, winner highlighted

**Finish Day Button:**
- Fixed at bottom
- Tap → navigate to summary screen

### Screen: Game Day Summary (`/game-day/$gameDayId/summary`)
- Header: "Game Day Summary" with date
- Stats card showing:
  - Total games played
  - MVP (highest win % with min 2 games)
  - Leaderboard for the day
- "Download Image" button:
  - Generates styled image with:
    - "Pickle Cats" branding
    - Group name + date
    - Game count
    - Top 5 players with avatar, name, record
    - Cat-themed decorations
  - Downloads as PNG
- "Done" button → back to group hub

---

## Matchmaking Algorithm

### Goal
Maximize variety in partner/opponent combinations while keeping games played roughly balanced.

### Algorithm

For each new game:

1. **Identify available players** - attendees minus any manually swapped out

2. **Generate all valid team combinations**
   - For doubles: all ways to pick 4 players and split into 2 pairs
   - For singles: all ways to pick 2 players

3. **Score each combination** (higher = better):
   ```
   score = 0

   // Penalize repeated partnerships (doubles only)
   for each pair on same team:
     if they partnered before today: score -= 10
     score -= (times_partnered_today * 5)

   // Penalize repeated matchups
   for each cross-team pair:
     if they faced each other before today: score -= 5
     score -= (times_faced_today * 3)

   // Small balance factor
   for each player in matchup:
     score -= (games_played_today * 1)

   // Prioritize players who sat out
   for each player in matchup:
     score += (consecutive_games_sat_out * 2)
   ```

4. **Select highest scoring combination**

5. **On manual swap:**
   - Lock the swapped-in player
   - Recalculate optimal remaining positions
   - Update display automatically

### Edge Cases
- 2 players: 1v1 only
- 3 players: 1v1 with rotation
- 4 players: standard 2v2
- 5+ players: 2v2 with sitting out rotation

---

## Stats Calculations

### Queries by Period
- **Specific date**: games where gameDay.date = selected date
- **Last 7 days**: games where gameDay.date >= (today - 6 days)
- **This month**: games where gameDay.date starts with current YYYY-MM
- **All-time**: all games in group

### Player Stats
For each player in period:
- **Games**: count of games where player in team1Ids or team2Ids
- **Wins**: games where player's team had higher score
- **Losses**: games - wins
- **Win %**: (wins / games) * 100, or 0 if no games
- **+/-**: sum of (player's team score - opponent score) across all games

---

## Technical Implementation

### File Structure
```
src/
  routes/
    index.tsx                    # Login
    _authenticated.tsx           # Auth layout wrapper
    _authenticated/
      groups/
        index.tsx                # Groups list
        $groupId.tsx             # Group hub with tabs
      game-day/
        $gameDayId.tsx           # Active game day
        $gameDayId.summary.tsx   # Game day summary

  components/
    player-card.tsx              # Avatar + name display
    player-picker.tsx            # Select player (for swaps)
    score-input.tsx              # Large score number input
    matchup-display.tsx          # Current game matchup
    leaderboard.tsx              # Stats table
    summary-image.tsx            # Canvas-rendered summary for download

  lib/
    matchmaking.ts               # Algorithm implementation
    auth.ts                      # Session token management
    image-generator.ts           # html-to-canvas wrapper

convex/
  schema.ts                      # Table definitions
  auth.ts                        # checkPassword mutation
  groups.ts                      # CRUD
  players.ts                     # CRUD + cat API fetch
  gameDays.ts                    # CRUD + attendee management
  games.ts                       # CRUD + stats queries
```

### Key Dependencies (already installed)
- `convex` - Real-time database
- `@tanstack/react-router` - File-based routing
- `shadcn/ui` components - UI building blocks
- `date-fns` - Date manipulation
- `lucide-react` - Icons
- `next-themes` - Dark mode

### Additional Dependencies Needed
- `html-to-image` - Generate downloadable summary images

### Mobile-First Considerations
- Viewport meta tag for proper mobile scaling
- Touch-friendly targets (min 48px)
- Bottom-anchored primary actions
- Swipe gestures for tab navigation (optional enhancement)
- PWA manifest for "Add to Home Screen" capability

---

## Summary Image Design

The downloadable image for WhatsApp should include:

```
┌─────────────────────────────────┐
│     🐱 PICKLE CATS 🐱           │
│     Tuesday Crew                │
│     January 28, 2026            │
├─────────────────────────────────┤
│     8 Games Played              │
│     ⭐ MVP: Sarah (4-1)         │
├─────────────────────────────────┤
│  1. 🐱 Sarah    4-1  80%       │
│  2. 🐱 Mike     3-2  60%       │
│  3. 🐱 Alex     3-2  60%       │
│  4. 🐱 Jordan   2-3  40%       │
│  5. 🐱 Chris    1-4  20%       │
└─────────────────────────────────┘
```

- Rendered at 2x resolution for crisp sharing
- Cat avatars included inline if possible
- Branded colors matching app theme
