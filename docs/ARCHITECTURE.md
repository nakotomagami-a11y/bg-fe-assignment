# Architecture — Crash Game Live Board

---

## Goals 

- Maintain a reliable, consistent view of live game state over a real-time WebSocket connection — ordered delivery, exactly-once processing, reconnect resilience, full state sync — without any of that complexity leaking into UI components.
- Sustain 60 fps under load: 5,000 bet rows, 200+ updates/s during flight, 4× CPU throttle.
- Single-row re-renders only. A bet status change must not touch its neighbours.
- Round transitions (5,000 rows out, 5,000 new rows in every ~30 s) without visible stutter.
- Memory flat over time. No accumulation between rounds.

## Non-goals

- Visual polish beyond "tidy and readable" — designer doesn't exist, not graded.
- Supporting more than one concurrent WS connection.
- SSR, routing, or any server-side concerns.

---

## Locked decisions

| # | Decision | Reason |
|---|----------|--------|
| 1 | `WebSocketClient` is a plain class, not a hook or component | React lifecycle would reconnect on every re-render. Class lives for the app lifetime. |
| 2 | ts-pattern `.exhaustive()` on WS message handler | Compile error if a known message type goes unhandled. Unknown types from the server log and continue — no crash. |
| 3 | `bets` stored as `Map<id, ClientBet>`, not array | O(1) lookup per `bet_updated`. 200 updates/s × O(n) scan = measurable cost at 5,000 bets. |
| 4 | `round_crash` "lost" is computed at render time, not stored | `round_crash` updates `round.phase` to `'crashed'` only. A bet renders as lost when `phase === 'crashed' && bet.status === 'active'`. Zero iteration, zero mass-update, always consistent. `ClientBetStatus` has no `'lost'` value. |
| 5 | Replies bypass the seq buffer entirely | `bet_accepted`, `bet_rejected`, `cashout_accepted`, `cashout_rejected` share `seq` with feed messages by design — routing them through the buffer would drop legitimate feed messages. Replies dispatched directly by `clientBetId` / `betId`. |
| 6 | String literal unions, not enums | Server sends plain strings. Enums add a runtime object and require mapping on the way in. ts-pattern works best with string literal unions. No `enum` anywhere in the codebase. |

---

## Rules

### Separation of concerns

**Components render. Hooks own logic. Utils are pure. The WS layer knows nothing about React.**

| Layer | Allowed | Not allowed |
|---|---|---|
| `modules/*/components/*.tsx` | JSX, hook calls, reading from store via selectors | Business logic, WS calls, store actions |
| `modules/*/hooks/use*.ts` | `useState`, `useEffect`, `useRef`, store selectors, `lib/ws/*` when acting as ws–React bridge | Returning JSX |
| `modules/*/utils/*.ts` | Pure functions, formatting, constants | Side effects, React imports, store access |
| `lib/ws/client.ts`, `lib/ws/wsService.ts` | WS lifecycle, message dispatch, store actions | React, JSX, component imports |
| `lib/ws/seqBuffer.ts`, `lib/ws/clockSkew.ts` | Pure functions only | Side effects of any kind |
| `store/gameStore.ts` | Zustand state + action handlers | Direct WS calls, JSX |
| `lib/types/*.ts` | Type definitions | Runtime logic |

### File size

Components and hooks should not exceed **400 lines**. Utility files can be longer as long as everything in them is cohesive — a long `betFormatting.ts` full of related formatting functions is fine. A long component or hook is a sign it's doing too much. If a component or hook exceeds the limit, split it:

- Logic growing inside a component → extract to `use<Name>.ts`
- A hook doing two unrelated things → two hooks
- A store action file getting long → split by domain (round actions, bet actions, connection actions)

### Naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utils / pure modules: `camelCase.ts`
- Store slices if split: `camelCaseStore.ts`
- No file named `utils.ts`, `helpers.ts`, or `types.ts` — name files after the group they represent (`dateFormatting.ts`, `betInteractions.ts`). Grouping related functions in one file is fine; one function per file is not required.

### Store discipline

- Components never call store actions directly from event handlers — go through a hook
- No component imports from `lib/ws/` — the WS layer is infrastructure, not a UI dependency
- Selectors stay in the component or hook that uses them — don't create a `selectors.ts` file prematurely

---

## Data flow

```
┌─ Outside React (singleton, app lifetime) ─────────────────┐
│  WebSocketClient                                           │
│    • connects to ws://localhost:8080                       │
│    • exponential backoff reconnect                         │
│    • ordered, exactly-once message processing              │
│    • full state sync on (re)connect via snapshot           │
│    • clock anchor: lastServerTime + elapsed local time     │
│    • calls store actions directly                          │
└──────────────────────┬────────────────────────────────────┘
                       │ store actions
                       ▼
┌─ Zustand store ───────────────────────────────────────────┐
│  connectionPhase · stats · anomalyLog                     │
│  round · bets: Map<id, ClientBet> · lastRounds            │
│  playerBet                                                │
└──┬──────────┬───────────────┬──────────────┬─────────────┘
   │          │               │              │
   ▼          ▼               ▼              ▼
BetsTable  HeroPanel       TopBar         BetPanel
           CrashCurve
           LastRounds
```

