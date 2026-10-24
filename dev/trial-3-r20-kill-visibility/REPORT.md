# Trial 3 R20, kill visibility (the owner's addendum, RV01-RV07): report

Trial 3 is **not owner-approved**.  The branch is `trial-3-r20-kill-visibility`, based on R19 combined `2f11eae`.  DESIGN_DECISIONS.md has
the cause and the change.  The environment was this session's machine: 2 CPUs, node v22, headless Chromium 141 with software WebGL.

## What was reproduced, and what the fix does: the real pages (`tools/rv_browser.js`)

R19 (`evidence/A/rv_R19.json`) and this branch (`evidence/B/rv_R20RV.json`) ran the same scenes against the real server.
- The pages are real: each in its own browser, entering with its own keys, signed in as the admin with a synthetic passcode.
- Every creature was placed with the test-only `qa_server.js`.  Every kill was the admin's DEATHS-tab preview: the real capture and kill
  path, which takes the creature of that kind nearest the victim.  The world was held so nothing walked off.
- Each page sampled what it drew on every frame, and it was judged against the server's own kill record (qa `kills`).

The full table is `evidence/B/rv_table.md`.  Its column meanings:
- **Bystander hidden:** frames on which a Skin-Stealer that did not kill, near enough to be drawn, was not drawn.
- **Killer drawn:** frames on which the killer's own mirrored view was drawn while its kill played.  That would draw it twice.
- **Attackers:** the death's own attacker drawings on the page.

| scene (Skin-Stealer kills, a second Skin-Stealer within 260 px) | R19: bystander hidden | **this branch** | killer drawn twice (both) |
|---|---|---|---|
| RV01/02 variant A, victim / spectator | 11/11, 9/9 | **0/11, 0/8** | 0 |
| RV01/02 variant B | 11/11, 10/10 | **0/11, 0/9** | 0 |
| RV01/02 variant C | 10/10, 8/8 | **0/10, 0/11** | 0 |
| RV01/02 variant D (the Rend) | 10/10, 10/10 | **0/10, 0/9** | 0 |
| RV03 swapped (the other one kills) | 10/10, 9/9 | **0/10, 0/10** | 0 |
| RV03 four Skin-Stealers, two victims at once, A (second victim, a third page) | 12/12, 13/16, 13/14 | **0/14, 0/10, 0/8** | 0 |
| RV03 the same, D | 15/16, 10/12, 14/16 | **0/14, 0/12, 0/12** | 0 |
| RV03 the same again, B (repeated) | 13/14, 15/20, 6/6 | **0/16, 0/14, 0/10** | 0 |
| RV04 the victim, with pages arriving late | 9/9 | **0/9** | 0 |
| RV04 a page whose replay arrives 1.2 s into the kill | 1/1 | **0/1** | 0 |

**After every death and revive, every mirror was drawn again on every page**, on both trees: nothing hidden, nothing faded, no attacker
left.  Every kill drew exactly its own attacker: one per kill, two while two kills played.

**The frame rates were low.**  These pages drew 2-4 frames a second (software WebGL, up to four pages on two CPUs).  Each case is about
10 frames per page; the result was the same on every frame.

**After the runs.**  The independent review asked for a backstop: a killer more than 400 px from its death's source is drawn, even while its
kill plays.  That was added after these runs.  The id test is unchanged, and in every scene the killer stood by its kill.  RV07b checks the
backstop.

## RV04: what could not be done on this machine

A Skin-Stealer's death lasts 3.2-3.6 s.  Here:
- a fresh page took 12-18 s to enter;
- a page whose connection dropped took 5-15 s to come back.

Both came in after the death had ended, so they saw the corpse and every mirror drawn, on both trees.  The real "arrives mid-kill" case was
run instead by holding the server's own replay message on a page in the room and giving it to the page's handler 1.2 s later, with its
`el`.  That is what `aftSend` sends a page that joins then.  It is one frame on this machine.  RV07b checks the same path in the VM.

**NOT CHECKED in a real browser:** a fresh join or a reconnect landing inside a Skin-Stealer's kill.  The owner's machine will do it.

