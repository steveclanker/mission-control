#!/bin/bash
# Deploy MiroFish Simulation Service alongside Mission Control

echo "🐟 Deploying MiroFish Simulation Service..."

# Check if MiroFish is cloned
if [ ! -d "../MiroFish" ]; then
    echo "📥 Cloning MiroFish repository..."
    git clone https://github.com/666ghj/MiroFish.git ../MiroFish
fi

cd ../MiroFish

# Setup environment
if [ ! -f ".env" ]; then
    echo "⚙️ Setting up MiroFish environment..."
    cp .env.example .env
    
    # Update with OpenAI credentials
    sed -i '' 's/your_api_key_here/'"$OPENAI_API_KEY"'/g' .env
    sed -i '' 's|https://dashscope.aliyuncs.com/compatible-mode/v1|https://api.openai.com/v1|g' .env
    sed -i '' 's/qwen-plus/gpt-4o-mini/g' .env
fi

# Install dependencies
echo "📦 Installing MiroFish dependencies..."
export PATH="$HOME/.local/bin:$PATH"
npm run setup:all

# Start MiroFish backend
echo "🚀 Starting MiroFish simulation service on port 5001..."
cd backend
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
uv run python run.py &

echo "✅ MiroFish simulation service deployed!"
echo "🌐 Backend: http://localhost:5001"
echo "🎛️ Mission Control: http://localhost:3000/simulation"

# Return to Mission Control directory
cd ../../mission-control
