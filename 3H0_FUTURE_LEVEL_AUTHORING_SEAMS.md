# Stage 3H0: where a future level editor would have to cut

**The design law, from the 3H0 pack.** Levels are data, not code. If a designer must edit engine code to move a wall, the level system is not finished.

**What 3H0 did about it.** It built nothing for it:
- no editor;
- no level format;
- no new geometry;
- no instance routing or level transitions;
- no multi-level API.

The game is Level 0, with its accepted data and behavior.

**What this document is.** A map of where Level 0 is wired into the code today, so that a later stage can plan the cut. It records only what was found in the code (checked at H0-5), and lists the open questions.

**About references.** Line numbers are those of the final 3H0 tree. `sim.js` line 7 and the game bundle `assets/index-DKbV5Nv9.js` are long minified lines, so they are cited by identifier.

## 1. Where Level 0 lives today

### 1.1 The map is code, in two copies

**The server's copy** is in `sim.js`:
- the grid size: `FBW=96, FBH=72` tiles of 96 px, a 9,216 × 6,912 px world;
- the region table `Oc` (12 named rooms);
- the floor mask, corridors, partition walls and doorways;
- the special cells (`Mc`, the LONG ROOM cells that block movement but not sight; `Pc`, the pillars);
- the lamps, from `WORLD.lamps(...)`;
- the spawn point `Ic = {x: 960, y: 3264}`;
- the navigation grid.

A comment in `sim.js` says this code was extracted from the bundle.

**The client's copy** is in the game bundle: the same statements. From the region table on, the first 2,172 characters are identical. The copies first differ where the bundle reads `window.WORLD` and `sim.js` reads its required `WORLD`. They differ again later, in the light-kind table and an unused marker list.

**`world.js` is the only file both sides load:**
- on the server, `require('./world.js')` from `sim.js` and `ai.js`;
- in the browser, a classic script before the bundle.

It holds the lamp generator (`W.lamps`), props and fixtures, floor surfaces (`surfaceAt`), carving helpers and movement constants. **It does not hold the map.**

### 1.2 The world size is written into the code

**`server.js`** clamps what clients send to the Level 0 world:
- `num(m.x, 0, 96 * 96)` and `num(m.y, 0, 72 * 96)` for positions;
- `9216` and `6912`, eight times each, for death replays, corpses, kill geometry, blood marks and drag trails.

**`mp.js`** writes the tile size (96) and the grid (96 × 72) in:
- the offline glitched-wall and cartograph fallbacks (lines 194-196, 217, 225-226);
- the admin spot finder (line 488).

**Elsewhere:**
- `ai.js` and `move.js` divide or multiply by 96, and `glitch.js` scales by it;
- `l0-remaster.js` falls back to 96 × 72;
- `l0-remaster.js` and `br-role.js` read the size from the carpet sprite;
- the map canvas in `index.html` is 576 × 432 (6 px per tile).

### 1.3 Regions

**`Oc` holds 12 rooms**, each `{x, y, w, h, name, code}` in tiles, from `01` YELLOW HALL to `12` DEEP CARPET. A corridor is any floor outside every room; corridors have no record of their own.

**The rooms are referred to in three ways:**
- **By index:**
  - `world.js` treats room 6 as the BLACKOUT ZONE (no lamps);
  - `move.js` treats `Oc[11]` (DEEP CARPET) as slower ground;
  - the bundle tints rooms 6-9 and 11.
- **By name:** `world.js` (lamp gaps, floor surfaces) and `br-role.js`.
- **By code:** `assets/level0_visuals.js` repeats the room table as presentation data (`room:01` … `room:12`, plus the corridors), and `l0-remaster.js` matches on code and name.

**The HUD's sector label** reads the room's code and name.

### 1.4 Navigation and line of sight

**Server:**
- the navigation grid (48 px cells) is in `sim.js`;
- `ai.js` builds its geometry (line of sight, what is visible, light level, paths) from an adapter that `sim.js` passes in;
- it caches that geometry once per process under the adapter's key, `'level0'` (`ai.js` line 97).

**Client:** the bundle has its own copy of the navigation grid and the wall tests. It exposes them through `window.__api`, which `light.js`, `camcorder.js`, `ents.js` and `br-role.js` use. `ai.js` is never served.

### 1.5 Spawns

- `sim.js` puts a joining player at `Ic`, and checks a requested spot with `spawnOk`: clear ground, away from Hounds and from visible Smilers.
- The client chooses its own spawn spot (in the bundle) and sends it as its first position.
- `server.js` accepts that position if `spawnOk` agrees (the `spawnNext` path in `onMessage`); otherwise it treats it as an ordinary move from the spawn point.

### 1.6 Items, glitched walls and the exit

**Placement.** `sim.js` places one cartograph (`makeItems`) and three glitched walls (`makeGlitches(3)`). Each must be far enough from the spawn point, and the walls far from each other and reachable. They are placed again on a world reset or by admin, and sent in each snapshot (`it`, `gw`).

**`mp.js`** mirrors them, and keeps its own offline copies of both placement rules.

