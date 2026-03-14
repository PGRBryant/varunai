import { useState } from 'react';
import { useFlagStore } from '../stores/flagStore';
import type { FlagValue } from '@varunai/shared';

export function FlagsPanel() {
  const flags = useFlagStore((s) => s.flags);
  const updateFlag = useFlagStore((s) => s.updateFlag);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (key: string, currentValue: FlagValue) => {
    setEditing(key);
    setEditValue(String(currentValue));
  };

  const handleApply = (key: string) => {
    const current = flags[key];
    let parsed: FlagValue = editValue;
    if (typeof current === 'number') parsed = Number(editValue);
    if (typeof current === 'boolean') parsed = editValue === 'true';

    updateFlag(key, parsed);
    setEditing(null);
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="label text-lg uppercase tracking-wider mb-3">Active Flags</h2>

      <div className="flex-1 overflow-auto flex flex-col gap-1">
        {Object.keys(flags).length === 0 && (
          <span className="label text-sm">Waiting for flags...</span>
        )}
        {Object.entries(flags).map(([key, value]) => (
          <div
            key={key}
            className="flex items-center gap-3 py-2 px-2 rounded-sharp hover:bg-bureaucrat-grey/20 cursor-pointer"
            onClick={() => editing !== key && handleEdit(key, value)}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                value === false || value === 'OFF'
                  ? 'bg-bureaucrat-grey'
                  : 'bg-spirit-teal shadow-glow-teal'
              }`}
            />
            <span className="font-mono text-sm text-ghost-white/80 flex-1">{key}</span>

            {editing === key ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="bg-void-black border border-bureaucrat-grey rounded-sharp px-2 py-1 font-mono text-sm text-ember-gold w-24 focus:outline-none focus:border-ember-gold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleApply(key)}
                />
                <button
                  onClick={() => handleApply(key)}
                  className="bg-ember-gold/20 text-ember-gold px-3 py-1 rounded-sharp text-sm font-body font-semibold hover:bg-ember-gold/30"
                >
                  APPLY
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="text-bureaucrat-grey hover:text-ghost-white text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="metric-value font-mono text-sm">{String(value)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
