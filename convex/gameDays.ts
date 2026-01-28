// convex/gameDays.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const gameDays = await ctx.db
      .query("gameDays")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();

    // Get game count for each day
    const gameDaysWithCount = await Promise.all(
      gameDays.map(async (gameDay) => {
        const games = await ctx.db
          .query("games")
          .withIndex("by_game_day", (q) => q.eq("gameDayId", gameDay._id))
          .collect();
        return {
          ...gameDay,
          gameCount: games.length,
        };
      })
    );

    return gameDaysWithCount;
  },
});

export const get = query({
  args: { id: v.id("gameDays") },
  handler: async (ctx, args) => {
    const gameDay = await ctx.db.get(args.id);
    if (!gameDay) return null;

    const group = await ctx.db.get(gameDay.groupId);
    const games = await ctx.db
      .query("games")
      .withIndex("by_game_day", (q) => q.eq("gameDayId", args.id))
      .order("asc")
      .collect();

    // Get attendee details
    const attendees = await Promise.all(
      gameDay.attendeeIds.map((id) => ctx.db.get(id))
    );

    return {
      ...gameDay,
      group,
      games,
      attendees: attendees.filter(Boolean),
    };
  },
});

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    date: v.string(),
    attendeeIds: v.array(v.id("players")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("gameDays", {
      groupId: args.groupId,
      date: args.date,
      attendeeIds: args.attendeeIds,
      isComplete: false,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateAttendees = mutation({
  args: {
    id: v.id("gameDays"),
    attendeeIds: v.array(v.id("players")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { attendeeIds: args.attendeeIds });
  },
});

export const complete = mutation({
  args: { id: v.id("gameDays") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isComplete: true });
  },
});

export const remove = mutation({
  args: { id: v.id("gameDays") },
  handler: async (ctx, args) => {
    // Delete all games first
    const games = await ctx.db
      .query("games")
      .withIndex("by_game_day", (q) => q.eq("gameDayId", args.id))
      .collect();
    for (const game of games) {
      await ctx.db.delete(game._id);
    }
    await ctx.db.delete(args.id);
  },
});
