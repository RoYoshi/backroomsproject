'use strict';
const assert=require('node:assert/strict'),{fixture}=require('../stage_e/fixture'),{mover}=require('../stage_c/helpers'),{server,connect,wait,sleep}=require('./wire'),M=require('../../world_motion');
(async()=>{const d=fixture(),s=await server(d);let c,o,timer,draws=0,errors=[];
try{c=await connect(s,d);await c.join();await c.admin();o=await connect(s,d);await o.join();const key='p'+c.hi.id;timer=setInterval(()=>{try{const q=o.history.sample(key,Date.now());if(q){assert(o.history.g.clearance(M.PROFILES.stand,q).fits);draws++;}}catch(e){errors.push(e.message);}},5);
 const results=[];for(const [name,start]of [['stairs',{x:368,y:90,z:0,support:'support:stair-base'}],['drop',{x:880,y:690,z:120,support:'support:balcony'}]]){
  // The canonical initializer identifies the starting patch; no XY floor selection.
  start.support=M.create(o.history.g).initialize({...start}).supportId;await c.teleport(start);const a=c.client.anchor,r=mover(d,a);let tick=a.tick,transition=false;
  for(let i=0;i<100;i++){r.step(0,1);const b=r.H;await wait(()=>c.last.protocol.simTick>=tick+1,'credit');c.send(c.client.proposal([{tick:++tick,x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy,yaw:0,posture:r.mv.s,support:b.supportId}]));await sleep(20);if(c.corrections.at(-1).cause==='physical-transition'){transition=true;break;}}
  assert(transition,name+' real transition');const z=c.client.pose.z;await wait(()=>c.corrections.at(-1).cause==='grounded',name+' completion',8000);await sleep(150);assert.notEqual(c.client.pose.z,z);assert.equal(errors.length,0,errors.join('\n'));results.push({name,fromZ:z,toZ:c.client.pose.z,ownedTicks:c.last.spatialStats.ownedTicks});
 }
 await c.teleport({x:160,y:160,z:180,support:'support:upper-west'});await sleep(100);assert.equal(o.history.sample(key,Date.now()).z,180);assert.equal(errors.length,0);console.log(JSON.stringify({status:'PASS',Z23:'real server plus two shared protocol clients',results,draws,clearanceErrors:errors,teleportNoBlend:true},null,2));
}finally{clearInterval(timer);c?.close();o?.close();await s.close();console.log(s.log);}})().catch(e=>{console.error(e);process.exitCode=1;});
