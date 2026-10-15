# ADR-005: Code that shared one closure becomes modules: factories given what they use, composed in the order the code ran

- **Status:** accepted for the Stage 3H continuation (C3, M-024). Carried out for the server's sim at C3a. The page's multi-owner
  scripts follow in later waves of C3; until then they are owned parts (ADR-004).
- **Supersedes:** ADR-004 for `sim.js` (it is no longer built from parts).
- **Evidence:** `dev/stage-3h-modernization/evidence/c3a/`; `dev/tools/checks/modules.js`; the gate's `modules` and `sim` steps.

## Context

- **Parts are not modules.** ADR-004 put each owner's lines of a shared script in the owner's folder, with a checked header. The parts
  still shared one closure: at C0, 312 uses and 49 writes crossed owners (`inventory/c0_parts_coupling.csv`). In `sim.js` alone, 134
  uses and 18 writes: the admin tools assigned the run's variables, the world reset assigned the walls, the cartograph and the bodies'
  version, the step assigned the bodies' clock.
- **The owner's continuation pack asks for real modules:** explicit imports and exports, or injected factories; no cross-owner write,
  no hidden closure dependence, no accidental cycle, no global back-channel; narrow contracts, not one big context object; cohesive
  single-owner files left whole.
- **Byte identity cannot survive this.** A module boundary changes the text of the files that are rebuilt. The pack retires byte
  identity for those outputs and asks for behavioural proof in its place.
- **The server already has a module pattern** (ADR-003): a factory given what it uses, returning what it offers, wired by a composition
  root.

## Decision

1. **A module is a factory.** It exports one function, given what it uses as parameters and returning what it gives:

   ```js
   module.exports = function simItems({ ai: { eng, randomSpot }, walls: { glitches } }) {
     let items = [];
     ...
     return { items: () => items, placeItems, takeItem };
   };
   ```

   - The parameter names each giver and what is taken from it (`walls: { glitches }`). Those names are the module's imports.
   - The return object is its exports.
   - A module requires nothing. Only a composition root requires modules.
2. **State has one owner.** A variable lives in the one module that owns it. Another module changes it only by calling a function the
   owner returns: for example the run's `controls`, `placeGlitches`, `clearBodies`. A value that changes after the module is made is
   exported as a function that reads it (`glitches()`, `runT()`), never as a copy that would go stale.
3. **A world's state lives inside the factories.** A module of the sim keeps nothing at its top level. Each room's `createSim` makes
   fresh modules, so no room shares another's state.
4. **The composition runs in the original order.** `src/core/server/sim.js` makes the modules in the order the one function ran: the
   level, then the seed and the AI engine, then the plain declarations, then the first world reset. It returns the same object, key
   for key. The random stream, the requires and every call happen in the same order as before.
5. **Ownership follows meaning, no longer line ranges.** Without byte identity, lines can move to their owner:
   - the run's state (the clock, the pressure, the director's timer, the world count, the admin's freeze, speed and blackout mode) to
     core's run, `sim.step.js`, with the world reset;
   - the cartograph to P.O.C.K.E.T.'s own `sim.items.js`;
   - the admin's nav command and `killerEnd` to N.A.N.I.'s engine wiring;
   - the debug switch to OVERSEER.
6. **The roster is made by the composition.** `players` is the one array the sim's modules share. Only S.P.A.C.E.'s lifecycle adds and
   removes players; the others read it. The players' records are the world's shared data model, as the server and the AI always used
   them.
7. **Every moved line is still the old line,** unless a tool lists the edit. `tools/c3_sim_modules.py` builds every module from M8's
   parts and lists each edit, for example `glitches=makeGlitches(3)` becoming `placeGlitches()`; `--check` rebuilds them and compares.
   The code keeps its strictness: the sim was strict (`'use strict'` at its top), so each of its modules is; the server's own modules
   are not (ADR-003).
8. **Proof by behaviour, and by the code:**
   - `dev/tools/checks/modules.js` (the gate's `modules` step) proves the boundaries from the code with TypeScript's checker:
     - every name a server file uses is its own, given to it, or the host's or the language's;
     - no file reaches the global object;
     - a factory never assigns what it was given, and uses all of it;
     - a module of the sim keeps no state outside its factory;
     - in the sim's composition, each module is made from modules made before it, and imports only names its giver returns.

     `tools/c3_modules_mutants.js` shows it refuses each of those breaks.
   - The gate's `sim` step runs this tree's sim and B++'s `sim.js` side by side on the same calls (5 seeds of 4,000 calls each;
     every result equal). Each seam mutant must be caught by Stage 3H0's server scenarios or by that run.
   - The rest of the gate is unchanged: the server goldens against B++'s stored traces, the session scenarios, the mutants, the
     suites, the browsers, perf.

## Consequences

- **`sim.js` is ten modules and a composition.** There are no part headers and no shared closure. 0 writes cross owners: what was 18
  writes is now calls to the owner's functions. The server loads the modules from `src/` directly, so `generated/server/sim.js` is gone
  and changing the sim needs no build.
- **The old layout still runs.** The layout map names the composition as `sim.js`. `projectOld` writes it with its requires pointed at
  the copied files, so B++'s `server.js` (the gate's old side) runs this sim.
- **Tests that read the sim's code read all of it** (`layout.simFiles()`: s_ir I1, light_test).
- **A read of a changing value is a function call** (`glitches()` instead of `glitches`). That costs a call, and the gate's perf step
  measures it.

## Alternatives rejected

- **One context object passed everywhere.** It would hide who uses what, which is the coupling M-024 is about. The pack rules it out.
- **Mutating shared arrays in place to keep one identity.** That would change what the server sees: a new list at each reset is part of
  the behaviour.
- **Keeping the sim as built parts with stricter headers.** The closure would still be shared. Modules make the boundary a fact of the
  code, checked by a tool, not a list in a comment.
- **Rewriting `sim.level0.js` as readable code now.** It is the bundle's own minified level code, and the page's copy lives in the
  bundle (M-003, blocked by C1). It moved as it was, a module of its own.
