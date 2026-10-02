'use strict';
const assert=require('assert'),{G,M,box,world}=require('./helpers'),{performance}=require('perf_hooks');
const results=[];
for(const count of [1,256,1024]){
 const solids=[box('0000',0,0,100,100,-10,0)];for(let i=1;i<count;i++){const x=300+(i%32)*160,y=300+Math.floor(i/32)*160;solids.push(box(String(i).padStart(4,'0'),x,y,60,60,-10,0));}
 const d=world(solids);d.bounds.max.x=d.bounds.max.y=6000;
 const t=performance.now(),g=G.compile(d),compileMs=performance.now()-t,start=performance.now();let signature='';
 for(let i=0;i<2000;i++){const p={x:40+(i%10),y:40,z:0};const s=g.supports(M.PROFILES.stand,p,[-.1,.1]);assert.equal(s[0].id,'support:0000');assert(g.clearance(M.PROFILES.stand,p).fits);signature=s[0].id;}
 results.push({solids:count,index:g.indexInfo,compileMs,localSupportAndClearanceQueries:4000,queryMs:performance.now()-start,signature});
}
console.log(JSON.stringify({status:'COMPLETED',interpretation:'Descriptive cold compile/local query measurements; no fairness or universal performance acceptance inferred. Compile-time overlap validation remains quadratic; tick queries use XY index + Z filter and support ID map.',results},null,2));
