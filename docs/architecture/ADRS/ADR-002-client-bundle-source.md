# ADR-002: The compiled client bundle comes from the recovered TypeScript build plus a verified patch ledger

- **Status:** accepted for Stage 3H.
  - The lineage was recorded at checkpoint M1-R.
  - Decisions 1 to 3 were carried out at checkpoint M6a (H3M-6): `original-v11/` and its provenance, the replay recipes, the
    `lineage` step of the gate, and `lineage.js record`. The served files did not change.
  - The fresh `npm ci && npm run build` of decision 1 (P0) is DONE at continuation C1: the owner supplied the 31 locked packages,
    each was verified against the lockfile, and the offline build gave the v11 `dist/` byte for byte (M-017, `evidence/c1/`).
  - The TypeScript port is DONE: P1 to P3 at continuation C4a (the maintained tree `src/core/client/game/`, all forty steps ported and
    proven against the shipped bundle; `dev/stage-3h-modernization/evidence/c4a/`), P4 (the swap) at C4b: the served bundle and
    stylesheet are built from it, and the lineage's two chains are kept as their history. Human QA is pending. "How it was done", below.
- **Supersedes:** `PLAN.md` §6 as written at H3M-0 ("the compiled bundle has no source … a compatibility island").
- **Evidence:**
  - `dev/stage-3h-modernization/SOURCE_RECOVERY_INTAKE.md`;
  - `src/core/client/bundle/` (`lineage/`, `API_CONTRACT.md`);
  - `FINDINGS.md` M-001 and M-011 to M-020.

## Context

- **Source and history are now in hand.**
  - The owner recovered the original Vite + TypeScript project: 11 commits, `client/` and `shared/`, the lockfile and the build output.
  - Version 11 builds the historical 304,183-byte `index-DKbV5Nv9.js` exactly.
  - The shipped 340,823-byte file of the same name is that build plus **40 in-place edits**: 2 made in packages before this repository,
    38 in its commits.
  - The stylesheet `index-D7hdwmUU.css` had 8 such edits, and `index.html` 35.
- **The edits are replayed exactly.** The ledger replays every edit byte for byte from the v11 output to the shipped file, checking
  SHA-256 at every step.
- **The edits are fine-grained.**
  - The shipped bundle is 1,456 pieces: 546 runs of v11 bytes and 910 runs of later text.
  - 726 of the later runs are under 50 bytes.
  - Most are seams: calls out to the classic scripts' `window` globals (`__mp`, `__net`, `__gore`, `__ents`, `__cam`, `__brRole`, …).
  - Some are real logic written straight into minified code:
    - B02: the 96×72 Level 0 and stamina;
    - B07: capture sounds;
    - B10 and B11: light gear;
    - B12: NEW RUN's fall;
    - B28 and B30: BR-RoLE's corner receivers, about 9.6 KB.
- **`window.__api` has 52 members.** Some are minified names. Each is mapped to the TypeScript declaration it compiled from, and its
  16 loaded readers are known (`API_CONTRACT.md`).
- **Exact parity is required.** The owner requires the player-facing experience to be preserved exactly. B++ and the frozen 3H2 are the
  oracle; the v11 build is not.
- **A minifier makes byte parity impossible after any source change.** The same TypeScript compiled again gives the same bytes. But
  once the source changes, minified names and layout move, and a patch made on the old bytes no longer applies.
- **This session cannot reach the npm registry.** The v11 toolchain is installed offline from packages the owner supplies, each checked
  against the lockfile first (continuation C1).

## Decision

1. **The v11 project becomes an isolated input of this repository** (`src/core/client/bundle/original-v11/`, H3M-6).
   - It is copied byte for byte from the recovered snapshot. The one exception is `.openai/hosting.json`, which holds the old hosting
     account's project id and nothing the build reads (M-018). Its blob id is recorded so that the snapshot's tree id stays provable.
   - It keeps its own `package.json`, with `"type": "module"`, and its own lockfile. It is never merged into the root `package.json`
     (the server is CommonJS).
   - It builds by itself (`npm ci && npm run build` in a copy). It is never served.
2. **The shipped bundle and stylesheet become build outputs:**
   - **Inputs:** the v11 output bytes, then the ledger's steps in order.
   - **Outputs:** `public/assets/index-DKbV5Nv9.js` and `index-D7hdwmUU.css`, byte-identical to today's.
   - **Enforcement:** `npm run build:check` and `dev/tools/lineage/lineage.js verify`.
   - Every byte the game ships in these two files is then either compiled from the recovered TypeScript or written by a named, dated,
     owned step. No byte is unaccounted for.
3. **Until its concern is ported to TypeScript, a change to either file is a new ledger step.** It is recorded by the lineage tool; it
   is never a silent hand edit.
4. **`index.html` stays the page's hand-edited source.** Its lineage, from the v11 output to the frozen parent, is recorded and
   verified, not enforced.
