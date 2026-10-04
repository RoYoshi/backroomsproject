'use strict';
// Future acceptance gate. No empty passing suite.
const cases=require('../stage_a/future_matrix.json').filter(x=>x.entry==='perf_world25d').map(x=>({name:x.id+' '+x.scenario,fn:()=>({ok:false,note:'NOT IMPLEMENTED — EXPECTED STAGE '+x.stages})}));
if(require.main===module){for(const c of cases)console.log(c.name+': '+c.fn().note);process.exitCode=2;}
module.exports=cases;
