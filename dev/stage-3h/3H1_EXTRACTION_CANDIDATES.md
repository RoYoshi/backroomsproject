# Stage 3H1: extraction candidates and the ranked backlog

**Status: recommendations only. Nothing here is authorized.** Each runtime step needs the user's explicit go-ahead, a playable overlay with a full revert, and the user's own Human QA. Stage 3H1 changed no runtime file.

**The rule every candidate must meet.** Inherited from 3H0, with B++'s lock:
- a move, not a rewrite;
- the same observable behaviour for the same inputs, shown by golden traces that already pin it byte for byte;
- no change to B++'s accepted surfaces (`3H1_DEPENDENCY_OWNERSHIP_MAP.md` §6), timing, audio, visuals or AI;
- a revert that is one commit.

File length is not a reason to move anything.

## 1. Verdict words

| Verdict | Meaning |
|---|---|
| **RECOMMENDED** | The next step to authorize, with the gate below |
| **CANDIDATE-LATER** | Separable and pinned, but only after a named precondition |
| **NO-GO** | Stays where it is for Stage 3H; the reason is given |
| **NOT A SEAM** | Already a module, or data; nothing to extract |

## 2. The ranked backlog

| Rank | Step | Kind | Risk to the game | Verdict |
|---|---|---|---|---|
| 0 | **H2-0: one development gate for B++** | `dev/` only | **None** (no runtime file) | **RECOMMENDED first** |
| 1 | **C-1: the NEW RUN decision → `server/newrun.js`** | server only | Low | **RECOMMENDED** as the first runtime checkpoint, after H2-0 |
| 2 | **C-2: the death aftermath → `server/aftermath.js`** | server only | Medium | CANDIDATE-LATER: after C-1 is accepted |
| 3 | **C-3: NEW RUN's button and words in `mp.js`** | client | Medium | CANDIDATE-LATER: after a client NEW RUN golden exists |
| — | everything in §5 | | High or very high | NO-GO |

No client candidate is low risk on B++:
- a client move needs a new classic script, and so a change to `index.html`'s load order, which decides who writes each global;
- the client goldens (`cli_golden`, 9 scenes) predate B+ and NEW RUN.

### H2-0: one development gate for B++ (no runtime file)

**What.** Make the comparison tools one command that a runtime checkpoint must pass. All work is under `dev/stage-3h/`; 3H0's own tools are left untouched.
1. **Rebaseline** 3H0's `run_checkpoint.js` gate on the B++ baselines frozen in 3H1 (`evidence/h1/`): `srv_golden`, `cli_golden`, and the five B++ goldens.
2. **Write a B++ protocol contract (v2) on purpose,** from `wire_keys.json` and the code. 3H0's contract predates Stage 3D and 3E-0 and reports 12,483 differences that are not defects (F-003).
3. **Repair the two live harnesses as 3H copies:**
   - `raw_live.js` passes vacuously on B++ (its copy of the tree lacks `server/`);
   - `live_wire.js` waits forever for the END button that HQ2 moved (F-021).
4. **Add the scope and manifest check** (`h1_scope_check.py`) and the build check (`h1_build_check.js`) as gate steps.
5. **Wire in the existing mutants** (`golden/bpp_mutants.js`, 9 of 9 caught in 3H1), and let each mutant name the file it changes, so it can follow code that moves.
6. **Add the one NEW RUN refusal no golden reaches yet:** `held`, a press made while held in a capture (`sim.nrWhy`). Add it as a separate scenario, so the frozen `bpp_new_run` trace stays as recorded.

| | |
|---|---|
| Dependencies | none |
| Rollback | delete the added `dev/` files |
| Performance guardrail | not applicable |
| Why first | every runtime step after it gets a one-command, B++-labelled before/after comparison instead of hand-run tools |

### C-1: the NEW RUN decision → `server/newrun.js`

**What moves.** `NR_GAP` and `nrIntent` (`server.js` 204–211, the comment and the constant; 227–244, the function).
- **Stays:** `boomStart` (212–226) stays in `server.js`: it is the aftermath, C-2.
- **The call:** `onMessage` keeps its one call line: `else if (m.t === 'nr') nrIntent(room, me, m);`.
- **The module:** a factory, `require('./server/newrun.js')({ send, boomStart })`, required after `send` is defined (`send` is a `const` at line 247), returning `nrIntent`.

