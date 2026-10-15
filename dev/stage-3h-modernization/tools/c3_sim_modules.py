#!/usr/bin/env python3
"""Stage 3H continuation (C3a, M-024) - the sim's parts made into modules: one factory per owner, given what it uses (development only).

  python3 -I -B dev/stage-3h-modernization/tools/c3_sim_modules.py --apply    write the modules and the composition from M8's parts (read
                                                                              from Git), and remove the parts' output and the two core parts
  python3 -I -B dev/stage-3h-modernization/tools/c3_sim_modules.py --check    rebuild every module from M8's parts (read from Git) and
                                                                              compare with the working tree
  python3 -I -B dev/stage-3h-modernization/tools/c3_sim_modules.py --report FILE.txt   (with --check) every module: which lines of which
                                                                              part it holds, and every line that is not a part's verbatim

Until M8 the sim was one function, createSim, assembled from eleven parts that shared its closure (generated/server/sim.js; the parts
in src/, each with a header listing what it provided to the others, used of theirs and wrote of theirs: 134 uses and 18 writes across
owners).  From C3a each owner's code is a module: a factory that is given what it uses (its parameters, named per owner) and returns
what it gives (its return object).  State lives in one owner's factory only; another owner changes it only through a function that owner
returns (no write into another owner's binding), and reads a value that changes through a function too, so nothing is copied stale.
src/core/server/sim.js is the composition: it makes the modules in the order the one function ran (the level, then the seed and the AI
engine, then the plain declarations, then the first world reset) and returns the same object, key for key.

Every line of a module is a part's line, verbatim (comments and indentation included), except the lines this tool lists: each module's
header comment, its 'use strict', its factory's first line, its return and closing lines, and the EDITS below, each a whole text found
exactly once.  What moved between owners: the world's shared state that sim.ai.js declared "at the top of the glue" (the roster to the
composition; PR, frozen, speed, bmode, runT, spawnT and worldSeq to the run, core's sim.step.js; debugOn to the admin); the world reset
from S.P.A.C.E.'s lines to the run (it calls each owner's own reset, in the order it always did); the cartograph (items, makeItems,
takeItem) to P.O.C.K.E.T.'s own module; navCmd and killerEnd, which sat among G.I.B.'s lines, to N.A.N.I.'s.  sim.header.js and
sim.glue.js become the composition; generated/server/sim.js is no longer built."""
import argparse, hashlib, os, subprocess, sys
ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--apply', action='store_true'); g.add_argument('--check', action='store_true')
ap.add_argument('--report'); A = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
M8 = 'c34f0c22bbacc5ac2813d173bc0591b67af7169f'
blob_id = lambda b: hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
F = 'src/frameworks'
PARTS = {   # the parts at M8 (unchanged since M3), with their Git blob ids
  'header': ('src/core/server/sim.header.js', 'ae3f9ff44856'), 'level0': (f'{F}/lost/server/sim.level0.js', '0d213e31e304'),
  'ai': (f'{F}/nani/server/sim.ai.js', '6436a90f5d7a'), 'glitches': (f'{F}/lost/server/sim.glitches.js', 'd2154f40e15c'),
  'bodies': (f'{F}/gib/server/sim.bodies.js', '35705c3333e2'), 'players': (f'{F}/space/server/sim.players.js', '2f328155c35f'),
  'movement': (f'{F}/space/server/sim.movement.js', '77521f853523'), 'feed': (f'{F}/nani/server/sim.feed.js', '9a644b1a9a63'),
  'step': ('src/core/server/sim.step.js', 'e6e81deb6f83'), 'admin': (f'{F}/overseer/server/sim.admin.js', 'a8d6e8fc0bb1'),
  'glue': ('src/core/server/sim.glue.js', '347b9b2aa2ae')}
TEXT = {}
for k, (p, b) in PARTS.items():
    raw = subprocess.run(['git', '-C', REPO, 'show', f'{M8}:{p}'], capture_output=True, check=True).stdout
    if not blob_id(raw).startswith(b): sys.exit(f"{p} at M8 is not the recorded part (blob {b}...): nothing written")
    TEXT[k] = raw.decode('utf-8').split('\n')
def lines(k, a, b):                       # lines a..b (1-based, of the part's file, its header included), verbatim
    return [('part', k, n, TEXT[k][n - 1]) for n in range(a, b + 1)]
