/* src/frameworks/gib/server/sim.bodies.js - G.I.B.: everyone's bodies, one per player, and how long they stay; and the sim's clock (a
 * snapshot's st), which the bodies and the death records are stamped with.  A module of the sim (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module.  Its lines are sim.js's
 * at M8, as they were, except what that tool lists: N.A.N.I.'s navCmd and killerEnd, which sat among these lines, are with the engine
 * in sim.ai.js.
 *   simBodies({ opts, ai })   returns the bodies (a Map), setBody(id, rec), tick(dt) (the run's step advances the clock and prunes
 *     the bodies through it, where it used to do both itself), clearBodies() (the world reset's), clock() and bodyVer() (both change). */
'use strict';
module.exports = function simBodies({ opts, ai: { MAX_BODIES } }) {
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
/* (C3) the clock's advance with the pruning, and the world reset's clearing: the run used to do both itself */
function tick(dt){clockT+=dt;pruneBodies(dt)}
function clearBodies(){bodies.clear();bodyT.clear();bodyVer++}
return { bodies, setBody, tick, clearBodies, clock: () => clockT, bodyVer: () => bodyVer };
};
