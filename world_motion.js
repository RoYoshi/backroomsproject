/* Stage C: fixed-tick physical body motion. Input/stamina remain in move.js.
 * XYZ root is collider base. No renderer, networking, AI or damage policy. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TFB_MOTION=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const POLICY=Object.freeze({version:'stage-c-profile-1',dt:1/60,gravity:980,maxSlopeDegrees:35,maxStepRise:12,stepLiftMax:180,stepDuration:.10,skin:.05,maxContacts:8,maxGroundSegments:128,groundSegment:1,epsilon:1e-7});
const profile=(name,height,eyeHeight)=>Object.freeze({id:'profile:player-'+name,radius:15,height,eyeHeight,maxSlopeDegrees:35,maxStepRise:12,stepLiftMax:180});
const PROFILES=Object.freeze({stand:profile('stand',60,50),walk:profile('stand',60,50),run:profile('stand',60,50),crouch:profile('crouch',38,31),crawl:profile('crawl',24,18),slide:profile('slide',25,18),down:profile('down',18,9),vault:profile('vault',60,50)});
// Stage E collision envelopes only; existing species movement/capabilities still
// belong to their brains. Radius is the retained AI collision clearance (21).
const ENTITY_PROFILES=Object.freeze(Object.fromEntries([['hound',36,28],['smiler',48,36]].map(([name,height,eyeHeight])=>[name,Object.freeze({id:'profile:'+name,radius:21,height,eyeHeight,maxSlopeDegrees:35,maxStepRise:12,stepLiftMax:180})])));
// Stage G passive collision envelopes. Centers of hands/items are distinct from
// the root-base convention used by the body and the shared geometry queries.
const DEATH_PROFILES=Object.freeze(Object.fromEntries([
 ['body',18,18,0],['hand',5,10,5],['light',7,14,7],['hat',11,4,2],
 ['hound',18,36,0],['smiler',14,48,0]
].map(([id,radius,height,centerOffset])=>[id,Object.freeze({id:'profile:death-'+id,radius,height,centerOffset,maxStepRise:0})])));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),mul=(a,t)=>({x:a.x*t,y:a.y*t,z:a.z*t}),len=a=>Math.hypot(a.x,a.y,a.z),pose=b=>({x:b.x,y:b.y,z:b.z});
function create(geometry){
 if(geometry.identity.geometryMode!=='spatial')throw Error('world_motion requires explicit spatial geometry; flat motor remains unchanged');
 const eps=POLICY.epsilon,skin=POLICY.skin;
 function shape(body){return body.shape||PROFILES.stand;}
 function candidates(body,pos,lo,hi){return geometry.supports(shape(body),pos,[lo,hi],body.supportId);}
 function emit(b,type,data={}){b.events.push({tick:b.tick,type,...data});}
 function diagnostic(b,code){b.diagnostics.push({tick:b.tick,code});if(b.diagnostics.length>64)b.diagnostics.shift();}
 function setSupport(b,s){if(b.supportId!==s.id)emit(b,'support',{from:b.supportId,to:s.id});b.lastSupportId=b.supportId;b.supportId=s.id;b.normal=s.normal;b.materialId=s.materialId;b.motionMode='grounded';b.vz=0;}
 function leave(b){if(b.supportId)emit(b,'leave-support',{supportId:b.supportId});b.lastSupportId=b.supportId;b.supportId=null;b.motionMode='airborne';}
 function initialize(b,posture='stand',bodyProfile=PROFILES[posture]){
  if(![b.x,b.y,b.z].every(Number.isFinite))throw Error('Body requires finite XYZ');
  Object.assign(b,{vx:b.vx||0,vy:b.vy||0,vz:b.vz||0,shape:bodyProfile,posture,supportId:null,lastSupportId:null,motionMode:'airborne',step:null,tick:0,events:[],diagnostics:[],groundDistance:0,lowerBoundReported:false});
  if(!geometry.clearance(shape(b),b).fits)throw Error('Initial body overlaps solid');
  const s=candidates(b,b,b.z-skin*2,b.z+eps)[0];if(s&&b.vz<=0)setSupport(b,s);return b;
 }
 function posture(b,want){const p=PROFILES[want]||PROFILES.stand;if(!geometry.clearance(p,b).fits)return false;b.shape=p;b.posture=want;return true;}
 function moveSwept(b,delta){ // bounded collide-and-slide, never bypass a failed query
  let remaining={...delta},travel=0,last=pose(b);
  for(let i=0;i<POLICY.maxContacts;i++){
   if(len(remaining)<eps)return {travel};
   const hit=geometry.sweep(shape(b),b,remaining);
   if(!hit){Object.assign(b,add(b,remaining));travel+=len(remaining);return {travel};}
   const piece=mul(remaining,hit.t);Object.assign(b,add(b,piece));travel+=len(piece);last=pose(b);
   if(hit.diagnostic||len(hit.normal)<.5){diagnostic(b,hit.diagnostic||'UNRESOLVED_CONTACT');b.vx=b.vy=b.vz=0;return {travel,hit};}
   remaining=mul(remaining,1-hit.t);const into=dot(remaining,hit.normal);if(into<0)remaining=add(remaining,mul(hit.normal,-into));
   const velocity={x:b.vx,y:b.vy,z:b.vz},v=dot(velocity,hit.normal);if(v<0){const out=add(velocity,mul(hit.normal,-v));b.vx=out.x;b.vy=out.y;b.vz=out.z;}
   if(i===POLICY.maxContacts-1){Object.assign(b,last);b.vx=b.vy=b.vz=0;diagnostic(b,'CONTACT_LIMIT');return {travel,hit};}
  }return {travel};
 }
 function airborne(b,dt){
  let remain=dt;
  for(let i=0;i<POLICY.maxContacts&&remain>eps;i++){
   const oldVz=b.vz,delta={x:b.vx*remain,y:b.vy*remain,z:oldVz*remain-.5*POLICY.gravity*remain*remain},hit=geometry.sweep(shape(b),b,delta);
   if(!hit){Object.assign(b,add(b,delta));b.vz=oldVz-POLICY.gravity*remain;return;}
   // Linear chord is conservative within gravity*dt^2/8 = .0341 units (< skin).
   Object.assign(b,add(b,mul(delta,hit.t)));const elapsed=remain*hit.t;b.vz=oldVz-POLICY.gravity*elapsed;remain-=elapsed;
   if(hit.diagnostic||len(hit.normal)<.5){diagnostic(b,hit.diagnostic||'UNRESOLVED_AIR_CONTACT');b.vx=b.vy=b.vz=0;return;}
   const support=candidates(b,b,b.z-skin*2,b.z+eps).find(s=>s.solidId===hit.primitiveId&&s.normal.z>=Math.cos(shape(b).maxSlopeDegrees*Math.PI/180));
   if(b.vz<=0&&hit.normal.z>.5&&support){const impact=-b.vz;setSupport(b,support);emit(b,'land',{supportId:support.id,materialId:support.materialId,normal:support.normal,impactSpeed:impact});if(remain>eps)grounded(b,remain);return;}
   emit(b,'contact',{primitiveId:hit.primitiveId,normal:hit.normal});
   const v={x:b.vx,y:b.vy,z:b.vz},into=dot(v,hit.normal);if(into<0){const out=add(v,mul(hit.normal,-into));b.vx=out.x;b.vy=out.y;b.vz=out.z;}
   // Consume zero-time underside/lateral contact using tangential displacement.
   if(hit.t<eps){const tangent={x:b.vx*remain,y:b.vy*remain,z:b.vz*remain};moveSwept(b,tangent);b.vz-=POLICY.gravity*remain;return;}
  }
  if(remain>eps){diagnostic(b,'AIR_CONTACT_LIMIT');b.vx=b.vy=b.vz=0;}
 }
 function startStep(b,dx,dy){
  if(b.step||Math.hypot(dx,dy)<eps)return false;
  const ahead={x:b.x+dx*(skin*4),y:b.y+dy*(skin*4),z:b.z};
  const possible=candidates(b,ahead,b.z+skin,b.z+shape(b).maxStepRise+skin);
  const s=possible.filter(s=>s.normal.z>=Math.cos(shape(b).maxSlopeDegrees*Math.PI/180)).sort((a,b)=>a.z-b.z||a.id.localeCompare(b.id))[0];
  if(!s)return false;const target=s.z+skin,rise=target-b.z;
  if(geometry.sweep(shape(b),b,{x:0,y:0,z:rise}))return false;
  if(geometry.sweep(shape(b),{...b,z:target},{x:dx*skin*4,y:dy*skin*4,z:0}))return false;
  b.step={startZ:b.z,targetZ:target,t:0,duration:Math.max(POLICY.stepDuration,1.5*rise/shape(b).stepLiftMax),dx,dy,targetId:s.id,phase:'raise'};b.motionMode='step';emit(b,'step-start',{targetId:s.id,rise});return true;
 }
 function advanceStep(b,dt){
  const s=b.step,speed=Math.hypot(b.vx,b.vy);
  if(speed<eps||(b.vx*s.dx+b.vy*s.dy)/speed<.5){b.step=null;emit(b,'step-interrupted');leave(b);airborne(b,dt);return;}
  if(s.phase==='raise'){
   const used=Math.min(dt,s.duration-s.t);s.t+=used;const u=Math.min(1,s.t/s.duration),z=s.startZ+(s.targetZ-s.startZ)*u*u*(3-2*u),hit=geometry.sweep(shape(b),b,{x:0,y:0,z:z-b.z});
   if(hit){b.step=null;emit(b,'step-interrupted',{reason:'clearance'});leave(b);airborne(b,dt);return;}
   b.z=z;if(u>=1-eps)s.phase='forward';if(dt-used>eps)advanceStep(b,dt-used);return;
  }
  const delta={x:b.vx*dt,y:b.vy*dt,z:0},before=pose(b);moveSwept(b,delta);
  const possible=candidates(b,b,b.z-skin*2,b.z+eps);
  const target=possible.find(q=>q.id===s.targetId)||possible.find(q=>geometry.continuousSupport(s.targetId,q.id,b,shape(b)));
  if(target){b.step=null;setSupport(b,target);emit(b,'step-end',{supportId:target.id});grounded(b,0);}
  else if(Math.hypot(b.x-before.x,b.y-before.y)<eps||!geometry.supportPatch(s.targetId)){b.step=null;leave(b);}
  b.groundDistance+=Math.hypot(b.x-before.x,b.y-before.y);
 }
 function targetAlong(b,dx,dy,distance){
  const p={x:b.x+dx*distance,y:b.y+dy*distance,z:b.z},range=distance*Math.tan(shape(b).maxSlopeDegrees*Math.PI/180)+skin*2;
  const ss=candidates(b,p,b.z-range,b.z+range).filter(s=>s.normal.z>=Math.cos(shape(b).maxSlopeDegrees*Math.PI/180));
  // Body clearance already rejects a lower floor hidden inside a ramp/step.
  const s=ss[0];return s?{p:{...p,z:s.z+skin},s}:null;
 }
 function grounded(b,dt,contacts=0){
  if(contacts>=POLICY.maxContacts){diagnostic(b,'GROUND_CONTACT_LIMIT');b.vx=b.vy=0;return;}
  const speed=Math.hypot(b.vx,b.vy),dx=speed?b.vx/speed:0,dy=speed?b.vy/speed:0;
  let remaining=dt;
  const contactsNow=candidates(b,b,b.z-skin*2,b.z+eps);
  if(!contactsNow.some(s=>s.id===b.supportId)){
   const seam=contactsNow.find(s=>geometry.continuousSupport(b.supportId,s.id,b,shape(b)));
   if(seam)setSupport(b,seam);else{leave(b);airborne(b,dt);return;}
  }
  if(speed<eps)return;
  for(let i=0;i<POLICY.maxGroundSegments&&remaining>eps;i++){
   let budget=Math.min(POLICY.groundSegment,speed*remaining),xyLimit=Infinity;
   const current=geometry.supportPatch(b.supportId),range=geometry.footprintRange(current.polygon,b,shape(b).radius,current.plane);
   if(range)for(let j=0;j<current.polygon.length;j++){const a=current.polygon[j],c=current.polygon[(j+1)%current.polygon.length],nx=c.y-a.y,ny=a.x-c.x,den=nx*dx+ny*dy;
    if(den>eps){const distance=(nx*(a.x-range.point.x)+ny*(a.y-range.point.y))/den;if(distance>eps){xyLimit=Math.min(xyLimit,distance);budget=Math.min(budget,distance*Math.sqrt(1+(current.plane.a*dx+current.plane.b*dy)**2));}}}
   const segmentTime=budget/speed;
   let hi=Math.min(budget,xyLimit),lo=0,target=targetAlong(b,dx,dy,hi);
   if(target){ // invert physical path length, retaining motor speed on slopes
    for(let k=0;k<20;k++){const distance=len({x:target.p.x-b.x,y:target.p.y-b.y,z:target.p.z-b.z});if(distance<=budget+eps){lo=hi;break;}hi*=budget/distance;target=targetAlong(b,dx,dy,hi);if(!target)break;}
   }
   if(!target){
    const delta={x:dx*budget,y:dy*budget,z:0},hit=geometry.sweep(shape(b),b,delta);
    if(hit){Object.assign(b,add(b,mul(delta,hit.t)));remaining-=segmentTime*hit.t;
     if(startStep(b,dx,dy)){advanceStep(b,remaining);return;}
     const nx=hit.normal.x,ny=hit.normal.y,n2=nx*nx+ny*ny;
     if(n2>eps&&Math.abs(hit.normal.z)<.5){const into=(b.vx*nx+b.vy*ny)/n2;if(into<0){b.vx-=into*nx;b.vy-=into*ny;}grounded(b,remaining,contacts+1);}else moveSwept(b,mul(delta,1-hit.t));return;}
    // Find the actual end of the disk/support overlap, not the end of a tick.
    const patch=geometry.supportPatch(b.supportId);let a=0,c=budget;
    for(let k=0;k<32;k++){const m=(a+c)/2,q={x:b.x+dx*m,y:b.y+dy*m};if(geometry.footprintRange(patch.polygon,q,shape(b).radius,patch.plane))a=m;else c=m;}
    const travel=Math.min(budget,c);b.x+=dx*travel;b.y+=dy*travel;b.groundDistance+=travel;remaining-=travel/speed;leave(b);airborne(b,Math.max(0,remaining));return;
   }
   const delta={x:target.p.x-b.x,y:target.p.y-b.y,z:target.p.z-b.z};let hit=geometry.sweep(shape(b),b,delta,'collision',0);
   if(hit&&hit.t>=1-1e-5&&geometry.clearance(shape(b),target.p).fits)hit=null;
   if(hit){Object.assign(b,add(b,mul(delta,hit.t)));b.groundDistance+=len(delta)*hit.t;remaining-=segmentTime*hit.t;
    if(startStep(b,dx,dy)){advanceStep(b,remaining);return;}
    const nx=hit.normal.x,ny=hit.normal.y,n2=nx*nx+ny*ny;
     if(n2>eps&&Math.abs(hit.normal.z)<.5){const into=(b.vx*nx+b.vy*ny)/n2;if(into<0){b.vx-=into*nx;b.vy-=into*ny;}grounded(b,remaining,contacts+1);}else moveSwept(b,mul(delta,1-hit.t));return;
   }
   Object.assign(b,target.p);b.groundDistance+=len(delta);setSupport(b,target.s);remaining-=segmentTime;
  }
  if(remaining>eps){diagnostic(b,'GROUND_SEGMENT_LIMIT');b.vx=b.vy=0;}
 }
 function step(b,dt=POLICY.dt){
  if(Math.abs(dt-POLICY.dt)>eps)throw Error('Spatial actor step must be fixed 1/60');
  b.tick++;b.events=[];b.previousPosition=pose(b);
  if(![b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite))throw Error('Nonfinite body state');
  if(b.step)advanceStep(b,dt);else if(b.motionMode==='grounded')grounded(b,dt);else airborne(b,dt);
  if(b.z<geometry.definition.bounds.min.z&&!b.lowerBoundReported){b.lowerBoundReported=true;emit(b,'world-lower-bound',{z:b.z});}
  return b;
 }
 // Explicit physical trajectory used by move.js vault, never endpoint assignment.
 function vaultSegment(b,target,dt){const before=pose(b),d={x:target.x-b.x,y:target.y-b.y,z:target.z-b.z},hit=geometry.sweep(shape(b),b,d,'collision',0);b.tick++;b.events=[];b.previousPosition=before;b.step=null;leave(b);
  if(hit&&!(hit.t>=1-1e-5&&geometry.clearance(shape(b),target).fits)){Object.assign(b,add(b,mul(d,hit.t)));b.vx=b.vy=b.vz=0;emit(b,'vault-interrupted',{primitiveId:hit.primitiveId});return false;}
  Object.assign(b,target);b.vx=d.x/dt;b.vy=d.y/dt;b.vz=d.z/dt;return true;
 }
 function beginTraversal(b,link,options={}){
  if(!link||!Array.isArray(link.corridor)||link.corridor.length<2||!(link.corridorRadius>=shape(b).radius))return null;
  if(b.motionMode!=='grounded')return null;
  const source=candidates(b,b,b.z-skin*2-eps,b.z+eps).find(s=>s.navSurfaceId===link.fromSurfaceId&&(s.id===b.supportId||geometry.continuousSupport(b.supportId,s.id,b,shape(b))));
  if(!source)return null;
  const center=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length});
  const start=center(link.entry),finish=center(link.exit);
  if(Math.hypot(b.x-start.x,b.y-start.y)>4||Math.abs(b.z-start.z)>skin*2)return null;
  if(source.id!==b.supportId)setSupport(b,source);
  const traversal={link,segment:1,status:'active',ticks:0,start:pose(b),finish,distance:0};
  if(link.kind==='vault'){
   if(!Number.isFinite(link.vaultTopZ))return null;
   const top=Math.max(b.z,finish.z,link.vaultTopZ+skin),raised={x:b.x,y:b.y,z:top},over={...finish,z:top};
   if(geometry.sweep(shape(b),b,{x:0,y:0,z:top-b.z})||geometry.sweep(shape(b),raised,{x:finish.x-b.x,y:finish.y-b.y,z:0})||geometry.sweep(shape(b),over,{x:0,y:0,z:finish.z-top},'collision',0)?.t<1-1e-5)return null;
   traversal.top=top;traversal.duration=Math.max(.25,Math.min(1.4,.5/Math.max(.3,options.vaultSpeed||1)));
  }
  return traversal;
 }
 function advanceTraversal(b,t,intent,dt=POLICY.dt){
  if(!t||t.status!=='active')return t?.status||'interrupted';
  const before=pose(b);t.ticks++;
  if(t.link.kind==='vault'){
   const k=Math.min(1,t.ticks*dt/t.duration);let target;
   if(k<.25){const u=k/.25,e=u*u*(3-2*u);target={...t.start,z:t.start.z+(t.top-t.start.z)*e};}
   else if(k<.75){const u=(k-.25)/.5;target={x:t.start.x+(t.finish.x-t.start.x)*u,y:t.start.y+(t.finish.y-t.start.y)*u,z:t.top};}
   else{const u=(k-.75)/.25,e=u*u*(3-2*u);target={...t.finish,z:t.top+(t.finish.z-t.top)*e};}
   if(t.settling){b.vx=b.vy=0;step(b,dt);}
   else if(!vaultSegment(b,target,dt)){t.status='interrupted';return t.status;}
   if(k===1&&!t.settling){t.settling=true;b.vx=b.vy=b.vz=0;}
  }else{b.vx=intent.x;b.vy=intent.y;step(b,dt);}
  t.distance+=len({x:b.x-before.x,y:b.y-before.y,z:b.z-before.z});
  const segments=t.link.corridor;let deviation=Infinity;
  for(let i=1;i<segments.length;i++){const a=segments[i-1],c=segments[i],dx=c.x-a.x,dy=c.y-a.y,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((b.x-a.x)*dx+(b.y-a.y)*dy)/l)):0;deviation=Math.min(deviation,Math.hypot(b.x-a.x-u*dx,b.y-a.y-u*dy));}
  if(deviation+shape(b).radius>t.link.corridorRadius+skin||b.diagnostics.length){t.status='interrupted';return t.status;}
  if(b.motionMode==='grounded'&&Math.hypot(b.x-t.finish.x,b.y-t.finish.y)<=1.8&&Math.abs(b.z-t.finish.z)<=skin*2){
   const landing=candidates(b,b,b.z-skin*2-eps,b.z+eps).find(s=>s.navSurfaceId===t.link.toSurfaceId&&(s.id===b.supportId||geometry.continuousSupport(b.supportId,s.id,b,shape(b))));
   if(landing){if(landing.id!==b.supportId)setSupport(b,landing);t.status='done';}
  }
  return t.status;
 }
 return Object.freeze({geometry,initialize,posture,step,vaultSegment,moveSwept,beginTraversal,advanceTraversal});
}
// Bounded, deterministic physical proof for a static link. Used once per profile
// and topology, then cached by navigation. It drives the real kernel, not a
// miniature formula for stairs, gravity or collision.
function proveTraversal(geometry,link,bodyProfile,options={}){
 const motion=create(geometry),point=link.entry.reduce((q,p)=>({x:q.x+p.x/link.entry.length,y:q.y+p.y/link.entry.length,z:q.z+p.z/link.entry.length}),{x:0,y:0,z:0});
 let body;try{body=motion.initialize({...point},'walk',bodyProfile);}catch{return {ok:false,reason:'entry-clearance'};}
 const t=motion.beginTraversal(body,link,options);if(!t)return {ok:false,reason:'entry-or-corridor'};
 const speed=options.speed||100,maxTicks=options.maxTicks||1200,history=[],poses=[];let maxDelta=0,stalled=0;
 for(let i=0;i<maxTicks;i++){
  const target=link.corridor[Math.min(t.segment,link.corridor.length-1)];
  const dx=target.x-body.x,dy=target.y-body.y,d=Math.hypot(dx,dy),v=Math.min(speed,d/POLICY.dt),before=pose(body);
  if(d<1.8&&t.segment<link.corridor.length-1)t.segment++;
  motion.advanceTraversal(body,t,{x:d?dx/d*v:0,y:d?dy/d*v:0});
  const delta=len({x:body.x-before.x,y:body.y-before.y,z:body.z-before.z});maxDelta=Math.max(maxDelta,delta);stalled=delta<1e-6?stalled+1:0;
  if(history[history.length-1]!==body.supportId)history.push(body.supportId);
  if(options.record)poses.push({...pose(body),supportId:body.supportId,motionMode:body.motionMode,tick:body.tick});
  if(!geometry.clearance(body.shape,body).fits)return {ok:false,reason:'penetration',tick:i};
  if(t.status!=='active'||stalled>90)return {ok:t.status==='done',reason:t.status==='done'?null:stalled>90?'stalled':t.status,ticks:t.ticks,distance:t.distance,finalPose:pose(body),supportId:body.supportId,supportHistory:history,maxDelta,poses};
 }
 return {ok:false,reason:'tick-budget',ticks:maxTicks,finalPose:pose(body),supportId:body.supportId,poses};
}
/* Opt-in adapter for the real move.js state machine. Never installed in Level 0.
 * Fixture metadata may identify existing-style LOW props; geometry validates every
 * complete finite lift/cross/settle vault before move.js charges its normal cost. */
