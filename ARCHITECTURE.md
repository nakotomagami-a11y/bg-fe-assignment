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

---

## Rules

### Separation of concerns

**Components render. Hooks own logic. Utils are pure. The WS layer knows nothing about React.**

| Layer | Allowed | Not allowed |
|---|---|---|
| `modules/*/components/*.tsx` | JSX, hook calls, reading from store via selectors | Business logic, WS calls, inline state derivation |
| `modules/*/hooks/use*.ts` | `useState`, `useEffect`, `useRef`, store selectors, derived values | Returning JSX, importing from `ws/` directly |
| `modules/*/utils/*.ts` | Pure functions, formatting, constants | Side effects, React imports, store access |
| `ws/WebSocketClient.ts` | WebSocket lifecycle, message dispatch, store actions | React, JSX, component imports |
| `ws/seqBuffer.ts`, `ws/clockSkew.ts` | Pure functions only | Side effects of any kind |
| `store/gameStore.ts` | Zustand state + action handlers | Direct WS calls, JSX |
| `shared/types/*.ts` | Type definitions, re-exports | Runtime logic beyond re-exports |

### File size

No file should exceed **400 lines**. If it does, split it:

- Logic growing inside a component → extract to `use<Name>.ts`
- A hook doing two unrelated things → two hooks
- Utility functions accumulating in a component → `utils/<name>.ts`
- A store action file getting long → split by domain (round actions, bet actions, connection actions)

### Naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utils / pure modules: `camelCase.ts`
- Store slices if split: `camelCaseStore.ts`
- No file named `utils.ts`, `helpers.ts`, or `types.ts` — name files after the group they represent (`dateFormatting.ts`, `betInteractions.ts`). Grouping related functions in one file is fine; one function per file is not required.

### Store discipline

- Components never call store actions directly from event handlers — go through a hook
- No component imports from `ws/` — the WS layer is infrastructure, not a UI dependency
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
BetsTable  MultiplierTicker  ConnectionBar  BetPanel
```

---

## Module map

```
src/
  modules/
    bets-table/
      components/
        BetsTable.tsx          — virtualised container
        BetRow.tsx             — single row, React.memo
      hooks/
        useBetsTable.ts        — virtualiser setup, scroll container ref
      utils/
        formatBet.ts           — display formatting (amounts, multipliers)

    multiplier/
      components/
        MultiplierTicker.tsx   — multiplier readout, crash state
        RoundChips.tsx         — last 6 results, colour-coded
      hooks/
        useMultiplierInterp.ts — smooth value between server ticks

    bet-panel/
      components/
        BetPanel.tsx           — place bet / cash out, countdown, state feedback
      hooks/
        useBetPanel.ts         — bet lifecycle: pending → confirmed/rejected
        useCountdown.ts        — skew-corrected countdown from endsAt
      utils/
        clientBetId.ts         — generates unique clientBetId per bet

    connection/
      components/
        ConnectionBar.tsx      — status badge + live counters

    dev/
      components/
        DevModal.tsx           — modal shell + trigger button (fixed corner)
        AnomalyLog.tsx         — ring buffer display, max 50 entries
        PerfMonitor.tsx        — FPS + frame ms monitor

  ws/
    WebSocketClient.ts         — connect, reconnect, message dispatch, store calls
    seqBuffer.ts               — ordered, exactly-once delivery (pure, unit tested)
    clockSkew.ts               — server/client time offset estimator (pure, unit tested)

  store/
    gameStore.ts               — Zustand store + all action handlers

  shared/
    types/
      server.ts                — re-exports server protocol verbatim
      client.ts                — client-only types: ClientBet, PlayerBet, AnomalyEntry, ConnectionPhase
    hooks/
      useGameStore.ts          — typed useStore wrapper

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

`src/shared/types/server.ts` is a thin re-export:

```ts
export type {
  AnyServerMessage,
  ServerMessage,
  Bet,
  RoundState,
  Phase,
  BetRejectReason,
  CashoutRejectReason,
} from '@server/protocol/protocol'
```

Everything else in the codebase imports from `@/shared/types/server` or `@/shared/types/client` — never directly from the server path except in `server.ts` itself.