def new(*ts): return [('new', None, None, t) for t in ts]
def expect(k, n, t):
    if TEXT[k][n - 1] != t: sys.exit(f'{PARTS[k][0]} line {n} is not what this tool expects ({t[:70]!r})')
for k, n, t in [('level0', 12, "const WORLD=require('./world.js');"), ('level0', 13, 'module.exports=function createSim(opts){opts=opts||{};'),
                ('ai', 14, "const AI=require('./ai.js');"), ('ai', 18, 'const players=[];'), ('glitches', 11, 'let items=[];'),
                ('bodies', 8, 'const bodies=new Map(),bodyT=new Map();let bodyVer=1,clockT=0,pruneT=0;'), ('players', 7, 'function resetWorld(){'),
                ('players', 13, '}'), ('step', 8, 'function step(dt){'), ('admin', 18, 'const admin={'), ('glue', 10, None)]:
    if t is not None: expect(k, n, t)
if not TEXT['glue'][9].startswith('resetWorld();return {takeItem,players,'): sys.exit('sim.glue.js line 10 is not what this tool expects')
if not TEXT['ai'][16].startswith('var PR=0;const ANCHOR={x:1056,y:3264};') or not TEXT['ai'][18].startswith('let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,debugOn=false,worldSeq=0;'):
    sys.exit('sim.ai.js lines 17 and 19 are not what this tool expects')

C3 = 'Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py)'
MODULES = {}
MODULES[f'{F}/lost/server/sim.level0.js'] = (new(
  "/* src/frameworks/lost/server/sim.level0.js - L.O.S.T., with S.P.A.C.E.'s collision: Level 0 as the server builds it for one world - the",
  " * map, the collision, the ray cast and the light code, extracted from the production bundle (assets/index-*.js) - a module of the sim",
  " * (src/core/server/sim.js).  3H F-007 and M-003: the map is defined in the bundle too.",
  " * The comment dev/sim_head.js carried above this code:",
  " * | sim.js - server-side Level 0 monster simulation.",
  " * | The map, pathfinding, Hound and Smiler AI below are the game's own code, extracted from the",
  " * | production bundle (assets/index-*.js) and generalised from one player to many.",
  " * | The section marked 'multiplayer glue' is new.",
  f" * {C3}: a module.  Its two long lines are",
  " * the extracted code as it was (sim.js's lines 14 and 15 at M8); the factory's first line, the blackout's two controls and the return",
  " * are new.",
  " *   level0(WORLD)   builds one world's level with world.js (WORLD: the carving, the lamps, the furniture) and returns its primitives:",
  " *     the map (FBW and FBH in cells, the rooms Oc, the spawn Ic, the lamps Fc, the walkable grid W x al of il px, ll, ul), the collision",
  " *     (zc, Hc, Bc, sl), the ray cast (Uc), the route finder (fl), the light each equipment gives (Gc, qc), the blackout (its state V; Lc",
  " *     resets it, Rc advances it) and the blackout's two controls (forceBlackout, restartBlackout), which the run and the admin call where",
  " *     they used to set V's fields themselves. */",
  "'use strict';",
  'module.exports = function level0(WORLD) {') + lines('level0', 14, 15) + new(
  "/* (C3) the blackout's two controls: the run forces it on or off when the admin chose so; the admin's 'auto' starts its timer again */",
  'const forceBlackout = on => { V.blackout = on; };',
  'const restartBlackout = () => { V.elapsed = 0; };',
  'return { FBH, FBW, Bc, Fc, Gc, Hc, Ic, Lc, Oc, Rc, Uc, V, W, al, fl, il, ll, qc, sl, ul, zc, forceBlackout, restartBlackout };',
  '};', ''), [])

