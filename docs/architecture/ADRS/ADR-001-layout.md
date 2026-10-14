# ADR-001: One web root, canonical source by owner, committed build outputs

- **Status:** accepted for Stage 3H (H3M-1). Applied in `a895c07` (preservation checkpoint) and completed in H3M-1.
- **Context:** `dev/stage-3h-modernization/PREFLIGHT.md`, `PLAN.md` §1–§3, `FINDINGS.md` M-004, M-006, M-009, M-010.

## Context

- **Server and client files sat side by side.** Before Stage 3H, the game's server code, client scripts, build outputs and about 130
  reports shared the repository root. `server.js` served that same folder through an allowlist (`SERVE`).
- **Three built files had no proper build.** `ai.js`, `ents.js` and `sim.js` were assembled by shell scripts from parts kept under
  `dev/`. Those scripts did not run on Windows, and the parts lived outside their owners.
- **Production does not build.** The host pulls `main` and runs `node server.js` with no build step (M-009). Whatever runs must be
  committed.

## Decision

1. **`public/` is the web root and the only folder the server serves.**
   - The `SERVE` allowlist is unchanged, so the URL space is unchanged: `/mp.js`, `/assets/ui.js` and `/sounds/x.mp3` are what they were.
   - `server.js`, `src/`, `generated/` and `dev/` cannot be reached over HTTP at all.
2. **`src/` holds the canonical source, by owner.**
   - Framework code lives in `src/frameworks/<name>/{client,server,shared}/`.
   - The page and server composition lives in `src/core/{client,server}/`.
   - `src/build-recipes.json` lists every built output and its parts, in order.
3. **One zero-dependency build** (`dev/tools/build/build.js`; `npm run build`, `npm run build:check`).
   - It writes the outputs to `public/` (served) and `generated/server/` (required by the server, never served).
   - It records every input and output hash in `generated/BUILD_MANIFEST.json`.
   - `build:check` fails when a committed output is not what the sources build.
4. **Outputs are committed,** because production runs without a build.
5. **Two unit kinds, named honestly:**
   - **Modules:** server CommonJS files with explicit `require` / `module.exports`, given their dependencies by a factory.
   - **Parts:** closure fragments that the build concatenates in recipe order. Each part's leading `/** @part … */` header is removed,
     so the output stays byte-identical.

   Parts still share their closure. That coupling is recorded as debt; it is not called a module.

## Consequences

- **The relocation itself changes no behaviour.**
  - Every built output is byte-identical to the file it replaces (`m1_relocate.js --verify`).
  - Four path strings changed: the web root, the generated server files, `death_srv.js`'s path to `dphys.js`, and the server's requires.
- **Tests and tools follow the layout through one map** (`dev/tools/layout.js`), rather than through hard-coded root paths. Their
  assertions are unchanged.
- **A file added to `public/` is still not served unless `SERVE` lists it,** exactly as before.
- **Moving server code under `src/` hides it from HTTP only, not from GitHub:** the repository is public (M-010).
