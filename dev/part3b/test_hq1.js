'use strict';
// Part 3B HQ1 focused presentation checks (deterministic). Usage: node test_hq1.js <out.json>
// Locks under test: strictly top-down orthographic camera, local wall-face bands
// on all four directions, exact footprints, local player at scale 1.0 with
// bounded relative-Z actor scale, band picking onto the physical face, smoothed
// stair/fall cue and unchanged cutaway semantics. Legacy fixtures stay untouched.
const fs=require('fs'),path=require('path'),assert=require('assert'),V=require('../../world_view'),G=require('../../world_geometry'),M=require('../../world_motion'),d=require('../../levels/level0_spatial.json');
const out=path.resolve(process.argv[2]),rows=[];fs.mkdirSync(path.dirname(out),{recursive:true});
const save=(status,error)=>fs.writeFileSync(out,JSON.stringify({status,rows,error:error&&{message:String(error),stack:error.stack}},null,2)+'\n');
function test(name,fn){const detail=fn();rows.push({name,...detail});save('IN_PROGRESS');}
const before=JSON.stringify(d),g=G.compile(d),model=V.compile(g.definition),solid=id=>model.solids.find(s=>s.id===id);
const camera=(x,y,z,anchorZ=z)=>({x,y,z,depth:false,elevation:0,topDown:true,anchorZ});
const zAt=(p,q)=>p.a*q.x+p.b*q.y+p.c,drawn=model.solids.filter(s=>!s.cameraIgnored);
const insideFootprint=(s,p,tol=1e-6)=>s.footprint.every((a,k)=>s.planes[k][0]*p.x+s.planes[k][1]*p.y-s.planes[k][3]<=tol);
const dirs={north:{x:0,y:-1},south:{x:0,y:1},east:{x:1,y:0},west:{x:-1,y:0}},dirOf=n=>Object.keys(dirs).find(k=>Math.abs(dirs[k].x-n.x)<1e-9&&Math.abs(dirs[k].y-n.y)<1e-9);
const REFERENCE='solid:wall:0_0_768_672';
try{
test('production camera is strictly top-down: no tilt, no oblique offset, no Z-based XY scale',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../../spatial_client.js'),'utf8');
 assert(/depth:false,elevation:0,topDown:true,anchorZ\}/.test(src),'production camera literal');assert(!/depth:true/.test(src),'no layer-depth production camera');
 let samples=0;for(const cz of [-96,0,72,180])for(const scale of [.5,.9259259259259259,2.4]){const c=camera(1234,567,cz);
  for(const z of [-112,-16,0,42,90,164,180,276,360]){const p={x:1300.25,y:612.5,z},q=V.project(p,c,scale);
   assert.equal(q.x,scale*(p.x-c.x));assert.equal(q.y,scale*(p.y-c.y));assert.equal(V.layerScale(z,c),1);assert.equal(V.depth(p,c),z-cz);
   const back=V.onPlane(q,z,c,scale);assert(Math.abs(back.x-p.x)<1e-9&&Math.abs(back.y-p.y)<1e-9);samples++;}
  const ray=V.pickingRay({x:37,y:-91},c,scale);assert.equal(ray.from.x,ray.to.x);assert.equal(ray.from.y,ray.to.y);assert(!ray.segments);}
 let corners=0;const c=camera(5000,3000,90);for(const s of drawn)for(const p of s.footprint){const lo=V.project({...p,z:zAt(s.lower,p)},c,1),hi=V.project({...p,z:zAt(s.upper,p)},c,1);assert.deepEqual(lo,hi);corners++;}
 return {samples,footprintCornersCoincident:corners,camera:camera(0,0,0)};
});
test('rooms stay rectangles: caps keep exact footprints, bands are perpendicular strips inside their solid',()=>{
 const P=model.planarVertices,stride=10;let caps=0,strips=0,extensions=0;
 for(const p of model.planarPackets){const s=model.solids[p.index],n=s.footprint.length,capVerts=(n-2)*3;
  for(let v=0;v<capVerts;v++){const o=(p.first+v)*stride;assert.equal(P[o+6],0);assert.equal(P[o+7],0);assert(s.footprint.some(q=>q.x===P[o]&&q.y===P[o+1]),'cap vertex is a footprint vertex');assert.equal(P[o+2],zAt(s.upper,{x:P[o],y:P[o+1]}));}caps++;
  for(const w of [-112,-96,0,72,180,276].map(cz=>V.bandWidth(s,{topDown:true,z:cz})).concat(Math.min(V.BAND.max,V.BAND.share*s.thickness)))for(const b of s.bands){const tris=V.bandMesh(b,w),strip=[tris[0][0].d,tris[0][1].d,tris[0][2].d,tris[1][2].d];
   const e1={x:strip[1].x-strip[0].x,y:strip[1].y-strip[0].y},e2={x:strip[2].x-strip[1].x,y:strip[2].y-strip[1].y},e3={x:strip[3].x-strip[2].x,y:strip[3].y-strip[2].y};
   assert(Math.abs(e1.x*e2.x+e1.y*e2.y)<1e-6,'right angle');assert(Math.abs(e1.x+e3.x)<1e-9&&Math.abs(e1.y+e3.y)<1e-9,'parallel equal sides');assert(Math.abs(Math.hypot(e2.x,e2.y)-w)<1e-9,'strip width');
   assert.deepEqual(strip[0],b.a);assert.deepEqual(strip[1],b.b);for(const q of strip)assert(insideFootprint(s,q,1e-6),s.id+' strip inside own footprint');strips++;
   for(const t of tris.slice(2))for(const q of t){assert(drawn.some(o=>insideFootprint(o,q.d,1e-6)),'concave extension stays inside the solid mass');extensions++;}}}
 // Walls and pillars never draw over open floor: every band point is under some taller solid's footprint.
 const floors=model.solids.filter(s=>/^solid:(ground|gap-floor|lower:blackout)/.test(s.id)),tall=drawn.filter(s=>/^solid:(wall|pillar|prop|upper|lower:retaining)/.test(s.id));let checked=0;
 const openFloor=q=>floors.some(f=>insideFootprint(f,q,-1e-6))&&!tall.some(s=>insideFootprint(s,q,1e-6));
 for(const s of drawn.filter(s=>/^solid:(wall|pillar):/.test(s.id)))for(const b of s.bands)for(const t of V.bandMesh(b,Math.min(V.BAND.max,V.BAND.share*s.thickness)))for(const q of t){assert(!openFloor(q.d),s.id+' band over open floor');checked++;}
 return {caps,strips,extensionVertices:extensions,wallBandVerticesOffFloors:checked};
});
test('all four wall directions get bounded local depth bands; the elevation cue is monotonic',()=>{
 const counts={north:0,south:0,east:0,west:0},joins={convex:0,concave:0,square:0};
 for(const s of drawn.filter(s=>/^solid:(wall|pillar):/.test(s.id)))for(const b of s.bands){counts[dirOf(b.normal)]++;joins[b.joina]++;joins[b.joinb]++;}
 for(const k of Object.keys(counts))assert(counts[k]>50,k+' wall faces banded');
 const ref=solid(REFERENCE),cue=[];let previous=Infinity;
 for(let cz=-96;cz<=180;cz+=6){const w=V.bandWidth(ref,{topDown:true,z:cz});assert(w<previous);previous=w;cue.push([cz,+w.toFixed(3)]);}
 assert(Math.abs(V.bandWidth(ref,{topDown:true,z:0})-17.924)<.01);assert(Math.abs(V.bandWidth(ref,{topDown:true,z:180})-10.146)<.01);assert(Math.abs(V.bandWidth(ref,{topDown:true,z:-96})-26.4)<.01);
 assert.equal(V.bandWidth(ref,{z:0}),0,'legacy cameras have no bands');
 for(const s of drawn)for(let cz=-112;cz<=380;cz+=17){const w=V.bandWidth(s,{topDown:true,z:cz});if(!s.bands.length){assert.equal(w,0);continue;}assert(w>0&&w<=V.BAND.max&&w<=V.BAND.share*s.thickness+1e-9,s.id);}
 // Seen from real room anchors, eye-facing bands occur in all four directions.
 const seen={north:0,south:0,east:0,west:0};for(const a of d.anchors.filter(a=>a.position&&a.position.z===0)){const eye={...a.position,z:50};
  for(const i of V.candidates(model,{x:eye.x-700,y:eye.y-450,z:-1e9},{x:eye.x+700,y:eye.y+450,z:1e9})){const s=model.solids[i];if(s.cameraIgnored||!/^solid:(wall|pillar):/.test(s.id))continue;for(const b of s.bands)if(!V.facingAway(b,eye))seen[dirOf(b.normal)]++;}}
 for(const k of Object.keys(seen))assert(seen[k]>0,k+' faces seen from anchors');
 return {wallBandsByDirection:counts,joins,eyeFacingFromAnchors:seen,referenceWallCue:cue,band:V.BAND};
});
test('local player renders at exactly 1.0; relative-Z actor scale is subtle, bounded and per-client',()=>{
 let exact=0;for(const z of [-96,-12.375,0,1e-9,44.25,72,90.5,164,180,276])for(const offset of [0,-7.5,-.125,3.25,8]){const me={kind:'player',z,renderOffset:offset},c={...camera(0,0,z),anchorZ:V.presentedZ(me)};assert.equal(V.relativeScale(me,c),1);exact++;}
 const A={kind:'player',z:180},B={kind:'peer',z:0},onA={anchorZ:180},onB={anchorZ:0};
 const bOnA=V.relativeScale(B,onA),aOnB=V.relativeScale({...A,kind:'peer'},onB);assert.equal(V.relativeScale(A,onA),1);assert.equal(V.relativeScale({...B,kind:'player'},onB),1);
 assert(bOnA<1&&bOnA>=V.DEPTH.minScale);assert(aOnB>1&&aOnB<=V.DEPTH.maxScale);
 let prev=0;for(let dz=-2000;dz<=2000;dz+=5){const s=V.relativeScale({kind:'hound',z:dz},{anchorZ:0});assert(s>=V.DEPTH.minScale&&s<=V.DEPTH.maxScale);assert(s>=prev);prev=s;}
 for(const kind of V.RELATIVE)assert(V.relativeScale({kind,z:150},{anchorZ:0})>1,kind);
 for(const kind of ['lamp','label','item','exit','decal','trail'])assert.equal(V.relativeScale({kind,z:150},{anchorZ:0}),1,kind);
 assert.equal(V.relativeScale({kind:'hound',z:150},{}),1,'no anchor, no scale');
 return {exactLocalSamples:exact,example:{bAt0OnClientA180:bOnA,aAt180OnClientB0:aOnB},bounds:[V.DEPTH.minScale,V.DEPTH.maxScale],relativeKinds:V.RELATIVE};
});
test('picking: a band resolves to its exact physical face; floors, caps and scaled actors stay exact',()=>{
 const eye={x:984,y:3264,z:50},c=camera(984,3264,0),width=1280,height=800,scope=V.footprint(width,height,c),view=new V.LocalView(model,'hq1');view.update({x:984,y:3264,z:0,height:60,radius:15},.25,{camera:c});
 const toScreen=p=>({x:(p.x-c.x)*scope.scale,y:(p.y-c.y)*scope.scale}),pick=(screen,actors=[])=>V.pick(model,{screen,camera:c,eye,width,height,view,actors});
 // Every eye-facing, eye-visible wall band in scope: sample it and check the hit.
 const w=V.bandWidth(solid(REFERENCE),c);let faces=0,bandsChecked=0;const directions=new Set();
 for(const i of V.candidates(model,{x:scope.minX,y:scope.minY,z:-1e9},{x:scope.maxX,y:scope.maxY,z:1e9})){const s=model.solids[i];if(!/^solid:(wall|pillar):/.test(s.id))continue;
  for(const b of s.bands){if(V.facingAway(b,eye))continue;const L=Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y),u={x:(b.b.x-b.a.x)/L,y:(b.b.y-b.a.y)/L},n=b.normal;let ok=0;
   for(const along of [.2,.5,.8])for(const t of [.15,.5,.85]){const base={x:b.a.x+u.x*L*along,y:b.a.y+u.y*L*along},disp={x:base.x-n.x*w*t,y:base.y-n.y*w*t};if(!V.within(disp,scope))continue;
    const s2=V.displayedSurface(model,disp.x,disp.y,c,eye,view);if(!s2||s2.kind!=='band'||s2.solid!==s)continue;const face={x:base.x,y:base.y,z:b.za[0]+(b.za[1]-b.za[0])*t};if(!V.visible(model,eye,face,s.index))continue;
    const hit=pick(toScreen(disp));assert.equal(hit.kind,'face');assert.equal(hit.primitiveId,s.id);assert.equal(hit.presentation,'band');
    assert(Math.abs(hit.point.x-face.x)<1e-6&&Math.abs(hit.point.y-face.y)<1e-6&&Math.abs(hit.point.z-face.z)<1e-6,JSON.stringify({hit:hit.point,face}));
    assert(Math.abs(n.x*hit.point.x+n.y*hit.point.y-(n.x*b.a.x+n.y*b.a.y))<1e-9,'on the physical face plane');faces++;ok++;}
   if(ok){bandsChecked++;directions.add(dirOf(n));}}}
 assert(faces>=6&&bandsChecked>=2,'band picks sampled');
 // Open floor: the vertical ray returns the floor point under the cursor.
 const floorPoint={x:1004,y:3300},floor=pick(toScreen(floorPoint));assert.equal(floor.kind,'face');assert(floor.primitiveId.startsWith('solid:ground:'));assert(Math.abs(floor.point.x-1004)<1e-9&&Math.abs(floor.point.y-3300)<1e-9&&floor.point.z===0);
 // A wall cap beyond its band is unseen from the eye: no wall face is picked there.
 const capPoint={x:900,y:3264},cap=V.displayedSurface(model,capPoint.x,capPoint.y,c,eye,view),capHit=pick(toScreen(capPoint));assert.equal(cap.kind,'cap');assert.notEqual(capHit.kind,'face');
 // Relative scale changes only the presented radius; hits map back onto the body.
 // (anchor 120 above this floor: the hound is presented below the local player)
 const low={id:'h9',kind:'hound',x:1060,y:3330,z:0,height:40,radius:16,observable:true},ca={...c,anchorZ:120},s=V.relativeScale(low,ca);assert(s<1);
 const pickA=screen=>V.pick(model,{screen,camera:ca,eye,width,height,view,actors:[low]}),r=low.radius*s,inside=pickA(toScreen({x:low.x+r*.98,y:low.y})),outside=pickA(toScreen({x:low.x+r*1.02,y:low.y}));
 assert.equal(inside.kind,'actor');assert.notEqual(outside.kind==='actor'&&outside.actorId,'h9');assert(Math.hypot(inside.point.x-low.x,inside.point.y-low.y)<=low.radius+1e-9);
 // Inner room corner (288,2592): the corner square behind it is split on the
 // mitre diagonal. The north wall's face owns points whose westward distance
 // past the corner is below their northward inset; the west wall's face the rest.
 const corner=solid('solid:wall:0_2592_288_480'),north=solid('solid:wall:0_2304_768_288'),cc=camera(520,2820,0),e2={x:520,y:2820,z:50},cw=V.bandWidth(corner,cc);
 const a=V.displayedSurface(model,288-cw*.7,2592-cw*.2,cc,e2,null),b=V.displayedSurface(model,288-cw*.2,2592-cw*.7,cc,e2,null);
 assert.equal(a.kind,'band');assert.equal(a.solid,corner,'west wall face beyond the diagonal');assert.equal(b.kind,'band');assert.equal(b.solid,north,'north wall face before the diagonal');
 for(const q of [a,b]){const s=q.solid,bd=s.bands.find(x=>x.id===q.band);assert(Math.abs(bd.normal.x*q.point.x+bd.normal.y*q.point.y-(bd.normal.x*bd.a.x+bd.normal.y*bd.a.y))<1e-9,'corner pixels sample the physical face');}
 return {bandWidth:w,facesPicked:faces,bandsChecked,directions:[...directions],floor:floor.point,capPick:capHit.kind,actorScale:s,cornerOwners:[a.solid.id,b.solid.id]};
});
test('stairs and falls keep a smoothed elevation cue (camera spring), never a snap',()=>{
 const ref=solid(REFERENCE),results=[];
 const replay=(name,poses,destination)=>{const actor=new V.ActorElevation(),cam=new V.CameraElevation();let peakSmooth=0,peakRaw=0,prevS=null,prevR=null,first,last;
  for(let i=0;i<poses.length+90;i++){const p=poses[Math.min(i,poses.length-1)],rendered=actor.update(p,1/60,'life:1'),z=cam.update(rendered.z,1/60,'life:1',true);
   const ws=V.bandWidth(ref,{topDown:true,z}),wr=V.bandWidth(ref,{topDown:true,z:p.z});if(prevS!==null){peakSmooth=Math.max(peakSmooth,Math.abs(ws-prevS));peakRaw=Math.max(peakRaw,Math.abs(wr-prevR));}
   prevS=ws;prevR=wr;first??=ws;last=ws;}
  const target=V.bandWidth(ref,{topDown:true,z:destination});assert(Math.abs(last-target)<.01,name+' settles on destination cue');assert(peakSmooth<peakRaw,name+' smoothing');
  const row={name,startCue:first,endCue:last,peakFrameChangeSmoothed:peakSmooth,peakFrameChangeUnsmoothed:peakRaw,reduction:1-peakSmooth/peakRaw};results.push(row);return row;};
 for(const id of ['link:long-room-stairs:forward','link:long-room-stairs:reverse']){const proof=M.proveTraversal(g,d.traversalLinks.find(l=>l.id===id),M.PROFILES.stand,{record:true});assert(proof.ok,id);
  const poses=proof.poses.map((p,i,a)=>({...p,shape:M.PROFILES.stand,vz:i?(p.z-a[i-1].z)*60:0}));const row=replay(id,poses,poses.at(-1).z);assert(row.reduction>=.4,id+' stair cue smoothing '+row.reduction);}
 const fall=(name,start,vx,vy,count,destination)=>{const m=M.create(g),b=m.initialize({...start}),poses=[];for(let i=0;i<count;i++){b.vx=i<120?vx(i):0;b.vy=vy(i);m.step(b);poses.push({x:b.x,y:b.y,z:b.z,vz:b.vz,shape:b.shape,supportId:b.supportId,motionMode:b.motionMode});}
  assert(poses.some(p=>p.motionMode==='airborne'));assert(Math.abs(poses.at(-1).z-destination)<.06);const row=replay(name,poses,destination);assert(Math.abs(row.endCue-row.startCue)>3,name+' visible cue change');};
 fall('fall 180 to 0',{x:5616,y:1450,z:180},()=>0,i=>i<65?172:0,140,0);fall('fall 0 to -96',{x:936,y:5568,z:0},()=>-100,()=>0,190,-96);
 return {reference:REFERENCE,results};
});
test('cutaway stays client-local and semantic under the top-down camera',()=>{
 const run=(p,enabled=true)=>{const v=new V.LocalView(model);v.update(p,.25,{camera:camera(p.x,p.y,p.z),enabled});return v;};
 const inside={x:1776,y:864,z:0,height:24,radius:15},outside={x:1584,y:864,z:0,height:60,radius:15},cover='solid:crawl:north:roof';
 assert.equal(run(inside).fadeFor(cover),1);assert.equal(run(outside).fadeFor(cover),0);assert.equal(run({...outside,height:24}).fadeFor(cover),0);assert.equal(run(inside,false).fadeFor(cover),0);
 const lower={x:6192,y:864,z:0,height:60,radius:15},upper={...lower,z:180},slab='solid:upper:long-room';
 assert.equal(run(lower).fadeFor(slab),1);assert.equal(run(upper).fadeFor(slab),0);
 const rooms=[{x:984,y:3264},{x:3100,y:3150},{x:8100,y:1150},{x:5000,y:3000},{x:7900,y:3500}].map(p=>run({...p,z:0,height:60,radius:15}).snapshot().groups.filter(g=>g.target).map(g=>g.id));
 assert(rooms.every(r=>r.length===0),'ordinary rooms: no roof blackout or cutaway');
 assert(!V.visible(model,{...lower,z:50},{...upper,z:210})&&!V.visible(model,{...upper,z:230},{...lower,z:30}),'physical slab still blocks both ways');
 return {northInside:run(inside).snapshot().groups.filter(g=>g.target).map(g=>g.id),longLower:run(lower).snapshot().groups.filter(g=>g.target).map(g=>g.id),ordinaryRooms:rooms};
});
test('legacy fixtures and physical truth are untouched',()=>{
 const c={x:200,y:300,z:0};assert.deepEqual(V.project({x:250,y:330,z:100},c,1),{x:50,y:30-50});assert.equal(V.denominator(100,{...c,depth:true}),1-100/3600);
 assert.equal(JSON.stringify(d),before);assert(Object.isFrozen(model)&&Object.isFrozen(model.solids[0].bands));
 return {legacyObliqueDefault:V.ELEVATION,legacyLayerDepth:V.DEPTH};
});
save('PASS');console.log('PASS HQ1 focused: strict top-down camera, exact footprints, four-direction bounded bands, local 1.0 anchor, band picking, smoothed stair/fall cue, local cutaway');
}catch(e){save('FAIL',e);throw e;}