**What it touches:**
- **Session fields of its own:** `me.nrT`, `me.nr`, `me.nrDropped`. Nothing else in `server.js` reads or writes them.
- **Session fields it shares:**
  - `me.player` and `me.id`: read;
  - `me.admin` and `me.nrFree`: read; set by the admin unlock and by the `nrfree` command;
  - `me.spawnNext`: set to `false` on approval; also written by `join`, `respawn` and the first pose.

  The module must keep receiving them through the same `me` object; nothing about who owns them changes.
- **Room fields:** `room.deSeq` (shared with the aftermath's death ids), `room.name`.
- **The sim:** `worldSeq`, `nrWhy`, `newRun`, `nrWait`.
- **Calls:** `send`, `boomStart`, `Date.now()`, one `console.log` line.

**Invariants to keep exactly:**
- `me.nrT` is set before the duplicate-press check;
- a malformed or zero `q` returns before `me.nrT` is set;
- `room.deSeq` increments only on approval;
- `boomStart` runs before the answer is sent;
- the log line is identical;
- the answer objects keep their key order (`t`, `q`, `ok`, `why`/`de`, `wait`/`w`).

**Pinned by:**
- **`bpp_new_run`** (new in 3H1), byte for byte, covering every decision but one:
  - approved, and the same press answered again;
  - refused: from the menu (`state`), in the cooldown with the wait, after a world reset (`epoch`), while dead;
  - no answer: a flood, an older press, malformed presses;
  - an admin's UNLIMITED NEW RUN on and off (`nrf`);
  - the blast replay and the corpse.
- **Not yet covered:** `held`, a press while held in a capture. H2-0 adds it (step 6) before C-1.
- The other 15 server goldens must stay identical too.

**Text-reading tests.**
- **The game's tests:** none read `nrIntent` or `NR_GAP` (checked across `dev/tests`, `dev/shadows`, `dev/br-role`, `dev/stage-3b-n`).
- **3H1's own `bpp_mutants.js`:** it replaces four exact strings of them in `server.js`. After C-1 those four mutants must point at `server/newrun.js` (H2-0, step 5).

**Risk: low.** It is server authority, but a pure move, called from one place, with no timer, no randomness and no client change.

**Gate:**

| Check | Expected |
|---|---|
| `bpp_golden` (5), `srv_golden` (11) | identical to the B++ baseline |
| `static_check` | `server/newrun.js` is not reachable over HTTP |
| scope check | only `server.js` and `server/newrun.js` differ from B++, and every other production file is byte-identical. `h1_scope_check.py` as written refuses any production change; H2-0 gives it a mode that allows exactly the named files |
| `perf_det` A/B | within the A/A noise in `3H_PERFORMANCE_BASELINE.md` |
| Human QA | NEW RUN while alive; again within 30 s (the wait); after an admin world reset; an admin's UNLIMITED NEW RUN; another page watching the blast |

**Performance guardrail.** It runs only on `nr` messages, at most 4 a second per client (`NR_GAP` 250 ms). No measurable cost is expected; the A/B confirms it.

**Rollback.** Revert one commit. The overlay is two server files. Clients are untouched, so a server restart is the whole revert.

**Honest value.** Small. It proves the method on B++ code with the least possible risk, and gives NEW RUN a named home. It does not make the game better.

### C-2: the death aftermath → `server/aftermath.js` (G.I.B.'s server side)

**What would move:** `aftStart`, `aftOf`, `aftSend`, `aftTick`, `boomStart`, and the corpse-age map `bodyAt` with `putBody`.

**Coupled to:**
- the tick (`aftTick`, `aftStart` for deaths found there, the `bodies` ages);
- the sim's `onDeath` hook in `getRoom`;
- `worldReset`;
- `adminCommand` `revive`;
- C-1's `nrIntent`, through `boomStart`.

**Pinned by:**
- `srv_golden` `deaths`;
- `bpp_new_run`: blasts and corpses;
- `bpp_caps_q`: a death in a B+ room.

**Risk: medium.** Stage 3D's death timing is what players see.

**Precondition.** C-1 accepted by the user's Human QA.

**Performance guardrail.** It runs every tick while an aftermath is open, so `perf_det` A/B must stay within the A/A noise.

**Rollback.** One commit.

### C-3: NEW RUN's button and words in `mp.js` (81–103)

**What would move:** `nrButton`, `nrAnswer` and `runMenuWords`, as a classic script loaded before `mp.js`.

**Why later:**
- it needs an `index.html` change (a new `<script>`);
- it shares NEW RUN state with the `__net.nr` press (38–72) and the transport (`nrSent`, `nrBusy`, `nrWaitT`, cleared in `onclose`);
- no client golden drives NEW RUN. `gameplay_smoke.py` checks only that it works.

**Precondition.** A `cli_golden` scene for NEW RUN, recorded on B++.

**Risk: medium.**

## 3. The recommended phase order

Pack file 03 asks whether another order is safer than H2 → H6. It is:

| Step | What | Runtime change |
|---|---|---|
| H2-0 | the development gate | none |
| H2 | C-1 only, with overlay, revert and Human QA | 2 server files |
| H3 | C-2, only after C-1 is accepted | 2 server files |
| H4 | framework boundaries as **annotations** in documents and file headers, not moves: most names have no code to organise (`3H1_FRAMEWORK_REGISTRY.md`) | none |
| H5 | `dev/devlog4dev/` exists now. A root-log migration only after a path and hash audit (R-017). The FPS / network overlay is a separate, opt-in feature (R-011) | none in 3H |
| H6 | integration: compare the final tree with the original B++ baselines in `evidence/h1/`, not only with the previous step; then two-player Human QA on real hardware | none |

**Pause rule.** If the wider B++ QA (pack file 12) finds a confirmed regression:
- every runtime 3H step stops;
- the B++ fix goes on its own authorized checkpoint;
- the 3H parent moves only after that is independently verified and the user says so.

## 4. Considered and rejected

These look easy and are not worth a runtime checkpoint:

| Idea | Why not |
|---|---|
| Delete dead lines (`TOUCH`, the 400 px snap, `__net.collected`'s call, the 90-character cut) | No behaviour or ownership gain; the bytes of accepted files change for nothing. Only inside an authorized step that already touches those lines |
| Move `findSpot` or other admin helpers | Admin behaviour; the private security items come first |
| Move `buildHum` or the dread audio | Audio is locked until Stage 3F |
| Split `ai.js` or `ents.js` further | Already split in their sources (`dev/ai_src`, `dev/ents_src`); the runtime closure is one design (F-001) |
| Share the Level 0 map between the bundle and `sim.js` | Changes bytes on both sides, and the bundle cannot be rebuilt (F-002, F-007); a L.O.S.T. stage |
| Rename the bundle's minified `__api` members | Impossible without the bundle's source |

## 5. NO-GO areas

| Area | Where | Why |
|---|---|---|
| B++-0's placement guard, movement validation | `server.js` 30–113, 189–203 | accepted most recently; anti-cheat semantics |
| B+'s server side | `server.js` `caps`, `FAST_GAP`, `poseSend`, `k` | B++ surface |
| Sessions, snapshot and tick | `server.js` 250–255, 321–468 | timing authority; B+ inside |
| Admin commands and authentication | `server.js` 256–320, `passOk` | security; private items undecided |
| Client transport, peers, B+ | `mp.js` 1–76, 108–244, 584–637, 993–1044 | B++ surface; highest risk |
| Client replays, dying lights, stains | `mp.js` 411–583 | G.I.B., Stage 3D |
| Admin panel | `mp.js` 638–886 | security |
| Hum and dread | `mp.js` 363–401, 887–992 | audio locked |
| BR-RoLE | `assets/br-role.js` | accepted 1.2; contact and cast |
| The game bundle and PixiJS chunks | `assets/index-*.js`, chunks | no source; vendor build |
| `world.js`, `dphys.js` | both sides | one byte changes server and client |
| `ai.js`, `ents.js`, `sim.js` | built | only through their sources, rebuilt and checked |
| `index.html`, CSS, media, `favicon.ico` | page and assets | load order; user-supplied bytes |
| Items, entity art, multi-level, LogicZ | — | other stages |

## 6. Not a seam

| What | Why |
|---|---|
| `assets/net-wire.js`, `assets/net-interp.js`, `server/ws.js`, `server/fields.js`, `server/static.js` | 3H0's five modules |
| `server/peers.js` | HQ2's module |
| `camera_policy.js`, `timing_policy.js` | already small modules |
| `assets/credits_data.js`, `assets/level0_visuals.js`, `world.js`'s tables | data |
