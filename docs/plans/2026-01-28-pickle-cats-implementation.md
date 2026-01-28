# Pickle Cats Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first pickleball group management app with matchmaking, game tracking, and shareable stats.

**Architecture:** TanStack Router for navigation with authenticated routes, Convex for real-time database, shadcn/ui for components. Client-side matchmaking algorithm. html-to-image for generating shareable summaries.

**Tech Stack:** React 19, TanStack Router, Convex, shadcn/ui (base-ui), Tailwind CSS 4, date-fns, html-to-image

---

## Task 1: Convex Schema Setup

**Files:**
- Create: `convex/schema.ts`

**Step 1: Create the Convex schema with all tables**

```typescript
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
```

**Step 2: Run Convex dev to generate types**

Run: `bunx convex dev`
Expected: Schema pushed, types regenerated in `convex/_generated/`

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add Convex schema for groups, players, game days, and games"
```

---

## Task 2: Authentication Setup

**Files:**
- Create: `convex/auth.ts`
- Create: `src/lib/auth.ts`

**Step 1: Create Convex auth mutation**

```typescript
// convex/auth.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const checkPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    const correctPassword = process.env.APP_PASSWORD;
    if (!correctPassword) {
      throw new Error("APP_PASSWORD environment variable not set");
    }
    if (args.password !== correctPassword) {
      return { success: false, token: null };
    }
    // Generate a simple session token
    const token = crypto.randomUUID();
    return { success: true, token };
  },
});
```

**Step 2: Create client-side auth utilities**

```typescript
// src/lib/auth.ts
const AUTH_TOKEN_KEY = "pickle-cats-auth-token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
```

**Step 3: Set environment variable in Convex**

Run: `bunx convex env set APP_PASSWORD "your-password-here"`
Expected: Environment variable set successfully

**Step 4: Commit**

```bash
git add convex/auth.ts src/lib/auth.ts
git commit -m "feat: add password authentication with session tokens"
```

---

## Task 3: Groups CRUD

**Files:**
- Create: `convex/groups.ts`

**Step 1: Create groups queries and mutations**

```typescript
// convex/groups.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();

    // Get player count and last game day for each group
    const groupsWithStats = await Promise.all(
      groups.map(async (group) => {
        const players = await ctx.db
          .query("players")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        const gameDays = await ctx.db
          .query("gameDays")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .order("desc")
          .take(1);

        return {
          ...group,
          playerCount: players.length,
          lastGameDay: gameDays[0]?.date ?? null,
        };
      })
    );

    return groupsWithStats;
  },
});

export const get = query({
  args: { id: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("groups", {
      name: args.name,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("groups") },
  handler: async (ctx, args) => {
    // Delete all players in the group
    const players = await ctx.db
      .query("players")
      .withIndex("by_group", (q) => q.eq("groupId", args.id))
      .collect();
    for (const player of players) {
      await ctx.db.delete(player._id);
    }

    // Delete all game days and games in the group
    const gameDays = await ctx.db
      .query("gameDays")
      .withIndex("by_group", (q) => q.eq("groupId", args.id))
      .collect();
    for (const gameDay of gameDays) {
      const games = await ctx.db
        .query("games")
        .withIndex("by_game_day", (q) => q.eq("gameDayId", gameDay._id))
        .collect();
      for (const game of games) {
        await ctx.db.delete(game._id);
      }
      await ctx.db.delete(gameDay._id);
    }

    await ctx.db.delete(args.id);
  },
});
```

**Step 2: Commit**

```bash
git add convex/groups.ts
git commit -m "feat: add groups CRUD operations"
```

---

## Task 4: Players CRUD with Cat Avatar

**Files:**
- Create: `convex/players.ts`

**Step 1: Create players queries and mutations**

```typescript
// convex/players.ts
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

export const listByGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("players") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("players", {
      groupId: args.groupId,
      name: args.name,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("players") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const fetchCatAvatar = action({
  args: {},
  handler: async () => {
    const response = await fetch("https://api.thecatapi.com/v1/images/search");
    const data = await response.json();
    return data[0]?.url ?? "https://placekitten.com/200/200";
  },
});
```

**Step 2: Commit**

```bash
git add convex/players.ts
git commit -m "feat: add players CRUD with cat avatar fetching"
```

---

## Task 5: Game Days CRUD

**Files:**
- Create: `convex/gameDays.ts`

**Step 1: Create game days queries and mutations**

```typescript
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
    // Check if game day already exists for this date
    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_group_and_date", (q) =>
        q.eq("groupId", args.groupId).eq("date", args.date)
      )
      .first();

    if (existing) {
      throw new Error("A game day already exists for this date");
    }

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
```

**Step 2: Commit**

```bash
git add convex/gameDays.ts
git commit -m "feat: add game days CRUD operations"
```

---

## Task 6: Games CRUD and Stats Queries

**Files:**
- Create: `convex/games.ts`

**Step 1: Create games mutations and stats queries**

```typescript
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
```

**Step 2: Commit**

```bash
git add convex/games.ts
git commit -m "feat: add games CRUD and stats queries"
```

---

## Task 7: Login Screen

**Files:**
- Modify: `src/routes/index.tsx`

**Step 1: Create the login screen**

```typescript
// src/routes/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated, setAuthToken } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: LoginPage,
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw { redirect: { to: "/groups" } };
    }
  },
});

