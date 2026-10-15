# STAGE 3H ENGINE MODERNIZATION — HUMAN QA PENDING

**Only the owner can accept this build.** It is a candidate, not a release.

- Nothing is merged, deployed or promoted.
- `main`, the accepted B++ (`143b63f`) and the frozen Stage 3H2 (`22751bb`) are unchanged.

**What changed:** the engine's code is organized by owner (`src/`, `public/`, a build, documentation). **What must not change:** anything
a player sees, hears or feels.

The machine checks compared this build with B++ and with the frozen 3H2, and found no difference in behaviour:
- Every file the browser loads is byte-identical to 3H2's. The four that differ from B++ are 3H2's own move of two helpers out of
  `mp.js`, which the page traces show behave the same.
- Given the same 18 scripted scenarios, B++'s server and this one send the same bytes.
- The real-browser checks pass, and 23 images of three contact-lab scenes match B++'s pixel for pixel.

`docs/architecture/PARITY_MATRIX.md` lists what those checks cover and what only a person can judge. This checklist is that second part.

## Set up an A/B comparison

1. **The candidate.**
   - Get it from the branch `stage-3h-engine-modernization` at the commit named in the delivery, or from the ZIP.
   - Run `ADMIN_PASSCODE=<a test passcode of yours> node server.js 8000` and open `http://localhost:8000`.
2. **B++, beside it.**
   - Run `git worktree add ../bpp 143b63ff42b88c6780c5043e0f61d64100f81f40` (or download that commit from GitHub).
   - Then `cd ../bpp && ADMIN_PASSCODE=<the same> node server.js 8001`.
   - Never mix files from the two folders.
3. **Run each scene twice:** B++ first, then the candidate, on the same machine, browser, window size and graphics setting. Use
   headphones and a real GPU if you can.
4. **Note** the machine, the browser, the devicePixelRatio (1.0 or 1.25), the graphics tier and the number of players.
5. **Settings do not carry over.** They are saved per address, and port 8000 is a different address from 8001. Set the same options
   on both.

## Checklist

- [ ] **Boot and menus.** The logo, the menu and its music start as on B++. Keybinds, appearance, settings and the credits all work.
      Reload the page: your settings are still there.
- [ ] **Level 0 and light.**
  - Walls, floors, lamps and props look the same.
  - The flashlight, lamps, corners and pillars light and shadow the same.
  - Where no light reaches, nothing is visible.
  - Blackouts, night vision and IR on the camcorder look the same.
- [ ] **Movement.** Walk, run, crouch, crawl, slide, vault, stamina and camera feel the same. On a phone: the thumbstick, and the
      installed app (PWA).
- [ ] **Two players.**
  - Poses are smooth.
  - Players block each other head-on and in a doorway, and slide past at the shoulder.
  - If you can, test with 150 ms of lag.
- [ ] **NEW RUN.**
  - One press gives one approved, instant gib.
  - The fragments, the corpse, the blood, the gear and the dying light match on both screens.
  - A second press within 30 s is refused, with its words.
  - The admin's UNLIMITED NEW RUN still works.
- [ ] **Hounds and Smilers.** Each one captures and kills as on B++. A normal death plays as horror, not as a NEW RUN. Respawn
      follows the usual rules.
- [ ] **Bodies.** A third player who joins late sees the earlier bodies. An admin world reset during a death clears the replays and
      lights everywhere.
- [ ] **Sound, on headphones.**
  - The hum's position and distance, the crackles of a flickering fixture, and the blackout's silence and return are as on B++.
  - The dread, the heartbeat, the deaths, the steps and the voices are as on B++.
- [ ] **Admin.** Unlock with your test passcode. Every tab, the death lab and the AI debug overlay work. A wrong passcode still
      counts toward the lockout.
- [ ] **Performance.** The frame rate on your machines matches B++, alone and with three or more players.
- [ ] **Developers.** In under 5 minutes, using `docs/architecture/FRAMEWORKS.md` ("Who to ask"), find where each of these lives:
      - NEW RUN is approved;
      - a Hound is drawn;
      - the AI decides;
      - BR-RoLE lights;
      - movement collides;
      - the level is defined;
      - a sound is played;
      - settings are kept.

      Also check that the root is clean, that old reports are found through `dev/archive/INDEX.md`, and that `npm run build:check`
      passes on a fresh clone.

## Verdict (the owner's only)

- **PASS / ACCEPT.** Name the commit and tree you accept. Nothing is merged automatically.
- **NEEDS CHANGES.** Record the scene, the player, the browser, the time, your sound equipment, and what differs from B++. The fix
  is made on this branch, never over an accepted checkpoint.
- **ROLL BACK.** Use B++ `143b63ff42b88c6780c5043e0f61d64100f81f40` or the frozen 3H2 `22751bbc39c91f3e54e3305638b2ef2c9dd12c68`.
  Both are untouched. Nothing is done on `main`.

## Known, and not a reason to fail this QA

These are recorded limits of the modernization. None changes what players get.

- The WebSocket session, with the passcode check, stays in `server.js` until you decide (M-023).
- The bundle's 40 post-v11 edits are traced byte for byte, but are not yet TypeScript (ADR-002).
- The npm rebuild of the recovered v11 project was not tested here (M-017).
- The carpet texture is still the placeholder (M-013).
- Eight frameworks are names with a README only.
