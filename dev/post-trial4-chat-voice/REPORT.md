# THE FAR BACKROOMS — Nearby chat UX and character voices

Branch `post-trial4-chat-voice-polish`, created from the review's verified head `1a89863286d218c8b67ccc5456ee08bbf8c15066` (tree
`ddc6385c0f6d7112bfaf9dac3e40154acd4bbaed`), after confirming that neither the review branch nor any protected branch had moved.
Final checkpoint: **C5**, the commit that adds this report. A commit cannot name its own hash; C5's is in its remote receipt and the
handoff. Its game code is C4's (`f704dc6`). Checkpoints and receipts: [`CHECKPOINTS.md`](CHECKPOINTS.md), [`evidence/`](evidence/).

**Status: implementation complete — awaiting the owner's Human QA** ([`HUMAN_QA.md`](HUMAN_QA.md)). Nothing merged or deployed;
`main`, Stage 3H, B++, the Trials 1–2 branch, the closed Trial 4 branch and the review branch are untouched (every push receipt checks
them). Trial 3 not started. No microphone, no voice chat, no recorded or borrowed audio, no new dependency.

## What changed for players

1. **The chat icon (C1).** A small speech-bubble button low on the right replaces Trial 4's bottom-centre `ENTER Nearby Chat` hint
   and the touch SAY button.
   - **Desktop:** in the corner the coordinates use, lifted above them when they are on and scaled with the HUD. It stays quiet
     (dim) until hovered or focused, then "Nearby chat" appears above it. Its key sits beside it as a small key cap.
   - **Touch:** a 48 px square just above the action buttons; on a phone held sideways, on the bottom row left of LIGHT. Passing hints
     keep clear of it.
   - A click or tap opens the composer (held keys are let go). It hides whenever speaking isn't possible.
2. **A rebindable chat key (C2).** **Nearby chat** is a Settings → Controls action, Enter and keypad Enter by default, with the same
   slots, conflict Swap/Cancel and Reset as the game's keys.
   - It is the page's action, not the game's: chat.js reads it before ui.js's remapping layer, which never translates or holds it back.
     So a key opens chat only when speaking is possible, and otherwise passes on untouched.
   - Old saves keep every key. Chat gets Enter, or the first free of T, Y, U, H.
   - Enter always sends inside the composer; Esc closes it without pausing.
   - The pause screen's list and Help name the key.
3. **Typed-out bubbles (C3).** A heard line writes itself out grapheme by grapheme at the speaker's pace, pausing after commas,
   sentence ends and ellipses. The writing is bounded at 6.5 s, then held; the life is 3–10.5 s, and a line is never cut before it is
   written and held.
   - The bubble never moves or resizes while writing. A newer line replaces the last at once.
   - Reduced motion, or Settings → Display → **Typed-out speech** off, shows lines whole.
   - Screen readers hear each line once, complete.
   - Nothing about typing is sent: the server receives and checks each line whole, as before.
4. **Wanderers' voices (C4).** Short synthesized chirps follow a bubble's writing (letters, digits and emoji; never closer than
   55 ms), in the speaker's own voice.
   - **Presets:** seven original voices made with Web Audio: Classic, Soft, Deep, Electronic, Static, Hollow, Chime.
   - **Speaker:** Customize → Wanderer → **Voice** sets preset, pitch −12…+12 and speed 50–200 %, with Preview (the sample line types
     itself out with its chirps) and Reset. Saved locally; sent with each line as `v` = `{p, h, s}`, which the server checks and passes
     on. Every listener hears the speaker's voice and reads at its pace.
   - **Listener:** Settings → Sound → **Wanderer voices** and **Voice volume**, Voices in the composer's Options, the game's master
     volume and mute, and per-speaker mute (a muted speaker gets neither bubble nor voice).
   - **Limits:** at most two voices at once; quieter with distance, panned to the speaker's side; a compressed bus.
   - **Stopping:** a newer line, a mute, the speaker leaving or dying, or the run ending stops a voice at once.
   - A line from an older page speaks in the default voice. Text never waits for audio (browser autoplay rules).

