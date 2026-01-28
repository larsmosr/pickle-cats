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
