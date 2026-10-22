# R14 — the Skin-Stealer's body, drawn for the top-down camera

> **Visual approval pending.** This is interim procedural art made for the owner's Human QA. A passing geometry test, a screenshot or a
> contact sheet is not artistic acceptance. The owner chooses the silhouette and the scale after seeing it live. Trial 3 is **not
> owner-approved**.

Checkpoint R14 of the R9–R17 overhaul (`trial-3-r9-cognitive-ambush-overhaul`). It changes **drawing only**: the client modules
`src/frameworks/br-r/client/skin.body.js` and `skin.kill.js`. The server's body (radius 24, clearance 21), its reach (grab 46 px; pounce
55–185 px at 430 px/s for 0.36 s), its routes, its senses and every outcome are R8's (`s_skinbody` S01, `s_skinpredator` PR23). The disguise
is still the page's own Wanderer avatar at a Wanderer's size.

## 1. What was wrong (R8)

R8's figure was a frontal, standing human figure laid flat on the floor: head at one end, feet at the other, arms out to the sides,
enlarged 1.3×. Seen from straight above, which is the game's camera, that reads as a body lying down or as a squatting frog, not as a tall
creature standing in the room (`evidence/r9/gallery/r8_gallery_sheet.png`). Its "crouch" shortened the figure and its "pounce" raised the
arms over the head.

## 2. The top-down anatomical plan

The body is now a **skeleton in three dimensions** (`rig()`: x = its right, y = behind it, z = up; floor at z 0), posed from what the server
says and projected straight down. All units below are the view's own; on the floor they are × `BODY_SCALE` 1.3 (the one scale; not changed).
A Wanderer is a 36 px circle, about 1.75 m tall (about 140 px at the same 80 px/m).

| Part | Plan (from above) | Size |
|---|---|---|
| skull | a small narrow oval at the front, held **forward of the shoulders** on a long neck (a stoop); crown catching the light, sparse dark hair trailing back, ears at its sides, a heavy brow and deep eyes at its front edge (its facing reads at a glance); seen nearer end-on when it looks down; the jaw opens only to strike, bite or feed | 13 × 17 |
| neck | long and thin, thrust forward; two tendons | 16 |
| shoulders | a wide, bony line (clavicles, knobs over the arms) | 38 across (49 px; 1.3× a Wanderer) |
| trunk | five sections from hips to shoulders (half-width, half-depth): hips 8.2/5.6, waist 6/4.3, ribs 10/6.4, chest 14.8/6.4, shoulders 18/4.8. From above a section shows its depth less the more the spine leans, so **upright it is a shoulder line; stooped, prowling or running its long back appears**: spine and its knuckles, ribs under the skin, shoulder blades, loose skin at the flanks; lit from above (the back paler than the flanks) | torso 46 |
| arms | very long (upper 33, forearm 35, fingers 13): hanging, the fingertips reach its knees; seen from above a hanging arm is short (it points at the floor) — the long arms show only when they swing, reach, rest on the floor or draw back | 81 to the fingertips |
| hands | a narrow palm and three long fingers, foreshortened as they point; flat on the floor when it prowls or feeds | — |
| hips, legs, feet | under the trunk; knees forward (never splayed out); long narrow feet; the stride of a figure half again a Wanderer's height | legs 81 |
| shadow | a soft patch under it, pushed a few px away from the strongest light, as dark as that light is strong; never past its own reach plus 10 px, never pushed toward a near wall (so a corner never shows a shadow its body does not); a contact mark under each planted foot | — |

Its height: straightened, 208 px (2.6 m, 1.49× a Wanderer); stooped as it usually stands, its crown is at 166 px. Height is never drawn as
a perspective trick. It shows in the proportions, the stoop, the reach, the stride and the short shadow (pack 05 §7).

The drawn figure is **centred on its server position** between the front of its skull and the back of its hips, so a stooped creature
does not lean its head out of a corner it stands behind.

## 3. Heading, facing and motion are three things

- **Heading** is the server's angle, which turns the whole view.
- **Facing** is the server's head turn (`o.head`), which turns the skull on the neck while the body holds (G03: listening at ±0.8 rad, the
  skull turns 0.800 and the trunk does not move).
- **Motion** is the real velocity in its own frame. Feet step the way it moves: forward walking, backward when it backs away facing you
  (the feint), sideways in a sidestep. The stride grows with its real speed (2.6× from a stalk at 90 to a run at 255), and the lean grows
  with it. Standing still, its feet do not move (M01). A sharp stop sits it back on its heels for a moment (brake).

