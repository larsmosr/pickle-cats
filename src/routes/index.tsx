// src/routes/index.tsx
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { DecorativeBackground } from '@/components/decorative-background'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { isAuthenticated, login } from '@/lib/auth'

export const Route = createFileRoute('/')({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: 'Login | Pickle Cats' },
      { name: 'description', content: 'Sign in to Pickle Cats to track your pickleball games and statistics.' },
      { property: 'og:title', content: 'Login | Pickle Cats' },
      { property: 'og:description', content: 'Sign in to Pickle Cats to track your pickleball games and statistics.' },
    ],
  }),
  beforeLoad: async () => {
    const authenticated = await isAuthenticated()
    if (authenticated) {
      throw redirect({ to: '/groups' })
    }
  },
})

function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login({ data: { password } })
      if (result.success) {
        navigate({ to: '/groups' })
      } else {
        setError('Incorrect password')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background relative">
      <DecorativeBackground variant="login" />
      <Card className="w-full max-w-sm shadow-lg relative z-10">
        <CardHeader className="text-center pb-2">
          <img src="/app-logo.png" alt="Pickle Cats" className="w-36 h-36 mx-auto object-contain drop-shadow-sm" />
          <p className="text-sm text-muted-foreground mt-2">Welcome back!</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="h-12 text-center"
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-md"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