MODULES[f'{F}/nani/server/sim.ai.js'] = (new(
  "/* src/frameworks/nani/server/sim.ai.js - N.A.N.I.: the AI engine's wiring for one world (the world's seed, the engine, the level as the",
  " * engine sees it), the director's caps and spawning, and the admin's nav command; a module of the sim (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: ai.js is required once by the sim and given here (AI); the world's shared state that",
  " * was declared here, \"at the top of the glue\", went to its owners (the roster to the sim, PR and the run's clock and controls to the",
  " * run, debugOn to the admin); navCmd and killerEnd, which sat among G.I.B.'s lines, are here, with the engine they call.",
  " *   simAi({ AI, WORLD, opts, players, level })   makes the world's random stream (RND, from opts.seed or 4 random bytes) and its AI",
  " *     engine (eng) on the level's primitives, and returns them with the director's caps and what spawns and places the monsters.",
  " *     players is the roster, read only (alive). */",
  "'use strict';",
  'module.exports = function simAi({ AI, WORLD, opts, players, level: { Bc, FBH, FBW, Fc, Gc, Ic, Oc, Uc, V, W, al, fl, il, ll, qc, sl, ul, zc } }) {') + \
  lines('ai', 11, 13) + lines('ai', 15, 17) + lines('ai', 20, 96) + new(
  "/* (C3) the admin's nav command, and where a kill left the Hound (they sat among G.I.B.'s lines) */") + lines('bodies', 10, 11) + new(
  'return { ADMIN_MAX_HOUNDS, ADMIN_MAX_SMILERS, ANCHOR, DIRECTOR_MAX_HOUNDS, MAX_BODIES, RND, SNn, adapter, adminCap, adminSpawn, alive, eng, ents, isAlive,',
  '  killerEnd, navCmd, newHound, randomSpot, rnd, spawnMonsters };',
  '};', ''), [('var PR=0;const ANCHOR={x:1056,y:3264};', 'const ANCHOR={x:1056,y:3264};')])

MODULES[f'{F}/lost/server/sim.glitches.js'] = (new(
  "/* src/frameworks/lost/server/sim.glitches.js - L.O.S.T.: the glitched walls, the way out of Level 0; a module of the sim",
  " * (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: P.O.C.K.E.T.'s cartograph, which sat among these lines, is in its own module",
  " * (src/frameworks/pocket/server/sim.items.js).",
  " *   simGlitches({ ai, level })   returns the current walls (glitches(): the list changes at every world reset) and placeGlitches(),",
  " *     which places three new ones: the world reset and the admin call it where they used to assign the list themselves. */",
  "'use strict';",
  'module.exports = function simGlitches({ ai: { ANCHOR, RND }, level: { FBH, FBW, Hc, Ic, fl, sl, zc } }) {') + \
  lines('glitches', 8, 9) + lines('glitches', 13, 26) + new(
  '/* (C3) three new glitched walls */',
  'const placeGlitches=()=>{glitches=makeGlitches(3)};',
  'return { glitches: () => glitches, placeGlitches };',
  '};', ''), [])

MODULES[f'{F}/pocket/server/sim.items.js'] = (new(
  "/* src/frameworks/pocket/server/sim.items.js - P.O.C.K.E.T. on the server: the cartograph, one rare find per world - where it lies and who",
  " * picks it up; a module of the sim (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: the placement sat among L.O.S.T.'s glitched walls, the pick-up (takeItem) in",
  " * core's glue.",
  " *   simItems({ ai, walls })   returns the current items (items(): the list changes at every world reset), placeItems(), which",
  " *     places a new cartograph away from the glitched walls (the world reset and the admin call it where they used to assign the list",
  " *     themselves), and takeItem(p), the pick-up within 110 px. */",
  "'use strict';",
  'module.exports = function simItems({ ai: { eng, randomSpot }, walls: { glitches } }) {') + lines('glitches', 10, 12) + new(
  '/* (C3) a new cartograph */',
  'const placeItems=()=>{items=makeItems()};') + lines('glue', 9, 9) + new(
  'return { items: () => items, placeItems, takeItem };',
  '};', ''), [('const p=randomSpot(1800,glitches,700,true);', 'const p=randomSpot(1800,glitches(),700,true);')])

MODULES[f'{F}/gib/server/sim.bodies.js'] = (new(
  "/* src/frameworks/gib/server/sim.bodies.js - G.I.B.: everyone's bodies, one per player, and how long they stay; and the sim's clock (a",
  " * snapshot's st), which the bodies and the death records are stamped with.  A module of the sim (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: N.A.N.I.'s navCmd and killerEnd, which sat among these lines, are with the engine",
  " * in sim.ai.js.",
  " *   simBodies({ opts, ai })   returns the bodies (a Map), setBody(id, rec), tick(dt) (the run's step advances the clock and prunes",
  " *     the bodies through it, where it used to do both itself), clearBodies() (the world reset's), clock() and bodyVer() (both change). */",
  "'use strict';",
  'module.exports = function simBodies({ opts, ai: { MAX_BODIES } }) {') + lines('bodies', 7, 9) + lines('bodies', 12, 18) + new(
  "/* (C3) the clock's advance with the pruning, and the world reset's clearing: the run used to do both itself */",
  'function tick(dt){clockT+=dt;pruneBodies(dt)}',
  'function clearBodies(){bodies.clear();bodyT.clear();bodyVer++}',
  'return { bodies, setBody, tick, clearBodies, clock: () => clockT, bodyVer: () => bodyVer };',
  '};', ''), [])

