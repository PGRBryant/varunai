# Game Modifiers — MystWeaver Flag Design

> Dramatic, presenter-triggered game modifiers that transform Room 404 mid-session.
> Surfaced in Varunai's UI. Suggested by Gemini. Toggled live on stage.

---

## Why This Matters

Room 404 has 57 feature flags, but they're mostly toggles (room on/off, power-up on/off) and tuning knobs (timer seconds, lives count). None of them create *moments*. None of them make the audience gasp.

Game modifiers are flags that **change the rules mid-game in ways players can feel immediately**. They're the reason Varunai exists — the AI copilot watches the session, reads the emotional temperature, and whispers to the presenter: *"Cooperation is at 23%. Enable `trust-dividend`. Give them a reason to believe in each other."*

The presenter clicks. The game shifts. The audience sees it happen.

---

## Design Principles

1. **Felt, not explained.** Modifiers should change how the game *feels*, not show a popup explaining new rules. Players notice something changed. They don't know what.
2. **Reversible or one-shot.** Each modifier is either a toggle (can be turned off) or a one-shot event (fires once, then resets). No permanent state corruption.
3. **Narratively coherent.** Every modifier has a voice line from the building. It's not a "game setting" — it's the building making a decision.
4. **Gemini-suggestable.** Each modifier has clear trigger conditions so Gemini can reason about when to suggest it.
5. **Presenter-safe.** No modifier can break the game or make it unwinnable. The worst case is "that was mean." The game always recovers.

---

## Modifier Categories

### A. Cooperation & Betrayal

These modifiers shift the moral economy of the dilemma system. They change *why* cooperation or betrayal matters.

---

#### `modifier.trust-dividend`
**Type:** One-shot event
**Effect:** If cooperation rate > 70%, all living players gain +1 life. If < 30%, all players lose 1 life.
**Building voice:** *"The building has been watching. It has reached a conclusion about your collective character."*
**Gemini trigger:** Cooperation rate is hovering around 60-70% and a nudge could tip it. Or cooperation is very low and you want consequences.
**Implementation:** Server reads `session.cooperationScore`, applies life delta to all alive players, broadcasts `MODIFIER_APPLIED` event.
**Risk:** Low. +1 life is generous but not game-breaking. -1 life is harsh but survivable (players start with 3).
**Reversibility:** One-shot. Cannot be undone.

---

#### `modifier.collective-escape`
**Type:** Toggle (boolean)
**Effect:** Win condition changes: the exit door only opens if cooperation rate > 50%. If below 50% when the first player reaches floor 5, nobody can escape — the door stays locked.
**Building voice:** *"The exit was always a collective decision. You just didn't know it yet."*
**Gemini trigger:** Late-game, cooperation is strong (>60%). This flag rewards that behavior dramatically. Or: cooperation is low and you want to raise the stakes.
**Implementation:** In `handleRoomComplete` for `the_exit_room`, check `modifier.collective-escape` flag + `session.cooperationScore`. If below threshold, send `ESCAPE_RESULT { winner: false }` with a custom message.
**Risk:** Medium. Could prevent anyone from winning if cooperation is truly terrible. The presenter can toggle it off.
**Reversibility:** Toggle. Turn off to restore normal exit behavior.

---

#### `modifier.betrayal-tax`
**Type:** Toggle (boolean)
**Effect:** Each betrayal in a dilemma costs the betrayer 1 life (in addition to normal dilemma consequences).
**Building voice:** *"The building has learned to punish the dishonest. Your choices have weight now."*
**Gemini trigger:** Betrayal rate is very high (>60%). This introduces real cost to defection.
**Implementation:** In `handleDilemmaChoice`, after resolving, if player chose `betray` and flag is on, `player.livesRemaining -= 1`. Check for elimination.
**Risk:** Medium. Makes betrayal very costly. Combined with emotional tier penalties, could cascade eliminations. Presenter should only enable mid-game, not from the start.
**Reversibility:** Toggle.

---

