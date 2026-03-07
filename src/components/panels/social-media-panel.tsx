'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  LateAccount,
  LateAnalyticsResponse,
  LateAnalyticsPost,
} from '@/types/late'

type TabId = 'overview' | 'analytics' | 'compose' | 'accounts'

type SortKey = 'publishedAt' | 'impressions' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagementRate'
type SortDir = 'asc' | 'desc'

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

  // Analytics sort state
  const [sortKey, setSortKey] = useState<SortKey>('engagementRate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [accountsRes, analyticsRes] = await Promise.all([
        fetch('/api/late/accounts'),
        fetch('/api/late/analytics'),
      ])

      if (!accountsRes.ok || !analyticsRes.ok) {
        throw new Error('Failed to fetch data from Late API')
      }

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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Format large numbers: 253542 -> "253.5K"
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Calculate average engagement rate
  const avgEngagementRate = useMemo(() => {
    if (!analytics?.posts?.length) return 0
    const total = analytics.posts.reduce((sum, p) => sum + (p.analytics?.engagementRate || 0), 0)
    return total / analytics.posts.length
  }, [analytics])

  // Calculate total impressions
  const totalImpressions = useMemo(() => {
    if (!analytics?.posts?.length) return 0
    return analytics.posts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0)
  }, [analytics])

  // Get total followers from first account
  const totalFollowers = useMemo(() => {
    if (!accounts.length) return 0
    return accounts.reduce((sum, a) => sum + (a.followersCount || 0), 0)
  }, [accounts])

  // Top 5 posts by engagement rate
  const topPosts = useMemo(() => {
    if (!analytics?.posts?.length) return []
    return [...analytics.posts]
      .sort((a, b) => (b.analytics?.engagementRate || 0) - (a.analytics?.engagementRate || 0))
      .slice(0, 5)
  }, [analytics])

  // Sorted posts for analytics table
  const sortedPosts = useMemo(() => {
    if (!analytics?.posts?.length) return []
    return [...analytics.posts].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      if (sortKey === 'publishedAt') {
        aVal = new Date(a.publishedAt).getTime()
        bVal = new Date(b.publishedAt).getTime()
      } else {
        aVal = a.analytics?.[sortKey] || 0
        bVal = b.analytics?.[sortKey] || 0
      }

      if (sortDir === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })
  }, [analytics, sortKey, sortDir])

  // Handle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Handle post creation
  const handleCreatePost = async () => {
    if (!composeText.trim() || selectedPlatforms.length === 0) return

    setPosting(true)
    setPostSuccess(null)
    setError(null)

    try {
      const body: { text: string; platforms: string[]; scheduledFor?: string } = {
        text: composeText,
        platforms: selectedPlatforms,
      }
      if (scheduleMode === 'schedule' && scheduledFor) {
        body.scheduledFor = new Date(scheduledFor).toISOString()
      }

      const res = await fetch('/api/late/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error('Failed to create post')
      }

      setPostSuccess(scheduleMode === 'now' ? 'Post published successfully!' : 'Post scheduled successfully!')
      setComposeText('')
      setSelectedPlatforms([])
      setScheduledFor('')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setPosting(false)
    }
  }

  // Toggle platform selection
  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        )
      case 'twitter':
      case 'x':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )
      case 'facebook':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )
      case 'linkedin':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        )
      case 'tiktok':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
        )
      default:
        return (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4v8M4 8h8" strokeLinecap="round" />
          </svg>
        )
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'compose', label: 'Compose' },
    { id: 'accounts', label: 'Accounts' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Social Media</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            Powered by Late
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-smooth disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border flex-shrink-0">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-smooth border-b-2 ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 m-4 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-2">
            x
          </button>
        </div>
      )}

      {/* Success Display */}
      {postSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 m-4 rounded-lg text-sm flex items-center justify-between">
          <span>{postSuccess}</span>
          <button onClick={() => setPostSuccess(null)} className="text-green-400/60 hover:text-green-400 ml-2">
            x
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && !analytics ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-muted-foreground text-sm">Loading social data...</span>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground">
                      {analytics?.overview?.totalPosts || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Posts</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground">{formatNumber(totalFollowers)}</div>
                    <div className="text-sm text-muted-foreground">Followers</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground">{avgEngagementRate.toFixed(2)}%</div>
                    <div className="text-sm text-muted-foreground">Avg Engagement Rate</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground">{formatNumber(totalImpressions)}</div>
                    <div className="text-sm text-muted-foreground">Total Impressions</div>
                  </div>
                </div>

                {/* Top 5 Posts */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Top 5 Posts</h3>
                  {topPosts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No posts yet</p>
                  ) : (
                    <div className="space-y-3">
                      {topPosts.map((post, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 bg-secondary rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground line-clamp-2">
                              {post.content || 'No caption'}
                            </p>
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{post.analytics?.likes || 0} likes</span>
                              <span>{post.analytics?.comments || 0} comments</span>
                              <span>{post.analytics?.shares || 0} shares</span>
                              <span className="text-primary">
                                {(post.analytics?.engagementRate || 0).toFixed(2)}% ER
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connected Accounts */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Connected Accounts</h3>
                  {accounts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No connected accounts</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {accounts.map((account, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg"
                        >
                          <span className="text-foreground">{getPlatformIcon(account.platform)}</span>
                          <span className="text-sm text-foreground">@{account.username}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              account.isActive ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-lg font-bold text-foreground">
                      {analytics?.overview?.publishedPosts || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Published</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-lg font-bold text-foreground">
                      {analytics?.overview?.scheduledPosts || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Scheduled</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-lg font-bold text-foreground">{formatNumber(totalImpressions)}</div>
                    <div className="text-xs text-muted-foreground">Total Impressions</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-lg font-bold text-foreground">{avgEngagementRate.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">Avg ER</div>
                  </div>
                </div>

                {/* Posts Table */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary">
                        <tr>
                          <th className="text-left p-3 text-muted-foreground font-medium">Content</th>
                          <SortableHeader
                            label="Date"
                            sortKey="publishedAt"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Impr."
                            sortKey="impressions"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Reach"
                            sortKey="reach"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Likes"
                            sortKey="likes"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Comments"
                            sortKey="comments"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Shares"
                            sortKey="shares"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Saves"
                            sortKey="saves"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="ER%"
                            sortKey="engagementRate"
                            currentKey={sortKey}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPosts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-4 text-center text-muted-foreground">
                              No posts found
                            </td>
                          </tr>
                        ) : (
                          sortedPosts.map((post, idx) => (
                            <PostRow key={idx} post={post} formatRelativeTime={formatRelativeTime} formatNumber={formatNumber} />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Compose Tab */}
            {activeTab === 'compose' && (
              <div className="max-w-2xl space-y-6">
                {/* Caption Textarea */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Caption</label>
                  <textarea
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    placeholder="Write your caption..."
                    className="w-full h-32 bg-secondary text-foreground rounded-lg p-3 border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    {composeText.length} characters
                  </div>
                </div>

                {/* Platform Selector */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Platforms</label>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No connected accounts</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {accounts.map((account, idx) => (
                        <button
                          key={idx}
                          onClick={() => togglePlatform(account.platform)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-smooth ${
                            selectedPlatforms.includes(account.platform)
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-secondary border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {getPlatformIcon(account.platform)}
                          <span className="text-sm">@{account.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Schedule Toggle */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Timing</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setScheduleMode('now')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
                        scheduleMode === 'now'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Post Now
                    </button>
                    <button
                      onClick={() => setScheduleMode('schedule')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
                        scheduleMode === 'schedule'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Schedule
                    </button>
                  </div>

                  {scheduleMode === 'schedule' && (
                    <div className="mt-3">
                      <input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="bg-secondary text-foreground rounded-lg px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    onClick={handleCreatePost}
                    disabled={posting || !composeText.trim() || selectedPlatforms.length === 0}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting ? 'Posting...' : scheduleMode === 'now' ? 'Publish Now' : 'Schedule Post'}
                  </button>
                </div>
              </div>
            )}

            {/* Accounts Tab */}
            {activeTab === 'accounts' && (
              <div className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No connected accounts</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {accounts.map((account, idx) => (
                      <div key={idx} className="bg-card border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground">
                              {getPlatformIcon(account.platform)}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{account.displayName}</div>
                              <div className="text-sm text-muted-foreground">@{account.username}</div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              account.isActive
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {account.isActive ? 'Active' : 'Disconnected'}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-foreground">
                              {formatNumber(account.followersCount)}
                            </div>
                            <div className="text-xs text-muted-foreground">Followers</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {account.externalPostCount}
                            </div>
                            <div className="text-xs text-muted-foreground">Posts Synced</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {account.analyticsLastSyncedAt
                                ? formatRelativeTime(account.analyticsLastSyncedAt)
                                : 'Never'}
                            </div>
                            <div className="text-xs text-muted-foreground">Last Sync</div>
                          </div>
                        </div>
                      </div>
                    ))}
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

// Sortable table header component
function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const isActive = currentKey === sortKey
  return (
    <th
      className="text-left p-3 text-muted-foreground font-medium cursor-pointer hover:text-foreground transition-smooth select-none"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3 h-3 transition-transform ${currentDir === 'asc' ? 'rotate-180' : ''}`}
          >
            <path d="M8 11L4 6h8l-4 5z" />
          </svg>
        )}
      </div>
    </th>
  )
}

// Post row component
function PostRow({
  post,
  formatRelativeTime,
  formatNumber,
}: {
  post: LateAnalyticsPost
  formatRelativeTime: (date: string) => string
  formatNumber: (num: number) => string
}) {
  return (
    <tr className="border-t border-border hover:bg-secondary/50 transition-smooth">
      <td className="p-3 max-w-[200px]">
        <p className="text-foreground truncate">{post.content || 'No caption'}</p>
      </td>
      <td className="p-3 text-muted-foreground whitespace-nowrap">
        {formatRelativeTime(post.publishedAt)}
      </td>
      <td className="p-3 text-foreground">{formatNumber(post.analytics?.impressions || 0)}</td>
      <td className="p-3 text-foreground">{formatNumber(post.analytics?.reach || 0)}</td>
      <td className="p-3 text-foreground">{formatNumber(post.analytics?.likes || 0)}</td>
      <td className="p-3 text-foreground">{formatNumber(post.analytics?.comments || 0)}</td>
      <td className="p-3 text-foreground">{formatNumber(post.analytics?.shares || 0)}</td>
      <td className="p-3 text-foreground">{formatNumber(post.analytics?.saves || 0)}</td>
      <td className="p-3 text-primary font-medium">
        {(post.analytics?.engagementRate || 0).toFixed(2)}%
      </td>
    </tr>
  )
}
