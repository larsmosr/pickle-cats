// src/routes/_authenticated/groups/index.tsx
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import { Calendar, Plus } from 'lucide-react'
import { useState } from 'react'
import { DecorativeBackground } from '@/components/decorative-background'
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
  head: () => ({
    meta: [
      { title: 'My Groups | Pickle Cats' },
      { name: 'description', content: 'View and manage your pickleball groups. Create new groups and track game days.' },
      { property: 'og:title', content: 'My Groups | Pickle Cats' },
      { property: 'og:description', content: 'View and manage your pickleball groups. Create new groups and track game days.' },
    ],
  }),
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
    <div className="flex-1 flex flex-col p-4 pb-24 relative">
      <DecorativeBackground variant="default" />

      <div className="relative z-10">
        <h1 className="text-2xl font-bold mb-1">Hello there!</h1>
        <p className="text-muted-foreground text-sm mb-6">Ready to play some pickleball?</p>

        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-20 h-20 rounded-full bg-warm/50 flex items-center justify-center mb-2">
              <Plus className="size-8 text-warm-foreground" />
            </div>
            <p className="text-foreground font-medium">No groups yet</p>
            <p className="text-muted-foreground text-sm">Create your first group to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <Link key={group._id} to="/groups/$groupId" params={{ groupId: group._id }}>
                <Card className="hover:bg-card/80 transition-all cursor-pointer p-4 shadow-sm hover:shadow-md border-0 bg-card/90 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
                  <div className="flex flex-col gap-2">
                    {group.players.length > 0 && (
                      <AvatarGroup>
                        {group.players.slice(0, 8).map((player) => (
                          <Avatar key={player._id} size="sm">
                            <AvatarImage src={player.avatarUrl} alt={player.name} />
                            <AvatarFallback className="bg-warm text-warm-foreground">{player.name[0]}</AvatarFallback>
                          </Avatar>
                        ))}
                      </AvatarGroup>
                    )}
                    {group.lastGameDay && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="size-4" />
                        Last game: {format(new Date(group.lastGameDay), 'MMM d')}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg bg-foreground text-background hover:bg-foreground/90 rounded-2xl h-12 px-6"
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
