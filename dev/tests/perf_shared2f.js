/* 9 workloads. Real fixed-step server simulation; scripted input preparation outside
 * timer; injected sound/perception work INSIDE timer. Timing is hardware-dependent. */
'use strict';
const {performance}=require('perf_hooks'),{World,LONG,floorNear}=require('./lib');
const modes=['shipped','hound-heavy','smiler-heavy','multiplayer','sound-heavy','light-heavy','conflict','habits','cleanup'];
for(const mode of modes.filter(m=>!process.env.PERF_MODE||process.env.PERF_MODE===m))for(const seed of [1,2,3]){
 const w=World(600+seed),nh=mode==='hound-heavy'?12:3,ns=mode==='smiler-heavy'?16:5,np=mode==='shipped'?4:8,es=[],ps=[];
 for(let i=0;i<nh+ns;i++){const q=floorNear(w,4200+i*230,LONG.y+(i%3-1)*80);es.push(w[i<nh?'hound':'smiler'](q.x,q.y));}
 for(let i=0;i<np;i++){const q=floorNear(w,5000+i*220,LONG.y);ps.push(w.player(q.x,q.y,{light:mode==='light-heavy'||mode==='conflict'||i%2===0}));}
 if(mode==='habits'){
  // Isolate a full habit table: real movement/sensing, species motors held during
  // observed repeated passages so capture cannot end the memory stress fixture.
  for(const [i,e]of es.entries()){e.x=4700+i*35;e.y=LONG.y;e.ang=0;e.tierT=1e9;e.sp={...e.sp,tick(){}};}
  for(const [i,p]of ps.entries()){p.x=5175+i*2;p.y=LONG.y;p.light=true;}
  for(let leg=0;leg<6;leg++){for(const [i,p]of ps.entries())p.go((leg%2?5175:5420)+i*2,LONG.y,'walk');w.run(2.3);}
 }
 const times=[],peak={records:0,evidence:0,sounds:0,leads:0,habits:0,hypotheses:0,visits:0};let near=0,step=w.sim.step.bind(w.sim),events=0;
 w.sim.step=dt=>{const t=performance.now();if(['sound-heavy','conflict'].includes(mode)&&w.eng.ticks%6===0)for(const p of ps){w.eng.sound({x:p.x,y:p.y,r:1800,I:.8,type:'run',src:p.id});events++;}step(dt);if(w.t>=4)times.push(performance.now()-t);};
 w.run(mode==='cleanup'?300:64,()=>{for(const [i,p]of ps.entries()){if(p.dead){w.sim.respawn(p);p.safe=0;p.x=5000+i*220;p.y=LONG.y;}p.look=w.t*.4+i;if(mode==='habits'){p.light=true;const leg=Math.floor((w.t-13.8)/2.3);p.go((leg%2?5175:5420)+i*2,LONG.y,'walk');}else if(!p.tx&&!p.caught)p.go(p.x<6000?8200:3600,LONG.y,i%2?'run':'walk');}for(const e of es){near+=e.tier==='near'?1:0;const c={records:e.mem.p.size,evidence:[...e.mem.p.values()].reduce((n,r)=>n+r.ev.length,0),sounds:e.mem.sounds.length,leads:e.mem.leads.length,habits:[...e.mem.habits.values()].reduce((n,h)=>n+h.length,0),hypotheses:e.mem.hypotheses.length,visits:e.mem.visited.size};for(const k in peak)peak[k]=Math.max(peak[k],c[k]);}});
 for(const p of ps)w.sim.removePlayer(p);const remaining=es.reduce((n,e)=>n+e.mem.p.size+e.mem.habits.size+(e.att?.size||0),0);
 times.sort((a,b)=>a-b);const avg=times.reduce((a,b)=>a+b,0)/times.length,p99=times[Math.floor(times.length*.99)],ok=avg<1.5&&p99<8&&remaining===0&&(mode!=='habits'||peak.hypotheses===3);
 console.log(JSON.stringify({mode,seed,n:times.length,avg_ms:+avg.toFixed(4),p99_ms:+p99.toFixed(4),max_ms:+times.at(-1).toFixed(4),peak_per_entity:peak,sound_events:events,remaining_identity_records:remaining,ok}));if(!ok)process.exitCode=1;
}
