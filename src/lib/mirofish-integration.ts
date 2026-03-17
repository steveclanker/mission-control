/**
 * MiroFish Integration for Mission Control
 * Bringing multi-agent simulation capabilities to our platform
 * 
 * Key Features:
 * - GraphRAG knowledge extraction
 * - Agent persona generation
 * - Multi-agent orchestration
 * - Real-time scenario injection ("God's Eye View")
 */

export interface EntityNode {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'event';
  description: string;
  attributes: Record<string, any>;
  relationships: {
    target: string;
    type: string;
    description: string;
    strength: number;
  }[];
}

export interface KnowledgeGraph {
  id: string;
  title: string;
  description: string;
  nodes: EntityNode[];
  created_at: string;
  updated_at: string;
  source_document?: string;
  total_entities: number;
  total_relationships: number;
}

export interface AgentPersona {
  agent_id: number;
  name: string;
  bio: string;
  persona: string;
  age?: number;
  gender?: string;
  mbti?: string;
  profession?: string;
  interested_topics: string[];
  source_entity_id?: string;
  platform_configs: {
    twitter?: {
      follower_count: number;
      following_count: number;
      tweet_count: number;
    };
    reddit?: {
      karma: number;
      subreddits: string[];
    };
  };
}

export interface SimulationConfig {
  id: string;
  title: string;
  description: string;
  knowledge_graph_id: string;
  agent_personas: AgentPersona[];
  platforms: ('twitter' | 'reddit')[];
  time_config: {
    total_simulation_hours: number;
    minutes_per_round: number;
  };
  scenario_variables: {
    name: string;
    description: string;
    trigger_condition?: string;
    value: any;
  }[];
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface SimulationStatus {
  simulation_id: string;
  runner_status: 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'completed' | 'failed';
  current_round: number;
  total_rounds: number;
  simulated_hours: number;
  total_simulation_hours: number;
  progress_percent: number;
  
  // Platform-specific status
  twitter_current_round: number;
  reddit_current_round: number;
  twitter_simulated_hours: number;
  reddit_simulated_hours: number;
  twitter_running: boolean;
  reddit_running: boolean;
  twitter_completed: boolean;
  reddit_completed: boolean;
  twitter_actions_count: number;
  reddit_actions_count: number;
  total_actions_count: number;
  
  started_at?: string;
  updated_at: string;
  completed_at?: string;
  error?: string;
}

export interface AgentAction {
  round_num: number;
  timestamp: string;
  platform: 'twitter' | 'reddit';
  agent_id: number;
  agent_name: string;
  action_type: string;
  action_args: Record<string, any>;
  result?: string;
  success: boolean;
}

export interface ScenarioInjection {
  id: string;
  simulation_id: string;
  title: string;
  description: string;
  variables: Record<string, any>;
  injected_at: string;
  injected_by: string;
  impact_summary?: string;
}

/**
 * MiroFish Integration Service
 * Handles communication with MiroFish backend for simulation capabilities
 */
export class MiroFishService {
  private baseUrl: string;
  
  constructor(baseUrl = 'http://127.0.0.1:3000') {
    this.baseUrl = baseUrl;
  }

  // Knowledge Graph Management
  async createKnowledgeGraph(
    title: string,
    description: string,
    sourceDocument: string | File
  ): Promise<KnowledgeGraph> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    
    if (typeof sourceDocument === 'string') {
      formData.append('source_text', sourceDocument);
    } else {
      formData.append('source_file', sourceDocument);
    }

    const response = await fetch(`${this.baseUrl}/api/graph/create`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to create knowledge graph: ${response.statusText}`);
    }

    return response.json();
  }

  async getKnowledgeGraph(graphId: string): Promise<KnowledgeGraph> {
    const response = await fetch(`${this.baseUrl}/api/graph/${graphId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get knowledge graph: ${response.statusText}`);
    }

    return response.json();
  }

  async listKnowledgeGraphs(): Promise<KnowledgeGraph[]> {
    const response = await fetch(`${this.baseUrl}/api/mirofish/graph/list`);
    
    if (!response.ok) {
      throw new Error(`Failed to list knowledge graphs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.graphs || [];
  }

  // Agent Persona Generation
  async generateAgentPersonas(
    graphId: string,
    targetCount: number = 50,
    options: {
      persona_diversity?: number;
      platform_focus?: 'twitter' | 'reddit' | 'balanced';
      include_demographics?: boolean;
    } = {}
  ): Promise<AgentPersona[]> {
    const response = await fetch(`${this.baseUrl}/api/mirofish/simulation/generate-personas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        graph_id: graphId,
        target_count: targetCount,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate agent personas: ${response.statusText}`);
    }

    return response.json();
  }

