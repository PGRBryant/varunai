import { useEffect, useState } from 'react';

type ServiceStatus = 'healthy' | 'degraded' | 'error' | 'unknown';

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
}

const statusColor: Record<ServiceStatus, string> = {
  healthy: 'bg-spirit-teal shadow-glow-teal',
  degraded: 'bg-ember-gold shadow-glow-gold',
  error: 'bg-warning-red shadow-glow-red',
  unknown: 'bg-bureaucrat-grey',
};

export function StatusBar() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'mystweaver', status: 'unknown' },
    { name: 'room404', status: 'unknown' },
    { name: 'verika', status: 'unknown' },
  ]);
  const [clock, setClock] = useState(formatTime(new Date()));

  useEffect(() => {
    const interval = setInterval(() => setClock(formatTime(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) return;
        const data = await res.json() as { checks: Array<{ service: string; status: string }> };
        setServices(
          data.checks.map((c) => ({
            name: c.service,
            status: c.status as ServiceStatus,
          }))
        );
      } catch {
        // Silent
      }
    };
    void check();
    const interval = setInterval(() => void check(), 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-shadow-blue border-b border-bureaucrat-grey/30">
      <h1 className="font-display text-ember-gold text-xl tracking-widest">VARUNAI</h1>

      <div className="flex items-center gap-6">
        {services.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor[s.status]} animate-pulse`} />
            <span className="label text-sm">{s.name}</span>
          </div>
        ))}
      </div>

      <span className="font-mono text-bureaucrat-grey text-lg">{clock}</span>
    </header>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false });
}
