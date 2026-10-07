/* 2E independent deterministic acceptance: real sim/AI/move.js. Admin placements establish
 * evidence boundaries. H6/8/10 fix near LOD to isolate decisions from unchanged scheduler.
 * H12 injects a blocked motor only to test the real watchdog. H7 uses the real sound bus. */
'use strict';
const assert=require('assert'),{World,LONG,geo,AI}=require('./lib');
const S=[],add=(name,fn)=>S.push({name,fn:()=>({ok:true,note:fn()||'all assertions passed'})}),LY=LONG.y;
function still(w,x,y,a=0){const h=w.hound(x,y);h.ang=a;h.act='rest';h.rest=1e9;h.tierT=1e9;return h;}
function trace(h){return JSON.stringify([h.x,h.y,h.ang,h.state,h.act,h.target,h.chaseBlind,h.search,h.hLight,h.dbg.hWhy,h.dbg.pursuit,h.path]);}
let fixture;
function corner(){
 if(fixture)return fixture;const G=geo(),g=G.g;
 for(const c of G.walls){const hx=c.x+Math.cos(c.ang)*(c.d-4),hy=c.y+Math.sin(c.ang)*(c.d-4);
 for(let R=360;R<800;R+=100)for(let k=0;k<24;k++){
 const a=k/24*Math.PI*2,bx=hx+Math.cos(a)*R,by=hy+Math.sin(a)*R;
 if(!G.ad.clear(bx,by,28,'walk')||!g.los(bx,by,hx,hy)||[0,18,-18].some(o=>g.los(bx,by,c.x+Math.cos(c.ang+Math.PI/2)*o,c.y+Math.sin(c.ang+Math.PI/2)*o)))continue;
 const w=World(6),p=w.player(c.x,c.y,{angle:c.ang}),h=still(w,bx,by,Math.atan2(hy-by,hx-bx));w.run(.25);
 if(h.mem.leads.some(l=>l.k!=='source')&&!h.mem.p.has(p.id))return fixture={px:c.x,py:c.y,pa:c.ang,bx,by,ba:Math.atan2(hy-by,hx-bx)};
 }}throw Error('no corner fixture');
}
add('2E H1 identified human with flashlight warrants pursuit',()=>{
 for(const seed of [1,2,3,4]){const w=World(seed),h=still(w,5000,LY),p=w.player(5430,LY,{angle:0});w.run(.25);assert.equal(h.state,'HUNTING');assert.equal(h.target,p.id);assert(h.mem.p.get(p.id).aw>=.7);}
});
add('2E H2 swept beam reaches Hound from behind: attention then identification',()=>{
 const w=World(7),h=still(w,5000,LY,Math.PI),p=w.player(5260,LY,{angle:0});w.run(.35);assert.equal(h.state,'ROAMING');p.angle=Math.PI;
 let attention=-1;w.run(.5,()=>{if(attention<0&&h.flashAt!==undefined)attention=w.t;});assert(attention>=0&&attention<=.85);assert(['CURIOUS','HUNTING'].includes(h.state));assert(h.ang!==Math.PI);w.run(2);assert.equal(h.target,p.id);assert.equal(h.state,'HUNTING');
});
add('2E H3 hidden carrier: anonymous light investigation; replay cannot back-project',()=>{
 const c=corner(),w=World(6),p=w.player(c.px,c.py,{angle:c.pa}),h=still(w,c.bx,c.by,c.ba);w.run(.3);assert(h.hLight);assert.equal(h.state,'CURIOUS');assert(!h.mem.p.has(p.id));assert(!h.target);assert(h.hLight.u>=120);assert(h.mem.leads.every(l=>l.pid===null));
 const observation={src:null,flash:false,pts:[{x:5000,y:LY,I:.5,w:0}],air:[],fresh:true,moved:true};
 function replay(x){const a=World(28),b=still(a,4800,LY),p=a.player(x,500,{light:false});a.eng.obsHook=()=>[observation];const tr=[];a.run(3,()=>tr.push(trace(b)));assert(!b.mem.p.has(p.id));return tr;}
 assert.deepEqual(replay(3000),replay(8000));
});
add('2E H4 solid wall blocks direct beam and impossible evidence',()=>{
 const G=geo();let n=0;for(const c of G.walls){let far;for(let t=c.d+20;t<c.d+350;t+=12){const x=c.x+Math.cos(c.ang)*t,y=c.y+Math.sin(c.ang)*t;if(G.ad.clear(x,y,28,'walk')&&!G.g.los(x,y,c.x,c.y)){far={x,y};break;}}if(!far)continue;
 const w=World(5),p=w.player(c.x,c.y,{angle:c.ang}),h=still(w,far.x,far.y,c.ang+Math.PI);w.run(.4);assert(!h.mem.p.has(p.id));assert.equal(h.flashAt,undefined);assert.equal(h.mem.leads.length,0);if(++n===12)break;}assert.equal(n,12);
});
add('2E H5 IR OFF vs HIGH: identical complete decisions each tick',()=>{
 function run(ir){const w=World(31),h=still(w,5000,LY),p=w.player(5400,LY,{kind:'camcorder'}),q=w.player(5800,LY);p.go(6900,LY,'run');q.go(8000,LY,'walk');const tr=[];w.run(18,()=>{p.ir=ir;p.irNet=ir;p.irLevel=ir;p.nvOn=!!ir;tr.push(trace(h));});return tr;}assert.deepEqual(run(0),run(2));
});
function hiddenPair(reposition=false){
 const G=geo(),spots=G.cells.map(c=>({x:G.g.cx(c),y:G.g.cy(c)})).filter(p=>p.x>4800&&p.x<6900&&Math.abs(p.y-LY)>250&&Math.abs(p.y-LY)<1000&&!G.g.los(5000,LY,p.x,p.y));const results=[];
 for(const pos of [spots[0],spots[spots.length-1]]){assert(pos);const w=World(44),h=still(w,5000,LY),p=w.player(5450,LY,{angle:0});p.go(6800,LY,'run');w.run(.3);assert(h.mem.p.get(p.id)?.seen);const v={...h.mem.p.get(p.id).hv};
 p.stop();p.light=false;p.stamina=100;p.x=pos.x;p.y=pos.y;const tr=[];w.run(6,()=>{if(reposition&&w.t>2){p.x=pos.x+12*Math.sin(w.t);p.y=pos.y;}const r=h.mem.p.get(p.id);if(w.t>.55&&(r.seen||r.heardAt>w.eng.now-.2))return false;tr.push(trace(h));});results.push({tr,v});}
 const n=Math.min(...results.map(a=>a.tr.length));assert(n>=180,'at least three seconds without new evidence');assert.deepEqual(results[0].v,results[1].v);assert.deepEqual(results[0].tr.slice(0,n),results[1].tr.slice(0,n));return `${n} identical decisions after same visible approach`;
}
add('2E H6 hidden corner branches cannot change prediction',()=>hiddenPair());
/* Stage 3B-N superseded the 2E/2F expectation here (USER_DECISION_LOCK 1-2): a Hound after a prey it has lost from sight no longer turns
 * CURIOUS at that prey's fresh running.  The sound is connected to the prey by INFERENCE (it fits where the prey could be by now) - never by
 * the bus's source id - and resumes the chase.  A sound that does not fit stays anonymous, exactly as 2F requires. */
