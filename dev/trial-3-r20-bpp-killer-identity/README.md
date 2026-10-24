# Trial 3 R20 — B++ killer-identity correction (isolated branch)

**NOT OWNER-APPROVED. NOT MERGED. NOT DEPLOYED.**

The owner authorized this Hound/Smiler kill-visibility correction on a **separate branch**, `trial-3-r20-bpp-killer-identity`. It starts
from R20 combined Human QA commit `3a0d7418a8b472e211f45b5f440a421c94e4ddae`. `main`, R18, R19 and `trial-3-r20-combined-humanqa` are not
touched.

## The defect

On R19 and R20 combined, a spectator could see a Hound's pack-mate disappear instead of the killer, and the killer drawn twice. The page
hid the nearest same-species mirror within 240 px of the death's source, not the server's actual killer. Smilers had the same fallback.

## The change (the first checkpoint, `989d4b1`)

- `src/frameworks/gib/server/death_srv.js`: a Hound's and a Smiler's death replay message carries **one more field, `e`**: the killer's
  entity id from the server's kill record, a positive safe integer, right after `c` (a Skin-Stealer's already did at R20). Any other
  kill kind, or an id that is not a positive safe integer, sends no `e`.
- `src/frameworks/gib/client/mp.deaths.js`: a replay hides the mirror **with that id**, found again on every frame, and only within 400 px
  of the death's source. A missing, invalid or unknown id hides nothing.
- `dev/stage-3h/gate/protocol_bpp.json`: the two new key orders and the `.e` path, recorded as `approvedExtensions`. Every historical
  key order is kept.

## This verification pass (the second checkpoint)

### What was found and corrected

