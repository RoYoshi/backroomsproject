/* Stage E spatial query/observation boundary. Every method takes an explicit
 * pose. World truth is consumed here; only bounded evidence leaves this layer. */
function spatialProfile(o) {
  if(o.shape)return o.shape;
  if(MOTION.ENTITY_PROFILES[o.kind])return MOTION.ENTITY_PROFILES[o.kind];
  return MOTION.PROFILES[W_SN[o.st]||o.posture||'stand']||MOTION.PROFILES.stand;
}
function spatialFields(o) {
  if(!o||!Number.isFinite(o.zMin)||!Number.isFinite(o.zMax))return {};
  const candidates=[...new Set(o.supportCandidates||[])].sort();
  return {zMin:o.zMin,zMax:o.zMax,...(Number.isFinite(o.z)?{z:o.z}:{}),supportCandidates:candidates.length<=4?candidates:[],unresolved:!!o.unresolved||candidates.length>4};
}
function verticalCompatible(a,b){
  if(!Number.isFinite(a?.zMin)||!Number.isFinite(b?.zMin))return true;
  if(a.zMax<b.zMin||b.zMax<a.zMin)return false;
  return !a.supportCandidates?.length||!b.supportCandidates?.length||a.supportCandidates.some(s=>b.supportCandidates.includes(s));
}
Geo.prototype.sensorCounters=function(){return this.sensorStats||(this.sensorStats={candidates:0,rays:0,lightQueries:0,soundQueries:0,soundNodes:0,soundPortals:0,soundAlternatives:0,contacts:0});};
Geo.prototype.distance=function(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);};
Geo.prototype.eye=function(o){return {x:o.x,y:o.y,z:o.z+spatialProfile(o).eyeHeight};};
Geo.prototype.clearRay=function(a,b,channel='visible'){this.sensorCounters().rays++;const h=this.geometry.raycast(a,b,channel);return !h||h.t>=1-1e-7;};
Geo.prototype.visibleBody=function(observer,target){
  const stats=this.sensorCounters();stats.candidates++;
  if(!Number.isFinite(observer.z)||!Number.isFinite(target.z))return {visible:false};
  const from=this.eye(observer),shape=spatialProfile(target),samples=[shape.eyeHeight,shape.height*.5,1];let visible=false,feet=false;
  for(const height of samples){const ok=this.clearRay(from,{x:target.x,y:target.y,z:target.z+height});visible ||=ok;if(height===1)feet=ok;}
  let candidates=[];
  if(visible&&feet)candidates=[...new Set(this.geometry.supports(shape,{x:target.x,y:target.y,z:target.z},[target.z-.11,target.z+.01]).map(s=>s.navSurfaceId).filter(Boolean))].sort();
  return {visible,z:target.z,zMin:target.z,zMax:target.z,supportCandidates:candidates.length<=4?candidates:[],unresolved:!feet||candidates.length!==1};
};
Geo.prototype.physicalContact=function(a,b,reach){
  this.sensorCounters().contacts++;
  if(!Number.isFinite(a.z)||!Number.isFinite(b.z))return false;
  return this.geometry.contact({x:a.x,y:a.y,z:a.z,shape:spatialProfile(a)},{x:b.x,y:b.y,z:b.z,shape:spatialProfile(b)},{reach}).touching;
};
Geo.prototype.lightAt=function(pose,players){
  if(!Number.isFinite(pose?.z))return .04;
  this.sensorCounters().lightQueries++;const receiver=this.eye(pose);let level=0;
  if(!this.a.blackout())for(const l of this.geometry.definition.lights){
    if(l.channel!=='visible')continue;const d=this.distance(receiver,l.position);if(d>=l.range||!this.clearRay(l.position,receiver))continue;
    let intensity=l.power*(1-sm(40,l.range,d));
    for(const f of this.fails)if(Number.isFinite(f.z)&&f.until>this.now&&this.distance(pose,f)<f.r)intensity*=.06;
    level=Math.max(level,intensity);
  }
  if(players)for(const p of players){
    const K=this.a.kinds?.[p.kind];if(!p.light||!K||!(K.power>0)||!KIND_GLARE[p.kind])continue;
    const source=this.eye(p),d=this.distance(source,receiver);if(d>=K.range||!this.clearRay(source,receiver))continue;
    const horizontal=Math.hypot(receiver.x-source.x,receiver.y-source.y),yaw=Math.abs(angDiff(Math.atan2(receiver.y-source.y,receiver.x-source.x),p.angle)),pitch=Math.abs(Math.atan2(receiver.z-source.z,horizontal)-(p.pitch||0));
    if(!K.omni&&(yaw>K.arc/2||pitch>K.arc/2))continue;
    level=Math.max(level,K.power*(1-sm(24,K.range,d)));
  }
  return Math.min(1,.04+level*2.08);
};
function spatialVisualSnapshot(eng,e,p,r,observation){
  const old=r.visual,dt=old?eng.now-old.t:0,continuous=old&&dt>0&&dt<=.25;
  // Velocity is a difference between observed poses, never copied from hidden
  // simulation velocity/support/route fields.
  return {id:p.id,x:p.x,y:p.y,...spatialFields(observation),vx:continuous?(p.x-old.x)/dt:0,vy:continuous?(p.y-old.y)/dt:0,vz:continuous?(p.z-old.z)/dt:0,
    angle:p.angle,pitch:p.pitch||0,alive:p.alive,caught:!!p.caught,st:p.st,ex:p.ex,t:eng.now};
}
function spatialEstimate(e,r,now,geo){
  const known=spatialFields(r.spatial),z=Number.isFinite(r.lkz)?r.lkz:e.z;
  const age=Math.max(0,now-r.seenAt),sp=Math.hypot(r.lvx,r.lvy),D=Math.min(sp*Math.min(age,3.2)*.55,520),k=sp>1?D/sp:0;
  const start={x:r.lkx,y:r.lky,z,...known},target={...start,x:r.lkx+r.lvx*k,y:r.lky+r.lvy*k};
  // A prediction may stay on remembered support. Changing floors requires a
  // geometric route hypothesis, never a lookup of the hidden target.
  if(known.supportCandidates?.length===1){start.navSurfaceId=target.navSurfaceId=known.supportCandidates[0];if(!geo.geometry.traceSupportMotion(start,[target],MOTION.PROFILES[W_SN[r.st]||'stand']||MOTION.PROFILES.stand).ok){target.x=start.x;target.y=start.y;}}
  else{target.x=start.x;target.y=start.y;}
  return {...target,unc:60+Math.min(1100,sp*age*.5+age*18)};
}
/* Visible emitters stay in the physical signal layer. The observation contains
 * only the source/patch/air points that this observer can see, never an owner. */
