import { StatusBar } from './StatusBar';
import { SessionPanel } from './SessionPanel';
import { TraceFeedPanel } from './TraceFeedPanel';
import { FlagsPanel } from './FlagsPanel';
import { MetricsPanel } from './MetricsPanel';
import { AssistBar } from './AssistBar';
import { useWebSocket } from '../hooks/useWebSocket';
import { useInitialData } from '../hooks/useInitialData';

export function DashboardLayout() {
  useWebSocket();
  useInitialData();

  return (
    <div className="h-screen w-screen flex flex-col bg-void-black overflow-hidden">
      <StatusBar />

      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0">
        {/* Top-left: Room 404 live session */}
        <div className="bg-shadow-blue rounded-panel shadow-panel p-4 overflow-auto">
          <SessionPanel />
        </div>

        {/* Top-right: Live trace feed */}
        <div className="bg-shadow-blue rounded-panel shadow-panel p-4 overflow-auto">
          <TraceFeedPanel />
        </div>

        {/* Bottom-left: Active flags */}
        <div className="bg-shadow-blue rounded-panel shadow-panel p-4 overflow-auto">
          <FlagsPanel />
        </div>

        {/* Bottom-right: Grafana metrics embed */}
        <div className="bg-shadow-blue rounded-panel shadow-panel p-4 overflow-hidden">
          <MetricsPanel />
        </div>
      </div>

      <AssistBar />
    </div>
  );
}
