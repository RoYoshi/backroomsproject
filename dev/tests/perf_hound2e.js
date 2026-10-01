/* Server-step cost, excluding scripted client move.js: five explicit workloads, three seeds,
 * 4 s warm-up + 60 s measurement. No behavior assertions from capture percentages.
 * node dev/tests/perf_hound2e.js  (JSON lines; hardware-dependent timings) */
'use strict';
const {performance}=require('perf_hooks'),path=require('path');
const {World,LONG,floorNear}=require(path.join(process.env.GAMEDIR||require('../paths.js'),'dev/tests/lib.js'));
let good=true;
for(const mode of ['shipped','hound-heavy','sprinting','flashlights','search-heavy'])for(const seed of [1,2,3]){
 const w=World(600+seed),nh=mode==='shipped'?3:mode==='hound-heavy'?12:8,np=mode==='shipped'?4:8,ps=[],hs=[];
 for(let i=0;i<np;i++){const q=floorNear(w,4900+i*180,LONG.y);ps.push(w.player(q.x,q.y,{light:mode==='flashlights'||(mode==='shipped'&&i<2)}));}
 for(let i=0;i<nh;i++){const q=floorNear(w,4300+i*260,LONG.y+((i%3)-1)*48),h=w.hound(q.x,q.y);h.ang=0;hs.push(h);}
 if(mode==='shipped')for(let i=0;i<5;i++){const q=floorNear(w,4700+i*330,LONG.y+250);w.smiler(q.x,q.y);}
 const times=[];let active=0,search=0,sprinting=0,lights=0;
 const step=w.sim.step.bind(w.sim);w.sim.step=dt=>{const t=performance.now();step(dt);if(w.t>=4)times.push(performance.now()-t);};
 w.run(64,()=>{
  for(const [i,p] of ps.entries()){
   if(p.dead){w.sim.respawn(p);p.safe=0;const q=floorNear(w,5100+i*230,LONG.y);p.x=q.x;p.y=q.y;}
   p.look=mode==='flashlights'?w.t*.9+i:0;
   if(mode==='search-heavy'){
    const ph=Math.floor(w.t*60)%720;
    if(ph===0){p.x=5100+i*150;p.y=LONG.y;p.light=true;p.stop();}
    if(ph===90){const q=floorNear(w,5100+i*150,LONG.y+600);p.x=q.x;p.y=q.y;p.light=false;p.stop();}
   }else if(!p.tx&&!p.caught){p.go(p.x<5800?8200:3500,LONG.y,mode==='sprinting'?'run':'walk');}
  }
  if(w.t>=4){active+=hs.filter(h=>h.tier==='near').length;search+=hs.filter(h=>h.state==='SEARCHING').length;sprinting+=ps.filter(p=>p.st===2).length;lights+=ps.filter(p=>p.light&&!p.dead).length;}
 });
 times.sort((a,b)=>a-b);const avg=times.reduce((a,b)=>a+b,0)/times.length,p99=times[Math.floor(times.length*.99)];
 const ok=avg<1.5&&p99<8;good&&=ok;console.log(JSON.stringify({mode,seed,n:times.length,avg_ms:+avg.toFixed(4),p99_ms:+p99.toFixed(4),max_ms:+times.at(-1).toFixed(4),avg_near_hounds:+(active/times.length).toFixed(2),avg_searching:+(search/times.length).toFixed(2),avg_sprinters:+(sprinting/times.length).toFixed(2),avg_visible_lights:+(lights/times.length).toFixed(2),ok}));
}
process.exitCode=good?0:1;