function spatialBeamsOf(eng){
  if(eng.beamsT>eng.now&&eng.beams)return eng.beams;
  eng.beamsT=eng.now+BEAM_DT;const g=eng.geo,out=[];
  for(const p of eng.lights){
    const K=g.a.kinds?.[p.kind];if(!K||!(K.power>0)||!KIND_GLARE[p.kind]||!Number.isFinite(p.z))continue;
    const origin=g.eye(p),omni=!!K.omni,dirs=omni?[0,1,2,3,4,5].map(i=>i*TAU/6):BEAM_RAYS.map(o=>p.angle+o*K.arc),pitch=omni?0:p.pitch||0;
    const endpoint=(yaw,t)=>({x:origin.x+Math.cos(yaw)*Math.cos(pitch)*t,y:origin.y+Math.sin(yaw)*Math.cos(pitch)*t,z:origin.z+Math.sin(pitch)*t});
    const distance=yaw=>{g.sensorCounters().rays++;const h=g.geometry.raycast(origin,endpoint(yaw,K.range),'visible');return h?h.t*K.range:K.range;};
    const rays=[];for(let i=0;i<dirs.length;i++){const d=distance(dirs[i]),I=q05(K.power*(1-sm(24,K.range,d))*(omni||i===0?1:.6));if(I>0)rays.push({...endpoint(dirs[i],Math.max(0,d-4)),wall:d<K.range-2,I});}
    const air=[];if(!omni){const d=distance(p.angle);for(const f of BEAM_AIR){const t=d*f;air.push({...endpoint(p.angle,t),I:q05(K.power*(1-sm(24,K.range,t)))});}}
    out.push({o:origin,ang:p.angle,pitch,arc:omni?TAU:K.arc,range:K.range,omni,rays,air});
  }
  return eng.beams=out;
}
function spatialObserveBeam(eng,e,b){
  const g=eng.geo,eye=g.eye(e),look=e.ang+(e.head||0),inView=p=>g.distance(eye,p)<110||Math.abs(angDiff(Math.atan2(p.y-eye.y,p.x-eye.x),look))<=e.sp.vision.fov/2;
  const d=g.distance(eye,b.o),yaw=Math.abs(angDiff(Math.atan2(eye.y-b.o.y,eye.x-b.o.x),b.ang)),pitch=Math.abs(Math.atan2(eye.z-b.o.z,Math.hypot(eye.x-b.o.x,eye.y-b.o.y))-b.pitch);
  const cone=b.omni||(yaw<b.arc*.5&&pitch<b.arc*.5),hit=e.kind==='hound'&&cone&&d<b.range;
  let src=null,flash=false;if(d<(cone?1700:650)&&(inView(b.o)||hit)&&g.clearRay(eye,b.o)){src={...b.o};flash=e.kind==='hound'?hit:cone&&d<b.range*1.6;}
  const observed=(points,range,wall)=>points.filter(p=>g.distance(eye,p)<range&&inView(p)&&g.clearRay(eye,p)).map(p=>({x:Math.round(p.x),y:Math.round(p.y),z:Math.round(p.z),I:p.I,...(wall?{w:p.wall?1:0}:{})}));
  const pts=observed(b.rays,1500,true),air=observed(b.air,900,false);if(!src&&!pts.length&&!air.length)return null;
  // Neither emitter switch time nor motion of an unseen part of the beam is an
  // observation. Brightness/visible positions alone drive the existing weights.
  return {src,flash,pts,air,fresh:false,moved:false};
}
function spatialInferLead(e,o,geo){
  if(o.src)return {k:'source',x:o.src.x,y:o.src.y,u:35,c:o.flash?.95:.8,sal:o.flash?1:.55,flash:o.flash,zMin:o.src.z-72,zMax:o.src.z,supportCandidates:[],unresolved:true};
  const all=o.pts.concat(o.air);if(!all.length)return null;
  let maxI=0;for(const q of all)maxI=Math.max(maxI,q.I);
  const c=clamp(.22+.07*all.length+maxI*.4,.2,.8),sal=clamp(.25+maxI*.3,0,1);
  let x,y,dir,k,u;
  if(o.air.length>=2){const sorted=o.air.slice().sort((a,b)=>b.I-a.I),a=sorted[0],b=sorted[sorted.length-1];dir=a.I>b.I?Math.atan2(a.y-b.y,a.x-b.x):null;x=a.x;y=a.y;
    if(dir!==null){const to={x:a.x+Math.cos(dir)*200,y:a.y+Math.sin(dir)*200,z:a.z},hit=geo.geometry.raycast(a,to,'visible'),D=Math.max(0,Math.min(170,(hit?hit.t*200:200)-26));x+=Math.cos(dir)*D;y+=Math.sin(dir)*D;}
    k='beam';u=170+.15*Math.hypot(x-e.x,y-e.y);
  }else{x=all.reduce((n,q)=>n+q.x,0)/all.length;y=all.reduce((n,q)=>n+q.y,0)/all.length;k=o.pts.some(q=>q.w)?'litwall':'litfloor';u=260+.2*Math.hypot(x-e.x,y-e.y);}
  // A reflected patch or a partial beam cannot identify an emitter's floor.
  const bounds=geo.geometry.definition.bounds;
  return {k,x,y,u,c,sal,...(dir!=null?{dir:+dir.toFixed(3)}:{}),zMin:bounds.min.z,zMax:bounds.max.z,supportCandidates:[],unresolved:true};
}
