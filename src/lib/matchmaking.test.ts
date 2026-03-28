import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { generateMatchup, swapPlayer } from './matchmaking'

// Helper to create mock players with minimal required fields
function makePlayer(name: string, id: string) {
  return {
    _id: id as Id<'players'>,
    _creationTime: Date.now(),
    groupId: 'group1' as Id<'groups'>,
    name,
    avatarUrl: '',
    createdAt: Date.now(),
  }
}

function makeGame(
  team1Ids: string[],
  team2Ids: string[],
  team1Score: number,
  team2Score: number,
  gameNumber: number,
) {
  return {
    _id: `game${gameNumber}` as Id<'games'>,
    _creationTime: Date.now(),
    gameDayId: 'gd1' as Id<'gameDays'>,
    team1Ids: team1Ids as Id<'players'>[],
    team2Ids: team2Ids as Id<'players'>[],
    team1Score,
    team2Score,
    gameNumber,
    createdAt: Date.now(),
  }
}

const alice = makePlayer('Alice', 'p1')
const bob = makePlayer('Bob', 'p2')
const charlie = makePlayer('Charlie', 'p3')
const diana = makePlayer('Diana', 'p4')
const eve = makePlayer('Eve', 'p5')
const frank = makePlayer('Frank', 'p6')

describe('swapPlayer', () => {
  it('swaps a team1 player with a sitting-out player', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve, frank],
    }

    const result = swapPlayer(matchup, alice._id, eve._id, [...matchup.team1, ...matchup.team2, ...matchup.sittingOut])

    expect(result.team1.map((p) => p._id)).toEqual([eve._id, bob._id])
    expect(result.team2.map((p) => p._id)).toEqual([charlie._id, diana._id])
    expect(result.sittingOut.map((p) => p._id)).toContain(alice._id)
    expect(result.sittingOut.map((p) => p._id)).not.toContain(eve._id)
  })

  it('swaps a team2 player with a sitting-out player', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve],
    }

    const result = swapPlayer(matchup, diana._id, eve._id, [...matchup.team1, ...matchup.team2, ...matchup.sittingOut])

    expect(result.team1.map((p) => p._id)).toEqual([alice._id, bob._id])
    expect(result.team2.map((p) => p._id)).toEqual([charlie._id, eve._id])
    expect(result.sittingOut.map((p) => p._id)).toEqual([diana._id])
  })

  it('does not change other player positions', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve, frank],
    }

    const result = swapPlayer(matchup, bob._id, frank._id, [alice, bob, charlie, diana, eve, frank])

    // Alice stays in team1 position 0
    expect(result.team1[0]._id).toBe(alice._id)
    // Frank takes Bob's exact spot (team1 position 1)
    expect(result.team1[1]._id).toBe(frank._id)
    // Team2 is completely unchanged
    expect(result.team2[0]._id).toBe(charlie._id)
    expect(result.team2[1]._id).toBe(diana._id)
    // Sitting out: Eve stays, Bob joins, Frank leaves
    expect(result.sittingOut.map((p) => p._id)).toContain(eve._id)
    expect(result.sittingOut.map((p) => p._id)).toContain(bob._id)
    expect(result.sittingOut.map((p) => p._id)).not.toContain(frank._id)
  })

  it('returns unchanged matchup when playerOut is not playing', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve],
    }

    const result = swapPlayer(matchup, frank._id, eve._id, [alice, bob, charlie, diana, eve, frank])

    expect(result).toBe(matchup)
  })

  it('returns unchanged matchup when playerIn is not in attendees', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve],
    }

    const result = swapPlayer(matchup, alice._id, frank._id, [alice, bob, charlie, diana, eve])

    expect(result).toBe(matchup)
  })

  it('preserves exact team composition for the non-swapped team', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve, frank],
    }

    const result = swapPlayer(matchup, alice._id, eve._id, [alice, bob, charlie, diana, eve, frank])

    // Team2 must be identical — same players, same order
    expect(result.team2).toEqual(matchup.team2)
  })

  it('works with singles (1v1) swap', () => {
    const matchup = {
      team1: [alice],
      team2: [bob],
      sittingOut: [charlie],
    }

    const result = swapPlayer(matchup, alice._id, charlie._id, [alice, bob, charlie])

    expect(result.team1.map((p) => p._id)).toEqual([charlie._id])
    expect(result.team2.map((p) => p._id)).toEqual([bob._id])
    expect(result.sittingOut.map((p) => p._id)).toEqual([alice._id])
  })

  it('handles multiple sitting-out players correctly', () => {
    const matchup = {
      team1: [alice, bob],
      team2: [charlie, diana],
      sittingOut: [eve, frank],
    }

    const result = swapPlayer(matchup, charlie._id, eve._id, [alice, bob, charlie, diana, eve, frank])

    // Only eve leaves sitting out, charlie joins
    expect(result.sittingOut).toHaveLength(2)
    expect(result.sittingOut.map((p) => p._id)).toContain(frank._id)
    expect(result.sittingOut.map((p) => p._id)).toContain(charlie._id)
  })
})

