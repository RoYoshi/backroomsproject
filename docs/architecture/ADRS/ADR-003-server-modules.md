# ADR-003: Server modules are factories given what they use; the session and its security code stay in `server.js`

- **Status:** accepted for Stage 3H (H3M-2, checkpoint M2). The WebSocket session's move is held for the owner (M-023): PARTIAL.
- **Evidence:** `dev/stage-3h-modernization/evidence/m2/` (the move proof, the free names, the full gate); `FINDINGS.md` M-023.

## Context

- **One file held the whole server.** Before H3M-2, `server.js` was 385 lines. It held the configuration, the static files' wiring,
  the WebSocket session, the movement authority, the rooms and the world reset, the admin panel's commands, the fresher poses and the
  loop. Seven server modules existed already:
  - `death_srv.js` (v22.2) and `peers.js` (Stage 3D HQ2), written as modules;
  - `static.js`, `ws.js` and `fields.js`, moved out of `server.js` by Stage 3H0;
  - `newrun.js` and `aftermath.js`, moved out by Stage 3H2.
- **The server's behaviour is pinned byte for byte.** The goldens run B++'s `server.js` and this one in a closed world: a fake clock,
  fake sockets, seeded randomness. The harness records every timer and every byte sent, and the server's requires of Node's modules,
  of the world (`sim.js`) and of the death module. A module that started a timer or sent anything when loaded, or changed the order
  of those requires, would show up in the traces.
- **The owner's security rule.** Modularization must not change the admin passcode's default, the authentication, the lockout per
  address, permissions, CORS or Origin handling, or credential handling, unless the owner approves it separately.
- **`server.js` is not strict code.** A module that added `'use strict'` would run the same lines under other rules.

## Decision

1. **Each server module is a factory.**
   - It exports one function, `module.exports = ({ what, it, uses }) => { ...; return { what, it, offers }; }`.
   - `server.js` calls it with what it uses and keeps what it returns.
   - A module never requires `server.js` or another module, and does nothing when it is loaded.
   - The H3M-2 modules are `movement.js` (S.P.A.C.E.), `rooms.js` and `loop.js` (core), `admin.js` (OVERSEER) and `poses.js` (B++).
2. **Code moves without a change.**
   - Every moved line is the old line, comments and indentation included, so each can be compared with `server.js` as it was.
   - The few lines that had to change are listed in place by the move proof (`dev/stage-3h/tools/h2_move_proof.js`): 260 lines moved
     verbatim, 6 changed in place, 22 inserted.
   - No module adds `'use strict'`.
3. **A free-name check.** `dev/stage-3h-modernization/tools/m2_free_names.js` proves that every name a module uses is one of three
   things: declared in the module, a factory parameter, or the host's or the language's global. A module cannot quietly reach into
   another's state.
4. **`server.js` is the composition root.** It keeps:
   - the configuration;
   - the requires the server always made, in their order;
   - the wiring;
   - **the admin passcode, its check and its lockout;**
   - **the WebSocket session:** the upgrade, each client's messages, its leaving.

   The session stays because it holds the passcode check. Security code moves only with the owner's approval (M-023).

## Consequences

- **`server.js` went from 385 lines to 141.** Each of the server's other jobs lives in its owner's folder. Its factory's parameters
  say what it depends on, and its return value says what it offers.
- **The server answers the same.**
  - The 18 server scenarios' traces equal B++'s stored baselines. The one allowed exception is in `http_base`: its 10 lines about
    `index.html` and `mp.js`, the two served files Stage 3H2 changed on purpose. Those bodies are checked against the files instead.
  - The 18 server mutants each change a golden. Each is applied where its code now lives: a module, the built `sim.js`, or
    `server.js`.
  - The full gate passed at M2, 18 of 18 steps.
- **`server.js` is not yet a bare bootstrap.** The session (about 75 lines, with the passcode check) is still there. That is recorded
  as PARTIAL until the owner decides. If the owner approves, the session can move the same way: the check kept as it is, the lines
  verbatim, the same proof.
- **The passcode line is guarded.** The gate's `scope` step compares it by hash, so any change to it fails the gate.

## Alternatives rejected

- **Classes or ES modules for the server.** They change the module format (the server is CommonJS: `package.json` has no
  `"type": "module"`), the load order and the strictness, for no gain the goldens could prove.
- **Modules that require each other or `server.js`.** That creates load-order coupling and cycles. The factory's parameters make every
  dependency visible and keep the requires in `server.js`, in their old order.
- **Moving the session and the passcode check now.** The owner's rule forbids it without approval. The proof would be the same, but
  the decision is not ours.
- **A dependency injection library.** The server has no dependencies, and plain function parameters are enough.
