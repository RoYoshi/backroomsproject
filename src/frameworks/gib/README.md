# G.I.B.: deaths, gibs and corpses

`src/frameworks/gib/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

Every death, from the server's event to the body that stays:
- **Server:** the aftermath (`server/aftermath.js`: one event per death, decided and finished by the server; NEW RUN's blast), the server's own replay of a death (`server/death_srv.js`), one body per player and how long it stays (`server/sim.bodies.js`).
- **Both:** the death physics (`shared/dphys.js`, the same file on both sides).
- **Page:** our own death from the server's record (`client/mp.owndeath.js`), everyone's bodies (`client/mp.bodies.js`), others' deaths replayed (`client/mp.replays.js`), how a death plays out (`client/ents.death.js`), blood and remains (`client/gore.js`).

## What it must not own

No corpse created by a client, and no damage from an admin's NEW RUN unless approved.

## Its rule

One server event per death, and one persistent, replicated aftermath. Eight entity deaths (four variants for each killer).

## Its files

<!-- generated: sources:gib (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/ents.death.js`](client/ents.death.js) | G.I.B.: how a death plays out on screen, four variants per killer | `public/ents.js` (a part) |
| [`client/gore.js`](client/gore.js) | Realistic wound / blood rendering for the death animation, corpses and dead peers. | `public/gore.js` |
| [`client/mp.bodies.js`](client/mp.bodies.js) | G.I.B.: everyone's bodies, one per player | `public/mp.js` (a part) |
| [`client/mp.owndeath.js`](client/mp.owndeath.js) | G.I.B.: our own death, from the server's kill record (window.__dvic) | `public/mp.js` (a part) |
| [`client/mp.replays.js`](client/mp.replays.js) | G.I.B.: other players' deaths and vanishings, replayed for everybody in line of sight | `public/mp.js` (a part) |
| [`server/aftermath.js`](server/aftermath.js) | server/aftermath.js - the death aftermath on the server, and the NEW RUN blast's: one event per death or blast, decided and finished here. | a server module: `server.js` requires it |
| [`server/death_srv.js`](server/death_srv.js) | death_srv.js - the server's side of a death's aftermath (never served to browsers). | a server module: `server.js` requires it |
| [`server/sim.bodies.js`](server/sim.bodies.js) | src/frameworks/gib/server/sim.bodies.js - G.I.B.: everyone's bodies, one per player, and how long they stay; and the sim's clock (a | a module of the sim: `src/core/server/sim.js` requires it |
| [`shared/dphys.js`](shared/dphys.js) | dphys.js - lightweight procedural physics for the death animations (v18). | `public/dphys.js`, `generated/server/dphys.js` |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- N.A.N.I.'s kill calls the world's `onDeath`, which opens the aftermath (`aftStart`); the loop sends the replay to every client (`aftSend`) and finishes it (`aftTick`) with a body (`sim.setBody`).
- The page plays the same death from the same record, so the victim, the spectators and the server run one physical death.

## Changing it

Server modules are required directly (`sim.bodies.js` too, a module of the sim since continuation C3a: the bodies and the sim's clock); parts and `dphys.js` need `npm run build`. A body's lifetime: `BODY_TTL` (an environment variable read by `server.js`).

## Tests

- `npm run gate`: the B++ goldens' aftermath scenario, the server goldens' deaths, the aftermath mutants.
- `python3 dev/tests/fallback_parity.py` no longer runs to its end, on the accepted build either (no death is captured).

## Known debt

- `dphys.js` and `gore.js` stay whole (one owner each; M-025).
