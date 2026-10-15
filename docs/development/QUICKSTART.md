# Quickstart

## What you need

| To | You need |
|---|---|
| Run the game | Node.js 18 or later. No `npm install`: the game has no dependencies |
| Build, check the build, run the scenario suite | the same |
| Run the gate (`npm run gate`) | Git with this repository's full history (the gate reads the accepted build, `143b63f`, from it: a shallow clone will not do); TypeScript installed globally (`npm i -g typescript`, or `TYPESCRIPT=<its folder>`) for the parts, modules and `__api` contract checks; Playwright for Node installed globally, with Chromium (`npm i -g playwright`, then `npx playwright install chromium`), for the client goldens, the page scripts' comparison and `dev/tools/checks/dev_workflow.js` |
| Run the full gate (`npm run gate:full`) | also Python 3 with Playwright for Python, Pillow and NumPy (`pip install playwright pillow numpy`) for the browser checks and the contact lab |

Everything here was run on Linux with Node 22 (the gate's evidence says which machine). On Windows, use `node <script>` rather
than the `.sh` files; `run_windows.bat` starts the game.

## Run the game

```text
node server.js                 The Far Backrooms → http://localhost:8000  (share  ?room=NAME  to group up)
```

Open http://localhost:8000. A second browser on the same address and `?room=` joins the same world. The admin panel opens with the
backquote key; give the server a passcode with `ADMIN_PASSCODE=... node server.js`.

## Change something

1. **Find the owner.** [`docs/architecture/FRAMEWORKS.md`](../architecture/FRAMEWORKS.md) lists every framework and its folder; each
   `src/frameworks/<name>/README.md` lists its files.
2. **Edit the source in `src/`.** Never edit `public/*.js`, `public/assets/*.js` (except the static ones) or `generated/`: the build
   writes them. A file that begins with `/** @part` is one part of a bigger script: its header says which, and what it shares with the
   others. In `world.js`, `move.js`, `camcorder.js`, `glitch.js`, `ents.js` (continuation C3b) and `mp.js` (C3c) each part is a
   module: one factory, whose parameter names what it takes from which earlier module and whose return is what it gives; the script's
   `*.compose.js` part makes them (`docs/architecture/CONTRACTS.md` section 4; `mp.js`'s session also takes functions of the modules
   made after it, through its `wire`). The server's modules (`src/**/server/*.js`, the sim's included since continuation C3a) are
   loaded as they are: a module is a factory, and its parameters say what it uses from which owner (section 3).
3. **Build.** `npm run build` rewrites what changed (a change to a server module needs no build):

   ```text
   built 39 outputs (2 files written, 38 already up to date)
   ```

4. **Check.** `npm run build:check` must say `BUILD CHECK: PASS`. If you edited a part,
   `node dev/tools/checks/parts.js` checks its header; `node dev/tools/checks/parts.js --fix <output>` rewrites the header's lists from
   the code (then read the diff). If you edited a server module or a page module, `node dev/tools/checks/modules.js` checks its
   boundaries (every name given to it or its own, nothing it was given assigned, every import used; for the sim and the page's module
   scripts, no state outside the factories, the wiring in order; for the page, no write into another owner's state (a mutating call
   such as `set` or `push` is a write), no global back-channel, a late name given once, by the composition, and the header's
   `imports`, `exports` and `late` the code's). The compiled client bundle and its stylesheet are not edited this way: see
   [`src/core/client/bundle/README.md`](../../src/core/client/bundle/README.md).
5. **Test.** `npm test` runs the scenario suite on the real simulation (about 5 minutes). 13 of its 162 cases fail on the accepted
   build too; `dev/stage-3h/gate/known_failures_bpp.json` lists every known failure. `npm run gate` compares the whole game with the
   accepted build (about 6 minutes on 2 CPUs; it prints one line per step and `MODERNIZATION GATE (fast): PASS`).
6. **Commit the built files with the sources.** The production host runs `node server.js` from a fresh pull, with no build step.

## Tests, from quick to thorough

| Command | What it checks | Time |
|---|---|---|
| `npm run build:check` | every built file is what `src/` builds | seconds |
| `node dev/tools/checks/parts.js` | every part's header agrees with its code | seconds |
| `node dev/tools/checks/modules.js` | the module boundaries of every server file, the sim's wiring and the page's module scripts | seconds |
| `node dev/tools/gate/golden/sim_diff.js` | the sim against B++'s `sim.js`: the same calls give the same results | ~30 s |
| `node dev/tools/gate/golden/world_diff.js` | `world.js` against B++'s: every function, the same answers | seconds |
| `node dev/tools/gate/golden/page_scripts.js` | `move.js`, `camcorder.js`, `glitch.js`, `ents.js` against B++'s, in the same closed Chromium page: equal traces | ~20 s |
| `node dev/tools/gate/golden/cli_golden_c3c.js` | `mp.js` against B++'s: all 18 client scenes in one Chromium page, equal traces, every function of `mp.js` run | ~10 s |
| `node dev/tools/lineage/lineage.js verify` | the compiled bundle's lineage replays byte for byte | seconds |
| `node dev/tools/checks/dev_workflow.js` | this round trip, on a scratch copy: edit a page module, build, see it served and shown in a real page; edit a server module, restart, see it; undo both; rebuild byte for byte; clean rebuild | ~30 s |
| `npm test` (`node dev/tests/run.js [file]`) | the scenario suite on the real simulation; one file: `npm run test:hound` and the others in `package.json` | minutes |
| `npm run gate` | the fast tier of the gate: build, lineage, parts, modules, docs, scope, the server, session and client goldens against the accepted build, the sim and the page's module scripts against B++'s, the protocol, the mutants, the HTTP surface, the quick suites | ~6 min |
| `npm run gate:full` | everything, with two real browsers, the developer round trip and the browser contracts, the contact lab's pixels, all suites and performance | ~50 min |

The gate writes everything under `--out <folder>` (default: a temporary folder) and says where. `dev/tools/gate/README.md` explains each
step and what it cannot see.

## When something goes wrong

- **`EADDRINUSE`**: another server has the port. `node server.js 9000`.
- **`BUILD CHECK: FAIL ... differs from what its sources build`**: a built file was edited by hand, or `npm run build` was not run
  after a source change. Run `npm run build`, and edit the source next time.
- **`BUILD ERROR: ... step B.. did not give the recorded bytes`**: the compiled bundle's lineage does not replay; see
  `src/core/client/bundle/README.md`.
- **`PARTS CHECK: FAIL`**: a part's header lists names its code does not have, or misses some. `--fix <output>` rewrites the lists.
  "a statement ... straddles two parts" means a split cuts a statement in two: move the boundary.
- **The gate's `perf` step fails once**: on a small machine its seven rounds can miss by chance (FINDINGS M-021). Measure before anything
  else: for a server scenario, `node dev/stage-3h-modernization/tools/m1_perf_paired.js --work <empty folder> --scenario <the failing
  one>`; for a page scene, more rounds of the same comparison (`node dev/tools/gate/golden/perf_det.js --only client --rounds 21`). Then
  run the step again (`node dev/tools/gate/gate.js --only perf`).
- **`place_replay` fails one case**: a glitched wall can land on its walk by chance, in about 7 % of runs (3H finding F-036). If the
  failing case sent no stale pose, got no correction and its track stops early, that is it: run the step again
  (`dev/stage-3h/gate/README.md`).
- **A suite shows failures**: compare with `dev/stage-3h/gate/known_failures_bpp.json`; the gate does that for you.
