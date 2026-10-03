
/* ---------- multiplayer glue (v16): the shared AI engine (ai.js) drives every Hound and Smiler.
   The old single-hound / single-smiler code that used to sit above this line has been replaced by that engine;
   everything the entities know about players reaches them through perception (see ai.js). ---------- */
const AI=require('./ai.js');
const SIM_SEED=(opts.seed??require('crypto').randomBytes(4).readUInt32LE(0))>>>0;
const RND=AI.mkRng(SIM_SEED);
var PR=0;const ANCHOR=WG.planar.anchorXY("anchor:reachability");   // spawn is hard against a wall; this open spot next to it is used for reachability checks
const players=[];
let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,debugOn=false;
// Shipped/director population remains intentionally small.  Human-QA/stress tools get a much higher ceiling without silently changing normal balance.
const DIRECTOR_MAX_HOUNDS=3,ADMIN_MAX_HOUNDS=64,ADMIN_MAX_SMILERS=64,MAX_BODIES=24;
const adminCap=k=>k===`hound`?ADMIN_MAX_HOUNDS:ADMIN_MAX_SMILERS;
const rnd=(a,b)=>a+RND()*(b-a);
const SNn=WORLD.SN;
const isAlive=p=>p.active&&!p.dead&&!p.exited&&p.safe<=0&&!p.god;
const alive=()=>players.filter(isAlive);

/* the engine sees the level only through these primitives (the game's own collision, ray-cast and light code) */
const spatial=opts.world?GEOMETRY.compile(opts.world):null;
const MOTION=spatial?require('./world_motion'):null;
const spatialMotion=spatial?MOTION.create(spatial):null;
let worldGeneration=0;
const adapter=spatial?{geometry:spatial,key:spatial.identity.contentHash,W:spatial.definition.bounds.max.x,H:spatial.definition.bounds.max.y,rooms:[],lamps:[],blackout:()=>V.blackout,qc:(p,pt,on)=>qc(p,pt,on),kinds:Gc,floor:()=>false,clear:()=>false,blockers:()=>[],ray:()=>0}:WG.bindAdapter({blackout:()=>V.blackout,qc:(p,pt,on)=>qc(p,pt,on),kinds:Gc});
function spatialSpawn(p){const a=spatial.definition.anchors.find(a=>a.kind==='spawn');if(!a)throw Error('Spatial world needs explicit spawn');spatialMotion.initialize(Object.assign(p,a.position,{vx:0,vy:0,vz:0}));p.angle=a.yaw;p.navSurfaceId=spatial.supportPatch(p.supportId)?.navSurfaceId||null;}
function spatialMonster(kind){const as=spatial.definition.anchors.filter(a=>a.kind===kind+'-spawn'),a=as.find(a=>!eng.entities.some(e=>Math.hypot(e.x-a.position.x,e.y-a.position.y,e.z-a.position.z)<50));return a?eng.spawn(kind,a.position.x,a.position.y,{z:a.position.z}):null;}
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
function newHound(minSpawn=3000,awayFrom=[]){if(spatial)return spatialMonster(`hound`);const at=randomSpot(minSpawn,awayFrom.concat(ents()),1500);return at?eng.spawn(`hound`,at.x,at.y):null}
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
function newSmiler(minSpawn=1700,awayFrom=[]){if(spatial)return spatialMonster(`smiler`);const av=awayFrom.concat(ents());const at=smilerSpot(minSpawn,av)||randomSpot(minSpawn,av,1100,true,true)||randomSpot(minSpawn,av,1100);return at?eng.spawn(`smiler`,at.x,at.y):null}
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
  if(spatial)return eng.count(kind)<adminCap(kind)&&!!spatialMonster(kind);
  if(eng.count(kind)>=adminCap(kind))return false;
  const at=adminStressSpot(kind);if(!at)return false;
  eng.spawn(kind,at.x,at.y);return true;
}
function spawnMonsters(nh,ns){
  eng.clear();
  for(let i=0;i<nh;i++)newHound();
  for(let i=0;i<ns;i++)newSmiler();
}

