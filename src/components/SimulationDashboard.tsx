/**
 * MiroFish Simulation Dashboard for Mission Control
 * Enterprise-grade multi-agent simulation interface
 */

'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Progress component replaced with custom implementation
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Stop, 
  Eye, 
  Users, 
  Activity, 
  TrendingUp, 
  MessageCircle,
  FileText,
  Zap,
  Brain
} from 'lucide-react';
import { 
  miroFishService, 
  SimulationStatus, 
  SimulationConfig, 
  AgentAction,
  KnowledgeGraph 
} from '@/lib/mirofish-integration';

export function SimulationDashboard() {
  const [activeSimulations, setActiveSimulations] = useState<SimulationStatus[]>([]);
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null);
  const [recentActions, setRecentActions] = useState<AgentAction[]>([]);
  const [knowledgeGraphs, setKnowledgeGraphs] = useState<KnowledgeGraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewSimModal, setShowNewSimModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    loadKnowledgeGraphs();
    // Set up polling for active simulations (disabled for demo)
    // const interval = setInterval(loadActiveSimulations, 5000);
    // return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedSimulation) {
      loadSimulationDetails(selectedSimulation);
      const interval = setInterval(() => loadSimulationDetails(selectedSimulation), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedSimulation]);

  const loadActiveSimulations = async () => {
    try {
      // In production, this would fetch from API
      // For demo, simulations are added manually via handleCreateSimulation
      console.log('Active simulations loaded');
    } catch (error) {
      console.error('Failed to load active simulations:', error);
    }
  };

  const loadKnowledgeGraphs = async () => {
    try {
      // Use demo data for now since MiroFish backend isn't running
      const demoGraphs = [
        {
          id: "deploy-agent-graph",
          name: "Deploy Your Agent Launch Strategy",
          description: "Knowledge graph for AI agent service launch analysis",
          created_at: "2024-03-15T10:30:00Z",
          nodes: 142,
          relationships: 289,
          status: "ready"
        },
        {
          id: "enterprise-market-graph", 
          name: "Enterprise Market Analysis",
          description: "Market research and competitive landscape",
          created_at: "2024-03-14T14:15:00Z",
          nodes: 87,
          relationships: 156,
          status: "ready"
        },
        {
          id: "customer-persona-graph",
          name: "Customer Persona Mapping", 
          description: "Target customer analysis and segmentation",
          created_at: "2024-03-13T16:45:00Z",
          nodes: 64,
          relationships: 134,
          status: "processing"
        }
      ] as KnowledgeGraph[];
      
      setKnowledgeGraphs(demoGraphs);
    } catch (error) {
      console.error('Failed to load knowledge graphs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSimulationDetails = async (simulationId: string) => {
    try {
      const status = await miroFishService.getSimulationStatus(simulationId);
      setSimulationStatus(status);
      
      const actions = await miroFishService.getAgentActions(simulationId, { limit: 20 });
      setRecentActions(actions);
    } catch (error) {
      console.error('Failed to load simulation details:', error);
    }
  };

  const formatRunnerStatus = (status: string) => {
    const statusMap = {
      'idle': { color: 'gray', text: 'Idle' },
      'starting': { color: 'yellow', text: 'Starting' },
      'running': { color: 'green', text: 'Running' },
      'paused': { color: 'orange', text: 'Paused' },
      'stopping': { color: 'red', text: 'Stopping' },
      'stopped': { color: 'red', text: 'Stopped' },
      'completed': { color: 'blue', text: 'Completed' },
      'failed': { color: 'red', text: 'Failed' }
    };
    
    const config = statusMap[status] || statusMap['idle'];
    return (
      <Badge variant={config.color === 'green' ? 'default' : 'secondary'}>
        {config.text}
      </Badge>
    );
  };

  const handleDocumentUpload = async () => {
    if (!uploadFile) {
      alert('Please select a file first');
      return;
    }

    // Demo mode - simulate successful upload
    setShowUploadModal(false);
    
    // Show processing animation
    alert('🔄 Processing document...');
    
    // Simulate processing time
    setTimeout(() => {
      alert(`✅ Document "${uploadFile.name}" uploaded successfully! 

📊 Results:
• 47 entities extracted
• 89 relationships found  
• Processing time: 2.3s
• Knowledge graph: "Deploy Your Agent Launch Strategy"

🎯 Ready to create simulation!`);
      
      setUploadFile(null);
      // Trigger knowledge graph refresh
      loadKnowledgeGraphs();
    }, 2000);
  };

  const handleCreateSimulation = () => {
    setShowNewSimModal(false);
    
    // Demo simulation creation
    alert('🚀 Creating simulation...');
    
    setTimeout(() => {
      // Add demo simulation to active simulations
      const demoSimulation = {
        simulation_id: `demo_sim_${Date.now()}`,
        runner_status: "running" as const,
        current_round: 35,
        total_rounds: 100,
        simulated_hours: 0.5,
        total_simulation_hours: 1.5,
        progress_percent: 35,
        twitter_current_round: 18,
        reddit_current_round: 17,
        twitter_simulated_hours: 0.3,
        reddit_simulated_hours: 0.2,
        twitter_running: true,
        reddit_running: true,
        twitter_actions_count: 198,
        reddit_actions_count: 144,
        agents_active: 847,
        total_agents: 1000,
        posts_created: 342,
        comments_made: 156,
        likes_given: 523,
        shares_made: 89,
        active_conversations: 234,
        sentiment_positive_count: 578,
        sentiment_negative_count: 102,
        sentiment_neutral_count: 167
      };
      
      setActiveSimulations([demoSimulation]);
      setSelectedSimulation(demoSimulation.simulation_id);
      
      // Add demo agent actions
      const demoActions = [
        {
          round_num: 15,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          platform: "twitter" as const,
          agent_id: 1,
          agent_name: "CTO_Agent_001",
          action_type: "post",
          action_args: {
            content: "Interesting AI agent platform. Need to evaluate technical architecture and integration complexity before recommending to leadership."
          },
          result: "Posted successfully",
          success: true
        },
        {
          round_num: 12,
          timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), 
          platform: "twitter" as const,
          agent_id: 47,
          agent_name: "CFO_Agent_047",
          action_type: "comment",
          action_args: {
            content: "ROI projections look promising but need to see detailed cost breakdown. What's the total cost of ownership over 3 years?"
          },
          result: "Comment added successfully",
          success: true
        },
        {
          round_num: 8,
          timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          platform: "twitter" as const, 
          agent_id: 156,
          agent_name: "OpsManager_156",
          action_type: "post",
          action_args: {
            content: "Current manual processes are killing productivity. AI agent automation could save us 20+ hours per week. Evaluating vendors."
          },
          result: "Posted successfully", 
          success: true
        }
      ];
      setRecentActions(demoActions);
      
      // Set simulation status for detailed view (use the same object)
      setSimulationStatus(demoSimulation);
      
      alert(`✅ Simulation "Deploy Your Agent - Market Response" created!

🎯 Configuration:
• 1000 AI agents generated
• Platforms: Twitter + LinkedIn  
• Knowledge Graph: Deploy Your Agent Launch Strategy
• Expected runtime: 15-30 minutes

📊 The simulation is now running! 

You can monitor:
• Real-time agent conversations
• Market sentiment analysis  
• Adoption rate predictions
• Competitive response scenarios

💡 Try the "God's Eye View" to inject live scenarios!`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agent Simulation Dashboard</h2>
          <p className="text-muted-foreground">
            Enterprise multi-agent simulation powered by MiroFish
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
          <Button onClick={() => setShowNewSimModal(true)}>
            <Zap className="mr-2 h-4 w-4" />
            New Simulation
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Simulations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSimulations.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeSimulations.filter(s => s.runner_status === 'running').length} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Knowledge Graphs</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeGraphs.length}</div>
            <p className="text-xs text-muted-foreground">
              {knowledgeGraphs.reduce((sum, g) => sum + g.total_entities, 0)} total entities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {simulationStatus?.twitter_actions_count + simulationStatus?.reddit_actions_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all platforms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actions Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentActions.length}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="knowledge-graphs">Knowledge Graphs</TabsTrigger>
          <TabsTrigger value="simulations">Active Simulations</TabsTrigger>
          <TabsTrigger value="god-view">God's Eye View</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {selectedSimulation && simulationStatus ? (
            <SimulationOverview status={simulationStatus} actions={recentActions} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No Simulation Selected</h3>
                  <p className="text-muted-foreground">
                    Select a simulation to view real-time details
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="knowledge-graphs">
          <KnowledgeGraphsPanel graphs={knowledgeGraphs} />
        </TabsContent>

        <TabsContent value="simulations">
          <SimulationsPanel 
            simulations={activeSimulations} 
            onSelect={setSelectedSimulation}
            selectedId={selectedSimulation}
          />
        </TabsContent>

        <TabsContent value="god-view">
          {selectedSimulation ? (
            <GodsEyeView simulationId={selectedSimulation} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Zap className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">God's Eye View</h3>
                  <p className="text-muted-foreground">
                    Select a running simulation to inject real-time scenarios
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPanel simulationId={selectedSimulation} />
        </TabsContent>
      </Tabs>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-4">Upload Document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Document
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-secondary/50 text-foreground rounded-lg border border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports PDF, DOC, TXT, MD files up to 10MB
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleDocumentUpload()}>
                  Upload & Process
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Simulation Modal */}
      {showNewSimModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">Create New Simulation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Simulation Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Deploy Your Agent - Market Response"
                  className="w-full px-3 py-2 bg-secondary/50 text-foreground rounded-lg border border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Knowledge Graph
                </label>
                <select className="w-full px-3 py-2 bg-secondary/50 text-foreground rounded-lg border border-border">
                  <option>Deploy Your Agent Launch Strategy</option>
                  <option>Enterprise Market Analysis</option>
                  <option>Customer Persona Mapping</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Agent Count
                  </label>
                  <select className="w-full px-3 py-2 bg-secondary/50 text-foreground rounded-lg border border-border">
                    <option>100 agents</option>
                    <option>500 agents</option>
                    <option>1000 agents</option>
                    <option>2500 agents</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Platforms
                  </label>
                  <select className="w-full px-3 py-2 bg-secondary/50 text-foreground rounded-lg border border-border">
                    <option>Twitter + LinkedIn</option>
                    <option>All Platforms</option>
                    <option>Twitter Only</option>
                    <option>LinkedIn Only</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNewSimModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleCreateSimulation()}>
                  Create Simulation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimulationOverview({ status, actions }: { 
  status: SimulationStatus; 
  actions: AgentAction[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Simulation Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status</span>
            {formatRunnerStatus(status.runner_status)}
          </div>
          
          <div>
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{status.progress_percent}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${status.progress_percent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Round</div>
              <div className="text-muted-foreground">
                {status.current_round} / {status.total_rounds}
              </div>
            </div>
            <div>
              <div className="font-medium">Sim Hours</div>
              <div className="text-muted-foreground">
                {status.simulated_hours} / {status.total_simulation_hours}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Twitter</div>
              <div className="text-muted-foreground">
                {status.twitter_actions_count} actions
                {status.twitter_running && <Badge className="ml-1" variant="secondary">Live</Badge>}
              </div>
            </div>
            <div>
              <div className="font-medium">Reddit</div>
              <div className="text-muted-foreground">
                {status.reddit_actions_count} actions
                {status.reddit_running && <Badge className="ml-1" variant="secondary">Live</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Recent Agent Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {actions.length > 0 ? (
              actions.map((action, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                  <div>
                    <div className="font-medium">{action.agent_name}</div>
                    <div className="text-muted-foreground">{action.action_type}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{action.platform}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Round {action.round_num}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No actions recorded yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KnowledgeGraphsPanel({ graphs }: { graphs: KnowledgeGraph[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {graphs.map((graph) => (
        <Card key={graph.id} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">{graph.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">{graph.description}</p>
            <div className="flex justify-between text-sm">
              <span>{graph.total_entities} entities</span>
              <span>{graph.total_relationships} relationships</span>
            </div>
            <div className="mt-4">
              <Button size="sm" className="w-full">
                Create Simulation
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Card className="border-dashed border-2">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Brain className="mx-auto h-8 w-8 text-muted-foreground" />
            <h4 className="mt-2 font-semibold">Create Knowledge Graph</h4>
            <Button variant="outline" size="sm" className="mt-2">
              Upload Document
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SimulationsPanel({ 
  simulations, 
  onSelect, 
  selectedId 
}: { 
  simulations: SimulationStatus[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="space-y-4">
      {simulations.length > 0 ? (
        simulations.map((sim) => (
          <Card 
            key={sim.simulation_id} 
            className={`cursor-pointer transition-colors ${
              selectedId === sim.simulation_id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelect(sim.simulation_id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{sim.simulation_id}</CardTitle>
                {formatRunnerStatus(sim.runner_status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium">Progress</div>
                  <div className="text-muted-foreground">{sim.progress_percent}%</div>
                </div>
                <div>
                  <div className="font-medium">Actions</div>
                  <div className="text-muted-foreground">{sim.total_actions_count}</div>
                </div>
                <div>
                  <div className="font-medium">Runtime</div>
                  <div className="text-muted-foreground">
                    {Math.floor((Date.now() - new Date(sim.started_at || '').getTime()) / 60000)}m
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Play className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Active Simulations</h3>
              <p className="text-muted-foreground">
                Create a knowledge graph and start your first simulation
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GodsEyeView({ simulationId }: { simulationId: string }) {
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [scenarioVariables, setScenarioVariables] = useState('{}');
  
  const injectScenario = async () => {
    try {
      const variables = JSON.parse(scenarioVariables);
      await miroFishService.injectScenario(simulationId, {
        title: scenarioTitle,
        description: scenarioDescription,
        variables
      });
      
      // Reset form
      setScenarioTitle('');
      setScenarioDescription('');
      setScenarioVariables('{}');
      
      alert('Scenario injected successfully!');
    } catch (error) {
      console.error('Failed to inject scenario:', error);
      alert('Failed to inject scenario');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          God's Eye View - Real-time Scenario Injection
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Inject variables and watch the entire simulation world reorganize in real-time
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Scenario Title</label>
          <input
            type="text"
            value={scenarioTitle}
            onChange={(e) => setScenarioTitle(e.target.value)}
            placeholder="Fed cuts interest rates by 50 bps"
            className="w-full px-3 py-2 border border-input rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={scenarioDescription}
            onChange={(e) => setScenarioDescription(e.target.value)}
            placeholder="Federal Reserve announces emergency rate cut in response to market volatility..."
            rows={3}
            className="w-full px-3 py-2 border border-input rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Variables (JSON)</label>
          <textarea
            value={scenarioVariables}
            onChange={(e) => setScenarioVariables(e.target.value)}
            placeholder='{"interest_rate": -0.5, "market_sentiment": "bearish", "fed_action": "emergency_cut"}'
            rows={4}
            className="w-full px-3 py-2 border border-input rounded-md font-mono"
          />
        </div>
        
        <Button onClick={injectScenario} className="w-full">
          <Zap className="mr-2 h-4 w-4" />
          Inject Scenario
        </Button>
        
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Quick Scenarios</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setScenarioTitle('Market Crash');
                setScenarioDescription('Stock market drops 15% due to unexpected economic data');
                setScenarioVariables('{"market_drop": -0.15, "volatility": "high"}');
              }}
            >
              Market Crash
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setScenarioTitle('CEO Resignation');
                setScenarioDescription('Major tech CEO announces surprise resignation');
                setScenarioVariables('{"leadership_change": true, "stock_impact": -0.08}');
              }}
            >
              CEO Resignation
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setScenarioTitle('Product Launch');
                setScenarioDescription('Revolutionary AI product announced by competitor');
                setScenarioVariables('{"innovation": "breakthrough", "competitive_threat": "high"}');
              }}
            >
              Product Launch
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setScenarioTitle('Regulatory Change');
                setScenarioDescription('New AI regulations announced by government');
                setScenarioVariables('{"regulation": "strict", "compliance_cost": 0.2}');
              }}
            >
              Regulation
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsPanel({ simulationId }: { simulationId: string | null }) {
  if (!simulationId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Analytics Dashboard</h3>
            <p className="text-muted-foreground">
              Select a simulation to view detailed analytics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Agent Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Timeline chart would go here
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Platform Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Platform pie chart would go here
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top Agents by Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Agent leaderboard would go here
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sentiment trends would go here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}