MODULES[f'{F}/nani/server/sim.feed.js'] = (new(
  "/* src/frameworks/nani/server/sim.feed.js - N.A.N.I.: what the AI reads of the players every step (feed), its events (processEvents), and",
  " * a capture as the snapshot sends it (capInfo); a module of the sim (src/core/server/sim.js).",
  f" * {C3}: a module; its lines are sim.js's",
  " * at M8, as they were.",
  " *   simFeed({ WORLD, opts, players, level, ai })   players is the roster (feed writes the fields the AI reads on each record; a kill",
  " *     marks its victim dead and calls opts.onDeath). */",
  "'use strict';",
  'module.exports = function simFeed({ WORLD, opts, players, level: { Gc }, ai: { SNn, eng, isAlive } }) {') + lines('feed', 6, 28) + new(
  'return { capInfo, feed, processEvents };',
  '};', ''), [])

MODULES['src/core/server/sim.step.js'] = (new(
  "/* src/core/server/sim.step.js - core: the run of one world - its state (the run's clock, the pressure, the director's timer, the world",
  " * count, the admin's controls), the world reset, one simulation step, and the entities as a snapshot sends them; a module of the sim",
  " * (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: the run's state was declared in N.A.N.I.'s lines \"at the top of the glue\" (debugOn",
  " * is the admin's now); the world reset was among S.P.A.C.E.'s lines, and calls each owner's reset where it assigned their state itself.",
  " *   simStep({ opts, players, level, ai, feed, walls, items, bodies })   returns resetWorld(), step(dt), entities(), ofKind(k), runT() and",
  " *     worldSeq() (both change), and controls: the admin's narrow way into the run (freeze, setSpeed, setBlackout, capRunTime; and",
  " *     frozen, speed, bmode to read), where the admin tools used to assign these variables themselves. */",
  "'use strict';",
  'module.exports = function simStep({ opts, players, level: { Lc, Rc, V, forceBlackout }, ai: { DIRECTOR_MAX_HOUNDS, RND, alive, eng, ents, newHound, rnd,',
  '  spawnMonsters }, feed: { feed, processEvents }, walls: { glitches, placeGlitches }, items: { items, placeItems }, bodies: { clearBodies, clock, tick } }) {',
  "/* the run's state (C3: it was declared in sim.ai.js's lines, with the roster and the admin's debug switch) */") + lines('ai', 17, 17) + lines('ai', 19, 19) + \
  new("/* the world reset (C3: it was among S.P.A.C.E.'s lines) */") + lines('players', 7, 13) + lines('step', 7, 29) + new(
  "/* (C3) the admin's controls of the run: the admin tools used to assign these variables themselves */",
  'const controls={freeze:on=>{frozen=on},setSpeed:v=>{speed=v},setBlackout:m=>{bmode=m},capRunTime:s=>{runT=Math.min(runT,s)},',
  '  get frozen(){return frozen},get speed(){return speed},get bmode(){return bmode}};',
  'return { controls, entities, ofKind, resetWorld, step, runT: () => runT, worldSeq: () => worldSeq };',
  '};', ''), [
  ('var PR=0;const ANCHOR={x:1056,y:3264};   // spawn is hard against a wall; this open spot next to it is used for reachability checks', 'var PR=0;'),
  ('let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,debugOn=false,worldSeq=0;', 'let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,worldSeq=0;'),
  ('glitches=makeGlitches(3);items=makeItems();', 'placeGlitches();placeItems();'),
  ('bodies.clear();bodyT.clear();bodyVer++;', 'clearBodies();'),
  ('clockT+=dt;pruneBodies(dt);', 'tick(dt);'),
  ('for(const g of glitches)if(Math.hypot(p.x-g.x,p.y-g.y)<54)', 'for(const g of glitches())if(Math.hypot(p.x-g.x,p.y-g.y)<54)'),
  ('else V.blackout=bmode===`on`;', 'else forceBlackout(bmode===`on`);'),
  ('st:+clockT.toFixed(3)', 'st:+clock().toFixed(3)'), ('gw:glitches.map(', 'gw:glitches().map('), ('it:items.map(', 'it:items().map(')])

