import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAssistStore } from '../stores/assistStore';

export function AssistBar() {
  const suggestion = useAssistStore((s) => s.suggestion);
  const confirmSuggestion = useAssistStore((s) => s.confirm);
  const dismissSuggestion = useAssistStore((s) => s.dismiss);
  const [query, setQuery] = useState('');

  const handleAsk = async () => {
    if (!query.trim()) return;
    try {
      const res = await fetch('/api/assist/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      if (data) {
        useAssistStore.getState().setSuggestion(data);
      }
    } catch {
      // Silent
    }
    setQuery('');
  };

  return (
    <div className="bg-shadow-blue border-t border-bureaucrat-grey/30 px-6 py-3">
      <AnimatePresence mode="wait">
        {suggestion ? (
          <motion.div
            key="suggestion"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-ember-gold font-mono text-sm font-bold uppercase">Assist</span>
                <span className={`text-xs px-2 py-0.5 rounded-sm ${
                  suggestion.urgency === 'high'
                    ? 'bg-warning-red/20 text-warning-red'
                    : suggestion.urgency === 'medium'
                    ? 'bg-ember-gold/20 text-ember-gold'
                    : 'bg-bureaucrat-grey/30 text-ghost-white/60'
                }`}>
                  {suggestion.urgency}
                </span>
              </div>
              <p className="text-ghost-white text-sm">
                <span className="font-mono text-spirit-teal">{suggestion.flagKey}</span>
                {' '}
                <span className="font-mono text-bureaucrat-grey">{String(suggestion.currentValue)}</span>
                {' → '}
                <span className="font-mono text-ember-gold">{String(suggestion.suggestedValue)}</span>
              </p>
              <p className="text-ghost-white/70 text-sm mt-1">{suggestion.reasoning}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={confirmSuggestion}
                className="bg-spirit-teal/20 text-spirit-teal px-4 py-2 rounded-sharp font-body font-semibold text-sm hover:bg-spirit-teal/30 transition-colors"
              >
                CONFIRM
              </button>
              <button
                onClick={dismissSuggestion}
                className="text-bureaucrat-grey hover:text-ghost-white px-2 py-2 text-sm transition-colors"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4"
          >
            <span className="label text-sm whitespace-nowrap">SESSION NOMINAL</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleAsk()}
              placeholder="Ask Varunai..."
              className="flex-1 bg-void-black border border-bureaucrat-grey/40 rounded-sharp px-4 py-2 font-body text-sm text-ghost-white placeholder:text-bureaucrat-grey focus:outline-none focus:border-ember-gold/50"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
