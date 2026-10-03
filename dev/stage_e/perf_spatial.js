'use strict';
// Bounded Stage E diagnostic, not Stage I capacity certification. Real brains,
// geometry and A* run unchanged; instrumentation lives only in this harness.
const assert=require('node:assert/strict'),fs=require('node:fs'),{performance}=require('node:perf_hooks');
const AI=require('../../ai'),{adapter}=require('./fixture'),{navWorld}=require('./test_motion'),{box}=require('../stage_c/helpers'),{player}=require('./test_helpers');
const summarize=a=>{a=[...a].sort((x,y)=>x-y);return {n:a.length,median:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,p99:a[Math.floor(a.length*.99)]||0,max:a.at(-1)||0};};
const rows=[];
for(const floors of [1,2,4])for(const seed of [31,97]){
 const definition=navWorld(Array.from({length:floors},(_,i)=>box('floor-'+i,0,0,624,480,i*180-16,i*180)));
 const start=performance.now(),en=AI.create({adapter:adapter(definition),seed}),compileMs=performance.now()-start,g=en.geo;
 const timings=[],costs=[];let traversalEdgeChecks=0,routeRetainedTicks=0,routeRefreshes=0;
 const path=g.pathPose.bind(g),edges=g.spatialEdges.bind(g);
 g.spatialEdges=function(i,...args){traversalEdgeChecks+=this.edges[i].filter(e=>e.link).length;return edges(i,...args);};
 g.pathPose=function(a,b,c,o){const t=performance.now(),p=path(a,b,c,o);timings.push(performance.now()-t);if(p?.length){const n=g.nodes.findIndex(n=>n.id===p.at(-1).nodeId);if(n>=0)costs.push(g.gs[n]||0);}return p;};
 const actors=[],players=[];
 for(let floor=0;floor<floors;floor++){
  for(let i=0;i<2;i++){const e=en.spawn(i?'smiler':'hound',120,120+i*240,{z:floor*180});e.ang=0;actors.push(e);players.push(player({id:floor*2+i+1,x:480,y:120+i*240,z:floor*180,light:true,angle:0}));}
  const a={x:120,y:120,z:floor*180,supportId:'support:floor-'+floor},b={x:504,y:360,z:floor*180,supportId:a.supportId};
  for(const caps of [AI.HOUND.caps,AI.SMILER.caps])for(let repeat=0;repeat<4;repeat++)assert(g.pathPose(a,b,caps)?.length);
 }
 const planDiagnostics={milliseconds:summarize(timings),costUnits:summarize(costs)};
 const times=[],peak={records:0,evidencePerRecord:0,sounds:0,leads:0,habitsPerIdentity:0,hypotheses:0,supportAlternatives:0};
 for(let tick=0;tick<360;tick++){
  for(const [i,p]of players.entries()){p.y=120+(i%2)*240+Math.sin(tick/60)*25;p.sp=25;p.st=1;}
  en.setPlayers(players);const revisions=actors.map(e=>e.routeRevision),t=performance.now();
  if(tick%30===0)for(const p of players)en.sound({x:p.x,y:p.y,z:p.z,r:1200,I:.8,type:'impact',src:p.id});
  en.step(1/60);if(tick>=60)times.push(performance.now()-t);
  for(const [i,e]of actors.entries()){
   assert.equal(e.tick,en.ticks);assert(en.geo.geometry.clearance(e.shape,e).fits);
   routeRefreshes+=e.routeRevision-revisions[i];routeRetainedTicks+=e.path.length>0&&e.routeRevision===revisions[i]?1:0;
   const sizes={records:e.mem.p.size,evidencePerRecord:Math.max(0,...[...e.mem.p.values()].map(r=>r.ev.length)),sounds:e.mem.sounds.length,leads:e.mem.leads.length,habitsPerIdentity:Math.max(0,...[...e.mem.habits.values()].map(h=>h.length)),hypotheses:e.mem.hypotheses.length,supportAlternatives:Math.max(0,...[...e.mem.p.values()].map(r=>r.spatial?.supportCandidates?.length||0),...e.mem.leads.map(l=>l.supportCandidates?.length||0))};
   for(const k in peak)peak[k]=Math.max(peak[k],sizes[k]);
  }
 }
 for(const [k,cap]of Object.entries({records:16,evidencePerRecord:4,sounds:8,leads:6,habitsPerIdentity:6,hypotheses:3,supportAlternatives:4}))assert(peak[k]<=cap,k+' cap');
 assert(g.N<=floors*140,'occupied-sheet allocation');assert(g.navStats.maxNodes<=14000);assert(g.sensorCounters().soundNodes<=g.sensorCounters().soundQueries*130);
 const row={floors,seed,actors:actors.length,players:players.length,ticks:360,compileMs,nodes:g.N,edges:g.edges.reduce((n,x)=>n+x.length,0),planDiagnostics,allPlanMilliseconds:summarize(timings),stepMilliseconds:summarize(times),navigation:{...g.navStats,traversalEdgeChecks,routeRefreshes,routeRetainedTicks},sensors:g.sensorCounters(),peakEvidence:peak,cacheMeaning:'cacheHits/Misses count physical edge proof cache, not route requests. Route retention measured as actor ticks with a path and unchanged routeRevision; no receiver/light/sound cache is present.',ok:true};
 rows.push(row);console.log(JSON.stringify(row));
}
const result={status:'PASS',runtime:process.version,scope:'Repeatable 1/2/4 stacked occupied sheets, 2/4/8 real entities and players, two seeds, six seconds each. Timings diagnostic; not Stage I or hardware capacity acceptance.',rows};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