MODULES[f'{F}/space/server/sim.players.js'] = (new(
  "/* src/frameworks/space/server/sim.players.js - S.P.A.C.E.: the player lifecycle (join, spawn, respawn, NEW RUN's rules, forfeit, leave)",
  " * and the roster's changes (addPlayer, removePlayer); a module of the sim (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: the world reset, which was among these lines, is the run's (core's sim.step.js),",
  " * and join reads the run's clock through runT().",
  " *   simPlayers({ players, level, ai, feed, run })   players is the roster: this module alone adds and removes; the others read it. */",
  "'use strict';",
  'module.exports = function simPlayers({ players, level: { Ic }, ai: { eng }, feed: { processEvents }, run: { resetWorld, runT } }) {') + \
  lines('players', 14, 50) + new(
  'return { NR_CD, addPlayer, canRespawn, forfeit, join, leave, lifeOf, newRun, nrWait, nrWhy, removePlayer, respawn, spawn };',
  '};', ''), [('p.active=true;spawn(p);p.t0=runT;', 'p.active=true;spawn(p);p.t0=runT();')])

MODULES[f'{F}/space/server/sim.movement.js'] = (new(
  "/* src/frameworks/space/server/sim.movement.js - S.P.A.C.E.: movement as the server checks it (moveRoute, moveOk, spawnOk) and as the AI",
  " * hears it (hearMove, gaitFloor); a module of the sim (src/core/server/sim.js).",
  f" * {C3}: a module; its lines are sim.js's",
  " * at M8, as they were.",
  " *   simMovement({ WORLD, level, ai })   WORLD.setMode switches the collision's mode for a check and back. */",
  "'use strict';",
  'module.exports = function simMovement({ WORLD, level: { sl }, ai: { eng } }) {') + lines('movement', 6, 54) + new(
  'return { gaitFloor, hearMove, moveOk, moveRoute, spawnOk };',
  '};', ''), [])

MODULES[f'{F}/overseer/server/sim.admin.js'] = (new(
  "/* src/frameworks/overseer/server/sim.admin.js - OVERSEER: the world side of the admin tools (placeNear, the admin API); a module of the",
  " * sim (src/core/server/sim.js).",
  f" * {C3}: a module.  Its lines are sim.js's",
  " * at M8, as they were, except what that tool lists: the admin tools assigned the run's state, the blackout's timer, the walls and the",
  " * cartograph themselves; they now call those owners' controls (the run's controls, restartBlackout, placeGlitches, placeItems) and read",
  " * the changing lists through glitches() and items().  The debug switch (debugOn) is the admin's own, declared here.",
  " *   simAdmin({ players, level, ai, feed, walls, items, run, life })   returns admin, the object server.js calls (the same keys), and",
  " *     debugOn() (it changes). */",
  "'use strict';",
  'module.exports = function simAdmin({ players, level: { restartBlackout, sl }, ai: { ADMIN_MAX_HOUNDS, ADMIN_MAX_SMILERS, DIRECTOR_MAX_HOUNDS, RND, adminCap,',
  '  adminSpawn, eng, ents, spawnMonsters }, feed: { feed, processEvents }, walls: { glitches, placeGlitches }, items: { items, placeItems },',
  '  run: { controls, ofKind, resetWorld }, life: { spawn } }) {',
  "let debugOn=false;      // (C3) the admin's debug switch (it was declared in sim.ai.js's lines)") + lines('admin', 7, 66) + new(
  'return { admin, debugOn: () => debugOn };',
  '};', ''), [
  ('freeze(on){frozen=!!on},', 'freeze(on){controls.freeze(!!on)},'),
  ('speed(v){speed=Math.max(.25,Math.min(3,+v||1))},', 'speed(v){controls.setSpeed(Math.max(.25,Math.min(3,+v||1)))},'),
  ('blackout(mode){bmode=[`on`,`off`,`auto`].includes(mode)?mode:`auto`;if(bmode===`auto`)V.elapsed=0},',
   'blackout(mode){controls.setBlackout([`on`,`off`,`auto`].includes(mode)?mode:`auto`);if(controls.bmode===`auto`)restartBlackout()},'),
  ('resetMonsters(){spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));runT=Math.min(runT,60)},', 'resetMonsters(){spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));controls.capRunTime(60)},'),
  ('newGlitches(){glitches=makeGlitches(3)},', 'newGlitches(){placeGlitches()},'),
  ('newItem(){items=makeItems()},', 'newItem(){placeItems()},'),
  ('for(const i of items){', 'for(const i of items()){'),
  ('for(const g of glitches){', 'for(const g of glitches()){'),
  ('fz:frozen?1:0,sp:speed,bo:bmode,', 'fz:controls.frozen?1:0,sp:controls.speed,bo:controls.bmode,'),
  ('gw:glitches.length,it:items.length,', 'gw:glitches().length,it:items().length,')])