## How it is built

- `chat.js` (F.R.O.N.T.): the icon, the binding, the writing schedule (`typeSchedule`), the bubbles, and placing and stopping the voices
  each frame.
- `voice.js` (F.R.O.N.T., new): the synthesis, the speaker's saved voice, the scheduler and the Customize section. It is driven by a
  40 ms timer that runs only while a voice speaks, scheduling 350 ms ahead on the audio clock. Chirps more than 100 ms late are
  dropped, never burst; about six chirps wait per voice, and all are cancelled on stop.
- `ui.js` (F.R.O.N.T.): the Controls action, the Display and Sound switches.
- `speech.js` (B++ server): the voice check.

The network carries only the line and its three small voice values. No audio travels, no per-message sound file is made, and no
library or download was added.

## Results

Every check ran in this cloud workspace: headless Chromium with SwiftShader software graphics (pages draw at about 6 frames a second)
and a fake audio device, so voices were measured, never heard. Each checkpoint was tested on its working tree before its commit, then
pushed and read back from GitHub. Mutants are deliberate breaks of the code; a check that does not fail under one is weaker than it
claims. Evidence: `evidence/c1/` … `evidence/c5/`.

### Per checkpoint

| | What ran | Result |
|---|---|---|
| C1 icon | `chat_voice_browser.js` icon section, at 1280×720, 1920×1080, a 390×844 phone and an 844×390 phone on its side; `chat_browser.js` nearby and phone sections | icon 30 of 30, 4 of 4 mutants caught; chat_browser 22 of 22 |
| C2 key | keys section; icon and keys together; chat_browser nearby | keys 15 of 15, 5 of 5 mutants; together 45 of 45; chat_browser 22 of 23, then 20 of 20 alone (one movement case walked 9 px, not 20, under frame pacing; both runs kept) |
| C3 typed-out | type section; chat_browser nearby; the chat hook's cost | type 10 of 10, 6 of 6 mutants; chat_browser 23 of 23; 0.19 ms a frame with nine bubbles typing |
| C4 voices | `chat_server.js` (units and real sockets); voice section; chat_browser nearby with voices on; `tools/voice_perf.js` | server 88 of 88, 14 of 14 mutants; voice 14 of 14 three times, 7 of 7 mutants; chat_browser 23 of 23; the voices' cost below |

