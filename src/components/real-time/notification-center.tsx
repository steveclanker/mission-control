'use client'

import { useState } from 'react'
import { useNotifications, Notification } from '@/lib/real-time-hub'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  UserPlus, 
  AtSign, 
  Bot,
  Check,
  CheckCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NOTIFICATION_ICONS: Record<Notification['type'], React.ReactNode> = {
  task_completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  task_failed: <XCircle className="w-4 h-4 text-red-500" />,
  agent_online: <Bot className="w-4 h-4 text-blue-500" />,
  agent_offline: <Bot className="w-4 h-4 text-gray-400" />,
  mention: <AtSign className="w-4 h-4 text-purple-500" />,
  assignment: <UserPlus className="w-4 h-4 text-amber-500" />
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs"
            onClick={refresh}
          >
            Refresh
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationItem({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification
  onMarkAsRead: () => void
}) {
  return (
    <div 
      className={cn(
        "p-3 hover:bg-muted/50 transition-colors cursor-pointer",
        !notification.read && "bg-primary/5"
      )}
      onClick={onMarkAsRead}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {NOTIFICATION_ICONS[notification.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              "text-sm truncate",
              !notification.read && "font-medium"
            )}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTimestamp(notification.timestamp)}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Minimal notification indicator for mobile
 */
export function NotificationBadge() {
  const { unreadCount } = useNotifications()
  
  if (unreadCount === 0) return null
  
  return (
    <Badge 
      variant="destructive" 
      className="h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  )
}