export type FlagValue = string | number | boolean;

export interface FlagChange {
  flagKey: string;
  previousValue: FlagValue;
  newValue: FlagValue;
  changedBy: string;
  onBehalfOf?: string;
  assistReason?: string;
  timestamp: number;
  traceId: string;
}

export type SuggestionUrgency = 'low' | 'medium' | 'high';

export interface AssistSuggestion {
  flagKey: string;
  currentValue: FlagValue;
  suggestedValue: FlagValue;
  reasoning: string;
  predictedEffect: string;
  confidence: number;
  urgency: SuggestionUrgency;
}

export interface AssistContext {
  session: {
    playerCount: number;
    floorDistribution: Record<number, number>;
    completionRate: number;
    averageScore: number;
    stuckPlayerCount: number;
  };
  flags: {
    current: Record<string, FlagValue>;
    recentChanges: FlagChange[];
  };
  metrics: {
    roomCompletionRate: number;
    aiTimeoutRate: number;
    flagEvalRate: number;
    errorRate: number;
  };
  experimentState: {
    active: Experiment[];
    recentResults: ExperimentResult[];
  };
}

export interface Experiment {
  id: string;
  name: string;
  flagKey: string;
  variants: Record<string, FlagValue>;
  status: 'running' | 'paused' | 'completed';
}

export interface ExperimentResult {
  experimentId: string;
  variant: string;
  sampleSize: number;
  conversionRate: number;
}
