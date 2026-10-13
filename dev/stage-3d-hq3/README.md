# Stage 3D HQ3 tools (development only)

HQ3 makes two changes:
- NEW RUN gibs the Wanderer: the body pops into pieces;
- the admin panel is brought up to date, with UNLIMITED NEW RUN for the admin's own player.

The fast-QA pack asks for about ten focused checks. These tools add to HQ2's (`dev/stage-3d-hq2/`), several of which are run again unchanged. None of these files is served. Every server they start uses the synthetic admin passcode.

| Tool | What it does |
|---|---|
| `verify_remote_hq3.py` | After each push: the remote branch, its commit and tree, the straight line from HQ2 `f542b7c`, every other branch where it was (`evidence/h3-0/remote_heads_before_hq3.json`) |
| `gib_check.js` | The gibs without a screen: 120 blasts all over Level 0 (5-7 pieces, valid, at rest, bounded blood and wall marks, the light) and the same record at three frame rates |
| `gib_browser.py` | Two screens and a late joiner: one blast, no whole torso anywhere, the pieces apart at once, one settled picture everywhere; screenshots with the spectator's Death Lab clock stepped (`--reanalyse`) |
| `admin_nr.js` | UNLIMITED NEW RUN on a real server: an ordinary player, a forged toggle, another player named as the target, ON (three in a row; same press number; while out of the world), one corpse, OFF, a new connection, the world reset |
| `admin_browser.py` | UNLIMITED NEW RUN in the real panel: OFF, ON only once the server answers, two NEW RUNs in a row, OFF, the refusal on the button; an ordinary player's panel; screenshots |
| `nr_free_unit.js` | UNLIMITED NEW RUN skips only the cooldown: the sim's `nrWhy`/`newRun` with and without `free` (menu, out of the world, dead, held, inside and after the 30 s); on a real server ON with an old world number (epoch), ON while dead; a gibbed corpse replaced by an ordinary death's |
| `contact_sheet.py` | The two labelled contact sheets in `evidence/h3-3/` (crops of the real screenshots) |
| `package_hq3.py` | The human-QA package: the ZIP of the final commit, its parts and checksums, and the receipt (every file the committed blob, the remote, scope, nothing of the reference audio, the packaged source runs) |
| `gib_streaks.py` | QA correction 1, the white gib streaks: the same eight explosions drawn by several `gore.js` versions (served to a real game page) at 4x; stray pixels outside everything gibs() means to draw; what differs between versions, and whether it is exactly the stray lines (`--lines`, `--reanalyse`) |
| `streak_sheet.py` | The before/after sheet in `evidence/h3-qa1/` |
