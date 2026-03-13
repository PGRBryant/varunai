// TODO(varunai-v2): Time window picker flowing from React shell into all
// Grafana panels simultaneously via Grafana's query variable API.
// Triggers when: post-demo analytics become a use case.
// Estimated effort: 1 week.
// See docs/v2-time-windows.md

export function MetricsPanel() {
  const grafanaUrl = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3000';
  const dashboardUid = 'ecosystem-overview';

  const params = new URLSearchParams({
    orgId: '1',
    from: 'now-15m',
    to: 'now',
    theme: 'dark',
    kiosk: '',
  });

  return (
    <div className="flex flex-col h-full">
      <h2 className="label text-lg uppercase tracking-wider mb-3">Metrics</h2>

      <div className="flex-1 rounded-panel overflow-hidden">
        <iframe
          src={`${grafanaUrl}/d/${dashboardUid}?${params.toString()}`}
          className="w-full h-full border-0"
          title="Grafana Metrics"
        />
      </div>
    </div>
  );
}