add('2E H7 (3B-N) fresh hidden running that fits the lost prey resumes the chase by inference (never by source id); an unfitting one stays anonymous',()=>{
 const run=(src,far)=>{const c=corner(),w=World(33),h=still(w,c.bx,c.by,c.ba),p=w.player(c.px,c.py,{light:false});p.x=h.x+Math.cos(h.ang)*90;p.y=h.y+Math.sin(h.ang)*90;p.light=true;w.run(.12);const r=h.mem.p.get(p.id);assert(r?.seen);
  p.x=c.px;p.y=c.py;p.light=false;p.stop();w.step();r.seen=false;r.seenAt=w.eng.now-(far?1.5:5);h.state='SEARCHING';h.target=p.id;h.search={rid:p.id,started:w.eng.now-1,goal:null,phase:'pause',legs:1,visited:[],why:'lost',until:w.eng.now+20,maxLegs:5,pause:0,exitsTried:[]};h.act='sniff';h.speed=0;
  const ux=h.x-r.lkx,uy=h.y-r.lky,ul=Math.hypot(ux,uy)||1,sx=far?h.x+ux/ul*1100:p.x,sy=far?h.y+uy/ul*1100:p.y;   // far: on the other side of the Hound from where the prey was
  if(far){r.heardAt=w.eng.now-.05;r.hx=r.lkx;r.hy=r.lky;}      // far: the prey was heard where it was lost a moment ago - a sound 1100 px the other way cannot be it
  w.eng.sound({x:sx,y:sy,r:1800,I:1,type:'run',src,st:2});h.thinkT=0;w.step();assert(h.hear && h.hear.t>w.eng.now-.2);assert(Math.hypot(h.hear.x-sx,h.hear.y-sy)>0);return {h,r,w,p};};
 let {h,r,w,p}=run(undefined,false);
 const pid=p.id;({h,r,w,p}=run(pid,false));assert.equal(h.hear.attribution,'inferred');assert.equal(h.hear.pid,p.id);assert(r.heardAt>=w.eng.now-.2);assert.equal(h.state,'HUNTING');
 const a=run(0,false);assert.equal(a.h.hear.attribution,'inferred');assert.equal(a.h.state,'HUNTING');                                       // no source id at all: the same inference
 const b=run(pid,true);assert.equal(b.h.hear.attribution,'anonymous');assert.equal(b.h.hear.pid,null);assert(b.r.heardAt<b.w.eng.now-.01);assert(['CURIOUS','ALERT'].includes(b.h.state));   // does not fit: anonymous, 2F
 return `fits the lost prey: ${h.hear.attribution}, ${h.state}; without a source id: ${a.h.hear.attribution}, ${a.h.state}; 1100 px the other way from where the prey was heard 0.05 s ago: ${b.h.hear.attribution}, ${b.h.state}`;
});
add('2E H8 silent hidden reposition does not cause magical following',()=>hiddenPair(true));
add('2E H9 nearby noisy hiding is exposed through real movement footsteps',()=>{
 const c=corner(),w=World(52),h=still(w,c.bx,c.by,c.ba),p=w.player(h.x+Math.cos(h.ang)*220,h.y+Math.sin(h.ang)*220);w.run(.25);assert(h.mem.p.get(p.id)?.seen);p.stop();p.light=false;p.x=c.px;p.y=c.py;assert(!w.eng.geo.los(h.x,h.y,p.x,p.y));const broke=w.eng.now;p.go(c.px-Math.cos(c.pa)*240,c.py-Math.sin(c.pa)*240,'run');let heard=false,reacted=false;w.run(4,()=>{const r=h.mem.p.get(p.id);heard ||= h.mem.sounds.some(q=>q.t>broke&&q.type==='run');reacted ||= ['CURIOUS','ALERT','SEARCHING','HUNTING'].includes(h.state)&&heard;});assert(heard&&reacted);
});
add('2E H10 failed search reduces confidence and ends within finite budget',()=>{
 const w=World(61),h=still(w,5000,LY),p=w.player(5400,LY);w.run(.25);const r=h.mem.p.get(p.id);assert(r?.seen);const start=r.conf;p.x=900;p.y=600;p.light=false;p.stop();let search=false,gaveUp=false,failed=false;
 w.run(70,()=>{search ||= h.state==='SEARCHING';failed ||= !!h.search?.visited.length;gaveUp ||= search&&['ROAMING','DORMANT'].includes(h.state);});assert(search&&gaveUp);assert(failed);assert(r.conf<start&&r.conf<.2);assert(!h.target);
});
add('2E H11 stable multiplayer target, then meaningful switch after loss and dwell',()=>{
 const w=World(72),h=still(w,5000,LY),a=w.player(5390,LY),b=w.player(5470,LY);w.run(.25);assert.equal(h.target,a.id);let switches=0,last=h.target;
 w.run(2.8,()=>{a.x=h.x+390;a.y=h.y;b.x=h.x+250;b.y=h.y+45;h.ang=0;if(h.target!==last){switches++;last=h.target;}});assert.equal(switches,0);assert.equal(h.target,a.id);
 a.x=900;a.y=600;a.light=false;w.run(.7,()=>{b.x=h.x+250;b.y=h.y;h.ang=0;});assert.equal(h.target,b.id);assert(/lost.*identified/.test(h.dbg.retarget));
});
add('2E H12 listening is watchdog-safe; blocked movement still recovers',()=>{
 const w=World(81),h=still(w,5000,LY);w.player(900,600,{light:false});h.act='listen';h.roam.listenFor=100;h.roam.nextListen=1e9;w.run(18);assert.equal(h.unstuck||0,0);h.sp={...h.sp,tick(){h.act='';h.state='ROAMING';}};w.run(13);assert((h.unstuck||0)>0);
});
add('2E H13 long-run finite states, valid targets, bounded memory and collision',()=>{
 let ticks=0,searches=0,maxStuck=0;for(const seed of [91,92,93]){const w=World(seed),hs=[w.hound(4200,LY),w.hound(6400,LY)],ps=[w.player(5000,LY),w.player(7000,LY,{light:false})];const stillT=new Map();
 w.run(120,()=>{ticks++;for(const p of ps)if(p.dead){w.sim.respawn(p);p.safe=0;p.x=5000+(p.id-100)*1800;p.y=LY;}for(const p of ps)if(Math.floor(w.t*60)%600===0){p.go(p.x<5700?8100:3500,LY,w.t%30<15?'run':'crouch');p.light=!p.light;}
 for(const h of hs){assert([h.x,h.y,h.ang,h.speed].every(Number.isFinite));assert(AI.S[h.state]);assert(!h.target||h.mem.p.has(h.target));if(!h.trav)assert(w.eng.geo.clear(h.x,h.y,12,h.mode||'walk'), JSON.stringify({t:w.t,id:h.id,x:h.x,y:h.y,mode:h.mode,state:h.state}));assert(h.mem.leads.length<=6&&h.mem.sounds.length<=8&&h.mem.p.size<=ps.length&&(h.hChecked||[]).length<=6);for(const r of h.mem.p.values()){assert(r.ev.length<=4);assert(r.conf>=0&&r.conf<=1);}if(h.state==='SEARCHING'){searches++;assert(h.search.visited.length<=h.search.maxLegs+2);}else if(h.hLight)searches++;
 const old=stillT.get(h)||{x:h.x,y:h.y,t:w.t};if(!stillT.has(h)||Math.hypot(h.x-old.x,h.y-old.y)>30||['listen','freeze','sniff','rest','feed'].includes(h.act)||!['HUNTING','SEARCHING','ROAMING'].includes(h.state))stillT.set(h,{x:h.x,y:h.y,t:w.t});else maxStuck=Math.max(maxStuck,w.t-old.t);
 }});}assert(searches>0);assert(maxStuck<25, 'active stationary interval '+maxStuck);return `${ticks} ticks; ${searches} search samples; longest stationary active interval ${maxStuck.toFixed(2)}s`;
});
add('2E/HQA H14 eye contact delays pre-pursuit commitment but never suppresses an already committed chase',()=>{
 const w=World(101),h=still(w,5000,LY),p=w.player(5450,LY,{angle:Math.PI});
 w.run(.45);assert.equal(h.state,'STALKING');assert.equal(h.act,'stare');assert(h.hEye&&h.hEye.used>0);const budget=1.15+h.tr.CAUTION*.9;
 const took=w.until(3,()=>h.state==='HUNTING');assert(took>0&&took<2.5);assert(h.hEye.used>=budget-.03);assert.notEqual(h.act,'stare');
 const d0=Math.hypot(p.x-h.x,p.y-h.y),used=h.hEye.used;p.angle=Math.atan2(h.y-p.y,h.x-p.x);w.run(.22);
 assert.equal(h.state,'HUNTING');assert(!['stare','freeze'].includes(h.act));assert.equal(h.hEye.used,used);assert(Math.hypot(p.x-h.x,p.y-h.y)<d0);
});
add('2E H15 flashlight off stops new light observations without deleting an identified human',()=>{
 const w=World(114),h=still(w,5000,LY),p=w.player(5420,LY);w.run(.3);const r=h.mem.p.get(p.id);assert(r?.hv);const t=r.hv.t;p.light=false;w.run(.35);assert.equal(h.target,p.id);assert(r.conf>.8);assert(r.hv.t>=t);assert(!r.light);assert.equal(h.state,'HUNTING');
});
add('2E H16 bounded deterministic traits; private HP and inventory cannot change decisions',()=>{
 function run(seed,secret){const w=World(seed),h=still(w,5000,LY),a=w.player(5400,LY),b=w.player(5600,LY),tr=[];a.hp=secret?1:100;b.hp=secret?100:1;a.inventory=secret?['powerbulb']:[];b.accountId=secret?'A':'B';w.run(2,()=>tr.push(trace(h)));return {traits:h.tr,tr};}
 for(const seed of [121,122,123,124]){const a=run(seed,false),b=run(seed,true);assert.deepEqual(a,b);for(const v of Object.values(a.traits))assert(v>=.02&&v<=.98);}
 assert.notDeepEqual(run(121,false).traits,run(122,false).traits);
});
add('2E H17 social sound carries no prey identity or shared memory',()=>{
 const w=World(131),h=still(w,5000,LY),other=still(w,1200,1000),p=w.player(5400,LY);w.run(.3);assert.equal(h.target,p.id);assert(h.mem.p.has(p.id));assert(!other.mem.p.has(p.id));
 // An audible growl from the first Hound, represented through the existing sound bus.
 w.eng.sound({type:'growl',x:other.x+150,y:other.y,r:600,I:.9,src:-h.id});w.run(.3);assert(other.hear?.type==='growl');assert(!other.mem.p.has(p.id));assert(!other.target);assert.notEqual(other.mem,h.mem);
});

add('2E/HQA H18 close-range walking orbit is not an indefinite safe zone',()=>{
 const times=[];
 for(const seed of [211,212,213,214,215,216]){
  const w=World(seed),R=105,h=still(w,5000,LY),p=w.player(5000+R,LY,{light:false,angle:0});p.look=0;w.run(.35);assert.equal(h.state,'HUNTING');
  let caught=-1;w.run(4,(ww,t)=>{if(p.dead||p.caught){caught=t;return false;}const dx=p.x-h.x,dy=p.y-h.y,a=Math.atan2(dy,dx)+.45;p.go(h.x+Math.cos(a)*R,h.y+Math.sin(a)*R,'walk');p.look=a;});
  assert(caught>=0,`seed ${seed}: player orbited for full window`);times.push(caught);
 }
 assert(Math.max(...times)<3.5,`slowest capture ${Math.max(...times).toFixed(2)}s`);return `six walking close-orbits all caught; ${times.map(t=>t.toFixed(2)).join(', ')} s`;
});
module.exports=S;
