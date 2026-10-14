# Stage 3D HQ1: performance and resources

**How to read these numbers.** Every browser number here is from SwiftShader, Chromium's software renderer, on this build machine (2 CPUs).
- Use them to compare versions on the same machine; never read them as GPU performance. No real GPU or phone was measured.
- Two software-rendered pages saturate both CPUs, so the measure is each window's frame-time median.
- Every comparison here was made against D7 (`ffe2b53`), exported and run in the same session.
- This session's machine was slower than D6's: an idle frame took about 717 ms here against 633 ms at D6. Absolute numbers from other sessions do not carry over.

All figures are from HQ1-3 on `a1d9cb9` (`dev/stage-3d-hq1/evidence/hq1-3/`, gated in `summary.json`).

## What HQ1 adds to the work

**The wall stain.**
- `mp.js` hands `gore.js` the wall contacts on screen every 0.12 s: a short list, at most 3 per death, and a lookup by death id.
- A stain is stamped once per impact, into the remaster's own wall art. Only the chunks it touches re-bake, once.
- Nothing is drawn for it per frame afterwards: it is part of the wall's texture.

**The dying light.**
- One power value per dead light per frame: a few arithmetic operations, from a profile the server sent.
- The moment the light is let go is known from the death's first frame by running the same physics 1.9 s ahead once per death. It is cached on the death.
- A light at power 0 is removed from the lighting input altogether, so a corpse whose light has died costs less than at D7, where it stayed lit forever.

**The server.**
- A hash per death for the profile, and a corpse age in tenths instead of whole seconds.
- No new per-death state: the corpse's creation time is in a `WeakMap`, as at D7.

## Result in one table

| Check | Result |
|---|---|
| R3 interleaved A/B against D7, the whole death, ≤ +7 % | **met** |
| R4 20 corpses on and off screen ≤ D7 + 10 %; idle ≤ + 7 % | **met** |
| R4 memory: heap after GC, heap slope | **met** |
| R4 memory: the server's RSS levelling off within the 32-death run | **not met, for HQ1 or for D7**, in this session; both level off within 64 deaths (below) |
| The 64-death server soak without forced GC: no new RSS peak in its last 16 deaths | **not met** by 0.5 MB (97.8 against 97.3 MB); D7 meets it, at a higher level (peak 108 MB, end 104.7) |
| Stains: ≤ 3 per corpse, ≤ 36 images, no per-frame stamping | **met**: 20 corpses at once, 60 stains, 30–35 images, 2.3–3.9 ms the dearest stamp |
| D0's absolute thresholds (from another session, kept by D6's summary) | **not met** for the Hound A and Hound C death windows, and **not by D7 either** in this session (below) |
| Network | +0.4 % bytes per client with 8 players; replay +19 B; a lit corpse +26 B |

## Browser

### Interleaved with D7 (R3)

Four pairs, run alternately (D7, HQ1, D7, HQ1, …), 2 rounds each. The median of the rounds' frame-time medians, the whole death from the kill to the corpse (D7's Hound A: 7 rounds; one round recorded no whole-death window):

| Window | D7 (ms) | HQ1 (ms) | Change |
|---|---|---|---|
| idle, victim / spectator | 858 / 787 | 775 / 767 | −9.7 % / −2.6 % |
| Hound A, victim / spectator | 983 / 967 | 896 / 883 | −8.9 % / −8.6 % |
| Hound C, victim / spectator | 771 / 792 | 787 / 775 | +2.2 % / −2.1 % |

Hound A was flagged at D7: +10.9 % on the spectator against 3H0. HQ1 adds nothing measurable to it. Against D7 it is within the line, here even faster; the same version's frame times vary by more than 10 % from one run to the next on this machine (D7's idle, victim: 1,183 ms in its first pair, 783 in its second).

**At HIGH lighting, idle and Hound A, interleaved** (3 pairs, added after the regression, `perf_ab_high/`):