#### `modifier.one-survivor`
**Type:** Toggle (boolean)
**Effect:** Only the first soul to clear the exit room escapes. All others are trapped. Shifts from cooperative to competitive.
**Building voice:** *"There is only one way out. And there is only room for one."*
**Gemini trigger:** Game is going smoothly, cooperation is high, and you want to inject tension for the finale. Best enabled on floor 4 or 5.
**Implementation:** In `handleGameEnd`, if flag is on, only the `triggerPlayerId` (the player who cleared the exit) is marked as winner. All others get a custom "TRAPPED" message.
**Risk:** High emotional impact. Players who cooperated all game suddenly realize only one can win. This is the "final betrayal" — the building betrays everyone. **Use sparingly.**
**Reversibility:** Toggle. Can be disabled before anyone reaches the exit.

---

### B. Life & Death

These modifiers change the stakes. They make survival harder, easier, or redefine what death means.

---

#### `modifier.soul-harvest`
**Type:** One-shot event
**Effect:** Every living player loses 1 life simultaneously. The building takes from everyone.
**Building voice:** *"The building requires a deposit. All souls are assessed equally."*
**Gemini trigger:** Game is too easy — most players are at full lives on floor 3+. Or: you want a dramatic mid-game event that changes the calculus.
**Implementation:** Iterate all alive players, `livesRemaining -= 1`. Check for eliminations. Broadcast `MODIFIER_APPLIED` with type `soul_harvest`. Clients show a flash overlay.
**Risk:** Medium. Players with 1 life die. Could trigger mass elimination if many players are already low. Presenter should check standings first.
**Reversibility:** One-shot. Cannot be undone. But `resurrection` can follow.

---

#### `modifier.resurrection`
**Type:** One-shot event
**Effect:** All dead players are revived with 1 life and re-enter the game on their last floor. The building is... merciful? Or bored?
**Building voice:** *"The building has reconsidered. Your termination has been... postponed."*
**Gemini trigger:** Multiple players have died and the audience looks deflated. Or: after a `soul-harvest`, to create a dramatic comeback arc.
**Implementation:** Iterate all dead players: `isAlive = true`, `livesRemaining = 1`. Re-send `FLOOR_ASSIGNED` for their current floor. Broadcast `MODIFIER_APPLIED`. Resurrected players see a special screen before re-entering gameplay.
**Risk:** Medium. Adds complexity — dead players need to re-enter the game loop cleanly. Their `gamePhase` must transition from death/spectator back to dilemma/room flow.
**Reversibility:** One-shot. Players are alive now. They can die again normally.

---

#### `modifier.fragile-souls`
**Type:** One-shot event
**Effect:** All living players' lives are set to 1. Every room is now sudden death.
**Building voice:** *"The building has decided you are all... fragile."*
**Gemini trigger:** Late game (floor 4-5), you want maximum tension for the finale. Or: game is too easy and nobody is at risk.
**Implementation:** Set all alive players' `livesRemaining = 1`. Broadcast `MODIFIER_APPLIED`.
**Risk:** High tension but fair. Players know immediately (their lives display updates). Every room completion feels earned.
**Reversibility:** One-shot. Players can gain lives back through power-ups (rubber duck) if power-ups are enabled.

---

#### `modifier.immortal-round`
**Type:** Toggle (boolean, auto-resets after one floor)
**Effect:** No lives can be lost on the current floor. Failure still costs score/streak, but you survive. A reprieve.
**Building voice:** *"For this room, the building has chosen mercy. Do not mistake this for kindness."*
**Gemini trigger:** After a `soul-harvest` or `fragile-souls`, give players one floor to recover. Or: cooperation rate is very high and you want to reward it without being obvious.
**Implementation:** In `handleRoomFailed`, if flag is on, skip the `livesRemaining -= 1` step. After the floor resolves for all players, auto-reset the flag.
**Risk:** Very low. One floor of safety. Still costs score/streak.
**Reversibility:** Auto-resets after one floor.

---

### C. Difficulty & Tempo

These modifiers change how hard or fast the game is. They affect pacing.

---

