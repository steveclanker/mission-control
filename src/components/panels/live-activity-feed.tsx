'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, AlertCircle, Users, Zap } from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'task' | 'agent' | 'system' | 'social'
  title: string
  description: string
  timestamp: string
  status: 'success' | 'warning' | 'info' | 'error'
  agent?: string
  icon?: React.ReactNode
}

export function LiveActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([])

  // Mock live activities for demo purposes
  useEffect(() => {
    const generateActivity = (): ActivityItem => {
      const agents = ['iris', 'nova', 'sage', 'axel', 'kai']
      const activities = [
        {
          type: 'task' as const,
          titles: [
            'Completed social media analysis',
            'Updated content calendar',
            'Processed customer feedback',
            'Generated performance report',
            'Optimized workflow automation'
          ],
          descriptions: [
            'Analyzed 47 posts across platforms',
            'Scheduled 12 posts for this week',
            'Categorized 28 new feedback items',
            'Generated insights from Q1 data',
            'Improved response time by 23%'
          ],
          status: 'success' as const,
          icon: <CheckCircle2 className="h-4 w-4" />
        },
        {
          type: 'agent' as const,
          titles: [
            'Agent status updated',
            'New session started',
            'Workflow optimization',
            'Knowledge base update',
            'Performance metrics sync'
          ],
          descriptions: [
            'Connected to primary workspace',
            'Initialized customer service flow',
            'Reduced processing time by 15%',
            'Added 23 new data points',
            'Synced with external APIs'
          ],
          status: 'info' as const,
          icon: <Users className="h-4 w-4" />
        },
        {
          type: 'system' as const,
          titles: [
            'API integration successful',
            'Database optimization complete',
            'Security scan passed',
            'Backup completed',
            'Performance metrics updated'
          ],
          descriptions: [
            'Late API responding normally',
            'Query performance improved 40%',
            'No vulnerabilities detected',
            'All data secured successfully',
            'System running at 81% efficiency'
          ],
          status: 'info' as const,
          icon: <Zap className="h-4 w-4" />
        },
        {
          type: 'social' as const,
          titles: [
            'Instagram insights updated',
            'Content engagement analyzed',
            'Follower growth tracked',
            'Post performance measured',
            'Analytics dashboard refreshed'
          ],
          descriptions: [
            'LUMOS account: +247 new followers',
            'Engagement rate improved to 7.4%',
            'Monthly growth: +2.1%',
            'Top post reached 42K impressions',
            'Real-time data synchronized'
          ],
          status: 'success' as const,
          icon: <CheckCircle2 className="h-4 w-4" />
        }
      ]

      const category = activities[Math.floor(Math.random() * activities.length)]
      const titleIndex = Math.floor(Math.random() * category.titles.length)

      return {
        id: `activity-${Date.now()}-${Math.random()}`,
        type: category.type,
        title: category.titles[titleIndex],
        description: category.descriptions[titleIndex],
        timestamp: new Date().toISOString(),
        status: category.status,
        agent: agents[Math.floor(Math.random() * agents.length)],
        icon: category.icon
      }
    }

    // Add initial activities
    const initialActivities = Array.from({ length: 8 }, () => generateActivity())
    setActivities(initialActivities)

    // Add new activity every 3-7 seconds
    const interval = setInterval(() => {
      const newActivity = generateActivity()
      setActivities(prev => [newActivity, ...prev.slice(0, 19)]) // Keep last 20
    }, Math.random() * 4000 + 3000) // 3-7 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-500'
      case 'warning': return 'text-yellow-500'
      case 'error': return 'text-red-500'
      default: return 'text-blue-500'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/10 border-green-500/20'
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20'
      case 'error': return 'bg-red-500/10 border-red-500/20'
      default: return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`p-3 rounded-lg border transition-all duration-300 hover:scale-[1.02] ${getStatusBg(activity.status)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`mt-0.5 ${getStatusColor(activity.status)}`}>
                    {activity.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm text-foreground truncate">
                        {activity.title}
                      </h4>
                      {activity.agent && (
                        <Badge variant="secondary" className="text-xs">
                          {activity.agent}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {activity.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}