
/* ---------- multiplayer glue (v16): the shared AI engine (ai.js) drives every Hound and Smiler.
   The old single-hound / single-smiler code that used to sit above this line has been replaced by that engine;
   everything the entities know about players reaches them through perception (see ai.js). ---------- */
const AI=require('./ai.js');
const RND=opts.seed?AI.mkRng(opts.seed):Math.random;
var PR=0;const ANCHOR={x:1056,y:3264};   // spawn is hard against a wall; this open spot next to it is used for reachability checks
const players=[];
let frozen=false,speed=1,bmode=`auto`,runT=0,spawnT=0,debugOn=false;
const MAX_HOUNDS=3,MAX_SMILERS=5,MAX_BODIES=24;
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
  qc:(p,pt,on)=>qc(p,pt,on)};
const eng=AI.create({adapter,rng:RND});

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
function newSmiler(minSpawn=1700,awayFrom=[]){const av=awayFrom.concat(ents());const at=randomSpot(minSpawn,av,1100,true,true)||randomSpot(minSpawn,av,1100);return at?eng.spawn(`smiler`,at.x,at.y):null}
function spawnMonsters(nh,ns){
  eng.clear();
  for(let i=0;i<nh;i++)newHound();
  for(let i=0;i<ns;i++)newSmiler();
}

