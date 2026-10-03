'use strict';
const assert=require('assert'),P=require('../../spatial_protocol'),{DP,valid}=require('./fixtures'),{workload}=require('./workload'),create=require('../../sim'),{field}=require('../stage_f/fixture');
for(const phase of [0,60,250,600]){
 const sim=create({world:field(),seed:14,director:false,worldEpoch:()=> 'g4:lifecycle'}),p=sim.addPlayer(1);sim.join(p,0);assert(sim.admin.previewKill(p,'hound','A').ok);const a=sim.aftermaths.get(1),key=a.event.key;
 for(let t=0;t<phase;t++)sim.step(1/60);sim.removePlayer(p);
 const C=new P.Client(P.manifest(sim.geometry,'local',0));C.hello(P.manifest(sim.geometry,'g4:lifecycle',sim.physicsTick));
 for(const delay of [0,20,240,600]){for(let t=0;t<delay;t++)sim.step(1/60);const msgs=P.bodyMessages(sim.bodies,sim.bodyVer,'g4:lifecycle',sim.physicsTick,{});const fresh=new P.Client(C.local);fresh.hello(C.world);for(const m of msgs)fresh.bodies(m);const r=fresh.aftermaths.get(1);assert(r&&r.spatial.key===key);assert.deepEqual(r,sim.bodies.get(1));if(r.spatial.resume){const S=DP.restore(r.spatial.event,sim.geometry,r.spatial.resume,r.spatial.state);assert.equal(S.stepN,a.S.stepN);valid(S);}assert(P.aftermathPoses(r,sim.geometry).every(P.validPose));}
 assert.equal(sim.bodies.size,1);assert.equal(a.S.state,'SLEEPING');console.log('PASS disconnect at tick',phase,'active/settled joins preserve one owner and all gear');
}
const cap=workload(25);assert.equal(cap.bodies.size,24);assert.equal(cap.aftermaths.size,24);assert(!cap.bodies.has(1));for(let i=0;i<3;i++)cap.step(1/60);
const w=P.manifest(cap.geometry,'g4:bounded',cap.physicsTick),client=new P.Client(w);client.hello(w);const sender={},messages=P.bodyMessages(cap.bodies,cap.bodyVer,w.worldEpoch,cap.physicsTick,sender);assert(messages.length>1);for(const m of [...messages].reverse()){assert(Buffer.byteLength(JSON.stringify(m))<100000);client.bodies(m);}assert.equal(client.aftermaths.size,24);assert(messages.every(m=>!client.bodies(m)));
const ttl=workload(1,{bodyTtl:.5});for(let i=0;i<120;i++)ttl.step(1/60);assert.equal(ttl.bodies.size,0);assert.equal(ttl.aftermaths.size,0);
console.log('PASS cap=24, unchanged TTL, bounded chunk reassembly/duplicate rejection',JSON.stringify({parts:messages.length,bytes:messages.map(m=>Buffer.byteLength(JSON.stringify(m)))}));
