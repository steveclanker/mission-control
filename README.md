# 🤖 Mission Control

**Open-source AI agent management dashboard**

> **Enterprise-ready platform for managing AI agent workforces with real-time monitoring, task management, and analytics.**

![Mission Control Dashboard](docs/mission-control.jpg)

## ✨ Features

- **📊 Real-time Dashboard** - Live activity feeds and agent monitoring
- **🤖 Agent Management** - 5+ agents with status tracking and task assignment  
- **📋 Task Orchestration** - Create, assign, and track tasks across your agent workforce
- **📱 Social Media Integration** - Complete social analytics with Late API integration
- **📈 Analytics & Insights** - Performance tracking and optimization recommendations
- **🔐 Secure Authentication** - Role-based access control with session management
- **📱 Mobile Responsive** - Works perfectly on desktop, tablet, and mobile
- **🎨 White-label Ready** - Easy customization for client branding

## 🚀 Quick Start

```bash
git clone https://github.com/jaddydaddy/mission-control.git
cd mission-control
npm install
cp .env.example .env
npm run build
npm start
```

**➡️ For complete deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

## 🎯 Use Cases

- **Agency Management** - Deploy for clients who need AI agent oversight
- **Enterprise Deployment** - Internal AI workforce management
- **Service Providers** - White-label solution for AI consultants  
- **Development Teams** - Manage multiple AI development agents

## 📁 Project Structure

```
mission-control/
├── src/
│   ├── app/              # Next.js app router
│   ├── components/       # React components
│   │   ├── dashboard/    # Main dashboard components
│   │   ├── panels/       # Individual panel components (37 total)
│   │   └── ui/          # Reusable UI components
│   ├── lib/             # Utilities and integrations
│   └── types/           # TypeScript definitions
├── public/              # Static assets
├── .env.example         # Environment template
├── DEPLOYMENT.md        # Complete deployment guide
└── README.md           # This file
```

## 🛠️ Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Node.js, SQLite (WAL mode)
- **Authentication:** Custom secure auth with role-based access
- **APIs:** OpenClaw Gateway, Late API (social media)
- **Charts:** Recharts for analytics visualization
- **Database:** SQLite with automatic migrations

## 📊 Dashboard Panels

Mission Control includes 37+ specialized panels:

- **Core:** Overview, Agents, Tasks, Sessions
- **Analytics:** Social media, Performance metrics, Cost tracking
- **Management:** User management, Audit trails, Notifications
- **Integration:** GitHub sync, Webhooks, API management
- **Operations:** System health, Security scans, Backups

## 🔧 Customization

### Agent Configuration
```sql
-- Update agent names and roles
UPDATE agents SET name='your_agent', role='Your Role' WHERE id=1;
```

### Branding
- Update `src/app/layout.tsx` for titles and meta
- Modify CSS variables in `src/app/globals.css`
- Replace `public/favicon.ico` with your logo

### API Integration
- Configure `.env` with your API keys
- Add custom integrations in `src/lib/`
- Extend panels in `src/components/panels/`

## 🔐 Security

- Secure authentication with bcrypt password hashing
- API key protection for all endpoints
- Role-based access control (Admin/Operator/Viewer)
- CSP headers and security middleware
- Rate limiting and input validation

## 📈 Performance

- **Production optimized** - 84% memory usage (vs 99% dev mode)
- **Fast loading** - Loading skeletons and error boundaries
- **Real-time updates** - Live activity feeds and status monitoring
- **Auto-restart** - Services survive reboots and failures

## 🌐 Deployment Options

- **Local Development** - Localhost with auto-restart
- **VPS/Cloud** - Deploy to any Node.js hosting
- **Tunnel Access** - Cloudflare tunnel for external access
- **Enterprise** - Custom domain with SSL/reverse proxy

## 📞 Support

1. **Read:** [DEPLOYMENT.md](DEPLOYMENT.md) for complete setup
2. **Check:** Troubleshooting section in deployment guide  
3. **Test:** Local development before production deployment

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🎯 Business Model

- **Open Source Core** - Free to use and modify
- **Customization Services** - Paid implementation and branding
- **Enterprise Support** - Ongoing maintenance contracts
- **Premium Features** - Advanced integrations and analytics

---

**🎉 Ready to deploy your own AI agent management platform?**

**Start with: [DEPLOYMENT.md](DEPLOYMENT.md)**