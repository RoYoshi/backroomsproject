# N6 - Hound sound recency / urgency (evidence notes)

## The defect, as it was on the parent

- An unidentified sound (every sound from a person out of sight) became an investigation (CURIOUS: a 0.28 s orienting
  beat, then the investigation pace, 122 px/s) whatever it was: a sprint a few metres behind a resting Hound got the
  same reaction as a distant footstep (`hound_parent_sound.log` S2: never ALERT, 130 px/s at most).
- Once investigating, it **finished the hypothesis it had**: `hLightStart` returned at once while CURIOUS, so a fresh,
  close sprint could not displace an old faint step (S4: 0 % switched).
- Ranking had no notion of urgency; the lead chosen was the "best" lead overall, not the sound just heard.

## The correction (evidence tools + the Hound's existing reaction points)

- `soundUrgency(h, now)` (22_intelligence.js): intensity where the Hound is (distance already in it) x what kind of
  sound (run / slide 1, vault .95, land .9, walk .55, breath .45, crouch / crawl .3) x recency (e^-age/1.5 s) x
  confidence.  A sprint a few metres away ~0.70, the same 1.5 s later ~0.26, a far walking step ~0.04, a crouched step
  ~0.02.  `leadUrgency`: a lead keeps the urgency of its strongest sound, decaying from when it was last heard; merging a
  new sound renews it.
- In `hReact` an unidentified sound competes on **its own lead and its own urgency** (not an older lead's standing);
  state decides what it does:
  - idle / curious / searching / frustrated + urgency >= 0.45 -> **ALERT** at once (0.12-0.3 s freeze facing it), then
    it goes for the spot at a pace scaled by the urgency (up to 85 % of chase pace);
  - a Hound already rushing an urgent sound is not frozen again by its next footstep - the step refines the goal;
  - anything weaker -> the existing investigation;
  - HUNTING: never demoted by a sound (N5; a sound that fits the prey's trail updates the pursuit).
- While investigating: more of the same trail (the same lead, or a sound within its blur) eases the goal 35 % toward
  it - no restart, no snap per footstep; only a clearly more urgent sound elsewhere (> 1.5x + 0.1 of what the current
  hypothesis still carries) replaces it.  When the sounds stop, the hypothesis is checked and dropped as before.
- Sound stays evidence: blurred position, no identity, no target; seeing someone there is what starts a chase.

## Evidence

- `hound_after.log` 10/10; parent (`hound_parent_sound.log`, sound cases): S1 pass, **S2 fail, S4 fail**, S5, S6 pass.
  - S1 idle + distant quiet step: no ALERT (0/12), walks to look at 122 px/s; urgency 0.08.
  - S2 idle + sprint 140 px behind in the dark: ALERT within 0.02-0.12 s (one went straight into a chase), at the spot
    in 0.6-1.0 s, 196 px/s on average (parent: CURIOUS, never ALERT, 130 px/s).
  - S3 = N5's B3 (chase + LOS lost + recent running: followed by ear, never CURIOUS).
  - S4 stale faint step vs a fresh sprint elsewhere: 100 % switch to the sprint (parent 0 %).
  - S5 a runner's 12 steps at 420 px: 0 hypothesis switches, goal moves <= 95 px per tick (eased).
  - S6 silence: back to roaming in 1.8-8.8 s; lead urgency 0.51 -> 0.
- `test_3bn.js` N6 4/4: urgency and decay values; the state rules; the one-hypothesis easing / replacement rule.
- Full suite `npm_test_n6.log`: 151/162, the parent's count, with the same differences as N5 (now passing C1, SM01;
  now failing C9/C10 - see N5 - and SM17, whose one new strike replays identically on the parent: `sm17_replay.txt`).
  H07 ("every state reached by emergent play") still misses ALERT, as on the parent: its emergent run has no sprint
  close behind an idle Hound; S2 shows the new ALERT path.
