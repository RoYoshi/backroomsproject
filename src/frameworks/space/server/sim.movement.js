/* src/frameworks/space/server/sim.movement.js - S.P.A.C.E.: movement as the server checks it (moveRoute, moveOk, spawnOk) and as the AI
 * hears it (hearMove, gaitFloor); a module of the sim (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module; its lines are sim.js's
 * at M8, as they were.
 *   simMovement({ WORLD, level, ai })   WORLD.setMode switches the collision's mode for a check and back. */
'use strict';
module.exports = function simMovement({ WORLD, level: { sl }, ai: { eng } }) {
/* movement validation (server.js): could a body get from a to b?  Only real walls and full-height furniture count ('any' mode: every
   crawl hole, table and vaultable prop is passable, since the client's own movement handles those).  Short hops are checked along the
   segment; a long one (packets bunched up after a lag spike) needs a walkable route no longer than the distance budget.
   Stage 3D HQ2: moveRoute is the same test, telling how the move is allowed: null (it is not), [] (along the straight line) or the
   route's points [[x, y], ...] (a long hop allowed only round walls), so the server can sweep the other players along what it allowed. */
function moveRoute(x0,y0,x1,y1,budget){
  WORLD.setMode(`any`);
  try{
    if(!sl(x1,y1,4))return null;
    const d=Math.hypot(x1-x0,y1-y0);if(d<1)return [];
    let clearLine=true;for(let s=8;s<d;s+=8){const k=s/d;if(!sl(x0+(x1-x0)*k,y0+(y1-y0)*k,3)){clearLine=false;break}}
    if(clearLine)return [];
    if(d<120)return null;
    const r=eng.geo.path(x0,y0,x1,y1,{CAN_VAULT:true,CAN_CRAWL:true,CAN_USE_TIGHT_GAPS:true});
    if(!r||!r.length)return null;
    let L=0,px=x0,py=y0;for(const w of r){L+=Math.hypot(w.x-px,w.y-py);px=w.x;py=w.y}
    return L<=budget*1.25+60?r.map(w=>[w.x,w.y]):null;
  }finally{WORLD.setMode(`walk`)}
}
function moveOk(x0,y0,x1,y1,budget){return moveRoute(x0,y0,x1,y1,budget)!==null}
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
return { gaitFloor, hearMove, moveOk, moveRoute, spawnOk };
};
