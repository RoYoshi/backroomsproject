# Stage 3H1: the nine 3H0 NO-GO seams, re-evaluated on B++

**The question.** Stage 3H0 deferred nine seams (`3H0_DEFERRED_FULL_3H.md` §1–2) on its parent, Stage 3C QA2. Since then the code changed under all of them:
- **Stage 3D** (D0–D7, HQ1–HQ5): the server owns deaths, corpses and NEW RUN; player solidity; world epochs; BR-RoLE 1.2's ground contact;
- **Stage 3E-0** (B+, B++): `caps`, `q`, the 25 ms send, the eased peers, and B++-0's placement guard.

This file asks, for each seam, whether any of that made it safe to move.

**The answer.** No seam became safe. Six became more coupled. Two of the server seams now contain a narrow, fully pinned piece that could move on its own later (C-1 and C-2 in `3H1_EXTRACTION_CANDIDATES.md`). NO-GO remains the default for all nine.

**How it was checked.**
- **Reading the code** at `143b63f`, with the section maps in `3H1_DEPENDENCY_OWNERSHIP_MAP.md` §4–5.
- **The text-reading tests,** run on B++:
  - `s_humanqa_hotfix.js`: 5/6, X03 failing as recorded at HQ2;
  - `s_ir.js` I1: passes;
  - `test_shadows.js` S16: fails as recorded since 3H0.
- **The golden coverage** listed in `3H1_SOURCE_PARITY_BASELINE.md`.

## 1. Summary

| Seam | 3H0 decision | What changed since | B++ decision |
|---|---|---|---|
| C4: client transport | NO-GO | 5 more message types; B+ state in every handler | **NO-GO, more coupled** |
| C5a: client admin panel | NO-GO | HQ3's UNLIMITED NEW RUN (`nrf`, `adm.nf`) | **NO-GO** (private security items first) |
| C5b: client replays and bodies | NO-GO | Stage 3D rewrote them: server-made replays, dying lights, wall stains | **NO-GO** (Stage 3D accepted; G.I.B.) |
| C5c: client peers presentation | NO-GO | B+'s easing; solidity; HQ5's contact reads the avatars | **NO-GO, highest risk** |
| Hum and dread audio | NO-GO | unchanged code; still its own `AudioContext` | **NO-GO** (audio locked until 3F) |
| S4: server sessions | NO-GO | `caps`, `nr`, solidity, the placement guard in the closure | **NO-GO, more coupled** |
| S5: snapshot and tick | NO-GO | `q` between snapshots, `k`, `w`, `nf`; the aftermath tick | **NO-GO, highest risk** |
| S5b: admin commands | NO-GO | one new command (`nrfree`); `world` now resets the epoch; `revive` cancels the aftermath; self-moves place through `moveTo` | **NO-GO** (private security items first) |
| Movement validation and death aftermath | NO-GO | B++-0's guard (movement); Stage 3D moved deaths to the server (aftermath) | **Movement: NO-GO. Aftermath: CANDIDATE-LATER (C-2)** |

The NEW RUN decision (`nrIntent`) did not exist at 3H0. It sits beside S4 and the aftermath, and is the narrowest server piece found (C-1).

## 2. Each seam

### C4: client transport (`mp.js` 171–244, `connect` and its handlers)

**3H0's reason.** `ws.onmessage` writes state owned by almost every other part of `mp.js`.

**What changed:**
- **18 message types now.** 3H0 had 13; B++ adds `caps`, `q`, `world`, `nra` and `nrf`.
- **`onopen`** now also resets the B+ state and asks `caps`.
- **The `s` handler** now also writes:
  - `lastK`, `PN` (B+);
  - `worldW` and `worldNew` (HQ2 epochs);
  - `pendSt` and `mkAt` (HQ1 timing notes);
  - `solidPeers` → `window.__peerBodies` (HQ2 solidity, read by `move.js` every step).
- **`onclose`** now also clears `nrSent`, `nrBusy`, `nrWaitT`, `fastAck`, `lastK`, `solidHeld`, `blend` and `__peerBodies`.

**Text-reading tests.** None read this section's text.

**Decision: NO-GO, more coupled than at 3H0.** Splitting the handlers now also means splitting B+'s state (`fastAck`, `lastK`). That state is the accepted B++ surface.

**What it would need first:**
- 3H0's list still holds: a written client session-state design, a dispatch by type, and per-type golden traces;
- `cli_golden` scenes that drive `caps`, `q`, `world` and `nra`. `cli_golden`'s 9 scenes predate them.

### C5a: client admin panel (`mp.js` 638–886)

**What changed.** HQ3 added UNLIMITED NEW RUN: the `nrf` answer and `adm.nf`, with one more use of `adm.sig`. The death lab's preview options (`adm.rv`, `adm.opts`) were already there at 3H0.

**Text-reading tests.** `s_humanqa_hotfix.js` X02 reads `data-n="10"` in `mp.js` (passes on B++).

**Decision: NO-GO.**
- It is admin behaviour: the passcode is kept in memory for reconnects.
- The security items reported privately are undecided.
- It still depends on C4.

### C5b: client death and vanish replays, bodies (`mp.js` 359–362, 411–583)

**What changed.** Stage 3D rewrote this as 3H0 expected:
- replays are the server's (`fx` with `de`, `wn`, `lo`, `lf`);
- corpses carry their age (`ag`);
- the dying light's timeline (`relOf`, `powerAt`, `__deathLight`) feeds BR-RoLE;
- `wallStains` hands impacts to `gore.js`.

**Text-reading tests.** None read this section's text.

