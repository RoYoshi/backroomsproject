/* src/core/server/sim.js - core: the server's simulation of one world (Level 0).  server.js makes one for each room: createSim(opts).
 * The comment sim.js has always opened with:
 * | sim.js - server-side Level 0 simulation.
 * | The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).
 * | The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the
 * | admin tools.
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): the sim is modules.  Until M8 it
 * was this one function, built from eleven parts that shared its closure (generated/server/sim.js).  Now each owner's part is a module:
 * a factory given what it uses, by owner, returning what it gives.  This file makes them in the order the one function ran (the level;
 * the seed and the AI engine; the plain declarations; the first world reset) and returns the same object, key for key.  No module keeps
 * state outside its factory, so every world has its own.
 *   level   L.O.S.T.      src/frameworks/lost/server/sim.level0.js     the map, the collision, the ray cast and the light (from the bundle;
 *                                                                       its data, since C4c, the one definition: level0.json, lights.json)
 *   ai      N.A.N.I.      src/frameworks/nani/server/sim.ai.js         the world's seed, the AI engine, spawning, the director's caps
 *   walls   L.O.S.T.      src/frameworks/lost/server/sim.glitches.js   the glitched walls
 *   items   P.O.C.K.E.T.  src/frameworks/pocket/server/sim.items.js    the cartograph
 *   bodies  G.I.B.        src/frameworks/gib/server/sim.bodies.js      the bodies, and the sim's clock
 *   feed    N.A.N.I.      src/frameworks/nani/server/sim.feed.js       what the AI reads of the players, and its events
 *   run     core          src/core/server/sim.step.js                  the run's state, the world reset, one step, the snapshot's entities
 *   life    S.P.A.C.E.    src/frameworks/space/server/sim.players.js   the player lifecycle (the only module that adds or removes players)
 *   move    S.P.A.C.E.    src/frameworks/space/server/sim.movement.js  movement as the server checks it and as the AI hears it
 *   over    OVERSEER      src/frameworks/overseer/server/sim.admin.js  the world side of the admin tools
 * players, the roster, is made here and given to the modules that read it.  WORLD (world.js) and AI (ai.js) are the built files the
 * server has always loaded (npm run build makes them from src/). */
'use strict';
const WORLD=require('../../../generated/server/world.js');
const AI=require('../../../generated/server/ai.js');
/* (C4c, M-003) Level 0 and the carried lights, defined once for the server and the page (the compiled client is built with them) */
const LEVEL0=require('../../frameworks/lost/shared/level0.json'),LIGHTS=require('../../frameworks/pocket/shared/lights.json');
const level0=require('../../frameworks/lost/server/sim.level0.js'),simAi=require('../../frameworks/nani/server/sim.ai.js'),
  simGlitches=require('../../frameworks/lost/server/sim.glitches.js'),simItems=require('../../frameworks/pocket/server/sim.items.js'),
  simBodies=require('../../frameworks/gib/server/sim.bodies.js'),simFeed=require('../../frameworks/nani/server/sim.feed.js'),
  simStep=require('./sim.step.js'),simPlayers=require('../../frameworks/space/server/sim.players.js'),
  simMovement=require('../../frameworks/space/server/sim.movement.js'),simAdmin=require('../../frameworks/overseer/server/sim.admin.js');
module.exports=function createSim(options){const opts=options||{};
  const level=level0(WORLD,{level0:LEVEL0,lights:LIGHTS});
  const players=[];
  const ai=simAi({AI,WORLD,opts,players,level});
  const walls=simGlitches({ai,level}),items=simItems({ai,walls}),bodies=simBodies({opts,ai}),feed=simFeed({WORLD,opts,players,level,ai});
  const run=simStep({opts,players,level,ai,feed,walls,items,bodies});
  const life=simPlayers({players,level,ai,feed,run}),move=simMovement({WORLD,level,ai});
  const over=simAdmin({players,level,ai,feed,walls,items,run,life});
  const {takeItem}=items,{addPlayer,removePlayer,join,respawn,canRespawn,leave,newRun,nrWhy,nrWait,NR_CD,forfeit,lifeOf}=life,
    {moveOk,moveRoute,spawnOk,gaitFloor,hearMove}=move,{step,entities,resetWorld}=run,{admin}=over,{setBody}=bodies,
    {killerEnd,navCmd,eng,adapter}=ai,{capInfo}=feed,{sl,Bc,V,Ic}=level;
resetWorld();return {takeItem,players,addPlayer,removePlayer,join,respawn,canRespawn,moveOk,moveRoute,spawnOk,leave,newRun,nrWhy,nrWait,NR_CD,forfeit,gaitFloor,lifeOf,
  clearAt:(x,y,r)=>sl(x,y,r),blockersAt:(x,y)=>Bc(x,y),step,entities,resetWorld,admin,setBody,killerEnd,navCmd,hearMove,capInfo,
  debugInfo:()=>eng.debugInfo(),logSince:s=>eng.log.filter(l=>l.s>s),get logSeq(){return eng.logSeq},get engStats(){return eng.stats},get debugOn(){return over.debugOn()},engine:eng,adapter,
  get bodies(){return bodies.bodies},get bodyVer(){return bodies.bodyVer()},get glitches(){return walls.glitches()},get runT(){return run.runT()},get worldSeq(){return run.worldSeq()},
  debug:{V,Ic,get glitches(){return walls.glitches()}}};
};
