'use strict';
// Part 3B HQ1 focused production browser check. Usage: node browser_hq1.js <outdir>
// Real server + real clients on Level 0: the production camera is strictly
// top-down, raising/lowering camera Z changes ONLY local wall-face band pixels
// (no global XY scale or offset), bands pick their physical face, and each
// client renders its own player at exactly 1.0 with peers relatively scaled.
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open}=require('../stage_h/browser_support');
const d=require('../../levels/level0_spatial.json'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
function support(x,y,z){const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;};
 const c=d.supportPatches.filter(s=>s.supports!==false&&!s.id.startsWith('support:ceiling')&&inside({x,y},s.polygon)).map(s=>({s,z:s.plane.a*x+s.plane.b*y+s.plane.c})).filter(o=>Math.abs(o.z-z)<1.5).sort((a,b)=>Math.abs(a.z-z)-Math.abs(b.z-z));
 if(!c.length)throw Error('no support at '+[x,y,z]);return {x,y,z:c[0].z,support:c[0].s.id};}
const views=[
 {name:'spawn-corridor',x:984,y:3264,z:0},
 {name:'room-inner-corner',x:520,y:2820,z:0},
 {name:'pillar-hall',x:8100,y:1150,z:0},
 {name:'stairs-raised',x:5616,y:1312,z:72},
 {name:'long-room-upper',x:6192,y:864,z:180,support:'support:upper:long-room'},
 {name:'depression-floor',x:720,y:5560,z:-96}
];
// In-page probe: geometry-only renders at two camera heights, pixel diff, and
// one exact band pick. Returns compact evidence; throws nothing (asserted here).
const probe=()=>{__spatial.render(true);const s=__spatial,V=TFB_VIEW,o=s.state.renderOptions,A=o.camera,B={...A,z:A.z+180};
 const flat=camera=>{s.pass.render({...o,camera,lights:null});return s.pass.pixels().slice();};
 const pa=flat(A),pb=flat(B),W=s.pass.target.width,H=s.pass.target.height,scope=footprintOf(),last=s.pass.last;
 function footprintOf(){return V.footprint(s.pass.width,s.pass.height,A,o.zoom);}
 const toWorld=(x,y)=>({x:((x+.5)*s.pass.width/W-s.pass.width/2)/scope.scale+A.x,y:((H-1-y+.5)*s.pass.height/H-s.pass.height/2)/scope.scale+A.y});
 const isBand=(p,c)=>V.displayedSurface(s.model,p.x,p.y,c,o.eye,o.view)?.kind==='band';
 let changed=0;const outside=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(pa[i]===pb[i]&&pa[i+1]===pb[i+1]&&pa[i+2]===pb[i+2])continue;changed++;
  const p=toWorld(x,y),k=.5/scope.scale;if(![[0,0],[k,0],[-k,0],[0,k],[0,-k]].some(([dx,dy])=>{const q={x:p.x+dx,y:p.y+dy};return isBand(q,A)||isBand(q,B);}))outside.push({x,y,world:p});}
 // One exact band pick through the production pointer path.
 // Nearest eye-facing wall band whose displayed pixel and physical point are both in scope and seen.
 let pick=null;const eye=o.eye,candidates=[];
 for(const solid of s.model.solids){if(solid.cameraIgnored||!solid.bands.length||!/^solid:(wall|pillar):/.test(solid.id))continue;const w=V.bandWidth(solid,A);
  for(const b of solid.bands){if(V.facingAway(b,eye))continue;const L=Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y),u={x:(b.b.x-b.a.x)/L,y:(b.b.y-b.a.y)/L},t=Math.max(0,Math.min(L,(A.x-b.a.x)*u.x+(A.y-b.a.y)*u.y));
   const base={x:b.a.x+u.x*t,y:b.a.y+u.y*t},disp={x:base.x-b.normal.x*w*.5,y:base.y-b.normal.y*w*.5};candidates.push({solid,b,disp,distance:Math.hypot(disp.x-A.x,disp.y-A.y)});}}
 for(const {solid,b,disp}of candidates.sort((p,q)=>p.distance-q.distance)){
  if(!V.within(disp,scope))continue;const shown=V.displayedSurface(s.model,disp.x,disp.y,A,eye,o.view);if(shown?.kind!=='band'||shown.solid!==solid||!V.within(shown.point,scope)||!V.visible(s.model,eye,shown.point,solid.index))continue;
  const client={x:s.pass.width/2+(disp.x-A.x)*scope.scale,y:s.pass.height/2+(disp.y-A.y)*scope.scale},hit=s.pickAt(client.x,client.y);
  pick={solid:solid.id,normal:b.normal,expected:shown.point,hit:{kind:hit.kind,presentation:hit.presentation,primitiveId:hit.primitiveId,point:hit.point},plane:b.normal.x*hit.point.x+b.normal.y*hit.point.y-(b.normal.x*b.a.x+b.normal.y*b.a.y),zRange:[b.za[0],b.za[1]]};break;}
 s.render(true);const l=s.state.last;
 return {changed,outside:outside.slice(0,20),outsideCount:outside.length,pixels:W*H,pick,projection:{...l.projection,relativeScales:l.projection.relativeScales},camera:l.camera,id:__api.H.id,presentation:s.state.presentation,glError:s.pass.gl.getError()};
};
(async()=>{const s=await server(d);let browser,a,b;const rows=[];
const save=(status,error)=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status,rows,error:error&&String(error.stack||error)},null,2)+'\n');
try{
 browser=await launch();a=await open(browser,s,'HQ1 A',{viewport:{width:960,height:600}});await a.page.evaluate(()=>{__spatial.config.labels=false;});
 for(const v of views){
  const pose=v.support?{x:v.x,y:v.y,z:v.z,support:v.support}:support(v.x,v.y,v.z);await a.teleport(pose);
  await a.page.waitForFunction(p=>{const c=__spatial.state.last.camera;return Math.abs(c.x-p.x)<.2&&Math.abs(c.y-p.y)<.2&&Math.abs(c.z-p.z)<1e-6&&__spatial.view.snapshot().groups.every(g=>g.fade===(g.target?1:0));},pose,{timeout:60000});
  const r=await a.page.evaluate(probe);const self='p'+r.id;
  assert.equal(r.projection.mode,'top-down');assert.equal(r.projection.elevation,0);assert.equal(r.projection.enabled,false);
  assert.equal(r.camera.topDown,true);assert.equal(r.camera.depth,false);assert.equal(r.camera.elevation,0);assert(Number.isFinite(r.camera.anchorZ));
  assert.equal(r.projection.relativeScales[self],1,'local player exactly 1.0');assert(Math.abs(r.camera.anchorZ-pose.z)<1e-6,'anchor is the local presented Z');
  assert(r.changed>0,v.name+': camera Z changes the local band cue');assert.equal(r.outsideCount,0,v.name+': pixels changed outside wall bands '+JSON.stringify(r.outside));
  if(r.pick){assert.equal(r.pick.hit.kind,'face',v.name+' band pick '+JSON.stringify(r.pick));assert.equal(r.pick.hit.presentation,'band');assert.equal(r.pick.hit.primitiveId,r.pick.solid);assert(Math.abs(r.pick.plane)<1e-6);
   for(const k of ['x','y','z'])assert(Math.abs(r.pick.hit.point[k]-r.pick.expected[k])<1e-6);assert(r.pick.hit.point.z>=r.pick.zRange[0]-1e-6&&r.pick.hit.point.z<=r.pick.zRange[1]+1e-6);}
  assert.equal(r.glError,0);
  await a.page.screenshot({path:path.join(out,v.name+'.png')});
  rows.push({name:v.name,pose,changedPixels:r.changed,pixels:r.pixels,pixelsOutsideBands:r.outsideCount,bandPick:r.pick,camera:r.camera,bands:r.projection.bands,localScale:r.projection.relativeScales[self]});save('IN_PROGRESS');
 }
 // Two real clients, one shared simulation: each anchors relative scale to itself.
 b=await open(browser,s,'HQ1 B',{viewport:{width:960,height:600}});
 const high=support(5616,1248,96),low=support(5616,1512,0);await a.teleport(high);await b.teleport(low);
 const ids={a:await a.page.evaluate(()=>__api.H.id),b:await b.page.evaluate(()=>__api.H.id)};
 const ready=async(c,other)=>c.page.waitForFunction(o=>{const s=__spatial.state,l=s.last;return l&&Math.abs(l.camera.z-__api.H.z)<1e-6&&l.projection.relativeScales['p'+o]!==undefined&&l.projection.relativeScales['p'+__api.H.id]===1;},other,{timeout:60000});
 await ready(a,ids.b);await ready(b,ids.a);
 const scales=async c=>c.page.evaluate(()=>{__spatial.render(true);const l=__spatial.state.last;return {self:__api.H.id,z:__api.H.z,anchorZ:l.camera.anchorZ,scales:l.projection.relativeScales};});
 const onA=await scales(a),onB=await scales(b);
 assert.equal(onA.scales['p'+ids.a],1);assert.equal(onB.scales['p'+ids.b],1);
 assert(onA.scales['p'+ids.b]<1&&onA.scales['p'+ids.b]>=.94,'lower peer subtly smaller on the high client');assert(onB.scales['p'+ids.a]>1&&onB.scales['p'+ids.a]<=1.06,'higher peer subtly larger on the low client');
 await a.page.screenshot({path:path.join(out,'two-client-high.png')});await b.page.screenshot({path:path.join(out,'two-client-low.png')});
 rows.push({name:'two clients anchor relative scale to their own player',high:{pose:high,...onA,peerScale:onA.scales['p'+ids.b]},low:{pose:low,...onB,peerScale:onB.scales['p'+ids.a]}});
 a.validate();b.validate();save('PASS');console.log('PASS HQ1 browser: strict top-down production camera, camera-Z changes only local wall bands, band picks hit physical faces, per-client 1.0 anchor');
}catch(e){save('FAIL',e);for(const c of [a,b])if(c)await c.page.screenshot({path:path.join(out,'failure-'+(c===a?'a':'b')+'.png')}).catch(()=>{});throw e;}
finally{await browser?.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
