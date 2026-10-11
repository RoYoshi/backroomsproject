# D3: equipment and hat, settled corpses, sleeping and caching

Changed:
- **Corpse views are drawn only near the camera.** `gore.cull`, from each record's own reach (blood, gear, hat, trail), is called from one hook in the bundle's corpse loop.
- **A corpse near the camera is kept as one texture.** `cacheAsTexture` holds blood, body, gear and hat. Its 15-layer pools are no longer rasterised every frame. The texture is given back when the corpse leaves the screen and made again when it returns.
- **A physical corpse starts as the death's last frame:**
  - same pools at the same size, same wetness;
  - the blood then dries at the death's own rate to the old corpse colour (about 5 s);
  - the pool under the torso spreads over 18 s;
  - redraws only on visible steps, four checks a second, for the first 25 s.
- **Corpse age (`ag`) is sent in `bodies`.** A late joiner sees the same dry corpse (`net-wire.js` turns it into `born`).
- **Lights:**
  - while a death is replayed, spectators see the victim's light where the replayed light is (tumbling, sliding, at rest), as the victim does; it was dark for them until the corpse appeared;
  - a corpse's light shines from the lens of the dropped light (as during the death), not from the object's middle;
  - the camcorder is excluded (its IR view is its own).
- **Gear and hat** already never penetrate walls (`phys_matrix` gear overlap 0) and sleep with the body.

Bundle edits (`dev/stage-3d/apply_bundle.py`, exact text on the parent, `--check` verifies): 2 hooks.

Browser, SwiftShader (`perf_vs_d0.md`):
- **20 corpses on screen:** frame median 2,250 → 800 ms (−64 %), the same as idle.
- **20 corpses off screen:** 1,017 → 667 ms.
- **Idle and deaths:** within D0's spread, except the Hound C spectator's second round (850 ms against D0's worst 717). That window now draws the victim's light, which it did not before. D6 re-measures it with more rounds.
- **JS heap:** one sample reached 164 MB (D0's samples were 128–136). D6 measures it after forced garbage collection, in a soak.

`corpse_check.py` (victim and spectator, admin death lab):
- off screen the view is hidden and its texture released; back on screen it is drawn and cached again;
- a late joiner receives the corpse with its age (37–43 s);
- the spectator's view barely changes while the corpse dries (≤ 1.1 mean pixel change);
- the jump at the hand-over from replay to corpse still reflects the victim/spectator seed difference, which D4 removes.

Other checks:
- **golden3d:** non-death output identical. Changed served files: the bundle (2 hooks), `mp.js`, `net-wire.js`, `gore.js`, `dphys.js`; every server-only file is still 404.
- **gore_geo_test:** 0 / 0 points on something solid.
