'use strict';
// Production content only: original prop affordances and explicit candidate pools.
const G=require('../world_geometry'),M=require('../world_motion'),W=require('../world');
const gaps=W.PROPS.filter(p=>p.type==='gap');
function props({d,solid,nav,materialAt}){
 const players=d.colliderProfiles.filter(p=>p.id.startsWith('profile:player')).map(p=>p.id);
 for(const p of gaps){const id='nav:gap:'+p.id;solid('gap-floor:'+p.id,p.cell,-16,0,materialAt({x:p.cx,y:p.cy}),id);nav(id).clearanceProfileIds=players;}
 d.production.lowObstacles=W.PROPS.filter(p=>p.type==='low'||p.type==='window').map(p=>({...p,topZ:p.kind==='railing'?54:42}));
 for(const p of d.production.lowObstacles){const axis=p.cross,other=axis==='x'?'y':'x',r=p.rect,margin=36;
  const a={x:p.cx,y:p.cy,z:0},b={...a};a[axis]=r[axis]-margin;b[axis]=r[axis]+(axis==='x'?r.w:r.h)+margin;
  for(const reverse of [false,true]){const A=reverse?b:a,B=reverse?a:b,id='link:prop:'+p.id+(reverse?':reverse':':forward'),region=q=>[-24,24].map(v=>({...q,[other]:q[other]+v}));
   d.traversalLinks.push({id,kind:'vault',fromSurfaceId:'nav:base',toSurfaceId:'nav:base',entry:region(A),exit:region(B),corridor:[A,B],corridorRadius:24,supportPatchIds:[],profileIds:d.colliderProfiles.filter(q=>q.id!=='profile:corpse').map(q=>q.id),capabilityFlags:['vault'],vaultTopZ:p.topZ,durationRule:'accepted finite swept vault',progressRule:'physical pose only',interruptionRule:'retain actual pose',landingRule:'actual supported contact',costRule:'accepted physical vault speed',directed:true,clearanceRequired:true,sourcePropId:p.id});nav('nav:base').boundaryLinkIds.push(id);
  }
 }
 d.production.tightGapSurfaces=gaps.map(p=>({propId:p.id,navSurfaceId:'nav:gap:'+p.id,capability:'CAN_USE_TIGHT_GAPS',profileIds:players}));
}
function anchors(d){
 // Candidate validity derives from the actual production world. A standing,
 // radius-21 flood also proves the base objective does not require vertical travel.
 const g=G.compile(d),shape={...M.PROFILES.stand,radius:21},cols=192,rows=144,valid=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),at=i=>({x:(i%cols+.5)*48,y:(Math.floor(i/cols)+.5)*48,z:0});
 for(let i=0;i<valid.length;i++){const p=at(i);if(g.clearance(shape,p).fits&&g.supports(shape,p,[0,0]).some(s=>s.navSurfaceId==='nav:base'))valid[i]=1;}
 const start=d.anchors.find(a=>a.kind==='spawn').position,first=Math.floor(start.y/48)*cols+Math.floor(start.x/48);if(!valid[first])throw Error('Production anchor flood spawn');const queue=[first];seen[first]=1;
 for(let n=0;n<queue.length;n++){const i=queue[n],p=at(i);for(const j of [i-cols,i+cols,i-1,i+1]){if(j<0||j>=valid.length||!valid[j]||seen[j])continue;const q=at(j);if(Math.abs(q.x-p.x)+Math.abs(q.y-p.y)!==48)continue;const h=g.sweep(shape,p,{x:q.x-p.x,y:q.y-p.y,z:0});if(h&&h.t<1-1e-6)continue;seen[j]=1;queue.push(j);}}
 const spaceAt=p=>d.spaces.find(s=>['x','y','z'].every(k=>p[k]>=s.bounds.min[k]&&p[k]<=s.bounds.max[k]))?.id||null;
 function add(kind,p,profile,extra={}){if(!g.clearance(profile,p).fits)return false;const s=g.supports(profile,p,[p.z-.001,p.z+.001])[0];if(!s)return false;const id='anchor:'+kind+':'+[p.x,p.y,p.z].join('_')+(extra.normal?':'+extra.normal.x+'_'+extra.normal.y:'');d.anchors.push({id,kind,position:p,yaw:0,supportId:s.id,spaceId:spaceAt(p),colliderProfileId:profile.id,baseReachable:p.z===0,...extra});return true;}
 const candidates=queue.filter(i=>Math.floor(i/cols)%8===2&&(i%cols)%8===2).map(at);
 for(const p of candidates){for(const kind of ['hound','smiler'])add(kind+'-spawn',p,M.ENTITY_PROFILES[kind]);if(Math.hypot(p.x-start.x,p.y-start.y)>=1800)add('item',p,M.PROFILES.stand,{itemId:'cartograph'});}
 for(const p of [{x:5808,y:864,z:180},{x:6192,y:864,z:180},{x:6624,y:864,z:180},{x:720,y:5568,z:-96}])for(const kind of ['hound','smiler'])add(kind+'-spawn',p,M.ENTITY_PROFILES[kind],{baseReachable:false,routeId:p.z===180?'link:long-room-stairs:forward':'link:blackout-return:forward'});
 // Selectable wall faces. Root has full body clearance; the effect is on the
 // nearby real wall face, not at an unsupported XY-only coordinate.
 for(const i of queue){if(i%2||Math.floor(i/cols)%2)continue;const p=at(i);if(Math.hypot(p.x-start.x,p.y-start.y)<2600)continue;
  for(const [nx,ny]of [[1,0],[-1,0],[0,1],[0,-1]]){const from={...p,z:32},hit=g.raycast(from,{x:p.x+nx*30,y:p.y+ny*30,z:32},'collision');if(!hit||!hit.primitiveId.startsWith('solid:wall:'))continue;const point={x:p.x+nx*(hit.t*30-.1),y:p.y+ny*(hit.t*30-.1),z:0};add('exit',p,M.PROFILES.stand,{normal:{x:nx,y:ny},wallPosition:point,wallSolidId:hit.primitiveId});}
 }
 d.production.anchorPolicy={baseReachableCells:queue.length,baseProofProfile:shape,entityGrid:384,items:'one base-reachable cartograph; minimum spawn distance 1800; exit spacing 700',exits:'three base-reachable wall faces; minimum spawn/separation 2600',entitySelection:'world RNG; existing normal populations, spawn distances, entity separation and dark Smiler preference'};
}
module.exports={gaps,props,anchors};
