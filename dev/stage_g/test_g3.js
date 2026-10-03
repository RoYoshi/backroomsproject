'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),P=require('../../spatial_protocol'),createSim=require('../../sim'),{field}=require('../stage_f/fixture'),{DP,M,valid}=require('./fixtures');
function setup(){const sim=createSim({world:field(),seed:992,director:false,worldEpoch:()=> 'g3:epoch'}),p=sim.addPlayer(1);sim.join(p,0);const observer=sim.addPlayer(2);sim.join(observer,0);observer.god=true;return {sim,p,observer};}
const {sim,p,observer}=setup();const started=sim.admin.previewKill(p,'hound','A');assert(started.ok,JSON.stringify(started));assert(p.dead);assert.equal(sim.bodies.size,1);const a=sim.aftermaths.get(1),key=a.event.key;
assert.equal(a.event.identity.lifeGeneration,p.life);assert(Object.isFrozen(a.event.initial.victim));assert.equal(a.event.geometry.contentHash,sim.geometry.identity.contentHash);
const win={TFB_MOTION:M};vm.runInNewContext(fs.readFileSync('dphys.js','utf8'),{window:win,Math,console});const client=win.__dphys.fromEvent(a.event,sim.geometry);
const e=sim.engine.entities.find(e=>e.id===a.attackerId);assert.equal(e.deathOwner,key);
for(let i=0;i<200;i++){sim.step(1/60);win.__dphys.tick(client);valid(a.S);assert.deepEqual(JSON.parse(JSON.stringify(DP.snapshot(a.S))),JSON.parse(JSON.stringify(win.__dphys.snapshot(client))));assert.equal(e.x,a.S.at.x);assert.equal(e.z,a.S.at.z);}
sim.removePlayer(p);for(let i=0;i<240;i++){sim.step(1/60);valid(a.S);}
assert.equal(sim.bodies.size,1);assert.equal(sim.bodies.get(1).spatial.key,key);assert(!e.deathOwner);assert(a.released);
console.log('PASS G3 canonical kill, immutable initial physical state, independent client shared-kernel exact replay, one attacker owner, disconnect continuation');
const C=new P.Client(P.manifest(sim.geometry,'local',0));C.hello(P.manifest(sim.geometry,'g3:epoch',sim.physicsTick));const message=()=>({t:'bodies',v:sim.bodyVer,worldEpoch:'g3:epoch',aftermathVersion:P.AFTERMATH_VERSION,b:[...sim.bodies.values()]});assert(C.bodies(message()));assert(!C.bodies(message()));const latest=C.aftermaths.get(1);assert(!C.bodies({...message(),v:sim.bodyVer+1,worldEpoch:'stale'}));assert.equal(C.aftermaths.get(1),latest);assert(P.compatible({...C.local,version:1},C.world));assert(P.compatible({...C.local,capabilities:C.local.capabilities.filter(c=>c!=='spatial-aftermath-v1')},C.world));
const {sim:two,p:q}=setup();assert(two.admin.previewKill(q,'smiler','B').ok);const first=two.aftermaths.get(1).event;assert(two.respawn(q));assert(two.admin.previewKill(q,'smiler','D').ok);const second=two.aftermaths.get(1).event;assert.notEqual(first.key,second.key);assert(second.identity.lifeGeneration>first.identity.lifeGeneration);assert.equal(two.bodies.size,1);
console.log('PASS G3 duplicate/stale snapshots, explicit v1/capability mismatch, same-owner successive lives produce one current corpse');
console.log(JSON.stringify({key,substeps:a.S.stepN,state:a.S.state,bodyCount:sim.bodies.size,first:first.identity,second:second.identity}));