  // Simulation Management
  async createSimulation(config: Omit<SimulationConfig, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<SimulationConfig> {
    const response = await fetch(`${this.baseUrl}/api/mirofish/simulation/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error(`Failed to create simulation: ${response.statusText}`);
    }

    return response.json();
  }

  async startSimulation(
    simulationId: string,
    options: {
      platform?: 'twitter' | 'reddit' | 'parallel';
      max_rounds?: number;
      enable_graph_memory_update?: boolean;
    } = {}
  ): Promise<SimulationStatus> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`Failed to start simulation: ${response.statusText}`);
    }

    return response.json();
  }

  async getSimulationStatus(simulationId: string): Promise<SimulationStatus> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/status`);
    
    if (!response.ok) {
      throw new Error(`Failed to get simulation status: ${response.statusText}`);
    }

    return response.json();
  }

  async stopSimulation(simulationId: string): Promise<SimulationStatus> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/stop`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to stop simulation: ${response.statusText}`);
    }

    return response.json();
  }

  // Real-time Scenario Injection ("God's Eye View")
  async injectScenario(
    simulationId: string,
    scenario: {
      title: string;
      description: string;
      variables: Record<string, any>;
    }
  ): Promise<ScenarioInjection> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/inject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scenario)
    });

    if (!response.ok) {
      throw new Error(`Failed to inject scenario: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Actions & Analytics
  async getAgentActions(
    simulationId: string,
    options: {
      platform?: 'twitter' | 'reddit';
      agent_id?: number;
      round_num?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AgentAction[]> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/actions?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get agent actions: ${response.statusText}`);
    }

    return response.json();
  }

  async getSimulationTimeline(
    simulationId: string,
    startRound: number = 0,
    endRound?: number
  ): Promise<any[]> {
    const params = new URLSearchParams({
      start_round: startRound.toString()
    });
    
    if (endRound !== undefined) {
      params.append('end_round', endRound.toString());
    }

    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/timeline?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get simulation timeline: ${response.statusText}`);
    }

    return response.json();
  }

  async getAgentStats(simulationId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/agent-stats`);
    
    if (!response.ok) {
      throw new Error(`Failed to get agent stats: ${response.statusText}`);
    }

    return response.json();
  }

  // Interview System (Mid-simulation Intelligence)
  async interviewAgent(
    simulationId: string,
    agentId: number,
    prompt: string,
    platform?: 'twitter' | 'reddit'
  ): Promise<{
    success: boolean;
    agent_id: number;
    prompt: string;
    result?: any;
    error?: string;
    timestamp: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/interview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: agentId,
        prompt,
        platform
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to interview agent: ${response.statusText}`);
    }

    return response.json();
  }

  async batchInterviewAgents(
    simulationId: string,
    interviews: {
      agent_id: number;
      prompt: string;
      platform?: string;
    }[],
    platform?: 'twitter' | 'reddit'
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/interview/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        interviews,
        platform
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to batch interview agents: ${response.statusText}`);
    }

    return response.json();
  }

  async interviewAllAgents(
    simulationId: string,
    prompt: string,
    platform?: 'twitter' | 'reddit'
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/simulation/${simulationId}/interview/all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        platform
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to interview all agents: ${response.statusText}`);
    }

    return response.json();
  }

  // Report Generation
  async generateReport(
    simulationId: string,
    reportType: 'summary' | 'detailed' | 'agent_analysis' | 'scenario_impact' = 'summary'
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/report/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        simulation_id: simulationId,
        report_type: reportType
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`);
    }

    return response.json();
  }
}

export const miroFishService = new MiroFishService();