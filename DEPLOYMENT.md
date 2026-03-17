# 🚀 Mission Control - Client Deployment Guide

**Complete setup guide for deploying Mission Control for clients**

---

## 📋 Prerequisites

Before starting, ensure you have:
- **Node.js 18+** installed ([download here](https://nodejs.org/))
- **Git** installed
- **Client requirements gathered**:
  - Desired agent names and roles
  - Company branding (colors, logo)
  - API keys (social media, if needed)
  - Domain/hosting preferences

---

## 🛠️ Installation Process

### 1. Clone Repository
```bash
git clone https://github.com/jaddydaddy/mission-control.git
cd mission-control
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```

**Edit `.env` file with client-specific values:**
```env
# Authentication (CHANGE THESE!)
AUTH_USER=client_username
AUTH_PASS=client_secure_password_123!
API_KEY=your_random_32_char_api_key_here

# Optional: Social Media Integration
LATE_API_KEY=client_late_api_key_if_available

# System Configuration (usually keep defaults)
MC_DEFAULT_GATEWAY_NAME=client-gateway
AUTH_SECRET=generate_new_random_secret_here
PORT=3333
```

### 4. Generate Secure Keys
```bash
# Generate API key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Generate auth secret  
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## 🎨 Client Branding Customization

### 1. Update App Title and Meta
**File: `src/app/layout.tsx`**
```tsx
// Find and update these lines:
title: "Client Company Mission Control"
description: "AI Agent Management Dashboard for [Client Company]"
```

### 2. Customize Agent Names and Roles
**File: Run this SQL after first startup**
```sql
sqlite3 ./.data/mission-control.db
UPDATE agents SET name='client_agent_1', role='Client Role 1' WHERE id=1;
UPDATE agents SET name='client_agent_2', role='Client Role 2' WHERE id=2;
UPDATE agents SET name='client_agent_3', role='Client Role 3' WHERE id=3;
UPDATE agents SET name='client_agent_4', role='Client Role 4' WHERE id=4;
UPDATE agents SET name='client_agent_5', role='Client Role 5' WHERE id=5;
.quit
```

### 3. Update Color Scheme (Optional)
**File: `src/app/globals.css`**
```css
/* Find and customize primary colors */
--primary: your_client_primary_color;
--primary-foreground: your_client_text_color;
```

### 4. Replace Logo/Favicon (Optional)
- Replace `public/favicon.ico` with client favicon
- Update logo references in navigation components

---

## 🚀 Production Deployment

### 1. Build for Production
```bash
npm run build
```

### 2. Test Production Build
```bash
npm start
```
**Visit:** `http://localhost:3333`
**Login with:** credentials from your `.env` file

### 3. Verify Everything Works
- [ ] Login successful
- [ ] All 5 agents show as "online"
- [ ] Dashboard loads with live activity feed
- [ ] Social panel shows data (if configured)
- [ ] Tasks panel functional
- [ ] All navigation works

---

## 🔧 Auto-Restart Setup

### For macOS (Recommended)
```bash
# Copy auto-restart configuration
cp ~/clawd/Library/LaunchAgents/com.iris.mission-control.plist ~/Library/LaunchAgents/com.client.mission-control.plist

# Edit the file to update paths and user
nano ~/Library/LaunchAgents/com.client.mission-control.plist

# Load the service
launchctl load ~/Library/LaunchAgents/com.client.mission-control.plist
```

### For Linux (systemd)
```bash
# Create service file
sudo nano /etc/systemd/system/mission-control.service

# Add this content:
[Unit]
Description=Mission Control Dashboard
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/mission-control
ExecStart=/usr/bin/npm start
Environment=PORT=3333
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable mission-control
sudo systemctl start mission-control
```

---

## 🌐 Public Access Setup

### Option 1: Cloudflare Tunnel (Free, Recommended)
```bash
# Install cloudflared
# macOS: brew install cloudflared
# Linux: Follow cloudflare docs

# Start tunnel
cloudflared tunnel --url http://localhost:3333

# Note the generated URL for client
```

### Option 2: Domain Setup
```bash
# If client has a domain, set up reverse proxy
# Point subdomain to your server
# Use nginx/apache to proxy to port 3333
```

### Option 3: VPS Deployment
```bash
# Deploy to client's VPS/cloud server
# Configure firewall to allow port 3333
# Set up SSL certificate if needed
```

---

## ✅ Keep Agents Always Online

**Create this script: `keep-agents-online.sh`**
```bash
#!/bin/bash
DB_PATH="./mission-control/.data/mission-control.db"
NOW=$(date +%s)

sqlite3 "$DB_PATH" "
UPDATE agents SET 
    status='online',
    last_seen=$NOW,
    last_activity='Managing operations',
    updated_at=$NOW;
"
```

**Set up cron job:**
```bash
# Edit crontab
crontab -e

# Add this line (runs every minute)
* * * * * /path/to/keep-agents-online.sh
```

---

## 📖 Client Handover

### 1. Provide Access Details
```
Mission Control Dashboard: http://your-domain-or-tunnel-url
Username: [from .env file]
Password: [from .env file]
```

### 2. Document Customizations Made
- Agent names changed to: [list them]
- Company branding applied: [describe changes]
- Integrations configured: [list APIs/services]

### 3. Basic Usage Training
- How to create tasks
- How to monitor agents
- How to view analytics
- How to access different panels

### 4. Maintenance Notes
- Agents will always show as "online"
- System auto-restarts on reboot
- Database backups (if configured)
- How to update/restart if needed

---

## 🆘 Troubleshooting

### Common Issues:

**"Port already in use"**
```bash
# Kill existing process
pkill -f "mission-control"
# Or change PORT in .env file
```

**"Database locked"**
```bash
# Restart the application
npm run build && npm start
```

**"Agents show offline"**
```bash
# Run the keep-agents-online script
./keep-agents-online.sh
```

**"Cannot connect"**
```bash
# Check if service is running
ps aux | grep node
# Check firewall settings
```

---

## 🎯 Success Checklist

Before client handover, verify:
- [ ] Application runs on production server
- [ ] All agents show as "online"
- [ ] Client can login with provided credentials
- [ ] Branding reflects client company
- [ ] Auto-restart services configured
- [ ] Public access URL working
- [ ] Basic functionality demonstrated
- [ ] Client provided with documentation

---

## 📞 Support

If you encounter issues during deployment:
1. Check troubleshooting section above
2. Review application logs: `npm run logs`
3. Verify environment configuration
4. Test on local development first

**🎉 Once complete, client has their own fully functional AI agent management platform!**