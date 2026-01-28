// src/routes/_authenticated.tsx
import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isAuthenticated, logout } from '@/lib/auth'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
  beforeLoad: async () => {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      throw redirect({ to: '/' })
    }
  },
})

function AuthenticatedLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col lg:justify-center items-center lg:py-8 lg:px-4">
      <div className="w-full max-w-2xl flex flex-col min-h-dvh lg:min-h-[calc(100vh-64px)] lg:rounded-3xl lg:border-0 lg:shadow-xl lg:bg-card/95 lg:backdrop-blur-sm lg:overflow-hidden">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center justify-between lg:bg-card/80">
          <Link to="/groups">
            <img src="/app-logo.png" alt="Pickle Cats" className="w-10 h-10 object-contain drop-shadow-sm" />
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} className="hover:bg-muted/60">
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
