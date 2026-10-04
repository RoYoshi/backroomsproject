'use strict';
const assert=require('assert'),crypto=require('crypto'),T=require('../../timing_policy'),W=require('../../world');
const {world,box,mover,clone}=require('../stage_c/helpers');
assert.equal(W.MOVE.radius,15);assert.equal(W.MOVE.recoverAt,36);
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function definition(deep){const d=world([box('ground',-1000,-1000,20000,4000,-20,0)]);d.bounds.min.x=d.bounds.min.y=-1500;d.bounds.max.x=20000;d.bounds.max.y=4000;if(deep)d.materials[0].noiseClass='deep';return d;}
function run(deep,fps){
 const a=mover(definition(deep),{x:100,y:500,z:0}),records=[],events=[],states=new Set();let tick=0,frame=0,acc=0,exhaustedTick=null,recoveredTick=null,wasExhausted=false;
 const pattern=[1/360,1/27,1/144,1/19,1/240,1/60];
 while(tick<1560){const dt=fps==='jitter'?pattern[frame++%pattern.length]:1/fps;acc=T.consume(acc,dt,()=>{
  if(tick>=1560)return;const move=tick<960||tick>=1200,run=tick>=120&&tick<960||tick>=1200;
  const before=a.H.stamina;a.step(move?1:0,0,run);assert.equal(a.H.shape.radius,15);assert.equal(a.H.supportId,'support:ground');assert.equal(a.H.diagnostics.length,0);
  if(a.H.exhausted&&exhaustedTick===null)exhaustedTick=tick;
  if(wasExhausted&&!a.H.exhausted){assert(before>=36,'recovery before 36');recoveredTick??=tick;}
  wasExhausted=a.H.exhausted;states.add(a.mv.s);records.push(a.snapshot());events.push(clone(a.H.events));tick++;
 }).accumulator;}
 assert(exhaustedTick!==null&&recoveredTick!==null);assert(states.has('walk')&&states.has('run')&&states.has('stand'));
 return {records,events,hash:hash({records,events}),exhaustedTick,recoveredTick,states:[...states],world:a.geometry.identity};
}
const results=[];for(const deep of [false,true]){const reference=run(deep,60),schedules=[];for(const fps of [15,30,60,120,144,240,360,'jitter']){const actual=run(deep,fps);if(actual.hash!==reference.hash){const first=actual.records.findIndex((r,i)=>JSON.stringify([r,actual.events[i]])!==JSON.stringify([reference.records[i],reference.events[i]]));throw Error(JSON.stringify({deep,fps,firstDivergentTick:first,seed:'fixed-input-z18',world:actual.world,runtime:process.version}));}schedules.push({fps,hash:actual.hash,ticks:actual.records.length});}results.push({deep,world:reference.world,exhaustedTick:reference.exhaustedTick,recoveredTick:reference.recoveredTick,states:reference.states,schedules});}
assert(results[1].exhaustedTick<results[0].exhaustedTick,'deep material adds real stamina drain');
for(const stamina of [35.999999,36]){const a=mover(definition(false));a.step();a.H.stamina=stamina;a.H.exhausted=true;a.step();assert.equal(a.H.exhausted,stamina<36);}
console.log(JSON.stringify({status:'PASS',seed:'fixed-input-z18',runtime:process.version,radius:15,recoverAt:36,firstDivergentTick:null,results},null,2));
