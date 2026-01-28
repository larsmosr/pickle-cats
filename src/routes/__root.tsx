import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import appCss from '../styles.css?url'

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Decorative curves */}
      <svg
        className="absolute -top-20 -right-32 w-[500px] h-[300px] text-primary/30"
        viewBox="0 0 500 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-50 150 Q100 50 200 100 T400 80 T550 150"
          stroke="currentColor"
          strokeWidth="80"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <svg
        className="absolute -bottom-32 -left-20 w-[400px] h-[250px] text-primary/20"
        viewBox="0 0 400 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-50 200 Q50 100 150 150 T350 120 T450 180"
          stroke="currentColor"
          strokeWidth="60"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <div className="text-center relative z-10">
        <h1 className="mb-4 text-8xl font-bold tracking-tighter text-primary">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">This page got lost chasing a pickle...</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-foreground text-background px-6 py-3 font-medium transition-colors hover:bg-foreground/90 shadow-lg"
        >
          Back to Home
        </a>
      </div>
    </div>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  notFoundComponent: NotFoundComponent,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'theme-color',
        content: '#1a1a2e',
      },
      // Block crawlers from indexing
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
      // Default page title
      {
        title: 'Pickle Cats',
      },
      // Default description
      {
        name: 'description',
        content: 'Track your pickleball games, manage players, and view statistics with Pickle Cats.',
      },
      // Open Graph tags for link sharing
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'Pickle Cats',
      },
      {
        property: 'og:title',
        content: 'Pickle Cats',
      },
      {
        property: 'og:description',
        content: 'Track your pickleball games, manage players, and view statistics with Pickle Cats.',
      },
      {
        property: 'og:image',
        content: '/logo512.png',
      },
      // Twitter Card tags
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: 'Pickle Cats',
      },
      {
        name: 'twitter:description',
        content: 'Track your pickleball games, manage players, and view statistics with Pickle Cats.',
      },
      {
        name: 'twitter:image',
        content: '/logo512.png',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
})

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
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