---

## WS message pipeline

```
WS frame arrives
  → parse JSON
  → ts-pattern match on msg.type

      snapshot
        → discard buffer entries with seq ≤ snapshot.seq
        → replay buffered entries with seq > snapshot.seq in order
        → apply snapshot as ground truth

      feed messages (betting_open, bets_placed, round_start,
                     multiplier_tick, bet_updated, round_crash)
        → seq buffer:
            already seen seq?  → drop, duplicatesDropped++
            gap (seq skipped)? → hold, gapsDetected++
            out of order?      → hold in sorted buffer, outOfOrderFixed++
            next in seq?       → process, drain buffer

      replies (bet_accepted, bet_rejected, cashout_accepted, cashout_rejected)
        → bypass seq buffer entirely (decision #5)
        → dispatch directly by clientBetId / betId

      unknown type
        → log to anomalyLog, continue (decision #2 — don't crash)
```

### Exponential backoff

When the connection drops, we wait before trying to reconnect. The delay starts at 1s and doubles each time — 1s, 2s, 4s, 8s, 16s — then caps at 30s. A small random amount is added to each delay (jitter) so that if many clients drop at the same time, they don't all hammer the server at the exact same moment.

### Snapshot reconciliation

Every time we connect (or reconnect) the server immediately sends a full snapshot of the current round state. Any messages we had buffered while waiting to reconnect that are older than the snapshot are now stale and get thrown away — the snapshot already has that information baked in. From there we pick up fresh.

### Clock skew

`endsAt` (when betting closes) is in server time. Rather than estimating an absolute offset between clocks, we anchor to the most recent message:

```
timeLeft = endsAt - (lastServerTime + (Date.now() - lastLocalTime))
```

`lastServerTime` and `lastLocalTime` are saved from the last received feed message or snapshot. Reply messages (`bet_accepted` etc.) are excluded — their processing delay (200–800 ms) would pollute the anchor. The bracketed part is our best estimate of what the server clock reads right now — the server time we last saw, plus however much local time has passed since. Error is limited to the network latency of that one message, which is negligible for a second-level countdown. On reconnect the snapshot provides a fresh `endsAt` to anchor from.

---

## Module map

```
src/
  modules/
    bets-table/
      components/
        BetsTable.tsx              — virtualised container, memo-wrapped
        BetRow.tsx                 — single row, React.memo
      hooks/
        useVirtualList.ts          — virtualiser setup, scroll container ref

    multiplier/
      components/
        HeroPanel.tsx              — multiplier readout, crash state, curve host
        CrashCurve.tsx             — canvas crash curve (heat colour, glow, tip)
        LastRounds.tsx             — last 6 results, colour-coded
      hooks/
        useInterpolatedMultiplier.ts — smooth value between server ticks
        useCrashHistory.ts         — history buffer + mid-flight page-reload synthesis
      utils/
        curveRenderer.ts           — pure canvas drawing (heat, grid, fill, stroke, tip)

    bet-panel/
      components/
        BetPanel.tsx               — place bet / cash out, countdown, state feedback
      hooks/
        useBetPanel.ts             — bet lifecycle: pending → confirmed/rejected
        useCountdown.ts            — skew-corrected countdown from endsAt

    dev/
      components/
        DevModal.tsx               — dev overlay (FPS, anomaly log, seq stats)
      hooks/
        useFpsMonitor.ts           — rAF-based FPS + frame-time sampler

  components/
    TopBar.tsx                     — brand, connection badge, round info, dev trigger
    Button.tsx                     — shared button primitive (solid/outline, sm/lg)
    Input.tsx                      — shared input with optional currency prefix

  lib/
    ws/
      client.ts                    — WebSocket lifecycle, reconnect, message dispatch
      wsService.ts                 — singleton instance + store action wiring
      seqBuffer.ts                 — ordered, exactly-once delivery (pure, unit tested)
      clockSkew.ts                 — last-message time anchor (pure, unit tested)
      useClockDrift.ts             — React hook: polls anchor for live drift display
    types/
      client.ts                    — client-only types: ClientBet, PlayerBet, AnomalyEntry, ConnectionPhase
    utils/
      cn.ts                        — clsx + tailwind-merge

  store/
    gameStore.ts                   — Zustand store + all action handlers

  App.tsx
  main.tsx
```

---

## Type reuse from the server

`server/src/protocol/protocol.ts` is the single source of truth for the wire protocol. We import from it via a tsconfig path alias — no copying, no drift risk:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["../server/src/*"]
    }
  }
}
```

Components and hooks import server types directly via `@server/protocol/protocol` when needed. Client-only types (`ClientBet`, `PlayerBet`, `AnomalyEntry`, `ConnectionPhase`) live in `src/lib/types/client.ts`.
