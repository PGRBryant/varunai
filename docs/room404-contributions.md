# Room 404 — Varunai Contributions

> Tracks UI and integration work that Varunai contributes upstream to Room 404.
> Excellent presenter UI is critical to the demo — we build it, they merge it.

---

## Active PRs

| PR | Branch | Status | Description |
|----|--------|--------|-------------|
| [PGRBryant/room404#1](https://github.com/PGRBryant/room404/pull/1) | `feat/presenter-redesign` | Open | Presenter screen redesign for projector display |

---

## Completed

_(None yet)_

---

## PR 1: Presenter Screen Redesign

**Goal:** Replace the functional-but-flat `/presenter` view with a cinematic, Jackbox.tv-style experience optimized for 1920x1080 projection.

**Files changed:**
- `apps/client/src/screens/PresenterScreen.tsx` — complete rewrite
- `apps/client/src/copy/uiCopy.ts` — new presenter copy strings

**What changed:**

### Lobby Phase (pre-game)
- Large DepartmentSeal (160px) with "Department of Eternal Processing"
- Glowing ROOM 404 title (Cinzel Decorative, 72px, ember-gold text-shadow)
- Room code in oversized individual character boxes (spirit-teal glow, 120px mono)
- QR code card alongside room code for audience to scan
- Animated soul counter that scales on player join
- Player name chips in a flex-wrap grid — border turns spirit-teal when READY
- Pulsing "SEAL THEIR FATE" button with ember-gold glow animation
- Radial gradient background (void-black → purgatory-purple)

### Countdown Phase (game starting)
- Full-screen overlay with countdown number (200px, spirit-teal, scale animation)
- Each number animates in with scale 2→1, exits with scale 1→0.5
- "PREPARING YOUR DESCENT..." pulsing text

### Active Game Phase
- Compact header bar: seal, title, floor progress (ROOM X / 15), soul count, room code, state badge
- 70/30 split layout:
  - **Leaderboard** (70%): Score progress bars (relative to max), rank transition animations via `layout`, top-3 styling (gold/silver/bronze), delta values in teal/red, large readable fonts
  - **Event feed** (30%): Color-coded entries (info/good/bad), timestamps, auto-scroll, 30-entry rolling buffer

### Technical approach
- No new dependencies, stores, or routes
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
