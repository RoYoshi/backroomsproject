/* src/core/server/sim.step.js - core: the run of one world - its state (the run's clock, the pressure, the director's timer, the world
 * count, the admin's controls), the world reset, one simulation step, and the entities as a snapshot sends them; a module of the sim
 * (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module.  Its lines are sim.js's
 * at M8, as they were, except what that tool lists: the run's state was declared in N.A.N.I.'s lines "at the top of the glue" (debugOn
 * is the admin's now); the world reset was among S.P.A.C.E.'s lines, and calls each owner's reset where it assigned their state itself.
 *   simStep({ opts, players, level, ai, feed, walls, items, bodies })   returns resetWorld(), step(dt), entities(), ofKind(k), runT() and
 *     worldSeq() (both change), and controls: the admin's narrow way into the run (freeze, setSpeed, setBlackout, capRunTime; and
 *     frozen, speed, bmode to read), where the admin tools used to assign these variables themselves. */
'use strict';
module.exports = function simStep({ opts, players, level: { Lc, Rc, V, forceBlackout }, ai: { DIRECTOR_MAX_HOUNDS, RND, alive, eng, ents, newHound, rnd,
  spawnMonsters }, feed: { feed, processEvents }, walls: { glitches, placeGlitches }, items: { items, placeItems }, bodies: { clearBodies, clock, tick } }) {
/* the run's state (C3: it was declared in sim.ai.js's lines, with the roster and the admin's debug switch) */
var PR=0;
let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,worldSeq=0;      // worldSeq: Stage 3D, counts world resets (a death's corpse belongs to its world)
/* the world reset (C3: it was among S.P.A.C.E.'s lines) */
function resetWorld(){
  worldSeq++;
  Lc();runT=0;PR=0;eng.pressure=0;spawnT=rnd(70,150);
  spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));      // 1-2 hounds to begin with (up to 3 later), 2-5 smilers
  placeGlitches();placeItems();
  clearBodies();
}

function step(dt){
  tick(dt);
  for(const p of players)if(p.safe>0)p.safe-=dt;
  for(const p of players)if(p.active&&!p.dead&&!p.exited)              // touching a glitched wall takes you out
    for(const g of glitches())if(Math.hypot(p.x-g.x,p.y-g.y)<54){p.exited=true;p.exitSeq=(p.exitSeq|0)+1;p.exitT=runT-p.t0;p.active=false;break}
  if(frozen)return;
  if(!players.some(p=>p.active&&!p.dead&&!p.exited))return;   // the halls hold their breath while nobody is alive
  dt*=speed;runT+=dt;
  if(bmode===`auto`)Rc(dt);else forceBlackout(bmode===`on`);
  PR=PR+(Math.min(1,runT/540)-PR)*Math.min(1,dt);eng.pressure=PR;
  if(opts.director!==false&&eng.count(`hound`)<DIRECTOR_MAX_HOUNDS){spawnT-=dt;if(spawnT<=0){spawnT=rnd(80,190);if(RND()<.75)newHound(1800,alive())}}
  feed();
  eng.step(dt);
  processEvents();
}
const r1=n=>Math.round(n*10)/10;
function entities(){
  const s=eng.snapshot();
  return {st:+clock().toFixed(3),h:s.h,m:s.m,b:V.blackout?1:0,p:+PR.toFixed(3),gw:glitches().map(g=>[Math.round(g.x),Math.round(g.y),g.nx,g.ny]),it:items().map(i=>[i.x,i.y,i.id]),
    lf:eng.geo.fails.map(f=>[Math.round(f.x),Math.round(f.y),Math.round(f.r),+(f.until-eng.now).toFixed(2)]),sn:eng.drainSounds().slice(-24),...(s.ss?{ss:s.ss}:{})};   // (Trial 3: the Skin-Stealers, only when there is one: last, so a world without one is P9's bytes)
}
const ofKind=k=>ents().filter(e=>e.kind===k);
/* (C3) the admin's controls of the run: the admin tools used to assign these variables themselves */
const controls={freeze:on=>{frozen=on},setSpeed:v=>{speed=v},setBlackout:m=>{bmode=m},capRunTime:s=>{runT=Math.min(runT,s)},
  get frozen(){return frozen},get speed(){return speed},get bmode(){return bmode}};
return { controls, entities, ofKind, resetWorld, step, runT: () => runT, worldSeq: () => worldSeq };
};