Nothing in the pose is invented. The act, speed and head come from the server, and the random tics and the hair are seeded by the
entity's id, so two pages draw the same body frame for frame (D01: 600 frames, 0 differing).

## 4. Pose state map (the server's act → what the body does)

| Act (server) | Lean | Hips up (px) | Hands | Reads as |
|---|---|---|---|---|
| (roam), `watch`, `mimic` | 25–27° | 95–96 | hanging at its sides, a little ahead | a tall stooped figure watching; head turns with its look; slow head-tilt tics when still (seeded) |
| `pace` (an open approach) | 20° | 99 | swinging with the stride | upright and deliberate: it is coming, openly |
| `back` (a feint, a withdrawal) | ~25° | ~92 | hanging | facing you, stepping backward |
| `listen` | 29° | 77 | low, near the floor | half crouched, still; the head held exactly where the server listens |
| `search`, `approach` | 39° | 77 | trailing to the floor | prowling, low |
| `creep` | 43° | 71 | on the floor ahead, stepping with its feet | a low, long prowl, knuckles down |
| `intercept`, `chase` (a run, covered or not) | 50–58° | 87 | bent, pumping along its flanks | a long body leaning into a 2.4 m stride |
| `wait` (ambush, interception wait), `lure` | 28–33° | 55–69 | coiled: tucked under its shoulders | compact and coiled, head drawn in; within 37 px of its centre |
| `wind` (its tell before a spring) | 53° | 51 | drawn back along its flanks | the coil before the spring, a full crouch |
| `pounce` | 62° | 75 | reaching ahead, low | stretched in the leap, one leg driving behind |
| `recover` | 34° | 77 | down and back for balance | regaining itself after a miss |
| `feed` | 64° | 60 | on the floor at the body; the jaw working | bent over its kill |
| disguised (`dg`) | — | — | — | the page's Wanderer avatar; putting it on, the body folds into it (about a quarter of a second); dropping it to strike or run, the body is out within about a tenth of a second (G05: 67 ms to 90 %) |
| kill A / B / C (our own death, a replay) | from the death's physics | — | at the victim's neck, as far ahead as the victim really is in the death's physics and as high as the neck then is (standing, falling, on the floor) | A: a grip, then the snap; B: the leap in, the pin; C: held, the jaw at each bite |
| kill D (proposed, R15) | — | — | — | not in R14 |

## 5. Images

Every image is in `evidence/r14/`.

- **Before and after**, the same scene, camera, floor and lamp light, with the page's own player at the left. R8 is on the left, R14 on
  the right: `r8_vs_r14_sheet.jpg` (standing, prowling, the coiled wait, the wind-up and the pounce; eight headings each), and the
  approach `r8_vs_r14_approach.jpg`.
- **Eight directions**: `lineup_r14.jpg` shows 12 acts × 0°, 45° … 315° beside a Wanderer, made by the page's own script with the drawing
  recorded (`tools/art_lab.js`). The game's real page shows the same eight headings in `gallery/` (11 acts; the fast run leaves the frame before its shot).
- **Places on the real page** (`places_r14.jpg`, and `places_r8.jpg` for comparison):
  - against a wall;
  - in a 96 px passage;
  - in the dark with the torch off, then with the torch on it;
  - at a lamp's edge (one figure past the sight mask is not drawn at all);
  - in a borrowed skin beside the undisguised body.
- **The edge of the view** (`edge_r14.png`, `edge_r8.png`): a figure waiting coiled at a sight-mask corner, facing the open side, with its
  centre 12, 24, 36 and 48 px behind the edge. Each case is shot with the figure and without it.
- **Deaths A, B and C** as the victim and a spectator see them: `deaths_r14_A.jpg`, `_B.jpg` and `_C.jpg`, at 0.3, 0.8, 1.5 and 4.5 s (from
  0.8 s on, the victim's own screen is the game's death card; the spectator's torch was not yet aimed at the victim in this run — R15's
  gallery aims it).

## 6. Collision, occlusion and sorting audit

- **Server unchanged.** S01 and PR23 cover the radius, the clearance, the grab, the pounce and the single scale. The drawn limbs may
  extend past the 24 px body only visually. A kill is still body against body with nothing solid between (R13 C27; `s_skinpredator`).
