import { SimulationDashboard } from '@/components/SimulationDashboard';

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
};