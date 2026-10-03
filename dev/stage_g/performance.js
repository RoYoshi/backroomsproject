'use strict';
const assert=require('assert'),os=require('os'),{performance}=require('perf_hooks'),P=require('../../spatial_protocol'),{workload}=require('./workload');
const quant=(a,q)=>a[Math.min(a.length-1,Math.floor(q*a.length))],summary=a=>{a.sort((x,y)=>x-y);return {p50:quant(a,.5),p95:quant(a,.95),p99:quant(a,.99),worst:a.at(-1)};},results=[];
for(const count of [1,3,24]){
 const sim=workload(count),samples=[],payload=[],sender={};let awakeMax=0,activeMax=0,maxRecord=0,maxFrame=0;
 for(let t=0;t<420;t++){
  const active=[...sim.aftermaths.values()].filter(a=>a.S.state!=='SLEEPING');activeMax=Math.max(activeMax,active.length);awakeMax=Math.max(awakeMax,active.reduce((n,a)=>n+[a.S.b,...a.S.h,a.S.eq,a.S.hat].filter(o=>o.has!==false&&!o.sleeping).length,0));
  const start=performance.now();sim.step(1/60);const elapsed=performance.now()-start;if(active.length)samples.push(elapsed);
  if(t%3===0){const msgs=P.bodyMessages(sim.bodies,sim.bodyVer,'g4:bounded',sim.physicsTick,sender),sizes=msgs.map(m=>Buffer.byteLength(JSON.stringify(m)));payload.push(sizes.reduce((a,b)=>a+b,0));maxFrame=Math.max(maxFrame,...sizes);maxRecord=Math.max(maxRecord,...[...sim.bodies.values()].map(r=>Buffer.byteLength(JSON.stringify(r))));}
 }
 assert([...sim.aftermaths.values()].every(a=>a.S.state==='SLEEPING'));
 const queries=()=>Object.fromEntries(['steps','sweeps','supports','clearance','contacts','sleepChecks'].map(k=>[k,[...sim.aftermaths.values()].reduce((n,a)=>n+a.S.motion.stats[k],0)])),before=queries(),version=sim.bodyVer,idle=[];
 for(let i=0;i<300;i++){const start=performance.now();sim.step(1/60);idle.push(performance.now()-start);}assert.equal(sim.bodyVer,version);assert.deepEqual(queries(),before);assert(maxFrame<100000);assert(maxRecord<96000);
 const row={count,activeMax,awakeMax,activeTickMs:summary(samples),sleepingTickMs:summary(idle),queries:before,sleepingQueryDelta:0,recordMaxBytes:maxRecord,frameMaxBytes:maxFrame,snapshotBytes:summary(payload),nominal20HzPeakBytesPerClientSecond:Math.max(...payload)*20,settledUpdatesPerSecond:0};results.push(row);console.log(JSON.stringify(row));
}
console.log(JSON.stringify({status:'PASS',runtime:process.version,platform:process.platform,cpu:os.cpus()[0].model,scope:'Stage G bounded server simulation/aftermath and JSON payload only; not Stage I certification',results}));
