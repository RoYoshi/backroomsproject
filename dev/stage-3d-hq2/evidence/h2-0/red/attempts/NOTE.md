# Earlier runs of the H2-0 browser reproducers (kept)

Both ran on the accepted HQ1 parent export, like the final ones; the harness was then corrected and the run repeated.

- `nr_red_spectator_far_after_spawn/`: the first `nr_browser.py` run.
  - After NR1's SPAWN, Alice's new run started far from Bob (the game's own spawn), so Bob no longer saw her for NR2.
  - Its run-menu detector read `offsetParent`, which is null for the fixed-position run menu, so "run menu shown" was always false.
  - The rerun puts Alice back in front of Bob after each SPAWN and reads the computed style instead. The NEW RUN facts it recorded are the same: a second press inside the cooldown made a light record, a local fade and a refused join.
- `col_red_hold1.6s/`: the first `col_browser.py` run.
  - Alice held D for 1.6 s on a slow SwiftShader page and stopped 22 px past Bob, still overlapping him.
  - The rerun holds for 3.5 s at a smaller viewport; she ends 512 px past him.
