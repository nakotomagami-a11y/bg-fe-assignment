# DECISIONS.md

Key decisions made during implementation, with the alternatives I considered and why I went the way I did. Cut scope and what comes next are at the bottom.

--- 

## Monorepo structure — pnpm workspaces

In a real product, a backend and a frontend living in the same repository belong in a monorepo: coordinated installs, shared tooling config, and the ability to share types as a proper internal package without copying files. This assignment replicates that setup — the `server` package is the backend, `client` is the frontend.

The server here is provided by BetGames and is not authored by me, so in strict terms it's a black box. I still wrapped it in the monorepo because the point of a take-home is to demonstrate how I'd structure a real project, and in a real project this is the right call. The caveat is documented here so the intent is clear.

`pnpm i && pnpm dev` at the repo root installs all workspaces and starts the client. The server is started separately with `pnpm --filter server start` or `cd server && pnpm start`, matching the instructions in the README.

---

## State management — Zustand over Context or Redux

React Context re-renders every subscriber whenever any value in the context changes. At 200+ bet updates per second that means 200 renders per second across every component reading that context, regardless of whether the data they care about actually changed. Zustand lets each component subscribe to a selector and only re-renders if that selector's return value changed. A row in the bets table subscribes to its own bet by id — it never re-renders when other bets change.

Redux would also avoid the Context problem, but the boilerplate (action types, reducers, connect, dispatch wiring) isn't worth it for a single-page app with one clearly owned state shape. Zustand gives the same fine-grained subscription model with far less ceremony.

## Type reuse from the server

`server/src/protocol/protocol.ts` is the wire protocol source of truth. Rather than copying types into the client, I set up a `@server/*` path alias in `tsconfig.json` and have `src/shared/types/server.ts` re-export from it verbatim. `src/shared/types/client.ts` extends only where the server type isn't enough — adding `lost` and `pending` to bet status, adding the `changedAt` map, defining `PlayerBet` and `AnomalyEntry`. No risk of the client and server types drifting out of sync.