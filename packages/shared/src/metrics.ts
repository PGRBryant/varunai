/**
 * Canonical metric names — single source of truth to prevent string drift
 * across the OTel collector config, Grafana dashboards, and application code.
 */

// ── MystWeaver ────────────────────────────────────────────────────
export const MYSTWEAVER_FLAG_EVALUATIONS_TOTAL = 'mystweaver_flag_evaluations_total';
export const MYSTWEAVER_SDK_CONNECTIONS_ACTIVE = 'mystweaver_sdk_connections_active';
export const MYSTWEAVER_CIRCUIT_BREAKER_STATE = 'mystweaver_circuit_breaker_state';
export const MYSTWEAVER_SSE_CONNECTIONS_ACTIVE = 'mystweaver_sse_connections_active';
export const MYSTWEAVER_EVENT_INGESTION_TOTAL = 'mystweaver_event_ingestion_total';

// ── Room 404 ──────────────────────────────────────────────────────
export const ROOM404_PLAYERS_ACTIVE = 'room404_players_active';
export const ROOM404_FLOOR_COMPLETIONS_TOTAL = 'room404_floor_completions_total';
export const ROOM404_WS_CONNECTIONS_ACTIVE = 'room404_ws_connections_active';
export const ROOM404_AI_GENERATION_DURATION = 'room404_ai_generation_duration';
export const ROOM404_AI_TIMEOUT_TOTAL = 'room404_ai_timeout_total';

// ── Varunai ───────────────────────────────────────────────────────
export const VARUNAI_ASSIST_SUGGESTIONS_TOTAL = 'varunai_assist_suggestions_total';
export const VARUNAI_ASSIST_APPLIED_TOTAL = 'varunai_assist_applied_total';
export const VARUNAI_ASSIST_DISMISSED_TOTAL = 'varunai_assist_dismissed_total';
export const VARUNAI_ASSIST_LATENCY = 'varunai_assist_latency';
export const VARUNAI_WS_CONNECTIONS_ACTIVE = 'varunai_ws_connections_active';
export const VARUNAI_FLAG_WRITE_TOTAL = 'varunai_flag_write_total';
export const VARUNAI_FLAG_WRITE_ERRORS_TOTAL = 'varunai_flag_write_errors_total';
