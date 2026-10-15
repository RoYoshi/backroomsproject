# ADR-005: Code that shared one closure becomes modules: factories given what they use, composed in the order the code ran

- **Status:** accepted for the Stage 3H continuation (C3, M-024). Carried out for the server's sim at C3a, and for the page's
  `world.js`, `move.js`, `camcorder.js`, `glitch.js` and `ents.js` at C3b. `mp.js` follows (C3c); until then its parts share their
  closure (ADR-004). `ai.js` has one owner and stays one cohesive file of parts.
- **Supersedes:** ADR-004 for `sim.js` (no longer built from parts) and for the five page scripts (built from parts that are modules).
- **Evidence:** `dev/stage-3h-modernization/evidence/c3a/`, `evidence/c3b/`; `dev/tools/checks/modules.js`; the gate's `modules`, `sim`
  and `page` steps.

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

9. **On the page, a module is a factory inside its script's wrapper (C3b).** The page loads classic scripts in order. An ES module
   script (`type="module"`) is deferred until the page is parsed, so every script would run at another moment: a timing change a player
   could meet. The browser therefore still loads one classic script per output, and the build still joins its parts. What changed is
   inside: each owner's part is one factory function, given what it uses of the parts before it and returning what later parts use
   of it, and the script's last part, its composition (`*.compose.js`, owned by the script's lead owner), makes them in the order the
   parts ran:

   ```js
   const core = camcorderCore();
   const audio = camcorderAudio({ core });
   camcorderView({ core, audio });
   ```

   The script's public object (`W` for `world.js`, `E` = `window.__ents`, `mv` = `window.__mv`) is made by one module, the head;
   each other module adds its own entries to it, at the same moment as before, and each entry has one module that writes it. What a
   module registers on window it still registers itself. State belongs to its owner, the framework: two modules of one owner may
   share it (BR-R's camcorder core and view share the camera's state `S`), and another owner changes it only through a function the
   owner gives (rule 2).
10. **Hidden couplings across owners become explicit (C3b).** Three of them, each a listed edit in
    `tools/c3_client_modules.js`: the movement code called Spacious Audio's sounds through `window.__mvSfx` (now the sound module hands
    them to the movement module with `useSound`); G.I.B.'s death scene called BR-R's `E.drawSmiler` through the public object (now it
    imports `drawSmiler`); Spacious Audio wrote BR-R's camera state `S.whine` (now it calls `setWhine`, which BR-R's module gives).
    Every other line is M8's: `tools/c3_client_modules.js --check` rebuilds every module from M8's parts and compares, and before
    writing it proved from the code that the change is a re-wrapping (no forward use, no stale copy, no part-level `this`, the same
    globals before and after, nothing resolving to another part's name).
11. **Proof for the page, by the code and by behaviour (C3b):**
    - `dev/tools/checks/modules.js` checks each page script as the build assembles it: nothing in the wrapper but the factories and
      the composition; a factory uses only its own names, what it is given and the page's globals; nothing given is assigned, all of
      it used; the composition makes each module once, in order, from earlier modules, under the keys its factory takes, each import
      returned by its giver; the headers' `imports` and `exports` are the code's; no write into another owner's state except through
      that owner's function; no call of a function a third module put on another's object; no global back-channel inside a script.
      `tools/c3_modules_mutants.js` shows 12 page breaks refused, each for its own reason.
    - The gate's `page` step: `golden/world_diff.js` gives B++'s `world.js` and this one the same calls (and checks the server's copy
      is the page's, byte for byte); `golden/page_scripts.js` loads B++'s `move.js`, `camcorder.js`, `glitch.js`, `ents.js` and this
      tree's into the same closed Chromium page and drives them the same way (`golden/page_scenes.js`): equal traces, and each scene
      runs every function of its script but a listed few; 12 seam mutants (`golden/page_mutants.js`) are each caught.

## Consequences

- **`sim.js` is ten modules and a composition.** There are no part headers and no shared closure. 0 writes cross owners: what was 18
  writes is now calls to the owner's functions. The server loads the modules from `src/` directly, so `generated/server/sim.js` is gone
  and changing the sim needs no build.
- **The old layout still runs.** The layout map names the composition as `sim.js`. `projectOld` writes it with its requires pointed at
  the copied files, so B++'s `server.js` (the gate's old side) runs this sim.
- **Tests that read the sim's code read all of it** (`layout.simFiles()`: s_ir I1, light_test).
- **A read of a changing value is a function call** (`glitches()` instead of `glitches`). That costs a call, and the gate's perf step
  measures it.
- **Five page scripts changed bytes (C3b).** Their byte comparison with 3H2 is retired; `m8_served_identity.js` names them as rebuilt
  as modules, and the `page` step compares their behaviour with B++'s. Every other served file is still 3H2's bytes.
- **A module's lines keep their indentation.** The code inside a factory is M8's text, so it reads one level less indented than its
  `function` line; the first module of each script also keeps the opening of the script's wrapper (comments and `(() => {`), and the
  composition closes it.

## Alternatives rejected

- **One context object passed everywhere.** It would hide who uses what, which is the coupling M-024 is about. The pack rules it out.
- **Mutating shared arrays in place to keep one identity.** That would change what the server sees: a new list at each reset is part of
  the behaviour.
- **Keeping the sim as built parts with stricter headers.** The closure would still be shared. Modules make the boundary a fact of the
  code, checked by a tool, not a list in a comment.
- **ES modules or a bundler for the page (C3b).** Deferred module scripts would change when each script runs, and the v11 toolchain
  is not reproducible here yet (C1). Factories inside the classic script keep the load order and timing exactly.
- **Rewriting `sim.level0.js` as readable code now.** It is the bundle's own minified level code, and the page's copy lives in the
  bundle (M-003, blocked by C1). It moved as it was, a module of its own.
