// Late API TypeScript interfaces
// Base URL: https://getlate.dev/api/v1

export interface LateProfile {
  _id: string
  name: string
  accountUsernames: string[]
}

export interface LateAccount {
  platform: string
  displayName: string
  followersCount: number
  externalPostCount: number
  isActive: boolean
  username: string
  analyticsLastSyncedAt?: string
}

export interface LateMediaItem {
  type: string
  url: string
  filename: string
  size: number
  mimeType: string
  _id?: string
}

export interface LatePost {
  _id: string
  content: string
  mediaItems: LateMediaItem[]
  status: string
  platforms: string[]
}

export interface LatePostAnalytics {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  views: number
  engagementRate: number
}

export interface LatePlatformInfo {
  platform: string
  status: string
  accountId: string
  accountUsername: string
  analytics?: LatePostAnalytics
}

export interface LateAnalyticsPost {
  _id: string
  content: string
  publishedAt: string
  status: string
  analytics: LatePostAnalytics
  platformPostUrl?: string
  thumbnailUrl?: string
  mediaType?: string
  mediaItems?: LateMediaItem[]
  platforms?: LatePlatformInfo[]
  platform?: string
  isExternal?: boolean
}

export interface LateAnalyticsOverview {
  totalPosts: number
  publishedPosts: number
  scheduledPosts: number
  lastSync: string
}

export interface LateAnalyticsResponse {
  overview: LateAnalyticsOverview
  posts: LateAnalyticsPost[]
}

export interface LateProfilesResponse {
  profiles: LateProfile[]
}

export interface LateAccountsResponse {
  accounts: LateAccount[]
}

export interface LatePostsResponse {
  posts: LatePost[]
}

export interface LatePresignResponse {
  url: string
  fields: Record<string, string>
  publicUrl: string
}

export interface LateConnectResponse {
  auth_url: string
}

export interface LateCreatePostRequest {
  text: string
  platforms: string[]
  mediaUrls?: string[]
  scheduledFor?: string
}
