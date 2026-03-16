# Room 404 — Varunai Contributions

> Tracks UI and integration work that Varunai contributes upstream to Room 404.
> Excellent presenter UI is critical to the demo — we build it, they merge it.

---

## Active PRs

| PR | Branch | Status | Description |
|----|--------|--------|-------------|
| [PGRBryant/room404#1](https://github.com/PGRBryant/room404/pull/1) | `feat/presenter-redesign` | Merged | Presenter screen redesign for projector display |
| [PGRBryant/room404#2](https://github.com/PGRBryant/room404/pull/2) | `feat/death-experience-redesign` | Merged | Death experience redesign — ghost spectator + steal animation |
| [PGRBryant/room404#3](https://github.com/PGRBryant/room404/pull/3) | `feat/game-modifiers-tier1` | Open | Game modifiers tier 1 — 5 presenter-triggered mid-game events |

---

## Completed

_(None yet)_

---

## PR 1: Presenter Screen Redesign

**Goal:** Replace the functional-but-flat `/presenter` view with a cinematic, Jackbox.tv-style experience optimized for 1920x1080 projection.

**Two commits — lobby redesign + narrative feed.**

### Commit 1: Cinematic Lobby + Countdown
- Large DepartmentSeal, glowing title, oversized room code characters, QR code
- Animated soul counter, player name chips, pulsing "SEAL THEIR FATE" button
- Full-screen 3-2-1 countdown overlay with scale animation

### Commit 2: Narrative Feed — "The Building Speaks" (full-stack)
- New `PRESENTER_EVENT` shared type (8 event kinds)
- Server broadcasts narrative events (memories, dilemmas, whispers, eliminations)
- 3-column active game layout: Narrative Feed (25%) | Leaderboard (40%) | Building Speaks (35%)
- Cooperation meter + door integrity meter in header/sidebar
- Memory events in cursed font, dilemma outcome cards, whispers

**Files changed:** `types.ts`, `handler.ts`, `PresenterScreen.tsx`, `gameStore.ts`, `messageHandler.ts`, `uiCopy.ts`
- Same WebSocket/session init flow as original
- View switching via `AnimatePresence` keyed on `sessionState` + `countdown`
- All styling uses existing Room 404 design tokens and Tailwind config

---

## Planned Contributions

### Presenter — Game Over Screen
- **Trigger:** After presenter redesign is merged and tested
- **Scope:** Add a `complete` phase view with final leaderboard, winner announcement, and stats summary
- **Effort:** Small — same component, new conditional branch

### Session Discovery Endpoint
- **Trigger:** Varunai needs to auto-discover active sessions (Phase 0 prerequisite)
- **Scope:** `GET /api/session/current` endpoint on Room 404's server
- **Spec:** See [room404-integration.md](room404-integration.md) Change 1
- **Effort:** Small — single route addition

---

## Contributing Guidelines

When submitting PRs to Room 404:
1. Work on feature branches in `PGRBryant/room404` (we have push access)
2. Prefix branches with `feat/`, `fix/`, or `chore/`
3. Follow Room 404's design system: tokens.css colors, Tailwind custom classes, Framer Motion animations
4. Typecheck: `pnpm --filter @room404/shared build && pnpm --filter @room404/client typecheck`
5. Build: `pnpm --filter @room404/client build`
6. No new dependencies without discussion
