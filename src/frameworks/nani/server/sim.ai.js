/** @part generated/server/sim.js - N.A.N.I.: the AI engine's wiring (ai.js, the world's seed, the level as the engine sees it), the director's caps and spawning
 * The world's shared state is declared here too, at the top of the glue as it always was: players, frozen, speed, bmode, runT, spawnT,
 * debugOn and worldSeq.
 * provides: ADMIN_MAX_HOUNDS, ADMIN_MAX_SMILERS, ANCHOR, DIRECTOR_MAX_HOUNDS, MAX_BODIES, PR, RND, SNn, adapter, adminCap, adminSpawn,
 *           alive, bmode, debugOn, eng, ents, frozen, isAlive, newHound, players, randomSpot, rnd, runT, spawnMonsters, spawnT, speed,
 *           worldSeq
 * uses: Bc, FBH, FBW, Fc, Gc, Ic, Oc, Uc, V, W, al, fl, il, ll, opts, qc, sl, ul, zc
 * writes: -
 */

/* ---------- multiplayer glue (v16): the shared AI engine (ai.js) drives every Hound and Smiler.
   The old single-hound / single-smiler code that used to sit above this line has been replaced by that engine;
   everything the entities know about players reaches them through perception (see ai.js). ---------- */
const AI=require('./ai.js');
const SIM_SEED=(opts.seed??require('crypto').randomBytes(4).readUInt32LE(0))>>>0;
const RND=AI.mkRng(SIM_SEED);
var PR=0;const ANCHOR={x:1056,y:3264};   // spawn is hard against a wall; this open spot next to it is used for reachability checks
const players=[];
let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,debugOn=false,worldSeq=0;      // worldSeq: Stage 3D, counts world resets (a death's corpse belongs to its world)
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