MODULES['src/core/server/sim.js'] = (new(
  "/* src/core/server/sim.js - core: the server's simulation of one world (Level 0).  server.js makes one for each room: createSim(opts).",
  " * The comment sim.js has always opened with:",
  " * | sim.js - server-side Level 0 simulation.",
  " * | The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).",
  " * | The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the",
  " * | admin tools.") + new(
  f" * {C3}: the sim is modules.  Until M8 it",
  " * was this one function, built from eleven parts that shared its closure (generated/server/sim.js).  Now each owner's part is a module:",
  " * a factory given what it uses, by owner, returning what it gives.  This file makes them in the order the one function ran (the level;",
  " * the seed and the AI engine; the plain declarations; the first world reset) and returns the same object, key for key.  No module keeps",
  " * state outside its factory, so every world has its own.",
  " *   level   L.O.S.T.      src/frameworks/lost/server/sim.level0.js     the map, the collision, the ray cast and the light (from the bundle)",
  " *   ai      N.A.N.I.      src/frameworks/nani/server/sim.ai.js         the world's seed, the AI engine, spawning, the director's caps",
  " *   walls   L.O.S.T.      src/frameworks/lost/server/sim.glitches.js   the glitched walls",
  " *   items   P.O.C.K.E.T.  src/frameworks/pocket/server/sim.items.js    the cartograph",
  " *   bodies  G.I.B.        src/frameworks/gib/server/sim.bodies.js      the bodies, and the sim's clock",
  " *   feed    N.A.N.I.      src/frameworks/nani/server/sim.feed.js       what the AI reads of the players, and its events",
  " *   run     core          src/core/server/sim.step.js                  the run's state, the world reset, one step, the snapshot's entities",
  " *   life    S.P.A.C.E.    src/frameworks/space/server/sim.players.js   the player lifecycle (the only module that adds or removes players)",
  " *   move    S.P.A.C.E.    src/frameworks/space/server/sim.movement.js  movement as the server checks it and as the AI hears it",
  " *   over    OVERSEER      src/frameworks/overseer/server/sim.admin.js  the world side of the admin tools",
  " * players, the roster, is made here and given to the modules that read it.  WORLD (world.js) and AI (ai.js) are the built files the",
  " * server has always loaded (npm run build makes them from src/). */") + lines('header', 9, 9) + new(
  "const WORLD=require('../../../generated/server/world.js');",
  "const AI=require('../../../generated/server/ai.js');",
  "const level0=require('../../frameworks/lost/server/sim.level0.js'),simAi=require('../../frameworks/nani/server/sim.ai.js'),",
  "  simGlitches=require('../../frameworks/lost/server/sim.glitches.js'),simItems=require('../../frameworks/pocket/server/sim.items.js'),",
  "  simBodies=require('../../frameworks/gib/server/sim.bodies.js'),simFeed=require('../../frameworks/nani/server/sim.feed.js'),",
  "  simStep=require('./sim.step.js'),simPlayers=require('../../frameworks/space/server/sim.players.js'),",
  "  simMovement=require('../../frameworks/space/server/sim.movement.js'),simAdmin=require('../../frameworks/overseer/server/sim.admin.js');") + \
  lines('level0', 13, 13) + new(
  '  const level=level0(WORLD);',
  '  const players=[];',
  '  const ai=simAi({AI,WORLD,opts,players,level});',
  '  const walls=simGlitches({ai,level}),items=simItems({ai,walls}),bodies=simBodies({opts,ai}),feed=simFeed({WORLD,opts,players,level,ai});',
  '  const run=simStep({opts,players,level,ai,feed,walls,items,bodies});',
  '  const life=simPlayers({players,level,ai,feed,run}),move=simMovement({WORLD,level,ai});',
  '  const over=simAdmin({players,level,ai,feed,walls,items,run,life});',
  '  const {takeItem}=items,{addPlayer,removePlayer,join,respawn,canRespawn,leave,newRun,nrWhy,nrWait,NR_CD,forfeit,lifeOf}=life,',
  '    {moveOk,moveRoute,spawnOk,gaitFloor,hearMove}=move,{step,entities,resetWorld}=run,{admin}=over,{setBody}=bodies,',
  '    {killerEnd,navCmd,eng,adapter}=ai,{capInfo}=feed,{sl,Bc,V,Ic}=level;') + lines('glue', 10, 14) + lines('glue', 17, 18), [
  ('module.exports=function createSim(opts){opts=opts||{};', 'module.exports=function createSim(options){const opts=options||{};'),
  ('get debugOn(){return debugOn}', 'get debugOn(){return over.debugOn()}'),
  ('get bodies(){return bodies},get bodyVer(){return bodyVer},get glitches(){return glitches},get runT(){return runT},get worldSeq(){return worldSeq},',
   'get bodies(){return bodies.bodies},get bodyVer(){return bodies.bodyVer()},get glitches(){return walls.glitches()},get runT(){return run.runT()},get worldSeq(){return run.worldSeq()},'),
  ('debug:{V,Ic,get glitches(){return glitches}}};', 'debug:{V,Ic,get glitches(){return walls.glitches()}}};')])

