// src/lib/matchmaking.ts
import type { Doc, Id } from '../../convex/_generated/dataModel'

type Player = Doc<'players'>
type Game = Doc<'games'>

interface MatchupResult {
  team1: Player[]
  team2: Player[]
  sittingOut: Player[]
}

interface GameHistory {
  partnerships: Map<string, number> // "id1-id2" -> count
  matchups: Map<string, number> // "id1-id2" -> count
  gamesPlayed: Map<Id<'players'>, number>
  consecutiveSitouts: Map<Id<'players'>, number>
}

function getPairKey(id1: Id<'players'>, id2: Id<'players'>): string {
  return [id1, id2].sort().join('-')
}

function buildGameHistory(games: Game[]): GameHistory {
  const partnerships = new Map<string, number>()
  const matchups = new Map<string, number>()
  const gamesPlayed = new Map<Id<'players'>, number>()

  for (const game of games) {
    // Track partnerships (teammates)
    if (game.team1Ids.length === 2) {
      const key = getPairKey(game.team1Ids[0], game.team1Ids[1])
      partnerships.set(key, (partnerships.get(key) ?? 0) + 1)
    }
    if (game.team2Ids.length === 2) {
      const key = getPairKey(game.team2Ids[0], game.team2Ids[1])
      partnerships.set(key, (partnerships.get(key) ?? 0) + 1)
    }

    // Track matchups (opponents)
    for (const p1 of game.team1Ids) {
      for (const p2 of game.team2Ids) {
        const key = getPairKey(p1, p2)
        matchups.set(key, (matchups.get(key) ?? 0) + 1)
      }
    }

    // Track games played
    for (const id of [...game.team1Ids, ...game.team2Ids]) {
      gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1)
    }
  }

  return {
    partnerships,
    matchups,
    gamesPlayed,
    consecutiveSitouts: new Map(),
  }
}

function updateSitoutTracking(history: GameHistory, playing: Player[], sittingOut: Player[]): void {
  const playingIds = new Set(playing.map((p) => p._id))

  for (const player of sittingOut) {
    const current = history.consecutiveSitouts.get(player._id) ?? 0
    history.consecutiveSitouts.set(player._id, current + 1)
  }

  for (const player of playing) {
    history.consecutiveSitouts.set(player._id, 0)
  }
}

function scoreMatchup(team1: Player[], team2: Player[], history: GameHistory): number {
  let score = 0

  // Penalize repeated partnerships (doubles only)
  if (team1.length === 2) {
    const key = getPairKey(team1[0]._id, team1[1]._id)
    const count = history.partnerships.get(key) ?? 0
    score -= count * 5
  }
  if (team2.length === 2) {
    const key = getPairKey(team2[0]._id, team2[1]._id)
    const count = history.partnerships.get(key) ?? 0
    score -= count * 5
  }

  // Penalize repeated matchups
  for (const p1 of team1) {
    for (const p2 of team2) {
      const key = getPairKey(p1._id, p2._id)
      const count = history.matchups.get(key) ?? 0
      score -= count * 3
    }
  }

  // Small penalty for players who have played more
  for (const player of [...team1, ...team2]) {
    const played = history.gamesPlayed.get(player._id) ?? 0
    score -= played * 1
  }

  // Bonus for players who have sat out
  for (const player of [...team1, ...team2]) {
    const sitouts = history.consecutiveSitouts.get(player._id) ?? 0
    score += sitouts * 2
  }

  return score
}

function* combinations<T>(arr: T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield []
    return
  }
  if (arr.length < size) return

  const [first, ...rest] = arr
  for (const combo of combinations(rest, size - 1)) {
    yield [first, ...combo]
  }
  for (const combo of combinations(rest, size)) {
    yield combo
  }
}

export function generateMatchup(
  attendees: Player[],
  games: Game[],
  isDoubles: boolean,
  lockedPlayers: Id<'players'>[] = [],
): MatchupResult {
  const history = buildGameHistory(games)

  // Update consecutive sitouts based on last game
  if (games.length > 0) {
    const lastGame = games[games.length - 1]
    const lastPlaying = [...lastGame.team1Ids, ...lastGame.team2Ids]
    const lastSittingOut = attendees.filter((p) => !lastPlaying.includes(p._id))
    updateSitoutTracking(
      history,
      attendees.filter((p) => lastPlaying.includes(p._id)),
      lastSittingOut,
    )
  }

  const playersNeeded = isDoubles ? 4 : 2

  // Not enough players
  if (attendees.length < playersNeeded) {
    if (attendees.length >= 2) {
      // Fall back to singles
      return generateMatchup(attendees, games, false, lockedPlayers)
    }
    return { team1: [], team2: [], sittingOut: attendees }
  }

  // Find locked players
  const locked = attendees.filter((p) => lockedPlayers.includes(p._id))
  const unlocked = attendees.filter((p) => !lockedPlayers.includes(p._id))

  let bestMatchup: MatchupResult = {
    team1: [],
    team2: [],
    sittingOut: attendees,
  }
  let bestScore = Number.NEGATIVE_INFINITY

  // Generate all possible player selections
  const neededFromUnlocked = playersNeeded - locked.length

  if (neededFromUnlocked > unlocked.length) {
    // Not enough unlocked players
    return { team1: [], team2: [], sittingOut: attendees }
  }

  for (const selectedUnlocked of combinations(unlocked, neededFromUnlocked)) {
    const selectedPlayers = [...locked, ...selectedUnlocked]
    const sittingOut = attendees.filter((p) => !selectedPlayers.some((s) => s._id === p._id))

    // Generate all team splits
    const teamSize = isDoubles ? 2 : 1
    for (const team1 of combinations(selectedPlayers, teamSize)) {
      const team2 = selectedPlayers.filter((p) => !team1.some((t) => t._id === p._id))

      const score = scoreMatchup(team1, team2, history)
      if (score > bestScore) {
        bestScore = score
        bestMatchup = { team1, team2, sittingOut }
      }
    }
  }

  return bestMatchup
}

export function swapPlayer(
  currentMatchup: MatchupResult,
  playerOut: Id<'players'>,
  playerIn: Id<'players'>,
  attendees: Player[],
  games: Game[],
  isDoubles: boolean,
): MatchupResult {
  // Find which team the player is in
  const inTeam1 = currentMatchup.team1.some((p) => p._id === playerOut)
  const inTeam2 = currentMatchup.team2.some((p) => p._id === playerOut)

  if (!inTeam1 && !inTeam2) {
    return currentMatchup
  }

  // Get the player coming in
  const newPlayer = attendees.find((p) => p._id === playerIn)
  if (!newPlayer) return currentMatchup

  // Create new teams with the swap
  const newTeam1 = currentMatchup.team1.map((p) => (p._id === playerOut ? newPlayer : p))
  const newTeam2 = currentMatchup.team2.map((p) => (p._id === playerOut ? newPlayer : p))

  // Update sitting out
  const oldPlayer = attendees.find((p) => p._id === playerOut)
  const newSittingOut = currentMatchup.sittingOut.filter((p) => p._id !== playerIn).concat(oldPlayer ? [oldPlayer] : [])

  // Lock the swapped-in player and recalculate best arrangement
  const lockedPlayers = [playerIn]
  const allPlaying = [...newTeam1, ...newTeam2]

  return generateMatchup([...allPlaying, ...newSittingOut], games, isDoubles, lockedPlayers)
}
