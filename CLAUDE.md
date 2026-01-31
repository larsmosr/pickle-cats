# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pickle Cats is a pickleball game management and matchmaking web application. It tracks players, organizes game days, creates balanced matchups, and records game results with rankings.

## Tech Stack

- **Frontend**: TanStack Start (React 19 meta-framework), TanStack Router (file-based routing), Tailwind CSS 4, shadcn/ui
- **Backend**: Convex (serverless real-time database)
- **Build**: Vite, Bun
- **Code Quality**: Biome (linting/formatting), Vitest (testing), TypeScript strict mode

## Development Commands

```bash
bun run dev          # Start dev server on port 3003
bun run build        # Production build
bun run test         # Run Vitest tests
bun run check        # Biome lint + format (with auto-fix)
npx convex dev       # Run Convex backend locally (separate terminal)
```

For single test file: `bunx vitest run path/to/test.ts`

## Architecture

### Directory Structure
- `src/routes/` - TanStack Router file-based routes. Dynamic segments use `$` prefix (e.g., `$gameDayId.tsx`)
- `src/routes/_authenticated/` - Protected routes wrapped by auth guard
- `src/components/ui/` - shadcn/ui components
- `src/lib/` - Utilities: `matchmaking.ts` (game algorithm), `auth.ts`, `cat-avatars.ts`
- `convex/` - Backend functions (queries/mutations) and schema

### Data Flow
1. **Routes** define pages and use `useSuspenseQuery` with Convex queries
2. **Convex functions** in `convex/*.ts` handle database operations
3. **React Query + Convex adapter** manages caching and real-time sync

### Key Patterns
- Path alias: `@/` maps to `src/`
- Authentication: Password-based with localStorage session, route guards via `beforeLoad`
- Convex queries/mutations use typed validators for arguments

### Game Day Modes
- **auto_rotation**: Automatic matchmaking with balanced teams
- **open_play**: Manual court assignment with tap-to-fill interface

## Matchmaking Algorithm (src/lib/matchmaking.ts)

The algorithm balances:
- Player rotation (track consecutive sit-outs)
- Partnership variety (avoid repeated pairings)
- Team skill balance (uses Bayesian-averaged win rates)
- Matchup history

## Code Style

Biome enforces: single quotes, no semicolons, 120 char line width, trailing commas.

### Semantic Commit Messages
See how a minor change to your commit message style can make you a better programmer.

Format: <type>(<scope>): <subject>

<scope> is optional

Examples:
feat: (new feature for the user, not a new feature for build script)
fix: (bug fix for the user, not a fix to a build script)
docs: (changes to the documentation)
style: (formatting, missing semi colons, etc; no production code change)
refactor: (refactoring production code, eg. renaming a variable)
test: (adding missing tests, refactoring tests; no production code change)
chore: (updating grunt tasks etc; no production code change)

Never add anything like/similar to Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
