/* Shared geometry boundary — preserved Stage B planar path + Stage C spatial queries.
 * Data lives in level definitions. Stage E/G contact/routing APIs remain deferred.
 * No time reads, RNG, perception, species decisions or render dependencies. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TFB_GEOMETRY=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
// Synchronous SHA-256 over UTF-8, identical in classic browser scripts and Node.
function sha256(s){
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const input=new TextEncoder().encode(s),n=input.length,bytes=new Uint8Array(Math.ceil((n+9)/64)*64);bytes.set(input);bytes[n]=128;
 const dv=new DataView(bytes.buffer);dv.setUint32(bytes.length-8,Math.floor(n/0x20000000));dv.setUint32(bytes.length-4,(n*8)>>>0);
 const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],W=new Uint32Array(64),rr=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let off=0;off<bytes.length;off+=64){for(let i=0;i<16;i++)W[i]=dv.getUint32(off+i*4);for(let i=16;i<64;i++){const x=W[i-15],y=W[i-2];W[i]=(W[i-16]+(rr(x,7)^rr(x,18)^(x>>>3))+W[i-7]+(rr(y,17)^rr(y,19)^(y>>>10)))>>>0;}
 let [a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const t1=(h+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+K[i]+W[i])>>>0,t2=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}for(const [i,x] of [a,b,c,d,e,f,g,h].entries())H[i]=(H[i]+x)>>>0;
 }return H.map(x=>x.toString(16).padStart(8,'0')).join('');
}
function contentHash(d){const {contentHash,...data}=d;return sha256(canonical(data));}
function validate(d){
 if(d&&d.geometryMode==='spatial'&&!d.flat)return spatialValidate(d);
 const ok=(x,msg)=>{if(!x)throw Error('WorldDefinition: '+msg);},num=x=>typeof x==='number'&&Number.isFinite(x),int=x=>Number.isInteger(x),str=x=>typeof x==='string'&&x.length>0,arr=(x,n)=>{ok(Array.isArray(x),n+' array');return x;};
 function finite(v){ok(v===null||['object','string','number','boolean'].includes(typeof v),'JSON data only');if(typeof v==='number')ok(num(v),'nonfinite number');else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
 finite(d);ok(d&&d.schemaVersion===1,'schema mismatch');ok(d.geometryMode==='flat-compat','unsupported geometry mode (spatial is Stage C)');ok(str(d.assetId)&&str(d.contentRevision),'identity');ok(d.units==='legacy-world-unit','units');ok(d.spatialRecords===null&&d.verticalExtent==='UNSPECIFIED — NOT SPATIAL GEOMETRY','flat cannot claim spatial geometry');
 const f=d.flat,b=d.bounds;ok(f&&b&&b.min&&b.max,'bounds/flat descriptor');
 ok(int(f.width)&&int(f.height)&&f.width>0&&f.height>0&&f.width*f.height<=1000000,'grid bounds');ok(f.tile===96&&f.navCell===48&&f.navRadius===21,'unsupported legacy metric');
 ok(b.min.x===0&&b.min.y===0&&b.min.z===null&&b.max.z===null&&b.max.x===f.width*f.tile&&b.max.y===f.height*f.tile,'malformed bounds');
 const ids=new Set(),id=v=>{ok(str(v)&&!ids.has(v),'duplicate/invalid ID '+v);ids.add(v);};
 const materials=new Set(arr(d.materials,'materials'));ok(materials.size===d.materials.length&&d.materials.every(str),'material IDs');ok(materials.has(d.defaultMaterial),'default material reference');
 const rect=r=>{ok(['x','y','w','h'].every(k=>int(r[k]))&&r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.x+r.w<=f.width&&r.y+r.h<=f.height,'rectangle bounds');};
 const rooms=new Set();arr(f.rooms,'rooms').forEach(r=>{id(r.id);ok(str(r.code)&&str(r.name),'room names');ok(r.id==='room:'+r.code,'room identity');rect(r);rooms.add(r.id);});
 ok(d.roomMaterials&&typeof d.roomMaterials==='object'&&!Array.isArray(d.roomMaterials),'room materials');for(const [name,mat] of Object.entries(d.roomMaterials)){ok(f.rooms.some(r=>r.name===name),'room material reference');ok(materials.has(mat),'material reference');}
 for(const key of ['floorCarves','wallCarves','doorCarves'])arr(f[key],key).forEach(a=>{ok(Array.isArray(a)&&a.length===4,'carve rectangle');rect({x:a[0],y:a[1],w:a[2],h:a[3]});});
 arr(f.columns,'columns').forEach(c=>{id(c.id);rect({x:c.x,y:c.y,w:1,h:1});});
 const pg=f.pillarGrid;ok(pg&&num(pg.half)&&pg.half>0&&pg.size===pg.half*2,'pillar profile');arr(pg.xs,'pillar xs').forEach(x=>ok(num(x)&&x*f.tile-pg.half>=0&&x*f.tile+pg.half<=b.max.x,'pillar x'));arr(pg.ys,'pillar ys').forEach(y=>ok(num(y)&&y*f.tile-pg.half>=0&&y*f.tile+pg.half<=b.max.y,'pillar y'));arr(pg.ids,'pillar IDs').forEach(id);ok(pg.ids.length===pg.xs.length*pg.ys.length,'pillar ID count');
 const lr=f.lampRule;ok(lr&&rooms.has(lr.excludeRoomId),'lamp room reference');ok(int(lr.offset)&&lr.offset>=0&&int(lr.stride)&&lr.stride>0&&int(lr.margin)&&lr.margin>=0&&num(lr.center)&&lr.center>=0&&lr.center<1,'lamp generation rule');arr(f.lampIds,'lamp IDs').forEach(id);
 arr(f.propDefs,'props').forEach(p=>{id(p.id);ok(['low','under','gap','window'].includes(p.type)&&str(p.kind),'prop type/kind');rect({x:p.tx,y:p.ty,w:p.tw,h:p.th});if(p.type==='gap'||p.type==='window')ok(['x','y'].includes(p.axis),'prop axis');if(p.type!=='gap')ok(num(p.depth)&&p.depth>0&&p.depth<=96,'prop depth');});
 const li=f.legacyItems;ok(li,'legacy items');arr(li.roomIds,'item rooms').forEach(r=>ok(rooms.has(r),'item room reference'));arr(li.ids,'item IDs').forEach(id);ok(li.ids.length===li.roomIds.length,'item ID count');
 const point=p=>ok(num(p.x)&&num(p.y)&&p.x>=0&&p.y>=0&&p.x<=b.max.x&&p.y<=b.max.y,'anchor bounds');
 arr(f.patrol,'patrol').forEach(p=>{id(p.id);point(p);});arr(d.anchors,'anchors').forEach(a=>{id(a.id);point(a);ok(a.z===0&&a.supportId===null,'flat anchor');});for(const a of ['spawn:player','anchor:reachability'])ok(d.anchors.some(x=>x.id===a),'missing anchor '+a);
 ok(d.exits&&d.exits.kind==='seeded-glitched-walls'&&d.exits.owner==='dev/sim_glue.js'&&Array.isArray(d.exits.staticAnchors)&&d.exits.staticAnchors.length===0,'exit generation reference');
 ok(typeof d.contentHash==='string'&&/^[a-f0-9]{64}$/.test(d.contentHash)&&contentHash(d)===d.contentHash,'content hash mismatch');
 return true;
}

const collections=['solids','supportPatches','navSurfaces','traversalLinks','spaces','portals','materials','lights','viewGroups','anchors','colliderProfiles'];
const required={solids:['footprint','lower','upper','materialId','channels'],supportPatches:['polygon','plane','normal','solidId','materialId','navSurfaceId','supports'],navSurfaces:['patchIds','origin','cellSize','boundaryLinkIds','chart','clearanceProfileIds'],traversalLinks:['kind','fromSurfaceId','toSurfaceId','entry','exit','corridor','supportPatchIds','profileIds','capabilityFlags','durationRule','progressRule','interruptionRule','landingRule','costRule','directed','clearanceRequired'],spaces:['bounds','portalIds','volumeSpec'],portals:['fromSpaceId','toSpaceId','polygon','channels','traversalLinkId'],materials:['friction','noiseClass','visibleTransmission','irTransmission','acousticTransmission'],lights:['position','direction','channel','range','power','supportId','spaceId'],viewGroups:['solidIds','spaceIds','cutawayEligible'],anchors:['kind','position','yaw','supportId','spaceId','colliderProfileId'],colliderProfiles:['radius','height','eyeHeight','maxSlopeDegrees','maxStepRise','stepLiftMax','capabilities']};
function validateSpatialRecords(w){const errors=[],refs={};const err=s=>errors.push(s);const walk=(v,p)=>{if(typeof v==='number'&&!Number.isFinite(v))err(p+' nonfinite');if(v&&typeof v==='object')for(const [k,q] of Object.entries(v))walk(q,p+'.'+k);};walk(w,'world');
 for(const k of ['schemaVersion','assetId','geometryRevision','geometryMode','units','bounds'])if(w[k]===undefined)err('Missing '+k);
 if(w.schemaVersion!==1)err('Unknown schemaVersion');if(!['flat-compat','spatial'].includes(w.geometryMode))err('Invalid geometryMode');if(w.units!=='legacy-world-unit')err('Invalid units');
 const point=(p,d,where)=>{if(!p||d.some(k=>typeof p[k]!=='number'||!Number.isFinite(p[k])))err(where+' invalid point');};
 const bounds=(b,where)=>{point(b?.min,['x','y','z'],where+'.min');point(b?.max,['x','y','z'],where+'.max');if(b?.min&&b?.max)for(const k of ['x','y','z'])if(!(b.min[k]<b.max[k]))err(where+' inverted bounds');};bounds(w.bounds,'world.bounds');
 const all=new Set();
 for(const c of collections){const a=w[c];refs[c]=new Set();if(!Array.isArray(a)){err('Missing collection '+c);continue;}let prev='';for(const o of a){if(!o||typeof o.id!=='string'||!o.id.includes(':')){err(c+' invalid explicit ID');continue;}if(all.has(o.id))err('Duplicate ID '+o.id);all.add(o.id);refs[c].add(o.id);if(prev&&prev>=o.id)err(c+' not canonical ID order');prev=o.id;for(const k of required[c])if(o[k]===undefined)err(o.id+' missing '+k);}}
 const ref=(type,id,where,nullable=false)=>{if(nullable&&id===null)return;if(!refs[type].has(id))err(where+' invalid '+type+' reference '+id);};
 const list=(type,ids,where)=>{if(!Array.isArray(ids)){err(where+' not an array');return;}if(new Set(ids).size!==ids.length)err(where+' duplicate reference');for(const id of ids)ref(type,id,where);};
 const poly=(p,dim,where)=>{if(!Array.isArray(p)||p.length<3){err(where+' invalid polygon');return;}for(const q of p)point(q,dim,where);};
 for(const o of w.solids||[]){poly(o.footprint,['x','y'],o.id);for(const p of [o.lower,o.upper])point(p,['a','b','c'],o.id);ref('materials',o.materialId,o.id);if(o.lower&&o.upper)for(const v of o.footprint||[])if(o.lower.a*v.x+o.lower.b*v.y+o.lower.c>=o.upper.a*v.x+o.upper.b*v.y+o.upper.c)err(o.id+' inverted/zero thickness');}
 for(const o of w.supportPatches||[]){poly(o.polygon,['x','y'],o.id);point(o.plane,['a','b','c'],o.id);point(o.normal,['x','y','z'],o.id);ref('solids',o.solidId,o.id);ref('materials',o.materialId,o.id);ref('navSurfaces',o.navSurfaceId,o.id,true);}
 for(const o of w.navSurfaces||[]){list('supportPatches',o.patchIds,o.id);list('traversalLinks',o.boundaryLinkIds,o.id);list('colliderProfiles',o.clearanceProfileIds,o.id);point(o.origin,['x','y'],o.id);if(!(o.cellSize>0))err(o.id+' invalid cellSize');}
 for(const o of w.traversalLinks||[]){if(!['walk-seam','ramp','stairs','step','drop','crawl','vault'].includes(o.kind))err(o.id+' invalid link kind');for(const k of ['fromSurfaceId','toSurfaceId'])ref('navSurfaces',o[k],o.id);list('supportPatches',o.supportPatchIds,o.id);list('colliderProfiles',o.profileIds,o.id);for(const k of ['entry','exit','corridor']){if(!Array.isArray(o[k])||!o[k].length)err(o.id+' empty '+k);else for(const p of o[k])point(p,['x','y','z'],o.id);}if(o.directed!==true)err(o.id+' link must be explicitly directed');}
 for(const o of w.spaces||[]){bounds(o.bounds,o.id);list('portals',o.portalIds,o.id);}
 for(const o of w.portals||[]){for(const k of ['fromSpaceId','toSpaceId'])ref('spaces',o[k],o.id);poly(o.polygon,['x','y','z'],o.id);ref('traversalLinks',o.traversalLinkId,o.id,true);}
 for(const o of w.lights||[]){point(o.position,['x','y','z'],o.id);point(o.direction,['x','y','z'],o.id);if(!['visible','ir'].includes(o.channel))err(o.id+' invalid light channel');ref('supportPatches',o.supportId,o.id,true);ref('spaces',o.spaceId,o.id,true);}
 for(const o of w.viewGroups||[]){list('solids',o.solidIds,o.id);list('spaces',o.spaceIds,o.id);}
 for(const o of w.anchors||[]){point(o.position,['x','y','z'],o.id);ref('supportPatches',o.supportId,o.id);ref('spaces',o.spaceId,o.id,true);ref('colliderProfiles',o.colliderProfileId,o.id);}
 for(const o of w.colliderProfiles||[])if(!(o.radius>0&&o.height>0&&o.eyeHeight>=0&&o.eyeHeight<=o.height))err(o.id+' invalid profile dimensions');
 return {status:errors.length?'SCHEMA INVALID':'SCHEMA VALID',physics:'NOT IMPLEMENTED BY DESIGN',errors};}

/* Stage C spatial backend. Pure queries; no WORLD.mode, clocks, RNG or renderer. */
const NUM = Object.freeze({skin:.05, penetration:.1, tie:1e-7, epsilon:1e-8,
  cell:128, maxContacts:8, gjkIterations:48, advanceIterations:64, distanceError:1e-6});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
