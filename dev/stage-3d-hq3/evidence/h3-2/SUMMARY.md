# H3-2: the admin panel, and UNLIMITED NEW RUN

## What changed

**UNLIMITED NEW RUN.** An admin can let their OWN NEW RUN skip the 30 s wait.
- **Where the authority lives:** `server.js`.
  - `me.nrFree` sits on the admin's own connection. It is OFF by default and goes with the connection, so a reconnect starts OFF.
  - It is set only by the admin command `{t:'a', c:'nrfree', on}`, and only after the connection has unlocked admin. The command never names another player: any `id` sent with it is ignored.
  - The server answers `{t:'nrf', on}` plus a status line, and every admin snapshot carries `nf`.
- **What it skips** (`sim.js` from `dev/sim_glue.js`). `nrIntent` passes `free = me.admin && me.nrFree` to `nrWhy` and `newRun`. With `free` only the cooldown is skipped. The world epoch, being in a run (`state`), `dead`, `held`, the duplicate press number and a press while out of the world are all still refused.
- **The panel** (`mp.js`, DEATHS tab, new section YOUR NEW RUN · INSTANT GIB).
  - The toggle and "SERVER SAYS: ON/OFF" follow `nf`/`nrf` from the server, never the click; the toggle resets to OFF when the connection closes.
  - "LAST NEW RUN" says what the server answered to the last press.
  - The help text explains both.

**Stale parts of the panel, fixed:**
- **WORLD → NEW RUN FOR EVERYONE** is now under "RUN · THE WHOLE ROOM". Its confirmation says what goes and that nobody is blown up. The server's answer says WORLD RESET FOR EVERYONE · NOBODY BLOWN UP · NO COOLDOWNS. A help line separates it from the personal NEW RUN.
- **PLAYERS** gets one help line: living wanderers are solid, and BRING/GO TO land beside the player. It also explains MENU and says the dead never block.

**H3-1's `mp.js` source layout, fixed.** The H3-1 commit's `mp.js` (built by applying only the gib hunks) had `gibFrame` declared inside `updateFx` and the `if (f.att)` guard left empty, with the attacker lines after it.
- It is valid JavaScript, and it behaved the same: every death replay has an attacker, and every NEW RUN blast takes the gib branch.
- This commit restores the intended layout: `gibFrame` at the top level, the attacker lines inside `if (f.att)`, and the avatar updated only when no gibs.

## Results (`steps.txt`)

| Check | Result |
|---|---|
| `admin_nr` (real server, raw WebSockets) | 8/8. An ordinary player gets the 30 s refusal, with no blast. A forged toggle from a non-admin gets no answer and changes nothing. ON naming another player answers only the admin and leaves the other player's cooldown. WORLD reset makes no blast and no NEW RUN answer, and leaves cooldowns as they were. ON: three NEW RUNs in a row, one blast each; the same press number is answered again with no second blast; a press while out of the world is refused (`state`). One gibbed corpse (6 pieces). OFF: the wait is back, counted from the last NEW RUN. A new connection starts OFF |
| `admin_browser` (the real panel; SwiftShader) | 4/4 on the second run. The toggle follows the server (OFF, ON in 0.8 s, OFF in 0.08 s) with the status line. Two NEW RUNs from the pause menu a few seconds apart are both approved. After OFF the button says NEW RUN · WAIT 19 S. Bob's panel is only the passcode prompt. The first run (3/4) is kept in `attempts/`: the test, not the game, left the panel closed (see `steps.txt`) |

**Screenshots** (`shots/`): OFF when unlocked, ON, the run menu after each NEW RUN, Bob's passcode prompt, OFF again, the refusal with the wait.

`remote_h3-1.json`: the remote check after the H3-1 push. `stage-3d-hq3` is at `3692bf7` on the straight line from `f542b7c`, and every other branch is where it was.
