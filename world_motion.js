/* Stage C: fixed-tick physical body motion. Input/stamina remain in move.js.
 * XYZ root is collider base. No renderer, networking, AI or damage policy. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TFB_MOTION=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const POLICY=Object.freeze({version:'stage-c-profile-1',dt:1/60,gravity:980,maxSlopeDegrees:35,maxStepRise:12,stepLiftMax:180,stepDuration:.10,skin:.05,maxContacts:8,maxGroundSegments:128,groundSegment:1,epsilon:1e-7});
const profile=(name,height,eyeHeight)=>Object.freeze({id:'profile:player-'+name,radius:15,height,eyeHeight,maxSlopeDegrees:35,maxStepRise:12,stepLiftMax:180});
const PROFILES=Object.freeze({stand:profile('stand',60,50),walk:profile('stand',60,50),run:profile('stand',60,50),crouch:profile('crouch',38,31),crawl:profile('crawl',24,18),slide:profile('slide',25,18),down:profile('down',18,9),vault:profile('vault',60,50)});
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
 function initialize(b,posture='stand'){
  if(![b.x,b.y,b.z].every(Number.isFinite))throw Error('Body requires finite XYZ');
  Object.assign(b,{vx:b.vx||0,vy:b.vy||0,vz:b.vz||0,shape:PROFILES[posture],posture,supportId:null,lastSupportId:null,motionMode:'airborne',step:null,tick:0,events:[],diagnostics:[],groundDistance:0,lowerBoundReported:false});
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
  const target=candidates(b,b,b.z-skin*2,b.z+eps).find(q=>q.id===s.targetId);
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
  if(!candidates(b,b,b.z-skin*2,b.z+eps).some(s=>s.id===b.supportId)){leave(b);airborne(b,dt);return;}
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
 return Object.freeze({geometry,initialize,posture,step,vaultSegment,moveSwept});
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
return Object.freeze({POLICY,PROFILES,create,motorAdapter});
});