describe('generateMatchup', () => {
  it('assigns all players when exactly enough for doubles', () => {
    const result = generateMatchup([alice, bob, charlie, diana], [], true)

    expect(result.team1).toHaveLength(2)
    expect(result.team2).toHaveLength(2)
    expect(result.sittingOut).toHaveLength(0)
  })

  it('assigns all players when exactly enough for singles', () => {
    const result = generateMatchup([alice, bob], [], false)

    expect(result.team1).toHaveLength(1)
    expect(result.team2).toHaveLength(1)
    expect(result.sittingOut).toHaveLength(0)
  })

  it('sits out extra players in doubles', () => {
    const result = generateMatchup([alice, bob, charlie, diana, eve], [], true)

    expect(result.team1).toHaveLength(2)
    expect(result.team2).toHaveLength(2)
    expect(result.sittingOut).toHaveLength(1)
  })

  it('returns empty teams when not enough players', () => {
    const result = generateMatchup([alice], [], true)

    expect(result.team1).toHaveLength(0)
    expect(result.team2).toHaveLength(0)
    expect(result.sittingOut).toEqual([alice])
  })

  it('falls back to singles when 2-3 players in doubles mode', () => {
    const result = generateMatchup([alice, bob, charlie], [], true)

    expect(result.team1).toHaveLength(1)
    expect(result.team2).toHaveLength(1)
    expect(result.sittingOut).toHaveLength(1)
  })

  it('respects locked players — locked player is always on court', () => {
    const players = [alice, bob, charlie, diana, eve]

    const result = generateMatchup(players, [], true, [eve._id])

    const playing = [...result.team1, ...result.team2]
    expect(playing.some((p) => p._id === eve._id)).toBe(true)
  })

  it('avoids repeating partnerships from last game', () => {
    const lastGame = makeGame(['p1', 'p2'], ['p3', 'p4'], 11, 9, 1)
    const players = [alice, bob, charlie, diana]

    // Run multiple times to check it avoids the same pairing
    let samePartnershipCount = 0
    for (let i = 0; i < 10; i++) {
      const result = generateMatchup(players, [lastGame], true)
      const team1Ids = result.team1.map((p) => p._id).sort()
      const lastTeam1 = ['p1', 'p2'].sort()
      const lastTeam2 = ['p3', 'p4'].sort()

      if (
        (team1Ids[0] === lastTeam1[0] && team1Ids[1] === lastTeam1[1]) ||
        (team1Ids[0] === lastTeam2[0] && team1Ids[1] === lastTeam2[1])
      ) {
        samePartnershipCount++
      }
    }

    // The algorithm heavily penalizes (-50) repeating same partnerships,
    // so with only 4 players it should always pick different pairings
    expect(samePartnershipCount).toBe(0)
  })
})
