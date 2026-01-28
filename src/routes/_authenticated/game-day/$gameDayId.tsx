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