/* --- glitched walls: the way out of Level 0 --- */
let glitches=[];
/* one rare find per world: a paranormal cartograph lying somewhere in the halls (first to reach it keeps it) */
let items=[];
function makeItems(){if(spatial)return spatial.definition.anchors.filter(a=>a.kind===`item`).map(a=>({id:a.id,...a.position,supportId:a.supportId}));const p=randomSpot(1800,glitches,700,true);return p?[{id:`cartograph`,x:Math.round(p.x),y:Math.round(p.y)}]:[]}
function makeGlitches(n=3){
  if(spatial)return spatial.definition.anchors.filter(a=>a.kind===`exit`).map(a=>({...a.position,nx:0,ny:0,supportId:a.supportId}));
  const out=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let t=0;t<6000&&out.length<n;t++){
    const tx=(RND()*FBW)|0,ty=(RND()*FBH)|0;if(!zc(tx,ty))continue;
    const d=dirs[(RND()*4)|0],nx=tx+d[0],ny=ty+d[1];
    if(nx<1||ny<1||nx>=FBW-1||ny>=FBH-1||!Hc(nx,ny))continue;
    const cx=(tx+.5)*96,cy=(ty+.5)*96;if(!sl(cx,cy))continue;
    const x=cx+d[0]*48,y=cy+d[1]*48;
    if(Math.hypot(x-Ic.x,y-Ic.y)<2600||out.some(o=>Math.hypot(o.x-x,o.y-y)<2600))continue;
    if(!fl({x:cx,y:cy},ANCHOR).length)continue;
    out.push({x,y,nx:d[0],ny:d[1]});
  }
  return out;
}

/* --- bodies: one per player, visible to everyone (client sends the finished record) --- */
const bodies=new Map(),bodyT=new Map();let bodyVer=1,clockT=0,pruneT=0,physicsTick=0;
const deathPhysics=spatial?require('./death_srv'):null,aftermaths=new Map();
const BODY_TTL=Math.max(0,+opts.bodyTtl||0);          // seconds a body stays in the halls; 0 = until the world resets or its owner dies again (server.js: BODY_TTL env)
function navCmd(eid,cmd,p){const e=eng.entities.find(o=>o.id===eid);if(!e)return null;return eng.navCmd(e,cmd,p)}
function killerEnd(id,x,y,a){return eng.commitEnd(id,x,y,a)}
function setBody(id,rec){if(spatial&&!rec.spatial)return false;bodies.delete(id);bodies.set(id,rec);bodyT.set(id,clockT);while(bodies.size>MAX_BODIES){const k=bodies.keys().next().value;bodies.delete(k);bodyT.delete(k)}bodyVer++}
function updateBody(id,rec){if(!bodies.has(id))return false;bodies.set(id,rec);bodyVer++;return true;}
function startAftermath(p){
  const id={worldEpoch:opts.worldEpoch?opts.worldEpoch():`sim:${SIM_SEED}:${worldGeneration}`,victimId:String(p.id),lifeGeneration:p.life||0,deathSequence:p.dseq};
  const prior=aftermaths.get(p.id);if(prior?.event.key===deathPhysics.deathKey(id))return prior;
  if(prior)releaseAttacker(prior);
  const info=opts.deathInfo?opts.deathInfo(p):{name:'WANDERER',look:'cap|plain|#e6bb76|#ffcc77|none',ek:p.equipment.kind,light:p.light,ex:p.ex};
  const a=deathPhysics.startSpatial(id,p.kill,info,spatial,physicsTick);aftermaths.delete(p.id);aftermaths.set(p.id,a);
  const attacker=eng.entities.find(e=>e.id===a.attackerId);if(attacker){attacker.deathOwner=a.event.key;attacker.path=[];attacker.trav=null;attacker.lunge=null;}
  applyAttacker(a);setBody(p.id,deathPhysics.spatialRecord(a));pruneAftermaths();return a;
}
function applyAttacker(a){const e=eng.entities.find(e=>e.id===a.attackerId);if(!e||e.deathOwner!==a.event.key)return;const at=a.S.at;Object.assign(e,{x:at.x,y:at.y,z:at.z,vx:at.vx,vy:at.vy,vz:at.vz,ang:at.a,supportId:at.supportId,normal:at.normal,motionMode:at.motionMode,navSurfaceId:spatial.supportPatch(at.supportId)?.navSurfaceId||null,physTick:eng.ticks});}
function releaseAttacker(a){if(a.released)return;applyAttacker(a);const e=eng.entities.find(e=>e.id===a.attackerId);if(e&&e.deathOwner===a.event.key){delete e.deathOwner;if(e.commit)e.commit.body=true;e.wd={x:e.x,y:e.y,t:0};}a.released=true;}
function pruneAftermaths(){for(const [id,a]of aftermaths)if(!bodies.has(id)){releaseAttacker(a);aftermaths.delete(id);}}
function stepAftermaths(){
  if(!spatial)return;pruneAftermaths();
  for(const [id,a]of aftermaths){deathPhysics.advanceSpatial(a,physicsTick);if(!a.released){applyAttacker(a);if(a.S.stepN>=Math.ceil(a.S.dur*240))releaseAttacker(a);}updateBody(id,deathPhysics.spatialRecord(a));}
}
function pruneBodies(dt){
  if(!BODY_TTL||!bodies.size)return;
  pruneT-=dt;if(pruneT>0)return;pruneT=1;let ch=false;
  for(const [id,t] of bodyT)if(clockT-t>BODY_TTL){bodies.delete(id);bodyT.delete(id);ch=true}
  if(ch)bodyVer++;
}

