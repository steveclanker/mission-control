import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  description?: string
  location?: string
  attendees?: string[]
  calendar_name?: string
}

export async function GET() {
  try {
    // Get today's date for filtering
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

    console.log('Fetching calendar events for today:', startOfDay, 'to', endOfDay)

    // Use gog CLI to fetch calendar events for today
    const { stdout, stderr } = await execAsync(
      `gog calendar events --from "${startOfDay}" --to "${endOfDay}" --json`
    )

    if (stderr) {
      console.error('gog calendar stderr:', stderr)
    }

    // Parse the calendar events
    let events: any[] = []
    
    try {
      const rawData = JSON.parse(stdout)
      events = Array.isArray(rawData) ? rawData : rawData.events || []
    } catch (parseError) {
      console.error('Failed to parse calendar response:', parseError)
      console.log('Raw stdout:', stdout)
      return NextResponse.json({ events: [] })
    }

    // Transform events to our format
    const formattedEvents: CalendarEvent[] = events.map((event: any) => {
      // Handle different date formats from Google Calendar
      const start = event.start?.dateTime || event.start?.date
      const end = event.end?.dateTime || event.end?.date

      // Extract attendees list
      const attendees = event.attendees?.map((a: any) => a.email || a.displayName).filter(Boolean) || []

      return {
        id: event.id || event.iCalUID || `event_${Date.now()}_${Math.random()}`,
        title: event.summary || event.title || 'Untitled Event',
        start_time: start || startOfDay,
        end_time: end || startOfDay,
        description: event.description || '',
        location: event.location || '',
        attendees,
        calendar_name: event.organizer?.displayName || 'Calendar'
      }
    })

    // Filter to only include today's events and sort by start time
    const todayEvents = formattedEvents
      .filter(event => {
        const eventStart = new Date(event.start_time)
        return eventStart >= new Date(startOfDay) && eventStart < new Date(endOfDay)
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    console.log(`Found ${todayEvents.length} events for today`)

    return NextResponse.json({
      events: todayEvents,
      count: todayEvents.length,
      date: today.toISOString()
    })

  } catch (error) {
    console.error('Calendar API error:', error)
    
    // Return mock data for demo purposes if calendar fails
    const today = new Date()
    const mockEvents: CalendarEvent[] = [
      {
        id: 'demo_1',
        title: 'Andrew Raslan - Deploy ACN Setup',
        start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString(),
        end_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30).toISOString(),
        description: 'Deploy company ACN setup + crypto discussion',
        location: 'Video call',
        attendees: ['andrew.raslan@email.com'],
        calendar_name: 'Work'
      },
      {
        id: 'demo_2', 
        title: 'Simulation Service Demo Prep',
        start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
        end_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0).toISOString(),
        description: 'Prepare MiroFish simulation service demonstration',
        attendees: [],
        calendar_name: 'Deploy Your Agent'
      },
      {
        id: 'demo_3',
        title: 'La Louisiane Dinner', 
        start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30).toISOString(),
        end_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 21, 30).toISOString(),
        description: 'Dinner reservation',
        location: 'La Louisiane Restaurant',
        attendees: [],
        calendar_name: 'Personal'
      }
    ]

    return NextResponse.json({
      events: mockEvents,
      count: mockEvents.length,
      date: today.toISOString(),
      mock: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}