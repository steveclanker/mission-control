# Mission Control - How to Start

## Quick Start (3 commands)
```bash
cd ~/agent/projects/mission-control
PORT=3100 node_modules/.bin/next dev -p 3100 &
nohup cloudflared tunnel --url http://127.0.0.1:3100 > /tmp/cloudflared.log 2>&1 &
```
Then grab the tunnel URL:
```bash
grep "trycloudflare.com" /tmp/cloudflared.log
```

## Login
- Username: admin
- Password: LaHaute2026!

## What We Learned (March 18, 2026)

### Problem 1: `npm install` fails with permission errors
**Fix:** Use a temp cache directory:
```bash
npm install --legacy-peer-deps --cache /tmp/npm-cache-steve
```

### Problem 2: `next start` (production mode) binds port but doesn't accept connections
**Fix:** Use `next dev` instead. Dev mode works reliably:
```bash
PORT=3100 node_modules/.bin/next dev -p 3100
```
Do NOT use `npm start` or `next start --hostname 0.0.0.0` — they silently fail.

### Problem 3: Can't access from other devices on local network
**Fix:** macOS firewall blocks incoming connections. Don't bother with local IP.
Use Cloudflare tunnel instead — works from anywhere:
```bash
nohup cloudflared tunnel --url http://127.0.0.1:3100 > /tmp/cloudflared.log 2>&1 &
```

### Problem 4: "Forbidden" error when accessing dashboard
**Fix:** Set `MC_ALLOW_ANY_HOST=true` in `.env`
The host allowlist blocks requests from tunnel URLs and non-localhost hosts.

### Problem 5: Shopify API returns empty data
**Fix:** Token expired (24h expiry). Refresh it:
```bash
cd ~/agent && source .shopify_creds.env
curl -s -X POST "https://${SHOPIFY_STORE}/admin/oauth/access_token" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\":\"${SHOPIFY_CLIENT_ID}\",\"client_secret\":\"${SHOPIFY_CLIENT_SECRET}\",\"grant_type\":\"client_credentials\"}"
```
Update the token in `.shopify_creds.env`. The /api/lahaute/today endpoint auto-refreshes.

## Check if Running
```bash
ps aux | grep "next dev" | grep -v grep    # Dashboard process
ps aux | grep cloudflared | grep -v grep    # Tunnel process
```

## Kill & Restart
```bash
# Kill dashboard
ps aux | grep "next dev" | grep -v grep | awk '{print $2}' | xargs kill -9

# Kill tunnel  
ps aux | grep cloudflared | grep -v grep | awk '{print $2}' | xargs kill -9

# Then run Quick Start again
```

## Key Config
- Port: 3100
- .env location: ~/agent/projects/mission-control/.env
- Shopify creds: ~/agent/.shopify_creds.env
- Data directory: ~/agent/data/daily-summaries/ and ~/agent/data/stock/