const norm=a=>Math.sqrt(dot(a,a));
const unit=a=>mul(a,1/(norm(a)||1));
const planeAt=(p,x,y)=>p.a*x+p.b*y+p.c;
const cross2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const inside=(poly,p)=>poly.every((a,i)=>cross2(a,poly[(i+1)%poly.length],p)>=-NUM.epsilon);
function clip(poly,a,b,c){ // retain ax+by+c >= 0
 const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=a*p.x+b*p.y+c,v=a*q.x+b*q.y+c;
 if(u>=0)out.push(p);if((u>=0)!==(v>=0)){const t=u/(u-v);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}return out;
}
function intersectPoly(p,q){for(let i=0;i<q.length&&p.length;i++){const a=q[i],b=q[(i+1)%q.length];p=clip(p,a.y-b.y,b.x-a.x,b.y*a.x-b.x*a.y);}return p;}
function area(p){return Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-a.y*b.x;},0))/2;}
function footprintRange(poly,p,r,plane){
 const pts=[],r2=r*r,eps=NUM.epsilon;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,aa=dx*dx+dy*dy;
  if((a.x-p.x)**2+(a.y-p.y)**2<=r2+eps)pts.push(a);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/aa)),q={x:a.x+t*dx,y:a.y+t*dy};
  if((q.x-p.x)**2+(q.y-p.y)**2<=r2+eps)pts.push(q);
  const bb=2*((a.x-p.x)*dx+(a.y-p.y)*dy),cc=(a.x-p.x)**2+(a.y-p.y)**2-r2,disc=bb*bb-4*aa*cc;
  if(disc>=0)for(const sign of [-1,1]){const k=(-bb+sign*Math.sqrt(disc))/(2*aa);if(k>=0&&k<=1)pts.push({x:a.x+k*dx,y:a.y+k*dy});}
 }
 if(inside(poly,p))pts.push({x:p.x,y:p.y});
 const g=Math.hypot(plane.a,plane.b);if(g)for(const k of [-1,1]){const q={x:p.x+k*r*plane.a/g,y:p.y+k*r*plane.b/g};if(inside(poly,q))pts.push(q);}
 if(!pts.length)return null;
 const heights=pts.map(q=>planeAt(plane,q.x,q.y));let hi=0,lo=0;for(let i=1;i<pts.length;i++){if(heights[i]>heights[hi])hi=i;if(heights[i]<heights[lo])lo=i;}
 return {min:heights[lo],max:heights[hi],point:{...pts[hi],z:heights[hi]}};
}
function spatialValidate(d){
 const fail=m=>{throw Error('WorldDefinition: '+m);},ok=(b,m)=>{if(!b)fail(m);};
 const basic=validateSpatialRecords(d);ok(!basic.errors.length,basic.errors.join('; '));
 ok(d.geometryMode==='spatial','unsupported geometry mode');
 const finite=v=>{ok(v===null||['object','number','string','boolean'].includes(typeof v),'JSON data only');if(typeof v==='number')ok(Number.isFinite(v),'nonfinite');else if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(d);
 ok(typeof d.assetId==='string'&&d.assetId.length&&typeof d.geometryRevision==='string'&&d.geometryRevision.length,'identity');
 const poly=p=>{ok(p.length<=64,'polygon complexity');for(let i=0;i<p.length;i++){ok(cross2(p[i],p[(i+1)%p.length],p[(i+2)%p.length])>NUM.epsilon,'convex CCW polygon required');for(const q of p)ok(cross2(p[i],p[(i+1)%p.length],q)>=-NUM.epsilon,'self-intersecting/nonconvex polygon');}};
 const bounds=p=>['x','y','z'].every(k=>p[k]>=d.bounds.min[k]-NUM.epsilon&&p[k]<=d.bounds.max[k]+NUM.epsilon);
 ok(['x','y','z'].every(k=>Math.abs(d.bounds.min[k])<=1e7&&Math.abs(d.bounds.max[k])<=1e7),'coordinate magnitude limit');
 const cells=(Math.ceil((d.bounds.max.x-d.bounds.min.x)/NUM.cell)+2)*(Math.ceil((d.bounds.max.y-d.bounds.min.y)/NUM.cell)+2);ok(cells<=1000000&&d.solids.length<=100000,'spatial capacity limit');
 const byId=new Map(d.solids.map(s=>[s.id,s]));
 for(const s of d.solids){poly(s.footprint);for(const p of s.footprint)for(const pl of [s.lower,s.upper])ok(bounds({...p,z:planeAt(pl,p.x,p.y)}),'solid outside bounds '+s.id);
 for(const c of ['collision','visible','ir'])ok(typeof s.channels[c]==='boolean','channels');ok(s.channels.acousticTransmission>=0&&s.channels.acousticTransmission<=1,'acoustic channel');}
 for(const s of d.supportPatches){poly(s.polygon);const solid=byId.get(s.solidId);ok(s.supports===true&&solid.channels.collision,'support source collision');
 ok(s.materialId===solid.materialId,'support material');for(const p of s.polygon)ok(inside(solid.footprint,p)&&Math.abs(planeAt(s.plane,p.x,p.y)-planeAt(solid.upper,p.x,p.y))<NUM.epsilon,'support must be solid upper face');
 const n=unit({x:-s.plane.a,y:-s.plane.b,z:1});ok(norm(sub(n,s.normal))<1e-7,'support normal');}
 // Solid unions are legal only with identical physical/channel semantics. The ramp
 // intersects the ground at its foot in the locked fixture. Reject conflicting
 // volume assignments and coincident duplicate geometry, not that intended union.
 for(let i=0;i<d.solids.length;i++)for(let j=i+1;j<d.solids.length;j++){
  const a=d.solids[i],b=d.solids[j];let p=intersectPoly(a.footprint,b.footprint);
  for(const [u,l] of [[a.upper,b.lower],[b.upper,a.lower]])p=clip(p,u.a-l.a,u.b-l.b,u.c-l.c-NUM.epsilon);
  if(area(p)>NUM.epsilon){ok(a.materialId===b.materialId&&canonical(a.channels)===canonical(b.channels),'conflicting solid overlap');
   ok(!(Math.abs(area(intersectPoly(a.footprint,b.footprint))-area(a.footprint))<NUM.epsilon&&Math.abs(area(a.footprint)-area(b.footprint))<NUM.epsilon&&canonical(a.lower)===canonical(b.lower)&&canonical(a.upper)===canonical(b.upper)),'duplicate solid volume');}
 }
 const supportKeys=new Set();for(const p of d.supportPatches){const key=canonical([p.polygon,p.plane]);ok(!supportKeys.has(key),'duplicate support geometry');supportKeys.add(key);}
 for(const m of d.materials)ok(m.friction>=0&&['visibleTransmission','irTransmission','acousticTransmission'].every(k=>m[k]>=0&&m[k]<=1),'material parameters');
 for(const p of d.colliderProfiles)ok(p.maxSlopeDegrees>=0&&p.maxSlopeDegrees<90&&p.maxStepRise>=0&&p.stepLiftMax>0&&Array.isArray(p.capabilities),'profile parameters');
 for(const a of d.anchors)ok(bounds(a.position),'anchor bounds');
 for(const s of d.spaces)ok(bounds(s.bounds.min)&&bounds(s.bounds.max),'space bounds');
 if(d.contentHash!==undefined)ok(d.contentHash===contentHash(d),'content hash mismatch');
 return true;
}
function linearSolve(A,b){
 const n=b.length,m=A.map((r,i)=>[...r,b[i]]);
 for(let c=0;c<n;c++){let k=c;for(let j=c+1;j<n;j++)if(Math.abs(m[j][c])>Math.abs(m[k][c]))k=j;if(Math.abs(m[k][c])<1e-12)return null;
 [m[c],m[k]]=[m[k],m[c]];const v=m[c][c];for(let j=c;j<=n;j++)m[c][j]/=v;
 for(let i=0;i<n;i++)if(i!==c){const f=m[i][c];for(let j=c;j<=n;j++)m[i][j]-=f*m[c][j];}}
 return m.map(r=>r[n]);
}
function closestSimplex(points){
 let best=null;
 for(let mask=1;mask<(1<<points.length);mask++){
  const ps=points.filter((_,i)=>mask&(1<<i));if(ps.length>4)continue;
  let w=[1];if(ps.length>1){const ds=ps.slice(1).map(p=>sub(p,ps[0])),v=linearSolve(ds.map(a=>ds.map(b=>dot(a,b))),ds.map(a=>-dot(a,ps[0])));if(!v)continue;w=[1-v.reduce((a,b)=>a+b,0),...v];if(w.some(x=>x< -1e-9))continue;}
  const p=ps.reduce((a,b,i)=>add(a,mul(b,w[i])),{x:0,y:0,z:0}),d=dot(p,p);
  if(!best||d<best.d-1e-14)best={p,d,points:ps.filter((_,i)=>w[i]>1e-10)};
 }return best;
}
function cylinderSupport(shape,pos,n){const xy=Math.hypot(n.x,n.y);return {x:pos.x+(xy?shape.radius*n.x/xy:0),y:pos.y+(xy?shape.radius*n.y/xy:0),z:pos.z+(n.z>0?shape.height:0)};}
function separation(shape,pos,solid){
 const support=n=>{let p=solid.vertices[0],v=dot(p,n);for(let i=1;i<solid.vertices.length;i++){const q=solid.vertices[i],w=dot(q,n);if(w>v){p=q;v=w;}}return sub(cylinderSupport(shape,pos,mul(n,-1)),p);};
 let simplex=[support({x:1,y:0,z:0})],last,priorNormal={x:0,y:0,z:0};
 for(let i=0;i<NUM.gjkIterations;i++){
  const c=closestSimplex(simplex);last=c;if(c.d<1e-16)return {distance:0,normal:priorNormal,bounded:true};
  const n=unit(c.p),p=support(n),lower=dot(n,p),upper=Math.sqrt(c.d);priorNormal=n;
  if(upper-lower<=NUM.distanceError)return {distance:Math.max(0,lower),normal:n,bounded:true};
  if(c.points.some(q=>norm(sub(p,q))<1e-10))return {distance:Math.max(0,lower),normal:n,bounded:true};
  simplex=[...c.points,p];
 }
 const n=unit(last.p),p=support(n);return {distance:Math.max(0,dot(n,p)),normal:n,bounded:false};
}
function compileSpatial(definition){
 const D=freeze(JSON.parse(JSON.stringify(definition))),byId=new Map(),grid=new Map(),supportsBySolid=new Map(),patches=new Map(D.supportPatches.map(p=>[p.id,p]));
 const solids=D.solids.map(s=>{const vertices=s.footprint.flatMap(p=>[s.lower,s.upper].map(pl=>({...p,z:planeAt(pl,p.x,p.y)}))),lo={},hi={};for(const k of ['x','y','z']){lo[k]=Math.min(...vertices.map(p=>p[k]));hi[k]=Math.max(...vertices.map(p=>p[k]));}const out={...s,vertices,lo,hi};byId.set(s.id,out);return out;});
 const key=(x,y)=>x+','+y;
 for(const s of solids)for(let y=Math.floor(s.lo.y/NUM.cell);y<=Math.floor(s.hi.y/NUM.cell);y++)for(let x=Math.floor(s.lo.x/NUM.cell);x<=Math.floor(s.hi.x/NUM.cell);x++){const k=key(x,y);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(s);}
 for(const p of D.supportPatches){if(!supportsBySolid.has(p.solidId))supportsBySolid.set(p.solidId,[]);supportsBySolid.get(p.solidId).push(p);}
 function candidates(lo,hi,channel='collision'){
  lo={...lo,x:Math.max(lo.x,D.bounds.min.x),y:Math.max(lo.y,D.bounds.min.y)};
  hi={...hi,x:Math.min(hi.x,D.bounds.max.x),y:Math.min(hi.y,D.bounds.max.y)};
  if(lo.x>hi.x||lo.y>hi.y)return [];
  const set=new Set();for(let y=Math.floor(lo.y/NUM.cell);y<=Math.floor(hi.y/NUM.cell);y++)for(let x=Math.floor(lo.x/NUM.cell);x<=Math.floor(hi.x/NUM.cell);x++)for(const s of grid.get(key(x,y))||[])if(s.hi.z>=lo.z&&s.lo.z<=hi.z&&s.channels[channel])set.add(s);
  return [...set].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 }
 const checkPose=p=>{if(!p||!['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1e7))throw Error('Finite XYZ within coordinate limits required');};
 const checkShape=s=>{if(!s||!(s.radius>0&&s.height>0&&Number.isFinite(s.radius)&&Number.isFinite(s.height)))throw Error('Positive finite cylinder required');};
 function clearance(shape,pos){checkPose(pos);checkShape(shape);const hits=[];
  for(const s of candidates({x:pos.x-shape.radius,y:pos.y-shape.radius,z:pos.z},{x:pos.x+shape.radius,y:pos.y+shape.radius,z:pos.z+shape.height})){
   let p=clip(s.footprint,s.upper.a,s.upper.b,s.upper.c-pos.z-NUM.epsilon);
   p=clip(p,-s.lower.a,-s.lower.b,pos.z+shape.height-s.lower.c-NUM.epsilon);
   if(area(p)>NUM.epsilon&&footprintRange(p,pos,Math.max(0,shape.radius-NUM.epsilon),s.upper))hits.push(s.id);
  }return {fits:!hits.length,solids:hits};
 }
 function supports(shape,pos,interval,previousSupport=null,direction={x:0,y:0,z:-1}){
  checkShape(shape);checkPose(pos);if(!Array.isArray(interval)||interval.length!==2||!interval.every(Number.isFinite)||interval[0]>interval[1])throw Error('Explicit finite support interval required');checkPose(direction);
  if(direction.z>NUM.epsilon)return [];
  const out=[];for(const s of candidates({x:pos.x-shape.radius,y:pos.y-shape.radius,z:interval[0]},{x:pos.x+shape.radius,y:pos.y+shape.radius,z:interval[1]}))for(const p of supportsBySolid.get(s.id)||[]){
   const range=footprintRange(p.polygon,pos,shape.radius,p.plane);if(!range||range.max<interval[0]-NUM.epsilon||range.max>interval[1]+NUM.epsilon)continue;
   if(!clearance(shape,{...pos,z:range.max}).fits)continue;
   out.push({id:p.id,solidId:s.id,z:range.max,normal:p.normal,point:range.point,materialId:p.materialId,navSurfaceId:p.navSurfaceId,plane:p.plane});
  }
  return out.sort((a,b)=>(Math.abs(Math.abs(a.z-pos.z)-Math.abs(b.z-pos.z))>NUM.tie?Math.abs(a.z-pos.z)-Math.abs(b.z-pos.z):0)||Number(b.id===previousSupport)-Number(a.id===previousSupport)||(a.id<b.id?-1:1));
 }
 function sweep(shape,start,displacement,channel='collision',margin=NUM.skin){
  if(!Number.isFinite(margin)||margin<0||margin>NUM.skin)throw Error('Invalid sweep margin');
  checkShape(shape);checkPose(start);checkPose(displacement);if(!['collision','visible','ir'].includes(channel))throw Error('Unsupported sweep channel');
  const end=add(start,displacement),lo={x:Math.min(start.x,end.x)-shape.radius-NUM.skin,y:Math.min(start.y,end.y)-shape.radius-NUM.skin,z:Math.min(start.z,end.z)-NUM.skin},hi={x:Math.max(start.x,end.x)+shape.radius+NUM.skin,y:Math.max(start.y,end.y)+shape.radius+NUM.skin,z:Math.max(start.z,end.z)+shape.height+NUM.skin};
  let hit=null;for(const solid of candidates(lo,hi,channel)){
   const faces=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1},{x:-solid.upper.a,y:-solid.upper.b,z:1},{x:solid.lower.a,y:solid.lower.b,z:-1}];
   for(let i=0;i<solid.footprint.length;i++){const a=solid.footprint[i],b=solid.footprint[(i+1)%solid.footprint.length];faces.push({x:b.y-a.y,y:a.x-b.x,z:0});}
   // A separating face that remains separating over this entire segment proves
   // no impact, including exact resting/tangent contacts (GJK distance = zero).
   if(faces.some(n=>dot(cylinderSupport(shape,start,mul(n,-1)),n)-Math.max(...solid.vertices.map(v=>dot(v,n)))>=-NUM.epsilon&&dot(displacement,n)>=-NUM.epsilon))continue;
   let t=0,normal={x:0,y:0,z:0},done=false;
   for(let i=0;i<NUM.advanceIterations;i++){
    const sep=separation(shape,add(start,mul(displacement,t)),solid);normal=sep.normal;
    const approach=-dot(normal,displacement);
    if(sep.distance<=margin+NUM.distanceError){if(approach>NUM.epsilon||norm(normal)<.5){const h={t,normal,primitiveId:solid.id,point:add(start,mul(displacement,t)),diagnostic:sep.bounded?null:'GJK_LIMIT'};if(!hit||t<hit.t-NUM.tie||(Math.abs(t-hit.t)<=NUM.tie&&solid.id<hit.primitiveId))hit=h;}done=true;break;}
    if(approach<=NUM.epsilon){done=true;break;}
    const advance=(sep.distance-margin)/approach;
    if(t+advance>1+NUM.tie){done=true;break;}t=Math.min(1,t+advance);
   }
   if(!done){const h={t,normal,primitiveId:solid.id,point:add(start,mul(displacement,t)),diagnostic:'SWEEP_LIMIT'};if(!hit||t<hit.t)hit=h;}
  }return hit;
 }
 function raycast(from,to,channel='collision'){
  checkPose(from);checkPose(to);if(!['collision','visible','ir'].includes(channel))throw Error('sound transmission: NOT IMPLEMENTED BY DESIGN — Stage E');
  const delta=sub(to,from),lo={},hi={};for(const k of ['x','y','z']){lo[k]=Math.min(from[k],to[k]);hi[k]=Math.max(from[k],to[k]);}
  let best=null;for(const s of candidates(lo,hi,channel)){
   const planes=[{n:{x:-s.upper.a,y:-s.upper.b,z:1},c:-s.upper.c},{n:{x:s.lower.a,y:s.lower.b,z:-1},c:s.lower.c}];
   for(let i=0;i<s.footprint.length;i++){const a=s.footprint[i],b=s.footprint[(i+1)%s.footprint.length];planes.push({n:{x:b.y-a.y,y:a.x-b.x,z:0},c:b.x*a.y-a.x*b.y});}
   let enter=0,exit=1,normal={x:0,y:0,z:0};for(const p of planes){const v=dot(p.n,from)+p.c,d=dot(p.n,delta);if(Math.abs(d)<NUM.epsilon){if(v>0){exit=-1;break;}}else {const t=-v/d;if(d<0){if(t>enter){enter=t;normal=unit(p.n);}}else exit=Math.min(exit,t);}}
   if(enter<=exit&&enter>=0&&enter<=1&&(!best||enter<best.t-NUM.tie||(Math.abs(enter-best.t)<=NUM.tie&&s.id<best.primitiveId)))best={t:enter,point:add(from,mul(delta,enter)),normal,primitiveId:s.id,materialId:s.materialId,distance:norm(delta)*enter};
  }return best;
 }
 const deferred=name=>()=>{throw Error(name+': NOT IMPLEMENTED BY DESIGN — Stage E/G');};
 return Object.freeze({definition:D,identity:freeze({schemaVersion:D.schemaVersion,assetId:D.assetId,geometryRevision:D.geometryRevision,contentHash:contentHash(D),geometryMode:'spatial',compilerRevision:'stage-c-1'}),numeric:NUM,
  clearance,supports,sweep,raycast,contact:deferred('contact'),traceSupportMotion:deferred('traceSupportMotion'),
  supportPatch:id=>patches.get(id)||null,
  spacesAt:p=>{checkPose(p);return D.spaces.filter(s=>['x','y','z'].every(k=>p[k]>=s.bounds.min[k]&&p[k]<=s.bounds.max[k])&&!raycast(p,p)).map(s=>s.id);},
  // Instrumentation reports immutable index size, never drives simulation budgets.
  indexInfo:freeze({cells:grid.size,solids:solids.length,cellSize:NUM.cell}),footprintRange});
}

function compile(definition,WORLD){
 validate(definition);
 if(definition.geometryMode==='spatial')return compileSpatial(definition);
 if(!WORLD||!WORLD.levelDefinition||WORLD.levelDefinition.contentHash!==definition.contentHash)throw Error('WORLD definition mismatch');
 const D=freeze(JSON.parse(JSON.stringify(definition))),F=D.flat;
 const anchorXY=id=>{const a=D.anchors.find(a=>a.id===id);if(!a)throw Error('Unknown anchor '+id);return {x:a.x,y:a.y};};
 var FBW=F.width,FBH=F.height,Oc=F.rooms.map(({id,...r})=>r),kc=new Uint8Array(FBW*FBH);function Ac(e,t,n,r){for(let i=t;i<t+r;i++)for(let t=e;t<e+n;t++)t>=0&&i>=0&&t<FBW&&i<FBH&&(kc[i*FBW+t]=1)}function jc(e,t,n,r){for(let i=t;i<t+r;i++)for(let t=e;t<e+n;t++)t>=0&&i>=0&&t<FBW&&i<FBH&&(kc[i*FBW+t]=0)}Oc.forEach(e=>Ac(e.x,e.y,e.w,e.h)),F.floorCarves.forEach(e=>Ac(...e)),F.wallCarves.forEach(e=>jc(...e)),F.doorCarves.forEach(e=>Ac(...e));WORLD.carve(kc,FBW);var Mc=F.columns.map(({id,...p})=>p);for(let e of Mc)jc(e.x,e.y,1,1);var Nc=[];for(let e=0;e<FBH;e++)for(let t=0;t<FBW;t++)kc[e*FBW+t]||Nc.push({x:t*96,y:e*96,w:96,h:96});var Pc=[];for(let e of F.pillarGrid.xs)for(let t of F.pillarGrid.ys)Pc.push({x:e*96-F.pillarGrid.half,y:t*96-F.pillarGrid.half,w:F.pillarGrid.size,h:F.pillarGrid.size});var Fc=[];Oc.forEach((e,t)=>{if(F.rooms[t].id!==F.lampRule.excludeRoomId)for(let n=e.x+F.lampRule.offset;n<e.x+e.w-F.lampRule.margin;n+=F.lampRule.stride)for(let r=e.y+F.lampRule.offset;r<e.y+e.h-F.lampRule.margin;r+=F.lampRule.stride)kc[r*FBW+n]&&Fc.push({x:(n+F.lampRule.center)*96,y:(r+F.lampRule.center)*96})});var Ic=anchorXY("spawn:player");
var zc=(e,t)=>e>=0&&t>=0&&e<FBW&&t<FBH&&kc[t*FBW+e]===1;function Bc(e,t){let n=[],r=Math.floor(e/96),i=Math.floor(t/96);for(let e=i-1;e<=i+1;e++)for(let t=r-1;t<=r+1;t++)zc(t,e)||n.push({x:t*96,y:e*96,w:96,h:96});for(let r of Pc)Math.abs(r.x-e)<250&&Math.abs(r.y-t)<250&&n.push(r);return WORLD.addNear(n,e,t)}var Vc=new Set(Mc.map(e=>e.y*FBW+e.x)),Hc=(e,t)=>e<0||t<0||e>=FBW||t>=FBH||!zc(e,t)&&!Vc.has(t*FBW+e);function Uc(e,t,n,r){let i=Math.cos(n),a=Math.sin(n),o=i>=0?1:-1,s=a>=0?1:-1,c=Math.floor(e/96),l=Math.floor(t/96),u=r;if(Hc(c,l))return 0;let d=Math.abs(i)<1e-10?1/0:96/Math.abs(i),f=Math.abs(a)<1e-10?1/0:96/Math.abs(a),p=Math.abs(i)<1e-10?1/0:((c+ +(o>0))*96-e)/i,m=Math.abs(a)<1e-10?1/0:((l+ +(s>0))*96-t)/a;for(;Math.min(p,m)<u;)if(Math.abs(p-m)<1e-8){let e=p;if(Hc(c+o,l)||Hc(c,l+s)){u=e;break}if(c+=o,l+=s,p+=d,m+=f,Hc(c,l)){u=e;break}}else if(p<m){let e=p;if(c+=o,p+=d,Hc(c,l)){u=e;break}}else{let e=m;if(l+=s,m+=f,Hc(c,l)){u=e;break}}for(let n of Pc){if(Math.abs(i)<1e-10&&(e<n.x||e>n.x+n.w)||Math.abs(a)<1e-10&&(t<n.y||t>n.y+n.h))continue;let r=Math.abs(i)<1e-10?-1/0:(n.x-e)/i,o=Math.abs(i)<1e-10?1/0:(n.x+n.w-e)/i,s=Math.abs(a)<1e-10?-1/0:(n.y-t)/a,c=Math.abs(a)<1e-10?1/0:(n.y+n.h-t)/a,l=Math.max(Math.min(r,o),Math.min(s,c));Math.min(Math.max(r,o),Math.max(s,c))>=Math.max(0,l)&&l>=0&&(u=Math.min(u,l))}return Math.max(0,u)}
var el=F.legacyItems.roomIds.map(id=>F.rooms.findIndex(r=>r.id===id)).map(e=>{let t=Oc[e],n=(t.x+t.w*.48)*96,r=(t.y+t.h*.55)*96;return Bc(n,r).some(e=>Math.hypot(n-Math.max(e.x,Math.min(n,e.x+e.w)),r-Math.max(e.y,Math.min(r,e.y+e.h)))<48)&&(n=(t.x+t.w*.7)*96,r=(t.y+t.h*.35)*96),{x:n,y:r,found:!1,room:t.name}});
var il=F.navCell,W=FBW*2,al=FBH*2,ol=F.navRadius;function sl(e,t,n=ol){return Bc(e,t).every(r=>Math.hypot(e-Math.max(r.x,Math.min(e,r.x+r.w)),t-Math.max(r.y,Math.min(t,r.y+r.h)))>=n)}function cl(e,t,n=ol){let r=Math.hypot(t.x-e.x,t.y-e.y),i=Math.ceil(r/12);for(let r=0;r<=i;r++){let a=i?r/i:0;if(!sl(e.x+(t.x-e.x)*a,e.y+(t.y-e.y)*a,n))return!1}return!0}var ll=new Uint8Array(W*al);for(let e=0;e<al;e++)for(let t=0;t<W;t++){let n=(t+.5)*il,r=(e+.5)*il;ll[e*W+t]=Number(zc(Math.floor(n/96),Math.floor(r/96))&&sl(n,r))}var ul=e=>({x:(e%W+.5)*il,y:(Math.floor(e/W)+.5)*il});function dl(e,t=!1){let n=-1,r=1/0,i=Math.floor(e.x/il),a=Math.floor(e.y/il);for(let o=Math.max(0,a-4);o<=Math.min(al-1,a+4);o++)for(let a=Math.max(0,i-4);a<=Math.min(W-1,i+4);a++){let i=o*W+a;if(!ll[i])continue;let s=ul(i),c=Math.hypot(e.x-s.x,e.y-s.y);c<r&&cl(e,s,t?1:ol)&&(n=i,r=c)}return n}function fl(e,t){let n=dl(e),r=dl(t,!0);if(n<0||r<0)return[];let i=new Int32Array(W*al).fill(-1),a=new Int32Array(W*al),o=0,s=1;for(a[0]=n,i[n]=n;o<s&&i[r]<0;){let e=a[o++];for(let t of[e-1,e+1,e-W,e+W])t<0||t>=W*al||!ll[t]||i[t]>=0||Math.abs(t%W-e%W)+Math.abs(Math.floor(t/W)-Math.floor(e/W))===1&&(i[t]=e,a[s++]=t)}if(i[r]<0)return[];let c=[];for(let e=r;e!==n;e=i[e])c.push(ul(e));return c.push(ul(n)),c.reverse(),cl(ul(r),t)&&c.push({...t}),c}function pl(e,t,n,r=ol){let i={...e};for(let a of[`x`,`y`]){e[a]+=a===`x`?t:n;for(let t of Bc(e.x,e.y)){let n=e.x-Math.max(t.x,Math.min(e.x,t.x+t.w)),o=e.y-Math.max(t.y,Math.min(e.y,t.y+t.h)),s=Math.hypot(n,o);s<r&&(s>0?(e.x+=n/s*(r-s),e.y+=o/s*(r-s)):e[a]=i[a])}}}

 if(Fc.length!==F.lampIds.length||Pc.length!==F.pillarGrid.ids.length)throw Error('Generated identity count mismatch');
 const materialProfileHash=sha256(canonical(WORLD.SURF));
 const identity=Object.freeze({schemaVersion:D.schemaVersion,assetId:D.assetId,contentRevision:D.contentRevision,contentHash:D.contentHash,geometryMode:D.geometryMode,materialProfileHash});
 const withMode=(mode,fn)=>{WORLD.setMode(mode||'walk');try{return fn();}finally{WORLD.setMode('walk');}};
 const planar=Object.freeze({floor:zc,clear:(x,y,r,mode)=>withMode(mode,()=>sl(x,y,r)),blockers:(x,y,mode)=>withMode(mode,()=>Bc(x,y)),ray:Uc,surfaceAt:(x,y)=>WORLD.surfaceAt(x,y,Oc),crawlAt:(x,y,pad)=>WORLD.crawlAt(x,y,pad),lowZone:(x,y,pad)=>WORLD.lowZone(x,y,pad),anchorXY,lamp:id=>{const i=F.lampIds.indexOf(id);return i<0?null:{...Fc[i]};}});
 const flat=Object.freeze({FBW,FBH,Oc,kc,Mc,Nc,Pc,Fc,Ic,zc,Bc,Hc,Uc,el,il,W,al,ol,sl,cl,ll,ul,dl,fl,pl,patrol:F.patrol.map(({id,...p})=>p)});
 const bindAdapter=dynamic=>({key:D.assetId+':'+D.contentHash+':'+materialProfileHash,cols:W,rows:al,cell:il,W:FBW*96,H:FBH*96,rooms:Oc,lamps:Fc,floor:planar.floor,clear:planar.clear,blockers:planar.blockers,ray:planar.ray,blackout:dynamic.blackout,qc:dynamic.qc,kinds:dynamic.kinds});
 const spatial=Object.fromEntries(['supports','clearance','sweep','raycast','contact','traceSupportMotion'].map(name=>[name,()=>{throw Error(name+': NOT IMPLEMENTED BY DESIGN — Stage C');}]));
 return Object.freeze({definition:D,identity,flat,planar,bindAdapter,...spatial});
}
return Object.freeze({validate,compile,canonical,sha256,contentHash});
});