| Window | D7 (ms) | HQ1 (ms) | Change |
|---|---|---|---|
| idle, victim / spectator | 750 / 767 | 750 / 742 | 0.0 % / −3.3 % |
| Hound A, victim / spectator | 867 / 858 | 854 / 854 | −1.4 % / −0.5 % |

The non-interleaved HIGH run below had shown Hound A's death window 14–20 % slower than D7 and Hound C's 38–39 % faster (medians of its 2 rounds, victim / spectator; worst rounds +10.5 % and −43 %), back to back. Interleaved, Hound A is within the line.

### Three rounds each, HQ1 and D7 (`perf_death.json`, `perf_death_parent.json`)

| Window | HQ1 median, victim / spectator | HQ1 worst | D7 median | D7 worst | D0's limit |
|---|---|---|---|---|---|
| idle | 717 / 700 | 733 | 692 / 683 | 850 | 990 |
| Hound A death | 908 / 892 | **983** | 900 / 958 | **1,150** | 972 |
| Hound C death | 742 / 783 | **817** | 775 / 800 | **858** | 788 |
| Smiler A death | 900 / 933 | 983 | 867 / 900 | 1,033 | 1,137 |
| 20 corpses on screen | 767 / 808 | 833 | 783 / 800 | 817 | 2,502 |
| 20 corpses off screen | 683 / 683 | 700 | 700 / 667 | 783 | 770 (this session's idle + 5 %, as D6 set it) |
| largest JS heap sample | | 110 MB | | 151 MB | 136 MB (D0) |

- **D0's limits were fixed in D0's session.** HQ1's Hound A and Hound C death windows are over them (983 against 972, 817 against 788). D7, in the same session, is over them by more (1,150, 858). The line is reported as not met; the comparison that the HQ1 audit fixed for HQ1 is against D7 in the same session (R3, R4), and it holds.
- **HIGH lighting, 2 rounds, not interleaved** (`perf_high/`), worst round:

  | Window | HQ1 (ms) | D7 (ms) |
  |---|---|---|
  | idle | 892 | 933 |
  | Hound A | 1,050 | 950 |
  | Hound C | 783 | 1,367 |
  | Smiler A | 917 | 975 |
  | 20 corpses on screen | 950 | 1,042 |

  Swings of this size in both directions, back to back, are the session.

## Stains (`hq1/stain_budget.json`, W6, R4)

Twenty corpses at once, each with three wall marks on its own papered face, spread over the level:
- **Stamps.** 60 stains, exactly 3 per corpse, each on the face it was put on; the receiver holds 60.
- **Time.** 24.7 ms in all to stamp them, 2.3 ms the dearest; the dearest across the run was 3.9 ms.
- **Idle.** 10 s: no new stamp, no removal. The page's frame interval was the same with the 60 stains as without them (166.6 ms; one page).
- **Replaced.** The 60 old stains were removed and 60 new ones stamped; the receiver still holds 60.
- **Cleared.** Every corpse gone: the receiver is empty.
- **Images.** At most 36 stain images can exist (12 shapes × 3 sizes); 30, then 35, were made. Each is a small canvas, 228–300 × 88 px (≤ 106 KB), so ≤ 3.4 MB if all 36 exist. They are CPU-side canvases. A stamp draws into the remaster's existing wall art: **no new GPU texture**.
- **Cost of a single stamp** (HQ1-1, in the real game): ≤ 3.7 ms on the victim's and spectator's screens, ≤ 7.5 ms on a late joiner's, once.

## Memory

| Run | HQ1 | D7, same session |
|---|---|---|
| browser soak, 16 deaths: JS heap after GC, MB per death (victim / spectator) | 0.41 / 0.15 | 0.50 / 0.30 |
| the same: display objects per death; replays left | 0 / 0; 0 | |
| 32 deaths, two browsers, the server's GC traced: heap after full collections | 6.3 → 8.0 MB | 6.3 → 8.7 MB |
| the same: the server's RSS | 118.7 → 205.9 MB, in steps of 18–27 MB | 126.5 → 222.8 MB, in steps of 20–23 MB |
| the same with 64 deaths (run afterwards, alone): the server's RSS | 128.6 → 226.2 MB; within 6 MB from death 23; the last 16 deaths 226.1–226.2 | 122.9 → 212.3 MB; within 6 MB from death 34; the last 16 210.8–212.3 |
| the same: heap after full collections | 6.3 → 8.3 MB | 6.3 → 8.3 MB |
| 48 deaths over WebSockets, forced GC after each: heap | 6.92 → 7.21 MB (+0.0057 per death) | 6.88 → 7.12 (+0.0042) |
| the same: RSS slope | +0.02 MB per death | −0.003 |
| 64 deaths, no forced GC: RSS | 67.2 → peak 97.8 (death 51) → 97.6 MB | 65 → peak 108 (death 9) → 104.7 MB |
| the same: heap in use, most | 14.5 MB | 14.5 MB |

- **No leak in the JS heap**, browser or server. The heap after each full collection ends at or below D7's (8.0 and 8.3 MB against D7's 8.7 and 8.3). With forced GC it is flat: +0.0057 MB per death against D7's +0.0042.
- **The server's resident memory grows in steps** of about 18–27 MB, HQ1 and D7 alike. In the 32-death pair HQ1's stays below D7's throughout; in the 64-death pair it is above D7's at most points, and levels off 14 MB higher.
  - In the 32-death run it had not levelled by the end, HQ1 or D7. At D6 it levelled after about 20 deaths.
  - Two gated lines record that, as not met: the 32-death run's last 8 deaths' range (D7 misses it too), and, in the 64-death server soak without forced GC, a new peak at death 51, 0.5 MB above HQ1's earlier one (D7 passes that line: its peak, 108 MB, came at death 9, and it ended at 104.7 MB, above HQ1's 97.6).

  - The 64-death soak, run afterwards for both, shows where it levels: HQ1 at about 226 MB from death 23, D7 at about 212 MB from death 34. HQ1's plateau is 14 MB higher in that pair; in the 32-death pair D7's was the higher.

  This is the D7 behaviour described in `STAGE_3D_PERFORMANCE.md`: memory outside the JS heap, most likely V8's compiler and collector threads after the server starts running physics on every death. HQ1 adds no retained state to it.

