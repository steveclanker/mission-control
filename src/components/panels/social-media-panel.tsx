'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import type {
  LateAccount,
  LateAnalyticsResponse,
  LateAnalyticsPost,
} from '@/types/late'

type TabId = 'overview' | 'calendar' | 'analytics' | 'insights' | 'compose' | 'accounts'
type SortKey = 'publishedAt' | 'impressions' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagementRate'
type SortDir = 'asc' | 'desc'

// Formatters (outside component for stability)
const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}

const platformColors: Record<string, { from: string; to: string; text: string; bg: string }> = {
  instagram: { from: 'from-pink-500', to: 'to-purple-600', text: 'text-pink-400', bg: 'bg-pink-500/10' },
  twitter: { from: 'from-sky-400', to: 'to-blue-500', text: 'text-sky-400', bg: 'bg-sky-500/10' },
  facebook: { from: 'from-blue-500', to: 'to-blue-700', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  linkedin: { from: 'from-blue-600', to: 'to-blue-800', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  tiktok: { from: 'from-pink-500', to: 'to-cyan-400', text: 'text-pink-400', bg: 'bg-pink-500/10' },
}

const getPlatformColor = (platform: string) =>
  platformColors[platform.toLowerCase()] || { from: 'from-violet-500', to: 'to-purple-600', text: 'text-violet-400', bg: 'bg-violet-500/10' }

export function SocialMediaPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [accounts, setAccounts] = useState<LateAccount[]>([])
  const [analytics, setAnalytics] = useState<LateAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Compose state
  const [composeText, setComposeText] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [posting, setPosting] = useState(false)
  const [postSuccess, setPostSuccess] = useState<string | null>(null)

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [calendarComposeDay, setCalendarComposeDay] = useState<number | null>(null)
  const [calendarTime, setCalendarTime] = useState('09:00')

  // Analytics sort state
  const [sortKey, setSortKey] = useState<SortKey>('engagementRate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [accountsRes, analyticsRes] = await Promise.all([
        fetch('/api/late/accounts'),
        fetch('/api/late/analytics'),
      ])
      if (!accountsRes.ok || !analyticsRes.ok) throw new Error('Failed to fetch data from Late API')
      const accountsData = await accountsRes.json()
      const analyticsData = await analyticsRes.json()
      setAccounts(accountsData.accounts || [])
      setAnalytics(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 5 minutes for real-time updates
  useEffect(() => {
    const interval = setInterval(() => { fetchData() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Also refresh when tab becomes visible again (user switches back to browser)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchData()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchData])

  // Last refreshed timestamp
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const originalFetchData = fetchData
  // Wrap to track refresh time
  useEffect(() => {
    if (!loading && analytics) setLastRefreshed(new Date())
  }, [loading, analytics])

  // formatNumber is defined outside the component

  const formatRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diffMs / 60000)
    const hrs = Math.floor(diffMs / 3600000)
    const days = Math.floor(diffMs / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  // Computed stats
  const avgEngagementRate = useMemo(() => {
    if (!analytics?.posts?.length) return 0
    return analytics.posts.reduce((s, p) => s + (p.analytics?.engagementRate || 0), 0) / analytics.posts.length
  }, [analytics])

  const totalImpressions = useMemo(() => {
    if (!analytics?.posts?.length) return 0
    return analytics.posts.reduce((s, p) => s + (p.analytics?.impressions || 0), 0)
  }, [analytics])

  const totalFollowers = useMemo(() => {
    return accounts.reduce((s, a) => s + (a.followersCount || 0), 0)
  }, [accounts])

  const topPosts = useMemo(() => {
    if (!analytics?.posts?.length) return []
    return [...analytics.posts]
      .sort((a, b) => (b.analytics?.engagementRate || 0) - (a.analytics?.engagementRate || 0))
      .slice(0, 5)
  }, [analytics])

  // Chart data
  const postChartData = useMemo(() => {
    return [...(analytics?.posts || [])]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .map((p, i) => ({
        name: `Post ${i + 1}`,
        label: (p.content || 'No caption').slice(0, 25) + ((p.content?.length || 0) > 25 ? '...' : ''),
        impressions: p.analytics?.impressions || 0,
        reach: p.analytics?.reach || 0,
        likes: p.analytics?.likes || 0,
        comments: p.analytics?.comments || 0,
        shares: p.analytics?.shares || 0,
        saves: p.analytics?.saves || 0,
        engagementRate: p.analytics?.engagementRate || 0,
        date: new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
  }, [analytics])

  const engagementPieData = useMemo(() => {
    const totalLikes = analytics?.posts?.reduce((s, p) => s + (p.analytics?.likes || 0), 0) || 0
    const totalComments = analytics?.posts?.reduce((s, p) => s + (p.analytics?.comments || 0), 0) || 0
    const totalShares = analytics?.posts?.reduce((s, p) => s + (p.analytics?.shares || 0), 0) || 0
    const totalSaves = analytics?.posts?.reduce((s, p) => s + (p.analytics?.saves || 0), 0) || 0
    return [
      { name: 'Likes', value: totalLikes, color: '#ec4899' },
      { name: 'Comments', value: totalComments, color: '#3b82f6' },
      { name: 'Shares', value: totalShares, color: '#06b6d4' },
      { name: 'Saves', value: totalSaves, color: '#f59e0b' },
    ].filter(d => d.value > 0)
  }, [analytics])

  const topByER = useMemo(() => {
    return [...(analytics?.posts || [])]
      .sort((a, b) => (b.analytics?.engagementRate || 0) - (a.analytics?.engagementRate || 0))
      .slice(0, 8)
      .map((p) => ({
        name: (p.content || 'Post').slice(0, 20) + ((p.content?.length || 0) > 20 ? '...' : ''),
        er: p.analytics?.engagementRate || 0,
        likes: p.analytics?.likes || 0,
        impressions: p.analytics?.impressions || 0,
        thumb: p.thumbnailUrl || p.mediaItems?.[0]?.url,
        url: p.platformPostUrl,
      }))
  }, [analytics])

  // ═══════════════════════════════════════════
  // INTELLIGENCE ENGINE
  // ═══════════════════════════════════════════

  const postComparisons = useMemo(() => {
    if (!analytics?.posts?.length) return []
    const avgER = analytics.posts.reduce((s, p) => s + (p.analytics?.engagementRate || 0), 0) / analytics.posts.length
    const avgLikes = analytics.posts.reduce((s, p) => s + (p.analytics?.likes || 0), 0) / analytics.posts.length
    return [...analytics.posts]
      .sort((a, b) => (b.analytics?.engagementRate || 0) - (a.analytics?.engagementRate || 0))
      .slice(0, 10)
      .map(p => ({
        content: (p.content || 'Post').slice(0, 40) + ((p.content?.length || 0) > 40 ? '...' : ''),
        er: p.analytics?.engagementRate || 0,
        erMultiple: avgER > 0 ? (p.analytics?.engagementRate || 0) / avgER : 0,
        likesMultiple: avgLikes > 0 ? (p.analytics?.likes || 0) / avgLikes : 0,
        thumb: p.thumbnailUrl || p.mediaItems?.[0]?.url,
        url: p.platformPostUrl,
      }))
  }, [analytics])

  const bestTimesToPost = useMemo(() => {
    if (!analytics?.posts?.length) return { byHour: [] as { hour: number; label: string; avgER: number; count: number }[], byDay: [] as { day: string; avgER: number; count: number }[] }
    const hourBuckets: Record<number, { totalER: number; count: number }> = {}
    const dayBuckets: Record<string, { totalER: number; count: number }> = {}
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for (const p of analytics.posts) {
      const date = new Date(p.publishedAt)
      const hour = date.getHours()
      const day = dayNames[date.getDay()]
      const er = p.analytics?.engagementRate || 0
      if (!hourBuckets[hour]) hourBuckets[hour] = { totalER: 0, count: 0 }
      hourBuckets[hour].totalER += er; hourBuckets[hour].count++
      if (!dayBuckets[day]) dayBuckets[day] = { totalER: 0, count: 0 }
      dayBuckets[day].totalER += er; dayBuckets[day].count++
    }
    const byHour = Object.entries(hourBuckets)
      .map(([h, d]) => ({ hour: parseInt(h), label: `${parseInt(h) % 12 || 12}${parseInt(h) >= 12 ? 'pm' : 'am'}`, avgER: d.totalER / d.count, count: d.count }))
      .sort((a, b) => b.avgER - a.avgER)
    const byDay = dayNames.filter(d => dayBuckets[d])
      .map(d => ({ day: d, avgER: dayBuckets[d].totalER / dayBuckets[d].count, count: dayBuckets[d].count }))
      .sort((a, b) => b.avgER - a.avgER)
    return { byHour, byDay }
  }, [analytics])

  const growthData = useMemo(() => {
    if (!analytics?.posts?.length) return []
    const sorted = [...analytics.posts].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
    let cumReach = 0
    return sorted.map((p) => {
      cumReach += p.analytics?.reach || 0
      return {
        date: new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        reach: p.analytics?.reach || 0,
        cumulativeReach: cumReach,
        engagement: (p.analytics?.likes || 0) + (p.analytics?.comments || 0) + (p.analytics?.shares || 0),
      }
    })
  }, [analytics])

  const hashtagAnalysis = useMemo(() => {
    if (!analytics?.posts?.length) return []
    const tagStats: Record<string, { totalER: number; totalLikes: number; count: number }> = {}
    for (const p of analytics.posts) {
      const tags = (p.content || '').match(/#\w+/g) || []
      const er = p.analytics?.engagementRate || 0
      const likes = p.analytics?.likes || 0
      for (const tag of tags) {
        const t = tag.toLowerCase()
        if (!tagStats[t]) tagStats[t] = { totalER: 0, totalLikes: 0, count: 0 }
        tagStats[t].totalER += er; tagStats[t].totalLikes += likes; tagStats[t].count++
      }
    }
    return Object.entries(tagStats)
      .map(([tag, d]) => ({ tag, avgER: d.totalER / d.count, avgLikes: d.totalLikes / d.count, count: d.count }))
      .filter(d => d.count >= 2)
      .sort((a, b) => b.avgER - a.avgER)
      .slice(0, 15)
  }, [analytics])

  const aiRecommendations = useMemo(() => {
    if (!analytics?.posts?.length) return []
    const recs: { emoji: string; title: string; detail: string; type: 'success' | 'info' | 'warning' }[] = []
    const posts = analytics.posts
    const avgER = (arr: typeof posts) => arr.length ? arr.reduce((s, p) => s + (p.analytics?.engagementRate || 0), 0) / arr.length : 0
    const overallER = avgER(posts)

    if (bestTimesToPost.byHour.length > 0) {
      const best = bestTimesToPost.byHour[0]
      recs.push({ emoji: '🕐', title: `Best posting time: ${best.label}`, detail: `Posts at ${best.label} average ${best.avgER.toFixed(1)}% ER (${best.count} posts).`, type: 'info' })
    }
    if (bestTimesToPost.byDay.length > 0) {
      const best = bestTimesToPost.byDay[0]
      recs.push({ emoji: '📅', title: `${best.day}s perform best`, detail: `${best.day} posts average ${best.avgER.toFixed(1)}% ER across ${best.count} posts.`, type: 'info' })
    }
    if (hashtagAnalysis.length > 0) {
      const topTag = hashtagAnalysis[0]
      recs.push({ emoji: '🏷️', title: `${topTag.tag} is your best hashtag`, detail: `Posts with ${topTag.tag} average ${topTag.avgER.toFixed(1)}% ER and ${formatNumber(topTag.avgLikes)} likes.`, type: 'success' })
    }
    const recentPosts = posts.slice(0, 10)
    const olderPosts = posts.slice(10, 20)
    if (recentPosts.length >= 5 && olderPosts.length >= 5) {
      const recentER = avgER(recentPosts)
      const olderER = avgER(olderPosts)
      if (recentER > olderER * 1.1) {
        recs.push({ emoji: '📈', title: 'Engagement trending up', detail: `Recent posts: ${recentER.toFixed(1)}% ER vs older: ${olderER.toFixed(1)}% — ${((recentER / olderER - 1) * 100).toFixed(0)}% improvement!`, type: 'success' })
      } else if (recentER < olderER * 0.9) {
        recs.push({ emoji: '📉', title: 'Engagement dipping', detail: `Recent posts: ${recentER.toFixed(1)}% vs older: ${olderER.toFixed(1)}%. Try new content formats.`, type: 'warning' })
      }
    }
    if (posts.length >= 2) {
      const dates = posts.map(p => new Date(p.publishedAt).getTime()).sort()
      const daySpan = (dates[dates.length - 1] - dates[0]) / 86400000
      const postsPerWeek = daySpan > 0 ? (posts.length / daySpan) * 7 : 0
      if (postsPerWeek < 3) recs.push({ emoji: '⚡', title: 'Post more frequently', detail: `${postsPerWeek.toFixed(1)}x/week. Aim for 4-7 for optimal growth.`, type: 'warning' })
      else if (postsPerWeek >= 5) recs.push({ emoji: '🔥', title: 'Great posting frequency', detail: `${postsPerWeek.toFixed(1)} posts/week — keep it up!`, type: 'success' })
    }
    return recs
  }, [analytics, bestTimesToPost, hashtagAnalysis])

  const sortedPosts = useMemo(() => {
    if (!analytics?.posts?.length) return []
    return [...analytics.posts].sort((a, b) => {
      let aVal: number, bVal: number
      if (sortKey === 'publishedAt') { aVal = new Date(a.publishedAt).getTime(); bVal = new Date(b.publishedAt).getTime() }
      else { aVal = a.analytics?.[sortKey] || 0; bVal = b.analytics?.[sortKey] || 0 }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [analytics, sortKey, sortDir])

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [calendarMonth])

  const postsForDay = useCallback((day: number) => {
    if (!analytics?.posts?.length) return []
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    return analytics.posts.filter(p => {
      const d = new Date(p.publishedAt)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }, [analytics, calendarMonth])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const handleCreatePost = async () => {
    if (!composeText.trim() || selectedPlatforms.length === 0) return
    setPosting(true); setPostSuccess(null); setError(null)
    try {
      const body: { text: string; platforms: string[]; scheduledFor?: string } = { text: composeText, platforms: selectedPlatforms }
      if (scheduleMode === 'schedule' && scheduledFor) body.scheduledFor = new Date(scheduledFor).toISOString()
      const res = await fetch('/api/late/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Failed to create post')
      setPostSuccess(scheduleMode === 'now' ? 'Published!' : 'Scheduled!')
      setComposeText(''); setSelectedPlatforms([]); setScheduledFor(''); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create post') }
    finally { setPosting(false) }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform])
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'insights', label: 'Insights', icon: '🧠' },
    { id: 'compose', label: 'Compose', icon: '✍️' },
    { id: 'accounts', label: 'Accounts', icon: '🔗' },
  ]

  const gridStyle = 'rgba(255,255,255,0.05)'
  const tickStyle = { fill: '#71717a', fontSize: 11 }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-5 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">Social Media</h2>
          <p className="text-xs text-muted-foreground mt-1">Powered by Late API · {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected · Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="px-4 py-2 text-sm bg-secondary/80 text-foreground rounded-xl border border-border hover:bg-secondary transition-all duration-200 disabled:opacity-50">
          ↻ Refresh
        </button>
      </div>

      <div className="border-b border-border flex-shrink-0 overflow-x-auto">
        <div className="flex gap-1 px-4 py-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-500/15 to-pink-500/15 text-foreground border border-violet-500/20 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}>{tab.icon} {tab.label}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 mx-4 mt-4 rounded-xl text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {postSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 mx-4 mt-4 rounded-xl text-sm">✅ {postSuccess}</div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {loading && !analytics ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading social data...</span>
          </div>
        ) : (
          <>
            {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Posts" value={String(analytics?.overview?.totalPosts || 0)} icon="📝" gradient="from-violet-500/20 to-purple-500/5" borderColor="border-violet-500/20" />
                  <StatCard label="Followers" value={formatNumber(totalFollowers)} icon="👥" gradient="from-cyan-500/20 to-blue-500/5" borderColor="border-cyan-500/20" />
                  <StatCard label="Avg Engagement" value={`${avgEngagementRate.toFixed(2)}%`} icon="🔥" gradient="from-orange-500/20 to-red-500/5" borderColor="border-orange-500/20" />
                  <StatCard label="Impressions" value={formatNumber(totalImpressions)} icon="👁" gradient="from-emerald-500/20 to-teal-500/5" borderColor="border-emerald-500/20" />
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Top Performing Posts
                  </h3>
                  {topPosts.length === 0 ? <EmptyState message="No posts yet" /> : (
                    <div className="space-y-3">
                      {topPosts.map((post, idx) => {
                        const thumb = post.thumbnailUrl || post.mediaItems?.[0]?.url
                        return (
                          <div key={idx} className="group">
                            {post.platformPostUrl ? (
                              <a href={post.platformPostUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-200">
                                {thumb && <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/10" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground line-clamp-2 group-hover:text-violet-300 transition-colors">{post.content || 'No caption'}</p>
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">❤️ {formatNumber(post.analytics?.likes || 0)}</span>
                                    <span className="flex items-center gap-1">💬 {formatNumber(post.analytics?.comments || 0)}</span>
                                    <span className="flex items-center gap-1">🔄 {formatNumber(post.analytics?.shares || 0)}</span>
                                    <span className="text-violet-400 font-medium">{(post.analytics?.engagementRate || 0).toFixed(2)}% ER</span>
                                  </div>
                                </div>
                              </a>
                            ) : (
                              <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                                {thumb && <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/10" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground line-clamp-2">{post.content || 'No caption'}</p>
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                    <span>❤️ {formatNumber(post.analytics?.likes || 0)}</span>
                                    <span>💬 {formatNumber(post.analytics?.comments || 0)}</span>
                                    <span>🔄 {formatNumber(post.analytics?.shares || 0)}</span>
                                    <span className="text-violet-400 font-medium">{(post.analytics?.engagementRate || 0).toFixed(2)}% ER</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> Connected Accounts
                    </h3>
                    {accounts.length === 0 ? <EmptyState message="No accounts connected" /> : (
                      <div className="space-y-3">
                        {accounts.map((account, idx) => {
                          const color = getPlatformColor(account.platform)
                          return (
                            <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg ${color.bg} border border-white/5`}>
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center text-white shadow-lg`}>
                                <PlatformIcon platform={account.platform} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground text-sm">{account.displayName || account.username}</div>
                                <div className="text-xs text-muted-foreground">@{account.username} · {formatNumber(account.followersCount)} followers</div>
                              </div>
                              <span className={`w-2 h-2 rounded-full ${account.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500" /> Engagement Summary
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <MiniStat label="Total Likes" value={formatNumber(analytics?.posts?.reduce((s, p) => s + (p.analytics?.likes || 0), 0) || 0)} color="text-pink-400" />
                      <MiniStat label="Total Comments" value={formatNumber(analytics?.posts?.reduce((s, p) => s + (p.analytics?.comments || 0), 0) || 0)} color="text-blue-400" />
                      <MiniStat label="Total Shares" value={formatNumber(analytics?.posts?.reduce((s, p) => s + (p.analytics?.shares || 0), 0) || 0)} color="text-cyan-400" />
                      <MiniStat label="Total Saves" value={formatNumber(analytics?.posts?.reduce((s, p) => s + (p.analytics?.saves || 0), 0) || 0)} color="text-amber-400" />
                      <MiniStat label="Total Reach" value={formatNumber(analytics?.posts?.reduce((s, p) => s + (p.analytics?.reach || 0), 0) || 0)} color="text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ CALENDAR TAB ═══════════════ */}
            {activeTab === 'calendar' && (
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground text-lg">‹</button>
                    <h3 className="text-base font-semibold text-foreground">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground text-lg">›</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-center text-xs text-muted-foreground py-1.5 font-medium">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={i} />
                      const posts = postsForDay(day)
                      const isToday = new Date().getDate() === day && new Date().getMonth() === calendarMonth.getMonth() && new Date().getFullYear() === calendarMonth.getFullYear()
                      return (
                        <button key={i} onClick={() => setCalendarComposeDay(calendarComposeDay === day ? null : day)}
                          className={`h-12 rounded-lg text-sm transition-all relative hover:bg-white/5 flex items-center justify-center ${
                            calendarComposeDay === day ? 'bg-violet-500/15 ring-1 ring-violet-500/30 text-violet-300' : ''
                          } ${isToday ? 'bg-white/5 font-bold text-foreground' : ''} ${posts.length > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {day}
                          {posts.length > 0 && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-500" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {calendarComposeDay !== null && (
                  <div className="bg-card border border-violet-500/20 rounded-xl p-5 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long' })} {calendarComposeDay} — {postsForDay(calendarComposeDay).length} post(s)
                    </h4>
                    {postsForDay(calendarComposeDay).map((post, i) => (
                      <div key={i} className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded-lg truncate">{post.content || 'No caption'}</div>
                    ))}
                    <textarea value={composeText} onChange={e => setComposeText(e.target.value)} placeholder="Write a post for this day..." className="w-full h-20 bg-secondary/50 text-foreground rounded-xl p-3 border border-border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                    <div className="flex items-center gap-3">
                      <input type="time" value={calendarTime} onChange={e => setCalendarTime(e.target.value)} className="bg-secondary/50 text-foreground rounded-lg px-3 py-1.5 border border-border text-sm" />
                      <button onClick={async () => {
                        const [hrs, mins] = calendarTime.split(':').map(Number)
                        const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), calendarComposeDay!, hrs || 9, mins || 0)
                        setScheduledFor(date.toISOString().slice(0, 16))
                        setScheduleMode('schedule')
                        await new Promise(r => setTimeout(r, 50))
                        await handleCreatePost()
                        setCalendarComposeDay(null)
                      }} disabled={!composeText.trim()} className="px-4 py-1.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-lg text-sm font-medium disabled:opacity-40">Schedule</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
            {activeTab === 'analytics' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Published" value={String(analytics?.overview?.publishedPosts || 0)} icon="✅" gradient="from-emerald-500/20 to-teal-500/5" borderColor="border-emerald-500/20" />
                  <StatCard label="Scheduled" value={String(analytics?.overview?.scheduledPosts || 0)} icon="⏰" gradient="from-amber-500/20 to-orange-500/5" borderColor="border-amber-500/20" />
                  <StatCard label="Impressions" value={formatNumber(totalImpressions)} icon="👁" gradient="from-blue-500/20 to-indigo-500/5" borderColor="border-blue-500/20" />
                  <StatCard label="Avg ER" value={`${avgEngagementRate.toFixed(2)}%`} icon="📈" gradient="from-violet-500/20 to-purple-500/5" borderColor="border-violet-500/20" />
                </div>

                {/* Impressions & Reach Chart - NO Tooltip */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Impressions &amp; Reach Over Time
                  </h3>
                  {postChartData.length === 0 ? <EmptyState message="No post data yet" /> : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={postChartData}>
                          <defs>
                            <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                          <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(0)}K` : String(v)} />
                          <Area type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} fill="url(#impressionsGrad)" name="Impressions" />
                          <Area type="monotone" dataKey="reach" stroke="#06b6d4" strokeWidth={2} fill="url(#reachGrad)" name="Reach" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex gap-6 mt-3 justify-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3 h-1 rounded-full bg-violet-500" /> Impressions</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3 h-1 rounded-full bg-cyan-500" /> Reach</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* ER per Post Bar Chart */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500" /> Engagement Rate by Post
                    </h3>
                    {postChartData.length === 0 ? <EmptyState message="No data" /> : (
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={postChartData} barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                            <XAxis dataKey="date" tick={{ ...tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${Number(v || 0)}%`} />
                            <Bar dataKey="engagementRate" radius={[6, 6, 0, 0]} name="ER%">
                              {postChartData.map((_, i) => (
                                <Cell key={i} fill={`hsl(${270 + i * 12}, 70%, ${55 + (i % 3) * 8}%)`} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Engagement Pie */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Engagement Breakdown
                    </h3>
                    {engagementPieData.length === 0 ? <EmptyState message="No engagement data" /> : (
                      <div className="h-[240px] flex items-center">
                        <ResponsiveContainer width="60%" height="100%">
                          <PieChart>
                            <Pie data={engagementPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                              {engagementPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-3">
                          {engagementPieData.map((d, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground">{d.name}</div>
                                <div className="text-sm font-semibold text-foreground tabular-nums">{formatNumber(d.value)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Likes & Comments Trend */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Likes &amp; Comments Trend
                  </h3>
                  {postChartData.length === 0 ? <EmptyState message="No data" /> : (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={postChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                          <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(0)}K` : String(v)} />
                          <Line type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: '#ec4899', r: 3, strokeWidth: 0 }} name="Likes" />
                          <Line type="monotone" dataKey="comments" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} name="Comments" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex gap-6 mt-3 justify-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3 h-1 rounded-full bg-pink-500" /> Likes</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3 h-1 rounded-full bg-blue-500" /> Comments</div>
                  </div>
                </div>

                {/* Top Posts by ER - Visual */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Top Posts by Engagement
                  </h3>
                  {topByER.length === 0 ? <EmptyState message="No posts yet" /> : (
                    <div className="space-y-4">
                      {topByER.map((post, idx) => {
                        const maxER = topByER[0]?.er || 1
                        const barWidth = Math.max(8, (post.er / maxER) * 100)
                        const inner = (
                          <>
                            <div className="flex items-center gap-3 mb-1.5">
                              {post.thumb ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                  <img src={post.thumb} alt="" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/15 to-pink-500/15 flex items-center justify-center shrink-0">
                                  <span className="text-sm">📝</span>
                                </div>
                              )}
                              <span className="text-sm text-foreground truncate flex-1">{post.name}</span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                                <span className="text-violet-400 font-semibold tabular-nums">{post.er.toFixed(2)}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden ml-[52px]">
                              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500" style={{ width: `${barWidth}%` }} />
                            </div>
                          </>
                        )
                        return post.url
                          ? <a key={idx} href={post.url} target="_blank" rel="noopener noreferrer" className="group block cursor-pointer">{inner}</a>
                          : <div key={idx} className="group block">{inner}</div>
                      })}
                    </div>
                  )}
                </div>

                {/* Data Table */}
                <details className="bg-card border border-border rounded-xl overflow-hidden">
                  <summary className="p-4 cursor-pointer text-sm font-semibold text-foreground uppercase tracking-wider hover:bg-white/[0.02] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Detailed Data Table
                  </summary>
                  <div className="overflow-x-auto border-t border-border/50">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-secondary/50">
                        <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Content</th>
                        <SortableHeader label="Date" sortKey="publishedAt" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Impr." sortKey="impressions" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Reach" sortKey="reach" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Likes" sortKey="likes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Cmts" sortKey="comments" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Shares" sortKey="shares" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Saves" sortKey="saves" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="ER%" sortKey="engagementRate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                      </tr></thead>
                      <tbody>
                        {sortedPosts.length === 0 ? (
                          <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No posts found</td></tr>
                        ) : sortedPosts.map((post, idx) => (
                          <tr key={idx} className="border-t border-border/50 hover:bg-white/[0.02]">
                            <td className="p-3 max-w-[250px]"><p className="text-foreground truncate">{post.content || 'No caption'}</p></td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">{formatRelativeTime(post.publishedAt)}</td>
                            <td className="p-3 text-foreground tabular-nums">{formatNumber(post.analytics?.impressions || 0)}</td>
                            <td className="p-3 text-foreground tabular-nums">{formatNumber(post.analytics?.reach || 0)}</td>
                            <td className="p-3 text-foreground tabular-nums">{formatNumber(post.analytics?.likes || 0)}</td>
                            <td className="p-3 text-foreground tabular-nums">{formatNumber(post.analytics?.comments || 0)}</td>
                            <td className="p-3 text-foreground tabular-nums">{formatNumber(post.analytics?.shares || 0)}</td>
                            <td className="p-3 text-foreground tabular-nums">{formatNumber(post.analytics?.saves || 0)}</td>
                            <td className="p-3 text-violet-400 font-medium tabular-nums">{(post.analytics?.engagementRate || 0).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}

            {/* ═══════════════ INSIGHTS TAB ═══════════════ */}
            {activeTab === 'insights' && (
              <div className="space-y-6">
                {aiRecommendations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><span className="text-xl">🤖</span> AI Recommendations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiRecommendations.map((rec, i) => (
                        <div key={i} className={`rounded-xl border p-4 transition-all hover:scale-[1.01] ${
                          rec.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/[0.04]' :
                          rec.type === 'warning' ? 'border-amber-500/30 bg-amber-500/[0.04]' :
                          'border-blue-500/30 bg-blue-500/[0.04]'
                        }`}>
                          <div className="flex items-start gap-3">
                            <span className="text-2xl shrink-0">{rec.emoji}</span>
                            <div>
                              <div className={`font-semibold text-sm ${rec.type === 'success' ? 'text-emerald-400' : rec.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>{rec.title}</div>
                              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.detail}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {postComparisons.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><span>📊</span> Post Performance vs Average</h3>
                    <div className="space-y-3">
                      {postComparisons.map((post, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {post.thumb && <img src={post.thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate text-foreground">{post.content}</div>
                            <div className="flex gap-3 mt-1">
                              <span className={`text-xs font-medium ${post.erMultiple >= 2 ? 'text-emerald-400' : post.erMultiple >= 1 ? 'text-blue-400' : 'text-amber-400'}`}>
                                {post.erMultiple >= 1 ? '↑' : '↓'} {post.erMultiple.toFixed(1)}x ER
                              </span>
                              <span className={`text-xs font-medium ${post.likesMultiple >= 2 ? 'text-emerald-400' : post.likesMultiple >= 1 ? 'text-blue-400' : 'text-amber-400'}`}>
                                {post.likesMultiple >= 1 ? '↑' : '↓'} {post.likesMultiple.toFixed(1)}x likes
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-foreground">{post.er.toFixed(1)}%</div>
                            <div className="text-[10px] text-muted-foreground">ER</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {bestTimesToPost.byHour.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><span>🕐</span> Best Hours to Post</h3>
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bestTimesToPost.byHour.slice(0, 12)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                            <XAxis dataKey="label" tick={{ ...tickStyle, fontSize: 10 }} />
                            <YAxis tick={tickStyle} tickFormatter={(v) => `${Number(v || 0).toFixed(1)}%`} />
                            <Bar dataKey="avgER" radius={[6, 6, 0, 0]}>
                              {bestTimesToPost.byHour.slice(0, 12).map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#10b981' : i < 3 ? '#3b82f6' : '#6366f1'} fillOpacity={1 - i * 0.06} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground text-center">
                        🏆 Best: <span className="text-emerald-400 font-medium">{bestTimesToPost.byHour[0]?.label}</span> ({bestTimesToPost.byHour[0]?.count} posts, {bestTimesToPost.byHour[0]?.avgER.toFixed(1)}% avg ER)
                      </div>
                    </div>
                  )}
                  {bestTimesToPost.byDay.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><span>📅</span> Best Days to Post</h3>
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bestTimesToPost.byDay} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                            <XAxis type="number" tick={tickStyle} tickFormatter={(v) => `${Number(v || 0).toFixed(1)}%`} />
                            <YAxis dataKey="day" type="category" tick={tickStyle} width={80} />
                            <Bar dataKey="avgER" radius={[0, 6, 6, 0]}>
                              {bestTimesToPost.byDay.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#10b981' : i < 3 ? '#06b6d4' : '#8b5cf6'} fillOpacity={1 - i * 0.1} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground text-center">
                        🏆 Best: <span className="text-emerald-400 font-medium">{bestTimesToPost.byDay[0]?.day}</span> ({bestTimesToPost.byDay[0]?.count} posts)
                      </div>
                    </div>
                  )}
                </div>

                {growthData.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><span>📈</span> Reach Growth Over Time</h3>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthData}>
                          <defs>
                            <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                          <XAxis dataKey="date" tick={{ ...tickStyle, fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={tickStyle} tickFormatter={(v) => formatNumber(Number(v || 0))} />
                          <Area type="monotone" dataKey="cumulativeReach" stroke="#10b981" strokeWidth={2} fill="url(#growthGrad)" name="Cumulative Reach" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {hashtagAnalysis.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><span>🏷️</span> Hashtag Performance</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {hashtagAnalysis.map((h, i) => (
                        <div key={i} className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs">
                          <span className="text-violet-400 font-medium">{h.tag}</span>
                          <span className="text-muted-foreground ml-1.5">{h.avgER.toFixed(1)}% · {h.count} posts · {formatNumber(h.avgLikes)} avg likes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {growthData.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><span>⚡</span> Engagement Trend</h3>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                          <XAxis dataKey="date" tick={{ ...tickStyle, fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={tickStyle} tickFormatter={(v) => formatNumber(Number(v || 0))} />
                          <Line type="monotone" dataKey="engagement" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="Total Engagement" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-xs text-muted-foreground text-center mt-2">Engagement = Likes + Comments + Shares per post</div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ COMPOSE TAB ═══════════════ */}
            {activeTab === 'compose' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Caption</label>
                    <textarea value={composeText} onChange={e => setComposeText(e.target.value)} placeholder="Write your caption..."
                      className="w-full h-32 bg-secondary/50 text-foreground rounded-xl p-4 border border-border focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none" />
                    <div className="text-xs text-muted-foreground mt-1 text-right">{composeText.length} characters</div>
                  </div>
                  {accounts.length > 0 && (
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">Platforms</label>
                      <div className="flex flex-wrap gap-2">
                        {accounts.map((account, idx) => {
                          const color = getPlatformColor(account.platform)
                          return (
                            <button key={idx} onClick={() => togglePlatform(account.platform)}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                                selectedPlatforms.includes(account.platform) ? `${color.bg} border-white/20 ${color.text}` : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground'
                              }`}>
                              <PlatformIcon platform={account.platform} />
                              <span className="text-sm">@{account.username}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setScheduleMode('now')}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${scheduleMode === 'now' ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white' : 'bg-secondary/50 text-muted-foreground border border-border'}`}>Post Now</button>
                    <button onClick={() => setScheduleMode('schedule')}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${scheduleMode === 'schedule' ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white' : 'bg-secondary/50 text-muted-foreground border border-border'}`}>⏰ Schedule</button>
                  </div>
                  {scheduleMode === 'schedule' && (
                    <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                      className="bg-secondary/50 text-foreground rounded-xl px-4 py-2.5 border border-border focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
                  )}
                  <button onClick={handleCreatePost} disabled={posting || !composeText.trim() || selectedPlatforms.length === 0}
                    className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {posting ? 'Publishing...' : scheduleMode === 'now' ? '🚀 Publish Now' : '⏰ Schedule Post'}
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════ ACCOUNTS TAB ═══════════════ */}
            {activeTab === 'accounts' && (
              <div className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="flex flex-col items-center py-16 space-y-4">
                    <span className="text-3xl">🔗</span>
                    <p className="text-muted-foreground">No connected accounts</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {accounts.map((account, idx) => {
                      const color = getPlatformColor(account.platform)
                      return (
                        <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden">
                          <div className={`h-2 bg-gradient-to-r ${color.from} ${color.to}`} />
                          <div className="p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center text-white shadow-lg`}>
                                  <PlatformIcon platform={account.platform} size="lg" />
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground">{account.displayName || account.username}</div>
                                  <div className="text-sm text-muted-foreground">@{account.username}</div>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${account.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                                {account.isActive ? '● Active' : '● Disconnected'}
                              </span>
                            </div>
                            <div className="mt-5 grid grid-cols-3 gap-4">
                              <div className="text-center p-3 rounded-lg bg-secondary/30">
                                <div className="font-bold text-foreground text-lg tabular-nums">{formatNumber(account.followersCount)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">Followers</div>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-secondary/30">
                                <div className="font-bold text-foreground text-lg tabular-nums">{String(account.externalPostCount || 0)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">Posts</div>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-secondary/30">
                                <div className="font-bold text-foreground text-lg tabular-nums">
                                  {account.analyticsLastSyncedAt ? formatRelativeTime(account.analyticsLastSyncedAt) : '—'}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">Last Sync</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════

function StatCard({ label, value, icon, gradient, borderColor }: {
  label: string; value: string; icon: string; gradient: string; borderColor: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderColor} p-4 transition-all duration-300 hover:scale-[1.02]`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2"><span className="text-lg">{icon}</span></div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-secondary/30">
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-muted-foreground">
      <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3"><span className="text-xl">📭</span></div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function PlatformIcon({ platform, size }: { platform: string; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  switch (platform.toLowerCase()) {
    case 'instagram': return <svg viewBox="0 0 24 24" fill="currentColor" className={cls}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
    default: return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}><circle cx="8" cy="8" r="6" /><path d="M8 4v8M4 8h8" strokeLinecap="round" /></svg>
  }
}

function SortableHeader({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir; onSort: (key: SortKey) => void
}) {
  const isActive = currentKey === sortKey
  return (
    <th className="text-left p-3 text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none text-xs uppercase tracking-wider" onClick={() => onSort(sortKey)}>
      <div className="flex items-center gap-1">
        {label}
        {isActive && <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 ${currentDir === 'asc' ? 'rotate-180' : ''}`}><path d="M8 11L4 6h8l-4 5z" /></svg>}
      </div>
    </th>
  )
}
