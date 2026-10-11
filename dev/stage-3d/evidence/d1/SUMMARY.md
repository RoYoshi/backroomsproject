# D1: body and hands physics (dphys.js, death_srv.js)

Changed:
- **At rest is at rest.** Once the victim sleeps, its body, hands, light and hat are frozen (velocities zeroed). Only the attacker still moves: it finishes easing off.
- **The jaw lets go** when the hound eases off (`back[0]`). The body is no longer towed at 5–6 px/s to the end.
- **Slack hands stop trembling** within about a second after the fight ends (`res[0]`).
- **The death collides in `walk` mode** on the client too, as the server does.
- **Per-tile blocker cache** for the length of one death: the same rects in the same order.
- **The server runs dphys in its own context, warmed at load** (no vm sandbox).

`phys_matrix` (690 runs, same spots and seeds as D0):

| variant | sleep median s | never slept | moved after sleep, px | body travel median, px |
|---|---|---|---|---|
| Hound A | 4.017 → 3.15 | 30 → 0 | 12.25 → 0 | 32 → 47 |
| Hound B | 4.1 → 3.217 | 59 → 0 | 2.69 → 0 | 75 → 75 |
| Hound C | 4.0 → 2.917 | 6 → 0 | 10.24 → 0 | 69 → 82 |
| Hound D | 3.517 → 2.917 | 32 → 0 | 12.18 → 0 | 16 → 30 |
| Smiler A | 4.15 → 3.7 | 46 → 0 | 2.2 → 0 | 30 → 30 |
| Smiler B | 2.533 → 2.533 | 0 → 0 | 1.36 → 0 | 1 → 1 |
| Smiler C | 4.017 → 3.35 | 46 → 0 | 2.79 → 0 | 38 → 38 |
| Smiler D | 4.017 → 3.367 | 46 → 0 | 2.79 → 0 | 32 → 32 |

Unchanged in every run:
- finite;
- identical end state at 30/60/120/240 Hz;
- no overlap deeper than 0.2 px;
- no tunnelling.

**Why Hound A, C and D travel further.** The parent's tow pulled the body back toward the retreating hound until the death ended. Now the body stays where the blows left it. Knock and drag limits, blow times, lengths, blackouts and releases are unchanged.

**Server corpse cost** (`perf_death_srv_d1.json`): median 7–11 ms per death (was 21–51), worst 9–24 ms (was 43–132).

**Golden** (`golden3d_d1.json`): every non-death output identical. Three kinds of difference remain, all expected:
- the served `dphys.js` (a changed file, still 200);
- the death simulation's geometry queries;
- where the death left the hound, which is a position-only follow-on.

**Parity** (`parity_d1.json`, victim corpse against server corpse):
- body 0–1 px, hands 0, hat 0, turn ≤ 0.06 rad;
- light 0–6 px, except Hound A at 49 px.

The remaining gap is the victim's seed: the client starts from its unrounded position and angle, the server from the kill record's rounded ones. D4 starts the victim from the kill record.

**Film**: `film/sheet_*.jpg` show parent and D1, block by block. All eight end SLEEPING; the parent ended three of them SETTLING or ACTIVE.
