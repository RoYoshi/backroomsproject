'use strict';
// Expanded real motor paths under ordered seeded 20–250ms delay and a 1s bunch.
const assert=require('node:assert/strict'),{field}=require('./fixture'),{special}=require('../stage_e/test_motion'),{fixture}=require('../stage_e/fixture'),{mover,M}=require('../stage_c/helpers'),{server,connect,wait,sleep}=require('./wire');
async function run(mode){let d=['vault','crawl'].includes(mode)?special(mode):['stairs','drop'].includes(mode)?fixture():field();
 if(mode==='vault'){d.traversalLinks[0].profileIds.push('profile:player-stand');d.traversalLinks[0].obstacleId='solid:low';}
 if(['vault','crawl'].includes(mode))d.anchors=[{id:'anchor:spawn',kind:'spawn',position:{x:170,y:200,z:0},yaw:0,supportId:'support:floor',spaceId:null,colliderProfileId:'profile:player-stand'}];
 const props=mode==='vault'?[{id:'solid:low',cx:260,cy:200,cross:'x',topZ:20,rect:{x:250,y:0,w:20,h:400}}]:[],s=await server(d);let c;
 try{c=await connect(s,d);await c.join();await c.admin();if(['stairs','drop'].includes(mode)){const p=mode==='stairs'?{x:368,y:90,z:0}:{x:880,y:690,z:120};p.support=M.create(c.history.g).initialize({...p}).supportId;await c.teleport(p);}
 const initial=c.corrections.length,a=c.client.anchor,r=mover(d,a,props),begin=Date.now();let seed=137,due=0,pending=[],batch=[],saw=false,tick=a.tick;
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let generated=0;
 for(let i=1;i<=180;i++){
  if(c.corrections.length===initial){r.step(['stairs','drop'].includes(mode)?0:1,['stairs','drop'].includes(mode)?1:0,['slide','vault'].includes(mode),mode==='crawl'||mode==='slide'&&i===60);saw ||=r.mv.s===mode;const h=r.H,q={tick:++tick,x:h.x,y:h.y,z:h.z,vx:h.vx,vy:h.vy,yaw:0,posture:r.mv.s,support:h.supportId};if(r.mv.vault)q.vault={link:'link:vault',quality:r.mv.vault.q};batch.push(q);generated++;
   if(batch.length===3){due=Math.max(due,begin+i*1000/60+20+rng()*230);if(i<=60)due=Math.max(due,begin+1000);const msg=c.client.proposal(batch);pending.push({due,msg});if(i%39===0)pending.push({due:due+2,msg});batch=[];}}
  while(Date.now()<begin+i*1000/60){while(pending.length&&pending[0].due<=Date.now())c.send(pending.shift().msg);await sleep(2);}
  if(['vault','stairs','drop'].includes(mode)&&c.corrections.length>initial&&c.corrections.at(-1).cause==='grounded'&&!pending.length)break;
 }
 while(pending.length){if(pending[0].due<=Date.now())c.send(pending.shift().msg);else await sleep(4);}
 const transitions=c.corrections.slice(initial);
 if(['vault','stairs','drop'].includes(mode)){assert(transitions.some(m=>m.cause==='physical-transition'));await wait(()=>c.corrections.at(-1).cause==='grounded','packetless completion');assert(c.last.spatialStats.ownedTicks>0);assert(c.corrections.slice(initial).every(m=>['physical-transition','grounded'].includes(m.cause)));const resume=mover(d,c.client.anchor,props);c.client.rebase(resume.H,resume.geometry,resume.mv);const qs=[],at=c.client.anchor.tick,accepted=c.last.spatialStats.accepted;for(let k=1;k<=3;k++){resume.step(0,0);const h=resume.H;qs.push({tick:at+k,x:h.x,y:h.y,z:h.z,vx:h.vx,vy:h.vy,yaw:0,posture:resume.mv.s,support:h.supportId});}await wait(()=>c.last.protocol.simTick>=at+3,'resume credit');c.send(c.client.proposal(qs));await wait(()=>c.last.spatialStats.accepted===accepted+3,'legitimate post-transition recovery');}
 else{await wait(()=>c.last.spatialStats.accepted===180,'all delayed motor samples');assert(saw);assert.equal(c.corrections.length,initial);assert(Math.hypot(c.client.pose.x-r.H.x,c.client.pose.y-r.H.y)<.01);}
 assert(c.last.spatialStats.maxQueue<=90);assert(c.last.spatialStats.maxHistory<=90);assert(c.last.spatialStats.maxWork<=15);
 console.log(JSON.stringify({status:'PASS',mode,seed:137,latency:[20,250],bunchMs:1000,generated,saw,transitions:c.corrections.slice(initial).map(m=>({cause:m.cause,tick:m.pose.tick,xyz:[m.pose.x,m.pose.y,m.pose.z]})),stats:c.last.spatialStats}));
 }finally{c?.close();await s.close();}}
(async()=>{for(const mode of (process.argv[2]?[process.argv[2]]:['slide','crawl','vault','stairs','drop']))await run(mode);})().catch(e=>{console.error(e);process.exitCode=1;});