function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const checkPassword = useMutation(api.auth.checkPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await checkPassword({ password });
      if (result.success && result.token) {
        setAuthToken(result.token);
        navigate({ to: "/groups" });
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🐱</div>
          <CardTitle className="text-2xl">Pickle Cats</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "..." : "Enter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify it renders**

Run: `bun run dev`
Expected: Login page shows at localhost:3000 with password input

**Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: add login screen with password authentication"
```

---

## Task 8: Authenticated Layout

**Files:**
- Create: `src/routes/_authenticated.tsx`

**Step 1: Create authenticated layout wrapper**

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { isAuthenticated, clearAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw { redirect: { to: "/" } };
    }
  },
});

function AuthenticatedLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthToken();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <span>🐱</span>
          <span>Pickle Cats</span>
        </h1>
        <Button variant="ghost" size="icon-sm" onClick={handleLogout}>
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/_authenticated.tsx
git commit -m "feat: add authenticated layout with logout button"
```

---

## Task 9: Groups List Screen

**Files:**
- Create: `src/routes/_authenticated/groups/index.tsx`

**Step 1: Create groups list screen**

```typescript
// src/routes/_authenticated/groups/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Plus, Users, Calendar } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsListPage,
});

function GroupsListPage() {
  const groups = useQuery(api.groups.list);
  const createGroup = useMutation(api.groups.create);
  const [newGroupName, setNewGroupName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    try {
      await createGroup({ name: newGroupName.trim() });
      setNewGroupName("");
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col p-4 pb-24">
      <h2 className="text-xl font-semibold mb-4">Your Groups</h2>

      {groups === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">No groups yet</p>
          <p className="text-muted-foreground text-sm">
            Create your first group to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link
              key={group._id}
              to="/groups/$groupId"
              params={{ groupId: group._id }}
            >
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-4" />
                    {group.playerCount} players
                  </span>
                  {group.lastGameDay && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-4" />
                      {format(new Date(group.lastGameDay), "MMM d")}
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg"
            size="lg"
          >
            <Plus className="size-5 mr-2" />
            Create Group
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Create New Group</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
            <Input
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
          </div>
          <DrawerFooter>
            <Button
              onClick={handleCreate}
              disabled={!newGroupName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/_authenticated/groups/index.tsx
git commit -m "feat: add groups list screen with create drawer"
```

---

## Task 10: Player Card Component

**Files:**
- Create: `src/components/player-card.tsx`

**Step 1: Create reusable player card component**

```typescript
// src/components/player-card.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Doc } from "../../convex/_generated/dataModel";

interface PlayerCardProps {
  player: Doc<"players">;
  size?: "sm" | "default" | "lg";
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function PlayerCard({
  player,
  size = "default",
  className,
  onClick,
  selected,
}: PlayerCardProps) {
  const sizeClasses = {
    sm: "p-2 gap-2",
    default: "p-3 gap-3",
    lg: "p-4 gap-4",
  };

  const avatarSize = {
    sm: "sm" as const,
    default: "default" as const,
    lg: "lg" as const,
  };

  return (
    <div
      className={cn(
        "flex items-center rounded-xl bg-card ring-1 ring-foreground/10 transition-all",
        sizeClasses[size],
        onClick && "cursor-pointer hover:bg-muted/50 active:scale-[0.98]",
        selected && "ring-2 ring-primary bg-primary/5",
        className
      )}
      onClick={onClick}
    >
      <Avatar size={avatarSize[size]}>
        <AvatarImage src={player.avatarUrl} alt={player.name} />
        <AvatarFallback>{player.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "font-medium truncate",
          size === "sm" && "text-sm",
          size === "lg" && "text-lg"
        )}
      >
        {player.name}
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/player-card.tsx
git commit -m "feat: add reusable player card component"
```

---

## Task 11: Group Hub Screen with Tabs

**Files:**
- Create: `src/routes/_authenticated/groups/$groupId.tsx`

**Step 1: Create group hub with players, game days, and stats tabs**

```typescript
// src/routes/_authenticated/groups/$groupId.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerCard } from "@/components/player-card";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Trash2,
  CalendarIcon,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupHubPage,
});

function GroupHubPage() {
  const { groupId } = Route.useParams();
  const group = useQuery(api.groups.get, {
    id: groupId as Id<"groups">,
  });

  if (group === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/groups">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold">{group.name}</h2>
      </div>

      <Tabs defaultValue="players" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 w-fit">
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="game-days">Game Days</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="flex-1 mt-0 p-4">
          <PlayersTab groupId={groupId as Id<"groups">} />
        </TabsContent>

        <TabsContent value="game-days" className="flex-1 mt-0 p-4">
          <GameDaysTab groupId={groupId as Id<"groups">} />
        </TabsContent>

        <TabsContent value="stats" className="flex-1 mt-0 p-4">
          <StatsTab groupId={groupId as Id<"groups">} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlayersTab({ groupId }: { groupId: Id<"groups"> }) {
  const players = useQuery(api.players.listByGroup, { groupId });
  const createPlayer = useMutation(api.players.create);
  const removePlayer = useMutation(api.players.remove);
  const fetchCatAvatar = useAction(api.players.fetchCatAvatar);

  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function loadNewAvatar() {
    setIsLoadingAvatar(true);
    try {
      const url = await fetchCatAvatar();
      setAvatarUrl(url);
    } finally {
      setIsLoadingAvatar(false);
    }
  }

  async function handleOpenDrawer() {
    setNewName("");
    await loadNewAvatar();
    setIsOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim() || !avatarUrl) return;
    setIsCreating(true);
    try {
      await createPlayer({
        groupId,
        name: newName.trim(),
        avatarUrl,
      });
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="pb-24">
      {players === undefined ? (
        <p className="text-muted-foreground text-center">Loading...</p>
      ) : players.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No players yet</p>
          <p className="text-muted-foreground text-sm">
            Add players to start tracking games
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {players.map((player) => (
            <div key={player._id} className="relative group">
              <PlayerCard player={player} />
              <Button
                variant="destructive"
                size="icon-xs"
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePlayer({ id: player._id })}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg"
            size="lg"
            onClick={handleOpenDrawer}
          >
            <Plus className="size-5 mr-2" />
            Add Player
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add New Player</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar size="lg" className="size-24">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback>
                  {isLoadingAvatar ? "..." : "?"}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                size="sm"
                onClick={loadNewAvatar}
                disabled={isLoadingAvatar}
              >
                <RefreshCw
                  className={cn("size-4 mr-2", isLoadingAvatar && "animate-spin")}
                />
                New Cat
              </Button>
            </div>
            <Input
              placeholder="Player name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <DrawerFooter>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || !avatarUrl || isCreating}
            >
              {isCreating ? "Adding..." : "Add Player"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function GameDaysTab({ groupId }: { groupId: Id<"groups"> }) {
  const gameDays = useQuery(api.gameDays.listByGroup, { groupId });
  const players = useQuery(api.players.listByGroup, { groupId });
  const createGameDay = useMutation(api.gameDays.create);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"date" | "attendees">("date");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAttendees, setSelectedAttendees] = useState<Id<"players">[]>(
    []
  );
  const [isCreating, setIsCreating] = useState(false);

  function handleOpenDrawer() {
    setStep("date");
    setSelectedDate(new Date());
    setSelectedAttendees([]);
    setIsOpen(true);
  }

  function toggleAttendee(playerId: Id<"players">) {
    setSelectedAttendees((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  }

  async function handleCreate() {
    if (selectedAttendees.length < 2) return;
    setIsCreating(true);
    try {
      const id = await createGameDay({
        groupId,
        date: format(selectedDate, "yyyy-MM-dd"),
        attendeeIds: selectedAttendees,
      });
      setIsOpen(false);
      navigate({ to: "/game-day/$gameDayId", params: { gameDayId: id } });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="pb-24">
      {gameDays === undefined ? (
        <p className="text-muted-foreground text-center">Loading...</p>
      ) : gameDays.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No game days yet</p>
          <p className="text-muted-foreground text-sm">
            Start a new game day to begin tracking
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {gameDays.map((gameDay) => (
            <Link
              key={gameDay._id}
              to={
                gameDay.isComplete
                  ? "/game-day/$gameDayId/summary"
                  : "/game-day/$gameDayId"
              }
              params={{ gameDayId: gameDay._id }}
            >
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {format(new Date(gameDay.date), "EEEE, MMMM d")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {gameDay.gameCount} games played
                    </p>
                  </div>
                  {gameDay.isComplete && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      Complete
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg"
            size="lg"
            onClick={handleOpenDrawer}
            disabled={!players || players.length < 2}
          >
            <Plus className="size-5 mr-2" />
            New Game Day
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {step === "date" ? "Select Date" : "Who's Playing?"}
            </DrawerTitle>
          </DrawerHeader>

          {step === "date" ? (
            <div className="p-4 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
              />
            </div>
          ) : (
            <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
              {players?.map((player) => (
                <div
                  key={player._id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                    selectedAttendees.includes(player._id)
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-card ring-1 ring-foreground/10 hover:bg-muted/50"
                  )}
                  onClick={() => toggleAttendee(player._id)}
                >
                  <Checkbox
                    checked={selectedAttendees.includes(player._id)}
                    onCheckedChange={() => toggleAttendee(player._id)}
                  />
                  <Avatar size="sm">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{player.name}</span>
                </div>
              ))}
            </div>
          )}

          <DrawerFooter>
            {step === "date" ? (
              <Button onClick={() => setStep("attendees")}>
                Next: Select Players
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCreate}
                  disabled={selectedAttendees.length < 2 || isCreating}
                >
                  {isCreating
                    ? "Starting..."
                    : `Start with ${selectedAttendees.length} Players`}
                </Button>
                <Button variant="outline" onClick={() => setStep("date")}>
                  Back
                </Button>
              </>
            )}
            <DrawerClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

type StatsPeriod =
  | { type: "date"; date: string }
  | { type: "days"; days: number }
  | { type: "month"; year: number; month: number }
  | { type: "all" };

function StatsTab({ groupId }: { groupId: Id<"groups"> }) {
  const today = new Date();
  const [period, setPeriod] = useState<StatsPeriod>({
    type: "date",
    date: format(today, "yyyy-MM-dd"),
  });
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [sortBy, setSortBy] = useState<
    "winPercentage" | "wins" | "losses" | "gamesPlayed" | "plusMinus"
  >("winPercentage");

  const stats = useQuery(api.games.getStats, { groupId, period });

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      setSelectedDate(date);
      setPeriod({ type: "date", date: format(date, "yyyy-MM-dd") });
    }
  }

  const sortedStats = stats
    ? [...stats].sort((a, b) => {
        if (sortBy === "losses") return b.losses - a.losses;
        return b[sortBy] - a[sortBy];
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={period.type === "date" ? "default" : "outline"}
              size="sm"
            >
              <CalendarIcon className="size-4 mr-1" />
              {period.type === "date"
                ? format(selectedDate, "MMM d")
                : "Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant={
            period.type === "days" && period.days === 7 ? "default" : "outline"
          }
          size="sm"
          onClick={() => setPeriod({ type: "days", days: 7 })}
        >
          7 Days
        </Button>
        <Button
          variant={period.type === "month" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setPeriod({
              type: "month",
              year: today.getFullYear(),
              month: today.getMonth() + 1,
            })
          }
        >
          {format(today, "MMM")}
        </Button>
        <Button
          variant={period.type === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriod({ type: "all" })}
        >
          All Time
        </Button>
      </div>

      {stats === undefined ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : sortedStats.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No games in this period
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => setSortBy("winPercentage")}
              >
                Win%{sortBy === "winPercentage" && " ↓"}
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => setSortBy("wins")}
              >
                W{sortBy === "wins" && " ↓"}
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => setSortBy("losses")}
              >
                L{sortBy === "losses" && " ↓"}
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:text-foreground"
                onClick={() => setSortBy("plusMinus")}
              >
                +/-{sortBy === "plusMinus" && " ↓"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map((stat, index) => (
              <TableRow key={stat.player._id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={stat.player.avatarUrl} />
                      <AvatarFallback>
                        {stat.player.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[100px]">
                      {stat.player.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {stat.winPercentage.toFixed(0)}%
                </TableCell>
                <TableCell className="text-right">{stat.wins}</TableCell>
                <TableCell className="text-right">{stat.losses}</TableCell>
                <TableCell className="text-right">
                  {stat.plusMinus > 0 ? "+" : ""}
                  {stat.plusMinus}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/_authenticated/groups/\$groupId.tsx
git commit -m "feat: add group hub with players, game days, and stats tabs"
```

---

## Task 12: Matchmaking Algorithm

**Files:**
- Create: `src/lib/matchmaking.ts`

**Step 1: Implement the matchmaking algorithm**

```typescript
// src/lib/matchmaking.ts
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Player = Doc<"players">;
type Game = Doc<"games">;

interface MatchupResult {
  team1: Player[];
  team2: Player[];
  sittingOut: Player[];
}

interface GameHistory {
  partnerships: Map<string, number>; // "id1-id2" -> count
  matchups: Map<string, number>; // "id1-id2" -> count
  gamesPlayed: Map<Id<"players">, number>;
  consecutiveSitouts: Map<Id<"players">, number>;
}

function getPairKey(id1: Id<"players">, id2: Id<"players">): string {
  return [id1, id2].sort().join("-");
}

function buildGameHistory(games: Game[]): GameHistory {
  const partnerships = new Map<string, number>();
  const matchups = new Map<string, number>();
  const gamesPlayed = new Map<Id<"players">, number>();

  for (const game of games) {
    // Track partnerships (teammates)
    if (game.team1Ids.length === 2) {
      const key = getPairKey(game.team1Ids[0], game.team1Ids[1]);
      partnerships.set(key, (partnerships.get(key) ?? 0) + 1);
    }
    if (game.team2Ids.length === 2) {
      const key = getPairKey(game.team2Ids[0], game.team2Ids[1]);
      partnerships.set(key, (partnerships.get(key) ?? 0) + 1);
    }

    // Track matchups (opponents)
    for (const p1 of game.team1Ids) {
      for (const p2 of game.team2Ids) {
        const key = getPairKey(p1, p2);
        matchups.set(key, (matchups.get(key) ?? 0) + 1);
      }
    }

    // Track games played
    for (const id of [...game.team1Ids, ...game.team2Ids]) {
      gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1);
    }
  }

  return {
    partnerships,
    matchups,
    gamesPlayed,
    consecutiveSitouts: new Map(),
  };
}

function updateSitoutTracking(
  history: GameHistory,
  playing: Player[],
  sittingOut: Player[]
): void {
  const playingIds = new Set(playing.map((p) => p._id));

  for (const player of sittingOut) {
    const current = history.consecutiveSitouts.get(player._id) ?? 0;
    history.consecutiveSitouts.set(player._id, current + 1);
  }

  for (const player of playing) {
    history.consecutiveSitouts.set(player._id, 0);
  }
}

function scoreMatchup(
  team1: Player[],
  team2: Player[],
  history: GameHistory
): number {
  let score = 0;

  // Penalize repeated partnerships (doubles only)
  if (team1.length === 2) {
    const key = getPairKey(team1[0]._id, team1[1]._id);
    const count = history.partnerships.get(key) ?? 0;
    score -= count * 5;
  }
  if (team2.length === 2) {
    const key = getPairKey(team2[0]._id, team2[1]._id);
    const count = history.partnerships.get(key) ?? 0;
    score -= count * 5;
  }

  // Penalize repeated matchups
  for (const p1 of team1) {
    for (const p2 of team2) {
      const key = getPairKey(p1._id, p2._id);
      const count = history.matchups.get(key) ?? 0;
      score -= count * 3;
    }
  }

  // Small penalty for players who have played more
  for (const player of [...team1, ...team2]) {
    const played = history.gamesPlayed.get(player._id) ?? 0;
    score -= played * 1;
  }

  // Bonus for players who have sat out
  for (const player of [...team1, ...team2]) {
    const sitouts = history.consecutiveSitouts.get(player._id) ?? 0;
    score += sitouts * 2;
  }

  return score;
}

function* combinations<T>(arr: T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  if (arr.length < size) return;

  const [first, ...rest] = arr;
  for (const combo of combinations(rest, size - 1)) {
    yield [first, ...combo];
  }
  for (const combo of combinations(rest, size)) {
    yield combo;
  }
}

export function generateMatchup(
  attendees: Player[],
  games: Game[],
  isDoubles: boolean,
  lockedPlayers: Id<"players">[] = []
): MatchupResult {
  const history = buildGameHistory(games);

  // Update consecutive sitouts based on last game
  if (games.length > 0) {
    const lastGame = games[games.length - 1];
    const lastPlaying = [...lastGame.team1Ids, ...lastGame.team2Ids];
    const lastSittingOut = attendees.filter(
      (p) => !lastPlaying.includes(p._id)
    );
    updateSitoutTracking(
      history,
      attendees.filter((p) => lastPlaying.includes(p._id)),
      lastSittingOut
    );
  }

  const playersNeeded = isDoubles ? 4 : 2;

  // Not enough players
  if (attendees.length < playersNeeded) {
    if (attendees.length >= 2) {
      // Fall back to singles
      return generateMatchup(attendees, games, false, lockedPlayers);
    }
    return { team1: [], team2: [], sittingOut: attendees };
  }

  // Find locked players
  const locked = attendees.filter((p) => lockedPlayers.includes(p._id));
  const unlocked = attendees.filter((p) => !lockedPlayers.includes(p._id));

  let bestMatchup: MatchupResult = {
    team1: [],
    team2: [],
    sittingOut: attendees,
  };
  let bestScore = -Infinity;

  // Generate all possible player selections
  const neededFromUnlocked = playersNeeded - locked.length;

  if (neededFromUnlocked > unlocked.length) {
    // Not enough unlocked players
    return { team1: [], team2: [], sittingOut: attendees };
  }

  for (const selectedUnlocked of combinations(unlocked, neededFromUnlocked)) {
    const selectedPlayers = [...locked, ...selectedUnlocked];
    const sittingOut = attendees.filter(
      (p) => !selectedPlayers.some((s) => s._id === p._id)
    );

    // Generate all team splits
    const teamSize = isDoubles ? 2 : 1;
    for (const team1 of combinations(selectedPlayers, teamSize)) {
      const team2 = selectedPlayers.filter(
        (p) => !team1.some((t) => t._id === p._id)
      );

      const score = scoreMatchup(team1, team2, history);
      if (score > bestScore) {
        bestScore = score;
        bestMatchup = { team1, team2, sittingOut };
      }
    }
  }

  return bestMatchup;
}

export function swapPlayer(
  currentMatchup: MatchupResult,
  playerOut: Id<"players">,
  playerIn: Id<"players">,
  attendees: Player[],
  games: Game[],
  isDoubles: boolean
): MatchupResult {
  // Find which team the player is in
  const inTeam1 = currentMatchup.team1.some((p) => p._id === playerOut);
  const inTeam2 = currentMatchup.team2.some((p) => p._id === playerOut);

  if (!inTeam1 && !inTeam2) {
    return currentMatchup;
  }

  // Get the player coming in
  const newPlayer = attendees.find((p) => p._id === playerIn);
  if (!newPlayer) return currentMatchup;

  // Create new teams with the swap
  let newTeam1 = currentMatchup.team1.map((p) =>
    p._id === playerOut ? newPlayer : p
  );
  let newTeam2 = currentMatchup.team2.map((p) =>
    p._id === playerOut ? newPlayer : p
  );

  // Update sitting out
  const oldPlayer = attendees.find((p) => p._id === playerOut);
  const newSittingOut = currentMatchup.sittingOut
    .filter((p) => p._id !== playerIn)
    .concat(oldPlayer ? [oldPlayer] : []);

  // Lock the swapped-in player and recalculate best arrangement
  const lockedPlayers = [playerIn];
  const allPlaying = [...newTeam1, ...newTeam2];

  return generateMatchup(
    [...allPlaying, ...newSittingOut],
    games,
    isDoubles,
    lockedPlayers
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/matchmaking.ts
git commit -m "feat: add matchmaking algorithm with variety optimization"
```

---

## Task 13: Active Game Day Screen

**Files:**
- Create: `src/routes/_authenticated/game-day/$gameDayId.tsx`

**Step 1: Create the active game day screen**

```typescript
// src/routes/_authenticated/game-day/$gameDayId.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useState, useEffect, useMemo } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { PlayerCard } from "@/components/player-card";
import { generateMatchup, swapPlayer } from "@/lib/matchmaking";
import { ArrowLeft, ArrowLeftRight, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/game-day/$gameDayId")({
  component: ActiveGameDayPage,
});

type Player = Doc<"players">;
type Game = Doc<"games">;

interface MatchupState {
  team1: Player[];
  team2: Player[];
  sittingOut: Player[];
}

function ActiveGameDayPage() {
  const { gameDayId } = Route.useParams();
  const navigate = useNavigate();

  const gameDay = useQuery(api.gameDays.get, {
    id: gameDayId as Id<"gameDays">,
  });
  const createGame = useMutation(api.games.create);
  const completeDay = useMutation(api.gameDays.complete);

  const [isDoubles, setIsDoubles] = useState(true);
  const [matchup, setMatchup] = useState<MatchupState | null>(null);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [swapDrawerOpen, setSwapDrawerOpen] = useState(false);
  const [playerToSwap, setPlayerToSwap] = useState<Player | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attendees = useMemo(
    () => (gameDay?.attendees ?? []) as Player[],
    [gameDay?.attendees]
  );
  const games = useMemo(
    () => (gameDay?.games ?? []) as Game[],
    [gameDay?.games]
  );

  // Generate initial matchup
  useEffect(() => {
    if (attendees.length >= 2 && !matchup) {
      const result = generateMatchup(attendees, games, isDoubles);
      setMatchup(result);
    }
  }, [attendees, games, isDoubles, matchup]);

  // Regenerate when mode changes
  useEffect(() => {
    if (attendees.length >= 2) {
      const result = generateMatchup(attendees, games, isDoubles);
      setMatchup(result);
    }
  }, [isDoubles]);

  function handleSwapClick(player: Player) {
    setPlayerToSwap(player);
    setSwapDrawerOpen(true);
  }

  function handleSwapSelect(newPlayer: Player) {
    if (!playerToSwap || !matchup) return;

    const result = swapPlayer(
      matchup,
      playerToSwap._id,
      newPlayer._id,
      attendees,
      games,
      isDoubles
    );
    setMatchup(result);
    setSwapDrawerOpen(false);
    setPlayerToSwap(null);
  }

  async function handleSubmitGame() {
    if (!matchup || !team1Score || !team2Score) return;

    const score1 = parseInt(team1Score, 10);
    const score2 = parseInt(team2Score, 10);

    if (isNaN(score1) || isNaN(score2)) return;

    setIsSubmitting(true);
    try {
      await createGame({
        gameDayId: gameDayId as Id<"gameDays">,
        team1Ids: matchup.team1.map((p) => p._id),
        team2Ids: matchup.team2.map((p) => p._id),
        team1Score: score1,
        team2Score: score2,
      });

      // Reset for next game
      setTeam1Score("");
      setTeam2Score("");

      // Generate new matchup (will update on next render with new games)
      const newGames = [
        ...games,
        {
          team1Ids: matchup.team1.map((p) => p._id),
          team2Ids: matchup.team2.map((p) => p._id),
          team1Score: score1,
          team2Score: score2,
        } as Game,
      ];
      const result = generateMatchup(attendees, newGames, isDoubles);
      setMatchup(result);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinishDay() {
    await completeDay({ id: gameDayId as Id<"gameDays"> });
    navigate({
      to: "/game-day/$gameDayId/summary",
      params: { gameDayId },
    });
  }

  if (gameDay === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (gameDay === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Game day not found</p>
      </div>
    );
  }

  const canSubmit =
    matchup &&
    matchup.team1.length > 0 &&
    matchup.team2.length > 0 &&
    team1Score &&
    team2Score;

  return (
    <div className="flex-1 flex flex-col pb-24">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Link to="/groups/$groupId" params={{ groupId: gameDay.groupId }}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-semibold">
            {format(new Date(gameDay.date), "EEEE, MMMM d")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {gameDay.group?.name} • {games.length} games played
          </p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-3">
          <Label
            htmlFor="mode"
            className={cn(!isDoubles && "text-muted-foreground")}
          >
            Singles
          </Label>
          <Switch
            id="mode"
            checked={isDoubles}
            onCheckedChange={setIsDoubles}
          />
          <Label
            htmlFor="mode"
            className={cn(isDoubles && "text-muted-foreground")}
          >
            Doubles
          </Label>
        </div>

        {/* Current Matchup */}
        {matchup && matchup.team1.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-sm text-muted-foreground">
                Game {games.length + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                {/* Team 1 */}
                <div className="space-y-2">
                  {matchup.team1.map((player) => (
                    <div
                      key={player._id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => handleSwapClick(player)}
                    >
                      <Avatar size="sm">
                        <AvatarImage src={player.avatarUrl} />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">
                        {player.name}
                      </span>
                      <ArrowLeftRight className="size-3 ml-auto text-muted-foreground" />
                    </div>
                  ))}
                </div>

                {/* VS */}
                <div className="text-lg font-bold text-muted-foreground">
                  VS
                </div>

                {/* Team 2 */}
                <div className="space-y-2">
                  {matchup.team2.map((player) => (
                    <div
                      key={player._id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => handleSwapClick(player)}
                    >
                      <Avatar size="sm">
                        <AvatarImage src={player.avatarUrl} />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">
                        {player.name}
                      </span>
                      <ArrowLeftRight className="size-3 ml-auto text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Score Entry */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <Input
                  type="number"
                  placeholder="0"
                  className="text-center text-2xl h-14"
                  value={team1Score}
                  onChange={(e) => setTeam1Score(e.target.value)}
                />
                <div className="text-muted-foreground">-</div>
                <Input
                  type="number"
                  placeholder="0"
                  className="text-center text-2xl h-14"
                  value={team2Score}
                  onChange={(e) => setTeam2Score(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmitGame}
              >
                <Check className="size-5 mr-2" />
                {isSubmitting ? "Saving..." : "Submit Game"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sitting Out */}
        {matchup && matchup.sittingOut.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Sitting Out
            </h3>
            <div className="flex gap-2 flex-wrap">
              {matchup.sittingOut.map((player) => (
                <div
                  key={player._id}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50"
                >
                  <Avatar size="sm">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{player.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Previous Games */}
        {games.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Previous Games
            </h3>
            <div className="space-y-2">
              {[...games].reverse().map((game) => (
                <Card key={game._id} size="sm">
                  <CardContent className="py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Game {game.gameNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            game.team1Score > game.team2Score &&
                              "font-semibold text-primary"
                          )}
                        >
                          {game.team1Score}
                        </span>
                        <span className="text-muted-foreground">-</span>
                        <span
                          className={cn(
                            game.team2Score > game.team1Score &&
                              "font-semibold text-primary"
                          )}
                        >
                          {game.team2Score}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Finish Day Button */}
      {games.length > 0 && (
        <Button
          className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg"
          size="lg"
          variant="secondary"
          onClick={handleFinishDay}
        >
          Finish Day
        </Button>
      )}

      {/* Swap Drawer */}
      <Drawer open={swapDrawerOpen} onOpenChange={setSwapDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              Swap {playerToSwap?.name} with...
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {matchup?.sittingOut.map((player) => (
              <PlayerCard
                key={player._id}
                player={player}
                onClick={() => handleSwapSelect(player)}
              />
            ))}
            {matchup?.team1
              .filter((p) => p._id !== playerToSwap?._id)
              .map((player) => (
                <PlayerCard
                  key={player._id}
                  player={player}
                  onClick={() => handleSwapSelect(player)}
                />
              ))}
            {matchup?.team2
              .filter((p) => p._id !== playerToSwap?._id)
              .map((player) => (
                <PlayerCard
                  key={player._id}
                  player={player}
                  onClick={() => handleSwapSelect(player)}
                />
              ))}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/_authenticated/game-day/\$gameDayId.tsx
git commit -m "feat: add active game day screen with matchmaking"
```

---

## Task 14: Game Day Summary Screen

**Files:**
- Create: `src/routes/_authenticated/game-day/$gameDayId.summary.tsx`
- Create: `src/lib/image-generator.ts`

**Step 1: Install html-to-image**

Run: `bun add html-to-image`
Expected: Package installed successfully

**Step 2: Create image generator utility**

```typescript
// src/lib/image-generator.ts
import { toPng } from "html-to-image";

export async function generateSummaryImage(
  element: HTMLElement
): Promise<string> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#1a1a2e",
  });
  return dataUrl;
}

export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
```

**Step 3: Create the summary screen**

```typescript
// src/routes/_authenticated/game-day/$gameDayId.summary.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateSummaryImage, downloadImage } from "@/lib/image-generator";
import { ArrowLeft, Download, Star } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute(
  "/_authenticated/game-day/$gameDayId/summary"
)({
  component: SummaryPage,
});

function SummaryPage() {
  const { gameDayId } = Route.useParams();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const data = useQuery(api.games.getGameDayStats, {
    gameDayId: gameDayId as Id<"gameDays">,
  });

  async function handleDownload() {
    if (!summaryRef.current || !data) return;
    setIsDownloading(true);
    try {
      const dataUrl = await generateSummaryImage(summaryRef.current);
      const filename = `pickle-cats-${data.gameDay.date}.png`;
      downloadImage(dataUrl, filename);
    } finally {
      setIsDownloading(false);
    }
  }

  if (data === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Summary not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-24">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Link
          to="/groups/$groupId"
          params={{ groupId: data.gameDay.groupId }}
        >
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold">Game Day Summary</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Downloadable Summary Card */}
        <div
          ref={summaryRef}
          className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl p-6 space-y-4"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="text-3xl">🐱</div>
            <h3 className="text-xl font-bold">PICKLE CATS</h3>
            <p className="text-muted-foreground">{data.group?.name}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(data.gameDay.date), "MMMM d, yyyy")}
            </p>
          </div>

          {/* Stats */}
          <div className="text-center py-4 border-y border-foreground/10">
            <p className="text-2xl font-bold">{data.totalGames} Games Played</p>
            {data.mvp && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Star className="size-5 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">
                  MVP: {data.mvp.player.name} ({data.mvp.wins}-{data.mvp.losses})
                </span>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="space-y-2">
            {data.stats.slice(0, 5).map((stat, index) => (
              <div
                key={stat!.player._id}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/50"
              >
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {index + 1}.
                </span>
                <Avatar size="sm">
                  <AvatarImage src={stat!.player.avatarUrl} />
                  <AvatarFallback>
                    {stat!.player.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium flex-1 truncate">
                  {stat!.player.name}
                </span>
                <span className="text-sm">
                  {stat!.wins}-{stat!.losses}
                </span>
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {stat!.winPercentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Download Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          <Download className="size-5 mr-2" />
          {isDownloading ? "Generating..." : "Download Image"}
        </Button>

        {/* Full Stats */}
        <Card>
          <CardHeader>
            <CardTitle>All Players</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.stats.map((stat, index) => (
              <div
                key={stat!.player._id}
                className="flex items-center gap-3 py-2"
              >
                <span className="w-6 text-center text-muted-foreground">
                  {index + 1}
                </span>
                <Avatar size="sm">
                  <AvatarImage src={stat!.player.avatarUrl} />
                  <AvatarFallback>
                    {stat!.player.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{stat!.player.name}</span>
                <span className="text-sm tabular-nums">
                  {stat!.wins}W - {stat!.losses}L
                </span>
                <span className="text-sm text-muted-foreground w-12 text-right tabular-nums">
                  {stat!.winPercentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Done Button */}
      <Link
        to="/groups/$groupId"
        params={{ groupId: data.gameDay.groupId }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2"
      >
        <Button size="lg" className="shadow-lg">
          Done
        </Button>
      </Link>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/image-generator.ts src/routes/_authenticated/game-day/\$gameDayId.summary.tsx
git commit -m "feat: add game day summary with downloadable image"
```

---

## Task 15: Clean Up and Polish

**Files:**
- Modify: `src/routes/__root.tsx`
- Delete: `src/components/component-example.tsx`
- Delete: `src/components/example.tsx`

**Step 1: Update root route with proper title and mobile meta**

```typescript
// src/routes/__root.tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      {
        name: "theme-color",
        content: "#1a1a2e",
      },
      {
        title: "Pickle Cats",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
```

**Step 2: Remove example components**

Run: `rm src/components/component-example.tsx src/components/example.tsx`
Expected: Files deleted

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: update meta tags for mobile PWA and remove example files"
```

---

## Task 16: Final Verification

**Step 1: Start dev server**

Run: `bun run dev`
Expected: Server starts without errors on port 3000

**Step 2: Start Convex dev**

Run: `bunx convex dev`
Expected: Convex syncs schema and functions

**Step 3: Test the full flow**

1. Open http://localhost:3000
2. Enter password → should redirect to groups
3. Create a new group
4. Add 4+ players (verify cat avatars load)
5. Start a new game day
6. Play through a few games
7. Finish day and download summary image
8. Check stats in the Stats tab

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```

---

## Summary

This plan builds the Pickle Cats app in 16 tasks:

1. **Tasks 1-6**: Backend (Convex schema, auth, CRUD operations, stats queries)
2. **Tasks 7-11**: Core screens (login, layout, groups list, player card, group hub)
3. **Tasks 12-13**: Game logic (matchmaking algorithm, active game day)
4. **Tasks 14-15**: Polish (summary with image download, mobile meta tags)
5. **Task 16**: Verification

Each task is atomic and builds on the previous ones. The app is fully functional after completing all tasks.
