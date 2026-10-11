# Stage 3D: death authority and protocol

Since D4, the server decides the death and the server finishes it. The victim, every spectator and the server run the same physical death from the same record, and the corpse everyone sees is the server's.

## One death, step by step

1. **The kill.** `ai.js` decides it: the killer, the variant (A–D, by the original selection rules) and, for Hound C, the real wall behind the victim. `sim.js` commits it as the player's kill record `p.kill`: variant, killer kind and entity, the attacker's position and heading, the wall, and the victim's position and facing, rounded as they are sent.
2. **The event.** `server.js` `aftStart`, at the same tick through `sim → onDeath`, opens the death event:
   - a death id `de`, counting up per room;
   - the kill record completed with what the physical death also needs: the victim's speed `vx`/`vy` (rounded) and exhaustion `ex`;
   - the replay message for everyone else: `death_srv.fxFor`, from exactly the same inputs, plus `de` and `lo` (was the light on).
3. **The victim.** Its snapshot carries the record as `mk` (as before, now with `de`, `vx`, `vy`, `ex`). Its client starts the death from that record:
   - the bundle's death class asks `mp.js` `window.__dvic(K)` for the victim's position, facing, speed and exhaustion (one bundle hook);
   - `dphys.begin` measures the knock and drag limits as the server does (`walk` mode).

   The client used to start from its own unrounded position, which gave a different seed: up to 106 px apart for the dropped light. It no longer does.
4. **Everyone else.** `aftSend`, on each snapshot pass, sends the replay once to every client that has not had it yet. Usually that is the same pass that carries the victim's `mk`, so victim and spectators start together. A client that arrives during the death gets it with `el`, the seconds it has already run, and its replay starts from there.
5. **The corpse.** `aftTick`: when the death's own length has passed (`dphys.DURS`, 3.95–5.3 s), the server runs the same physical death to its end (`death_srv.bodyFor`, about 7–19 ms), then:
   - publishes the corpse with the same `de` (`putBody`: one per player, at most 24, aged by `ag` in `bodies`);
   - places the attacker where the death left it (`killerEnd`).
6. **The hand-over.** A spectator's replay ends on the frame it finishes, if the corpse of that death (`de`) has arrived; that is replay first, corpse after. The victim's own client makes its local corpse from its own run at the same moment. The server's copy of the victim's corpse stays hidden on the victim's screen while it is still dying, and its own corpse replaces it.

**Parity** (`parity3d.py`, the eight deaths at normal speed in real browsers; `evidence/d4/parity_d4.json`). Victim corpse against server corpse, and spectator replay end against server corpse:
- body ≤ 0.41 px, turn ≤ 0.0005 rad;
- light ≤ 0.68 px, hat 0, hands 0;
- blood: same count, same seeds, ≤ 0.55 px.

The residue is the server record's rounding to whole pixels and three decimals. At the parent, the dropped light differed by up to 106 px (Hound A) and spectators' replays were not compared at all.

## What a client may still say

| Message | Before 3D | Since D4 |
|---|---|---|
| `fx` `k:'death'` | relayed to everyone, with the client's own geometry | ignored: the replay is the server's |
| `fx` `k:'vanish'` (NEW RUN) | relayed after `sim.vanish` (alive, 30 s cooldown) | unchanged |
| `b` (corpse) | accepted from any dead player, any number of times, anywhere on the map; each re-broadcast every corpse | ignored: corpses are the server's |
| `b` `c:'Vanish'` (light left by a NEW RUN) | accepted from a living player at any time, anywhere | accepted from a living, active player, once per 5 s, within 64 px of its own server position, light within 48 px |
| `b.ka` (where the hound ended) | moved the hound (`killerEnd`, bounded) | ignored: the server's own run places it |

The clients no longer send `fx` death or a death `b`. `mp.js` `deathStart` is empty, and `bodyMade` reports only the NEW RUN record. That saves about 600 bytes per death.

## New fields

| Where | Field | Meaning |
|---|---|---|
| snapshot `mk` | `de`, `vx`, `vy`, `ex` | death id; the victim's speed and exhaustion as the death uses them |
| `fx` death | `de`, `lo`, `el` (late joiners only) | death id; the light was on; seconds already run |
| `fx` `k:'end'` | `id`, `de` | an admin revive undid the death: end the replay |
| `bodies` record | `de`, `ag` | the death it came from; its age in whole seconds (for its drying) |
| `bodies` record `bl` | up to 8 (was 6); seeds 512–543 | wall marks: the wall's direction in 32 steps |

**Sizes** (`death_net.js` N10):
- a replay message is 222 bytes;
- a corpse record is 384 bytes, against D0's 359 (+7 %, under the +10 % threshold).

## Edge cases

| Case | What happens |
|---|---|
| victim disconnects as it dies | replay and corpse as usual, on the server's clock (N3) |
| victim respawns before the end | the corpse still comes (N8a); its next death replaces it (N8b) |
| admin revive during the death | the others get `fx` `end`; no corpse (N6) |
| world reset during the death (admin, or a lone player starting a new world) | the event is dropped; no corpse from the old world (N7, `sim.worldSeq`) |
| late joiner during the death | the replay from where it is (`el`), then the corpse (N4) |
| late joiner afterwards | the corpse with its age, as dry as everyone else's (N5) |
| hostile or malformed messages | 400 random malformed death messages: no corpse, no death replay, the server keeps running (N11) |
| reconnect | a new connection is a new player id. The old corpse stays under the old id until it ages out or the world resets: one corpse per owner lifecycle |

## Bounds

- **Events** live 60 s after their corpse (`room.afts`). Each remembers which clients had its replay, a set no larger than the room.
- **Corpses:** at most 24 per room (`MAX_BODIES`), unchanged.
- **Cost:** one physical death on the server per death (`perf_death_srv`: median 7–19 ms, under the 25 ms wake). The parent paid 37–95 ms, and only for fallbacks.

## What did not change

- **Who decides.** `ai.js` decides kills, variants and walls, by unchanged rules. No new variant.
- **The player lifecycle:** `sim.js` respawn, leave and NEW RUN rules (the known 30 s NEW RUN mismatch is untouched).
- **Snapshot cadence and size,** apart from the four `mk` fields while dead.
- **Admin:** the passcode check and admin commands; the Death Lab works through the same path.

## Tests

| Test | Result |
|---|---|
| `dev/stage-3d/death_net.js` (N1–N12) | 16/16 pass. At the parent: 6/16 (`evidence/d4/death_net_parent.log`) |
| `dev/stage-3d/parity3d.py` | above |
| `dev/stage-3d/golden3d.js` | every difference starts in the death domain; non-death output identical, with one documented follow-on (below) |

**Superseded checks.** Five checks in the older suites assert the parent protocol: the victim's own replay and corpse are used. They now fail by design; their logs are kept in `evidence/d4/existing/`, and `death_net.js` replaces them:

| Old check | Replaced by |
|---|---|
| `audit_net` D3 | N1 |
| `audit_net2` DD2 | N1 |
| `live` L5d | N1 and N9 |
| `live` L5e | N8b |
| `live` L5f | N2b |

Every other check in those suites passes.

**The golden follow-on.** In the 3H0 scenario `deaths`, the scripted victim never reports a corpse. The parent therefore released the killing hound only 8 s after the death (its fallback). Now the server releases it at the death's end, which is when the parent released it for every real client (they reported at the end).

In that scenario the released hound goes on to kill a second scripted player at 6.5 s. The non-death output is identical up to the first hand-back (5.9 s). `golden3d.js` reports this as the one follow-on; it requires that nothing differs before the hand-back.