function motorAdapter(geometry,lowObstacles=[]){
 const motion=create(geometry);let beforeTick=0,beforeDistance=0,beforeGround=0;
 const fit=(H,p,x=H.x,y=H.y)=>geometry.clearance(p,{x,y,z:H.z}).fits;
 const adapter={lowObstacles,
  begin(H,mv){if(!H.shape)motion.initialize(H,mv.s);beforeTick=H.tick;beforeDistance=H.distance;beforeGround=H.groundDistance;},
  end(H,mv,dt){if(H.tick===beforeTick)motion.step(H,dt);H.distance=beforeDistance+H.groundDistance-beforeGround;},
  collide(H,mv,dt){const wanted=mv.down?(mv.down==='crawl'?'crawl':'down'):mv.s;
   if(!motion.posture(H,wanted)){mv.crouch=true;mv.s=H.posture;}
   const d=H.groundDistance;motion.step(H,dt);return H.groundDistance-d;
  },
  surface(H){const p=geometry.supportPatch(H.supportId),m=geometry.definition.materials.find(m=>m.id===p?.materialId);const name=m?.noiseClass;return ['deep','carpet','wet','concrete'].includes(name)?name:'concrete';},
  canStand:H=>fit(H,PROFILES.stand),
  zone(H,crouch){if(!crouch)return null;const x=H.x+H.vx*POLICY.dt,y=H.y+H.vy*POLICY.dt;return !fit(H,PROFILES.crouch,x,y)&&fit(H,PROFILES.crawl,x,y)?{id:'spatial-clearance'}:null;},
  lowAhead(H,dx,dy){const x=H.x+dx*24,y=H.y+dy*24;return !fit(H,PROFILES.stand,x,y)&&fit(H,PROFILES.crawl,x,y)?{id:'spatial-low-volume'}:null;},
  freeAt(H,x,y){return geometry.supports(PROFILES.stand,{x,y,z:H.z},[H.z-POLICY.maxStepRise,H.z+POLICY.maxStepRise],H.supportId).length>0;},
  planVault(H,p,end,duration){
   const support=geometry.supports(PROFILES.vault,{...end,z:H.z},[H.z-POLICY.maxStepRise,H.z+POLICY.maxStepRise],H.supportId)[0];
   if(!support||!Number.isFinite(p.topZ))return null;
   const top=Math.max(H.z,support.z,p.topZ+POLICY.skin),start=pose(H),finish={...end,z:support.z},raised={...start,z:top},over={...finish,z:top};
   if(geometry.sweep(PROFILES.vault,start,{x:0,y:0,z:top-H.z})||geometry.sweep(PROFILES.vault,raised,{x:end.x-H.x,y:end.y-H.y,z:0})||geometry.sweep(PROFILES.vault,over,{x:0,y:0,z:finish.z-top},'collision',0)?.t<1-1e-5)return null;
   return {start,finish,top,duration};
  },
  vault(H,v,k,dt){
   const p=v.physical;let target;
   // Finite raise/cross/settle phases preserve the motor's total duration/cost.
   // No new vault entry ability: only explicit LOW descriptors considered by move.js.
   if(k<.25){const u=k/.25,e=u*u*(3-2*u);target={...p.start,z:p.start.z+(p.top-p.start.z)*e};}
   else if(k<.75){const u=(k-.25)/.5;target={x:p.start.x+(p.finish.x-p.start.x)*u,y:p.start.y+(p.finish.y-p.start.y)*u,z:p.top};}
   else {const u=(k-.75)/.25,e=u*u*(3-2*u);target={...p.finish,z:p.top+(p.finish.z-p.top)*e};}
   return motion.vaultSegment(H,target,dt);
  },motion
 };return adapter;
}
/* Passive XYZ integration for the existing death kernel. No assisted step,
 * steering, authored timing, random draws or independent aftermath ownership.
 * Contacts use the same bounded continuous sweep as the living motor. */