function resetWorld(){
  worldGeneration++;if(spatial)clockT=0;
  Lc();runT=0;PR=0;eng.pressure=0;spawnT=rnd(70,150);
  spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));      // 1-2 hounds to begin with (up to 3 later), 2-5 smilers
  glitches=makeGlitches(3);items=makeItems();
  for(const a of aftermaths.values())releaseAttacker(a);aftermaths.clear();bodies.clear();bodyT.clear();bodyVer++;
}
function addPlayer(id){
  const p={id,x:Ic.x,y:Ic.y,vx:0,vy:0,angle:0,sprinting:false,light:true,equipment:{kind:`flashlight`},
    active:false,dead:``,dseq:0,safe:0,exited:false,t0:0,
    alive:false,kind:`flashlight`,st:0,sp:0,stamina:100,ex:0,prof:1,evq:[],caught:null,kill:null};
  if(spatial)spatialSpawn(p);players.push(p);return p;
}
function removePlayer(p){eng.forgetPlayer(p.id);const i=players.indexOf(p);if(i>=0)players.splice(i,1)}
function spawn(p){eng.forgetPlayer(p.id);p.life=(p.life||0)+1;Object.assign(p,{x:Ic.x,y:Ic.y,vx:0,vy:0,dead:``,safe:3,exited:false,caught:null,kill:null,st:0,sp:0,stamina:100,ex:0});p.evq.length=0;if(spatial)spatialSpawn(p)}
function join(p,now=Date.now()/1000){
  const L=lifeOf(p);if(L===`held`||(L===`alive`&&!vanished(p,now)))return false;       // no walking out of a capture, no new run without the new-run sequence
  p.vanishOk=false;                                                    // a vanish opens one new run (its 30 s cooldown still counts)
  const others=players.some(o=>o!==p&&o.active&&!o.exited);
  p.active=true;spawn(p);p.t0=runT;
  if(!others)resetWorld();
  return true;
}
/* the player lifecycle.  respawn is the way back from a death: legal only for an active player who is dead, or whom an admin has
   revived (revive clears the death and leaves a one-time permit).  A living player - free or held in a capture - cannot respawn: that
   would be a free teleport home with full stamina and spawn protection.  Returns whether it happened. */
function canRespawn(p){return !!(p.active&&(p.dead||p.reviveOk))}
function respawn(p){if(!canRespawn(p))return false;if(p.pvEnt){eng.remove(p.pvEnt);p.pvEnt=0}p.reviveOk=false;spawn(p);return true}
/* the rest of the lifecycle (v22.2).  A player is in the MENU (not in the world), ALIVE, HELD (in a capture) or DEAD.
 *   join   (start a run)  from the menu or from death; from ALIVE only as the end of a finished new-run vanish; never while HELD
 *   leave  (to the menu)  from death, or from ALIVE as the end of a finished vanish; never while HELD (the body stays in the capture)
 *   vanish (the client's NEW RUN sequence: 2.7 s on screen, protected, standing still) only while ALIVE, at most once every 30 s
 *   disconnect while HELD = the capture is forfeited: the holder kills (forfeit), so a reconnect is a new player after a death, not an escape
 * The server passes its clock (seconds); a finished vanish is one started 2 to 20 s ago. */
