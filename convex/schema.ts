import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  groups: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  players: defineTable({
    groupId: v.id("groups"),
    name: v.string(),
    avatarUrl: v.string(),
    createdAt: v.number(),
  }).index("by_group", ["groupId"]),

  gameDays: defineTable({
    groupId: v.id("groups"),
    date: v.string(),
    attendeeIds: v.array(v.id("players")),
    isComplete: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_and_date", ["groupId", "date"]),

  games: defineTable({
    gameDayId: v.id("gameDays"),
    team1Ids: v.array(v.id("players")),
    team2Ids: v.array(v.id("players")),
    team1Score: v.number(),
    team2Score: v.number(),
    gameNumber: v.number(),
    createdAt: v.number(),
  }).index("by_game_day", ["gameDayId"]),
});
