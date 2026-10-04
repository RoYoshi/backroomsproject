'use strict';
const os=require('os');
const summary=a=>{a=[...a].sort((x,y)=>x-y);const at=q=>a[Math.min(a.length-1,Math.floor(q*a.length))]??0;return{samples:a.length,p50:at(.5),p95:at(.95),p99:at(.99),worst:at(1)};};
const host=()=>({node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem(),memory:process.memoryUsage()});
module.exports={summary,host};