## RV05: the Hound and the Smiler, tested rather than assumed

| scene | R19 | this branch | verdict |
|---|---|---|---|
| a Skin-Stealer kills beside a Hound and a Smiler | no Hound, no Smiler hidden | the same | **unaffected** |
| a Hound kills beside a Skin-Stealer | the Skin-Stealer drawn 11/11, 12/12; the killer Hound's slot hidden | the same | **unaffected** |
| a Smiler kills beside a Skin-Stealer | the Skin-Stealer drawn; the killer Smiler hidden | the same (the sampler matched one frame's Smiler slot to no entity: its place-matching, not the page) | **unaffected** |
| two Hounds, 110 px apart, one kills | victim: the killer hidden (by id); **spectator: the other Hound hidden** (38, the killer was 37) | **the same** (40 hidden, the killer was 39) | **affected: a spectator's replay can hide the wrong Hound** |
| two Hounds 34 px apart, one kills | the killer hidden on both pages | the same | right here |
| two Smilers, one kills | the killer hidden | the same | right here (the same nearest rule: RV07c shows how it can fail) |

**The Hound's replay defect.**  A spectator's replay hides the Hound nearest the attacker's place within 240 px.  The preview set the killer
down a step from the victim; the page's mirrored view of it lagged, and the pack-mate was nearer.  The bystander was then hidden while the
killer was drawn twice.

**Why it is not fixed here, and what is.**  The fix is the Skin-Stealer's: the killer's id in the replay message.  For a Hound or a Smiler,
that changes a B++ message.
- The gate's B++ protocol contract (`dev/stage-3h/gate/protocol_bpp.json`) and its golden traces hold that message key for key.  A first
  version of this fix sent the id for every kind, and the gate's protocol, server and B++ golden checks failed on it.
- The addendum keeps "the payload without a Skin-Stealer" as it was.
- So a Hound's or a Smiler's message is unchanged.  Their replays keep R19's rule.
- The page's code already takes an id when a message names one (RV07c).  If the owner agrees to the protocol change, sending `e` for
  every kind fixes it.  The contract and the golden traces would then be re-derived.

The **victim's** own Hound death is right: it hides by the kill record's id.

## RV06 / RV07: instrumentation and the negative tests

- **RV06.**  `rv_browser.js` records, per frame and per page:
  - each mirrored view's entity id, `visible`, `alpha`, and whether any parent hides it;
  - every attacker drawing;
  - our own death and every replay playing (its cause, its id, its source);
  - the Hound and Smiler slots the page hides, with the entity in each.

  Hidden views were hidden (`visible` false), never faded: alpha stayed 1 on both trees.
- **RV07 (`dev/tests/s_r20rv.js`, in the suite).**  Four checks run this tree's page code and R19's in a VM.  Each fails on R19's code and
  passes on this branch's:
  - RV07a: our own death;
  - RV07b: replays, including two at once among four, and one with no id;
  - RV07c: a replay that names its killer, with a pack-mate nearer;
  - RV07d: the message, the kept id, and the Hound's and Smiler's messages unchanged.

## The suites and the gate

| run | R19 combined 2f11eae | **this branch** |
|---|---|---|
| `npm test` | 340/353 | **344/357**: the same 13 inherited failures; +4 (RV07a-d) |
| `npm run gate` (fast) | FAIL only on `port` and `bundle`: NOT RUN, the locked client packages are not in this session (`evidence/A/gate_fast_R19.txt`) | **the same two, nothing else** (`evidence/B/gate_fast.txt`): protocol, srv / bpp / cli golden, docs, lineage, contracts, scope all PASS |
| `npm run build:check` | PASS | PASS |

The first version failed the gate in two ways, and both were found and fixed:
- **The id on every kind's message** broke protocol, srv_golden and bpp_golden.  Now only a Skin-Stealer's message carries it.
- **A new window name, `__killBy`,** broke cli_golden (the page's globals at the end of each scene) and the docs' globals table.  The id is
  now kept on the Skin-Stealer script's own object (`window.__skin.killBy`).
