# HQ1-2: dying lights

## What changed

The full design and wire protocol are in `STAGE_3D_HQ1_DEATH_LIGHT_PROTOCOL.md`.

**`dphys.js`** (shared by the server and every page):
- `lightProfile(worldSeq, de, kind)` gives `[hold 3.0–7.0, fade 1.0–2.0, seed 0–1023]`. It is a hash, so it is deterministic. A camcorder or unknown kind gives `null`.
- `lightPower(lf, s)` returns 1 through the hold. During the failure, each 0.1 s step has a full-height moment and dips or blackouts under an envelope that only falls. It is exactly 0 from `hold + fade` on.
- `releaseOf(S)` gives the moment the death lets the light go. It is known from the death's first frame, by running the same physics ahead. A headlamp is never let go, so it gives 0, the death's start.

**`server.js`:**
- one profile per death, at the kill, only for a light the server's record has as on;
- `lf` on the victim's kill record (`mk`) and on the replay (`fx`);
- a corpse's age `ag` is now in tenths of a second, counted from the death's end.

**`death_srv.js`:** the corpse record carries `lf = [hold, fade, seed, release − death length]`.

**`assets/net-wire.js`:** the corpse's `lf` reaches the game's record.

**`mp.js`:**
- **One timeline per death id.** The anchor is the moment the light was let go, on the page's clock. It is the earliest of every piece of the server's timing the page gets:
  - the kill record's arrival;
  - the replay's arrival − `el`;
  - each corpse record's arrival − `ag`;
  - the same moments on the server's own snapshot clock, through `NET.off`.

  Each is combined with the physics' release. The anchor can only move earlier, never later.
- **Power on every dead light.**
  - Every replay and corpse light in `window.__peerLights` carries its power `pw`. At 0 it is left out.
  - `window.__deathLight.own()` is the victim's own dying light.
  - A corpse's light is skipped while its death is still playing on that screen, so there is never a second light.

**`light.js`, `assets/br-role.js`, and the bundle's own lighting** (two exact-text edits in `dev/stage-3d/apply_bundle.py`): one power scales the field, colour, glow and beam. The geometry, shadows and masks are untouched.

