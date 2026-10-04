'use strict';
// Maintained deterministic production conversion. The accepted flat source is read only.
const G=require('../world_geometry'),L=require('./level0'),W=require('../world'),M=require('../world_motion');
const V=require('./level0_vertical');
const CHUNK=768,T=96,clone=x=>JSON.parse(JSON.stringify(x));
const polygon=r=>[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
const plane=z=>typeof z==='number'?{a:0,b:0,c:z}:z;
const key=r=>[r.x,r.y,r.w,r.h].join('_');
const contains=(r,p)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
function build(){
 const flat=G.compile(L,W).flat;
 const d={schemaVersion:1,assetId:'world:level0-spatial',geometryRevision:'part3a-vertical-1',contentRevision:'part3a-vertical-1',geometryMode:'spatial',units:L.units,
  bounds:{min:{x:0,y:0,z:-160},max:{x:9216,y:6912,z:384}},
  solids:[],supportPatches:[],navSurfaces:[],traversalLinks:[],spaces:[],portals:[],materials:[],lights:[],viewGroups:[],anchors:[],colliderProfiles:[],
  production:{sourceAssetId:L.assetId,sourceRevision:L.contentRevision,sourceHash:L.contentHash,tileSize:T,layout:[96,72],chunkSize:CHUNK,rooms:clone(L.flat.rooms),props:clone(W.PROPS),lampOrder:clone(L.flat.lampIds),features:[]}};
 const profiles=new Map();for(const p of Object.values(M.PROFILES))profiles.set(p.id,{...p,capabilities:['walk','stairs','ramp','crawl','vault','drop']});
 for(const [name,p]of Object.entries(M.ENTITY_PROFILES))profiles.set(p.id,{...p,capabilities:name==='hound'?['walk','stairs','ramp','crawl','vault','drop']:['walk','stairs','ramp','vault','drop']});
 profiles.set('profile:corpse',{...M.PROFILES.down,id:'profile:corpse',radius:18,capabilities:[]});d.colliderProfiles=[...profiles.values()];
 for(const name of L.materials)d.materials.push({id:'material:'+name,friction:.6,noiseClass:name,visibleTransmission:0,irTransmission:0,acousticTransmission:.1});
 const roomAt=p=>L.flat.rooms.find(r=>contains({x:r.x*T,y:r.y*T,w:r.w*T,h:r.h*T},p));
 const materialAt=p=>'material:'+(L.roomMaterials[roomAt(p)?.name]||L.defaultMaterial);
 const groupMap=new Map(),spaceMap=new Map(),navMap=new Map();
 function nav(id){if(!navMap.has(id)){const n={id,patchIds:[],origin:{x:0,y:0},cellSize:48,boundaryLinkIds:[],chart:'connected physical sheet on canonical 48-unit grid',clearanceProfileIds:[...profiles.keys()]};navMap.set(id,n);d.navSurfaces.push(n);}return navMap.get(id);}
 function space(r,tag='base',z0=0,z1=164){const id='space:'+tag+':'+key(r);if(!spaceMap.has(id)){const s={id,bounds:{min:{x:r.x,y:r.y,z:z0},max:{x:r.x+r.w,y:r.y+r.h,z:z1}},portalIds:[],volumeSpec:'open air within generated floor rectangle; physical solids remain authoritative'};spaceMap.set(id,s);d.spaces.push(s);}return id;}
 function group(id,solidId,spaceId){if(!groupMap.has(id)){const g={id,solidIds:[],spaceIds:[],cutawayEligible:true};groupMap.set(id,g);d.viewGroups.push(g);}const g=groupMap.get(id);g.solidIds.push(solidId);if(spaceId&&!g.spaceIds.includes(spaceId))g.spaceIds.push(spaceId);}
 function solid(name,r,lo,hi,materialId='material:carpet',surface=null,cutaway=null,spaceId=null){
  const id='solid:'+name,s={id,footprint:polygon(r),lower:plane(lo),upper:plane(hi),materialId,channels:{collision:true,visible:true,ir:true,acousticTransmission:.1}};d.solids.push(s);
  if(surface){const p=s.upper,n=Math.hypot(p.a,p.b,1),support={id:'support:'+name,polygon:polygon(r),plane:clone(p),normal:{x:-p.a/n,y:-p.b/n,z:1/n},solidId:id,materialId,navSurfaceId:surface,supports:true};d.supportPatches.push(support);nav(surface).patchIds.push(support.id);}
  if(cutaway)group(cutaway,id,spaceId);return id;
 }
 // The source grid includes all original room, corridor, doorway and prop carves.
 // Rectangle merging never crosses a material/room/chunk boundary.
 const done=new Set();
 for(let y=0;y<72;y++)for(let x=0;x<96;x++){
  if(done.has(x+','+y))continue;
  const category=(a,b)=>{if(a>=96||b>=72)return null;const p={x:(a+.5)*T,y:(b+.5)*T};return [flat.kc[b*96+a]?'floor':'wall',materialAt(p),roomAt(p)?.id||'corridor',Math.floor(a*T/CHUNK),Math.floor(b*T/CHUNK)].join('|');};
  const c=category(x,y);let w=1,h=1;
  while(x+w<96&&!done.has((x+w)+','+y)&&category(x+w,y)===c)w++;
  outer:while(y+h<72){for(let dx=0;dx<w;dx++)if(done.has((x+dx)+','+(y+h))||category(x+dx,y+h)!==c)break outer;h++;}
  for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)done.add((x+dx)+','+(y+dy));
  const r={x:x*T,y:y*T,w:w*T,h:h*T},mat=materialAt({x:r.x+T/2,y:r.y+T/2}),name=key(r),chunk=Math.floor(r.x/CHUNK)+'_'+Math.floor(r.y/CHUNK),room=roomAt({x:r.x+T/2,y:r.y+T/2})?.id||'corridor';
  if(flat.kc[y*96+x]){const sid=space(r);for(const q of V.subtract(r,[V.PIT]))solid('ground:'+key(q),q,-16,0,mat,'nav:base');for(const q of V.subtract(r,[V.UPPER,V.STAIRS,V.RAMP]))solid('ceiling:'+key(q),q,164,180,mat,null,'view:ceiling:'+room+':'+chunk,sid);}
  else solid('wall:'+name,r,0,164,mat);
 }
 // Pillar ordering derives from the flat source's x-major expansion.
 flat.Pc.forEach((r,i)=>solid(L.flat.pillarGrid.ids[i],r,0,164,materialAt({x:r.x,y:r.y})));
 for(const p of W.PROPS){const mat=materialAt({x:p.cx,y:p.cy});
  if(p.type==='low')solid('prop:'+p.id,p.rect,0,p.kind==='railing'?54:42,mat);
  if(p.type==='under')solid('prop:'+p.id+':overhead',p.rect,46,78,mat,null,'view:prop:'+p.id);
  if(p.type==='gap')solid('prop:'+p.id+':overhead',p.cell,28,164,mat,null,'view:prop:'+p.id);
  if(p.type==='window'){solid('prop:'+p.id+':sill',p.rect,0,42,mat);solid('prop:'+p.id+':lintel',p.cell,112,164,mat,null,'view:prop:'+p.id);}
 }
 V.add({d,solid,space,nav,profiles});
 // Air portals are real shared open faces. The geometry compiler rejects a
 // portal center inside a physical solid for acoustic propagation.
 for(let i=0;i<d.spaces.length;i++)for(let j=i+1;j<d.spaces.length;j++){
  const a=d.spaces[i],b=d.spaces[j],A=a.bounds,B=b.bounds;let p=null;
  for(const axis of ['x','y']){const other=axis==='x'?'y':'x',v=A.max[axis]===B.min[axis]?A.max[axis]:B.max[axis]===A.min[axis]?A.min[axis]:null,lo=Math.max(A.min[other],B.min[other]),hi=Math.min(A.max[other],B.max[other]);
   const z0=Math.max(A.min.z,B.min.z),z1=Math.min(A.max.z,B.max.z);if(v!==null&&hi-lo>32&&z1-z0>24)p=[{[axis]:v,[other]:lo,z:z0},{[axis]:v,[other]:hi,z:z0},{[axis]:v,[other]:hi,z:z1},{[axis]:v,[other]:lo,z:z1}];}
  if(p){const id='portal:'+a.id.slice(6)+'>'+b.id.slice(6);d.portals.push({id,fromSpaceId:a.id,toSpaceId:b.id,polygon:p,channels:{visible:true,ir:true,acousticTransmission:1},traversalLinkId:null});a.portalIds.push(id);b.portalIds.push(id);}
 }
 const patchAt=(p,z=0)=>d.supportPatches.find(s=>Math.abs(s.plane.a*p.x+s.plane.b*p.y+s.plane.c-z)<1e-8&&s.polygon.every((v,i)=>{const q=s.polygon[(i+1)%s.polygon.length];return (q.x-v.x)*(p.y-v.y)-(q.y-v.y)*(p.x-v.x)>=0;}));
 const spaceAt=p=>d.spaces.find(s=>['x','y','z'].every(k=>p[k]>=s.bounds.min[k]&&p[k]<=s.bounds.max[k]))?.id||null;
 const player={x:flat.Ic.x+24,y:flat.Ic.y,z:0};
 d.anchors.push({id:'anchor:spawn:player',kind:'spawn',position:player,yaw:0,supportId:patchAt(player).id,spaceId:spaceAt(player),colliderProfileId:M.PROFILES.stand.id});
 flat.Fc.forEach((p,i)=>d.lights.push({id:L.flat.lampIds[i],position:{...p,z:160},direction:{x:0,y:0,z:-1},channel:'visible',range:380,power:.43,supportId:patchAt(p)?.id||null,spaceId:spaceAt({...p,z:100})}));
 for(const k of G.collections||['solids','supportPatches','navSurfaces','traversalLinks','spaces','portals','materials','lights','viewGroups','anchors','colliderProfiles'])d[k].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 d.contentHash=G.contentHash(d);return d;
}
module.exports={build,CHUNK};
