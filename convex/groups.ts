// convex/groups.ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query('groups').collect()

    // Get player count and last game day for each group
    const groupsWithStats = await Promise.all(
      groups.map(async (group) => {
        const players = await ctx.db
          .query('players')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .collect()

        const gameDays = await ctx.db
          .query('gameDays')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .order('desc')
          .take(1)

        return {
          ...group,
          playerCount: players.length,
          players: players.map((p) => ({ _id: p._id, name: p.name, avatarUrl: p.avatarUrl })),
          lastGameDay: gameDays[0]?.date ?? null,
        }
      }),
    )

    return groupsWithStats
  },
})

export const get = query({
  args: { id: v.id('groups') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('groups', {
      name: args.name,
      createdAt: Date.now(),
    })
    return id
  },
})

export const remove = mutation({
  args: { id: v.id('groups') },
  handler: async (ctx, args) => {
    // Delete all players in the group
    const players = await ctx.db
      .query('players')
      .withIndex('by_group', (q) => q.eq('groupId', args.id))
      .collect()
    for (const player of players) {
      await ctx.db.delete(player._id)
    }

    // Delete all game days and games in the group
    const gameDays = await ctx.db
      .query('gameDays')
      .withIndex('by_group', (q) => q.eq('groupId', args.id))
      .collect()
    for (const gameDay of gameDays) {
      const games = await ctx.db
        .query('games')
        .withIndex('by_game_day', (q) => q.eq('gameDayId', gameDay._id))
        .collect()
      for (const game of games) {
        await ctx.db.delete(game._id)
      }
      await ctx.db.delete(gameDay._id)
    }

    await ctx.db.delete(args.id)
  },
})
