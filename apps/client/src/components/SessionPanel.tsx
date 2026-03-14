import { useSessionStore } from '../stores/sessionStore';

export function SessionPanel() {
  const session = useSessionStore((s) => s.session);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="label text-lg">Waiting for session...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="label text-lg uppercase tracking-wider">Room 404 Session</h2>
        <span className="metric-value--teal font-mono text-xl">{session.sessionCode}</span>
      </div>

      <div className="metric-value text-3xl font-mono">
        {session.playerCount} <span className="label text-sm">players</span>
      </div>

      <div>
        <h3 className="label text-sm mb-2">Floor Distribution</h3>
        <div className="flex flex-col gap-1">
          {Object.entries(session.floorDistribution)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, count]) => (
              <div key={floor} className="flex items-center gap-2">
                <span className="label text-xs w-8 text-right">{floor}</span>
                <div className="flex-1 bg-bureaucrat-grey/30 rounded-sm h-3 overflow-hidden">
                  <div
                    className="h-full bg-spirit-teal/70 rounded-sm"
                    style={{ width: `${session.playerCount > 0 ? (count / session.playerCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-ghost-white/60 w-6">{count}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="label text-sm">Completion</span>
          <div className="metric-value text-2xl font-mono">
            {(session.completionRate * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <span className="label text-sm">Avg Score</span>
          <div className="metric-value text-2xl font-mono">
            {session.averageScore.toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <h3 className="label text-sm mb-2">Leaderboard</h3>
        <div className="flex flex-col gap-1">
          {session.leaderboard.slice(0, 5).map((s) => (
            <div key={s.rank} className="flex items-center justify-between font-mono text-sm">
              <span className="text-bureaucrat-grey">#{s.rank}</span>
              <span className="text-ghost-white">{s.displayName}</span>
              <span className="metric-value">{s.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