const lifeOf=p=>!p.active?`menu`:p.dead?`dead`:p.caught?`held`:`alive`;
const VANISH_MIN=2,VANISH_MAX=20,VANISH_CD=30;
const vanished=(p,now)=>!!p.vanishOk&&now-p.vanishAt>=VANISH_MIN&&now-p.vanishAt<=VANISH_MAX;       // a finished vanish not used yet
function vanish(p,now=Date.now()/1000){if(lifeOf(p)!==`alive`)return false;if(p.vanishAt!=null&&now-p.vanishAt<VANISH_CD)return false;p.vanishAt=now;p.vanishOk=true;p.safe=Math.max(p.safe,4);return true}
function forfeit(p){if(lifeOf(p)!==`held`)return false;const ok=eng.forfeitCapture(p);processEvents();return ok}
function leave(p,now=Date.now()/1000){const L=lifeOf(p);if(L===`held`||(L===`alive`&&!vanished(p,now)))return false;if(L===`alive`)p.vanishOk=false;p.active=false;p.dead=``;p.caught=null;eng.forgetPlayer(p.id);return true}

/* movement validation (server.js): could a body get from a to b?  Only real walls and full-height furniture count ('any' mode: every
   crawl hole, table and vaultable prop is passable, since the client's own movement handles those).  Short hops are checked along the
   segment; a long one (packets bunched up after a lag spike) needs a walkable route no longer than the distance budget. */
function moveOk(x0,y0,x1,y1,budget){
  WORLD.setMode(`any`);
  try{
    if(!sl(x1,y1,4))return false;
    const d=Math.hypot(x1-x0,y1-y0);if(d<1)return true;
    let clearLine=true;for(let s=8;s<d;s+=8){const k=s/d;if(!sl(x0+(x1-x0)*k,y0+(y1-y0)*k,3)){clearLine=false;break}}
    if(clearLine)return true;
    if(d<120)return false;
    const r=eng.geo.path(x0,y0,x1,y1,{CAN_VAULT:true,CAN_CRAWL:true,CAN_USE_TIGHT_GAPS:true});
    if(!r||!r.length)return false;
    let L=0,px=x0,py=y0;for(const w of r){L+=Math.hypot(w.x-px,w.y-py);px=w.x;py=w.y}
    return L<=budget*1.25+60;
  }finally{WORLD.setMode(`walk`)}
}
/* where a client may put itself when it starts a run or respawns: the client picks its own spawn (open floor away from the monsters, the
   bundle's Xrs); the server only checks it is such a spot (with some margin for how far the monsters moved while the packet travelled) */
function spawnOk(x,y){
  if(!sl(x,y,20))return false;
  for(const e of eng.entities){const d=Math.hypot(e.x-x,e.y-y);if(e.kind===`hound`&&d<1100)return false;if(e.kind===`smiler`&&d<600&&e.state!==`HIDDEN`)return false}
  return true;
}
/* what the client tells us about how it is moving: state, speed, stamina and a few discrete noises (vault, landing, slide) */
function hearMove(p,m){
  if(!m||typeof m!==`object`||Array.isArray(m))return false;
  const c=(v,lo,hi)=>Math.max(lo,Math.min(hi,+v||0));
  p.st=c(m.s,0,7)|0;p.stamina=c(m.st,0,100);p.ex=m.ex?1:0;p.sp=c(m.sp,0,600);
  p.claimSt=p.st;p.claimSp=p.sp;
  if(Array.isArray(m.ev))for(const e of m.ev.slice(0,6))if(Array.isArray(e)&&p.evq.length<12)p.evq.push([e[0]|0,c(e[1],0,100)]);
  return true;
}
/* the gait the AI hears, from the movement the server actually accepted (server.js measures it over ~0.5 s, p.obsV) - applied on every
   position update whether or not the client sent its movement report.  A report may add detail (crouch, crawl, slide and vault noises) but
   can never make the player quieter than that movement: fast while claiming to stand / crouch / crawl is heard as the gait the speed needs,
   walking claimed at running speed is heard as running.  With no (or a malformed) report the gait is the quietest one that speed allows. */