#### `modifier.time-crunch`
**Type:** Toggle (boolean)
**Effect:** All room timers halved (15s instead of 30s for standard rooms). Panic mode.
**Building voice:** *"The building has decided time is a luxury you cannot afford."*
**Gemini trigger:** Game is too easy — room completion rate > 85%. Players aren't feeling pressure.
**Implementation:** In `assignFloor`, if flag is on, multiply `timerSeconds` by 0.5 (stacks with emotional tier timer). Min 10s.
**Risk:** Medium. Halved timers are very challenging. Players who were cruising will start failing. Pair with `immortal-round` if you want pressure without death.
**Reversibility:** Toggle. Turn off to restore normal timers.

---

#### `modifier.generous-time`
**Type:** Toggle (boolean)
**Effect:** All room timers doubled (60s for standard rooms). Mercy mode.
**Building voice:** *"The building has decided to give you... time. Use it wisely."*
**Gemini trigger:** Room failure rate > 50% and players are struggling. Or: audience is new to games and needs more time.
**Implementation:** Mirror of `time-crunch` but `timerSeconds * 2`.
**Risk:** Very low. More time = easier. May make game drag if used too long.
**Reversibility:** Toggle.

---

#### `modifier.extra-floors`
**Type:** One-shot event (number: floors to add)
**Effect:** Add N more floors to the game. "You thought you were almost done?"
**Building voice:** *"The building has expanded. There are more rooms now. There were always more rooms."*
**Gemini trigger:** Game is going exceptionally well, audience is engaged, and you want to extend the experience. Best used on floor 3-4.
**Implementation:** `session.totalFloors += N`. Broadcast updated floor count. Sequencer uses `totalFloors` for remaining floor calculation.
**Risk:** Low. Just extends the game. Players see the floor counter change and groan/laugh.
**Reversibility:** One-shot. Floors cannot be removed once added. But the presenter controls when to trigger `handleGameEnd`.

---

#### `modifier.floor-skip`
**Type:** One-shot event
**Effect:** All living players skip the current floor entirely and advance to the next. No room challenge.
**Building voice:** *"This room has been... redacted. Move along."*
**Gemini trigger:** A room is causing widespread failure and the audience is losing interest. Or: pacing needs to accelerate.
**Implementation:** Skip room assignment for current floor. Advance all players to `currentFloor + 1`. Send new `FLOOR_ASSIGNED` (or next dilemma if dilemma-first).
**Risk:** Low. Skips one floor. Players get no score for it.
**Reversibility:** One-shot.

---

### D. Narrative & Atmosphere

These modifiers change the *feel* of the game without changing mechanics directly. They alter what players see and experience.

---

#### `modifier.memory-wipe`
**Type:** One-shot event
**Effect:** All players lose their next memory regardless of room outcome. Even winners lose.
**Building voice:** *"The building is hungry. It takes what it wants."*
**Gemini trigger:** Game is going too smoothly. Nobody is feeling the narrative weight. This reminds everyone what's at stake.
**Implementation:** Set a session-level flag that makes the next `selectMemoryRestoration` return a loss instead. Auto-resets after one floor.
**Risk:** Low mechanically (memories are narrative, not gameplay). High emotional impact.
**Reversibility:** One-shot. Auto-resets.

---

#### `modifier.door-shatter`
**Type:** One-shot event
**Effect:** All players' door integrity instantly set to 1.0 (maximum). The door is broken. Light pours through. Something is changing.
**Building voice:** *"The door has shattered. The light is blinding. Can you feel them waiting?"*
**Gemini trigger:** Late game, cooperation is high, you want the climactic visual payoff. The door-cracking narrative reaches its peak.
**Implementation:** Set all players' `doorIntegrity = 1.0`. Broadcast `MODIFIER_APPLIED`. EmotionalBeatScreen and ReckoningScreen reflect the shattered state visually.
**Risk:** None mechanically. Pure narrative/visual.
**Reversibility:** One-shot. Door integrity continues from 1.0 (already max).

---

#### `modifier.whisper-storm`
**Type:** Toggle (boolean)
**Effect:** Whispers intensify — every player gets a whisper on every floor instead of periodically. The building is speaking directly now.
**Building voice:** (The whispers themselves are the voice.)
**Gemini trigger:** Late game. You want the atmosphere to feel heavy and personal.
**Implementation:** In `selectWhisper`, always return a whisper regardless of floor. Use Act 4 whispers for maximum intensity.
**Risk:** None. Pure atmosphere.
**Reversibility:** Toggle.

