/** @part generated/server/sim.js - core: the world's interface, the object createSim returns, which joins the parts; createSim closes here
 * P.O.C.K.E.T.'s takeItem (the cartograph's pick-up) sits just before the returned object, as it always did.
 * provides: -
 * uses: Bc, Ic, NR_CD, V, adapter, addPlayer, admin, bodies, bodyVer, canRespawn, capInfo, debugOn, eng, entities, forfeit, gaitFloor,
 *       glitches, hearMove, items, join, killerEnd, leave, lifeOf, moveOk, moveRoute, navCmd, newRun, nrWait, nrWhy, players,
 *       removePlayer, resetWorld, respawn, runT, setBody, sl, spawnOk, step, worldSeq
 * writes: -
 */
function takeItem(p){const i=items.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<110);if(i<0)return null;eng.sound({x:p.x,y:p.y,r:200,I:.4,type:`pick`,src:p.id});return items.splice(i,1)[0].id}
resetWorld();return {takeItem,players,addPlayer,removePlayer,join,respawn,canRespawn,moveOk,moveRoute,spawnOk,leave,newRun,nrWhy,nrWait,NR_CD,forfeit,gaitFloor,lifeOf,
  clearAt:(x,y,r)=>sl(x,y,r),blockersAt:(x,y)=>Bc(x,y),step,entities,resetWorld,admin,setBody,killerEnd,navCmd,hearMove,capInfo,
  debugInfo:()=>eng.debugInfo(),logSince:s=>eng.log.filter(l=>l.s>s),get logSeq(){return eng.logSeq},get engStats(){return eng.stats},get debugOn(){return debugOn},engine:eng,adapter,
  get bodies(){return bodies},get bodyVer(){return bodyVer},get glitches(){return glitches},get runT(){return runT},get worldSeq(){return worldSeq},
  debug:{V,Ic,get glitches(){return glitches}}};


};