/* --- glitched walls: the way out of Level 0 --- */
let glitches=[];
/* one rare find per world: a paranormal cartograph lying somewhere in the halls (first to reach it keeps it) */
let items=[];
function makeItems(){const p=randomSpot(1800,glitches,700,true);return p?[{id:`cartograph`,x:Math.round(p.x),y:Math.round(p.y)}]:[]}
function makeGlitches(n=3){
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
const bodies=new Map(),bodyT=new Map();let bodyVer=1,clockT=0,pruneT=0;
const BODY_TTL=Math.max(0,+opts.bodyTtl||0);          // seconds a body stays in the halls; 0 = until the world resets or its owner dies again (server.js: BODY_TTL env)
function setBody(id,rec){bodies.delete(id);bodies.set(id,rec);bodyT.set(id,clockT);while(bodies.size>MAX_BODIES){const k=bodies.keys().next().value;bodies.delete(k);bodyT.delete(k)}bodyVer++}
function pruneBodies(dt){
  if(!BODY_TTL||!bodies.size)return;
  pruneT-=dt;if(pruneT>0)return;pruneT=1;let ch=false;
  for(const [id,t] of bodyT)if(clockT-t>BODY_TTL){bodies.delete(id);bodyT.delete(id);ch=true}
  if(ch)bodyVer++;
}

function resetWorld(){
  Lc();runT=0;PR=0;eng.pressure=0;spawnT=rnd(70,150);
  spawnMonsters(RND()<.5?1:2,2+((RND()*4)|0));      // 1-2 hounds to begin with (up to 3 later), 2-5 smilers
  glitches=makeGlitches(3);items=makeItems();
  bodies.clear();bodyT.clear();bodyVer++;
}
function addPlayer(id){
  const p={id,x:Ic.x,y:Ic.y,vx:0,vy:0,angle:0,sprinting:false,light:true,equipment:{kind:`flashlight`},
    active:false,dead:``,dseq:0,safe:0,exited:false,t0:0,
    alive:false,kind:`flashlight`,st:0,sp:0,stamina:100,ex:0,prof:1,evq:[],caught:null,kill:null};
  players.push(p);return p;
}
function removePlayer(p){const i=players.indexOf(p);if(i>=0)players.splice(i,1)}
function spawn(p){Object.assign(p,{x:Ic.x,y:Ic.y,vx:0,vy:0,dead:``,safe:3,exited:false,caught:null,kill:null,st:0,sp:0,stamina:100,ex:0});p.evq.length=0}
function join(p){
  const others=players.some(o=>o!==p&&o.active&&!o.exited);
  p.active=true;spawn(p);p.t0=runT;
  if(!others)resetWorld();
}
function respawn(p){if(p.pvEnt){eng.remove(p.pvEnt);p.pvEnt=0}if(p.active)spawn(p)}
function leave(p){p.active=false;p.dead=``;p.caught=null}

/* what the client tells us about how it is moving: state, speed, stamina and a few discrete noises (vault, landing, slide) */
function hearMove(p,m){
  if(!m||typeof m!==`object`)return;
  const c=(v,lo,hi)=>Math.max(lo,Math.min(hi,+v||0));
  p.st=c(m.s,0,7)|0;p.stamina=c(m.st,0,100);p.ex=m.ex?1:0;p.sp=c(m.sp,0,600);
  if(Array.isArray(m.ev))for(const e of m.ev.slice(0,6))if(Array.isArray(e)&&p.evq.length<12)p.evq.push([e[0]|0,c(e[1],0,100)]);
}
/* the numbers the AI reads about each player, refreshed every step */
function feed(){
  for(const p of players){
    p.alive=isAlive(p);p.kind=p.equipment.kind;
    if(p.caught)p.st=p.caught.phase===`down`?7:4;
    p.prof=WORLD.PROFILE[SNn[p.st]]??1;
  }
  eng.setPlayers(players);
}
function processEvents(){
  for(const ev of eng.drainEvents()){
    if(ev.t===`kill`){
      const p=eng.playerById(ev.pid);if(!p)continue;
      p.dead=ev.kind;p.dseq++;p.caught=null;
      const g=ev.geo;
      p.kill={v:ev.variant,k:ev.kind,e:ev.eid,ax:Math.round(g.ax),ay:Math.round(g.ay),aa:+g.aa.toFixed(3),w:g.wall?[Math.round(g.wall.x),Math.round(g.wall.y),+g.wall.ang.toFixed(3)]:0,
        x:Math.round(ev.victim.x),y:Math.round(ev.victim.y),a:+ev.victim.a.toFixed(3),why:ev.why};
    }
  }
}
const capInfo=p=>{const c=p.caught;return c?{ph:c.phase,e:c.eid,k:c.kind,d:c.drag?[Math.round(c.drag.x),Math.round(c.drag.y)]:0}:0};

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
  if(opts.director!==false&&eng.count(`hound`)<MAX_HOUNDS){spawnT-=dt;if(spawnT<=0){spawnT=rnd(80,190);if(RND()<.75)newHound(1800,alive())}}
  feed();
  eng.step(dt);
  processEvents();
}
const r1=n=>Math.round(n*10)/10;
function entities(){
  const s=eng.snapshot();
  return {h:s.h,m:s.m,b:V.blackout?1:0,p:+PR.toFixed(3),gw:glitches.map(g=>[Math.round(g.x),Math.round(g.y),g.nx,g.ny]),it:items.map(i=>[i.x,i.y,i.id]),
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
  addHound(){if(eng.count(`hound`)>=MAX_HOUNDS)return false;return !!newHound(1500,alive())},
  removeHound(){const h=ofKind(`hound`).pop();if(h)eng.remove(h.id);return !!h},
  addSmiler(){if(eng.count(`smiler`)>=MAX_SMILERS)return false;return !!newSmiler(1200,alive())},
  removeSmiler(){const s=ofKind(`smiler`).pop();if(s)eng.remove(s.id);return !!s},
  addNear(kind,x,y){                       // testing aid: one more of that entity close to an admin (still capped)
    if(eng.count(kind)>=(kind===`hound`?MAX_HOUNDS:MAX_SMILERS))return false;
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
      if(eng.count(kind)>=(kind===`hound`?MAX_HOUNDS:MAX_SMILERS)){p.alive=was;return {ok:false,why:`every ${kind} is busy`}}
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
  nearestGlitch(x,y){let b=null,bd=1/0;for(const g of glitches){const d=Math.hypot(g.x-x,g.y-y);if(d<bd){bd=d;b=g}}return b},
  summon(x,y,pid){                       // drop the nearest Hound a short way from (x,y) and set it on the trail
    const h=ofKind(`hound`).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(!h)return false;
    const p=placeNear(`hound`,x,y);if(!p)return false;
    return eng.summon(h,p.x,p.y,x,y,pid);
  },
  info(){const hs=ofKind(`hound`);return {fz:frozen?1:0,sp:speed,bo:bmode,hn:hs.length,sn:eng.count(`smiler`),gw:glitches.length,it:items.length,pk:new Set(hs.map(h=>h.pack).filter(Boolean)).size,hs:hs.map(h=>h.state).join(`,`),dbg:debugOn?1:0,
    cm:eng.forceCapture||`auto`,es:ents().map(e=>[e.id,e.kind===`hound`?0:1,e.state,Math.round(e.x),Math.round(e.y),e.tier[0],e.cap?1:0])}},
};
function takeItem(p){const i=items.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<110);if(i<0)return null;eng.sound({x:p.x,y:p.y,r:200,I:.4,type:`pick`,src:p.id});return items.splice(i,1)[0].id}
resetWorld();return {takeItem,players,addPlayer,removePlayer,join,respawn,leave,step,entities,resetWorld,admin,setBody,hearMove,capInfo,
  debugInfo:()=>eng.debugInfo(),logSince:s=>eng.log.filter(l=>l.s>s),get logSeq(){return eng.logSeq},get engStats(){return eng.stats},get debugOn(){return debugOn},engine:eng,adapter,
  get bodies(){return bodies},get bodyVer(){return bodyVer},get glitches(){return glitches},get runT(){return runT},
  debug:{V,Ic,get glitches(){return glitches}}};

};
