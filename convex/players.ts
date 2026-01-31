// convex/players.ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const listByGroup = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('players')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .collect()
  },
})

export const get = query({
  args: { id: v.id('players') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    groupId: v.id('groups'),
    name: v.string(),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('players', {
      groupId: args.groupId,
      name: args.name,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    })
    return id
  },
})

export const remove = mutation({
  args: { id: v.id('players') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

export const update = mutation({
  args: {
    id: v.id('players'),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: { name?: string; avatarUrl?: string } = {}
    if (args.name !== undefined) updates.name = args.name
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl
    await ctx.db.patch(args.id, updates)
  },
})
