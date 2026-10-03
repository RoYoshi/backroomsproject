'use strict';
// Bounded diagnostic, not Stage I population certification. Run serially.
const assert=require('node:assert/strict'),fs=require('node:fs');
const AI=require('../../ai'),{adapter}=require('./fixture'),{player}=require('./test_helpers');
const stats=a=>{const s=a.slice().sort((a,b)=>a-b);return {samples:s.length,median:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],p99:s[Math.min(s.length-1,Math.floor(s.length*.99))],max:s.at(-1)};};
const en=AI.create({adapter:adapter(),seed:7331}),g=en.geo;
const starts=[{x:168,y:168,z:0},{x:168,y:168,z:180},{x:880,y:615,z:120},{x:880,y:840,z:-96}];
for(const p of starts)for(const kind of ['hound','smiler'])en.spawn(kind,p.x+(kind==='smiler'?48:0),p.y,{z:p.z});
assert.equal(new Set(en.entities.map(e=>e.navSurfaceId)).size,4);
const players=starts.map((p,i)=>player({...p,id:100+i,x:i===2?840:p.x+100,y:i===2?550:p.y,light:true}));en.setPlayers(players);
const maxima={identities:0,sounds:0,leads:0,evidencePerIdentity:0,habitObservationsPerIdentity:0,hypotheses:0,supportCandidates:0};
const times=[];
for(let tick=0;tick<660;tick++){
  if(tick%90===0){const p=players[(tick/90)%players.length|0];en.sound({x:p.x,y:p.y,z:p.z,r:1500,I:1,type:'impact',src:0});}
  const t=performance.now();en.step(1/60);if(tick>=60)times.push(performance.now()-t);
  for(const e of en.entities){
    assert([e.x,e.y,e.z].every(Number.isFinite));
    maxima.identities=Math.max(maxima.identities,e.mem.p.size);maxima.sounds=Math.max(maxima.sounds,e.mem.sounds.length);maxima.leads=Math.max(maxima.leads,e.mem.leads.length);maxima.hypotheses=Math.max(maxima.hypotheses,e.mem.hypotheses.length);
    for(const r of e.mem.p.values())maxima.evidencePerIdentity=Math.max(maxima.evidencePerIdentity,r.ev?.length||0);
    for(const h of e.mem.habits.values())maxima.habitObservationsPerIdentity=Math.max(maxima.habitObservationsPerIdentity,h.length);
    for(const q of [...e.mem.leads,...e.mem.sounds,...[...e.mem.p.values()].map(r=>r.spatial)])maxima.supportCandidates=Math.max(maxima.supportCandidates,q?.supportCandidates?.length||0);
  }
}
for(const [k,cap]of Object.entries({identities:16,sounds:8,leads:6,evidencePerIdentity:4,habitObservationsPerIdentity:6,hypotheses:3,supportCandidates:4}))assert(maxima[k]<=cap,k);
const a={x:168,y:168,z:0,supportId:'support:ground-north'},b={x:168,y:168,z:180,supportId:'support:upper-west'};
const planning=[],costs=[];
for(let i=0;i<40;i++){const caps=i%2?AI.HOUND.caps:AI.SMILER.caps,start=i%4<2?a:b,goal=start===a?b:a;const t=performance.now(),route=g.pathPose(start,goal,caps);planning.push(performance.now()-t);assert(route?.length);costs.push(g.gs[g.snapPose(goal,caps)]);}
assert.equal(g.navStats.routeRequests,g.navStats.routeCacheHits+g.navStats.routeCacheMisses);
const result={status:'PASS',runtime:process.version,seed:7331,initialEntities:8,initialOccupiedSurfaces:4,ticks:660,measuredTicks:600,nodes:g.N,edges:g.edges.reduce((n,e)=>n+e.length,0),stepMilliseconds:stats(times),planningMilliseconds:stats(planning),planningCost:stats(costs),navigation:g.navStats,sensors:g.sensorStats,evidenceMaxima:maxima,cacheScope:'cacheHits/Misses count physical edge proofs; routeCacheHits/Misses count reuse/refresh of committed entity routes. Sensor caches not added.',scope:'Bounded multi-surface diagnostic; no Stage I or hardware certification.'};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
