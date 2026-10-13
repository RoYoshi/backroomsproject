# H2-1: NEW RUN as the server's decision (no explosion yet)

## What changed

| File | Change |
|---|---|
| `dev/sim_glue.js` → `sim.js` | NEW RUN is `newRun(p, now)`: only while alive and free, at most once every 30 s (`NR_CD`). It takes the player out of the world at once (to the menu). `nrWhy` says why not (`state`, `dead`, `held`, `cooldown`) and `nrWait` how long is left. The vanish window is gone: `join` and `leave` from alive are always refused |
| `server.js` | `{t:'nr', q, w}` is answered once per press by `{t:'nra', q, ok, …}` (`nrIntent`). The same q again gets the same answer; an older or malformed q, or one within 250 ms of the last, gets none. A press naming another world gets `epoch`. The client's `fx` and `b` are no longer read at all. Each snapshot `s` carries the world epoch `w` |
| `mp.js` | `__net.nr(ok)` sends the intent and changes nothing until the answer. Approved: the bundle's callback. Refused: the NEW RUN button says `WAIT n S` or `NOT NOW` for 2.5 s. While a press waits (up to 2.5 s) or after an approval, further presses do nothing. `vanish` and `bodyMade` send nothing (the offline fade shares nothing). `window.__nrDebug` exists for tests |
| `assets/index-DKbV5Nv9.js` (by `dev/stage-3d/apply_bundle.py`, two new exact-text edits) | Online, `Xnr` (the NEW RUN button) only calls `__net.nr(Xok)`. `Xok` hides the player at once, plays a 0.8 s beat, then shows the run menu (`Nend`). Offline, the old local sequence is unchanged |

## Results

**Protocol** (`proto/nr_green`): 26/26 checks pass.
- **`nr_flow`**: one intent, one approval with an event id and the current world. Alice is gone from Bob's snapshots 21 ms later and is in the menu on the server; her join starts the new run. There is no vanish or light-record traffic.
- **`nr_elig`**:
  - refusals: from the menu (`state`); for another world (`epoch`); for a just-killed player (`dead`);
  - malformed press numbers get no answer;
  - a resend gets the same answer and no second event; an older number gets nothing;
  - the old `fx`/`b` channels relay and store nothing;
  - an admin world reset sends no answer, explodes nobody and starts nobody's cooldown, and a press still naming the old world is refused.
- **`nr_held`**: a real hound capture, with capture style `play`, is refused (`held`) and the player stays held.
- **`nr_e02`**:
  - presses at 1 s, 10 s and 29.9 s after an approval are refused with `wait` 29, 20 and 0.1. The player stays active and Bob keeps seeing her; nothing reaches Bob.
  - A flood of 100 intents gets one answer, a refusal.
  - At the 30 s boundary the press is approved.

**Browser** (`browser/nr_e02.json`, two real pages and the server's player list): 7/7 checks pass.
- NR1 is approved and the run menu shows 0.98 s later. Bob stops drawing Alice's light 0.16 s after the approval.
- A press 0.96 s after the approval, still in the beat, starts nothing.
- After SPAWN, presses really fired at 10.65 s and 27.54 s are refused with `wait` 18.8 and 1.9 s (the button says WAIT). For the next 3 s nothing changes on her screen, on Bob's or on the server: no fade, no hidden avatar, no local light record, no move, no `fx` or `bodies`.
- The press at 31.8 s is approved.

Screenshots: `browser/shots_e02/` (the run menu after NR1; both screens 1 s after the refused press; after the last approval).

**Mutations** (`mutation/`): each deliberately broken copy of this tree fails the test that claims to catch it.

| Mutation | Test | Result |
|---|---|---|
| `e02_no_cooldown`: the server forgets the 30 s | `proto_lab nr_e02` | 2/7, FAIL: the 1 s, 10 s, flood and 29.9 s presses are approved |
| `e01_stays_alive`: approved, but the player stays in the world (the old phantom) | `proto_lab nr_flow` | 3/6, FAIL |
| `e02_local_first`: the client starts its new run before the answer (the HQ1 bug) | `nr_browser --plan e02` | 3/7, FAIL: the refused presses still move Alice into a new run |

**Older suites, against the parent where it matters:**

| Suite | HQ1 parent | HQ2 at H2-1 | Note |
|---|---|---|---|
| `s_audit` | 9/9 | 8/9 | L9, the vanish lifecycle |
| `death_net` | 16/16 (HQ1-3, the same production files) | 15/16 | N9, a client's `b:Vanish` light record |
| `audit_net2` | 10/11 (DD2, known since D7) | 9/11 | LC4, the vanish sequence, and DD2 |
| `audit_net` | 16/17 (D3, known since D7) | 16/17 | the same failure |
| `light_net` (HQ1) | — | pass | |

The three new failures are expected protocol deltas. Each asserts the old vanish lifecycle that HQ2 removes on purpose: a living player's vanish → leave → join, and a client-made light record. They are left as they are (older tests are not edited) and replaced:
- L9 and LC4 by `nr_flow`, `nr_e02` and `nr_elig`;
- N9 by `nr_elig`'s "the old client channels are dead".

## Attempts kept (`attempts/`)

- `mutations_never_copied/`: the first job built the mutation copies with `rsync`, which is not installed here. No copy was made, so those three runs tested nothing. The rerun uses `tar`.
- `browser_e02_presses_from_script/`: the first browser run pressed NEW RUN from the test script. On the slow SwiftShader pages the presses landed seconds late: "29.9 s" really fired at 30.15 s and was approved, as it should be. The plan now sets the presses as timers on Alice's own page, and each records when it really fired. The exact 29.9 s / 30 s boundary is the protocol test's.
- `browser/nr_e02.first_measure.json`: the rerun's first measurement.
  - One check read "the beat" as the first 0.8 s. The press fired at 0.96 s, before the run menu appeared at 0.98 s, so still in the beat.
  - The check now uses the moment the run menu appears. The same run was re-measured (`nr_browser.py --reanalyse`), with no browser and no new data.
  - The mutation run was re-measured the same way and still fails.
