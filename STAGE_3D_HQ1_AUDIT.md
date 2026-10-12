# Stage 3D HQ1: audit, RED evidence and gates (HQ1-0)

HQ1 makes two user-requested corrections to the Stage 3D D7 candidate, and nothing else:
- **(A)** blood on the wallpaper where a body really struck a wall;
- **(B)** a dead wanderer's light holds for 3–7 s after it is released, flickers and dims for 1–2 s, then stays off.

This file is written before any change. It records the source check, what D7 does today, the RED evidence and the gates every later checkpoint must meet.

## 1. Source and branch

| | |
|---|---|
| Parent (D7) | `ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57`, tree `b226afe5cd0461d49947565d7f046d69f560cb9e`; remote `stage-3d` checked by `git ls-remote` and the GitHub API |
| Ancestry | the accepted Stage 3H0 `06949a8` is an ancestor of D7 |
| `stage-3d-hq1` | absent on GitHub before HQ1 (API: 404 Branch not found); created locally from exactly `ffe2b53` |
| Protected | `main` `7781e1a`, `stage-3d` `ffe2b53`, `stage-3h0` `06949a8` and 19 other branches, recorded in `dev/stage-3d-hq1/evidence/hq1-0/remote_heads_before_hq1.json`; `verify_remote_hq1.py` checks every one after each push |
| Pack | `THE_FAR_BACKROOMS_STAGE_3D_HQ1_WALL_BLOOD_DYING_LIGHTS_MASTER_PACK.zip`, SHA-256 `5fb10e0b…42f` (matches its `.sha256`; both uploads are the same file). Every `reference/` source file is byte-identical to the same file at `ffe2b53`. The pack is not committed |

## 2. What D7 does (read from the source at `ffe2b53`)

**Wall blood.**
- `dphys.js` records every body–wall contact as `{k:'wall', t, x, y, nx, ny, sp}`:
  - `(x, y)` is the closest point of the blocker rect, so on the wall's face line;
  - `(nx, ny)` points out of the wall.
- `dphys.marks(S)` keeps the hard ones (speed > 80 px/s, clear floor in front), merges contacts within 20 px, and returns the three fastest in time order.
- The corpse record keeps them in its blood list `bl` as seed `512 + direction` (32 steps).
- `gore.wallMark` draws them **only on the floor**: a smear at the foot of the wall and spray thrown back. Nothing is ever painted on the wall face.

**The wall receiver.** `assets/l0-remaster.js` exposes `window.__l0v.surfaces`:
- `list`, `at`, `stamp`, `remove`, `clear`, `count`, `caps`.
- Each papered wall face run is a surface `{id, side S/N/E/W, origin, u (along), up (into the wall), length, band}`. Its clip polygons are the band the art draws.
- `stamp(id, {image, w, h, u, v, scale, alpha})` draws a caller's canvas, upright on the face with its base at `(u, v)`, clipped to the band, into the room's source art. Only the chunks it touches re-bake. BR-RoLE lights it exactly as the wallpaper under it.
- Stamps survive a quality-tier rebuild.
- Caps: 12 per surface, 48 per room, 160 in all; the oldest is dropped first.
- `at()` takes the nearest face within reach and does not check which way it faces.

**Measured band** (`dev/stage-3d-hq1/probes/band_probe.py`, a stamp with a stripe every 4 px; `evidence/hq1-0/probes/band_all.png`): the part of a face the line of sight shows is about v 0–24 px on S faces and v 0–20 px on N, E and W faces (the bands are drawn 46, 23 and 27 px deep). A wall stain has to sit there to be seen.

