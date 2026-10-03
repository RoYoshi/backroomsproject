'use strict';
const assert=require('node:assert/strict'),AI=require('../../ai'),{fixture,adapter,canonical,clone}=require('./fixture');
const caps=AI.HOUND.caps,smiler=AI.SMILER.caps;
function run(){
 const geo=new AI.Geo(adapter()),results=[];
 const test=(name,fn)=>{fn();results.push(name);console.log('PASS '+name);};
 const lower={x:168,y:168,z:0,supportId:'support:ground-north'},upper={x:168,y:168,z:180,supportId:'support:upper-west'};
 test('same XY produces distinct composite nodes on stacked sheets',()=>{
  const a=geo.snapPose(lower,caps),b=geo.snapPose(upper,caps);assert(a>=0&&b>=0&&a!==b);assert.equal(geo.nodes[a].surfaceId,'nav:ground');assert.equal(geo.nodes[b].surfaceId,'nav:upper');
  assert.equal(new Set(geo.nodes.map(n=>n.id)).size,geo.N);assert(geo.gs instanceof Float32Array);assert(geo.N<1500);
 });
 test('spatial endpoints require full pose and cannot snap through slab',()=>{
  assert.equal(geo.snap(168,168,caps),-1);assert.equal(geo.snapPose({...lower,supportId:upper.supportId},caps),-1);
  assert.equal(geo.snapPose({...lower,supportId:null},caps),-1);assert.equal(geo.path(168,168,168,168,caps),null);
 });
 test('same A* searches local sheet cells and produces spatial waypoints',()=>{
  const p=geo.pathPose(lower,{...lower,x:264,y:216},caps);assert(p?.length);assert(p.every(n=>n.navSurfaceId==='nav:ground'&&n.z===0&&n.supportId));
 });
 test('one A* crosses stacked-floor links and rejects reverse drop',()=>{
  const p=geo.pathPose(lower,upper,caps);assert(p?.some(n=>n.link?.id==='link:stairs-up'));
  const a={x:888,y:648,z:120,supportId:'support:balcony'},b={x:888,y:840,z:-96,supportId:'support:lower-platform'};
  assert(geo.pathPose(a,b,caps)?.some(n=>n.link?.kind==='drop'));assert.equal(geo.pathPose(b,a,caps),null);
 });
 test('directed links have portal width, corridor and explicit species gates',()=>{
  const all=geo.edges.flat().filter(e=>e.link);assert.equal(all.length,4);
  for(const {link}of all){assert(link.entry.length>=2&&link.exit.length>=2);assert(link.corridorRadius>=21);assert(link.profileIds.includes('profile:hound'));}
  const drop=all.find(e=>e.link.kind==='drop');assert.equal(drop.link.fromSurfaceId,'nav:balcony');assert.equal(drop.link.toSurfaceId,'nav:lower');
  assert(!all.some(e=>e.link.fromSurfaceId==='nav:lower'&&e.link.toSurfaceId==='nav:balcony'));
 });
 test('real low roof fits Hound crawl but cannot grant Smiler crawl',()=>{
  const n=geo.nodes.findIndex(n=>n.x===168&&n.y===744&&n.surfaceId==='nav:ground');assert(n>=0);assert(geo.passableFor(n,caps));assert(!geo.passableFor(n,smiler));assert(!geo.passableFor(n,{...caps,CAN_CRAWL:false}));
 });
 test('cache identity distinguishes surfaces, capabilities and world topology',()=>{
  assert.notEqual(geo.routeKey(lower,lower,caps),geo.routeKey(lower,upper,caps));assert.notEqual(geo.routeKey(lower,upper,caps),geo.routeKey(lower,upper,smiler));
  assert.notEqual(geo.routeKey(lower,upper,caps),geo.routeKey(lower,upper,{...caps,CAN_VAULT:false}));
 });
 test('canonical reconstruction after input permutation preserves IDs and edges',()=>{
  const d=fixture();for(const k of ['navSurfaces','traversalLinks','supportPatches','solids'])d[k].reverse();
  const b=new AI.Geo(adapter(canonical(d)));assert.deepEqual(geo.nodes,b.nodes);assert.deepEqual(geo.edges,b.edges);
 });
 return {status:'PASS',runtime:process.version,groups:results.length,results,nodes:geo.N,edges:geo.edges.reduce((n,e)=>n+e.length,0),stats:geo.navStats,stageFStarted:false};
}
if(require.main===module)console.log(JSON.stringify(run(),null,2));
module.exports={run};
