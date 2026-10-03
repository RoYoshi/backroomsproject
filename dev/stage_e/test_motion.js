'use strict';
const assert=require('node:assert/strict'),AI=require('../../ai'),G=require('../../world_geometry'),M=require('../../world_motion');
const {fixture,adapter,canonical,clone}=require('./fixture'),{world,box}=require('../stage_c/helpers');
function navWorld(solids,surfaceFor=p=>'nav:'+p.id.slice(8)){
 const d=world(solids);d.assetId='world:stage-e-small';d.geometryRevision='stage-e-2';
 d.colliderProfiles.push({...M.ENTITY_PROFILES.hound,capabilities:['walk','crawl','vault']},{...M.ENTITY_PROFILES.smiler,capabilities:['walk','vault']});
 const ids=new Map();for(const p of d.supportPatches){p.navSurfaceId=surfaceFor(p);if(!ids.has(p.navSurfaceId))ids.set(p.navSurfaceId,[]);ids.get(p.navSurfaceId).push(p.id);}
 d.navSurfaces=[...ids].map(([id,patchIds])=>({id,patchIds,origin:{x:0,y:0},cellSize:48,boundaryLinkIds:[],chart:'connected support sheet',clearanceProfileIds:['profile:hound','profile:smiler']}));return canonical(d);
}
function link(id,kind,a,b,from,to,extra={}){return {id:'link:'+id,kind,fromSurfaceId:from,toSurfaceId:to,entry:[{...a,y:a.y-40},{...a,y:a.y+40}],exit:[{...b,y:b.y-40},{...b,y:b.y+40}],corridor:[a,b],corridorRadius:40,supportPatchIds:[],profileIds:['profile:hound','profile:smiler'],capabilityFlags:[kind],durationRule:'fixed physical ticks',progressRule:'physical pose',interruptionRule:'retain physical pose',landingRule:'actual support',costRule:'physical duration and distance',directed:true,clearanceRequired:true,...extra};}
function special(kind,blocked=false){
 const solids=[box('floor',0,0,700,400,-16,0)];if(kind==='vault')solids.push(box('low',250,0,20,400,0,20,true));else solids.push(box('crawl-roof',250,0,100,400,28,60,true));
 if(blocked)solids.push(box('ceiling',180,0,240,400,kind==='vault'?50:20,kind==='vault'?60:25,true));
 const d=navWorld(solids,()=> 'nav:floor'),a={x:200,y:200,z:0},b={x:400,y:200,z:0};
 d.traversalLinks.push(link(kind,kind,a,b,'nav:floor','nav:floor',kind==='vault'?{vaultTopZ:20}:{profileIds:['profile:hound']}));d.navSurfaces[0].boundaryLinkIds=['link:'+kind];return canonical(d);
}
function run(){
 const results=[],details=[],test=(name,fn)=>{fn();results.push(name);console.log('PASS '+name);};
 const d=fixture(),g=G.compile(d);
 for(const kind of ['hound','smiler'])for(const l of d.traversalLinks)test(kind+' physical '+l.id,()=>{
  const p=M.proveTraversal(g,l,M.ENTITY_PROFILES[kind],{record:true,vaultSpeed:AI.SPECIES[kind].caps.VAULT_SPEED});assert(p.ok,JSON.stringify(p));assert(p.ticks>1);assert(p.poses.every(p=>Number.isFinite(p.z)));
  if(l.kind==='stairs'&&l.id.endsWith('up')){assert(p.supportHistory.includes('support:tread-15'));assert.equal(p.supportId,'support:upper-south');assert(p.maxDelta<=3.01);}
  if(l.kind==='drop')assert(p.poses.some(p=>p.motionMode==='airborne'));
  details.push({kind,link:l.id,...p,poses:undefined});
 });
 test('top tread / landing overlap accepts contextual support without relocation',()=>{
  const m=M.create(g),b=m.initialize({x:368,y:620,z:180},'walk',M.ENTITY_PROFILES.hound);assert.equal(b.supportId,'support:tread-15');
  const pose=[b.x,b.y,b.z],l=d.traversalLinks.find(l=>l.id==='link:stairs-down');assert(m.beginTraversal(b,l));assert.deepEqual([b.x,b.y,b.z],pose);assert.equal(b.supportId,'support:upper-south');
  assert(!g.continuousSupport('support:ground-north','support:upper-west',{x:160,y:160,z:0},b.shape));
 });
 test('A* stacked route is physically traversable waypoint by waypoint',()=>{
  const geo=new AI.Geo(adapter()),m=M.create(geo.geometry),b=m.initialize({x:168,y:168,z:0},'walk',M.ENTITY_PROFILES.hound);
  const path=geo.pathPose({...b},{x:168,y:168,z:180,supportId:'support:upper-west'},AI.HOUND.caps);assert(path?.length);
  for(const wp of path){let t=wp.link?m.beginTraversal(b,wp.link):null;if(wp.link)assert(t,'entry portal reached');let arrived=false;
   for(let tick=0;tick<1000;tick++){const target=t?t.finish:wp,dx=target.x-b.x,dy=target.y-b.y,distance=Math.hypot(dx,dy),v=Math.min(100,distance*60);if(!t&&distance<.001){arrived=true;break;}
    const intent={x:distance?dx/distance*v:0,y:distance?dy/distance*v:0};if(t){if(m.advanceTraversal(b,t,intent)==='done'){arrived=true;break;}}else{b.vx=intent.x;b.vy=intent.y;m.step(b);}
    assert(geo.geometry.clearance(b.shape,b).fits);
   }assert(arrived,JSON.stringify({wp,b}));
  }assert(Math.abs(b.z-180)<.1);assert.equal(geo.geometry.supportPatch(b.supportId).navSurfaceId,'nav:upper');
 });
 test('interrupted staircase retains actual pose and resolves gravity',()=>{
  const m=M.create(g),b=m.initialize({x:368,y:90,z:0},'walk',M.ENTITY_PROFILES.hound),l=d.traversalLinks.find(l=>l.id==='link:stairs-up'),t=m.beginTraversal(b,l);
  for(let i=0;i<140;i++)m.advanceTraversal(b,t,{x:0,y:100});const before={...b};t.status='interrupted';b.vx=100;b.vy=0;m.step(b);assert(Math.hypot(b.x-before.x,b.y-before.y,b.z-before.z)<5);assert(b.z<180);assert(g.clearance(b.shape,b).fits);
 });
 test('supported traces cannot smooth through slabs, steps or a subpixel gap',()=>{
  const shape=M.ENTITY_PROFILES.hound,a={x:168,y:168,z:0,supportId:'support:ground-north'},b={x:168,y:168,z:180,supportId:'support:upper-west'};assert(!g.traceSupportMotion(a,[b],shape).ok);
  const small=navWorld([box('a',0,0,200,200,-10,0),box('b',200.01,0,200,200,-10,0)],()=> 'nav:floor'),q=G.compile(small);
  assert(!q.traceSupportMotion({x:180,y:100,z:0,supportId:'support:a'},[{x:220,y:100,z:0,supportId:'support:b'}],shape).ok);
 });
 test('continuous sheets get physical bidirectional walk seams, never cross-floor seams',()=>{
  const geo=new AI.Geo(adapter(navWorld([box('a',0,0,240,240,-10,0),box('b',240,0,240,240,-10,0),box('upper',0,0,240,240,168,180)])));
  const a={x:168,y:120,z:0,supportId:'support:a'},b={x:312,y:120,z:0,supportId:'support:b'};assert(geo.pathPose(a,b,AI.HOUND.caps)?.some(p=>p.link?.kind==='walk-seam'));assert(geo.pathPose(b,a,AI.HOUND.caps));
  assert.equal(geo.pathPose(a,{...a,z:180,supportId:'support:upper'},AI.HOUND.caps),null);
 });
 test('vaults use actual swept raise/cross/settle; capability and roof reject',()=>{
  for(const kind of ['hound','smiler']){const d=special('vault'),geo=new AI.Geo(adapter(d)),p=M.proveTraversal(geo.geometry,d.traversalLinks[0],M.ENTITY_PROFILES[kind],{vaultSpeed:AI.SPECIES[kind].caps.VAULT_SPEED,record:true});assert(p.ok,JSON.stringify(p));assert(p.poses.some(p=>p.z>20));}
  const blocked=special('vault',true);assert(!M.proveTraversal(G.compile(blocked),blocked.traversalLinks[0],M.ENTITY_PROFILES.hound).ok);
  const d=special('vault'),geo=new AI.Geo(adapter(d));assert.equal(geo.pathPose({x:168,y:200,z:0,supportId:'support:floor'},{x:456,y:200,z:0,supportId:'support:floor'},{...AI.HOUND.caps,CAN_VAULT:false}),null);
 });
 test('crawl route preserves Hound capability and excludes Smiler',()=>{
  const d=special('crawl'),geo=new AI.Geo(adapter(d)),l=d.traversalLinks[0];assert(M.proveTraversal(geo.geometry,l,{...M.ENTITY_PROFILES.hound,height:24,eyeHeight:18}).ok);
  const a={x:168,y:200,z:0,supportId:'support:floor'},b={x:456,y:200,z:0,supportId:'support:floor'};assert(geo.pathPose(a,b,AI.HOUND.caps));assert.equal(geo.pathPose(a,b,AI.SMILER.caps),null);
 });
 test('pure Z translation retains link outcome and support sequence',()=>{
  const a=fixture(),b=clone(a),dz=53;
  for(const s of b.solids){s.lower.c+=dz;s.upper.c+=dz;}for(const p of b.supportPatches)p.plane.c+=dz;
  for(const l of b.traversalLinks)for(const k of ['entry','exit','corridor'])for(const p of l[k])p.z+=dz;
  for(const s of b.spaces){s.bounds.min.z+=dz;s.bounds.max.z+=dz;}for(const p of b.portals)for(const q of p.polygon)q.z+=dz;
  for(const l of b.lights)l.position.z+=dz;for(const a of b.anchors)a.position.z+=dz;b.bounds.min.z+=dz;b.bounds.max.z+=dz;
  const ga=G.compile(a),gb=G.compile(b),pa=M.proveTraversal(ga,a.traversalLinks.find(l=>l.kind==='stairs'),M.ENTITY_PROFILES.hound),pb=M.proveTraversal(gb,b.traversalLinks.find(l=>l.kind==='stairs'),M.ENTITY_PROFILES.hound);
  assert(pa.ok&&pb.ok);assert.deepEqual(pa.supportHistory,pb.supportHistory);assert(Math.abs(pb.finalPose.z-pa.finalPose.z-dz)<1e-6);assert.equal(pa.ticks,pb.ticks);
 });
 return {status:'PASS',runtime:process.version,groups:results.length,results,physicalLinks:details};
}
if(require.main===module)console.log(JSON.stringify(run(),null,2));module.exports={run,navWorld,link,special};