GONE = ['src/core/server/sim.header.js', 'src/core/server/sim.glue.js', 'generated/server/sim.js']

def build(spec):
    segs, edits = spec
    text = '\n'.join(s[3] for s in segs)
    for old, new_ in edits:
        if text.count(old) != 1: sys.exit(f'an edit is not found exactly once: {old[:80]!r}')
        text = text.replace(old, new_)
    return text
OUT = {p: build(s) for p, s in MODULES.items()}

def report():
    out = []
    for p, (segs, edits) in MODULES.items():
        from_parts = {}
        for kind, k, n, _ in segs:
            if kind == 'part': from_parts.setdefault(PARTS[k][0], []).append(n)
        rng = lambda ns: ','.join(f'{a}-{b}' if a != b else str(a) for a, b in _runs(ns))
        out.append(f'{p}: {OUT[p].count(chr(10))} lines')
        for src, ns in from_parts.items(): out.append(f'  from {src} (M8) lines {rng(ns)}, verbatim unless edited below')
        out.append(f'  new lines (the header, the factory, the controls, the return): {sum(1 for s in segs if s[0] == "new")}')
        for old, new_ in edits: out.append(f'  edit: {old}\n     -> {new_}')
    out.append('removed: ' + ', '.join(GONE) + ' (the composition replaces the header and the glue parts; the sim is not built any more)')
    return '\n'.join(out) + '\n'
def _runs(ns):
    ns = sorted(ns); a = b = ns[0]
    for n in ns[1:]:
        if n == b + 1: b = n
        else: yield a, b; a = b = n
    yield a, b

if A.apply:
    for p, t in OUT.items():
        os.makedirs(os.path.dirname(os.path.join(REPO, p)), exist_ok=True)
        open(os.path.join(REPO, p), 'w', encoding='utf-8', newline='\n').write(t)
    for p in GONE:
        if os.path.exists(os.path.join(REPO, p)): os.remove(os.path.join(REPO, p))
    print('C3a: ' + ', '.join(f'{p} {t.count(chr(10))} lines' for p, t in OUT.items()) + '; removed ' + ', '.join(GONE))
else:
    bad = [p for p, t in OUT.items() if not os.path.exists(os.path.join(REPO, p)) or open(os.path.join(REPO, p), encoding='utf-8').read() != t]
    bad += [p + ' (still there)' for p in GONE if os.path.exists(os.path.join(REPO, p))]
    if A.report: open(A.report, 'w', encoding='utf-8').write(report())
    print('C3a SIM MODULES CHECK: ' + ('PASS (every module is what M8\'s parts and the listed edits give; the parts\' output and the two core parts are gone)' if not bad else 'FAIL: ' + ', '.join(bad)))
    sys.exit(1 if bad else 0)
