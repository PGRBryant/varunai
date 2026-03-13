import { useEventStore } from '../stores/eventStore';

export function TraceFeedPanel() {
  const events = useEventStore((s) => s.events);

  return (
    <div className="flex flex-col h-full">
      <h2 className="label text-lg uppercase tracking-wider mb-3">Live Trace Feed</h2>

      <div className="flex-1 overflow-auto flex flex-col-reverse gap-1">
        {events.length === 0 ? (
          <span className="label text-sm">Waiting for events...</span>
        ) : (
          events.map((event, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-1 border-b border-bureaucrat-grey/20 text-sm"
            >
              <span className="timestamp text-xs whitespace-nowrap">
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="text-ghost-white/80 flex-1">
                <span className="text-spirit-teal">{event.caller}</span>
                {' → '}
                <span className="text-ember-gold">{event.target}</span>
              </span>
              <span className="label text-xs">{event.capability}</span>
              <span className={event.allowed ? 'text-spirit-teal' : 'text-warning-red'}>
                {event.allowed ? '✓' : '✗'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