5. **The TypeScript port is a separate, gated program.** It is not started in Stage 3H, and its success is the condition for calling
   the client "compiled from readable source". Steps:
   - **P0 Toolchain.** Make the locked v11 toolchain installable offline (a verified package cache), and reproduce the v11 output byte
     for byte in CI.
   - **P1 Modern tree.** Start the modern TypeScript tree from the v11 project. Decide, with a security review, whether the output keeps
     the URL `/assets/index-DKbV5Nv9.js` through a fixed output name, or takes a new name with the `SERVE` allowlist and `index.html`
     updated together.
   - **P2 Port, one concern at a time,** in ledger order (`lineage/STEPS.md` names each concern and its owner).
     - Each port is one commit naming the step ids it covers, with a focused equivalence test against the shipped bundle. For example:
       the capture sound's Web Audio call trace (B07); the corner-receiver geometry on fixtures (B28 to B30); the order of the window
       hooks.
     - `window.__api` becomes an explicit module that exports all 52 members under their contract names, minified ones included.
   - **P3 Staging candidate.** Build a candidate at a staging path, never over the shipped file, and prove it against the shipped
     bundle:
     - the client goldens (fake clock, seeded randomness, every draw, send and audio call), with the same `Math.random` call order;
     - the contact lab's pixel-identical scenes;
     - `live_wire`;
     - the browser checks;
     - `perf` within noise;
     - the `__api` contract.
   - **P4 Swap.** Replace the shipped file only in an isolated checkpoint, after all of P3 passes, then Human QA.
   - **No mechanic changes on the way.** Nothing is rebalanced, optimised or "fixed", and no evaluation order changes where it is
     observable.

## How it was done (continuation C4)

- **P0** was continuation C1: the owner's 31 locked packages, each checked against the lockfile, installed offline; v11's `dist/`
  rebuilt byte for byte.
- **P1.** `src/core/client/game/` started as a copy of `original-v11/` (the same lockfile and dependencies: `client.js` refuses any
  other). The decision on the URL: the build keeps the shipped names (`vite.config.ts` fixes `assets/index-DKbV5Nv9.js`,
  `assets/index-D7hdwmUU.css` and the two PixiJS chunks that import the entry), so neither the `SERVE` allowlist nor `index.html`
  changes and no new path is served. `dev/tools/build/client.js` builds it into a scratch folder (`--stage`) or into `public/assets/`
  with its record (`--write`); `build.js` checks the record, so the build stays dependency-free.
- **P2.** The forty steps were ported in one wave (C4a), not one commit per concern, because the focused test is stronger than the
  plan's: every top-level statement of the shipped app code is compared with the port, modulo the names of bindings and a stated
  normal form (`tools/c4_alpha_all.mjs`; 195 of 197 statements compared, the other 2 reviewed), so each concern's code, not one trace
  of it, is shown to be the shipped one. The deliberate changes of structure (none of behaviour) are declared with their reasons in
  `c4_alpha_modules.json`: NEW RUN's fall and vanish state is `client/arrival.ts`'s object; the renderer is passed whether the light
  was on when a death completes; the page's one ambience is made in `client/audio.ts`. The checks' own mutants sit in the concerns
  this ADR named (B02, B07, B10 and B11, B12, B28 to B30: `c4_port_mutants.mjs`). `window.__api` is an explicit object literal in
  `client/main.ts` with all 52 contract names, the minified ones included, each mapped to a readable declaration, made at the same
  moment as before; the contract tool checks that the served bundle publishes the same members in the same order.
- **P3.** The staging build was proven against the shipped bundle before anything was served: the alpha check, the stylesheet
  (`c4_css_check.mjs`), and `dev/tools/gate/golden/bundle_diff.js` (both in Chromium, frame by frame, with seeded randomness and a
  virtual clock: the randomness, the state, the document, every 2D canvas and audio call, the window hooks, the pixels and computed
  styles; nine scenes), each with its mutants. The gate's `port` and `bundle` steps run these from then on.
- **P4.** The swap is its own checkpoint (C4b): `client.js --write`, the recipes and the ledger updated, the full gate (live wire,
  the browser checks, the contact lab, the suites, perf, the developer round trip now including a TypeScript edit of the client).
- **Kept exactly, on purpose:** a B02 test that never fires (FINDINGS M-029) and two no-op clauses (M-032); the build's CSS minifier is
  not applied to the later rules (M-031).

## Consequences

- **The bundle stops being an opaque blob.**
  - Its 296,552 v11 bytes are source-proven (PixiJS from the lockfile, the game from the TypeScript).
  - Its 44,271 later bytes are each traceable to a step, a date, a source and an owning framework.
- **Since C4b the post-v11 code is readable, owned TypeScript** built with v11's toolchain; the minified edits are history (the
  lineage still replays them to the file they produced, and the port is proven against that file). Until C4a this was a
  COMPATIBILITY ISLAND WITH COMPLETE LINEAGE.
- **The duplicated Level 0 map remained after the swap** (the server's `sim.level0.js` and the client's `shared/world.ts`; M-003).
  Unifying it is B02's concern, done after the port so that the client side is readable source, with both sides proven.
- **The recovered original carpet texture is not swapped in.** The shipped `carpet.png` is the placeholder the HAR recovery generated
  (M-013), and changing it would change what players see. That is the owner's decision.

## Alternatives rejected

- **Keep fixed bytes without lineage.** The recovered source and history make the lineage possible, so an unexplained blob is no longer
  acceptable.
- **Rebuild from TypeScript now, with the 40 edits ported by hand in this stage.**
  - The toolchain cannot be installed here.
  - Any source change re-minifies the file, so parity could only be shown by behaviour.
  - The P3 proof needs the whole port done first, and an approximation would break the owner's rule.
- **Beautify, decompile or wrap the minified file.** That is forbidden, and it is unnecessary now that the real source exists.
- **Overwrite the shipped file with the historical v11 output.** Forbidden: it would remove 40 accepted changes.
