# Light lifecycle, first run in HQ1-3: real monster kills during the test (a harness fault)

`hq1/light_lifecycle` failed checks 1 and 2 in the regression run on `a1d9cb9`. The server log shows why: between the test's first and second
death, two deaths the test did not play happened:
- `de=2`: a real Hound B killed Alice right after the Death Lab's auto-revive stood her up, before the harness put her in god mode (the harness
  only did that after Bob's reconnect and Carol's reload);
- `de=3`: the same hound killed Bob's new player (after his reconnect, before the harness gave the new player god mode again).

That is what the checks saw. Alice's and Bob's screens show a dead light 26–27 s after death 1's end; the frame log does not record which
death a light belongs to, and the only death with a lit light in that window is Alice's second, real one (flashlight on). The second death's
check found an extra corpse (`de=3`, Bob's). Death 1's own timeline was right on every screen:
final anchors within 65.9 ms, no anchor moved later. Checks 3, 4 and 4b passed.

The same class of fault was met in HQ1-2 (`hq1-2/attempts/lifecycle_real_monster_deaths_between_steps/`); HQ1-2's final run happened to have
no monster near. The harness now:
- puts Alice in god mode and clears the monsters the moment the auto-revive stands her up (a background guard), and clears them again when Bob
  is back;
- compares every death the server made with the four the test played, and reports an unplanned one as a harness fault to repeat, never a pass.

The run is repeated on the same commit after the regression, alone (`steps.txt`, `hq1/light_lifecycle.json`).
