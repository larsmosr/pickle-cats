import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowLeft, Download, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { DecorativeBackground } from '@/components/decorative-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { downloadImage, generateSummaryImage, shareImage } from '@/lib/image-generator'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/game-day/$gameDayId_/summary')({
  loader: async ({ context: { queryClient }, params: { gameDayId } }) => {
    await queryClient.ensureQueryData(
      convexQuery(api.games.getGameDayStats, { gameDayId: gameDayId as Id<'gameDays'> }),
    )
  },
  head: () => ({
    meta: [
      { title: 'Game Day Summary | Pickle Cats' },
      {
        name: 'description',
        content: 'View your game day results, player rankings, and share your pickleball achievements.',
      },
      { property: 'og:title', content: 'Game Day Summary | Pickle Cats' },
      {
        property: 'og:description',
        content: 'View your game day results, player rankings, and share your pickleball achievements.',
      },
    ],
  }),
  component: SummaryPage,
})

function SummaryPage() {
  const { gameDayId } = Route.useParams()
  const summaryRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const { data } = useSuspenseQuery(convexQuery(api.games.getGameDayStats, { gameDayId: gameDayId as Id<'gameDays'> }))

  async function captureImage() {
    if (!summaryRef.current) return null
    // Switch to export mode (no card styling)
    setIsExporting(true)
    // Wait for re-render
    await new Promise((resolve) => setTimeout(resolve, 50))
    try {
      const dataUrl = await generateSummaryImage(summaryRef.current)
      return dataUrl
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownload() {
    if (!summaryRef.current || !data) return
    setIsDownloading(true)
    try {
      const dataUrl = await captureImage()
      if (dataUrl) {
        const filename = `pickle-cats-${data.gameDay.date}.png`
        downloadImage(dataUrl, filename)
      }
    } catch (error) {
      console.error('Failed to generate image:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleShare() {
    if (!summaryRef.current || !data) return
    setIsSharing(true)
    try {
      const dataUrl = await captureImage()
      if (dataUrl) {
        const filename = `pickle-cats-${data.gameDay.date}.png`
        const title = `Pickle Cats - ${format(new Date(data.gameDay.date), 'MMMM d, yyyy')}`
        const text = `${data.totalGames} games played${data.mvp ? ` • MVP: ${data.mvp.player.name}` : ''}`
        await shareImage(dataUrl, filename, title, text)
      }
    } catch (error) {
      console.error('Failed to share image:', error)
    } finally {
      setIsSharing(false)
    }
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Summary not found</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col pb-24 relative">
      <DecorativeBackground variant="minimal" />

      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 relative z-10 bg-background/80 backdrop-blur-sm">
        <Link to="/groups/$groupId" params={{ groupId: data.gameDay.groupId }}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold">Game Day Summary</h2>
      </div>

      <div className="p-4 space-y-4 relative z-10">
        {/* Downloadable Summary Card - 9:16 portrait format with light purple theme */}
        <div
          ref={summaryRef}
          className={isExporting ? '' : 'mx-auto rounded-3xl overflow-hidden'}
          style={{
            width: '360px',
            minHeight: '640px',
            background: '#E7E2FE',
            padding: isExporting ? '20px' : '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            margin: isExporting ? 0 : undefined,
          }}
        >
          {/* Inner wrapper to keep content together */}
          <div style={{ width: '100%' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <img
                src="/app-logo.png"
                alt="Pickle Cats"
                style={{ width: '120px', height: '120px', margin: '0 auto', objectFit: 'contain' }}
              />
              <p style={{ color: '#5c5470', fontSize: '20px', fontWeight: 500, marginTop: '8px' }}>
                {data.group?.name}
              </p>
              <p style={{ color: '#7a7490', fontSize: '16px', marginTop: '2px' }}>
                {format(new Date(data.gameDay.date), 'MMMM d, yyyy')}
              </p>
            </div>

            {/* Stats */}
            <div
              style={{
                textAlign: 'center',
                padding: '12px 0',
                borderTop: '1px solid rgba(92, 84, 112, 0.15)',
                borderBottom: '1px solid rgba(92, 84, 112, 0.15)',
                marginBottom: '16px',
              }}
            >
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>{data.totalGames} Games Played</p>
            </div>

            {/* Leaderboard */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.stats
                .filter((stat): stat is NonNullable<typeof stat> => stat !== null)
                .slice(0, 10)
                .map((stat, index) => {
                  const isMvp = index === 0 && data.mvp
                  return (
                    <div
                      key={stat.player._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.6)',
                      }}
                    >
                      <span style={{ width: '28px', textAlign: 'center', fontWeight: 700, color: '#7a7490' }}>
                        {index + 1}.
                      </span>
                      <Avatar size="sm">
                        <AvatarImage src={stat.player.avatarUrl} />
                        <AvatarFallback>{stat.player.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span
                        style={{
                          fontWeight: 500,
                          flex: 1,
                          color: '#3d3654',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {stat.player.name}
                        {isMvp && (
                          <>
                            <svg
                              style={{ width: '14px', height: '14px', color: '#eab308', fill: '#eab308' }}
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                fill="currentColor"
                              />
                            </svg>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#ca8a04',
                                background: '#fef9c3',
                                padding: '2px 6px',
                                borderRadius: '8px',
                              }}
                            >
                              MVP
                            </span>
                          </>
                        )}
                      </span>
                      <span style={{ fontSize: '14px', color: '#5c5470' }}>
                        {stat.wins}-{stat.losses}
                      </span>
                      <span style={{ fontSize: '14px', color: '#7a7490', width: '48px', textAlign: 'right' }}>
                        {stat.winPercentage.toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button className="flex-1" size="lg" variant="outline" onClick={handleDownload} disabled={isDownloading}>
            <Download className="size-5 mr-2" />
            {isDownloading ? 'Generating...' : 'Download'}
          </Button>
          <Button className="flex-1" size="lg" onClick={handleShare} disabled={isSharing}>
            <Share2 className="size-5 mr-2" />
            {isSharing ? 'Sharing...' : 'Share'}
          </Button>
        </div>
      </div>

      {/* Done Button */}
      <Link
        to="/groups/$groupId"
        params={{ groupId: data.gameDay.groupId }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20"
      >
        <Button
          size="lg"
          className="shadow-lg bg-foreground text-background hover:bg-foreground/90 rounded-2xl h-12 px-8"
        >
          Done
        </Button>
      </Link>
    </div>
  )
}
