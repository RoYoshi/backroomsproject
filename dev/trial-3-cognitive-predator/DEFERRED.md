# Trial 3 cognitive predator refinement — deferred, owner decisions and known limits

Nothing here is approved. Each item says why it was not done here, and what would be needed.

## Owner decisions (the evidence cannot make them)

| Item | What the evidence shows | The choice |
|---|---|---|
| **How deadly .45–.65 should be** | real pages, pooled over every valid pass (`CHECKPOINTS.md` C7b): far more kills than R8, each a spring with its whole wind-up at somebody in sight or a grab in reach; scripted pages never dodge | keep; or lower `SK.openRush`, lengthen `SK.openBeat`, raise `SK.boldAt` |
| **How long a stare-down lasts** | a watcher who never looks away: it stands off at most about 8 s at a time, may go round them or move once, then goes at 14–29 s (C22); R8 left at 7–17 s; starving, it presses in and springs | keep; or allow more renewals (`SK.standAgain`), or none |
| **A runner who stops far off after a lost race** (the review's F7) | 3 s on the trail (R8: 13 s) means it sees again a runner who stops 1400 px on in 4 of 6 runs (R8: at least 5 of 6) - PR20 is judged on the runs where it did | keep the short trail (the pack's "not a resigned slow follower"), or lengthen `SK.trailFor` |
| **Two people together are never sprung at** | a pair within about 450 px is never sprung at, at any hunger - only a grab if they walk into its arms (C20; the re-check: no new immunity against R8, which also never took a pair) | keep (R8's lone-ambusher rule); or let a starving one take one of a pair |
| **The 'winded' cue** | it judges a person winded only from what every page draws: exhausted, or under 22 stamina - a faint heave, the re-check notes (about a 1.4 % pulse) | keep; or make the heave easier to see (a page change: out of this scope) |
| **The dodge window** | a step aside up to about 0.35–0.40 s after the wind-up begins escapes (the review's `exp_dodge*.js`), before network delay | R8's wind-up is a protected fairness law: unchanged here; change only on your word |
| **Reversing round the small pillar** (F6) | a reversal undoes its guess at once, but from its cut-off point its spring reaches the 175–200 px ring, so it usually catches them anyway (C06, the real pages) | accept as the pillar's geometry; or a reach rule for cut-offs (not built: no evidence what you want) |

## Known limits of the evidence

* **The tail of the server's step** (`PERFORMANCE.md`): the means are R8's, but one creature's p99 was higher in four of five matrices,
  and four with every player pressing one in three of five (within the 60 Hz budget each time). Not profiled per function; if the owner sees
  hitches with several Skin-Stealers, that is where to look first.

* **Real pages are scripted.** They press keys toward points and look where they run or at the creature; they never dodge at the tell or
  improvise. Kills and escapes there are what a careless player would get, not a skilled one. n is 2–3 tries a scene and pass; the
  documents pool every valid pass and say which tries were invalid (a setup miss, a page held up by a wall).
* **Real-page timing is coarse** (the review's F9): the pages' records come about once a second under software rendering, so sub-second
  reaction times are the simulation's (C01, C18), not shown on a page.
* **`pr_listened_then_looked`** in R8's `predator_browser.js` was not exercised in three runs (F8): its listen now ends at the next
  footstep (C04 (b)), shorter than that tool samples; in the final run it was (7 / 7). R8's tool was left as it is (it is R8's evidence);
  the simulation measures the listen (C04).
* **Trial 3's `skin_browser.js` as a whole** crashed twice on this branch's build (at t4: the victim page held when the tool clicked the
  admin unlock; at t7: no Skin-Stealer in the page's list when read) - section by section it passes (`CHECKPOINTS.md` C6b, C7b). The
  tool's robustness was not changed here (not this branch's scope).
* **The 600 s soak** exercises few of the new tactics (no stand-off or cut-off counters in its tally); C14 (four creatures, eight people,
  every new tactic, 90 s) is the stress evidence for them (F10).

## Not done (scope)

* **No pose, art or animation change**: no visibility problem was demonstrated (pack 04); `BODY_SCALE` 1.3 stays. The stand-off reads
  through R8's existing acts (still and watching; crouched and creeping; the wind-up).
* **No hunger slider** (none existed; none added) - the QA guide uses world speed and NECK BREAK as R8's did.
* **No shared engine, sensor, movement, protocol, overlay or other species change**; no Hound or OVERSEER v2 work; admin-only spawn, cap 4.
* **Inherited security issues, untouched** (as before this branch): the default admin passcode when `ADMIN_PASSCODE` is not set, and the
  admin lockout keyed on an untrusted `X-Forwarded-For`. Use your own passcode for QA.
* **Inherited test failures**, unchanged by name: npm test's 13 (P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18 memory, L9, 2F F13, 2F
  F22) and humanqa's X03 (`REGRESSION_REPORT.md`).