function gaitFloor(p,claimed){
  const ov=p.obsV||0;let st,sp;
  if(claimed){st=p.claimSt|0;sp=p.claimSp||0}
  else{st=ov<20?0:ov<=106?3:ov<=225?1:2;sp=ov}
  if(ov>sp)sp=Math.min(600,ov);
  if((st===0||st===3||st===4)&&ov>150)st=ov>225?2:1;                       // (a walk is 172 px/s, 148 winded; a sprint 285, 236 on deep carpet: 225 lies between, with room for packet timing)
  else if(st===1&&ov>225)st=2;
  p.st=st;p.sp=sp;
}
/* the numbers the AI reads about each player, refreshed every step */
function feed(){
  for(const p of players){
    p.alive=isAlive(p);p.kind=p.equipment.kind;
    if(p.light&&!(Gc[p.kind]&&Gc[p.kind].power>0))p.light=false;   // (v23) `light` is VISIBLE light only: a raised camcorder emits none (its raised pose is presentation, server.js)
    if(p.caught)p.st=p.caught.phase===`down`?7:4;
    p.prof=WORLD.PROFILE[SNn[p.st]]??1;
  }
  eng.setPlayers(players);
}
function processEvents(){
  for(const ev of eng.drainEvents()){
    if(ev.t===`kill`){
      const p=eng.playerById(ev.pid);if(!p)continue;
      p.dead=ev.kind;p.dseq++;p.caught=null;eng.endHabits(p.id);
      const g=ev.geo;
      p.kill={v:ev.variant,k:ev.kind,e:ev.eid,ax:Math.round(g.ax),ay:Math.round(g.ay),aa:+g.aa.toFixed(3),w:g.wall?[Math.round(g.wall.x),Math.round(g.wall.y),+g.wall.ang.toFixed(3)]:0,
        x:Math.round(ev.victim.x),y:Math.round(ev.victim.y),a:+ev.victim.a.toFixed(3),why:ev.why};
      if(spatial){p.kill.physical=ev.physical;p.kill.x=ev.victim.x;p.kill.y=ev.victim.y;p.kill.a=ev.victim.a;startAftermath(p);}
      if(opts.onDeath)opts.onDeath(p);                                  // the death is committed: the server keeps its aftermath from this instant (server.js)
    }
  }
}
const capInfo=p=>{const c=p.caught;return c?{ph:c.phase,e:c.eid,k:c.kind,d:c.drag?[Math.round(c.drag.x),Math.round(c.drag.y)]:0}:0};