**Decision: NO-GO.**
- It is G.I.B.'s client side, accepted at Stage 3D.
- It is read by the bundle (`__fxKill`, `__fxKillS`, `__hideBodies`, `__dvic`) and by BR-RoLE (`__deathLight`).
- Its golden coverage is `cli_golden` `fx_bodies` and `smoke`, which do not pin the dying-light curve frame by frame.

### C5c: client peers presentation (`mp.js` 402–410, 584–637)

**What changed:**
- B+'s easing by elapsed time and its fresher targets (`peerPoses`);
- HQ5's ground contact: BR-RoLE reads the avatars `drawPeers` drives;
- HQ2's soft corrections (`softTp`, `blendStep`), next to it.

**Text-reading tests.** `s_humanqa_hotfix.js` X03 reads the `DEAD` hover text here (`mp.js` line 629); that assertion passes. X03 fails on B++, as at HQ2, on two assertions about the bundle's text.

**Decision: NO-GO, highest risk.** This is what the user judged in B++'s human QA ("much smoother movement"). Any change shows up at once as lag or ghosting.

### Hum and dread audio (`mp.js` 887–992 and 363–401)

**What changed.** Nothing in the code. The dread drone, thumps and capture burst still use mp.js's own `AudioContext` and follow only the SOUND toggle, not the volume setting (F-008).

**Decision: NO-GO.**
- Audio is locked until Stage 3F.
- No probe hears the output. `cli_golden` `hum_dread` records the calls, not the sound.

### S4: server rooms and sessions (`server.js` 250–255, 321–397)

**What changed.** The per-connection closure now also holds:
- `me.fp` (`caps`);
- `nrIntent` (`nr`);
- the admin branch's `adminMove`;
- the first-pose spawn check with `PEERS.freeSpot`;
- the throttle, which depends on `FAST_GAP`.

**Text-reading tests.** `s_ir.js` I1 reads `me.ir =` and the absence of `player.ir =` (passes).

**Decision: NO-GO, more coupled.** B+'s `caps` and `FAST_GAP` are in this closure.

**One piece is separable.** `nrIntent` (227–244, with `NR_GAP` at 204–211) is called from one line of it.
- Its own state is three session fields (`me.nr`, `me.nrT`, `me.nrDropped`).
- It also reads or writes shared fields (`me.player`, `me.id`, `me.admin`, `me.nrFree`, `me.spawnNext`, `room.deSeq`, `room.name`) and calls `room.sim`, `send`, `boomStart` and `console.log`.
- It is now pinned by `bpp_new_run`, except for the `held` refusal.

See C-1 for the full list and its invariants.

### S5: snapshot builder and tick (`server.js` 398–468)

**What changed:**
- `poseSend` (B+ `q`) runs on the ticks between snapshots;
- `s` now carries `k` for fast clients, `w`, `nf`;
- the tick also runs the aftermath (`aftTick`) and sends `bodies` with corpse ages.

**Text-reading tests.** `s_ir.js` I1 reads `ir: c.ir`.

**Decision: NO-GO, highest risk.** It is the timing authority, and B+'s 40 Hz pose path lives in it.

### S5b: admin commands (`server.js` 256–320)

**What changed.** 24 commands now; 23 at 3H0, which already had `world`, `preview`, `entgoto`, `nav` and `entdel`:
- one new command, `nrfree` (HQ3);
- `world` now calls `worldReset`: a new world epoch for everyone (HQ2);
- `revive` now cancels the death's aftermath;
- `bring`, `goto`, `glitch`, `item` and `entgoto` now place through `moveTo(room, …)`, so through `placeFree` (HQ2).

**Text-reading tests.** `s_humanqa_hotfix.js` X02 reads the clamp `Math.max(1, Math.min(10, m.n | 0 || 1))` (passes).

**Decision: NO-GO.**
- It is admin behaviour and security.
- An admin's own moves are unchecked by design (F-019).

### Movement validation and death aftermath (`server.js` 30–203)

**Movement validation** (`MV`, `mvCheck`, `placeFree`, `mvReset`, `mvAccept`, `adminMove`): **NO-GO, highest risk.** B++-0's placement guard is here. Its two stated limits are now pinned by the golden `bpp_known_limits` (F-019, F-020), so a later B++ correction can be compared exactly.

**Death aftermath** (`aftStart`, `aftOf`, `aftSend`, `aftTick`, with `bodyAt` / `putBody`):
- **Then.** At 3H0 the aftermath was the client's.
- **Now.** It is the server's, and it is self-contained:
  - it reads `room.afts`, `deathSrv` and `send`;
  - it writes corpses through `putBody`;
  - `worldReset` and `adminCommand` `revive` call into it.
- **Coverage.** The 3H0 `deaths` scenario and the B++ goldens' deaths and blasts pin it byte for byte.
- **Decision: CANDIDATE-LATER (C-2),** after C-1 has proved the method on the smaller piece.

## 3. What this changes in 3H0's suggested order

3H0 suggested:
1. the security decisions;
2. C4;
3. C5a;
4. S4, then S5;
5. C5b, C5c and the hum to their owning stages.

On B++, C4, S4 and S5 hold B++'s accepted surfaces. They should wait until the wider B++ QA (pack file 12) has settled and a separately authorized B++ checkpoint exists, if one is ever wanted.

The safe order is in `3H1_EXTRACTION_CANDIDATES.md` §3:
1. the development gate first (H2-0, no runtime file);
2. then the two server pieces that sit outside B++'s surfaces, each behind a golden that already pins it.
