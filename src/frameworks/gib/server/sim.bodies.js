/** @part generated/server/sim.js - G.I.B.: everyone's bodies, one per player, and how long they stay
 * N.A.N.I.'s navCmd and killerEnd (the admin's nav command; where a kill left the Hound) sit among these lines, as they always did.
 * provides: bodies, bodyT, bodyVer, clockT, killerEnd, navCmd, pruneBodies, setBody
 * uses: MAX_BODIES, eng, opts
 * writes: -
 */
/* --- bodies: one per player, visible to everyone (client sends the finished record) --- */
const bodies=new Map(),bodyT=new Map();let bodyVer=1,clockT=0,pruneT=0;
const BODY_TTL=Math.max(0,+opts.bodyTtl||0);          // seconds a body stays in the halls; 0 = until the world resets or its owner dies again (server.js: BODY_TTL env)
function navCmd(eid,cmd,p){const e=eng.entities.find(o=>o.id===eid);if(!e)return null;return eng.navCmd(e,cmd,p)}
function killerEnd(id,x,y,a){return eng.commitEnd(id,x,y,a)}
function setBody(id,rec){bodies.delete(id);bodies.set(id,rec);bodyT.set(id,clockT);while(bodies.size>MAX_BODIES){const k=bodies.keys().next().value;bodies.delete(k);bodyT.delete(k)}bodyVer++}
function pruneBodies(dt){
  if(!BODY_TTL||!bodies.size)return;
  pruneT-=dt;if(pruneT>0)return;pruneT=1;let ch=false;
  for(const [id,t] of bodyT)if(clockT-t>BODY_TTL){bodies.delete(id);bodyT.delete(id);ch=true}
  if(ch)bodyVer++;
}

