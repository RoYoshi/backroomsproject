'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),V=require('../../world_view'),G=require('../../world_geometry'),d=require('../../levels/level0_spatial.json');
const out=path.resolve(process.argv[2]),rows=[];fs.mkdirSync(path.dirname(out),{recursive:true});
const save=(status,error)=>fs.writeFileSync(out,JSON.stringify({status,rows,error:error&&{message:String(error),stack:error.stack}},null,2)+'\n');
function test(name,fn){const detail=fn();rows.push({name,...detail});save('IN_PROGRESS');}
try{
test('camera step response is the same analytical trajectory at 30/60/120/144/240 Hz and jitter',()=>{
 const samples=[];for(const hz of [30,60,120,144,240,'jitter']){const s=new V.CameraElevation();s.update(0,0,'a');let t=0,n=0;
  while(t<1-1e-10){const dt=Math.min(1-t,hz==='jitter'?[.004,.012,.021,.008,.032][n++%5]:1/hz);s.update(12,dt,'a');t+=dt;}
  const expected=12*(1-(1+24)*Math.exp(-24));assert(Math.abs(s.z-expected)<1e-10);samples.push({hz,z:s.z,expected});
  s.update(1000,1/240,'a');assert(Math.abs(s.z-1000)<=28);s.update(-96,1/60,'new-life');assert.equal(s.z,-96);s.update(180,.8,'new-life');assert.equal(s.z,180);
 }return {samples};
});
test('projection inverse, monotonic depth and narrow bounds at extreme elevations',()=>{
 let cases=0,maxError=0;for(const cz of [-96,0,180])for(const z of [-1e6,-700,-230,-96,0,90,180,204,360,700,1e6])for(const scale of [.85,1.25,3.2]){
  const camera={x:200,y:300,z:cz,depth:true},p={x:631,y:211,z},q=V.project(p,camera,scale),back=V.onPlane(q,z,camera,scale);
  maxError=Math.max(maxError,Math.hypot(back.x-p.x,back.y-p.y));assert(maxError<1e-8);assert(V.layerScale(z,camera)>=.94-1e-12&&V.layerScale(z,camera)<=1.06+1e-12);
  let last=.94;for(let dz=-800;dz<=800;dz++){const s=V.layerScale(cz+dz,camera);assert(s>=last-1e-12);last=s;}cases++;
 }
 assert(Math.abs(V.layerScale(0,{z:180,depth:true})-1/1.05)<1e-12);return {cases,maxError,at180Below:1/1.05};
});
test('piecewise camera rays invert the same screen point throughout each segment',()=>{
 let error=0,cases=0;for(const screen of [{x:400,y:200},{x:-500,y:-250},{x:0,y:0}]){const camera={x:6192,y:864,z:90,depth:true},ray=V.pickingRay(screen,camera,1.25);
  assert.equal(ray.segments.length,3);for(const r of ray.segments)for(const t of [0,.17,.5,.79,1]){const p=Object.fromEntries(['x','y','z'].map(k=>[k,r.from[k]+(r.to[k]-r.from[k])*t])),q=V.project(p,camera,1.25);error=Math.max(error,Math.hypot(q.x-screen.x,q.y-screen.y));cases++;}
 }assert(error<1e-8);return {cases,maxError:error};
});
test('clamp-crossing triangles preserve physical interpolation and mesh continuity',()=>{
 const camera={x:0,y:0,z:0,depth:true},vertices=new Float32Array([0,0,-500,0,0,1,0,0, 100,0,500,0,0,1,1,0, 0,100,500,0,0,1,0,1]),mesh=V.clipDepthTriangles(vertices,camera),cuts=V.depthBreaks(camera);
 assert(mesh.length>vertices.length);let area=0;for(let i=0;i<mesh.length;i+=24){const a=Array.from(mesh.slice(i,i+3)),b=Array.from(mesh.slice(i+8,i+11)),c=Array.from(mesh.slice(i+16,i+19)),zs=[a[2],b[2],c[2]];
  for(const z of cuts)assert(!(Math.min(...zs)<z-.00005&&Math.max(...zs)>z+.00005));area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
 }assert(Math.abs(area-5000)<.01);return {triangles:mesh.length/24,area,cuts};
});
test('canonical admission and picking remain independent of aspect, DPR, quality and UI scale',()=>{
 const g=G.compile(d),model=V.compile(d),physical=JSON.stringify(g.definition),records=[];
 const lower={id:'lower',kind:'hound',x:6120,y:864,z:0,height:36,radius:21,observable:true},upper={...lower,id:'upper',y:954,z:180};
 for(const [width,height]of [[960,600],[1280,720],[1280,800],[3440,1440],[3840,2160]])for(const zoom of [1,2,4])for(const cameraZ of [-20,0,20]){
  const camera={x:6192,y:864,z:cameraZ,depth:true},eye={x:6192,y:864,z:50},view=new V.LocalView(model),scope=V.footprint(width,height,camera,zoom);view.update({...eye,z:0},.25);
  const legacy=V.footprint(width,height,{...camera,depth:false},zoom);assert.deepEqual(scope,legacy);
  for(const dpr of [1,2])for(const quality of [1,.5])for(const uiScale of [.75,1.5])assert.deepEqual(V.footprint(width,height,{...camera,dpr,quality,uiScale},zoom),scope);
  const screen=V.project({...lower,z:18},camera,scope.scale),hit=V.pick(model,{screen,camera,eye,width,height,zoom,view,actors:[upper,lower]});assert.equal(hit.actorId,'lower');
  assert(!V.visible(model,eye,{...upper,z:198}));const reverse=V.pick(model,{screen,camera,eye,width,height,zoom,view,actors:[lower,upper]});assert.equal(hit.actorId,reverse.actorId);
  const outside={...lower,id:'outside',x:scope.maxX+1};const outHit=V.pick(model,{screen:V.project({...outside,z:18},camera,scope.scale),camera,eye,width,height,zoom,view,actors:[outside]});assert.notEqual(outHit.actorId,'outside');
  view.update({...eye,z:0},.25,{enabled:false});assert.notEqual(V.pick(model,{screen,camera,eye,width,height,zoom,view,actors:[lower]}).actorId,'lower');
  records.push({width,height,zoom,cameraZ,scope,picked:hit.actorId});
 }assert.equal(JSON.stringify(g.definition),physical);return {configurations:records.length,records,physicalUnchanged:true};
});
save('PASS');console.log('PASS foundation: '+rows.length+' gates');
}catch(e){save('FAIL',e);throw e;}
