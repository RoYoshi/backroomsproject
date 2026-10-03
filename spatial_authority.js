/* Stage F server boundary: validates the retained client motor, never runs a new motor. */
'use strict';
const P=require('./spatial_protocol'),M=require('./world_motion');
const clone=x=>JSON.parse(JSON.stringify(x));
const speedCap={stand:20,walk:205,run:310,crouch:130,crawl:100,slide:360,down:130,vault:360};
class Authority {
 constructor(room,send){this.room=room;this.g=room.sim.geometry;this.motion=room.sim.spatialMotion;this.send=send;this.stats={accepted:0,rejected:0,corrections:0,maxQueue:0,maxHistory:0,maxWork:0,work:0,ownedTicks:0,reasons:{}};this.cursor=0;}
 identity(c){return {worldEpoch:this.room.worldEpoch,entityId:'p'+c.id,generation:c.player.life||0,seq:this.room.simTick,tick:this.room.simTick,discontinuity:c.spatial?.discontinuity||0};}
 pose(c){return P.pose(c.player,this.identity(c),this.g);}
 reset(c,cause){const old=c.spatial;c.spatial={life:c.player.life||0,discontinuity:(old?.discontinuity||0)+1,lastSeq:old?.lastSeq||0,lastTick:this.room.simTick,queue:[],history:[],credit:0,budget:540,owned:false,mode:c.player.caught?'captured':c.player.dead?'dead':c.player.motionMode};this.correct(c,cause,false);}
 correct(c,cause,bump=true){const a=c.spatial;if(!a)return;if(bump)a.discontinuity++;a.queue.length=0;a.lastTick=this.room.simTick;a.credit=0;a.history.length=0;this.stats.corrections++;this.send(c,{t:'correction',cause,pose:this.pose(c)});}
 reject(c,why,reconcile=false){this.stats.rejected++;this.stats.reasons[why]=(this.stats.reasons[why]||0)+1;if(reconcile)this.correct(c,why);return false;}
 enqueue(c,m){const a=c.spatial;if(!a||!c.protocolReady)return this.reject(c,'handshake');
  if(m.worldEpoch!==this.room.worldEpoch||m.geometryHash!==this.g.identity.contentHash||m.life!==a.life||m.ack!==a.discontinuity)return this.reject(c,'identity');
  if(!P.integer(m.seq)||m.seq<=a.lastSeq)return this.reject(c,'sequence');
  if(!c.player.active||c.player.dead||c.player.caught)return this.reject(c,'lifecycle');
  const ss=m.samples;if(!Array.isArray(ss)||!ss.length||ss.length>P.LIMIT.samples)return this.reject(c,'sample-bound');
  let last=a.queue.at(-1)?.tick??a.lastTick;
  for(const q of ss){if(!q||!P.integer(q.tick)||q.tick!==last+1||q.tick>this.room.simTick||this.room.simTick-q.tick>P.LIMIT.history)return this.reject(c,'tick',q?.tick<=this.room.simTick&&P.integer(q?.tick)&&q.tick>last);
   if(!['x','y','z','vx','vy','yaw'].every(k=>P.finite(q[k],k==='yaw'?100:k==='vx'||k==='vy'?360:P.LIMIT.coordinate))||!Object.hasOwn(speedCap,q.posture)||!(q.support===null||P.id(q.support))||!(q.link==null||P.id(q.link))||q.progress!=null)return this.reject(c,'malformed');
   if(q.mv&&(!P.finite(q.mv.st,100)||q.mv.st<0||!P.integer(q.mv.s)||q.mv.s>7||!P.finite(q.mv.sp,600)))return this.reject(c,'gait');last=q.tick;
  }
  if(a.queue.length+ss.length>P.LIMIT.queue)return this.reject(c,'queue',true);
  a.lastSeq=m.seq;
  if(a.owned)return this.reject(c,'server-owned');
  a.queue.push(...ss.map(clone));this.stats.maxQueue=Math.max(this.stats.maxQueue,a.queue.length);return true;
 }
 afterSim(){for(const c of this.room.clients.values()){const a=c.spatial,p=c.player;if(!a)continue;const mode=p.dead?'dead':p.caught?'captured':p.motionMode;
  if(mode==='captured'&&!p.dead&&a.mode==='captured'){const target=p.caught.drag;this.motion.posture(p,p.caught.phase==='down'?'down':'crawl');if(target){const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),v=Math.min(130,d*60);p.vx=d?dx/d*v:0;p.vy=d?dy/d*v:0;}else p.vx=p.vy=0;this.motion.step(p);this.publish(c);}
  if(mode!==a.mode&&(mode==='captured'||mode==='dead'||a.mode==='captured')){a.owned=false;p.step=null;p.trav=null;p.vx=p.vy=p.vz=0;this.correct(c,mode);a.mode=mode;}
 }}
 beginWake(){this.stats.work=0;}
 publish(c){const p=c.player;p.navSurfaceId=this.g.supportPatch(p.supportId)?.navSurfaceId||null;}
 step(){const cs=[...this.room.clients.values()];if(!cs.length)return;
  for(const c of cs){if(!c.spatial)continue;const a=c.spatial,p=c.player;
   if(a.life!==(p.life||0)){this.reset(c,'life');continue;}
   const mode=p.dead?'dead':p.caught?'captured':p.motionMode;
   if((mode==='dead'||mode==='captured')&&a.mode!==mode){a.owned=false;p.trav=null;p.step=null;p.vx=p.vy=p.vz=0;this.correct(c,mode);}
   a.mode=mode;if(!p.active||p.dead||p.caught)continue;
   a.credit=Math.min(90,a.credit+1);a.budget=Math.min(540,a.budget+6);
   if(a.owned){const previous={x:p.x,y:p.y,z:p.z};if(p.trav){const t=p.trav,target=t.link.corridor[Math.min(t.segment,t.link.corridor.length-1)],dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);if(d<1.8&&t.segment<t.link.corridor.length-1)t.segment++;const v=Math.min(a.ownedSpeed||172,d*60);this.motion.advanceTraversal(p,t,{x:d?dx/d*v:0,y:d?dy/d*v:0});if(t.status!=='active')p.trav=null;}else this.motion.step(p);
    this.stats.ownedTicks++;this.publish(c);p.obsV=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z)*60;this.room.sim.gaitFloor(p,false);
    if(!p.trav&&p.motionMode==='grounded'){a.owned=false;p.vx=p.vy=0;this.correct(c,'grounded');}continue;}
  }
  // Round-robin validation shares a hard room-wake budget. Never replay AI.
  for(let round=0;round<15&&this.stats.work<P.LIMIT.work;round++){let any=false;for(let j=0;j<cs.length&&this.stats.work<P.LIMIT.work;j++){
   const c=cs[(this.cursor+j)%cs.length],a=c.spatial,p=c.player;if(!a||a.owned||!a.queue.length||!p.active||p.dead||p.caught)continue;any=true;
   const q=a.queue.shift();this.stats.work++;
   if(q.tick!==a.lastTick+1||q.tick>this.room.simTick||this.room.simTick-q.tick>90||a.credit<1){this.reject(c,'credit',true);continue;}
   a.credit--;a.lastTick=q.tick;
   const b=clone(p); // bounded player state; no simulation/AI state is replayed
   b.events=[];b.diagnostics=[];
   if(!this.motion.posture(b,q.posture)){this.reject(c,'posture',true);continue;}
   // The retained motor decelerates exponentially; posture changes do not erase momentum.
   const previousSpeed=Math.hypot(p.vx,p.vy),cap=speedCap[q.posture],envelope=cap+Math.max(0,previousSpeed-cap)*Math.exp(-1/60);
   if(Math.hypot(q.vx,q.vy)>envelope+1){this.reject(c,'speed',true);continue;}
   b.vx=q.vx;b.vy=q.vy;b.angle=q.yaw;
   if(q.link){const l=this.g.definition.traversalLinks.find(l=>l.id===q.link);if(!l||!l.profileIds.includes(b.shape.id)){this.reject(c,'link',true);continue;}b.trav=this.motion.beginTraversal(b,l);if(!b.trav){this.reject(c,'link',true);continue;}}
   const before={x:b.x,y:b.y,z:b.z};
   if(!b.trav)this.motion.step(b);
   const distance=Math.hypot(b.x-before.x,b.y-before.y,b.z-before.z),transition=!!b.trav||b.motionMode!=='grounded';
   if(!this.g.clearance(b.shape,b).fits||b.diagnostics.length||distance>a.budget+28){this.reject(c,'collision-budget',true);continue;}
   if(!b.trav&&(Math.hypot(q.x-b.x,q.y-b.y)>.26||Math.abs(q.z-b.z)>.11||q.support!==b.supportId)){this.reject(c,'pose-claim',true);continue;}
   // On a physical transition the endpoint claim is discarded; the canonical
   // primitive owns time and emits a correction before any later sample can run.
   a.budget=Math.max(-28,a.budget-distance);
   for(const k of ['x','y','z','vx','vy','vz','angle','shape','posture','supportId','lastSupportId','normal','materialId','motionMode','step','tick','events','diagnostics','groundDistance','previousPosition','trav'])if(k in b)p[k]=b[k];
   p.obsV=distance*60;if(q.mv)this.room.sim.hearMove(p,q.mv);this.room.sim.gaitFloor(p,!!q.mv);this.publish(c);
   a.history.push({tick:q.tick,x:p.x,y:p.y,z:p.z,support:p.supportId});if(a.history.length>90)a.history.shift();this.stats.maxHistory=Math.max(this.stats.maxHistory,a.history.length);this.stats.accepted++;
   if(transition){a.owned=true;a.ownedSpeed=Math.min(360,Math.hypot(q.vx,q.vy)||172);p.traversalSpeed=a.ownedSpeed;this.correct(c,'physical-transition');}
  }if(!any)break;}
  this.cursor=(this.cursor+1)%cs.length;this.stats.maxWork=Math.max(this.stats.maxWork,this.stats.work);
 }
}
module.exports=Authority;
