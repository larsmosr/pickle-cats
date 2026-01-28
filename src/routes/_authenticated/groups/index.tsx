// src/routes/_authenticated/groups/index.tsx
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import { Calendar, Plus } from 'lucide-react'
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { api } from '../../../../convex/_generated/api'

export const Route = createFileRoute('/_authenticated/groups/')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(convexQuery(api.groups.list, {}))
  },
  component: GroupsListPage,
})

function GroupsListPage() {
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.list, {}))
  const createGroup = useMutation(api.groups.create)
  const [newGroupName, setNewGroupName] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate() {
    if (!newGroupName.trim()) return
    setIsCreating(true)
    try {
      await createGroup({ name: newGroupName.trim() })
      setNewGroupName('')
      setIsOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-4 pb-24">
      <h2 className="text-xl font-semibold mb-4">Your Groups</h2>

      {groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">No groups yet</p>
          <p className="text-muted-foreground text-sm">Create your first group to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Link key={group._id} to="/groups/$groupId" params={{ groupId: group._id }}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer p-4">
                <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
                <div className="flex flex-col gap-2">
                  {group.players.length > 0 && (
                    <AvatarGroup>
                      {group.players.slice(0, 8).map((player) => (
                        <Avatar key={player._id} size="sm">
                          <AvatarImage src={player.avatarUrl} alt={player.name} />
                          <AvatarFallback>{player.name[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                  )}
                  {group.lastGameDay && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="size-4" />
                      Last game day: {format(new Date(group.lastGameDay), 'MMM d')}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg" size="lg">
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
            <Button onClick={handleCreate} disabled={!newGroupName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
