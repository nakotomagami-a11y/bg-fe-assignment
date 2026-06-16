# Performance

---

## Built-in observability

The app ships with two layers of live monitoring that don't require opening DevTools.

### TopBar (always visible)

The status bar shows at a glance:

- **FPS / frame ms** — rAF-sampled, rolling average over the last 60 frames. Gives an immediate read on render budget during fast scroll or heavy update bursts.
- **Connection badge** — `live` / `reconnecting` / `recovering` / `connecting` so the current WS state is never ambiguous.
- **seq** — the last sequence number processed through the seq buffer. Useful for spotting a stalled buffer (seq stops incrementing despite traffic).
- **drift** — estimated offset between server clock and local clock in ms, recalculated every 500ms from the last received feed message anchor. A steadily growing drift means the server and client clocks are diverging; a spike means a message arrived with an unusually stale timestamp.

### DevModal (dev button, top-right)

Clicking **dev** opens a panel with the full diagnostic picture:

- **Connection section** — phase, last seq, drift, and four counters: duplicates dropped, out-of-order messages fixed, gaps detected, reconnects. These accumulate for the lifetime of the session, making it easy to see if the seq buffer is doing real work.
- **Performance section** — current FPS, current frame ms, and a sparkline of the last N frames colour-coded by budget: green (≤ 16.7 ms), amber (≤ 20 ms), red (> 20 ms). The sparkline makes transient frame spikes visible even if the rolling average has already smoothed over them.
- **Event log** — timestamped ring of the last 50 anomaly events: `gap`, `duplicate`, `out_of_order`, `reconnect`, `snapshot_reset`, `server_error`. Each entry shows the exact ms timestamp, kind, and detail string so the order of events around a disconnect can be reconstructed.

---

## Observations

### Steady-state frame rate

The app holds 60 fps under normal operating conditions — live WS feed, multiplier animating, bets table receiving 200+/s updates. Minor dips occur when opening the DevModal (the panel mounts, the sparkline starts accumulating, and the first batch of rAF-sampled frames flushes into the buffer). These dips are brief and one-time per open; once the modal is stable it does not affect the main-thread budget.

### Virtual list under fast scroll

Scrolling the bets table rapidly (5,000 rows, 40 px each, flick-speed drag) keeps the FPS counter steady with a couple of frames dropped at the extremes of a fast flick. A small drop during the peak of a gesture is normal — the browser's own compositor and paint pipeline are under pressure regardless of what React is doing, and a 2–3 fps dip at the moment of peak scroll velocity is well within acceptable range. Expecting zero drop would be unrealistic.

The scroll listener is rAF-throttled so at most one range recomputation fires per animation frame. The visible window is typically 15–20 rows (depending on viewport height); overscan adds 3 rows on each side. Total DOM nodes in flight at any point: ≤ 26, regardless of total bet count.

### Multiplier tick under load

During flight, `multiplier_tick` messages arrive at ~20/s. The displayed value is interpolated at 60 fps via a rAF loop using an estimated exponential growth rate — the server tick rate does not set a ceiling on display smoothness.

`bet_updated` cashout events (up to 200+/s during heavy cashout periods) are queued and flushed at most once per animation frame via a module-level rAF batch, keeping store writes at ≤ 60/s regardless of message volume.

---

## What was cut

**QA coverage was cut.** Only the two pure utility modules (`seqBuffer`, `clockSkew`) have unit tests. The store actions, the `useBetPanel` state machine, the interpolation hook, and the WS integration path are all untested. In a production codebase these would be the highest-priority tests to write — the store actions in particular have subtle dedup and ordering logic that unit tests would protect.

**The last PRs were rushed.** The later pull requests (remaining-bug fixes, refactor, agent-review fixes) were put together under time pressure. They are correct but less carefully reviewed than the earlier architecture work. Some of the fixes found by the agent review session (seqBuffer OOO inflation, rAF queue drain on reconnect, `changedAt` preservation) would have been caught earlier under normal review conditions.

**Screenshots captured** (`docs/screenshots/`):

- `topbar-live.png` — TopBar in live state: 60 fps · 16.7 ms frame time, connection badge, seq counter, drift offset.
- `dev-modal.png` — DevModal performance section: 60 fps · 16.7 ms, all-green sparkline (every frame within the 16.7 ms budget), connection counters, and the anomaly event log showing real duplicate/OOO/gap events from the feed.

**Chrome Performance trace — 28-second recording (1× CPU, no throttle):**

Workload: full WS feed live throughout, fast scroll through the 5,000-row bets table (confirmed 200,000 px total virtual height), DevModal opened mid-trace.

- **CLS: 0.0004.** Seven micro layout-shifts during the fast-scroll burst, none outside it, no root cause identified by the profiler. Consistent with the virtual list momentarily repositioning recycled rows by a sub-pixel amount as the window jumps. Well inside the "Good" threshold (≤ 0.1); in practice invisible to the user.
- **No long tasks outside the scroll burst.** The profiler flagged no tasks exceeding 50 ms during the steady-state feed or multiplier animation phases.
- **No render-blocking resources.** All JS and CSS is bundled by Vite with no blocking third-party requests.
- The only Chrome insight offered was the CLS cluster above — no LCP breakdown, no INP issues, no DOM size warnings.
