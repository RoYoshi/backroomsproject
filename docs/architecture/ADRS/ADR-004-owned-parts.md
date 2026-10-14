# ADR-004: Scripts with many owners are built from owned parts with checked interface headers

- **Status:** accepted for Stage 3H (H3M-3 to H3M-5, checkpoint M3). The parts are not modules: architecture debt, recorded (M-024).
- **Evidence:** `dev/stage-3h-modernization/evidence/m3/`; `dev/tools/checks/parts.js`; `FINDINGS.md` M-024 and M-025.

## Context

- **Some scripts have many owners.** Several scripts are one closure written by many owners. `mp.js` holds B++'s transport, G.I.B.'s
  deaths and bodies, N.A.N.I.'s monsters, Spacious Audio's dread, OVERSEER's panel and more. The server's `sim.js` glue holds the
  level's events, the bodies, the players, the movement rules, the AI's feed and the admin's state. `world.js`, `move.js`,
  `camcorder.js` and `glitch.js` are shared the same way.
- **The bytes must not change.** The browser and the server must load exactly what they load today.
  - A module system (ES modules, a bundler) would change the output bytes.
  - So would the names' scope: these scripts share one closure and register their hooks on `window`.
  - So would the order things run in, because classic scripts run in `index.html`'s order and their function declarations are hoisted.
- **Owners need to see what they own** and what each piece relies on from the others.

## Decision

1. **A script with several owners is built from parts.**
   - Each part is a run of the script's own lines, cut by line ranges, in order and without a gap. The parts' bytes are the old file's
     bytes.
   - Each part lives in its owner's folder: `src/frameworks/<owner>/{client,server,shared}/` or `src/core/`.
   - `src/build-recipes.json` lists the parts in order, and the build joins them.
2. **Every part begins with a header that the build removes:**

   ```text
   /** @part public/mp.js - B++: the WebSocket: sending (tx), connecting, and every message the server sends
    * provides: tx                                  (what this part declares that the other parts use)
    * uses: EN, N, PEER_MODE, PEER_SNAP, ...        (the other parts' names this part reads: 59 here)
    * writes: blend, bodiesList, cpNow, ...         (the other parts' bindings this part assigns: 20 here)
    */
   ```

   Notes may follow the title line. The header above is `src/frameworks/bpp/client/mp.transport.js`'s, with its lists cut short.
3. **A checker proves the headers.** `dev/tools/checks/parts.js`, the gate's `parts` step:
   - assembles each output as the build does;
   - finds the shared closure with TypeScript's parser: the function with the largest body (an IIFE, `ai.js`'s UMD factory,
     `createSim`);
   - gives each statement to the part it lies in (a statement may not straddle two parts);
   - resolves every name with TypeScript's checker, so a local that shadows a closure name is not counted;
   - fails when a list is missing a name or names one too many.

   `--suggest` prints the lists for a new part, and `--fix` rewrites them.
4. **Ownership follows contiguous lines.** Lines are never reordered, because reordering would change bytes. A few interleaved lines
   stay in a neighbour's part, named in its notes.
5. **A script with one owner stays whole** (M-025): `dphys.js`, `gore.js`, `inventory.js`, `ui.js`, `hud.js`. `sim.level0.js` stays
   one part, because it is the bundle's own minified level code.

## Consequences

- **The split changed no output.** 9 outputs are built from 64 parts (58 files; `world.js`'s six are built for the page and the
  server). Every built output is byte-identical, and the gate's goldens are unchanged.
- **The coupling is visible and checked.** The checker refuses 6 of 6 tamperings (`m3_parts_mutants.js`). The headers show where the
  coupling is heavy. For example, `mp.js`'s transport uses 59 names of other parts and writes 20, and `sim.js`'s admin part writes 7 of
  the world's state.
- **A part is not a module.** Parts still share their closure. A part becomes a module when it writes no other part's binding and its
  uses can be passed in, as the server modules of H3M-2 were (ADR-003). Until then it is reported as a part, not as "modular".
- **Changing a part means a rebuild.** Edit the part, run `npm run build`, and commit the source and the output together.
  `npm run build:check` and the `parts` step catch a forgotten rebuild or a stale header.

## Alternatives rejected

- **ES modules or a bundler now.** The outputs would change, and so would the global names the page's 23 classic scripts and the
  compiled bundle exchange. Parity could then be shown only by behaviour, and only after the whole port.
- **Separate scripts per owner.** That changes `index.html`, the load order and the globals, which is a player-facing risk for no
  behaviour gain.
- **Leave the scripts whole, with ownership in a document.** A document cannot fail a build. The headers and their checker do.
- **Reorder lines to group each owner's code.** The bytes, and possibly the hoisting and evaluation order, would change.