---

#### `modifier.bot-invasion`
**Type:** Toggle (boolean)
**Effect:** Dilemma bot injection goes to 100%. Every dilemma is against a bot. Players are alone with the building's constructs.
**Building voice:** *"You are not playing against each other anymore. You are playing against the building."*
**Gemini trigger:** You want to isolate players emotionally. Or: odd player count and you want consistency.
**Implementation:** In `pairPlayersForDilemma`, if flag is on, pair every player with a bot instead of each other.
**Risk:** Low. Changes dilemma dynamics but doesn't affect rooms. Players don't know they're facing bots.
**Reversibility:** Toggle.

---

#### `modifier.reveal-souls`
**Type:** One-shot event
**Effect:** For the next dilemma, players see their opponent's *real name* instead of a soul number. The anonymity is broken.
**Building voice:** *"The building has decided you should know who you are betraying."*
**Gemini trigger:** Mid-game dramatic moment. In a live demo, this is the gasp moment — the audience sees players realize they're facing someone they know.
**Implementation:** In `DILEMMA_PROMPT`, include `opponentDisplayName` instead of just `opponentSoulId`. Client renders the real name. Auto-resets after one dilemma round.
**Risk:** High emotional impact. Low mechanical risk. **Best used once per game.**
**Reversibility:** One-shot. Auto-resets.

---

## Summary Table

| Flag | Type | Category | Impact | Risk | Gemini Priority |
|------|------|----------|--------|------|----------------|
| `modifier.trust-dividend` | One-shot | Cooperation | Medium | Low | High |
| `modifier.collective-escape` | Toggle | Cooperation | High | Medium | Medium |
| `modifier.betrayal-tax` | Toggle | Cooperation | High | Medium | Medium |
| `modifier.one-survivor` | Toggle | Cooperation | Very High | High | Low (use once) |
| `modifier.soul-harvest` | One-shot | Life & Death | High | Medium | High |
| `modifier.resurrection` | One-shot | Life & Death | Very High | Medium | High |
| `modifier.fragile-souls` | One-shot | Life & Death | High | Medium | Medium |
| `modifier.immortal-round` | Auto-toggle | Life & Death | Low | Very Low | High |
| `modifier.time-crunch` | Toggle | Difficulty | Medium | Medium | High |
| `modifier.generous-time` | Toggle | Difficulty | Low | Very Low | High |
| `modifier.extra-floors` | One-shot | Difficulty | Medium | Low | Low |
| `modifier.floor-skip` | One-shot | Difficulty | Low | Low | Medium |
| `modifier.memory-wipe` | One-shot | Narrative | Low (mech) / High (emotional) | Low | Medium |
| `modifier.door-shatter` | One-shot | Narrative | Pure visual | None | Medium |
| `modifier.whisper-storm` | Toggle | Narrative | Pure atmosphere | None | Low |
| `modifier.bot-invasion` | Toggle | Narrative | Medium | Low | Low |
| `modifier.reveal-souls` | One-shot | Narrative | Very High (emotional) | Low | High |

---

## Gemini Assist Integration

The Varunai assist context (`AssistContext`) already includes:
- Player count, completion rate, average score, stuck player count
- Floor distribution
- All current flag values
- Recent flag changes
- Room completion rate, error rate

To support modifier suggestions, the assist prompt needs:
- **Cooperation rate** (from session data)
- **Player elimination count** (dead vs alive)
- **Average lives remaining** (urgency signal)
- **Current floor** (for timing-appropriate suggestions)

Gemini reasoning examples:
- *"Cooperation rate is 23% on floor 3. Players are all betraying. Enable `betrayal-tax` to introduce consequences. Confidence: 0.82, Urgency: high."*
- *"3 of 8 players have been eliminated on floor 4. Enable `resurrection` to bring them back and extend the demo. Confidence: 0.78, Urgency: medium."*
- *"Room completion rate is 92% and no players have lost a life. Enable `fragile-souls` to raise the stakes. Confidence: 0.75, Urgency: medium."*
- *"Floor 5, cooperation rate is 71%. Enable `collective-escape` — this rewards their trust with a dramatic ending. Confidence: 0.88, Urgency: high."*
- *"Only 2 players remain alive on floor 4. Enable `trust-dividend` — cooperation rate is 68%, just under the threshold. This could save or doom them. Confidence: 0.70, Urgency: high."*