| # | finding | how it was shown | what was done |
|---|---|---|---|
| 1 | **The gate failed on this branch** (srv_golden, bpp_golden, cli_golden, lineage). The historical B++ traces carry no `e`, and the B++ client scenes' replays (B++'s own messages, no `e`) hid the nearest Hound slot where this tree hides none. | the gate's own reports: every server difference was the `e` field and its frame's length; every client difference was the hidden-slot sets (`fk`/`fs`), in states logged once fewer | **a narrow allowance, `dev/tools/gate/golden/approved_ext.js`**: before comparing with B++, it takes out exactly that `e` (after `c`, Hound or Smiler, positive integer, the frame length less those bytes) and on a page only this: where B++ hid its guess after a Hound/Smiler replay without an id, this tree hides *none*. It may pass over a B++ state entry that changed only those slots, and nothing on this tree's side. The stored B++ evidence is not rewritten. Its self-test (34 checks) proves that other changes are still caught: `e` misplaced, `e` = 0 / string / negative / fractional, a wrong frame length, an extra field, `e` twice, another field changed, another species, `e` on another message, an extra line; on a page: another slot hidden, more hidden (also for one entry at the same moment), only some of B++'s slots dropped, extra state entries, slot lists missing / null / not lists / repeated, any other entry or state field changed, fewer hidden with no id-less replay to explain it, or when the replay names its killer |
| 2 | The `__api` contract was stale: the branch's `mp.deaths.js` reads `A.q` through a parameter now | the gate's lineage step | regenerated (`api_contract.js`, `lineage_doc.js`): `q` read 5 times by `mp.js`, not 6; `G` 12, not 11 (finding 3's read) |
| 3 | **Our own Hound death followed a stale slot** (`mp.monsters.js`): `window.__killer` was fixed when the death began. If the killer left the snapshot during the death and another Hound took its slot, that Hound was hidden; when the killer came back in another slot it was drawn twice. A killer first mirrored just after its kill record (the record is read before that message's snapshot is applied) left B++'s guess, a pack-mate, hidden all death long | RV07f, in a VM on the page's own module, R19's module as the negative proof (R19: the new Hound hidden in the old slot, the killer drawn in its new one; the guessed pack-mate hidden all death long) | our killer's id is kept while we are held, and its slot is found from it on every frame; gone, it hides nothing. Until it is first mirrored, B++'s guess stands (finding 7); a closed connection forgets the id (a new server's ids are its own) |
| 4 | The gate's "every function of `mp.js` runs" check failed on the new 400 px check: every client scene's replay is B++'s and names no killer, so no scene reaches it | the gate's cli_golden step (C3c reach) | the closure is named `nearKillAt` and listed, with that reason, among the functions no scene runs (`cli_golden_c3c.js` UNRUN); RV07b-RV07e run it in a VM, `tools/bpp_browser.js` in real pages |
| 5 | RV07c's title still said a Hound replay without an id "is handled exactly as at R19". Its assertion requires the opposite (hides none) | reading the test | the title and header corrected; the assertion is unchanged |
| 6 | The first version of the client allowance was too loose (found by a separate review agent given the code, not the conclusions): an extra state entry, a slot hidden and overwritten at the same moment, slot lists missing / null / repeated, or only some of B++'s slots dropped were all accepted | the reviewer's five mutations of the stored `fx_bodies` trace, each accepted | rewritten (finding 1's description is the current rule); the reviewer's mutations and the new self-test checks are all rejected; the real traces still compare equal (14 and 6 moments) |

**7. Kept as it was, on purpose:** a kill record whose killer has no mirror on our page *at all*. B++ then hides the nearest Hound during
our own death. The C3c client scene `c3c_misc` pins exactly that ("why: unmirrored"), so changing it would change B++'s client behaviour
beyond the approved extension. It is listed under the residuals below.  (RV07e's title also said R19 kept "the slot it found at the start";
R19 used the nearest Hound or Smiler. The title was corrected and RV07e given a case that tells them apart: a killer mirrored when its replay
begins, then gone and its slot given to a pack-mate.)

### The independent review: each point checked

| the owner's question | verdict | where it was shown |
|---|---|---|
| the server sends the correct killer id for Hounds, Smilers and Skin-Stealers | **yes**: `e` comes from the kill record (`sim.feed.js`: `e: ev.eid`, the capturing entity) | RV07d; `tools/e_check.py` on every replay frame in the gate's server traces: 52 of 52 name the server's own killer (50 equal the victim's kill record, 2 a victim that never got one: the capture holding it); real pages: every replay id equals qa `kills` |
| only the actual killer's mirror is hidden | **yes** | RV07c, RV07e; real pages BPP1-BPP5 |
| ids are validated and cannot select another species | **yes**: positive safe integers only; a Hound replay looks only in the Hound map, a Smiler replay only in the Smiler slots | RV07d (bad ids not sent), RV07e `cross` (a Hound replay naming a Smiler's id, and the reverse, hide nothing; R19 hid one of each) |
| concurrent deaths are handled independently | **yes**: each replay resolves its own killer; the hidden sets are their union | RV07b, RV07e `two`; BPP4 (two victims at once, a third page) |
| missing, invalid or stale ids cannot hide an unrelated entity | **yes** for replays; for our own death see the residual | RV07c `houndNoId`, RV07e `before` / `reused`, RV07f |
| slot changes do not hide the wrong creature | **yes** (replays: since `989d4b1`; our own Hound death: finding 3) | RV07e, RV07f |
| the Skin-Stealer fix is preserved | **yes**: `skinstealer.js` and its id path are unchanged | RV07a, RV07b; BPP3 (variants A and D) |
| the 400 px check does not expose duplicate attackers in legitimate sequences | **yes for the Hound**: it commits beside its kill for the death's length plus .25 s (`ai.capture.js`). **A Smiler** does not commit. After a kill it lingers 1.5-4 s (`ai.smiler.js`), then it may walk off: 110 px/s withdrawing, 300 px/s if another player provokes it. Only in that last case can it pass 400 px before its 3.85-3.95 s replay ends. It is then drawn where it really is, as well as in the replay. That is chosen over hiding a live creature that is moving toward somebody | code; RV07e `far` |

### Tests

| run | result |
|---|---|
| `node dev/tests/run.js s_r20rv.js` | **6/6**: RV07a-RV07d, and two new checks, RV07e (replays over time, as snapshots change the mirror under them) and RV07f (our own Hound death), each with R19's module as its negative proof |
| `npm run build:check` | **PASS** |
| `npm test` | **369/382**: the same 13 inherited failures as R20 combined (P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, L9, 2F F13, 2F F22); no new one; +2 checks (RV07e, RV07f). `evidence/npm_test.txt` |
| `npm run gate` (fast) | **FAIL only on `port` and `bundle`**, both NOT RUN as at R20 combined (the locked client packages are not in this session). Every other step PASSES, among them srv_golden, bpp_golden, session, protocol, cli_golden (the 9 H0 scenes, the 3 B++ scenes, all 18 C3c scenes, reach) and lineage. `evidence/gate_fast.txt` |
| the allowance's self-test | **34/34** (run by the gate's bpp_golden step; `evidence/approved_ext_selftest.txt`) |
| `tools/e_check.py` | **52/52** replay frames name the server's own killer (`evidence/e_check.txt`) |

### Protocol compatibility

- **On the wire:** the only change is `e` in a Hound's or a Smiler's `{t:'fx', k:'death'}`.
  - With `e` taken out, every stored B++ server trace is byte for byte what this tree's server sends: 16 replay lines in srv_golden and
    36 in bpp_golden; every other line, field, order, time and count is unchanged.
  - The session traces are identical.
  - The protocol contract check passes on every message.
- **Pages:** the only change is that a replay without an id hides nothing where B++ hid its guess:
  - 14 moments in `fx_bodies`, 6 in `c3c_epoch`;
  - everything else in the 30 client scenes is identical.
- **An older client given the new message** ignores `e`. RV07c's R19 side runs `startFx` on messages with `e`, with its nearest rule and
  no error.
- **An older server's message, without `e`,** hides nothing on this page. The killer can then be drawn twice for the length of that
  replay. This is the stated policy: never hide a guessed bystander.

### Real pages (`tools/bpp_browser.js`; headless Chromium 141, software WebGL, 2 CPUs, about 2 sampled frames a second per page)

Each scene ran on this branch and on R20 combined (`f5b58d7`), with the same placements. The sampler records:
- which entity ids each page hides, per frame;
- the server's kill records.

"Killer hidden" counts the frames its mirror was hidden while it was mirrored; it is drawn once there, by the attack. "Bystander hidden"
counts the frames another creature of that kind, mirrored on that page, was hidden. Victim = the dying page; spectator = another page.

| scene | this branch | R20 combined |
|---|---|---|
| BPP1 two Hounds 110 px apart, the one a step from the victim kills; its pack-mate nearer the attacker's place (variants A, B) and two Hounds 34 px apart | killer hidden 11/11, 11/11, 11/11 (victim), 11/11, 13/13, 12/12 (spectator); **bystander hidden 0** on every page; replay id = the kill record's (11, 13, 15) | A: **the spectator hid the pack-mate on 12/12 frames and drew the killer twice**; the replay carried no id; B and 34 px: right by the nearest rule |
| BPP2 two Smilers, one kills; and with the other one nearer the spectator | spectator: killer hidden 11/11, 11/11; bystander 0. Victim: no slot hidden and bystander 0 (the bundle animates its own Smiler death with the killer's own render slot, `window.__kill.slot`, which `announceKill` finds by id: read from the code, not measured) | right by the nearest rule here; RV07c shows how it fails |
| BPP3 two Skin-Stealers, variants A and D | the killer's own view hidden on every frame, the other drawn and opaque, one attacker; all mirrors back after | the same (R20's fix) |
| BPP4 two victims killed at once by two Hounds, with a Smiler and a Skin-Stealer beside them, a third page watching | both killers hidden on every frame on all three pages (8/8, 12/12, 12/12); Smiler slots hidden 0; the Skin-Stealer's view hidden 0 of 5, 7, 6 | the same: no pack-mate in this scene; each Hound is the nearest |
| BPP5 a Hound kills beside its pack-mate: one page's replay held back 1.2 s and handed to its own handler with its `el`; the spectator's connection dropped at 1.8-3.7 s, then reconnecting (back at 7-13 s); a fresh page entering | victim 6/6; the late page 4/4; the fresh page 9/9, its replay received from the server on joining while it still played; bystander 0. **The reconnecting spectator: killer 1/2 and the pack-mate hidden on 1 of its 2 frames** (below) | **the spectator and the fresh page hid the pack-mate** (2/2, 9/9) and drew the killer twice |

**One frame not explained.** In the final run, the reconnecting spectator's page recorded the pack-mate's slot as hidden on one of the
2 frames it sampled the replay; the other frame hid the killer. The scene ran seven times on this branch:
- two full runs before the last fixes. The first used a sampler that counted a stale own-death slot (`window.__killer` left from an
  earlier death, which the bundle reads only during our own Hound death); that has since been fixed in the sampler;
- the final run;
- BPP4-BPP5 four more times, with every frame kept (`browser/repeats/`).

It was seen in no other run and was not reproduced, so its cause is not known. It may be a real one-frame wrong hide during the
reconnect, or the sampler reading the page's slots mid-change. The final run did not keep its frames. It is listed under the residuals.

**Not checked in real pages:**
- **A fresh join or reconnect timed to land inside the kill.** Pages took 12-13 s to enter or come back here; the fresh page got a replay
  still playing, but at no chosen moment.
- **A Smiler walking more than 400 px away during its own replay.** The world is held, so nothing walks off; the bound is checked by
  RV07e's `far` case in a VM.
- **The wire contents themselves.** No page was given a crafted id (missing, invalid, of the other species): the real server sends only
  valid ones. Those cases are RV07c-RV07e's, in a VM. They are not browser validation.

## Residuals (engineering)

1. **Our own death, when the kill record's killer has no mirror on our page.** Until it is mirrored, it still hides B++'s guess, the
   nearest Hound; the C3c scene `c3c_misc` pins this. The Smiler's own death does the same inside the compiled bundle (`t.slot >= 0 ? t.slot : the nearest`).
   In play every Hound and Smiler is in every snapshot, and the killer is beside its victim, so this needs the page's 64 slots full.
2. **A Smiler provoked into a run during its kill's replay** can be drawn twice once it is 400 px away (above).
3. **An older server's replay** (no `e`) hides nothing; its killer can be drawn twice while it plays.
4. **The one-frame observation on a reconnecting spectator's page** (above): not reproduced in five reruns, cause unknown. Worth a look in
   Human QA: a spectator whose connection drops during a Hound kill beside a pack-mate.

## Re-running

```
node dev/tests/run.js s_r20rv.js
node dev/tools/gate/golden/approved_ext.js --self-test
npm run gate                                    # port and bundle need the locked client packages
node dev/tools/gate/golden/srv_golden.js --baseline dev/stage-3h/evidence/h1/golden/srv_traces --out <out>/srv --keep <out>/srv_keep
node dev/tools/gate/golden/bpp_golden.js --repeat 0 --baseline dev/stage-3h/evidence/h2/golden/bpp_traces --out <out>/bpp --keep <out>/bpp_keep
python3 -I dev/trial-3-r20-bpp-killer-identity/tools/e_check.py <out>/srv_keep <out>/bpp_keep
node dev/trial-3-r20-bpp-killer-identity/tools/bpp_browser.js --dir <tree> --label NAME --out FILE.json
```

`evidence/` holds this pass's raw outputs: the gate, `npm test`, `s_r20rv`, the self-test, `e_check`, and the real pages on both trees
(`browser/*.json`, their stdout, `browser/repeats/` with every frame, and `browser/summary.txt` from `tools/browser_summary.py`). Paths in them
are written as `<repo>`, `<gate-out>`, `<scratch>`.
