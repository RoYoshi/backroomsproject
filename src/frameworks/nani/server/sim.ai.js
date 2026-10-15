/* src/frameworks/nani/server/sim.ai.js - N.A.N.I.: the AI engine's wiring for one world (the world's seed, the engine, the level as the
 * engine sees it), the director's caps and spawning, and the admin's nav command; a module of the sim (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module.  Its lines are sim.js's
 * at M8, as they were, except what that tool lists: ai.js is required once by the sim and given here (AI); the world's shared state that
 * was declared here, "at the top of the glue", went to its owners (the roster to the sim, PR and the run's clock and controls to the
 * run, debugOn to the admin); navCmd and killerEnd, which sat among G.I.B.'s lines, are here, with the engine they call.
 *   simAi({ AI, WORLD, opts, players, level })   makes the world's random stream (RND, from opts.seed or 4 random bytes) and its AI
 *     engine (eng) on the level's primitives, and returns them with the director's caps and what spawns and places the monsters.
 *     players is the roster, read only (alive).
 * Continuation C4c (M-003): the reachability anchor (ANCHOR) is the level's, read from the one definition of Level 0 and given with
 * the level; this module returns it as before. */
'use strict';
module.exports = function simAi({ AI, WORLD, opts, players, level: { ANCHOR, Bc, FBH, FBW, Fc, Gc, Ic, Oc, Uc, V, W, al, fl, il, ll, qc, sl, ul, zc } }) {
/* ---------- multiplayer glue (v16): the shared AI engine (ai.js) drives every Hound and Smiler.
   The old single-hound / single-smiler code that used to sit above this line has been replaced by that engine;
   everything the entities know about players reaches them through perception (see ai.js). ---------- */
const SIM_SEED=(opts.seed??require('crypto').randomBytes(4).readUInt32LE(0))>>>0;
const RND=AI.mkRng(SIM_SEED);
/* (C4c) ANCHOR, the open spot next to the spawn (which is hard against a wall) that reachability is checked from, is the level's:
   L.O.S.T.'s src/frameworks/lost/shared/level0.json (its anchor cell), given with the level; it was written here as {x:1056,y:3264} */
// Shipped/director population remains intentionally small.  Human-QA/stress tools get a much higher ceiling without silently changing normal balance.
const DIRECTOR_MAX_HOUNDS=3,ADMIN_MAX_HOUNDS=64,ADMIN_MAX_SMILERS=64,MAX_BODIES=24;
const adminCap=k=>k===`hound`?ADMIN_MAX_HOUNDS:ADMIN_MAX_SMILERS;
const rnd=(a,b)=>a+RND()*(b-a);
const SNn=WORLD.SN;
const isAlive=p=>p.active&&!p.dead&&!p.exited&&p.safe<=0&&!p.god;
const alive=()=>players.filter(isAlive);

/* the engine sees the level only through these primitives (the game's own collision, ray-cast and light code) */
const adapter={key:`level0`,cols:W,rows:al,cell:il,W:FBW*96,H:FBH*96,rooms:Oc,lamps:Fc,
  floor:(tx,ty)=>zc(tx,ty),
  clear:(x,y,r,mode)=>{WORLD.setMode(mode||`walk`);try{return sl(x,y,r)}finally{WORLD.setMode(`walk`)}},
  blockers:(x,y,mode)=>{WORLD.setMode(mode||`walk`);try{return Bc(x,y)}finally{WORLD.setMode(`walk`)}},
  ray:(x,y,a,m)=>Uc(x,y,a,m),
  blackout:()=>V.blackout,
  qc:(p,pt,on)=>qc(p,pt,on),
  kinds:Gc};                                          // the light each kind of equipment gives (visible light only; Part 2 stage 2C)
const eng=AI.create({adapter,seed:SIM_SEED});

function randomSpot(minSpawn,avoid,minAvoid,mustReach=true,dark=false){
  for(let t=0;t<700;t++){
    const idx=(RND()*W*al)|0;if(!ll[idx])continue;
    const p=ul(idx);
    if(Math.hypot(p.x-Ic.x,p.y-Ic.y)<minSpawn)continue;
    if(avoid.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<minAvoid))continue;
    if(!sl(p.x,p.y))continue;
    if(dark&&eng.geo.lamp[eng.geo.cellAt(p.x,p.y)]>.1)continue;      // smilers begin in the unlit halls
    if(mustReach&&!fl(p,ANCHOR).length)continue;
    return p;
  }
  return null;
}
const ents=()=>eng.entities;
function newHound(minSpawn=3000,awayFrom=[]){const at=randomSpot(minSpawn,awayFrom.concat(ents()),1500);return at?eng.spawn(`hound`,at.x,at.y):null}
/* where a smiler first appears (spec 50): dark, out of sight, with a reason to be there - near where light meets dark, or half-hidden by walls - never on open lit floor, never beside anyone */
function smilerSpot(minSpawn,av){
  const pl=alive();let best=null,bs=-1e9;
  for(let k=0;k<14;k++){
    const p=randomSpot(minSpawn,av,1100,true,true);if(!p)continue;
    let s=RND()*20,dmin=1e9;
    for(const q of pl){const d=Math.hypot(q.x-p.x,q.y-p.y);dmin=Math.min(dmin,d);if(d<1600&&eng.geo.los(p.x,p.y,q.x,q.y))s-=400}
    if(pl.length&&dmin<1500)s-=(1500-dmin)*.3;
    for(let a=0;a<8;a++){const c=eng.geo.cellAt(p.x+Math.cos(a*.785)*420,p.y+Math.sin(a*.785)*420);if(c>=0&&eng.geo.lamp[c]>.3){s+=25;break}}
    let sh=0;for(let a=0;a<8;a++)if(eng.geo.ray(p.x,p.y,a*.785,260)<200)sh++;s+=Math.min(sh,4)*8;
    if(s>bs){bs=s;best=p}
  }
  return best;
}
function newSmiler(minSpawn=1700,awayFrom=[]){const av=awayFrom.concat(ents());const at=smilerSpot(minSpawn,av)||randomSpot(minSpawn,av,1100,true,true)||randomSpot(minSpawn,av,1100);return at?eng.spawn(`smiler`,at.x,at.y):null}
/* Admin-only stress placement: the normal director keeps its wide 1500/1100 px monster spacing, but that spacing makes a 64-entity
 * test ceiling impossible to reach.  Stress spawns stay well away from live players and on reachable floor while allowing monsters to pack
 * closer together.  This is deliberately NOT used by ordinary world spawning. */
