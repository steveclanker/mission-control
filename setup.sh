#!/bin/bash

echo "🚀 Mission Control - Quick Setup Script"
echo "========================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    echo "   Download: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Setup environment
if [ ! -f ".env" ]; then
    echo "⚙️ Creating environment configuration..."
    cp .env.example .env
    
    # Generate secure keys
    API_KEY=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
    AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
    
    # Update .env with generated keys
    sed -i.bak "s/68e8d410c6cb934f1d1069ae15748ba2/$API_KEY/" .env
    sed -i.bak "s/2cd94c827eff8282c5a128c39caf6a48/$AUTH_SECRET/" .env
    
    echo "✅ Environment configured with secure keys"
    echo "📝 Please edit .env file to customize:"
    echo "   - AUTH_USER (login username)"
    echo "   - AUTH_PASS (login password)"
else
    echo "ℹ️ Environment file already exists"
fi

# Build application
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "✅ Setup Complete!"
echo "==================="
echo ""
echo "🎯 Quick Start:"
echo "   1. Edit .env file with your credentials"
echo "   2. Run: npm start"
echo "   3. Visit: http://localhost:3333"
echo ""
echo "📖 Full deployment guide: DEPLOYMENT.md"
echo ""
echo "🔐 Default login (change in .env):"
echo "   Username: iris"
echo "   Password: Blueeyes03!Agent"
echo ""

# Offer to start immediately
read -p "🚀 Start Mission Control now? (y/N): " start_now
if [[ $start_now =~ ^[Yy]$ ]]; then
    echo "Starting Mission Control..."
    npm start
fi