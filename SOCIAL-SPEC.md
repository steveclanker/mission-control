# Social Media Panel — Mission Control Integration

## Overview
Add a Social Media panel to Mission Control that pulls all data from the Late API (getlate.dev). This gives us analytics, post management, scheduling, and account management all within Mission Control.

## Late API Details
- **Base URL:** `https://getlate.dev/api/v1`
- **Auth Header:** `Authorization: Bearer <LATE_API_KEY>`
- **Env var:** `LATE_API_KEY` (add to `.env`)

### Confirmed Working Endpoints
- `GET /profiles` → `{ profiles: [{ _id, name, accountUsernames: ["becomelumos"] }] }`
- `GET /accounts` → `{ accounts: [{ platform: "instagram", displayName: "LUMOS", followersCount: 253542, externalPostCount: 44, isActive: true, username: "becomelumos", analyticsLastSyncedAt }] }`
- `GET /posts` → `{ posts: [{ _id, content, mediaItems: [{type, url, filename, size, mimeType}], status, platforms }] }`
- `GET /analytics` → `{ overview: { totalPosts: 45, publishedPosts: 45, scheduledPosts: 0, lastSync }, posts: [{ content, publishedAt, status, analytics: { impressions, reach, likes, comments, shares, saves, clicks, views, engagementRate } }] }`
- `POST /posts` → Create post with `{ text, platforms: ["twitter","instagram"], mediaUrls: [...], scheduledFor }`
- `POST /media/presign` → Get presigned upload URL
- `GET /connect/{platform}?profileId={id}` → Returns `{ auth_url }` for OAuth connect

## Architecture

### 1. API Routes (server-side, keeps API key secret)
Create under `src/app/api/late/`:
- `profiles/route.ts` → GET proxy
- `accounts/route.ts` → GET proxy  
- `posts/route.ts` → GET + POST proxy
- `analytics/route.ts` → GET proxy
- `media/presign/route.ts` → POST proxy

Each route reads `LATE_API_KEY` from `process.env` and proxies to Late API. Return JSON.

### 2. Nav Item
Add to `src/components/layout/nav-rail.tsx`:
- In the `core` group or a new `social` group
- ID: `social`
- Label: `Social`
- Icon: A social/share icon (use inline SVG matching existing style)
- Priority: true (show on mobile)

### 3. Content Router
Add to `src/app/[[...panel]]/page.tsx`:
```tsx
case 'social':
  return <SocialMediaPanel />
```

### 4. Panel Component
Create `src/components/panels/social-media-panel.tsx`

This is a TABBED panel with 4 sub-tabs:

#### Tab 1: Overview (default)
- **Stats row:** 4 cards matching MC's existing card style
  - Total Posts (from analytics.overview.totalPosts)
  - Followers (from accounts[0].followersCount) — format as "253.5K"
  - Avg Engagement Rate (calculate average ER from posts)
  - Total Impressions (sum from all posts)
- **Top 5 Posts:** Cards showing thumbnail (mediaItems[0].url), content snippet, and metrics (likes, comments, shares, ER%)
- **Connected Accounts:** Small section showing platform + username + status

#### Tab 2: Analytics
- **Posts table:** Sortable by any metric column
  - Columns: Thumbnail | Content | Date | Impressions | Reach | Likes | Comments | Shares | Saves | ER%
  - All 45 posts
  - Sort by clicking column headers
  - Default sort: by engagement rate descending
- **Summary stats** at top

#### Tab 3: Compose
- **Caption textarea** (dark, matching MC theme)
- **Media section:** Show "Upload Media" button (uses presign endpoint)
- **Platform selector:** Checkboxes for connected platforms (from /accounts)
- **Schedule:** Toggle between "Post Now" and "Schedule" with datetime picker
- **Submit button:** POST to /api/late/posts

#### Tab 4: Accounts
- **Connected accounts list:** Card per account showing:
  - Platform icon + name
  - Username
  - Followers count
  - Posts synced
  - Last sync time
  - Status badge (active/disconnected)
- **Connect button** for adding new platforms

### 5. Styling Rules
- **MUST match existing Mission Control design language exactly**
- Use the same card styles, borders, colors as other panels
- Use `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground` etc.
- Use the same table styling as other MC tables
- Tabs should use a simple underline-style tab bar (matching MC patterns)
- NO custom colors — use MC's design tokens
- Format large numbers: 253542 → "253.5K", 28462 → "28.5K"
- Dates: relative time ("2 days ago") or short format

### 6. Types
Create `src/types/late.ts` with TypeScript interfaces for all Late API responses.

## Implementation Order
1. Types (`src/types/late.ts`)
2. API routes (`src/app/api/late/*`)
3. Panel component (`src/components/panels/social-media-panel.tsx`)
4. Nav item (update `nav-rail.tsx`)
5. Router (update `page.tsx`)
6. Build + verify

## DO NOT
- Don't touch any existing panels or components (except nav-rail and page.tsx router)
- Don't add new npm dependencies
- Don't change the theme or design tokens
- Don't use Supabase for social data
