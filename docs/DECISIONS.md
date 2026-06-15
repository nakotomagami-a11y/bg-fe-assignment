# DECISIONS.md

Key decisions made during implementation, with the alternatives I considered and why I went the way I did. Cut scope and what comes next are at the bottom.

--- 

## Monorepo structure — pnpm workspaces

In a real product, a backend and a frontend living in the same repository belong in a monorepo: coordinated installs, shared tooling config, and the ability to share types as a proper internal package without copying files. This assignment replicates that setup — the `server` package is the backend, `client` is the frontend.

The server here is provided by BetGames and is not authored by me, so in strict terms it's a black box. I still wrapped it in the monorepo because the point of a take-home is to demonstrate how I'd structure a real project, and in a real project this is the right call. The caveat is documented here so the intent is clear.

`pnpm i && pnpm dev` at the repo root installs all workspaces and starts the client. The server is started separately with `pnpm --filter server start` or `cd server && pnpm start`, matching the instructions in the README.

---

## Bets stored as Map, not array

During flight, `bet_updated` messages come in at 200+ per second and each one needs to update a single bet out of 5,000. With an array you'd scan through every element until you find the right id — that's potentially 5,000 comparisons per message, 200 times a second. A Map gives you the same lookup in one step regardless of size.

The only downside is that rebuilding the Map on round transitions is slower than swapping an array reference, but round transitions happen once every ~30 seconds so it doesn't matter.

## round_crash — "lost" is computed at render time, not stored

When a round crashes the server sends exactly one message: `round_crash`. It doesn't follow up with individual lost updates for every active bet — there could be thousands of them.

The naive approach is to iterate all 5,000 bets on crash and flip each one to `'lost'`. That works but it's O(n) work and 5,000 object allocations right at the most visually sensitive moment.

Instead, `round_crash` just updates `round.phase` to `'crashed'` — one store write. A bet shows as lost when `round.phase === 'crashed' && bet.status === 'active'`. That's always consistent by definition and costs nothing at crash time. `ClientBetStatus` doesn't even need a `'lost'` value since it's never stored.

## String literal unions, not enums

The server sends plain strings for all statuses and phases — `'active'`, `'cashed_out'`, `'betting'`, and so on. TypeScript enums would mean either writing `bet.status === BetStatus.Active` everywhere or adding a mapping layer when messages come in from the server. Neither adds anything useful.

String literal unions work directly with what the server sends, have no runtime overhead, and plug straight into ts-pattern's exhaustive matching. No `enum` anywhere in the codebase.

## Clock skew — anchor to the last message, don't estimate an offset

The betting phase has a deadline (`endsAt`) in server time. The obvious fix is to estimate the absolute offset between the server clock and the local clock, then apply it. That's what EWMA-based approaches do. But you don't need that level of complexity for a countdown.

Instead, save `serverTime` and `Date.now()` from the most recent message. To compute time left:

```
timeLeft = endsAt - (lastServerTime + (Date.now() - lastLocalTime))
```

This reads as: "what does the server clock probably say right now?" — the server time from the last message, plus however much local time has ticked since I received it. The only error is the network latency of that one message, which is well under 100ms and irrelevant for a one-second countdown tick. On reconnect the snapshot gives a fresh `endsAt`, so there's nothing to carry over.

## State management — Zustand over Context or Redux

React Context re-renders every subscriber whenever any value in the context changes. At 200+ bet updates per second that means 200 renders per second across every component reading that context, regardless of whether the data they care about actually changed. Zustand lets each component subscribe to a selector and only re-renders if that selector's return value changed. A row in the bets table subscribes to its own bet by id — it never re-renders when other bets change.

Redux would also avoid the Context problem, but the boilerplate (action types, reducers, connect, dispatch wiring) isn't worth it for a single-page app with one clearly owned state shape. Zustand gives the same fine-grained subscription model with far less ceremony.

## Type reuse from the server

`server/src/protocol/protocol.ts` is the wire protocol source of truth. Rather than copying types into the client, I set up a `@server/*` path alias in `tsconfig.json` and have `src/shared/types/server.ts` re-export from it verbatim. `src/shared/types/client.ts` extends only where the server type isn't enough — adding `'pending'` to bet status, defining `PlayerBet`, `AnomalyEntry`, and `ConnectionPhase`. No risk of the client and server types drifting out of sync.