**Dead lights.**
- `mp.js` `replayLights` (a spectator's replay) and `bodyLights` (every corpse with `lo`) push `{on: true, dead: false}` into `window.__peerLights` for as long as the replay or corpse exists: forever.
- `light.js` (`sample`) and `assets/br-role.js` (`draw`) read `__peerLights`.
- The victim's own death light is the bundle's `death.torch`: BR-RoLE's own light (`F.death`), or `drawLight` when BR-RoLE is off. Neither has a strength other than full.

**A duplicate found (victim only).** When the victim's death finishes, its local corpse record (`lo: 1`) enters `bodyLights` while the death is still active. Its death torch is then lit twice at the same place, until respawn (`dev/stage-3d-hq1/probes/victim_probe.py`; `evidence/hq1-0/probes/victim_probe.json`). The victim's screen is fading to black by then, so it was not visible. HQ1 removes it.

**Clocks.**
- A spectator's replay starts at `performance.now()/1000 − el`.
- A corpse's age is `ag`, the server's whole seconds since it was made. Every `bodies` message re-derives `born` from it, so it can jump by up to ±0.5 s.
- The Death Lab clock changes only presentation (`dphys.clock`).
- The light is released at `S.eqAt`, deterministic in the 240 Hz physics (D7 parity: victim, spectator and corpse agree within 0.6 px).
- A headlamp is never released.

## 3. RED evidence (D7, before any change)

`dev/stage-3d-hq1/evidence/hq1-0/red/`. SwiftShader at 960 × 640; remaster and BR-RoLE at their default tier here, `low`.

| Capture | What it shows |
|---|---|
| `red_houndC_S_sheet.jpg` (+ originals, `red_houndC_S.json`) | Hound C through the Death Lab into a lamp-lit south-facing wall (room 05, face `surf:room:05:wall:S:1344:5`, the lamp 83 px away). Contact at (552.4, 1344), normal (0, 1), 247 px/s. For the victim (revived, a step back), the spectator and a late joiner at +39 s: blood on the carpet and at the foot of the wall, the wallpaper above it clean. The receiver holds 0 dynamic marks |
| `red_light_houndA_flashlight_sheet.jpg` (+ originals, `.json`) | Hound A, flashlight on, blackout (lamps out). The light is released 0.62 s into the death. The spectator's lighting still gets the dead light `{on: true}` at its lens at 6.6, 26, 45, 63 and 82 s; the victim's (revived, own light off) at 15–89 s; a late joiner's at 122 s. BR-RoLE's buffer 40 px in front of the lens reads 0.82 every time |

The harness attempts that failed before these are kept (`red/ATTEMPTS.md`).

## 4. Design (what HQ1-1 and HQ1-2 will build)

### A. Wall blood

1. **Source.**
   - Live deaths (the victim's own, and every replay): `dphys.marks` of the running physics, as each contact happens.
   - Corpses: the `bl` marks of the server's corpse record. The victim's own local corpse holds the same marks.
   - No other source.
2. **Face resolution.** A contact resolves to a papered face only when all of these hold:
   - the face faces the contact normal: outward normal · contact normal ≥ 0.6;
   - the contact lies on the face line, within 4 px;
   - it is at least 6 px from either end of the run (an outer corner or a run's end is rejected);
   - the face is papered wall (`kind: 'wall'`, `material:wallpaper`). Pillars, props and floor never match.

   This is a read-only lookup over `surfaces.list()`. The receiver is not changed.
3. **The stain.**
   - A deterministic canvas: an irregular splash, a few satellite drops and thin streaks running down to the crease.
   - Dark crimson to maroon, opaque enough to read on lit wallpaper, never emissive.
   - Base at the crease; it reaches up to v ≈ 22 px, inside the band the eye sees.
   - Size grows with impact speed. The seed comes from the death id (`de`) and the contact.
   - A bounded set of images is cached (at most 36), so the receiver's texture cache stays small.
4. **Lifecycle** (one manager in `gore.js`, fed by `mp.js` a few times a second). The wanted set is recomputed from what the client already has: running deaths, replays, corpses.
   - A stain is kept while its source is wanted. Same `de` and within 8 px counts as the same impact, so the replay hands over to the corpse with no second stamp.
   - It is removed when nothing wants it any more: a new death of that player, an admin revive mid-death, a world reset, a corpse gone.
   - It is never re-stamped while it stays wanted. A face that does not resolve is remembered as such (no retry loop).
   - With the remaster off or not built, nothing is stamped (retried once it is built). The floor marks stay as D7.

### B. Dying lights

1. **Profile.** At the kill (`aftStart`) the server derives `lf = [hold, fade, seed]` from a hash of the world sequence, `de` and the light's kind:
   - `hold` 3.0–7.0 s and `fade` 1.0–2.0 s, both in 0.1 s steps;
   - `seed` 0–1023.

   It is present only when the light was on and is not a camcorder.
2. **Fields** (death-only, optional, bounded):
   - `lf` on the victim's kill record `mk` and on the replay `fx`;
   - `lf: [hold, fade, seed, rr]` on the corpse record, where `rr` = the server physics' release time minus the death's length (release relative to the corpse's creation, ≤ 0);
   - `ag` with tenths of a second.
3. **Power.** `dphys.lightPower(lf, s)`, where s is the seconds since release:
   - 1 while s < hold;
   - then a deterministic flicker (piecewise levels and short blackouts from `seed`) times an envelope falling monotonically to 0 over `fade`;
   - exactly 0 from `hold + fade` on, forever.

   Release: the physics' `eqAt` (live), `rr` (corpse), or 0 for a headlamp (the death's start).
4. **Clocks.**
   - Replay: `performance.now()/1000 − t0`, the same anchor the replay already uses (`el` for late joiners).
   - Victim: real time since its death began (taken when `__dvic` starts the death from the server's record).
   - Corpse: `ag` and `rr`.
   - The anchor of one death (`de`) is kept when the replay or the victim's death becomes the corpse, so the timeline never restarts.
   - The Death Lab slows the presentation only; the light follows real time.
   - A record without `lf` (none is expected) fails safe: off 6.5 s after it was made.
5. **Rendering.** One power value per dead light reaches everything that draws it:
   - `__peerLights` entries gain an optional `pw` 0–1 (a living light has none: 1). A light at 0 is left out;
   - `light.js` scales a peer by `pw`, and the victim's own light while dead by the same value;
   - BR-RoLE scales a peer light's weight (its field, tint and glow) by `pw`, and the victim's own death light likewise;
   - the bundle's `drawLight` (BR-RoLE off) scales the victim's death torch: one exact-text bundle edit.

   The victim's own corpse adds no second light while its death is still on screen.

## 5. Gates (fixed now, before any change)

### Wall blood (HQ1-1)

| # | Gate |
|---|---|
| W1 | Hound C in a lit corridor, faces S, N, E and W: a stain on the wallpaper band above the contact, plainly visible in the screenshots of the victim (revived), the spectator and a late joiner (+30 s or later). Measured on the zoomed crop: at least 150 blood-coloured pixels (R > 1.6 G, R > 1.6 B, R ≥ 40) inside the band box where RED has ≤ 10. No new blood-coloured pixel above the visible band (on the wall top) |
| W2 | `wall_faces` test on the real map: every sampled face centre resolves to its own face and side. These are rejected: corners (within 6 px of a run's end), oblique normals (· < 0.6), pillars, props, floor points and points off the face line. 100 % correct |
| W3 | Lifecycle: one stamp per impact through replay → corpse; the late joiner reconstructs the same stamps; a second death of the same player removes the old ones; a world reset and a mid-death admin revive leave none; ≤ 3 per corpse; idle for 10 s → the stamp count does not change |
| W4 | Floor blood unchanged: `gore_geo` 0 points on solid, the same point counts as D7 for the floor marks |
| W5 | With `?remaster=off`: no stamp, no error; floor marks as D7 |
| W6 | Cost: a stamp costs ≤ 30 ms once (SwiftShader). No per-frame stamping |

### Dying lights (HQ1-2)

| # | Gate |
|---|---|
| L1 | Unit, `lightPower` for hold 3 / 5 / 7 and fade 1 / 1.5 / 2: |
|  | – exactly 1 at drop − ε, drop + 0.1 and fade start − ε; |
|  | – within the fade, at least one blackout (0) and at least 3 distinct levels; the envelope (max over 0.1 s windows) never rises; |
|  | – ≤ 0.2 at off − ε; exactly 0 at off, off + 30 and off + 600; |
|  | – never negative or NaN; the same at every call |
| L2 | Profile over 1,000 deaths: hold within 3–7 and fade within 1–2, both covering their range; deterministic; `lf` only for a light that was on and not a camcorder |
| L3 | Protocol: `mk`, `fx` and the corpse carry `lf`. The corpse's `rr` equals the victim's and spectator's physics release minus the death's length within 1/240 s. Forged client `fx` or `b` cannot set or change it. Sizes: replay ≤ 400 B; N10's corpse sample ≤ 416 B (D7 384 + 32, documented); `perf_death_srv` ≤ 395 B per corpse (D0's limit) |
| L4 | Parity: victim, spectator and late joiner put the light's off moment within 150 ms of each other |
| L5 | After off: no `__peerLights` entry for it; BR-RoLE's buffer at the probe point equals the scene without it (blackout: 0) on every screen. `light.js` peers 0. The bundle's own path (BR-RoLE off) dark. During the hold: BR-RoLE's probe within 10 % of D7. A survivor's light at the same time unchanged |
| L6 | Lifecycle: off at death stays off; a camcorder never emits; a headlamp starts at the death's start; an admin revive mid-death leaves no light; a world reset none; a second death replaces it; reconnect and late join keep the same timeline; the Death Lab paused on the victim does not lengthen anyone's light |
| L7 | The NEW RUN (`Vanish`) record and its light unchanged |

### Whole stage (HQ1-3)

| # | Gate |
|---|---|
| R1 | D7's final regression on the HQ1 tree, as D6 ran it. Every correctness line as at D7. The five superseded old checks stay superseded (not new defects); `death_net` 16/16 with N10's documented size line |
| R2 | Non-death output identical to D7: server golden (whole tree) and client golden scenes; the only differences are the new death fields |
| R3 | Interleaved A/B against D7, whole death: idle, Hound A and Hound C each ≤ D7 × 1.07 (median of 4 pairs), Hound A's spectator included |
| R4 | 20 corpses on screen ≤ D7 × 1.10. Memory: 32-death browser soak, the server's heap after full GC ≤ D7 + 1 MB, its RSS levelling off; the browser heap slope ≤ D7 + 0.1 MB per death. Receiver stamps ≤ 3 per corpse; stain images ≤ 36 |
| R5 | All eight variants play as at D7 (film, parity < 1 px) |

A gate that is not met is reported with its evidence, never moved.