function passive(geometry){
 if(geometry.identity.geometryMode!=='spatial')throw Error('Passive motion requires spatial geometry');
 const stats={sweeps:0,supports:0,clearance:0,contacts:0,steps:0,sleepChecks:0};
 const base=o=>({x:o.x,y:o.y,z:o.z-(o.shape.centerOffset||0)});
 const position=(o,p)=>{o.x=p.x;o.y=p.y;o.z=p.z+(o.shape.centerOffset||0);};
 const fit=o=>{stats.clearance++;return geometry.clearance(o.shape,base(o)).fits;};
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 function hull(points){const p=points.sort((a,b)=>a.x-b.x||a.y-b.y),lo=[],hi=[];for(const q of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),q)<=1e-9)lo.pop();lo.push(q);}for(const q of [...p].reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),q)<=1e-9)hi.pop();hi.push(q);}return lo.slice(0,-1).concat(hi.slice(0,-1));}
 function support(o){
  stats.supports++;const p=base(o),ss=geometry.supports(o.shape,p,[p.z-POLICY.skin*2-1e-7,p.z+1e-7],o.supportId);
  const samples=[];for(const s of ss){const patch=geometry.supportPatch(s.id);for(let i=-1;i<16;i++){const a=i*Math.PI/8,q=i<0?{x:o.x,y:o.y}:{x:o.x+Math.cos(a)*o.shape.radius*.85,y:o.y+Math.sin(a)*o.shape.radius*.85};if(geometry.footprintRange(patch.polygon,q,0,patch.plane))samples.push(q);}for(const q of patch.polygon)if(Math.hypot(q.x-o.x,q.y-o.y)<=o.shape.radius)samples.push({...q});
   // Exact circle/edge intersections preserve the contact boundary near a ledge;
   // stability must not depend on whether a radial sample happens to hit it.
   for(let i=0;i<patch.polygon.length;i++){const a=patch.polygon[i],b=patch.polygon[(i+1)%patch.polygon.length],dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy,B=2*((a.x-o.x)*dx+(a.y-o.y)*dy),C=(a.x-o.x)**2+(a.y-o.y)**2-o.shape.radius**2,D=B*B-4*A*C;if(D<0)continue;for(const t of [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])if(t>=0&&t<=1)samples.push({x:a.x+t*dx,y:a.y+t*dy});}
  }
  const poly=hull(samples),stable=poly.length>=3&&poly.every((a,i)=>{const b=poly[(i+1)%poly.length];return cross(a,b,o)>=POLICY.skin*Math.hypot(b.x-a.x,b.y-a.y)-1e-7;});
  const s=ss[0]||null;o.supportId=s?.id||null;o.normal=s?.normal||null;o.stable=!!s&&stable;o.contactPolygon=poly.slice(0,32);o.motionMode=s?'grounded':'airborne';
  if(!s||!stable){o.sleeping=false;o.still=0;o.st='ACTIVE';}
  return s;
 }
 function initialize(o,profile,z,vz=0){
  Object.assign(o,{z,vz,shape:profile,supportId:null,normal:null,stable:false,sleeping:false,still:0,st:'ACTIVE',motionMode:'airborne',contacts:[],diagnostics:[],revision:0});
  if(!fit(o))throw Error('Initial passive mass overlaps solid: '+profile.id);
  support(o);return o;
 }
 function diagnostic(o,code){o.diagnostics.push({substep:o.substep,code});if(o.diagnostics.length>32)o.diagnostics.shift();}
 function sweep(o,delta,rest=0){
  let remaining={...delta};const first=base(o);o.contacts=[];
  for(let i=0;i<POLICY.maxContacts;i++){
   if(len(remaining)<POLICY.epsilon)break;
   stats.sweeps++;const p=base(o),hit=geometry.sweep(o.shape,p,remaining);
   if(!hit){position(o,add(p,remaining));break;}
   const safe=add(p,mul(remaining,hit.t));position(o,safe);
   if(hit.diagnostic||len(hit.normal)<.5){diagnostic(o,hit.diagnostic||'PASSIVE_UNRESOLVED');o.vx=o.vy=o.vz=0;break;}
   const n=hit.normal,v={x:o.vx,y:o.vy,z:o.vz},vn=dot(v,n);stats.contacts++;
   o.contacts.push({...hit,speed:Math.max(0,-vn),substep:o.substep});
   const bounce=-vn>30?rest:0;if(vn<0){o.vx-=(1+bounce)*vn*n.x;o.vy-=(1+bounce)*vn*n.y;o.vz-=(1+bounce)*vn*n.z;}
   remaining=mul(remaining,1-hit.t);const into=dot(remaining,n);if(into<0)remaining=add(remaining,mul(n,-into));
   if(i===POLICY.maxContacts-1){diagnostic(o,'PASSIVE_CONTACT_LIMIT');o.vx=o.vy=o.vz=0;}
  }
  if(!fit(o)){position(o,first);o.vx=o.vy=o.vz=0;diagnostic(o,'PASSIVE_NONPENETRATING_FALLBACK');}
  return o.contacts;
 }
 function step(o,options={}){
  const dt=1/240;stats.steps++;o.substep=options.substep||0;
  const s=support(o);if(o.sleeping){stats.sleepChecks++;return [];}
  const before={x:o.x,y:o.y,z:o.z};o.vz-=POLICY.gravity*dt;
  if(s&&o.stable){
   const n=s.normal,v={x:o.vx,y:o.vy,z:o.vz},into=dot(v,n);if(into<0){o.vx-=into*n.x;o.vy-=into*n.y;o.vz-=into*n.z;}
   const speed=Math.hypot(o.vx,o.vy,o.vz),mu=(options.mu??560)*(geometry.definition.materials.find(m=>m.id===s.materialId)?.friction??.6)/.6,visc=options.visc??1.15;
   if(speed>1e-9){const dv=Math.min(speed,(mu+visc*speed)*dt),f=1-dv/speed;o.vx*=f;o.vy*=f;o.vz*=f;}
  }else if(s){
   // A real contact still supplies its unilateral normal force while the mass
   // tips outwards. Use the known face normal at a zero-distance contact; a GJK
   // near-zero direction on an extremely thin patch is not a support normal.
   const n=s.normal,into=o.vx*n.x+o.vy*n.y+o.vz*n.z;
   if(into<0){o.vx-=into*n.x;o.vy-=into*n.y;o.vz-=into*n.z;}
   // Unsupported center of mass: gravity supplies an outward tipping impulse.
   // Keep the full collider until it clears the edge; never ignore the slab.
   const cp=o.contactPolygon,point=cp.length?cp.reduce((p,q)=>({x:p.x+q.x/cp.length,y:p.y+q.y/cp.length}),{x:0,y:0}):s.point;
   let dx=o.x-point.x,dy=o.y-point.y,d=Math.hypot(dx,dy);
   if(d<=1e-7){const p=geometry.supportPatch(s.id).polygon;let best=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],nx=b.y-a.y,ny=a.x-b.x,l=Math.hypot(nx,ny),distance=Math.abs(nx*(o.x-a.x)+ny*(o.y-a.y))/l;if(distance<best){best=distance;dx=nx/l;dy=ny/l;}}d=1;}
   o.vx+=dx/d*POLICY.gravity*.55*dt;o.vy+=dy/d*POLICY.gravity*.55*dt;
  }
  const contacts=sweep(o,{x:o.vx*dt,y:o.vy*dt,z:o.vz*dt},options.rest||0);support(o);
  o.tilt=o.normal?{x:Math.atan2(-o.normal.y,o.normal.z),y:Math.atan2(o.normal.x,o.normal.z)}:{x:0,y:0};
  const calm=options.sleep!==false&&o.stable&&Math.hypot(o.vx,o.vy,o.vz)<.5&&Math.abs(o.om||o.w||0)<.05;
  o.still=calm?o.still+dt:0;o.sleeping=o.still>=.5;o.st=o.sleeping?'SLEEPING':o.still>.12?'SETTLING':'ACTIVE';
  if(o.sleeping){o.vx=o.vy=o.vz=0;if('w'in o)o.w=0;if('om'in o)o.om=0;}
  if(o.x!==before.x||o.y!==before.y||o.z!==before.z)o.revision++;
  return contacts;
 }
 return Object.freeze({initialize,step,sweep,support,fit,base,stats,geometry});
}
return Object.freeze({POLICY,PROFILES,ENTITY_PROFILES,DEATH_PROFILES,create,passive,motorAdapter,proveTraversal});
});
