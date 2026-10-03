'use strict';
const assert=require('node:assert/strict'),{internalAI,player}=require('./test_helpers'),{fixture,adapter,canonical,clone}=require('./fixture'),M=require('../../world_motion'),AI=internalAI();
function actor(eng,kind='hound',extra={}){const e=eng.spawn(kind,168,168);Object.assign(e,{z:0,shape:M.ENTITY_PROFILES[kind],ang:0,...extra});return e;}
function run(){
 const results=[],details={};const test=(name,fn)=>{fn();results.push(name);console.log('PASS '+name);};
 const eng=AI.create({adapter:adapter(),seed:408}),e=actor(eng),geo=eng.geo;
 test('XYZ sight: same floor visible, same XY across sealed slab invisible',()=>{assert(geo.visibleBody(e,player()).visible);assert(!geo.visibleBody(e,player({x:168,z:180})).visible);assert(!geo.visibleBody({...e,z:180},player({x:168})).visible);});
 test('XYZ sight: wall blocks and real stair opening admits light',()=>{assert(!geo.visibleBody({...e,x:1060,y:440},player({x:1150,y:440})).visible);assert(geo.clearRay({x:368,y:90,z:28},{x:368,y:150,z:225}));});
 test('visual evidence derives support geometrically and velocity from observations',()=>{
  const p=player();for(const k of ['vx','vy','vz','supportId','route','destination'])Object.defineProperty(p,k,{get(){throw Error('forbidden visual read '+k);}});
  eng.now=.1;AI.updateVision(e,eng,.1,[p]);const r=e.mem.p.get(1);assert(r?.seen);assert.equal(r.lvx,0);assert.equal(r.lkz,0);assert(r.spatial.supportCandidates.includes('nav:ground'));
  p.x+=3;eng.now=.2;AI.updateVision(e,eng,.1,[p]);assert.equal(r.lvx,30);assert.equal(r.visual.vz,0);
 });
 test('occluded true Z, support, velocity and route cannot refresh visual memory',()=>{
  const r=e.mem.p.get(1),before=JSON.stringify({v:r.visual,s:r.spatial,lkz:r.lkz,lkx:r.lkx});eng.now=.3;AI.updateVision(e,eng,.1,[player({z:180,supportId:'SECRET',vx:999,route:['SECRET']})]);assert(!r.seen);assert.equal(JSON.stringify({v:r.visual,s:r.spatial,lkz:r.lkz,lkx:r.lkx}),before);
 });
 test('eye contact uses remembered visible facing plus physical XYZ occlusion',()=>{
  const p=player({x:268,pitch:Math.atan2(28-50,100)});eng.now=.4;eng.setPlayers([p]);AI.updateVision(e,eng,.1,[p]);assert(AI.facedBy(eng,e,p,e.mem.p.get(1)));const upper={...p,z:180};eng.setPlayers([upper]);AI.updateVision(e,eng,.1,[upper]);assert.equal(AI.facedBy(eng,e,upper,e.mem.p.get(1)),null);
 });
 test('physical contact positive and cross-floor capture rejection',()=>{
  const p=player({x:185});assert(geo.physicalContact(e,p,38));const upper={...p,x:168,z:180};eng.setPlayers([upper]);assert(!AI.touching(eng,e,1,500));const rng=e.rng;let calls=0;e.rng=()=>{calls++;return rng();};assert.equal(AI.beginCapture(eng,e,upper,{}),null);assert.equal(calls,0);assert(!e.cap&&!upper.caught);
 });
 test('static light cannot leak through floor or depend on camera/view',()=>{const a=geo.lightAt(e,null),b=geo.lightAt({...e,z:180},null);assert(a>b+.1);geo.a.camera={cutaway:true,z:999};assert.equal(geo.lightAt(e,null),a);assert.equal(geo.lightLevel(e.x,e.y,null),.04);});
 test('visible emitters illuminate physically, camcorder/IR does not',()=>{
  const p=player({x:260,light:true,angle:Math.PI});const d=fixture();d.lights=[];const g=new AI.Geo(adapter(d)),base=g.lightAt(e,[]);assert(g.lightAt(e,[p])>base);assert.equal(g.lightAt({...e,z:180},[p]),base);assert.equal(g.lightAt(e,[{...p,kind:'camcorder',ir:1,irPower:100}]),base);
 });
 test('beam observations blocked by floors; IR has no beams or anonymous leads',()=>{
  const en=AI.create({adapter:adapter(),seed:12}),h=actor(en);en.setPlayers([player({light:true,kind:'camcorder',ir:1})]);assert.deepEqual(AI.beamsOf(en),[]);AI.lightSense(en,h);assert.equal(h.mem.leads.length,0);
  en.now=1;en.setPlayers([player({z:180,light:true})]);const beams=AI.beamsOf(en);assert(beams.length);assert(beams.every(b=>AI.observeBeam(en,h,b)===null));
 });
 test('source/patch evidence contains no hidden owner or source support',()=>{
  const en=AI.create({adapter:adapter(),seed:15}),h=actor(en);en.setPlayers([player({x:260,light:true,supportId:'SECRET',route:['SECRET']})]);const o=AI.observeBeam(en,h,AI.beamsOf(en)[0]);assert(o?.src);const L=AI.inferLead(h,o,en.geo);assert(!JSON.stringify({o,L}).includes('SECRET'));assert.equal(L.z,undefined);assert(L.zMin<L.zMax);assert.deepEqual(L.supportCandidates,[]);
 });
 test('acoustic attenuation and bounded portal search use actual geometry',()=>{
  const same=geo.geometry.propagateSound({x:210,y:168,z:1},geo.eye(e)),sealed=geo.geometry.propagateSound({x:210,y:168,z:181},geo.eye(e));assert(same.audible&&sealed.audible);assert(same.transmission*Math.exp(-same.distance/256)>sealed.transmission*Math.exp(-sealed.distance/256));assert(sealed.distance>same.distance&&!sealed.clear);const d=fixture();for(const portal of d.portals)portal.channels.acousticTransmission=0;const solidOnly=new AI.Geo(adapter(d)).geometry.propagateSound({x:210,y:168,z:181},geo.eye(e));assert(solidOnly.transmission<same.transmission);assert(sealed.stats.nodes<=130&&sealed.stats.portals<=128);details.acoustic={same,sealed};
 });
 test('above/below acoustic ambiguity carries interval, bounded alternatives, no exact Z',()=>{
  for(const z of [-95,181]){const q=geo.geometry.propagateSound({x:168,y:168,z},geo.eye(e));assert(q.audible);assert(q.observation.zMin<=0&&q.observation.zMax>=180);assert(q.observation.supportCandidates.length<=4);for(const k of ['z','supportId','floor','route','velocity','destination','src'])assert(!(k in q.observation));}
 });
 test('actual hearing retains uncertainty and does not attribute raw source ID',()=>{
  const en=AI.create({adapter:adapter(),seed:44}),h=actor(en),p=player({x:168,z:180});en.setPlayers([p]);const q=AI.hearEvent(h,en,{x:p.x,y:p.y,z:p.z,r:5000,I:2,type:'impact',src:p.id,st:99,vx:900,vy:-900,supportId:'SECRET'});assert(q);assert.equal(q.pid,null);assert.equal(h.mem.p.size,0);assert(h.mem.leads[0].zMin<=0&&h.mem.leads[0].zMax>=180);assert(!JSON.stringify(q).includes('SECRET'));assert.equal(q.z,undefined);
 });
 test('sound without an explicit spatial pose fails closed',()=>{const en=AI.create({adapter:adapter(),seed:1}),h=actor(en);assert.equal(AI.hearEvent(h,en,{x:168,y:168,r:999,I:1,type:'run',src:1}),undefined);assert.equal(h.mem.sounds.length,0);});
 test('evidence fusion never merges disjoint observed elevations',()=>{const en=AI.create({adapter:adapter(),seed:1}),h=actor(en);for(const z of [0,180])AI.addLead(h,0,{k:'sound',x:168,y:168,u:100,c:.5,sal:.5,zMin:z,zMax:z,supportCandidates:[z?'nav:upper':'nav:ground']});assert.equal(h.mem.leads.length,2);assert(AI.evidenceCandidates(h,0).every(q=>Number.isFinite(q.zMin)));});
 test('sound budgets and memory counts stay bounded over repeated events',()=>{const en=AI.create({adapter:adapter(),seed:18}),h=actor(en);for(let i=0;i<100;i++){en.now=i*.1;AI.hearEvent(h,en,{x:260,y:168,z:i%2?180:0,r:5000,I:2,type:'impact',src:42});}assert(h.mem.sounds.length<=8&&h.mem.leads.length<=6);assert.equal(h.mem.p.size,0);details.budgets=en.geo.sensorStats;});
 return {status:'PASS',runtime:process.version,groups:results.length,results,details,stageFStarted:false};
}
if(require.main===module)console.log(JSON.stringify(run(),null,2));module.exports={run,actor};