Failures found and fixed along the way (each in its checkpoint's `STEPS.txt`):
- On a phone held sideways, the icon sat mid-height. It now sits on the bottom row.
- A key re-sent by the remapping layer could open chat. Only real presses count now.
- Static and Hollow were nearly silent beside the others. They were rebalanced, and the check now demands every voice within a factor of
  two of Classic's loudness.
- Most chirps were dropped as late on a busy page. The look-ahead went from 160 to 350 ms; none are late now.
- Several checks were made exact rather than timing-dependent.

### Final verification (C5)

1. **Build:** `npm run build:check` PASS (42 outputs; the manifest is what `src/` builds).
2. **Fast gate tier.**
   - **On a fresh clone of C4:** 20 of 21 steps PASS, among them chat (88 of 88, 14 of 14 mutants), session, sim, page, protocol,
     bundle and scope. **lineage FAILED:** the recorded `__api` contract did not yet list `voice.js` reading `__api.audio`.
   - **Fix:** the contract was regenerated in C5 (`api_contract.js`, `lineage_doc.js`); lineage now PASS.
   - **On a clone of the final tree:** all 21 steps PASS.
3. **Trial 1 and Trial 4, unchanged** (gate steps on the C4 clone): the title drift 11 of 11 with 8 of 8 mutants; the RGB sliders 14 of
   14 with 6 of 6 mutants.
4. **Multiplayer wire, unchanged** (the gate's `live_wire` step on the clone of the final tree): two players in real pages, through
   menus, NEW RUN, its refusal and END. PASS: every phase's messages are structurally identical to B++'s.
5. **Chat in real pages** (the gate's `chat_browser` step: lounge, nearby, phone, reduced motion, 7 mutants).
   - **On C4:** 40 of 40 cases, but only 6 of 7 mutants caught. "Mutes ignored" escaped because of the check, not the game: with
     typed-out text, it looked only at the written part of a muted speaker's line, 1.2 s in. It now reads the whole line.
   - **Trial 4's colour case also failed under two mutants.** It read the first bubble on screen only after waiting for the speaker's own
     page; on a slow page the 3 s bubble was sometimes gone by then. It now reads the colour of the bubble holding the speaker's line,
     when that bubble first appears. The check is as strict as before.
   - **Rerun of "mutes ignored" alone:** caught.
   - **The step on the final code:** PASS, 40 of 40 cases and 7 of 7 mutants caught. "Mutes ignored" now fails exactly its own
     case, and the colour case passed under every mutant.
6. **The new features in real pages** (`chat_voice_browser.js`, all four sections, on the final code): PASS, 69 of 69
   cases (icon 30, keys 15, type 10, voice 14).
   - Its 22 mutants ran at their own checkpoints and were not replayed on the final code. All 22 still apply to it unchanged (each change
     point found exactly once, as are chat_browser's 7), so the gate's `chat_voice` step can replay them.
7. **Cost** (relative numbers on a software-rendered page; a real GPU is far faster).
   - **The chat hook, per frame,** final against the review's head:

     | Bubbles | Final | Review head |
     |---|---|---|
     | none | 0.021 ms | 0.035 ms |
     | one | 0.079 ms | 0.084 ms |
     | nine, all typing | 0.22 ms | 0.13 ms |

   - **A page in a run,** in two runs with the order swapped (`t2_client_perf.js`):
     - frame rate within 0.25 fps of the review's head;
     - main-thread total 7.8 and 12.1 ms a second higher for the final, about 1 % of some 1,030 ms (the first run's range crosses zero);
     - script time within the noise (the two runs disagree on its sign).
   - **The voices** (two speakers talking without pause, voices on against off, paired): +2.5 ms of script a second (range 0 to +22),
     main-thread total −1.1 ms/s, frame rate and its 95th percentile unchanged, 21.8 chirps a second scheduled, none late.
8. **Push receipts and secret scans.** Every push was verified (the commit, its tree and parent; the protected branches unchanged; no
   other branch moved). The scan was clean before every commit and after every push.

### Not run, by design

- **The multi-hour full gate.** These full-tier steps did not run: `cli_mutants`, `bpp_checks`, `browsers`, `workflow`, `contact_lab`,
  `suites` and `perf`. They cover systems this work does not touch; the scope step confirms the runtime changes are only the declared
  files.
- **Real hardware:** no real GPU, phone, Safari, screen reader or speakers.

## Remaining risks and recommended next steps

1. **How the voices sound** cannot be judged by a headless browser with a fake audio device. The checks render every preset offline
   and prove loudness balance, no peaks, pitch and distinctness, and that live chirps are scheduled in the right voice. Whether each
   voice suits the Backrooms is the owner's call (`HUMAN_QA.md` §5). The presets are a small table in `voice.js` and are easy to retune.
2. **Real devices:** a real GPU, phones (Safari's audio-unlock rules in particular), a screen reader, and long sessions with many
   players were not tested here.
3. **Two-voice cap:** with three or more speakers, only the two newest are voiced (the others' text still writes). If crowded rooms
   are common, this could become distance-based.
4. **Inventory drawer:** the chat icon and key still work while it is open (Trial 2 behaviour; the review's L4).
5. **Reduced motion:** script-driven screen shake and light flicker still ignore it (the review's M4, unchanged here; it needs an owner
   decision).
6. **Gate cost:** the full gate gains a `chat_voice` step (about 15 minutes, plus about 75 for its mutants). Run it at the next release
   candidate.