function step(dt){
  clockT+=dt;physicsTick++;pruneBodies(dt);
  for(const p of players)if(p.safe>0)p.safe-=dt;
  for(const p of players)if(p.active&&!p.dead&&!p.exited)              // touching a glitched wall takes you out
    for(const g of glitches)if(Math.hypot(p.x-g.x,p.y-g.y)<54&&(!spatial||(Math.abs(p.z-g.z)<12&&spatial.raycast({x:p.x,y:p.y,z:p.z+12},{x:g.x,y:g.y,z:g.z+12},`visible`)===null))){p.exited=true;p.exitSeq=(p.exitSeq|0)+1;p.exitT=runT-p.t0;p.active=false;break}
  if(frozen){stepAftermaths();return;}
  if(!players.some(p=>p.active&&!p.dead&&!p.exited)){stepAftermaths();return;}   // the halls hold their breath while nobody is alive
  dt*=speed;runT+=dt;
  if(bmode===`auto`)Rc(dt);else V.blackout=bmode===`on`;
  PR=PR+(Math.min(1,runT/540)-PR)*Math.min(1,dt);eng.pressure=PR;
  if(opts.director!==false&&eng.count(`hound`)<DIRECTOR_MAX_HOUNDS){spawnT-=dt;if(spawnT<=0){spawnT=rnd(80,190);if(RND()<.75)newHound(1800,alive())}}
  feed();
  eng.step(dt);
  processEvents();
  stepAftermaths();
}
const r1=n=>Math.round(n*10)/10;
function entities(){
  const s=eng.snapshot();
  return {st:+clockT.toFixed(3),h:s.h,m:s.m,b:V.blackout?1:0,p:+PR.toFixed(3),gw:glitches.map(g=>[Math.round(g.x),Math.round(g.y),g.nx,g.ny]),it:items.map(i=>[i.x,i.y,i.id]),
    lf:eng.geo.fails.map(f=>[Math.round(f.x),Math.round(f.y),Math.round(f.r),+(f.until-eng.now).toFixed(2)]),sn:eng.drainSounds().slice(-24)};
}
const ofKind=k=>ents().filter(e=>e.kind===k);
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
  freeze(on){frozen=!!on},
  speed(v){speed=Math.max(.25,Math.min(3,+v||1))},
  blackout(mode){bmode=[`on`,`off`,`auto`].includes(mode)?mode:`auto`;if(bmode===`auto`)V.elapsed=0},
  god(p){p.god=!p.god;return p.god},
  debug(on){debugOn=!!on;return debugOn},
  resetMonsters(){spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));runT=Math.min(runT,60)},
  resetWorld(){resetWorld();for(const p of players)if(p.active)spawn(p)},
  newGlitches(){glitches=makeGlitches(3)},
  newItem(){items=makeItems()},
  nearestItem(x,y){let b=null,bd=1/0;for(const i of items){const d=Math.hypot(i.x-x,i.y-y);if(d<bd){bd=d;b=i}}return b},
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
    let e=ofKind(kind).filter(o=>!o.cap&&!o.deathOwner).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],fresh=false;
    if(!e){
      if(eng.count(kind)>=adminCap(kind)){p.alive=was;return {ok:false,why:`every ${kind} is busy`}}
      const at=spatial?{x:p.x,y:p.y,z:p.z}:placeNear(kind,p.x,p.y)||{x:p.x,y:p.y};e=eng.spawn(kind,at.x,at.y,spatial?{z:at.z}:undefined);fresh=true;
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
  nearestGlitch(x,y){let b=null,bd=1/0;for(const g of glitches){const d=Math.hypot(g.x-x,g.y-y);if(d<bd){bd=d;b=g}}return b},
  summon(x,y,pid){                       // drop the nearest Hound a short way from (x,y) and set it on the trail
    const h=ofKind(`hound`).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(!h)return false;
    const p=placeNear(`hound`,x,y);if(!p)return false;
    return eng.summon(h,p.x,p.y,x,y,pid);
  },
  info(){const hs=ofKind(`hound`);return {fz:frozen?1:0,sp:speed,bo:bmode,hn:hs.length,sn:eng.count(`smiler`),mh:ADMIN_MAX_HOUNDS,ms:ADMIN_MAX_SMILERS,dh:DIRECTOR_MAX_HOUNDS,gw:glitches.length,it:items.length,pk:new Set(hs.map(h=>h.pack).filter(Boolean)).size,hs:hs.map(h=>h.state).join(`,`),dbg:debugOn?1:0,
    cm:eng.forceCapture||`auto`,es:ents().map(e=>[e.id,e.kind===`hound`?0:1,e.state,Math.round(e.x),Math.round(e.y),e.tier[0],e.cap?1:0])}},
};
function takeItem(p){const i=items.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<110&&(!spatial||(Math.abs(p.z-t.z)<12&&!spatial.raycast({x:p.x,y:p.y,z:p.z+12},{x:t.x,y:t.y,z:t.z+12},`visible`))));if(i<0)return null;eng.sound({x:p.x,y:p.y,...(spatial?{z:p.z}:{}),r:200,I:.4,type:`pick`,src:p.id});return items.splice(i,1)[0].id}
resetWorld();return {geometry:spatial||WG,spatialMotion,get worldGeneration(){return worldGeneration},takeItem,players,addPlayer,removePlayer,join,respawn,canRespawn,moveOk,spawnOk,leave,vanish,forfeit,gaitFloor,lifeOf,
  clearAt:(x,y,r)=>sl(x,y,r),blockersAt:(x,y)=>Bc(x,y),step,entities,resetWorld,admin,setBody,killerEnd,navCmd,hearMove,capInfo,
  debugInfo:()=>eng.debugInfo(),logSince:s=>eng.log.filter(l=>l.s>s),get logSeq(){return eng.logSeq},get engStats(){return eng.stats},get debugOn(){return debugOn},engine:eng,adapter,
  get aftermaths(){return aftermaths},get physicsTick(){return physicsTick},get bodies(){return bodies},get bodyVer(){return bodyVer},get glitches(){return glitches},get runT(){return runT},
  debug:{V,Ic,get glitches(){return glitches}}};


};