function adminStressSpot(kind){
  const pl=alive(),es=ents(),playerSep=kind===`hound`?900:850,entitySep=kind===`hound`?260:220,dark=kind===`smiler`;
  for(let t=0;t<1800;t++){
    const idx=(RND()*W*al)|0;if(!ll[idx])continue;
    const p=ul(idx);
    if(Math.hypot(p.x-Ic.x,p.y-Ic.y)<900)continue;
    if(pl.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<playerSep))continue;
    if(es.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<entitySep))continue;
    if(!sl(p.x,p.y))continue;
    if(dark&&eng.geo.lamp[eng.geo.cellAt(p.x,p.y)]>.12)continue;
    if(!fl(p,ANCHOR).length)continue;
    return p;
  }
  return null;
}
function adminSpawn(kind){
  if(eng.count(kind)>=adminCap(kind))return false;
  const at=adminStressSpot(kind);if(!at)return false;
  eng.spawn(kind,at.x,at.y);return true;
}
function spawnMonsters(nh,ns){
  eng.clear();
  for(let i=0;i<nh;i++)newHound();
  for(let i=0;i<ns;i++)newSmiler();
}
/* (C3) the admin's nav command, and where a kill left the Hound (they sat among G.I.B.'s lines) */
function navCmd(eid,cmd,p){const e=eng.entities.find(o=>o.id===eid);if(!e)return null;return eng.navCmd(e,cmd,p)}
function killerEnd(id,x,y,a){return eng.commitEnd(id,x,y,a)}
return { ADMIN_MAX_HOUNDS, ADMIN_MAX_SMILERS, ANCHOR, DIRECTOR_MAX_HOUNDS, MAX_BODIES, RND, SNn, adapter, adminCap, adminSpawn, alive, eng, ents, isAlive,
  killerEnd, navCmd, newHound, randomSpot, rnd, spawnMonsters };
};
