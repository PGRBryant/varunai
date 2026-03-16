import { useState, useCallback } from 'react';
import { useFlagStore } from '../stores/flagStore';
import type { FlagValue } from '@varunai/shared';

// Modifier metadata for the dramatic buttons
const MODIFIER_META: Record<string, { label: string; description: string; color: string; oneShot: boolean }> = {
  'modifier.trust-dividend': {
    label: 'TRUST DIVIDEND',
    description: 'Reward or punish based on cooperation rate',
    color: 'ember-gold',
    oneShot: true,
  },
  'modifier.soul-harvest': {
    label: 'SOUL HARVEST',
    description: 'Every living soul loses 1 life',
    color: 'warning-red',
    oneShot: true,
  },
  'modifier.resurrection': {
    label: 'RESURRECTION',
    description: 'Revive all dead players with 1 life',
    color: 'spirit-teal',
    oneShot: true,
  },
  'modifier.immortal-round': {
    label: 'IMMORTAL ROUND',
    description: 'No lives lost on current floor',
    color: 'spirit-teal',
    oneShot: false,
  },
  'modifier.reveal-souls': {
    label: 'REVEAL SOULS',
    description: 'Next dilemma shows real names',
    color: 'ember-gold',
    oneShot: true,
  },
};

function ModifierButton({
  flagKey,
  value,
  onActivate,
}: {
  flagKey: string;
  value: FlagValue;
  onActivate: (key: string, newValue: FlagValue) => void;
}) {
  const meta = MODIFIER_META[flagKey];
  if (!meta) return null;

  const isActive = value === true;
  const [confirming, setConfirming] = useState(false);

  const handleClick = useCallback(() => {
    if (meta.oneShot) {
      if (confirming) {
        onActivate(flagKey, true);
        setConfirming(false);
      } else {
        setConfirming(true);
        // Auto-cancel after 3s
        setTimeout(() => setConfirming(false), 3000);
      }
    } else {
      onActivate(flagKey, !isActive);
    }
  }, [flagKey, isActive, confirming, meta.oneShot, onActivate]);

  const colorMap: Record<string, { border: string; bg: string; text: string; glow: string }> = {
    'ember-gold': {
      border: 'border-ember-gold/50',
      bg: isActive ? 'bg-ember-gold/20' : 'bg-ember-gold/5',
      text: 'text-ember-gold',
      glow: isActive ? 'shadow-glow-gold' : '',
    },
    'warning-red': {
      border: 'border-warning-red/50',
      bg: isActive ? 'bg-warning-red/20' : 'bg-warning-red/5',
      text: 'text-warning-red',
      glow: isActive ? 'shadow-glow-red' : '',
    },
    'spirit-teal': {
      border: 'border-spirit-teal/50',
      bg: isActive ? 'bg-spirit-teal/20' : 'bg-spirit-teal/5',
      text: 'text-spirit-teal',
      glow: isActive ? 'shadow-glow-teal' : '',
    },
  };

  const defaultColors = { border: 'border-ember-gold/50', bg: 'bg-ember-gold/5', text: 'text-ember-gold', glow: '' };
  const colors = colorMap[meta.color] ?? defaultColors;

  return (
    <button
      onClick={handleClick}
      className={`w-full px-3 py-2.5 rounded-panel border ${colors.border} ${colors.bg} ${colors.glow}
        text-left transition-all hover:brightness-110`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-body font-semibold text-sm tracking-wider ${colors.text}`}>
          {confirming ? 'CONFIRM?' : meta.label}
        </span>
        {!meta.oneShot && (
          <span className={`font-mono text-xs ${isActive ? colors.text : 'text-bureaucrat-grey'}`}>
            {isActive ? 'ON' : 'OFF'}
          </span>
        )}
        {meta.oneShot && !confirming && (
          <span className="font-mono text-xs text-bureaucrat-grey">ONE-SHOT</span>
        )}
      </div>
      <p className="font-mono text-ghost-white/30 text-xs mt-1">{meta.description}</p>
    </button>
  );
}

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

  // Separate modifier flags from regular flags
  const modifierFlags = Object.entries(flags).filter(([key]) => key.startsWith('modifier.'));
  const regularFlags = Object.entries(flags).filter(([key]) => !key.startsWith('modifier.'));

  return (
    <div className="flex flex-col h-full">
      {/* Modifiers section */}
      {modifierFlags.length > 0 && (
        <div className="mb-4">
          <h2 className="label text-lg uppercase tracking-wider mb-3">Modifiers</h2>
          <div className="flex flex-col gap-2">
            {modifierFlags.map(([key, value]) => (
              <ModifierButton
                key={key}
                flagKey={key}
                value={value}
                onActivate={updateFlag}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular flags section */}
      <h2 className="label text-lg uppercase tracking-wider mb-3">Active Flags</h2>

      <div className="flex-1 overflow-auto flex flex-col gap-1">
        {regularFlags.length === 0 && modifierFlags.length === 0 && (
          <span className="label text-sm">Waiting for flags...</span>
        )}
        {regularFlags.map(([key, value]) => (
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
