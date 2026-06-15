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
| TanStack Virtual | List virtualisation | Only visible rows in DOM; 5,000 DOM nodes would kill scroll perf |
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

### Phase 2 — Design implementation

Design reference: claude.ai/design artifact "Crash Live Board". Dark trading-terminal aesthetic — obsidian base, acid-lime brand, heat-shift curve, Space Grotesk + JetBrains Mono.

**PR 2a — Global styles + layout shell + TopBar**
- [ ] CSS design tokens (variables, fonts, ambient/grain, scrollbar) into `index.css`
- [ ] `App.tsx` — 2-col grid shell, ambient + grain overlays, `data-phase` on `<body>`
- [ ] `TopBar` — brand logo with acid spark, live pill (seq counter), drift pill, round number, balance

**PR 2b — Hero panel (multiplier readout + crash curve)**
- [ ] `HeroPanel` — card with phase chip, giant multiplier with heat colour, sub-text, countdown progress bar
- [ ] `CrashCurve` — canvas rAF loop: log-scale grid, heat gradient stroke + fill, pulsing tip, crash burst

**PR 2c — History chips + BetPanel**
- [ ] `LastRounds` — coloured chips: lo (<1.5×) red · mid (1.5–2×) amber · hi (2–10×) green · huge (≥10×) acid
- [ ] `BetPanel` — amount input, ½/2×/MAX steppers, quick-amounts (10/25/50/100), action button all states, hint line
- [ ] Action button states: `bet` / `waiting` / `cashout` / `won` / `lost` / `disabled`

**PR 2d — BetsTable**
- [ ] `BetsTable` with TanStack Virtual (5,000 rows, only visible mounted)
- [ ] `BetRow` — `React.memo`, avatar initials, bet amount, cashed multiplier, status badge
- [ ] `StatusBadge` — active (cyan dot) / pending (amber dot) / cashed (green) / lost (red) / muted
- [ ] "You" row: acid highlight border, star avatar, pinned appearance
- [ ] Flash animation on cashout (`flash-green` class, CSS keyframe)

**PR 2e — EventLog**
- [ ] `EventLog` — terminal-style, seq / event type / arg / note columns
- [ ] Note variants: default dim · `warn` amber · `drop` red-soft
- [ ] Slide-in animation on new entries

### Phase 3 — Live bets table wiring

- [ ] Each row subscribes to its own bet by id (not the whole Map)
- [ ] rAF batch flush: accumulate `bet_updated` events, apply once per animation frame
- [ ] Round transition: swap to new bets Map atomically, no stutter
- [ ] Status-change cell highlight via CSS transition + `onTransitionEnd` (no timers)

### Phase 4 — Multiplier ticker

- [ ] Interpolated animation: rAF loop between ticks for smooth 60 fps display
- [ ] Crash state: freeze value, red styling, show crash multiplier prominently
- [ ] Last 6 round results as coloured chips — < 2× red, 2–10× yellow, > 10× green

### Phase 5 — Bet panel wiring

- [ ] Place bet: optimistic pending row → confirmed on `bet_accepted` / removed on `bet_rejected`
- [ ] Cash out button during flight
- [ ] Handle `cashout_rejected` with `reason: "crashed"` — show "too late", mark lost, never get stuck
- [ ] Betting countdown: `endsAt` corrected for clock skew, updated every second

### Phase 6 — Connection status bar & dev modal

- [ ] Status badge: `live` / `reconnecting` / `recovering`
- [ ] Live counters: last seq, clock drift, duplicates dropped, out-of-order fixed, gaps, reconnects
- [ ] Dev button somewhere in the app (corner, subtle) — opens a dev modal
  - [ ] Anomaly log: ring buffer, max 50 entries
  - [ ] Performance monitor: rAF-based FPS + frame time (ms) — see NOTES.md for why rAF and not a library

### Phase 6 — Docs & performance gates

- [ ] `DECISIONS.md` — stubs are pre-drafted in `COMMITS.md`, fill during implementation not at the end
- [ ] `PERFORMANCE.md`:
  - [ ] React Profiler screenshot (single-row re-render proof)
  - [ ] Chrome Perf trace at 4× CPU throttle, 30 s scroll (no frame > 16 ms)
  - [ ] Memory timeline, 10 min (heap returns to baseline between rounds)