**The exit:**
1. Touching a glitched wall (54 px) sets the player's exit in `sim.js`.
2. `server.js` sends `{t: 'exit', secs}` (line 292).
3. `mp.js` shows "Time in Level 0" and calls the game's win screen.
4. The win panel in `index.html` (line 149) says "YOU NO-CLIPPED OUT OF LEVEL 0 / LEVEL 1 COMING SOON". Restart is an ordinary `join`.

**No level id is sent at any step.**

### 1.7 Lighting

- **Lamps.** `W.lamps` in `world.js` is the only generator (170 lamps). `sim.js` and the bundle each call it with their own copy of the map.
- **Blackout and failing lamps.** The blackout timer lives in `sim.js` (snapshot field `b`). Failing lamps come from `ai.js` (snapshot field `lf`).
- **The dim-tube rule** (every 13th lamp) exists only in client presentation code: the bundle, `mp.js`'s hum, `br-role.js` and `l0-remaster.js`.
- **The light kinds are listed in five places:**
  - `sim.js` (`Gc`);
  - the bundle (`Gc`, with small differences);
  - `server/fields.js` (`KINDS`);
  - `ai.js` (`KIND_GLARE`, which leaves out the camcorder);
  - `inventory.js`.

### 1.8 Rendering

- **The bundle's renderer** builds the level from its own copy of the map: the carpet texture, lamp housings and the props from `world.js`.
- **Presentation data:** `assets/level0_visuals.js` (lamp count, the room table by code).
- **`l0-remaster.js`** reads the geometry from `window.__api`.

### 1.9 Audio and entities

**Audio.** No level-specific audio file exists.
- `mp.js` synthesizes the lamp hum from the nearest lamp.
- `glitch.js` plays static near glitched walls.
- `sfx.js` accepts custom sounds.

**Entities.** `sim.js` starts each world with 1-2 Hounds and 2-5 Smilers, and its director adds Hounds up to 3. Its placement rules keep them away from the spawn point, and Smilers in the dark. The bundle has its own offline Hound patrol and Smiler origins.

## 2. A possible separation (for discussion; nothing of it is built)

| Part | Would own | Today |
|---|---|---|
| **LevelDefinition** (data, versioned) | grid and tile size, floor or walls, regions (id, code, name, area, surface, flags such as "no power"), lamps (or a generator and its parameters), props, spawns, exits and where they lead, item and population rules, ambient audio, materials | spread across `sim.js`, the bundle, `world.js` and `level0_visuals.js` |
| **LevelRuntime** (server) | building navigation and sight from the definition; spawns, items, exits, population; one per room | `sim.js` and `ai.js`, with Level 0 built in |
| **LevelRenderer** (client) | the visual layers from the definition plus presentation data | the bundle's renderer, `level0_visuals.js`, `l0-remaster.js` |
| **Query adapter** | the one interface for walls, sight and paths that both sides implement from the same data | the adapter `sim.js` hands `ai.js`, and `window.__api` on the client |
| **Editor validation** | reachability from the spawn point, lamps not in doorways, regions consistent, size within what the server accepts | partly exists: `sim.js` already checks that glitched walls are reachable, and `world.js` has a test-only check that every prop stands on floor (`W.verify`) |

**What would have to change first, before any editor:**
1. **One source for the map.** Today there are two copies, which happen to agree.
2. **The world-size literals** in `server.js` and `mp.js` read from the definition.
3. **The light-kind list** in one place.

Each of these is a behavior-preserving change of its own, and fits the 3H0 gate: golden traces against the accepted parent.

## 3. What a saved definition would have to answer (questions, not a format)

- **Versioning:** a version number per definition, and a migration rule for old saves.
- **Generated or explicit:** lamps are generated today. Would a designer place each lamp, or tune a generator?
- **Keeping server and client in step:** both must build the same geometry. Should the server send a definition hash in `hi`, or the definition itself?
- **Presentation versus rules:** surfaces are both. `DEEP CARPET` slows movement and also has a look. Which file owns what?
- **Validation:** which rules block saving (unreachable spawn, a lamp in a doorway), and which only warn?
- **Transitions:** what an exit leads to, and what a player keeps across levels.

## 4. Session identity: where a level dimension would go (not added)

**Today:**
- the room name from `?room=` (cleaned, at most 24 characters) selects one simulation per room (`getRoom` in `server.js`);
- player ids come from one process-wide counter;
- `hi` is `{t: 'hi', id, sim: 1}`;
- snapshots carry no room, world or level field;
- the client learns of a new world only when the server clock jumps (`netHist` in `assets/net-interp.js`).

**A level or instance dimension would touch:**
- the room key in `getRoom`, and what `createSim` is given;
- `hi`, or a new message, to say which level a world is;
- a transition message;
- the connection URL in `mp.js`;
- the interpolation epoch (a new level is a new timeline);
- `__net.join`.

**3H0 adds none of this.** The protocol inventory is frozen, and a change to it belongs to the stage that builds levels.

## 5. Open questions for that stage

- Is a level an instance inside a room, or does each level get its own room?
- What happens to other players in the room when one player leaves the level?
- Do corpses, items and glitched walls belong to the level or to the room?
- Does the server ever run more than one level per process, and with what limits (the 25 ms wake and 60 Hz simulation are per room today)?
- Who may author levels, and does an authored level ever reach the public server (the security questions of a new upload path)?
