/**
 * Mission Control - MiroFish Simulation Integration Script
 * Adds multi-agent simulation capabilities to Mission Control dashboard
 */

const fs = require('fs');
const path = require('path');

console.log('🐟 Adding MiroFish simulation features to Mission Control...');

// 1. Update package.json with new dependencies
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const newDependencies = {
  '@tanstack/react-query': '^4.29.0',
  'react-hook-form': '^7.45.0',
  'zod': '^3.21.4',
  'recharts': '^2.7.2',
  'lucide-react': '^0.263.1'
};

packageJson.dependencies = { ...packageJson.dependencies, ...newDependencies };
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

console.log('✅ Updated package.json with simulation dependencies');

// 2. Add simulation route to main app
const appPath = path.join(__dirname, 'src/app/layout.tsx');
if (fs.existsSync(appPath)) {
  let appContent = fs.readFileSync(appPath, 'utf8');
  
  // Add simulation navigation if not already present
  if (!appContent.includes('simulation')) {
    const navigationInsert = `
          <SidebarItem href="/simulation" icon={Brain}>
            Agent Simulation
          </SidebarItem>`;
    
    appContent = appContent.replace(
      '</nav>',
      navigationInsert + '\n        </nav>'
    );
    
    // Add Brain icon import
    if (!appContent.includes('Brain')) {
      appContent = appContent.replace(
        'import {',
        'import { Brain,'
      );
    }
    
    fs.writeFileSync(appPath, appContent);
    console.log('✅ Added simulation navigation to main app');
  }
}

// 3. Create simulation page route
const simulationPageDir = path.join(__dirname, 'src/app/simulation');
if (!fs.existsSync(simulationPageDir)) {
  fs.mkdirSync(simulationPageDir, { recursive: true });
}

const simulationPageContent = `import { SimulationDashboard } from '@/components/SimulationDashboard';

export default function SimulationPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <SimulationDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Agent Simulation | Mission Control',
  description: 'Multi-agent simulation and predictive modeling dashboard',
};`;

fs.writeFileSync(
  path.join(simulationPageDir, 'page.tsx'), 
  simulationPageContent
);

console.log('✅ Created simulation page route');

// 4. Add missing UI components if they don't exist
const uiComponentsDir = path.join(__dirname, 'src/components/ui');
const missingComponents = ['tabs', 'progress', 'badge'];

missingComponents.forEach(component => {
  const componentPath = path.join(uiComponentsDir, `${component}.tsx`);
  if (!fs.existsSync(componentPath)) {
    console.log(`⚠️  Missing UI component: ${component}.tsx - Please install from shadcn/ui`);
  }
});

// 5. Update environment variables template
const envExamplePath = path.join(__dirname, '.env.example');
let envContent = '';

if (fs.existsSync(envExamplePath)) {
  envContent = fs.readFileSync(envExamplePath, 'utf8');
} else {
  console.log('📝 Creating .env.example file');
}

const miroFishEnvVars = `
# MiroFish Simulation Service
MIROFISH_API_URL=http://localhost:5001
MIROFISH_API_KEY=your_api_key_here

# Knowledge Graph & Memory
ZEP_API_KEY=your_zep_api_key_here

# LLM Configuration for Simulation
SIMULATION_LLM_API_KEY=your_openai_key_here
SIMULATION_LLM_MODEL=gpt-4o-mini
`;

if (!envContent.includes('MIROFISH_API_URL')) {
  envContent += miroFishEnvVars;
  fs.writeFileSync(envExamplePath, envContent);
  console.log('✅ Added MiroFish environment variables to .env.example');
}

// 6. Create API route for simulation proxy
const apiDir = path.join(__dirname, 'src/app/api/simulation');
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