## Server

| | HQ1 | D7 |
|---|---|---|
| the whole physical death in one go (`bodyFor`), sum of the eight variants' medians | 60.2 ms | 61.4 ms |
| as the server runs it, spread over the death: the largest single tick | 0.10 ms median, 2.82 ms worst | 0.13 ms median, 1.51 ms worst (D6 reported 2.8 ms worst for this code path) |
| `bodies`, 24 corpses without a light profile | 359 B each | 359 B |
| a corpse with a light profile (`light_net` H6) | 410 B (384 without) | 384 B |
| the replay message | 225–245 B (241 B with a profile) | 222–226 B |

## Network, 8 players (`traffic8/`)

Eight WebSocket clients in one room, moving and sending their state 20 times a second, six deaths over 60 s, against D7 run the same way:

| | HQ1 | D7 |
|---|---|---|
| bytes per second per client | 35,298 | 35,159 (+0.4 %) |
| snapshot, mean | 1,768 B | 1,760 B |
| server tick, mean / most | 0.053 / 0.53 ms | 0.052 / 0.21 ms |
| server CPU over the run | 3.17 s | 3.07 s |

- Every client got every replay once and every corpse.
- Every lit light carried the same profile to everybody. The camcorder and the light that was off carried none.
- The players move on their own loops, so the snapshots differ from run to run.

## Network sizes in short

| | Change from D7 |
|---|---|
| replay (`fx`) | +19 B when the light was on (`lf`) |
| corpse record | +26 B when the light was on (`lf` with its release); `ag` with one decimal |
| kill record (`mk`) | +`lf` |
| everything else | unchanged (non-death output byte-identical in the server and client golden traces) |
