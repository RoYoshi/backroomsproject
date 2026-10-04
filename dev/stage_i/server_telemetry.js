'use strict';
// Test-only Node preload. It observes the ordinary server process, never its
// simulation inputs, physics/evidence cadence, protocol or room state.
const fs=require('fs'),{monitorEventLoopDelay}=require('perf_hooks');
const target=process.env.TFB_STAGE_I_TELEMETRY;
if(target){const histogram=monitorEventLoopDelay({resolution:10});histogram.enable();const samples=[],start=performance.now();
 const timer=setInterval(()=>{samples.push({seconds:(performance.now()-start)/1000,memory:process.memoryUsage(),eventLoopMs:{p50:histogram.percentile(50)/1e6,p95:histogram.percentile(95)/1e6,p99:histogram.percentile(99)/1e6,max:histogram.max/1e6}});fs.writeFileSync(target,JSON.stringify({runtime:process.version,pid:process.pid,samples}));histogram.reset();},1000);timer.unref();}
