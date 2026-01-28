// convex/games.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByGameDay = query({
  args: { gameDayId: v.id("gameDays") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_game_day", (q) => q.eq("gameDayId", args.gameDayId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    gameDayId: v.id("gameDays"),
    team1Ids: v.array(v.id("players")),
    team2Ids: v.array(v.id("players")),
    team1Score: v.number(),
    team2Score: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current game count to determine game number
    const existingGames = await ctx.db
      .query("games")
      .withIndex("by_game_day", (q) => q.eq("gameDayId", args.gameDayId))
      .collect();

    const id = await ctx.db.insert("games", {
      gameDayId: args.gameDayId,
      team1Ids: args.team1Ids,
      team2Ids: args.team2Ids,
      team1Score: args.team1Score,
      team2Score: args.team2Score,
      gameNumber: existingGames.length + 1,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("games") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("games"),
    team1Score: v.number(),
    team2Score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      team1Score: args.team1Score,
      team2Score: args.team2Score,
    });
  },
});

// Stats query for leaderboard
export const getStats = query({
  args: {
    groupId: v.id("groups"),
    period: v.union(
      v.object({ type: v.literal("date"), date: v.string() }),
      v.object({ type: v.literal("days"), days: v.number() }),
      v.object({ type: v.literal("month"), year: v.number(), month: v.number() }),
      v.object({ type: v.literal("all") })
    ),
  },
  handler: async (ctx, args) => {
    // Get all game days for this group
    const allGameDays = await ctx.db
      .query("gameDays")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Filter by period
    const today = new Date();
    const filteredGameDays = allGameDays.filter((gd) => {
      const gdDate = new Date(gd.date);

      switch (args.period.type) {
        case "date":
          return gd.date === args.period.date;
        case "days": {
          const daysAgo = new Date(today);
          daysAgo.setDate(daysAgo.getDate() - args.period.days + 1);
          daysAgo.setHours(0, 0, 0, 0);
          return gdDate >= daysAgo;
        }
        case "month":
          return (
            gdDate.getFullYear() === args.period.year &&
            gdDate.getMonth() + 1 === args.period.month
          );
        case "all":
          return true;
      }
    });

    // Get all games for filtered game days
    const allGames = await Promise.all(
      filteredGameDays.map((gd) =>
        ctx.db
          .query("games")
          .withIndex("by_game_day", (q) => q.eq("gameDayId", gd._id))
          .collect()
      )
    );
    const games = allGames.flat();

    // Get all players in the group
    const players = await ctx.db
      .query("players")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Calculate stats for each player
    const stats = players.map((player) => {
      let wins = 0;
      let losses = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      for (const game of games) {
        const inTeam1 = game.team1Ids.includes(player._id);
        const inTeam2 = game.team2Ids.includes(player._id);

        if (!inTeam1 && !inTeam2) continue;

        if (inTeam1) {
          pointsFor += game.team1Score;
          pointsAgainst += game.team2Score;
          if (game.team1Score > game.team2Score) wins++;
          else losses++;
        } else {
          pointsFor += game.team2Score;
          pointsAgainst += game.team1Score;
          if (game.team2Score > game.team1Score) wins++;
          else losses++;
        }
      }

      const gamesPlayed = wins + losses;
      const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
      const plusMinus = pointsFor - pointsAgainst;

      return {
        player,
        wins,
        losses,
        gamesPlayed,
        winPercentage,
        plusMinus,
      };
    });

    // Sort by win percentage descending (default)
    return stats
      .filter((s) => s.gamesPlayed > 0)
      .sort((a, b) => b.winPercentage - a.winPercentage);
  },
});

// Stats for a specific game day (for summary)
export const getGameDayStats = query({
  args: { gameDayId: v.id("gameDays") },
  handler: async (ctx, args) => {
    const gameDay = await ctx.db.get(args.gameDayId);
    if (!gameDay) return null;

    const games = await ctx.db
      .query("games")
      .withIndex("by_game_day", (q) => q.eq("gameDayId", args.gameDayId))
      .collect();

    const group = await ctx.db.get(gameDay.groupId);

    // Get attendee details
    const attendees = await Promise.all(
      gameDay.attendeeIds.map((id) => ctx.db.get(id))
    );
    const players = attendees.filter(Boolean);

    // Calculate stats for each player
    const stats = players.map((player) => {
      if (!player) return null;

      let wins = 0;
      let losses = 0;

      for (const game of games) {
        const inTeam1 = game.team1Ids.includes(player._id);
        const inTeam2 = game.team2Ids.includes(player._id);

        if (!inTeam1 && !inTeam2) continue;

        if (inTeam1) {
          if (game.team1Score > game.team2Score) wins++;
          else losses++;
        } else {
          if (game.team2Score > game.team1Score) wins++;
          else losses++;
        }
      }

      const gamesPlayed = wins + losses;
      const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;

      return {
        player,
        wins,
        losses,
        gamesPlayed,
        winPercentage,
      };
    });

    const validStats = stats.filter(Boolean).filter((s) => s!.gamesPlayed > 0);
    validStats.sort((a, b) => b!.winPercentage - a!.winPercentage);

    // Find MVP (highest win % with min 2 games)
    const mvpCandidates = validStats.filter((s) => s!.gamesPlayed >= 2);
    const mvp = mvpCandidates[0] ?? null;

    return {
      gameDay,
      group,
      games,
      stats: validStats,
      mvp,
      totalGames: games.length,
    };
  },
});
