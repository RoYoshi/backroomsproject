# THE FAR BACKROOMS — PART 2 HQA AI-02 SEARCH POLISH

**Version:** `23.3.6-hqa-search-polish`

## Human-QA finding

A Hound could reach the last-known/predicted point, appear to stand blankly for a noticeable beat, and only visibly look toward its next hypothesis after the pause. The pause concept was intentional, but the presentation order made the AI read as stalled rather than animal-like.

## Fix

- Preserved the brief pause/listen/sniff concept.
- Normal failed-hypothesis reassessment is now bounded to approximately **0.22–0.70 seconds**, with fresh/aggressive trails tending toward the short end.
- The visual head now favors the legitimate last-observed movement direction **immediately on arrival**, while the pause is happening.
- The sniff animation now keeps the skull anchored toward the current hypothesis and adds only a small organic nose/neck motion instead of overriding the look direction with a generic side-to-side sweep.
- Long deliberate crawl-exit watches were left alone; those are a separate intentional behavior.
- Search remains fallible. No hidden player position or hidden velocity is consulted.

## Preservation

No Hound chase speed, acceleration, normal pursuit turn rate, lunge tuning, eye-contact rules, search budget, evidence semantics, navigation, IR behavior, or shared Stage 2F intelligence architecture was changed.

## Render/host packaging

`redirect.js` is now included at project root for the legacy Render Web Service. It issues a temporary `302` to `REDIRECT_TARGET`, defaulting to the current Bloom development endpoint.

## Verification

- Human-QA targeted suite: **6/6 PASS** including new AI-02 check.
- Hound 2E/HQA: **18/18 PASS**.
- Entity look: **4/4 PASS**.
- Evidence: **10/10 PASS**.
- IR: **3/3 PASS**.
- System: **10/10 PASS**.
- Admin/commit/audit group: **18/18 PASS**.
- Camera fairness: **12/12 PASS**.
- FPS equality: **PASS** at 30/60/120/144/240/360 FPS plus jitter/catch-up cases.
- Hound performance workloads: all reported `ok:true`; search-heavy p99 stayed below 0.20 ms in the measured runs.
- Smiler regression: **16/17**, with the existing historical/statistical `SM01` light-wind-up sample miss; no Smiler code was changed in AI-02.
- `server.js` boot smoke: PASS.
- `redirect.js` syntax and redirect smoke: PASS.

## Human acceptance target

The intended read is now:

`arrive → head immediately checks expected direction → brief sniff/listen → move on`

not:

`arrive → blank freeze → eventually look → move`.

Human gameplay QA is still required before Part 2 is marked locked.