- **Sorting.** The body is in the creatures layer as before, under the sight mask and the darkness. The skull is the highest part and is
  drawn last, then the trunk, then the arms and legs under it, then the shadow under everything. The ceiling lamps' fittings are still
  drawn above it.
- **Walls.** The sight mask clips everything the page cannot see, so a limb or shadow past a wall face is never shown. The shadow is never
  pushed toward a wall within about 30 px (G04).
- **Still and hidden.** In every still act, everything drawn lies within 40 px of its centre: 37–40 px (G04). The edge test on the real page
  counts the pixels that change when the figure is added:

  | Centre behind the edge | R8 | R14 |
  |---|---|---|
  | 12 px | 361 px | 474 px |
  | 24 px | 140 px | 215 px |
  | 36 px | 14 px | 0 px |
  | 48 px | 0 px | 0 px |

  The server counts a body as hidden when its centre and a point 18 px to either side are out of view. Between 18 and about 30 px behind
  an edge, a hand or the head of a coiled figure can therefore show, as R8's could. From 36 px on, R14 shows nothing; R8 still showed a
  little. This is reported, not solved. The fix belongs to the server's own hidden test (a wider body margin for its waiting spots) and is
  listed for R16.

## 7. Cost

- **Shapes.** 55–56 fills and strokes a frame per creature, the same as R8's figure (about 55). Strokes that share a style share one path,
  and the trunk is one outline.
- **Still creatures are not redrawn.** A still figure's Graphics keep their shapes while what they would draw is unchanged; only the
  head's turn, a property, moves.
- **Node** (the page's script with recording stand-ins, four creatures moving): R8 0.24 ms a frame, R14 0.82 ms (median of six alternating rounds: the skeleton's own math - about 15 µs a creature for the rig - and more path segments; the same number of shapes: 220 against 228).
- **Real page** (SwiftShader, a CPU renderer, so absolute numbers are the slow case; four figures moving and posing for 6 s; the time
  `draw()` takes a frame; runs alternated between the two trees): R8 0.88, 0.81 and 0.76 ms; R14 0.95, 1.16 and 0.92 ms (the 1.16 overlapped a Node measurement) - about 0.1–0.3 ms a frame more for four creatures, the page's frames a second the same within SwiftShader's noise (4.3–5.3). `evidence/r14/draw_cost_r14.txt`.
- **The server's cost is unchanged** (no server file changed).

## 8. Consistency

- **Two pages, the same body:** D01.
- **The victim and a spectator see the same kill:** `deaths_r14_*.png`. The attacker is posed from the death's own physics on every screen.
  The mirrored creature is hidden while its kill plays (R8's rule, unchanged), so it is never drawn twice.
- **Late joiners and replays** use the same pose code (`attacker()` → `attackPose`).

## 9. Known limitations

- The art is interim, procedural and unapproved. No supplied portrait or asset was used: the owner's reference image (a tall pale figure
  in a doorway) is not in the pack, and only its mood was followed. Nothing was imported.
- A coiled figure 18–30 px behind the edge of a view can show a hand or its head (section 6).
- The pounce is long (up to ~180 px, its whole length stretched in the leap) for about a third of a second.
- From straight above, height cannot be seen directly. It is suggested by proportion, stoop, stride, reach and shadow, and the owner may
  judge that not enough.
- The browser numbers come from SwiftShader on a shared machine. The owner's GPU will differ.
- Kill D ("the Rend") is R15.

## 10. Tests

- `dev/tests/s_skinbody.js`, new and in `run.js`: G01, G02, G03, M01, G04, G05, G06, K01, D01, P01, S01 — 11/11.
- `s_skinpredator.js` PR23 is adapted. Its proxy for "one source of the drawing scale" counted the mentions of `BODY_SCALE`, and R14
  uses the constant in more places (the stride in floor px, the shadow's reach, a kill's grip, the skin's fold). PR23 now checks the
  invariant itself: exactly one definition, and no view scaled by a number of its own. Everything else in PR23 is unchanged.

With R14: `s_skinbody` 11/11, `s_skinstealer` 34/34, `s_skinbehave` 19/19, `s_skinpredator` 30/30, `s_skinsight` 9/9, `s_skinmind` 15/15,
`s_skinroute` 15/15, `s_skinr9` 1/1; Human QA hotfix 5/6 (X03 inherited); `npm test` 283/296 — the same 13 inherited failures as R8 and
R10–R13 (`evidence/r14/tests/`).
