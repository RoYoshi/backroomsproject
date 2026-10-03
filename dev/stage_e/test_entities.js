'use strict';
const assert=require('node:assert/strict'),AI=require('../../ai'),M=require('../../world_motion'),{fixture,adapter,canonical}=require('./fixture'),{navWorld}=require('./test_motion'),{box}=require('../stage_c/helpers'),{player}=require('./test_helpers');
const DT=1/60;
function step(en,n=1){for(let i=0;i<n;i++)en.step(DT);}
function pursuit(kind,route,interrupt=false){
 const en=AI.create({adapter:adapter(),seed:13}),a=route==='stairs'?{x:368,y:70,z:0}:route==='ramp'?{x:590,y:148,z:0}:{x:880,y:615,z:120};
 const start=route==='stairs'?{x:368,y:270,z:72}:route==='ramp'?{x:750,y:148,z:57.5}:{x:880,y:740,z:120};
 const waypoints=route==='stairs'?[{x:368,y:619},{x:280,y:575},{x:168,y:490}]:route==='ramp'?[{x:1100,y:148}]:[{x:880,y:870}];
 const motion=M.create(en.geo.geometry),body=motion.initialize({...start},'stand'),e=en.spawn(kind,a.x,a.y,{z:a.z}),p=player({...start,angle:0,light:true,st:1});e.ang=route==='ramp'?0:Math.PI/2;
 let stage=0,maxDelta=0,airTicks=0,replans=0,cut=null;const states=new Set(),supports=new Set(),records=[];
 for(let i=0;i<1500;i++){
  if(stage<waypoints.length-1&&Math.hypot(body.x-waypoints[stage].x,body.y-waypoints[stage].y)<3)stage++;
  const target=waypoints[stage],dx=target.x-body.x,dy=target.y-body.y,d=Math.hypot(dx,dy),v=route==='stairs'?(stage?180:118):98;
  body.vx=d?dx/d*Math.min(v,d/DT):0;body.vy=d?dy/d*Math.min(v,d/DT):0;motion.step(body);
  Object.assign(p,{x:body.x,y:body.y,z:body.z,vx:body.vx,vy:body.vy,sp:d>3?v:0,st:d>3?1:0});en.setPlayers([p]);const before={x:e.x,y:e.y,z:e.z};
  // Interrupt by changing a capability while a physical traversal is in flight.
  // The actor must complete/resolve its current physical motion; no pose reset.
  if(interrupt&&!cut&&e.trav&&e.z>50){e.caps.CAN_VAULT=false;cut={tick:i,z:e.z,link:e.trav.link.id};}
  en.step(DT);maxDelta=Math.max(maxDelta,Math.hypot(e.x-before.x,e.y-before.y,e.z-before.z));airTicks+=e.motionMode==='airborne';states.add(e.state);supports.add(e.supportId);
  assert(en.geo.geometry.clearance(e.shape,e).fits,route+' actor penetration');assert(!e.diagnostics.length,JSON.stringify(e.diagnostics));assert.equal(e.tick,en.ticks,'exactly one physical tick per engine tick');
  if(i%60===0)records.push({tick:i,state:e.state,pose:[e.x,e.y,e.z],surface:e.navSurfaceId,link:e.trav?.link.id||null,target:e.target});
  if(e.linkHistory.some(q=>q.event==='done')&&(route!=='stairs'||e.supportId==='support:upper-south'||e.navSurfaceId==='nav:upper'))break;
  if(!p.alive)break;
 }
 assert(states.has(kind==='hound'?AI.S.HUNTING:AI.S.PROVOKED)||kind==='smiler'&&(states.has(AI.S.ATTACKING)||states.has(AI.S.FOLLOWING)),'real species committed pursuit '+JSON.stringify({kind,route,states:[...states],records,links:e.linkHistory}));
 assert(e.linkHistory.some(q=>q.id.includes(route==='stairs'?'stairs-up':route==='ramp'?'ramp-up':'ledge-drop')&&q.event==='done'),JSON.stringify({kind,route,pose:[e.x,e.y,e.z],links:e.linkHistory,p:[p.x,p.y,p.z],alive:p.alive,records}));
 assert(maxDelta<(route==='drop'?12:10),'bounded physical displacement: '+maxDelta);if(route==='drop')assert(airTicks>0);if(interrupt)assert(cut);
 return {kind,route,states:[...states],maxDelta,airTicks,supports:[...supports],links:e.linkHistory,cut,records,nav:e.nav,stats:en.geo.navStats};
}
function hiddenWorld(){return navWorld([box('floor',0,0,1200,900,-16,0),box('upper',0,0,1200,900,168,180),box('divider',400,0,24,900,0,350,true)],p=>p.id==='support:upper'?'nav:upper':'nav:ground');}
function counted(e){const counts={};for(const k of Object.keys(e.streams)){const f=e.streams[k];counts[k]=0;e.streams[k]=()=>{counts[k]++;return f();};}e.rng=e.streams.behavior;return counts;}
function trace(e,counts){return JSON.parse(JSON.stringify({state:e.state,act:e.act,target:e.target,pose:[e.x,e.y,e.z],support:e.supportId,motion:e.motionMode,goal:e.goal,path:e.path,trav:e.trav,nav:e.nav,inv:e.inv,search:e.search,light:e.hLight,goalS:e.goalS,ag:e.ag,att:e.att?[...e.att]:null,mem:{players:[...e.mem.p],sounds:e.mem.sounds,leads:e.mem.leads,visited:[...e.mem.visited],habits:[...e.mem.habits],hypotheses:e.mem.hypotheses},streams:counts,mood:e.mood,lunge:e.lunge,pack:e.pack,thinkT:e.thinkT,tier:e.tier,evidence:e.evidence}));}
function hiddenPair(kind,ir=false){
 const d=hiddenWorld(),runs=[0,1].map(()=>{const en=AI.create({adapter:adapter(d),seed:97}),e=en.spawn(kind,120,240,{z:0});e.ang=0;const counts=counted(e),p=player({x:320,y:240,z:0,light:true,angle:0});en.setPlayers([p]);step(en,12);assert(e.mem.p.has(1),'legitimate common sight history');return {en,e,p,counts};});
 assert.deepEqual(trace(runs[0].e,runs[0].counts),trace(runs[1].e,runs[1].counts));
 let firstLegitimateDifference=null,compared=0;
 for(let tick=0;tick<900;tick++){
  for(let i=0;i<2;i++){const r=runs[i];Object.assign(r.p,{x:650+Math.sin(tick/90)*100,y:300+tick/20,z:ir?0:i?180:0,light:ir?!!i:false,kind:'camcorder',ir:i,st:0,sp:0,vx:i?731:-422,vy:i?-333:915,vz:i?66:-87,supportId:i?'support:upper':'support:floor',floor:i,route:i?['secret-upper']:['secret-lower'],destination:i?{x:900,y:600,z:180}:{x:1100,y:200,z:0}});r.en.setPlayers([r.p]);r.en.step(DT);}
  const [a,b]=runs.map(r=>trace(r.e,r.counts));
  try{assert.deepEqual(a,b);}catch(err){err.message='First divergent hidden-state tick '+tick+' ('+kind+(ir?' IR':' elevation')+'): '+err.message;throw err;}
  assert(!runs[0].e.mem.p.get(1)?.seen&&!runs[1].e.mem.p.get(1)?.seen||tick<6,'hidden wall sight unexpectedly returned');compared++;
 }
 const before=trace(runs[0].e,runs[0].counts);const r=runs[0];Object.assign(r.p,{x:r.e.x-60,y:r.e.y,z:r.e.z,kind:'flashlight',light:true,vx:0,vy:0,vz:0,sp:0,st:0});r.en.setPlayers([r.p]);for(let t=0;t<60;t++){r.en.step(DT);runs[1].en.step(DT);if(JSON.stringify(trace(r.e,r.counts))!==JSON.stringify(trace(runs[1].e,runs[1].counts))){firstLegitimateDifference=t;break;}}
 assert(firstLegitimateDifference!==null,'positive control: new real evidence changes decisions '+JSON.stringify({pose:[r.e.x,r.e.y,r.e.z],player:r.p,seen:[...r.e.seenNow],tier:r.e.tier,mem:[...r.e.mem.p]} ));return {kind,mode:ir?'IR off/on':'hidden upper/lower',identicalTicks:compared,seconds:compared*DT,firstDivergentHiddenTick:null,firstLegitimateDifference,counts:runs[1].counts,remainingBelief:runs[1].e.mem.p.get(1)?.spatial};
}
function run(){const results=[],details={},test=(name,fn)=>{fn();results.push(name);console.log('PASS '+name);};
 test('spatial spawns require explicit finite Z and physical support',()=>{const en=AI.create({adapter:adapter(),seed:1});assert.throws(()=>en.spawn('hound',168,168),/explicit Z/);assert.throws(()=>en.spawn('hound',168,168,{z:0,supportId:'support:upper-west'}),/support/);});
 for(const kind of ['hound','smiler'])test(kind+' same-surface perception drives actual species pursuit/contact',()=>{const en=AI.create({adapter:adapter(),seed:4}),e=en.spawn(kind,168,168,{z:0});e.ang=0;const p=player({x:290,angle:0,light:true});en.setPlayers([p]);const states=new Set();for(let i=0;i<600&&p.alive;i++){en.step(DT);states.add(e.state);assert(en.geo.geometry.clearance(e.shape,e).fits);}assert(e.mem.p.has(1));assert(e.x>200);assert(!p.alive||p.caught);assert.equal(e.z,.05);details[kind+'Flat']={states:[...states],captures:en.stats.capture};});
 for(const kind of ['hound','smiler'])for(const route of ['stairs','ramp','drop'])test(kind+' real brain executes physical '+route+' pursuit',()=>{details[kind+route]=pursuit(kind,route);});
 for(const kind of ['hound','smiler'])test(kind+' floor occlusion rejects sight/gaze/contact and false targeting',()=>{const en=AI.create({adapter:adapter(),seed:8}),e=en.spawn(kind,168,168,{z:0}),p=player({x:168,z:180,light:true});en.setPlayers([p]);step(en,300);assert.equal(e.mem.p.size,0);assert.equal(en.stats.capture,0);assert(p.alive&&!p.caught);assert(!e.target);});
 for(const kind of ['hound','smiler'])test(kind+' identical evidence/RNG despite hidden Z, floor, support, route, velocity and destination',()=>{details[kind+'Hidden']=hiddenPair(kind);});
 for(const kind of ['hound','smiler'])test(kind+' IR off/on leaves high-level decisions and RNG identical',()=>{details[kind+'IR']=hiddenPair(kind,true);});
 test('active traversal remains physical through capability change and route refresh',()=>{details.interruption=pursuit('hound','ramp',true);});
 test('airborne actor cannot sleep or teleport even with no players',()=>{const en=AI.create({adapter:adapter(),seed:3}),e=en.spawn('hound',880,800,{z:100});step(en,60);assert.equal(e.tier,'near');assert(e.z<-95&&e.z>-96);assert.equal(e.supportId,'support:lower-platform');assert.equal(e.tick,60);});
 test('sealed-floor hounds cannot form a pack by XY overlap',()=>{const en=AI.create({adapter:adapter(),seed:11}),a=en.spawn('hound',168,168,{z:0}),b=en.spawn('hound',168,168,{z:180});a.ang=b.ang=0;en.setPlayers([player({x:270,light:true}),player({id:2,x:270,z:180,light:true})]);step(en,60);assert.equal(a.pack,0);assert.equal(b.pack,0);assert(a.mem.p.has(1)&&!a.mem.p.has(2));assert(b.mem.p.has(2)&&!b.mem.p.has(1));});
 return {status:'PASS',runtime:process.version,groups:results.length,results,details,realSpecies:true,stageFStarted:false};}
if(require.main===module)console.log(JSON.stringify(run(),null,2));module.exports={run,pursuit,hiddenPair,hiddenWorld,trace,counted};
