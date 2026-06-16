# Implementation Plan — Crash Game Live Board

> **Status:** Draft — work in progress, not finalised.
> For deep-dives on any decision, see `NOTES.md` and `DECISIONS.md`.

---

## Step 0 — Before any code

- [x] Scan the provided server repo for malicious code before running it locally
- [x] Create a simple UI design using Claude (claude.ai artifacts). Why Claude? Easier communication between design intent and code — the same tool that generates the design can directly reference it when implementing

---

## What we're building

Four-part single-page dashboard over a real-time WebSocket feed:

1. **Live bets table** — ~5,000 rows, 200+ updates/s during flight
2. **Multiplier ticker** — smooth animation between 20 server ticks/s
3. **Connection status bar** — health, counters, anomaly log
4. **Bet panel** — place bet, cash out, handle crash race

---

## Stack

| Tool | Role | Why |
|---|---|---|
| Vite | Bundler / dev server | Fast HMR, native ESM, no config |
| React 19 + TS strict | UI + type safety | Required by assignment |
| ESLint (flat config) | Lint | Catches hook rule violations and floating promises TS can't see |
| Zustand | State | Fine-grained subscriptions — Context re-renders everything, Zustand re-renders only what subscribed to the changed slice |
| ~~TanStack Virtual~~ custom `useVirtualList` | List virtualisation | Only visible rows in DOM; 5,000 DOM nodes would kill scroll perf |
| Tailwind CSS | Styling | Co-located, no CSS-in-JS runtime cost at 200 updates/s |
| ts-pattern | Pattern matching | Exhaustive matching on WS message types — compile error if a type is unhandled |
| Vitest | Tests | Same pipeline as Vite, no extra config |

**Consciously excluded:**
- **React Query** — the right tool for HTTP data fetching (caching, background refetch, loading states). No REST endpoints in this project, everything is WebSocket push. Would add it the moment a real API surface appears (e.g. fetching account balance, bet history).
- **Axios** — same reason. An HTTP client with no HTTP calls is dead weight.

---

## Architecture

See `ARCHITECTURE.md` for the full breakdown — data flow, interfaces, file map, exit criteria.

---

## Phases

### Phase 1 — Scaffold & WebSocket engine

- [x] pnpm monorepo with `client` and `server` workspaces — `pnpm dev` at root boots both
- [x] Vite + React 19 + TypeScript strict scaffold in `client/`
- [x] `@/*` and `@server/*` tsconfig + Vite path aliases wired up
- [x] Add deps: `zustand`, `@tanstack/react-virtual`, `ts-pattern`
- [x] Add dev deps: `tailwindcss @tailwindcss/vite`, `vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event`
- [x] Configure Tailwind, Vitest
- [x] `seqBuffer.ts` — ordered, exactly-once delivery (pure, tested)
- [x] `clockSkew.ts` — last-message time anchor for countdown (pure, tested)
- [x] Zustand store skeleton — types, actions, anomaly ring
- [x] `WebSocketClient` class — connect, backoff, seqBuffer routing, clock anchor, health metrics
- [x] Wire WebSocketClient → store — wsService.ts, ts-pattern exhaustive dispatch, VITE_WS_URL env

### Phase 2 — Live bets table

- [x] `BetsTable` with custom `useVirtualList` (replaced TanStack Virtual — see DECISIONS.md)
- [x] Each row: `React.memo`, subscribes to its own bet by id (not the whole Map)
- [x] rAF batch flush: accumulate `bet_updated` events, apply once per animation frame
- [x] Round transition: swap to new bets Map atomically, no stutter
- [x] Status-change cell highlight via CSS `flash-green` / `flash-red` keyframe animations

### Phase 3 — Multiplier ticker

- [x] Interpolated animation: rAF loop between ticks for smooth 60 fps display
- [x] Crash state: freeze value, red styling, show crash multiplier prominently
- [x] Last rounds as coloured chips — < 2× red, 2–10× amber, > 10× green

### Phase 4 — Bet panel

- [x] Place bet: optimistic pending → confirmed on `bet_accepted` / rejected on `bet_rejected`
- [x] Cash out button during flight with live payout preview
- [x] Handle `cashout_rejected` with `reason: "crashed"` — mark lost, never get stuck
- [x] Betting countdown: `endsAt` corrected for clock skew, updated every 100 ms

### Phase 5 — Connection status bar & dev modal

- [x] Status badge: `live` / `reconnecting` / `recovering` / `connecting`
- [x] Live counters: last seq, clock drift, duplicates dropped, out-of-order fixed, gaps, reconnects
- [x] Dev button in TopBar — opens dev modal
  - [x] Anomaly log: ring buffer, max 50 entries
  - [x] Performance monitor: rAF-based FPS + frame time sparkline

### Phase 6 — Docs & performance gates

- [x] `DECISIONS.md` — filled during implementation
- [ ] `PERFORMANCE.md`:
  - [ ] React Profiler screenshot (single-row re-render proof)
  - [ ] Chrome Perf trace at 4× CPU throttle, 30 s scroll (no frame > 16 ms)
  - [ ] Memory timeline, 10 min (heap returns to baseline between rounds)
