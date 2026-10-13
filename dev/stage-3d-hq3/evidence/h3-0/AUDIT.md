# H3-0: parent check and a short audit

## Parent (checked live, 2026-10-13)

The parent matches the pack:
- `git ls-remote` and the GitHub REST branch both give `stage-3d-hq2` at `f542b7cbd90f95148e644e6cba513cf55ddd52c9`.
- Its tree is `6730834df06b36917ec9f3b7e56f56c8ee5487de`, with parent `65a1309`.
- GitHub's compare against HQ1 `ebb3bd6` says ahead 7, behind 0, with no merges.

**`stage-3d-hq3`.** It existed on neither GitHub nor this machine. It was created at exactly `f542b7c`.

**Untouched before HQ3.** All 24 remote branches are recorded in `remote_heads_before_hq3.json`:
- `main` `7781e1a`;
- `stage-3d` `ffe2b53`;
- `stage-3d-hq1` `ebb3bd6`;
- `stage-3d-hq2` `f542b7c`;
- `stage-3h0` `06949a8`;
- every Stage 3B/3C and older branch.

`stash@{0}` (SH8 WIP) is kept.

## Where NEW RUN's Boom and the admin panel live (HQ2)

| What | Where |
|---|---|
| The decision (`nr` to `nra`), the cooldown | `server.js` `nrIntent`; `sim.js` (from `dev/sim_glue.js`) `nrWhy`, `newRun`, `NR_CD` 30 s |
| The blast event, its run and its corpse | `server.js` `boomStart` (`fx k:'boom'`, one aftermath per player); `death_srv.js` `boomFx`, `boomBegin`, `corpse` |
| The blast physics | `dphys.js` `createBoom` and `stepBoom`: the intact body thrown whole, both hands on springs, the light and the hat torn away, 4 blood bursts, wall marks from the body's wall hits |
| The replay on a screen | `mp.js` `startFx` (`k:'boom'`, the whole avatar `f.av`) and `updateFx` |
| The corpse on a screen | the bundle's corpse view (the whole avatar), `gore.js` `corpse()` (the blood), `assets/net-wire.js` `toRec` (the record) |
| The admin panel | `mp.js`, tabs PLAYERS, MONSTERS, DEATHS (the Death Lab), WORLD, DEBUG; `server.js` `adminCommand`, answers `ares`, the admin snapshot `ad` |

## The admin panel as it stands: what is out of date

1. **No personal NEW RUN anywhere in the panel.** The only "NEW RUN" is WORLD → NEW RUN FOR EVERYONE. Its confirmation ("Reset the whole world?") and its answer ("NEW RUN FOR EVERYONE") do not say it is a world reset that blows nobody up and starts nobody's cooldown. That HQ2 behaviour is easy to confuse with the personal NEW RUN.
2. **No help for HQ2's solid players.** Since HQ2, BRING and GO TO land on the nearest free spot beside the other player, not on top, and nothing in PLAYERS says so. The MENU tag now also covers a player after an approved NEW RUN.
3. **No cooldown bypass for testing.** It is requested (UNLIMITED NEW RUN).

Everything else checked works as labelled: GOD, BRING, GO TO, REVIVE, KICK, the monsters, freeze, speed, the blackout, the glitches, the cartograph, the death previews, the capture style, the Death Lab clock, debug and the broadcast. Nothing else is changed.

## Impact (planned)

**H3-1, the gibs:**
- `dphys.js` (Boom only: the breakup, the pieces' and hands' physics, the gib record);
- `death_srv.js` (the corpse carries `gs`, `gb`, `gh`);
- `assets/net-wire.js` (passes them, bounded);
- `gore.js` (draws the pieces; hides a gibbed corpse's whole avatar);
- `mp.js` (draws the pieces during the replay).

**H3-2, the admin panel:**
- `server.js` (the per-connection flag; `nrfree`; `nf` in admin snapshots; clearer world-reset answer);
- `dev/sim_glue.js` → `sim.js` (`nrWhy` and `newRun` take `free`, which skips only the cooldown);
- `mp.js` (the DEATHS section, the WORLD and PLAYERS help).

**Unchanged:** the bundle, `index.html`, `move.js`, the lighting, the AI, the eight deaths.

## Focused checks (planned, about ten)

1. Parent and branches (`verify_remote_hq3.py` after each push).
2. `gib_check.js`: the gibs without a screen (120 blasts: 5-7 pieces, valid, at rest, bounded) and the same record at 30 FPS, at 144 FPS and on a jittered page.
3. `gib_browser.py`: two screens and a late joiner.
   - The pieces from the first frame, no whole torso.
   - One blast.
   - The same settled pieces everywhere.
4. HQ2's `proto_lab.js nr_e02`: the 30 s refusal makes nothing anywhere.
5. `admin_nr.js`: UNLIMITED NEW RUN (ordinary player, forged packet, another player, ON, OFF, reconnect, world reset).
6. HQ2's `reset_epoch.py --case boom`: a world reset during a gibbing clears it everywhere.
7. HQ2's `boom_browser.py`: the light (on: HQ1's hold and fade; off: dark), the wall stain, the blast replay equal to the server's run, the sound.
8. HQ2's `death_equiv.js` against HQ2: the eight deaths number for number.
9. HQ2's `col_browser.py --case head`: two players block in a hallway.
10. One ordinary admin control returns its honest status (`admin_nr` A8 world reset; BRING in `col_*`).