const apiRouteContent = `import { NextRequest, NextResponse } from 'next/server';

const MIROFISH_API_URL = process.env.MIROFISH_API_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(\`\${MIROFISH_API_URL}\${endpoint}\`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('MiroFish API Error:', error);
    return NextResponse.json({ error: 'Failed to connect to simulation service' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  try {
    const body = await request.json();
    
    const response = await fetch(\`\${MIROFISH_API_URL}\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('MiroFish API Error:', error);
    return NextResponse.json({ error: 'Failed to connect to simulation service' }, { status: 500 });
  }
}`;

fs.writeFileSync(path.join(apiDir, 'route.ts'), apiRouteContent);
console.log('✅ Created simulation API proxy route');

// 7. Create deployment script for simulation service
const deployScriptContent = `#!/bin/bash
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
`;

fs.writeFileSync(path.join(__dirname, 'deploy-simulation.sh'), deployScriptContent);
fs.chmodSync(path.join(__dirname, 'deploy-simulation.sh'), 0o755);

console.log('✅ Created deployment script: deploy-simulation.sh');

// 8. Update README with simulation features
const readmePath = path.join(__dirname, 'README.md');
let readmeContent = '';

if (fs.existsSync(readmePath)) {
  readmeContent = fs.readFileSync(readmePath, 'utf8');
} else {
  readmeContent = '# Mission Control\n\nAgent orchestration dashboard.\n\n';
}

const simulationSection = `
## 🐟 Agent Simulation Features

Mission Control now includes advanced multi-agent simulation capabilities powered by MiroFish:

### Features
- **GraphRAG Knowledge Extraction** - Build knowledge graphs from documents
- **Agent Persona Generation** - Create realistic AI agents with personalities
- **Multi-Platform Simulation** - Twitter + Reddit parallel execution  
- **God's Eye View** - Real-time scenario injection and monitoring
- **Interview System** - Mid-simulation agent questioning
- **Enterprise Analytics** - Detailed simulation analytics and reports

### Quick Start
1. Install simulation dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Deploy MiroFish backend:
   \`\`\`bash
   ./deploy-simulation.sh
   \`\`\`

3. Configure environment variables:
   \`\`\`bash
   cp .env.example .env
   # Add your OpenAI and Zep API keys
   \`\`\`

4. Access simulation dashboard:
   \`\`\`
   http://localhost:3000/simulation
   \`\`\`

### Business Applications
- **Financial Stress Testing** - Model market reactions ($50K-$250K value)
- **Product Launch Simulation** - Predict customer adoption ($25K-$100K value)  
- **Crisis Communication** - Test response strategies ($40K-$150K value)
- **Policy Impact Modeling** - Government and regulatory analysis ($75K-$500K value)

### API Endpoints
- \`GET /api/simulation?endpoint=/api/graph/list\` - List knowledge graphs
- \`POST /api/simulation?endpoint=/api/simulation/create\` - Create simulation
- \`GET /api/simulation?endpoint=/api/simulation/{id}/status\` - Get status
- \`POST /api/simulation?endpoint=/api/simulation/{id}/inject\` - Inject scenario

For detailed service offerings and pricing, see: \`../deploy-simulation-service/service-offering.md\`
`;

if (!readmeContent.includes('Agent Simulation Features')) {
  readmeContent += simulationSection;
  fs.writeFileSync(readmePath, readmeContent);
  console.log('✅ Updated README.md with simulation features');
}

// Summary
console.log('\n🎉 MiroFish simulation integration complete!');
console.log('\n📋 Next Steps:');
console.log('1. Run: npm install');
console.log('2. Add your API keys to .env file');  
console.log('3. Run: ./deploy-simulation.sh');
console.log('4. Visit: http://localhost:3000/simulation');
console.log('\n💰 Business Value:');
console.log('- Simulation services: $15K-$500K per project');
console.log('- Target markets: Finance, Tech, Government, Healthcare');
console.log('- Competitive advantage: Real-time scenario injection');
console.log('\n🚀 Ready to revolutionize enterprise decision-making!');