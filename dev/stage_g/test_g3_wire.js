'use strict';
const assert=require('assert'),P=require('../../spatial_protocol'),{field}=require('../stage_f/fixture'),{server,connect,wait,sleep}=require('../stage_f/wire');
(async()=>{const d=field(),s=await server(d);let victim,observer,late;
try{
 victim=await connect(s,d,'g3');observer=await connect(s,d,'g3');await victim.join();await victim.admin();
 victim.send({t:'a',c:'preview',k:'hound',var:'A'});
 const death=await wait(()=>observer.messages.find(m=>m.t==='death'),'canonical death',6000),event=death.event;
 const bodies=c=>c.messages.filter(m=>m.t==='bodies').at(-1);
 await wait(()=>bodies(observer)?.b.length===1,'first corpse');const initial=bodies(observer).b[0].spatial;
 assert.equal(initial.key,event.key);assert(P.validDeath(event,observer.client.world));assert.equal(initial.state.hands.length,2);
 const good=initial.state.body;
 for(let i=0;i<8;i++){victim.send({t:'b',c:'Hound',x:999999,y:999999,z:9999,death:event.identity});victim.send({t:'fx',k:'death',x:999999,y:999999,death:event.identity});victim.send({t:'complete',death:event.identity});victim.send({t:'death-ack',death:event.identity});victim.send({t:'object',id:good.id,x:999999});}
 await sleep(150);victim.close();
 await wait(()=>bodies(observer)?.b[0]?.spatial.state.substep>initial.state.substep+24,'continues after disconnect');
 assert.equal(observer.messages.filter(m=>m.t==='death').length,1);assert.equal(observer.messages.filter(m=>m.t==='fx'&&m.k==='death').length,0);
 late=await connect(s,d,'g3');await wait(()=>bodies(late)?.b.length===1,'active late state');const active=bodies(late).b[0].spatial;assert.equal(active.key,event.key);assert(active.state.substep>0);assert(active.state.body.x<2000);assert.equal(bodies(observer).b.length,1);
 const checker=new P.Client(P.manifest(late.history.g,'local',0));checker.hello(late.client.world);assert(checker.bodies(bodies(late)));assert(!checker.bodies(bodies(late)));
 await wait(()=>bodies(observer)?.b[0]?.spatial.state.state==='SLEEPING','physical sleep',16000);
 await sleep(100);const settled=bodies(observer).b[0].spatial;assert.equal(settled.key,event.key);assert(settled.state.light);assert(settled.state.body.sleeping);assert.equal(bodies(observer).b.length,1);
 console.log('Z26/Z27 PASS real server: one canonical event, immediate corpse, duplicate/stale client results harmless, victim disconnect, active late state, eventual same settled corpse');
 console.log(JSON.stringify({identity:event.identity,initialSubstep:initial.state.substep,activeJoinSubstep:active.state.substep,settledSubstep:settled.state.substep,body:settled.state.body,light:settled.state.light,canonicalEventCount:observer.messages.filter(m=>m.t==='death').length,corpses:bodies(observer).b.length}));
}finally{victim?.close();observer?.close();late?.close();await s.close();console.log(s.log);}})().catch(e=>{console.error(e);process.exitCode=1;});
