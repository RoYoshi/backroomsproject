# THE FAR BACKROOMS — PART 2 HQA AI-01 SEARCH INTELLIGENCE REPORT

**Build:** `v23.3.5-hqa-search`  
**Base:** `v23.3.4-hqa-entity-look`

## Human-QA finding

A Hound could lose visual contact at a corner, correctly reach its last-known area, then visually/search-wise choose an unrelated direction too readily. The desired rule is:

> **Predict from evidence; never know hidden truth.**

The Hound should initially use the movement direction it legitimately observed before line of sight broke, while remaining fallible.

## Changes

### Hound lost-target route inference

`dev/ai_src/50_hound.js`

- Search state now preserves:
  - the actual last-seen point,
  - the last legitimately observed heading,
  - observed speed,
  - a small bounded route-stage counter,
  - a presentation-only search look angle.
- For the first two post-loss route hypotheses, a moving target's observed heading has stronger inertia.
- Early continuation candidates are generated from the **actual last-seen point**, rather than only from a projected estimate. This keeps the relevant corner/doorway in the reasoning frame.
- The first hypotheses avoid an immediate backwards reversal when a forward/side route exists.
- A dead end still permits reversal immediately.
- After the first couple of hypotheses, the search broadens normally.
- Failed hypotheses still reduce confidence and the existing finite search/give-up behavior remains.
- Existing habit bias remains small and bounded.

### Hound visual search behavior

The presentation-only head look now prioritizes:
1. the current search hypothesis;
2. the last observed movement heading while pausing/listening;
3. ordinary remembered/visible evidence.

This does **not** change the Hound's sensory `e.head` field or grant extra perception.

## Knowledge boundary

No current hidden player position, hidden velocity, future input, or hidden branch choice is read.

Two worlds with identical perceived evidence but different hidden player positions choose the same first search hypothesis.

The Hound can still choose the wrong branch and can still be fooled by doubling back or remaining silent.

## Tests

Targeted results from this build:

- Human-QA hotfix suite: **5/5**
  - includes new `HQA X05` directional-search / hidden-truth invariance test.
- Hound 2E/HQA: **18/18**
- Entity-look: **4/4**
- Evidence: **10/10**
- IR: **3/3**
- Lifecycle/audit: **9/9**
- Camera fairness: **12/12**
- FPS equality: **PASS** at 30/60/120/144/240/360 FPS, jittered timing, and 15 FPS catch-up.
- Hound performance benchmark: **all reported workloads OK**.
  - Search-heavy average: ~0.042–0.051 ms/step across seeds.
  - Search-heavy p99: ~0.168–0.208 ms.
- Smiler suite remains **16/17** due the already-known `SM01` statistical sampling miss (6/8 vs required threshold in this run); no Smiler code was changed here.
- Legacy chase suite still reports its known historical red assertions (`C1`, `C4`, `C5`, `C18`) whose assumptions predate the current evidence/search semantics.

A combined long regression invocation exceeded the execution window after many passing tests; individual targeted suites above were run separately where needed.

## Files changed

- `dev/ai_src/50_hound.js`
- `ai.js` (rebuilt)
- `dev/tests/s_humanqa_hotfix.js`
- `package.json`
- `PART_2_HUMAN_QA.md`
- `PART_2_HQA_AI01_SEARCH_REPORT.md` (new)

## Human QA required

The automated checks establish determinism, bounded knowledge, route bias, and regression safety. Human playtesting must still judge whether the search *looks* sensible around real corners without becoming too predictable.

Recommended test:

1. Let the Hound see you running toward a corner.
2. Break line of sight.
3. Stay silent.
4. Watch it reach the last-seen area.
5. It should first inspect a plausible continuation of your observed movement.
6. Repeat while doubling back or taking an unexpected branch; it should sometimes be wrong.

**PART 2 ENGINEERING REMEDIATION CONTINUES — HUMAN QA REQUIRED BEFORE LOCK**
