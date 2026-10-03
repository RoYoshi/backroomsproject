'use strict';
const assert=require('assert'),createSim=require('../../sim'),P=require('../../spatial_protocol'),{G,M,world,box,DP,context,field,clone,valid}=require('./fixtures'),wireField=require('../stage_f/fixture').field;
function final(d,z=0){const S=DP.create(context(G.compile(d),'Hound','B',{victim:{x:300,y:300,z:120+z,angle:0,vx:150},src:{x:254,y:300,z:120+z}}));for(let i=0;i<540;i++){DP.tick(S);valid(S);}return S;}
const d=world([box('lower',-1000,-1000,3000,3000,-20,0),box('ledge',200,200,300,180,104,120)]),base=final(d),translated=clone(d),dz=512;
for(const s of translated.solids){s.lower.c+=dz;s.upper.c+=dz;}for(const p of translated.supportPatches)p.plane.c+=dz;translated.bounds.min.z+=dz;translated.bounds.max.z+=dz;
const shifted=final(translated,dz),permuted=clone(d);permuted.solids.reverse();permuted.supportPatches.reverse();const shuffled=final(require('../stage_e/fixture').canonical(permuted));
for(const [other,offset]of [[shifted,dz],[shuffled,0]])for(const [a,b]of [[base.b,other.b],[base.h[0],other.h[0]],[base.h[1],other.h[1]],[base.eq,other.eq],[base.hat,other.hat]]){assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z+offset)<1e-6,'translation/order outcome');assert.equal(a.supportId,b.supportId);assert.equal(a.sleeping,b.sleeping);}
console.log('PASS translated Z and permuted static IDs preserve physical outcomes, contacts and sleep');
// Fixed geometry and immutable event; restore only bounded current state, never
// synchronous integration from the kill tick.
const sim=createSim({world:wireField(),seed:12,director:false,worldEpoch:()=> 'g4:resume'}),p=sim.addPlayer(1);sim.join(p,0);assert(sim.admin.previewKill(p,'hound','B').ok);const a=sim.aftermaths.get(1);
for(let i=0;i<160;i++)sim.step(1/60);const saved=DP.save(a.S),records=DP.snapshot(a.S),n=a.S.stepN;
const resumed=DP.restore(a.event,sim.geometry,saved,records);assert.equal(resumed.stepN,n);assert.deepEqual(JSON.parse(JSON.stringify(DP.snapshot(resumed))),JSON.parse(JSON.stringify(records)));
for(let i=0;i<240;i++){DP.tick(a.S);DP.tick(resumed);assert.deepEqual(JSON.parse(JSON.stringify(DP.snapshot(resumed))),JSON.parse(JSON.stringify(DP.snapshot(a.S))));}
assert(JSON.stringify(saved).length<18000);console.log('PASS bounded active restore exact at substep',n,'checkpoint bytes',Buffer.byteLength(JSON.stringify(saved)));
// Removing live players does not stop physical time. A long fall outlasts the
// entire authored sequence, yet cannot be declared asleep by zero XY speed.
const tall=wireField();tall.solids=tall.solids.filter(s=>s.id==='solid:ground');tall.supportPatches=tall.supportPatches.filter(s=>s.id==='support:ground');tall.navSurfaces=tall.navSurfaces.filter(s=>s.id==='nav:ground');tall.bounds.max.z=40000;tall.anchors[0].position.z=0;
const fallSim=createSim({world:tall,seed:31,director:false,worldEpoch:()=> 'g4:fall'}),v=fallSim.addPlayer(8);fallSim.join(v,0);assert(fallSim.admin.previewKill(v,'smiler','B').ok);const aft=fallSim.aftermaths.get(8);
// External physical initial fixture: lift every mass together, preserving all
// constraints. This supplies an airborne world state to the real running kernel.
for(const o of [aft.S.b,...aft.S.h,aft.S.at,aft.S.eq,aft.S.hat]){o.z+=20000;o.supportId=null;o.stable=false;o.sleeping=false;}
fallSim.removePlayer(v);for(let i=0;i<300;i++){fallSim.step(1/60);valid(aft.S);}assert(aft.S.t>aft.S.dur);assert(aft.S.b.z>1000);assert.equal(aft.S.state,'ACTIVE');assert(!aft.S.b.sleeping);assert.equal(fallSim.players.length,0);const mid=aft.S.b.z;
for(let i=0;i<600;i++)fallSim.step(1/60);assert(aft.S.b.z<1);assert.equal(fallSim.bodies.size,1);console.log('long fall end',JSON.stringify(DP.snapshot(aft.S)));assert.equal(aft.S.state,'SLEEPING');const ver=fallSim.bodyVer,steps=aft.S.stepN;for(let i=0;i<120;i++)fallSim.step(1/60);assert.equal(fallSim.bodyVer,ver);assert.equal(aft.S.stepN,steps);
console.log('Z31 PASS no players: authored sequence ends in midair at Z',mid,'then physical settling; no idle revisions');
// Explicit geometry replacement wakes the same settled physical masses.
const upper=G.compile(world([box('lower',-1000,-1000,3000,3000,-20,0),box('upper',-1000,-1000,3000,3000,104,120)])),wake=DP.create(context(upper,'Smiler','B',{victim:{x:300,y:300,z:120,angle:0}}));for(let i=0;i<480;i++)DP.tick(wake);assert.equal(wake.state,'SLEEPING');const body=wake.b,light=wake.eq;
DP.rebindGeometry(wake,G.compile(world([box('lower',-1000,-1000,3000,3000,-20,0)])));assert.equal(wake.b,body);assert.equal(wake.eq,light);assert(!body.sleeping);for(let i=0;i<300;i++){DP.tick(wake);valid(wake);}assert.equal(wake.b.supportId,'support:lower');assert.equal(wake.state,'SLEEPING');
console.log('PASS support removal wakes/reuses same body, two hands, gear and hat');
// Query failure injection tests the production bounded nonpenetrating fallback.
// Actual geometry still decides contacts/clearance; only its diagnostic is forced.
const real=G.compile(world([box('floor',-500,-500,1500,1500,-20,0),box('wall',340,-500,30,1500,0,300,true)])),fault={...real,sweep(...args){const h=real.sweep(...args);return h?{...h,diagnostic:'INJECTED_QUERY_LIMIT'}:null;}},F=DP.create(context(fault,'Hound','C'));
for(let i=0;i<180;i++){DP.tick(F);valid(F);}assert(F.b.diagnostics.length||F.at.diagnostics.length);console.log('PASS bounded diagnostic query failure remains nonpenetrating');
console.log('G4 properties PASS');