**Tools:**
- `contract_check3d.js`: `lf` added to the replay's optional fields.
- `cli_golden3d.js`:
  - `__deathLight` is declared;
  - dead lights are left out of the non-death view of the light list (a wanderer's own light, with `ir`, is compared as before).
- `death_net.js`: N10's size line becomes D7's 384 B + 32.

## Gates (`STAGE_3D_HQ1_AUDIT.md`)

| Gate | Result | Evidence |
|---|---|---|
| L1 unit | **Met.** 36 profiles (hold 3/5/7 × fade 1/1.5/2 × 4 seeds): <br>• full at release − ε, release + 0.1 and hold − ε; <br>• in every failure a blackout and ≥ 3 levels; <br>• the brightest moment of each 0.1 s step never rises; <br>• ≤ 0.2 just before the end; <br>• exactly 0 at the end, +30 s and +600 s; <br>• never NaN or outside 0–1. <br>Also: `releaseOf` at the first frame equals the run's own release for 192 deaths, and asking does not change the death | `light_power.json` (8/8) |
| L2 profile | **Met.** 1,000 deaths × 3 kinds: hold 41 values 3.0–7.0, fade 11 values 1.0–2.0, deterministic. A camcorder or unknown kind gives none. A light off at death has none anywhere | `light_power.json` P6; `light_net.json` H3 |
| L3 protocol | **Met.** <br>• `mk`, `fx` and the corpse carry the same profile. <br>• The corpse's release equals the server physics' own (−3.879 s flashlight and lantern, −4.5 s headlamp). <br>• Forged replays and corpses change nothing. The NEW RUN record has no `lf`. <br>• Sizes: replay 241 B; corpse 410 B (no light: 384 B), within D7's 384 + 32. <br>• `ag` in tenths. <br>• `death_net` 16/16 | `light_net.json` (8/8), `death_net.json` |
| L4 parity | **Met.** The light's end is measured against a reference: a quiet WebSocket observer of the same room on the same machine clock. Spread across victim, spectator and late joiner, and each page against the reference: <br>• flashlight: 17.5 ms; −14.1 / −12.7 / +3.4 ms <br>• lantern: 1.2 ms; −18.1 / −17.2 / −16.9 <br>• headlamp: 2.8 ms; −7.5 / −9.7 / −10.3 <br>• legacy lighting: 6.1 ms <br>• HIGH: 12.3 ms <br>This holds although the three SwiftShader pages handle messages up to 1.4 s late on this two-core machine (a probe, reported in `STAGE_3D_HQ1_REPORT.md`) | `timeline/*.json` `offMoments` |
| L5 rendering | **Met.** With the light clock frozen at 12 moments, in death and on the corpse, on every screen: <br>• full power in the hold; <br>• at and after the end: no `__peerLights` entry, BR-RoLE's buffer 0, `light.js` 0, the screen as dark as the darkest picture. <br>Every real-time frame: full through the hold and never lit after the end. <br>The hold equals D7: BR-RoLE probe 0.8211 against D7's 0.8211, buffer and screen identical. <br>A survivor's light is unchanged (a living light, lighting the floor). <br>The bundle's own lighting (`?lighting=legacy`) and HIGH, the same | `timeline/*`, `hold_vs_d7.json`, `d7_baseline/` |
| L6 lifecycle | **Met.** <br>• **Off at death:** no profile and nothing drawn on any screen, in any frame or picture. <br>• **Camcorder:** the same; no infrared from the dead camcorder. <br>• **Headlamp:** its anchor is the death's start (release 0). <br>• **Death Lab:** paused on the victim's and spectator's screens from before the death to after the light's end: every frame full through the hold, then 0 at the same moment as the unpaused late joiner. <br>• **Focus, hide, resize** (the victim's window while dying), **a dropped connection** (Bob) and **a reloaded page** (Carol): no anchor ever moves later; the three end within 71.8 ms of each other. The victim's first estimate was 140 ms late on her busy page and was corrected by the server's clock, earlier. <br>• **A second death:** its own anchor, full power in its hold on every screen, one dead light, one corpse. <br>• **A revive 0.87 s after the release:** no dead light anywhere afterwards, no corpse. <br>• **A world reset 2 s into a death:** no dead light on any screen afterwards | `timeline/houndA_camcorder*`, `houndA_flashlight_off*`, `houndA_headlamp*`, every `timeline/*.json` `observed`; `light_lifecycle.json` (4/4, 4b passed) |
| L7 NEW RUN | **Met.** The `Vanish` record has no `lf`, and its light code path is unchanged (`bodyLights` still skips `Vanish` first) | `light_net.json` H4 |

## Pictures

- `timeline/<run>_sequence_death.jpg` and `_sequence_corpse.jpg`: the frozen light clock at release + 0.5, 1.5, 3.0, hold − 0.05, hold + 0.02, ¼, ½ and ¾ of the failure, end − 0.03, end, 7.0 and end + 30 s. Each picture is labelled with its power, on every screen.
- `timeline/<run>_strip.jpg`: the failure in 0.1 s steps (spectator) — the timecoded failure sequence.
- `timeline/<run>_realtime.jpg` and `d7_baseline/d7_houndA_flashlight_realtime.jpg`: real time with no test clock.
  - **HQ1:** the same held frame is lit, then dark after the end. The corpse 30 s and more later: dark, and dark for the late joiner.
  - **D7:** the same pictures, still lit at 19–103 s.
  - On this machine one screenshot takes seconds, so a short hold (3.1 s) has often ended before the first real-time picture. The lantern (6.4 s) shows it lit on the victim's screen.

## Harness attempts (not game behaviour)

- `timeline/attempts_harness_v1/`: the first flashlight, lantern and headlamp runs.
  - Their real-time pictures were taken after stepping the Death Lab, which on this machine took ~20 s.
  - The end point was photographed exactly at the end, where the anchor's 0.1 ms print precision can leave a power of 10⁻⁶ (lantern; nothing visible: buffer 0, screen 0).
  - The harness now takes the real-time pictures at the held first frame and photographs the end 0.1 ms past it. The three were run again.
- `attempts/lifecycle_bob_lost_admin_after_reconnect/`: after Bob's connection was dropped, he came back as a new player without the test passcode. His admin revive (step 3) was refused, and he had no god mode.
- `attempts/lifecycle_real_monster_deaths_between_steps/`: real monsters killed Alice between steps, so extra deaths were counted.
- `attempts/lifecycle_late_revive_and_single_sample/` and `attempts/lifecycle_revive_and_reset_too_late/`: on these busy pages, the harness's own revive and reset (and its single sample of the second death's light) came too late. A revive after the corpse is not a mid-death revive.
- `attempts/lifecycle_checks_used_the_victims_first_estimate/`: the checks compared the others with the victim's first anchor estimate, which a busy page has late and then corrects. They now use each page's final anchor.
- `attempts/lifecycle_victim_in_god_mode_never_started_her_death/`: with the victim in god mode her page never starts the death. This is known from RED attempt 2.
- `attempts/lifecycle_revived_before_the_busy_page_showed_the_death/`: the revive, now sent by `ws_admin.js` (a WebSocket client doing nothing else) 1.5 s into the death, came before the victim's page had shown the death at all. The harness now accepts that, since it is the case under test, and takes the death id from the server's message.
- Now Bob is re-authenticated after his reconnect, Bob and Carol are in god mode, and Alice is in god mode only between her deaths. The revive and the reset are sent by `ws_admin.js`.
- Earlier smoke runs (scratch, not kept) found two design faults, which were fixed before this evidence:
  - The victim's light was timed from her death's first frame, which can be more than a second after the kill record arrives on a busy page. Fix: timed from the record's arrival, then the server-clock evidence.
  - A Death Lab paused before the release kept the light at full power until stepped. Fix: `releaseOf`.
secret_scan.json: every file changed since the Stage 3H0 parent, scanned before this commit: clean.
remote_hq1-1.json: the remote verification of HQ1-1, run after its push.
