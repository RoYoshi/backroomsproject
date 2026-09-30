/* sim.js - server-side Level 0 simulation.
 * The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).
 * The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the admin tools. */
'use strict';
const WORLD=require('./world.js');
module.exports=function createSim(opts){opts=opts||{};
var FBW=96,FBH=72,Oc=[{x:3,y:27,w:18,h:18,name:`YELLOW HALL`,code:`01`},{x:25,y:25,w:19,h:20,name:`REPEATING ROOMS`,code:`02`},{x:49,y:28,w:18,h:17,name:`SEGMENTED ROOMS`,code:`03`},{x:25,y:7,w:20,h:12,name:`HUMMING ROOMS`,code:`04`},{x:4,y:7,w:17,h:12,name:`NORTH ROOMS`,code:`05`},{x:50,y:7,w:25,h:11,name:`LONG ROOM`,code:`06`},{x:4,y:50,w:18,h:13,name:`BLACKOUT ZONE`,code:`07`},{x:27,y:51,w:18,h:12,name:`DAMP ROOMS`,code:`08`},{x:51,y:51,w:18,h:12,name:`RED ROOMS`,code:`09`},{x:73,y:27,w:19,h:18,name:`ARCH GALLERY`,code:`10`},{x:77,y:7,w:15,h:14,name:`PILLAR HALL`,code:`11`},{x:73,y:51,w:19,h:13,name:`DEEP CARPET`,code:`12`}],kc=new Uint8Array(FBW*FBH);function Ac(e,t,n,r){for(let i=t;i<t+r;i++)for(let t=e;t<e+n;t++)t>=0&&i>=0&&t<FBW&&i<FBH&&(kc[i*FBW+t]=1)}function jc(e,t,n,r){for(let i=t;i<t+r;i++)for(let t=e;t<e+n;t++)t>=0&&i>=0&&t<FBW&&i<FBH&&(kc[i*FBW+t]=0)}Oc.forEach(e=>Ac(e.x,e.y,e.w,e.h)),[[20,33,6,4],[43,34,7,4],[66,34,8,4],[21,56,7,4],[44,57,8,4],[68,56,6,4],[19,11,7,4],[44,11,7,4],[74,11,4,4],[10,18,4,10],[32,18,4,8],[57,17,4,12],[82,20,4,8],[10,44,4,7],[33,44,4,8],[58,44,4,8],[82,44,4,8]].forEach(e=>Ac(...e)),[[9,28,1,8],[9,38,1,6],[15,32,1,12],[30,26,1,7],[30,35,1,9],[37,26,1,10],[37,38,1,6],[26,31,6,1],[34,39,9,1],[54,29,1,8],[54,39,1,5],[61,29,1,6],[61,37,1,7],[50,34,5,1],[57,40,9,1],[31,8,1,8],[38,10,1,8],[26,13,6,1],[34,15,10,1],[10,8,1,8],[16,10,1,8],[5,13,6,1],[56,8,1,7],[64,10,1,7],[71,8,1,8],[51,13,6,1],[59,15,6,1],[10,51,1,9],[16,53,1,9],[5,56,6,1],[33,52,1,10],[40,54,1,8],[28,57,6,1],[57,52,1,10],[64,54,1,8],[52,57,6,1],[79,28,1,7],[79,38,1,6],[86,31,1,12],[74,35,6,1],[83,8,1,5],[83,15,1,5],[79,52,1,10],[86,54,1,8],[74,58,6,1]].forEach(e=>jc(...e)),[[9,35,1,2],[15,36,1,2],[30,32,1,3],[37,35,1,3],[31,31,2,1],[39,39,2,1],[54,36,1,3],[61,34,1,3],[53,34,2,1],[62,40,2,1],[31,12,1,2],[38,13,1,2],[30,13,2,1],[39,15,2,1],[10,12,1,2],[16,14,1,2],[9,13,2,1],[56,12,1,2],[64,13,1,2],[71,12,1,2],[55,13,2,1],[63,15,2,1],[10,55,1,2],[16,57,1,2],[9,56,2,1],[33,56,1,2],[40,58,1,2],[32,57,2,1],[57,56,1,2],[64,58,1,2],[56,57,2,1],[79,34,1,2],[86,36,1,2],[78,35,2,1],[83,12,1,2],[83,17,1,2],[79,56,1,2],[86,58,1,2],[78,58,2,1]].forEach(e=>Ac(...e));WORLD.carve(kc,FBW);var Mc=[{x:53,y:9},{x:57,y:9},{x:61,y:9},{x:65,y:9},{x:69,y:9},{x:53,y:15},{x:57,y:15},{x:61,y:15},{x:65,y:15},{x:69,y:15}];for(let e of Mc)jc(e.x,e.y,1,1);var Nc=[];for(let e=0;e<FBH;e++)for(let t=0;t<FBW;t++)kc[e*FBW+t]||Nc.push({x:t*96,y:e*96,w:96,h:96});var Pc=[];for(let e of[79.5,84.5,89.5])for(let t of[9.5,14.5,19.5])Pc.push({x:e*96-28,y:t*96-28,w:56,h:56});var Fc=[];Oc.forEach((e,t)=>{if(t!==6)for(let n=e.x+2;n<e.x+e.w-1;n+=5)for(let r=e.y+2;r<e.y+e.h-1;r+=5)kc[r*FBW+n]&&Fc.push({x:(n+.5)*96,y:(r+.5)*96})});var Ic={x:960,y:3264},V={blackout:!1,elapsed:0,next:36,duration:0,number:0};function Lc(){Object.assign(V,{blackout:!1,elapsed:0,next:36,duration:0,number:0})}function Rc(e){return V.elapsed+=e,!V.blackout&&V.elapsed>=V.next?(V.blackout=!0,V.elapsed=0,V.duration=4.5+V.number%3,V.number++,`start`):V.blackout&&V.elapsed>=V.duration?(V.blackout=!1,V.elapsed=0,V.next=44+V.number%4*10,`end`):null}var zc=(e,t)=>e>=0&&t>=0&&e<FBW&&t<FBH&&kc[t*FBW+e]===1;function Bc(e,t){let n=[],r=Math.floor(e/96),i=Math.floor(t/96);for(let e=i-1;e<=i+1;e++)for(let t=r-1;t<=r+1;t++)zc(t,e)||n.push({x:t*96,y:e*96,w:96,h:96});for(let r of Pc)Math.abs(r.x-e)<250&&Math.abs(r.y-t)<250&&n.push(r);return WORLD.addNear(n,e,t)}var Vc=new Set(Mc.map(e=>e.y*FBW+e.x)),Hc=(e,t)=>e<0||t<0||e>=FBW||t>=FBH||!zc(e,t)&&!Vc.has(t*FBW+e);function Uc(e,t,n,r){let i=Math.cos(n),a=Math.sin(n),o=i>=0?1:-1,s=a>=0?1:-1,c=Math.floor(e/96),l=Math.floor(t/96),u=r;if(Hc(c,l))return 0;let d=Math.abs(i)<1e-10?1/0:96/Math.abs(i),f=Math.abs(a)<1e-10?1/0:96/Math.abs(a),p=Math.abs(i)<1e-10?1/0:((c+ +(o>0))*96-e)/i,m=Math.abs(a)<1e-10?1/0:((l+ +(s>0))*96-t)/a;for(;Math.min(p,m)<u;)if(Math.abs(p-m)<1e-8){let e=p;if(Hc(c+o,l)||Hc(c,l+s)){u=e;break}if(c+=o,l+=s,p+=d,m+=f,Hc(c,l)){u=e;break}}else if(p<m){let e=p;if(c+=o,p+=d,Hc(c,l)){u=e;break}}else{let e=m;if(l+=s,m+=f,Hc(c,l)){u=e;break}}for(let n of Pc){if(Math.abs(i)<1e-10&&(e<n.x||e>n.x+n.w)||Math.abs(a)<1e-10&&(t<n.y||t>n.y+n.h))continue;let r=Math.abs(i)<1e-10?-1/0:(n.x-e)/i,o=Math.abs(i)<1e-10?1/0:(n.x+n.w-e)/i,s=Math.abs(a)<1e-10?-1/0:(n.y-t)/a,c=Math.abs(a)<1e-10?1/0:(n.y+n.h-t)/a,l=Math.max(Math.min(r,o),Math.min(s,c));Math.min(Math.max(r,o),Math.max(s,c))>=Math.max(0,l)&&l>=0&&(u=Math.min(u,l))}return Math.max(0,u)}var Wc={kind:`flashlight`,color:`#ffe7b2`},Gc={flashlight:{label:`Flashlight`,range:390,arc:.92,power:.58,spill:56,omni:!1},headlamp:{label:`Headlamp`,range:262,arc:1.95,power:.5,spill:82,omni:!1},lantern:{label:`Lantern`,range:228,arc:Math.PI*2,power:.5,spill:200,omni:!0},camcorder:{label:`Night Vision Camcorder`,range:1,arc:.1,power:0,spill:1,omni:!1}},Kc=(e,t,n)=>{let r=Math.max(0,Math.min(1,(n-e)/(t-e)));return r*r*(3-2*r)};function qc(e,t,n){if(!n)return 0;let r=Gc[e.equipment?.kind]||Gc.flashlight,i=t.x-e.x,a=t.y-e.y,o=Math.hypot(i,a),s=Math.atan2(a,i)-e.angle,c=Math.abs(Math.atan2(Math.sin(s),Math.cos(s))),l=r.omni?1:1-Kc(r.arc*.11,r.arc*.5,c);return r.power*(1-Kc(24,r.range,o))*Math.max(l,(1-Kc(10,r.spill,o))*.4)}
var el=[1,2,3,4,5,6,7,8].map(e=>{let t=Oc[e],n=(t.x+t.w*.48)*96,r=(t.y+t.h*.55)*96;return Bc(n,r).some(e=>Math.hypot(n-Math.max(e.x,Math.min(n,e.x+e.w)),r-Math.max(e.y,Math.min(r,e.y+e.h)))<48)&&(n=(t.x+t.w*.7)*96,r=(t.y+t.h*.35)*96),{x:n,y:r,found:!1,room:t.name}});function tl(){for(let e of el)e.found=!1}function nl(){return el.reduce((e,t)=>e+Number(t.found),0)}function rl(e,t){let n=el.find(n=>!n.found&&Math.hypot(e-n.x,t-n.y)<42);return n?(n.found=!0,n):null}var il=48,W=FBW*2,al=FBH*2,ol=21;function sl(e,t,n=ol){return Bc(e,t).every(r=>Math.hypot(e-Math.max(r.x,Math.min(e,r.x+r.w)),t-Math.max(r.y,Math.min(t,r.y+r.h)))>=n)}function cl(e,t,n=ol){let r=Math.hypot(t.x-e.x,t.y-e.y),i=Math.ceil(r/12);for(let r=0;r<=i;r++){let a=i?r/i:0;if(!sl(e.x+(t.x-e.x)*a,e.y+(t.y-e.y)*a,n))return!1}return!0}var ll=new Uint8Array(W*al);for(let e=0;e<al;e++)for(let t=0;t<W;t++){let n=(t+.5)*il,r=(e+.5)*il;ll[e*W+t]=Number(zc(Math.floor(n/96),Math.floor(r/96))&&sl(n,r))}var ul=e=>({x:(e%W+.5)*il,y:(Math.floor(e/W)+.5)*il});function dl(e,t=!1){let n=-1,r=1/0,i=Math.floor(e.x/il),a=Math.floor(e.y/il);for(let o=Math.max(0,a-4);o<=Math.min(al-1,a+4);o++)for(let a=Math.max(0,i-4);a<=Math.min(W-1,i+4);a++){let i=o*W+a;if(!ll[i])continue;let s=ul(i),c=Math.hypot(e.x-s.x,e.y-s.y);c<r&&cl(e,s,t?1:ol)&&(n=i,r=c)}return n}function fl(e,t){let n=dl(e),r=dl(t,!0);if(n<0||r<0)return[];let i=new Int32Array(W*al).fill(-1),a=new Int32Array(W*al),o=0,s=1;for(a[0]=n,i[n]=n;o<s&&i[r]<0;){let e=a[o++];for(let t of[e-1,e+1,e-W,e+W])t<0||t>=W*al||!ll[t]||i[t]>=0||Math.abs(t%W-e%W)+Math.abs(Math.floor(t/W)-Math.floor(e/W))===1&&(i[t]=e,a[s++]=t)}if(i[r]<0)return[];let c=[];for(let e=r;e!==n;e=i[e])c.push(ul(e));return c.push(ul(n)),c.reverse(),cl(ul(r),t)&&c.push({...t}),c}function pl(e,t,n,r=ol){let i={...e};for(let a of[`x`,`y`]){e[a]+=a===`x`?t:n;for(let t of Bc(e.x,e.y)){let n=e.x-Math.max(t.x,Math.min(e.x,t.x+t.w)),o=e.y-Math.max(t.y,Math.min(e.y,t.y+t.h)),s=Math.hypot(n,o);s<r&&(s>0?(e.x+=n/s*(r-s),e.y+=o/s*(r-s)):e[a]=i[a])}}}

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
function killerEnd(id,x,y,a){return eng.commitEnd(id,x,y,a)}
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
resetWorld();return {takeItem,players,addPlayer,removePlayer,join,respawn,leave,step,entities,resetWorld,admin,setBody,killerEnd,hearMove,capInfo,
  debugInfo:()=>eng.debugInfo(),logSince:s=>eng.log.filter(l=>l.s>s),get logSeq(){return eng.logSeq},get engStats(){return eng.stats},get debugOn(){return debugOn},engine:eng,adapter,
  get bodies(){return bodies},get bodyVer(){return bodyVer},get glitches(){return glitches},get runT(){return runT},
  debug:{V,Ic,get glitches(){return glitches}}};

};
