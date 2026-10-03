/* Stage E: explicit actor-bound geometry for the retained brains' local XY
 * questions. No shared 'current floor', no global mode switch, no player lookup.
 * Navigation between sheets always goes through Geo.pathPose's existing A*. */
function bodyPose(e){return {x:e.x,y:e.y,z:e.z,supportId:e.supportId,navSurfaceId:e.navSurfaceId};}
function surfaceOf(g,p){return p?.navSurfaceId||g.geometry.supportPatch(p?.supportId)?.navSurfaceId||(p?.supportCandidates?.length===1?p.supportCandidates[0]:null);}
function localPose(g,reference,x,y,shape){
  const surface=surfaceOf(g,reference);if(!surface)return null;
  const D=g.geometry.definition.bounds,pose={x,y,z:reference.z};
  const supports=g.geometry.supports(shape,pose,[D.min.z,D.max.z]).filter(s=>s.navSurfaceId===surface);
  supports.sort((a,b)=>Math.abs(a.z-reference.z)-Math.abs(b.z-reference.z)||a.id.localeCompare(b.id));
  const s=supports[0];return s?{x,y,z:s.z,supportId:s.id,navSurfaceId:surface}:null;
}
function actorShape(e,mode='walk',radius=e.rc){return {...e.baseShape||e.shape,radius,height:e.caps.CAN_CRAWL&&(mode==='crawl'||mode==='under')?24:(e.baseShape||e.shape).height,eyeHeight:e.caps.CAN_CRAWL&&(mode==='crawl'||mode==='under')?18:(e.baseShape||e.shape).eyeHeight};}
Geo.prototype.forActor=function(e,reference=null){
  const root=this.rootGeo||this;if(!root.spatial)return root;
  const g=Object.create(root),ref=()=>reference||bodyPose(e);g.rootGeo=root;g.actor=e;
  g.forPose=p=>root.forActor(e,p);
  g.cellAt=(x,y)=>{const id=surfaceOf(root,ref()),chart=root.charts.get(id);if(!chart)return -1;const c=Math.floor((x-chart.origin.x)/chart.cellSize),r=Math.floor((y-chart.origin.y)/chart.cellSize),i=chart.cells.get(c+','+r);return i!==undefined&&root.passableFor(i,e.caps,e.baseShape)?i:-1;};
  g.clear=(x,y,r,mode='walk')=>{const sh=actorShape(e,mode,r),p=localPose(root,ref(),x,y,sh);return !!p&&root.geometry.clearance(sh,p).fits;};
  g.isFloor=(x,y)=>g.cellAt(x,y)>=0;
  g.snap=(x,y,caps,maxR=5,context,profile)=>{const p=context||localPose(root,ref(),x,y,actorShape(e));return p?root.snapPose({...p,x,y},caps,maxR,profile||e.baseShape):-1;};
  g.lineClear=(ax,ay,bx,by,r=e.rc,mode='walk')=>{const sh=actorShape(e,mode,r),a=localPose(root,ref(),ax,ay,sh),b=localPose(root,ref(),bx,by,sh);return !!a&&!!b&&root.geometry.traceSupportMotion(a,[b],sh).ok;};
  g.ray=(x,y,ang,max)=>{const p=localPose(root,ref(),x,y,e.shape);if(!p)return 0;const a={x,y,z:p.z+e.shape.eyeHeight},b={x:x+Math.cos(ang)*max,y:y+Math.sin(ang)*max,z:a.z},hit=root.geometry.raycast(a,b,'collision');return hit?Math.max(0,hit.t*max):max;};
  g.los=(ax,ay,bx,by)=>{const a=localPose(root,ref(),ax,ay,e.shape),b=localPose(root,ref(),bx,by,e.shape);return !!a&&!!b&&root.clearRay({...a,z:a.z+e.shape.eyeHeight},{...b,z:b.z+e.shape.eyeHeight});};
  g.lightLevel=(x,y,players,pose)=>{const p=pose||localPose(root,ref(),x,y,e.shape);return p?root.lightAt({x,y,z:p.z,shape:e.shape},players):.04;};
  g.sensorCounters=()=>root.sensorCounters();
  return g;
};
function initializeSpatialEntity(eng,e,opts){
  if(!Number.isFinite(opts.z))throw Error('Spatial entity spawn requires explicit Z');
  e.z=opts.z;e.baseShape=MOTION.ENTITY_PROFILES[e.kind];eng.motion.initialize(e,'walk',e.baseShape);
  if(opts.supportId&&opts.supportId!==e.supportId){const s=eng.geo.geometry.supportPatch(opts.supportId);if(!s||!eng.geo.geometry.continuousSupport(e.supportId,opts.supportId,e,e.shape))throw Error('Spatial spawn support does not match physical contact');e.supportId=opts.supportId;}
  syncSurface(eng,e);e.home=bodyPose(e);e.spawn=bodyPose(e);e.physTick=-1;e.routeRevision=0;e.linkHistory=[];
}
function syncSurface(eng,e){e.navSurfaceId=eng.geo.geometry.supportPatch(e.supportId)?.navSurfaceId||null;}
function spatialGoal(eng,e,x,y,known){
  const g=eng.geo.rootGeo||eng.geo,sh=e.baseShape;
  if(known&&(Number.isFinite(known.z)||Number.isFinite(known.zMin))){
    if(Number.isFinite(known.z)&&surfaceOf(g,known)){const pose={x,y,z:known.z,...spatialFields(known),navSurfaceId:surfaceOf(g,known),...(known.hypothesis?{hypothesis:true}:{})};return connectorGoal(g,e,pose)||pose;}
    // An uncertain observation is a region. Pick a deterministic, reachable
    // geometric hypothesis; never label the hypothesis as observed support.
    let low=(known.zMin??known.z??g.geometry.definition.bounds.min.z)-.11;const high=(known.zMax??known.z??g.geometry.definition.bounds.max.z)+.11;
    let possible=g.geometry.supports(sh,{x,y,z:e.z},[low,high]);
    if(!possible.length&&known.unresolved&&Number.isFinite(known.z)){low=g.geometry.definition.bounds.min.z;possible=g.geometry.supports(sh,{x,y,z:known.z},[low,known.z]);}
    const ids=known.supportCandidates?.length?known.supportCandidates.slice(0,4):[...new Set(possible.map(s=>s.navSurfaceId).filter(Boolean))].slice(0,4);
    const candidates=[];for(const id of ids){const chart=g.charts.get(id);if(!chart)continue;const c=Math.floor((x-chart.origin.x)/48),r=Math.floor((y-chart.origin.y)/48);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const i=chart.cells.get((c+dx)+','+(r+dy));if(i===undefined||!g.passableFor(i,e.caps,sh))continue;const n=g.nodePose(i);if(n.z<low||n.z>high)continue;candidates.push(n);}}
    candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||Math.abs(a.z-e.z)-Math.abs(b.z-e.z)||a.nodeId.localeCompare(b.nodeId));
    for(const p of candidates.slice(0,12)){const goal=connectorGoal(g,e,p)||p;if(g.pathPose(bodyPose(e),goal,e.caps,{profile:sh,maxNodes:4000}))return {...goal,hypothesis:true};}
    return null;
  }
  return localPose(g,bodyPose(e),x,y,sh);
}
function spatialSmooth(g,e,path){
  if(!path)return path;const out=[];let a=bodyPose(e),i=0;
  while(i<path.length){let j=i;if(!path[i].link&&(path[i].c|0)<=1)for(let k=i+1;k<path.length&&k-i<=30;k++){
    if(path[k].link||(path[k].c|0)>1||path[k].navSurfaceId!==a.navSurfaceId)break;
    if(g.geometry.traceSupportMotion(a,[path[k]],actorShape(e,'walk',e.rc+NAV_MARGIN)).ok)j=k;
  }out.push(path[j]);a=path[j];i=j+1;}
  return out;
}
function spatialPlan(eng,e,x,y,opts={}){
  if(e.trav)return true;if(e.resumeTraversal&&resumeSpatialTraversal(eng,e))return true;const g=eng.geo.rootGeo||eng.geo,goal=spatialGoal(eng,e,x,y,opts.pose);
  navWhy(e,opts.why||'plan',eng.now);eng.stats.paths++;e.pathAge=0;e.carrot=null;e.aim=null;e.routeRevision++;
  if(!goal){e.path=[];e.goal=null;e.goalKey='unresolved';e.unreachable=eng.now;return false;}
  const cost=opts.cost||(e.sp.pathCost&&e.sp.pathCost(eng,e));
  let p=g.pathPose(bodyPose(e),goal,e.caps,{profile:e.baseShape,cost,maxNodes:opts.maxNodes});
  e.goal=goal;e.goalKey=g.routeKey(bodyPose(e),goal,e.caps,e.baseShape);e.routeCaps=e.goalKey.split('/').slice(0,-2).join('/');
  if(p){const last=p[p.length-1];if(last&&!last.link&&g.geometry.traceSupportMotion(last,[goal],e.baseShape).ok&&Math.hypot(last.x-goal.x,last.y-goal.y)>.1)p.push(goal);p=spatialSmooth(g,e,p);}
  e.path=p||[];e.unreachable=p?0:eng.now;return !!p;
}
function spatialGoTo(eng,e,x,y,opts={}){
  if(e.trav)return true;const g=eng.geo.rootGeo||eng.geo;
  // Resolve uncertain regions only at a planning boundary, not every 60 Hz tick.
  if(opts.pose?.unresolved&&e.goal?.hypothesis&&e.path.length&&e.pathAge<Math.max(3,(opts.every??1.1)*4)&&Math.hypot(x-(e.regionGoal?.x??x),y-(e.regionGoal?.y??y))<40)return true;
  const goal=spatialGoal(eng,e,x,y,opts.pose),G=e.goal;
  if(!goal)return spatialPlan(eng,e,x,y,opts);
  const key=g.routeKey(bodyPose(e),goal,e.caps,e.baseShape),moved=G?Math.hypot(goal.x-G.x,goal.y-G.y,goal.z-G.z):Infinity;
  if(!G||e.goalKey==='direct'||surfaceOf(g,G)!==surfaceOf(g,goal)||Math.abs(goal.z-G.z)>6||moved>Math.max(40,Math.hypot(goal.x-e.x,goal.y-e.y)*.12)||e.pathAge>Math.max(3,(opts.every??1.1)*4)||(!e.path.length&&e.pathAge>.3)||e.routeCaps!==key.split('/').slice(0,-2).join('/')){
    e.regionGoal={x,y};return spatialPlan(eng,e,goal.x,goal.y,{...opts,pose:goal,why:!G?'new-goal':surfaceOf(g,G)!==surfaceOf(g,goal)?'surface-evidence-changed':'route-refresh'});
  }
  if(moved>3&&e.path.length){const last=e.path[e.path.length-1],prev=e.path.length>1?e.path[e.path.length-2]:bodyPose(e);if(!last.link&&g.geometry.traceSupportMotion(prev,[goal],e.baseShape).ok){e.path[e.path.length-1]=goal;e.goal=goal;}}
  return true;
}
function spatialDirectOk(eng,e,x,y,maxD,known){
  if(e.trav||e.motionMode!=='grounded')return false;const g=eng.geo.rootGeo||eng.geo,goal=spatialGoal(eng,e,x,y,known);if(!goal||Math.hypot(x-e.x,y-e.y,goal.z-e.z)>maxD)return false;
  return g.geometry.traceSupportMotion(bodyPose(e),[goal],actorShape(e,'walk',e.rc+(e.goalKey==='direct'?1:NAV_MARGIN))).ok;
}
function spatialDirectTo(eng,e,x,y,known){
  if(e.trav)return;const goal=spatialGoal(eng,e,x,y,known);if(!goal||!spatialDirectOk(eng,e,x,y,Infinity,goal))return spatialGoTo(eng,e,x,y,{pose:known});
  if(e.goalKey!=='direct'){navOf(e).direct++;navWhy(e,'direct',eng.now);navOf(e).plans--;}
  e.path=[goal];e.goal=goal;e.goalKey='direct';e.pathAge=0;
}
function spatialMove(eng,e,dx,dy){
  const x=e.x,y=e.y,z=e.z;
  if(e.trav){if(e.physTick!==eng.ticks)spatialStepTrav(eng,e,1/60);return Math.hypot(e.x-x,e.y-y,e.z-z);}
  if(e.physTick===eng.ticks){eng.motion.moveSwept(e,{x:dx,y:dy,z:0});}
  else{e.vx=dx*60;e.vy=dy*60;eng.motion.step(e);e.physTick=eng.ticks;}
  syncSurface(eng,e);const moved=Math.hypot(e.x-x,e.y-y,e.z-z);if(moved<Math.hypot(dx,dy)*.5)navOf(e).contacts++;return moved;
}
function spatialBeginTrav(eng,e,link){
  e.shape=actorShape(e,link.kind==='crawl'?'crawl':e.mode);
  const t=eng.motion.beginTraversal(e,link,{vaultSpeed:e.caps.VAULT_SPEED});if(!t)return false;
  e.trav=t;e.travCount=(e.travCount||0)+1;e.linkHistory.push({id:link.id,t:eng.now,event:'begin',z:e.z});if(e.linkHistory.length>32)e.linkHistory.shift();return true;
}
function spatialStepTrav(eng,e,dt){
  const t=e.trav,points=t.link.corridor;let target=points[Math.min(t.segment,points.length-1)];
  if(t.segment<points.length-1&&Math.hypot(target.x-e.x,target.y-e.y)<3){t.segment++;target=points[t.segment];}
  const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy),v=Math.min(e.traverseSpeed||100,112,d/dt);
  const before=bodyPose(e);if(d>.001)turnTo(e,Math.atan2(dy,dx),e.caps.TURNING_ABILITY,dt);
  eng.motion.advanceTraversal(e,t,{x:d?dx/d*v:0,y:d?dy/d*v:0},dt);e.physTick=eng.ticks;syncSurface(eng,e);
  e.moved=Math.hypot(e.x-before.x,e.y-before.y,e.z-before.z);e.speed=e.moved/dt;e.vel.x=e.vx;e.vel.y=e.vy;
  t.stalled=e.moved<.01?(t.stalled||0)+1:0;if(t.stalled>120||t.ticks>2400)t.status='interrupted';
  if(t.status!=='active'){e.linkHistory.push({id:t.link.id,t:eng.now,event:t.status,z:e.z});if(e.linkHistory.length>32)e.linkHistory.shift();e.trav=null;e.path.shift();e.pathAge=t.status==='done'?0:99;if(t.status!=='done'){e.path=[];navOf(e).recover++;}e.shape=actorShape(e);}
}
function spatialCarrot(eng,e,look){
  const g=eng.geo.rootGeo||eng.geo,start=bodyPose(e);let a=start,left=look,c=e.path[0];
  for(const w of e.path){if(w.link){c={x:w.link.ax,y:w.link.ay,z:w.link.az,navSurfaceId:w.link.fromSurfaceId};break;}if(w.navSurfaceId!==start.navSurfaceId)break;
    const d=Math.hypot(w.x-a.x,w.y-a.y,w.z-a.z);if(d>=left){const t=left/d;c={x:a.x+(w.x-a.x)*t,y:a.y+(w.y-a.y)*t,z:a.z+(w.z-a.z)*t,navSurfaceId:start.navSurfaceId};break;}left-=d;a=c=w;
  }
  if(!c)return {x:e.x,y:e.y,ok:false};const ok=g.geometry.traceSupportMotion(start,[c],actorShape(e,e.mode,e.rc+.5)).ok;
  return {x:c.x,y:c.y,z:c.z,ok};
}
function spatialWatchdog(eng,e,dt){
  const w=e.wd;w.u=(w.u||0)+dt;if(w.u<6||e.trav||e.motionMode!=='grounded')return;w.u=0;
  const embedded=!eng.geo.geometry.clearance(e.shape,e).fits,moving=e.speed>20;
  const stuck=moving&&Math.hypot(e.x-w.x,e.y-w.y,e.z-(w.z??e.z))<26;Object.assign(w,{x:e.x,y:e.y,z:e.z});
  if(!embedded&&!stuck)return;navOf(e).recover++;if(embedded)navOf(e).emergency++;
  e.path=[];e.pathAge=99;e.speed=e.vx=e.vy=0;e.carrot=null;e.dbg.spatialRecovery=embedded?'invalid physical pose; stopped without relocation':'stalled route; replan from physical pose';
}
function beliefDistance(e,p){
  if(!Number.isFinite(e.z))return Math.hypot(p.x-e.x,p.y-e.y);
  const z=Number.isFinite(p.z)?p.z:Number.isFinite(p.zMin)?clamp(e.z,p.zMin,p.zMax):e.z;
  return Math.hypot(p.x-e.x,p.y-e.y,z-e.z);
}
function goalReached(eng,e,p,r){
  if(!eng.geo.spatial)return Math.hypot(p.x-e.x,p.y-e.y)<r;
  const id=surfaceOf(eng.geo,p);return (!id||id===e.navSurfaceId)&&beliefDistance(e,p)<r;
}
function connectorGoal(g,e,pose){
  const id=surfaceOf(g,pose);if(id===e.navSurfaceId||g.geometry.definition.traversalLinks.some(l=>l.toSurfaceId===id))return null;
  for(const l of g.geometry.definition.traversalLinks){
    if(l.fromSurfaceId!==e.navSurfaceId||!['stairs','ramp'].includes(l.kind))continue;
    const a=l.corridor[0],b=l.corridor[l.corridor.length-1],dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?((pose.x-a.x)*dx+(pose.y-a.y)*dy)/n:-1;
    if(t<0||t>1||Math.hypot(pose.x-a.x-dx*t,pose.y-a.y-dy*t)>l.corridorRadius||Math.abs(pose.z-(a.z+(b.z-a.z)*t))>36)continue;
    // An observed body on a connector suggests its exit as an interception
    // hypothesis. This changes the route goal, not the observed belief.
    return {x:b.x,y:b.y,z:b.z,navSurfaceId:l.toSurfaceId,hypothesis:true,via:l.id};
  }
  return null;
}
function resumeSpatialTraversal(eng,e){
  if(e.motionMode!=='grounded'||e.step)return false;
  const request=e.resumeTraversal,l=request.link;e.resumeTraversal=null;
  if(l.kind==='vault'&&!e.caps.CAN_VAULT||l.kind==='crawl'&&!e.caps.CAN_CRAWL||!l.profileIds.includes(e.baseShape.id))return false;
  const from=bodyPose(e),finish=l.corridor[l.corridor.length-1],half=l.corridorRadius,dx=finish.x-from.x,dy=finish.y-from.y,D=Math.hypot(dx,dy),nx=D?-dy/D:1,ny=D?dx/D:0;
  const link={...l,id:l.id+'@resume:'+e.supportId+':'+e.tick,fromSurfaceId:e.navSurfaceId,entry:[{x:from.x+nx*half,y:from.y+ny*half,z:from.z},{x:from.x-nx*half,y:from.y-ny*half,z:from.z}],corridor:[from,finish],ax:from.x,ay:from.y,az:from.z};
  const proof=MOTION.proveTraversal(eng.geo.geometry,link,actorShape(e,l.kind==='crawl'?'crawl':'walk'),{vaultSpeed:e.caps.VAULT_SPEED});
  if(!proof.ok){e.dbg.spatialRecovery='interrupted corridor no longer physically legal';return false;}
  if(!spatialBeginTrav(eng,e,link))return false;
  e.path=[{x:finish.x,y:finish.y,z:finish.z,navSurfaceId:l.toSurfaceId,link}];e.pathAge=0;e.routeRevision++;navWhy(e,'resume-physical-corridor',eng.now);eng.stats.paths++;return true;
}