---

## Implementation Priority (Recommended)

### Tier 1 — Ship First (highest demo impact, lowest risk)
1. **`modifier.trust-dividend`** — Simple, dramatic, directly tied to cooperation arc
2. **`modifier.soul-harvest`** — The nuclear button. Every demo needs one.
3. **`modifier.resurrection`** — The mercy button. Dramatic counterpoint to harvest.
4. **`modifier.immortal-round`** — Safety valve. Pairs with harvest/fragile.
5. **`modifier.reveal-souls`** — The gasp moment. One-shot, unforgettable.

### Tier 2 — Ship Next (higher complexity)
6. **`modifier.fragile-souls`** — Simple mechanically, high tension
7. **`modifier.time-crunch`** / **`modifier.generous-time`** — Timer modifiers, straightforward
8. **`modifier.betrayal-tax`** — Requires dilemma handler changes

### Tier 3 — Ship Later (more complex or situational)
9. **`modifier.collective-escape`** — Requires exit room handler changes
10. **`modifier.one-survivor`** — High-impact but dangerous, needs careful UX
11. **`modifier.extra-floors`** — Session state change, sequencer implications
12. **`modifier.floor-skip`** — Requires coordinating all players simultaneously

### Tier 4 — Pure Atmosphere (ship anytime)
13. **`modifier.memory-wipe`** — Narrative-only
14. **`modifier.door-shatter`** — Visual-only
15. **`modifier.whisper-storm`** — Atmosphere-only
16. **`modifier.bot-invasion`** — Dilemma-only

---

## Implementation Architecture

### Where Modifiers Live

**MystWeaver flags** — all modifiers are flags in the `modifier.*` namespace. They flow through the same system as existing flags:
1. Varunai's presenter UI shows modifier buttons
2. Presenter clicks → Varunai calls `PATCH /api/flags/modifier.soul-harvest` on MystWeaver
3. MystWeaver broadcasts flag change via Pub/Sub
4. Room 404 server receives flag update, applies effect
5. Room 404 broadcasts results to all players

**One-shot events** are flags that auto-reset to `false` after being processed. The server reads the flag, applies the effect, then patches it back to `false`.

### New Server Code Needed

A new module: `apps/server/src/engine/modifiers.ts`
- `applyModifier(session, flagKey)` — central dispatcher
- Each modifier has its own handler function
- Handlers modify session state and return a list of messages to broadcast
- Called from the flag change listener in `lib/flags.ts`

### New Shared Types

```typescript
// Add to ServerMessage union
| {
    type: 'MODIFIER_APPLIED'
    modifier: string           // flag key
    buildingVoice: string      // the building's commentary
    affectedPlayerIds: string[] // who was affected
    details: Record<string, unknown> // modifier-specific data
  }
```

### Client Handling

- `messageHandler.ts`: Handle `MODIFIER_APPLIED` → push to presenter events + show flash overlay
- `FragmentStolenOverlay`-style component for dramatic modifier effects (reuse pattern)
- Presenter screen shows modifier events in the narrative feed

---

## Varunai UI Integration

Varunai's dashboard needs a new panel or section in the FlagsPanel for modifier buttons:
- Group `modifier.*` flags separately from room/power-up toggles
- Show them as dramatic, one-click action buttons (not toggle switches)
- One-shot modifiers: button with confirmation ("Are you sure?")
- Toggle modifiers: on/off with active state indication
- Each button shows the building voice line as tooltip/description
- Gemini suggestions for modifiers get highlighted treatment in the AssistBar

---

## Open Questions for Room 404 Team

1. Should `MODIFIER_APPLIED` trigger a client-side overlay for players, or is the effect enough? (e.g., resurrection → special screen, soul-harvest → flash + life counter update)
2. Should modifiers be disabled during certain game states? (e.g., no soul-harvest during the exit room)
3. Should the building voice line be shown to players, or only on the presenter screen?
4. Should modifier history be tracked in the session for post-game review?
