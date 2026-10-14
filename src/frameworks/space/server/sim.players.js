/** @part generated/server/sim.js - S.P.A.C.E.: the world reset and the player lifecycle (join, spawn, respawn, NEW RUN's rules, forfeit, leave)
 * provides: NR_CD, addPlayer, canRespawn, forfeit, join, leave, lifeOf, newRun, nrWait, nrWhy, removePlayer, resetWorld, respawn, spawn
 * uses: Ic, Lc, PR, RND, bodies, bodyT, bodyVer, eng, glitches, items, makeGlitches, makeItems, players, processEvents, rnd, runT,
 *       spawnMonsters, spawnT, worldSeq
 * writes: PR, bodyVer, glitches, items, runT, spawnT, worldSeq
 */
function resetWorld(){
  worldSeq++;
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
function removePlayer(p){eng.forgetPlayer(p.id);const i=players.indexOf(p);if(i>=0)players.splice(i,1)}
function spawn(p){eng.forgetPlayer(p.id);p.life=(p.life||0)+1;Object.assign(p,{x:Ic.x,y:Ic.y,vx:0,vy:0,dead:``,safe:3,exited:false,caught:null,kill:null,st:0,sp:0,stamina:100,ex:0});p.evq.length=0}
function join(p){
  const L=lifeOf(p);if(L===`held`||L===`alive`)return false;           // no walking out of a capture; a living run ends only through NEW RUN (newRun) or a death
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
/* the rest of the lifecycle (v22.2; Stage 3D HQ2).  A player is in the MENU (not in the world), ALIVE, HELD (in a capture) or DEAD.
 *   join    (start a run)  from the menu or from death; never while ALIVE or HELD
 *   leave   (to the menu)  from death; never while ALIVE (a living run ends only through NEW RUN) or HELD (the body stays in the capture)
 *   newRun  NEW RUN, the server's own decision on the player's intent (server.js): only while ALIVE and free, at most once every 30 s
 *           (NR_CD); it takes the player out of the world at once (to the MENU), so the next join starts the new run.  nrWhy says why
 *           (Stage 3D HQ3: with free - the server's flag for an admin's own UNLIMITED NEW RUN - the 30 s does not count; nothing else changes)
 *           not ('state': in the menu or out through a glitched wall; 'dead'; 'held'; 'cooldown'), nrWait how long is left.  A world
 *           reset, a death, END and RESPAWN never touch it.
 *   disconnect while HELD = the capture is forfeited: the holder kills (forfeit), so a reconnect is a new player after a death, not an escape
 * The server passes its clock (seconds). */
const lifeOf=p=>!p.active?`menu`:p.dead?`dead`:p.caught?`held`:`alive`;
const NR_CD=30;
function nrWhy(p,now,free){const L=lifeOf(p);if(L===`menu`||p.exited)return`state`;if(L===`dead`)return`dead`;if(L===`held`)return`held`;if(!free&&p.nrAt!=null&&now-p.nrAt<NR_CD)return`cooldown`;return``}   // (Stage 3D HQ3: free - an admin's own UNLIMITED NEW RUN - skips only the cooldown)
const nrWait=(p,now)=>p.nrAt==null?0:Math.max(0,NR_CD-(now-p.nrAt));
function newRun(p,now=Date.now()/1000,free=false){const why=nrWhy(p,now,free);if(why)return why;p.nrAt=now;p.active=false;p.dead=``;p.caught=null;p.kill=null;eng.forgetPlayer(p.id);return``}
function forfeit(p){if(lifeOf(p)!==`held`)return false;const ok=eng.forfeitCapture(p);processEvents();return ok}
function leave(p){const L=lifeOf(p);if(L===`held`||L===`alive`)return false;p.active=false;p.dead=``;p.caught=null;eng.forgetPlayer(p.id);return true}

