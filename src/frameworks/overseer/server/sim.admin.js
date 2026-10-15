/* src/frameworks/overseer/server/sim.admin.js - OVERSEER: the world side of the admin tools (placeNear, the admin API); a module of the
 * sim (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module.  Its lines are sim.js's
 * at M8, as they were, except what that tool lists: the admin tools assigned the run's state, the blackout's timer, the walls and the
 * cartograph themselves; they now call those owners' controls (the run's controls, restartBlackout, placeGlitches, placeItems) and read
 * the changing lists through glitches() and items().  The debug switch (debugOn) is the admin's own, declared here.
 *   simAdmin({ players, level, ai, feed, walls, items, run, life })   returns admin, the object server.js calls (the same keys), and
 *     debugOn() (it changes). */
'use strict';
module.exports = function simAdmin({ players, level: { restartBlackout, sl }, ai: { ADMIN_MAX_HOUNDS, ADMIN_MAX_SMILERS, DIRECTOR_MAX_HOUNDS, RND, adminCap,
  adminSpawn, eng, ents, spawnMonsters }, feed: { feed, processEvents }, walls: { glitches, placeGlitches }, items: { items, placeItems },
  run: { controls, ofKind, resetWorld }, life: { spawn } }) {
let debugOn=false;      // (C3) the admin's debug switch (it was declared in sim.ai.js's lines)
function placeNear(kind,x,y){                       // an entity a few hundred px from a spot, out of sight if possible
  for(const [lo,hi] of [[620,900],[420,700],[300,520]])for(let t=0;t<60;t++){
    const a=RND()*Math.PI*2,d=lo+RND()*(hi-lo),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d,c=eng.geo.cellAt(px,py);
    if(c<0||eng.geo.cls[c]!==1)continue;
    const p={x:eng.geo.cx(c),y:eng.geo.cy(c)};
    if(kind===`smiler`&&eng.geo.lamp[c]>.12&&t<40)continue;
    if(!eng.geo.los(p.x,p.y,x,y)&&t<30)continue;
    return p;
  }
  return null;
}
const admin={
  freeze(on){controls.freeze(!!on)},
  speed(v){controls.setSpeed(Math.max(.25,Math.min(3,+v||1)))},
  blackout(mode){controls.setBlackout([`on`,`off`,`auto`].includes(mode)?mode:`auto`);if(controls.bmode===`auto`)restartBlackout()},
  god(p){p.god=!p.god;return p.god},
  debug(on){debugOn=!!on;return debugOn},
  resetMonsters(){spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));controls.capRunTime(60)},
  resetWorld(){resetWorld();for(const p of players)if(p.active)spawn(p)},
  newGlitches(){placeGlitches()},
  newItem(){placeItems()},
  nearestItem(x,y){let b=null,bd=1/0;for(const i of items()){const d=Math.hypot(i.x-x,i.y-y);if(d<bd){bd=d;b=i}}return b},
  addHound(){return adminSpawn(`hound`)},
  removeHound(){const h=ofKind(`hound`).pop();if(h)eng.remove(h.id);return !!h},
  addSmiler(){return adminSpawn(`smiler`)},
  removeSmiler(){const s=ofKind(`smiler`).pop();if(s)eng.remove(s.id);return !!s},
  addNear(kind,x,y){                       // testing aid: one more of that entity close to an admin (still capped)
    if(eng.count(kind)>=adminCap(kind))return false;
    const p=placeNear(kind,x,y);if(!p)return false;eng.spawn(kind,p.x,p.y);return true;
  },
  captureMode(m){eng.forceCapture=m===`quick`||m===`play`?m:null;return eng.forceCapture||`auto`},
  previewKill(p,kind,variant){              // DEATHS tab: one chosen death on this player, through the real capture / kill path (works through god mode and spawn protection)
    kind=kind===`smiler`?`smiler`:`hound`;
    if(!p.active||p.dead||p.exited)return {ok:false,why:`you are not in the halls right now`};
    if(p.caught)return {ok:false,why:`you are already caught`};
    feed();const was=p.alive;p.alive=true;      // the engine's view of the players is refreshed first (the world may be frozen)
    let e=ofKind(kind).filter(o=>!o.cap).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],fresh=false;
    if(!e){
      if(eng.count(kind)>=adminCap(kind)){p.alive=was;return {ok:false,why:`every ${kind} is busy`}}
      const at=placeNear(kind,p.x,p.y)||{x:p.x,y:p.y};e=eng.spawn(kind,at.x,at.y);fresh=true;
    }
    const r=eng.previewKill(e,variant,p);
    if(!r.ok){p.alive=was;if(fresh)eng.remove(e.id);return r}
    processEvents();                        // apply the kill now (also while the world is frozen)
    p.pvEnt=fresh?e.id:0;                   // a monster made just for the preview is taken away again when the victim is revived
    return r;
  },
  removeEntity(id){return eng.remove(id|0)},
  endPreview(p){if(p&&p.pvEnt){eng.remove(p.pvEnt);p.pvEnt=0}},
  spotNear(x,y){for(const r of [90,140,200,270])for(let i=0;i<16;i++){const a=i/16*Math.PI*2,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(sl(px,py,16)&&eng.geo.los(px,py,x,y))return {x:Math.round(px),y:Math.round(py)}}return null},
  entityAt(id){const e=ents().find(o=>o.id===(id|0));return e?{x:e.x,y:e.y}:null},
  nearestGlitch(x,y){let b=null,bd=1/0;for(const g of glitches()){const d=Math.hypot(g.x-x,g.y-y);if(d<bd){bd=d;b=g}}return b},
  summon(x,y,pid){                       // drop the nearest Hound a short way from (x,y) and set it on the trail
    const h=ofKind(`hound`).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(!h)return false;
    const p=placeNear(`hound`,x,y);if(!p)return false;
    return eng.summon(h,p.x,p.y,x,y,pid);
  },
  info(){const hs=ofKind(`hound`);return {fz:controls.frozen?1:0,sp:controls.speed,bo:controls.bmode,hn:hs.length,sn:eng.count(`smiler`),mh:ADMIN_MAX_HOUNDS,ms:ADMIN_MAX_SMILERS,dh:DIRECTOR_MAX_HOUNDS,gw:glitches().length,it:items().length,pk:new Set(hs.map(h=>h.pack).filter(Boolean)).size,hs:hs.map(h=>h.state).join(`,`),dbg:debugOn?1:0,
    cm:eng.forceCapture||`auto`,es:ents().map(e=>[e.id,e.kind===`hound`?0:1,e.state,Math.round(e.x),Math.round(e.y),e.tier[0],e.cap?1:0])}},
};
return { admin, debugOn: () => debugOn };
};
