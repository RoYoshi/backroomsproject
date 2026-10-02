'use strict';
const assert=require('assert'),crypto=require('crypto'),timing=require('../../timing_policy'),{mover,world,box,fixture,clone}=require('./helpers');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function run(name,fps){
 let d=fixture,initial={x:600,y:148,z:0},props=[],ticks=240;
 if(name==='stairs')initial={x:368,y:85,z:0};
 if(name==='drop')initial={x:880,y:660,z:120};
 if(['walk','exhaustion','deep','slide','vault','crouch'].includes(name)){d=world([box('ground',0,0,1200,1000,-16,0)]);initial={x:100,y:500,z:0};}
 if(name==='exhaustion')ticks=960;
 if(name==='deep')d.materials[0].noiseClass='deep';
 if(name==='crawl')initial={x:100,y:770,z:0};
 if(name==='vault'){d=world([box('ground',0,0,1200,1000,-16,0),box('low',250,100,20,200,0,20)]);initial={x:170,y:200,z:0};props=[{id:'low',cx:260,cy:200,cross:'x',topZ:20,rect:{x:250,y:100,w:20,h:200}}];}
 const a=mover(d,initial,props);if(name==='crawl'){a.mv.s='crawl';a.mv.crouch=true;}if(name==='crouch')a.mv.crouch=true;
 let acc=0,frame=0,tick=0,elapsed=0;const records=[],events=[],states=new Set(),pattern=[1/240,1/90,1/165,1/48,1/120,1/75];
 while(tick<ticks){const f=fps==='jitter'?pattern[frame++%pattern.length]:1/fps;const r=timing.consume(acc,f,()=>{if(tick>=ticks)return;const dir=name==='stairs'||name==='drop'?[0,1]:[1,0];a.step(...dir,['exhaustion','deep','slide','vault'].includes(name),name==='slide'&&tick===60);records.push(a.snapshot());events.push(clone(a.H.events));states.add(a.mv.s);tick++;});acc=r.accumulator;elapsed+=f;assert(elapsed<30);}
 assert.equal(a.H.tick,ticks);assert.equal(a.H.diagnostics.length,0,name+' '+JSON.stringify(a.H.diagnostics));
 if(name==='slide'||name==='vault'||name==='crawl'||name==='crouch')assert(states.has(name));
 if(name==='exhaustion')assert(records.some(r=>r[9]));
 return {hash:hash({records,events}),final:records.at(-1),states:[...states],ticks};
}
const results=[];for(const name of ['walk','ramp','stairs','drop','exhaustion','deep','crouch','crawl','slide','vault']){const reference=run(name,60),schedules=[];for(const fps of [15,30,60,120,144,240,360,'jitter']){const actual=run(name,fps);assert.equal(actual.hash,reference.hash,name+' '+fps);schedules.push(fps);}results.push({name,...reference,schedules});console.log('PASS '+name+' 8 render schedules');}
console.log(JSON.stringify({status:'PASS',runtime:process.version,scenarios:results},null,2));
