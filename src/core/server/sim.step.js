/** @part generated/server/sim.js - core: one simulation step, and the entities as a snapshot sends them
 * provides: entities, ofKind, step
 * uses: DIRECTOR_MAX_HOUNDS, PR, RND, Rc, V, alive, bmode, clockT, eng, ents, feed, frozen, glitches, items, newHound, opts, players,
 *       processEvents, pruneBodies, rnd, runT, spawnT, speed
 * writes: PR, clockT, runT, spawnT
 */

function step(dt){
  clockT+=dt;pruneBodies(dt);
  for(const p of players)if(p.safe>0)p.safe-=dt;
  for(const p of players)if(p.active&&!p.dead&&!p.exited)              // touching a glitched wall takes you out
    for(const g of glitches)if(Math.hypot(p.x-g.x,p.y-g.y)<54){p.exited=true;p.exitSeq=(p.exitSeq|0)+1;p.exitT=runT-p.t0;p.active=false;break}
  if(frozen)return;
  if(!players.some(p=>p.active&&!p.dead&&!p.exited))return;   // the halls hold their breath while nobody is alive
  dt*=speed;runT+=dt;
  if(bmode===`auto`)Rc(dt);else V.blackout=bmode===`on`;
  PR=PR+(Math.min(1,runT/540)-PR)*Math.min(1,dt);eng.pressure=PR;
  if(opts.director!==false&&eng.count(`hound`)<DIRECTOR_MAX_HOUNDS){spawnT-=dt;if(spawnT<=0){spawnT=rnd(80,190);if(RND()<.75)newHound(1800,alive())}}
  feed();
  eng.step(dt);
  processEvents();
}
const r1=n=>Math.round(n*10)/10;
function entities(){
  const s=eng.snapshot();
  return {st:+clockT.toFixed(3),h:s.h,m:s.m,b:V.blackout?1:0,p:+PR.toFixed(3),gw:glitches.map(g=>[Math.round(g.x),Math.round(g.y),g.nx,g.ny]),it:items.map(i=>[i.x,i.y,i.id]),
    lf:eng.geo.fails.map(f=>[Math.round(f.x),Math.round(f.y),Math.round(f.r),+(f.until-eng.now).toFixed(2)]),sn:eng.drainSounds().slice(-24)};
}
const ofKind=k=>ents().filter(e=>e.kind===k);
