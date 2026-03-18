import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import fs from 'fs'
import path from 'path'

// Load Shopify creds
const credsPath = path.join(process.env.HOME || '/Users/steve', 'agent', '.shopify_creds.env')
let STORE = '', TOKEN = '', CLIENT_ID = '', CLIENT_SECRET = ''
if (fs.existsSync(credsPath)) {
  fs.readFileSync(credsPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) return
    const [, k, v] = m
    if (k.trim() === 'SHOPIFY_STORE') STORE = v.trim()
    if (k.trim() === 'SHOPIFY_ACCESS_TOKEN') TOKEN = v.trim()
    if (k.trim() === 'SHOPIFY_CLIENT_ID') CLIENT_ID = v.trim()
    if (k.trim() === 'SHOPIFY_CLIENT_SECRET') CLIENT_SECRET = v.trim()
  })
}

function shopifyGet(store: string, token: string, endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: store,
      path: `/admin/api/2024-01${endpoint}`,
      method: 'GET',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    }, res => {
      let data = ''
      res.on('data', (c: Buffer) => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }) }
        catch { resolve({ status: res.statusCode, data, headers: res.headers }) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function refreshToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' })
    const req = https.request({
      hostname: STORE,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = ''
      res.on('data', (c: Buffer) => data += c)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.access_token) {
            TOKEN = parsed.access_token
            // Update creds file
            const content = fs.readFileSync(credsPath, 'utf8')
            fs.writeFileSync(credsPath, content.replace(/SHOPIFY_ACCESS_TOKEN=.*/, `SHOPIFY_ACCESS_TOKEN=${TOKEN}`))
            resolve(TOKEN)
          } else reject(new Error('No token'))
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function GET(req: NextRequest) {
  try {
    // Today in Adelaide timezone
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Adelaide' }))
    const todayStr = now.toISOString().split('T')[0]
    const todayStart = `${todayStr}T00:00:00+10:30`

    // Try fetching, refresh token if 401
    let res = await shopifyGet(STORE, TOKEN, `/orders.json?limit=250&status=any&created_at_min=${todayStart}&fields=id,total_price,line_items,created_at,financial_status,customer`)
    if (res.status === 401) {
      await refreshToken()
      res = await shopifyGet(STORE, TOKEN, `/orders.json?limit=250&status=any&created_at_min=${todayStart}&fields=id,total_price,line_items,created_at,financial_status,customer`)
    }

    const orders = (res.data?.orders || []).filter((o: any) => !['refunded', 'voided'].includes(o.financial_status))

    let totalRevenue = 0
    let totalItems = 0
    const productCounts: Record<string, number> = {}
    const newCustomerIds = new Set<string>()
    const returningCustomerIds = new Set<string>()

    for (const order of orders) {
      totalRevenue += parseFloat(order.total_price || '0')
      for (const item of (order.line_items || [])) {
        totalItems += item.quantity
        productCounts[item.title] = (productCounts[item.title] || 0) + item.quantity
      }
      if (order.customer?.orders_count > 1) {
        returningCustomerIds.add(String(order.customer.id))
      } else {
        newCustomerIds.add(String(order.customer?.id || order.id))
      }
    }

    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, qty]) => ({ name, qty }))

    return NextResponse.json({
      date: todayStr,
      isToday: true,
      asOf: new Date().toISOString(),
      shopify: {
        totalOrders: orders.length,
        totalRevenue,
        aov: orders.length > 0 ? totalRevenue / orders.length : 0,
        totalItems,
        newCustomers: newCustomerIds.size,
        returningCustomers: returningCustomerIds.size,
        returningRate: orders.length > 0 ? (returningCustomerIds.size / orders.length * 100) : 0,
        topProducts,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
