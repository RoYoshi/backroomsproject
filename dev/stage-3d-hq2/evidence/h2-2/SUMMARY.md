# H2-2: the explosion

An approved NEW RUN is now one server-made explosion. `STAGE_3D_HQ2_NEW_RUN_AUTHORITY.md` (section H2-2) describes the contract.

## What changed

| File | Change |
|---|---|
| `dphys.js` | A separate `Boom` kind: `createBoom` and `stepBoom` (one blast at t = 0, then the death physics' own friction, wall contacts and settling), `beginBoom` (a page's replay), `prepare`'s Boom branch (the server's run), `boomPlan` (seed and direction from the world and the event id), `DURS.Boom` 3.2 s, `CFG.Boom`. `create`, `stepOnce`, `begin` and `prepare` branch off for `Boom` before any of the old code |
| `death_srv.js` | `boomFx` (the replay message), `boomBegin` (the server's run), `durOf` for Boom |
| `server.js` | `boomStart` opens the explosion's aftermath in the same step as the approval. The replay goes to everyone, the player included, a late joiner with `el`; the corpse is placed at the end. Death replays carry `w` too. `killerEnd` only for a hound; an admin revive never touches an explosion |
| `mp.js` | The `boom` replay through the bundle's death class with no attacker (the player's own page too). The light (`replayLights`), the wall stains (`wallStains`) and the light's clock anchor (`pendSt`) treat a blast like a death. The run menu says "YOU BLEW YOURSELF UP" after an approval |
| `ents.js` (from `dev/ents_src`) | `deathPlan` for a blast: no knock, drag or blows; the server's seed and direction. `boomVoice`: one placed blast sound |
| `assets/index-DKbV5Nv9.js` (`apply_bundle.py`) | `Xok` also puts the player's own light out (`au=!1`): the blast took it; the dropped light is the replay's |

## Results

**Protocol** (`proto/nr_all`): 43/43 checks pass: H2-1's 26 again, and H2-2's:
- **`nr_boom`**:
  - Alice, Bob and a late joiner each get exactly one boom replay of the same event: id, world, seed, direction and place. The place is where the server held her. The late joiner's carries `el` 1.05 s.
  - The light profile is there.
  - One identical `c:'Boom'` corpse is on every screen, with the event id and `lf` with its release.
  - Bob is not moved, corrected, hurt or killed. No death message is sent.
- **`nr_boom_lights`**: a light that was OFF, and a camcorder, carry no light profile.
- **`nr_boom_reset`**: a world reset 0.6 s into a blast means its corpse never appears.
- **`nr_boom_again`** (E07):
  - a second blast after the real 30 s cooldown replaces the first's corpse;
  - her next natural death replaces that;
  - a world reset clears it.

**Browser** (`browser/`, three pages: Alice the initiator in front of a lit papered wall, Bob watching, Carol opening the game after the blast): 7/7 checks pass in each of four runs (flashlight, lantern, headlamp, light off).
- **E01**: one blast event on Alice's and Bob's pages and one Boom corpse with the event id. Alice's run menu appears 1.17–1.74 s after her page got the approval (the 0.8 s beat on these slow pages).
- **E06**: every sampled frame of every page's replay is exactly the server's own run of that blast after the same number of 240 Hz steps (`boom_ref.js`): body, both hands, light and hat, worst difference 0.0 px. The server's corpse is where that run ends.
- **W**: the blast threw the body at the wall. The face was chosen from the server's blast direction. There is a wall mark in every replay and the HQ1 wallpaper stain on every screen, on the same face. The late joiner's stain comes from the corpse record.
- **E03**: the light as each page's own lighting computed it (mp.js's frame log):
  - full power through the hold (lf hold 3.1 / 6.4 / 4.3 s);
  - flickering in the fade;
  - exactly 0 after hold + fade, on all three pages;
  - release anchors within 8–52 ms of each other.

  With the light OFF: no light, ever, on any page.
- **Sound**: the blast is heard once on Alice's and Bob's pages, where it happened, and never by the late joiner.

Screenshots: `browser/shots_*/` (Bob during the blast, the corpse on Bob's and Carol's screens, Alice's run menu, after the light's failure).

**E02 in the browser again** (`browser/nr_e02.json`): 7/7 pass.

**Physics**:
- `death_equiv.json`: Hound A–D and Smiler A–D, 384 runs from 12 places × 4 facings with speeds, exhaustion, every light and hat, are identical number for number to HQ1's (body, remains, attacker, blows, every event and traced position). So are 800 light profiles.
- `boom_geo.json`: 400 blasts, half on open floor and half hugging a wall, every facing, light and hat:
  - all numbers are finite;
  - blood is never inside a solid;
  - body, hands, light and hat rest out of every wall;
  - every blast sleeps before its corpse is made (the latest at 2.87 s, hence the 3.2 s length);
  - wall marks only on faces with floor in front, at most three;
  - the light is released at the blast.

  Bodies fly 1–107 px (median 64); 94 of 400 strike a wall; the server's run costs 1.7 ms per blast.

**Older suites**:
- `phys_matrix`: all eight variants asleep, nothing moves after.
- `gore_geo` (strict): 0 of 2.25 M + 2.81 M points on anything solid.
- `light_power` 8/8, `light_net` 8/8, `phys_test` pass.
- `death_net` 15/16: N9, the expected H2-1 protocol delta.

## Attempts kept

- `attempts/proto_e02_counted_the_blast_corpse/`: the first run of the protocol suite here.
  - E02's "the refused presses sent nothing to the spectator" counted the approved NEW RUN's own blast corpse (made 3.2 s later, during the cooldown) as traffic from the refused presses.
  - The check now accepts only that event's own corpse, and nothing else.
- `browser/nr_e02.first_measure.json`: the browser E02 run's first measurement.
  - It expected the remaining wait from Alice's page's receipt of the approval, which this slow page got 0.71 s after the server approved.
  - The expectation now runs from the server's approval, as the quiet observer saw it. The same run was re-measured (`--reanalyse`), with no new data.
