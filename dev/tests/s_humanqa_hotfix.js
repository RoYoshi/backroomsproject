/* Human-QA hotfix acceptance checks. These are intentionally separate from the locked 2F preservation hash test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),createSim=require(path.join(ROOT,'sim.js'));
const {World,geo}=require('./lib.js');
const S=[],add=(name,fn)=>S.push({name,fn:()=>({ok:true,note:fn()||'assertions passed'})});

add('HQA X01 admin stress ceiling is truly reachable without changing normal director cap',()=>{
  const one=kind=>{const sim=createSim({seed:123,director:false});sim.engine.clear();let n=0;for(let i=0;i<70;i++)if(kind==='hound'?sim.admin.addHound():sim.admin.addSmiler())n++;const inf=sim.admin.info();assert.equal(n,64);assert.equal(inf.mh,64);assert.equal(inf.ms,64);assert.equal(inf.dh,3);return n;};
  const h=one('hound'),s=one('smiler');
  const mix=createSim({seed:456,director:false});mix.engine.clear();for(let i=0;i<64;i++)assert(mix.admin.addHound());for(let i=0;i<64;i++)assert(mix.admin.addSmiler());const inf=mix.admin.info();assert.equal(inf.hn,64);assert.equal(inf.sn,64);
  return `${h} Hounds and ${s} Smilers individually; mixed world reaches 128 entities; normal director cap remains ${inf.dh}`;
});

add('HQA X02 client/network presentation has 64 slots for each species and batch stress controls',()=>{
  const mp=fs.readFileSync(path.join(ROOT,'mp.js'),'utf8'),bundle=fs.readFileSync(path.join(ROOT,'assets/index-DKbV5Nv9.js'),'utf8'),server=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
  assert(mp.includes('const CLIENT_ENTITY_SLOTS = 64'));
  assert(bundle.includes('hv=Array.from({length:64},()=>new Wl)'));
  assert(bundle.includes('for(let e=Ll.length;e<64;e++)Ll.push({...Ll[e%5]})'));
  assert(mp.includes("data-n=\"10\""));
  assert(server.includes('Math.max(1, Math.min(10, m.n | 0 || 1))'));
  return '64 Hound render slots, 64 Smiler render slots, +10 admin batching wired';
});

add('HQA X03 dead hover and switched-off physical-light QOL are present in shipped client',()=>{
  const mp=fs.readFileSync(path.join(ROOT,'mp.js'),'utf8'),bundle=fs.readFileSync(path.join(ROOT,'assets/index-DKbV5Nv9.js'),'utf8');
  assert(mp.includes("hover.o.d ? ' · DEAD' : ''"));
  assert(!mp.includes("hover.o.d ? ' · DOWN' : ''"));
  assert(bundle.includes('if(e&&!f.nv){_(0,Math.PI*2,this.death.active?150:52,this.death.active?.73:.35)'));
  assert(bundle.includes('if(p.dead||!p.on||f.nv)continue;_(0,Math.PI*2,52,.35)'));
  assert(!bundle.includes('if(p.dead)continue;_(0,Math.PI*2,52,.35)'));
  return 'dead peers read DEAD; local/peer 52 px equipment aura exists only while visible light is ON';
});


add('HQA X04 visible light still beats Smiler gaze after the pressure fix',()=>{
  function pair(i){const G=geo(),g=G.g;for(let k=0;k<400;k++){const p=G.dark[(i*131+k*17)%G.dark.length];if(!p||!G.ad.clear(p.x,p.y,24,'walk'))continue;const cand=G.dark.filter(c=>{const d=Math.hypot(c.x-p.x,c.y-p.y);return d>=350&&d<=600&&g.los(c.x,c.y,p.x,p.y)&&G.ad.clear(c.x,c.y,24,'walk');});if(cand.length)return {p,s:cand[(i*7)%cand.length]};}return null;}
  let chased=0,n=0;
  for(let i=1;i<=8;i++){const q=pair(i);if(!q)continue;n++;const w=World(i+1000);w.sim.admin.blackout('on');w.sim.debug.V.blackout=true;const p=w.player(q.p.x,q.p.y,{light:true});p.stop('stand');const sm=w.smiler(q.s.x,q.s.y);sm.ang=Math.atan2(q.p.y-q.s.y,q.p.x-q.s.x);p.look=()=>Math.atan2(sm.y-p.y,sm.x-p.x);let hit=false;w.run(15,()=>{if(sm.state==='PROVOKED'){hit=true;return false;}});if(hit)chased++;}
  assert(n>=6);assert(chased/n>=.75,`visible-light chase while gazed only ${chased}/${n}`);
  return `visible light still overcame sustained gaze in ${chased}/${n} seeded encounters`;
});


add('HQA X05 lost-target search uses observed heading before unrelated reversal and ignores hidden truth',()=>{
  const {geo,World}=require('./lib.js'),G=geo(),g=G.g;
  let spot=null,hd=0;
  outer: for(const c of G.cells){
    const q={x:g.cx(c),y:g.cy(c)}; if(!G.ad.clear(q.x,q.y,28,'walk'))continue;
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;if(g.ray(q.x,q.y,a,520)>430&&g.ray(q.x,q.y,a+Math.PI,520)>430){spot=q;hd=a;break outer;}}
  }
  assert(spot,'need an open search fixture with forward and reverse routes');
  function run(hiddenX,hiddenY){
    const w=World(901),h=w.hound(spot.x,spot.y),p=w.player(spot.x+80,spot.y,{light:false});
    w.run(.1);let r=h.mem.p.get(p.id);if(!r){r={id:p.id,aw:1,seen:false,seenAt:w.eng.now-.15,heardAt:-99,lkx:spot.x,lky:spot.y,lvx:Math.cos(hd)*210,lvy:Math.sin(hd)*210,conf:1,hx:0,hy:0,st:2,stamina:100,ex:0,prof:1,light:false,iso:0,first:w.eng.now-.2,lost:0,hLoud:-99,hvx:0,hvy:0,crawl:null,crawlAt:-99,ev:[],downAt:-99,heldAt:-99};h.mem.p.set(p.id,r);}
    Object.assign(r,{seen:false,seenAt:w.eng.now-.15,heardAt:-99,lkx:spot.x,lky:spot.y,lvx:Math.cos(hd)*210,lvy:Math.sin(hd)*210,conf:1,hLoud:-99,crawl:null});
    p.x=hiddenX;p.y=hiddenY;p.light=false;p.stop('crouch');
    h.x=spot.x;h.y=spot.y;h.ang=hd;h.speed=0;h.target=p.id;h.state='SEARCHING';h.act='sniff';h.actT=2;
    h.search={rid:p.id,started:w.eng.now-.2,goal:null,phase:'pause',legs:0,visited:[],why:'lost',until:w.eng.now+20,maxLegs:6,pause:2,first:false,exitsTried:[],routeStage:0,lookAng:hd,lkp:{x:spot.x,y:spot.y},hd,sp:210};
    let goal=null;
    w.run(.6,()=>{if(h.search?.goal?.k==='continue'){goal={...h.search.goal};return false;}});
    assert(goal,'search should choose a continuation hypothesis');
    assert(Math.cos(goal.a-hd)>=-.21,`fresh search reversed immediately: hd=${hd} goal=${goal.a}`);
    return [Math.round(goal.x),Math.round(goal.y),+goal.a.toFixed(4)];
  }
  const a=run(400,400),b=run(8800,6400);
  assert.deepEqual(a,b,'hidden player coordinates changed the search hypothesis');
  return `first branch stayed in observed forward/side hemisphere at ${a.join(',')} and was identical across hidden positions`;
});


add('HQA X06 Hound reassessment looks immediately and resumes search within a short bounded beat',()=>{
  const {geo,World}=require('./lib.js'),G=geo(),g=G.g;
  let spot=null;
  for(const c of G.cells){const x=g.cx(c),y=g.cy(c);if(G.ad.clear(x,y,28,'walk')&&g.ray(x,y,.62,520)>360){spot={x,y};break;}}
  assert(spot,'need open search fixture');
  const w=World(1206),h=w.hound(spot.x,spot.y),p=w.player(8800,6400,{light:false}),hd=.62;p.stop('crouch');
  h.ang=0;h.speed=0;h.target=p.id;h.state='SEARCHING';h.act='sniff';h.actT=0;
  h.mem.p.set(p.id,{id:p.id,aw:1,seen:false,seenAt:w.eng.now-9,heardAt:-99,lkx:spot.x,lky:spot.y,lvx:Math.cos(hd)*180,lvy:Math.sin(hd)*180,conf:.8,hx:0,hy:0,st:2,stamina:100,ex:0,prof:1,light:false,iso:0,first:w.eng.now-10,lost:0,hLoud:-99,hvx:0,hvy:0,crawl:null,crawlAt:-99,ev:[],downAt:-99,heldAt:-99});
  h.search={rid:p.id,started:w.eng.now-9,goal:null,phase:'pause',legs:0,visited:[],why:'lost',until:w.eng.now+20,maxLegs:6,pause:0,first:false,exitsTried:[],routeStage:0,lookAng:hd,lkp:{x:spot.x,y:spot.y},hd,sp:180};
  const first=h.sp.snap(h);assert(Math.abs(first.lh-hd)<.04,`visual head did not immediately favor hypothesis: ${first.lh} vs ${hd}`);
  for(let i=0;i<45;i++){const dt=1/60;w.eng.now+=dt;h.t+=dt;h.stateT+=dt;h.actT+=dt;h.sp.tick(w.eng,h,dt,false);}
  assert(h.search && h.search.phase==='go',`reassessment still paused after 0.75s: ${h.search&&h.search.phase}`);
  assert(h.search.goal,'reassessment did not select a next hypothesis');
  const ents=fs.readFileSync(path.join(ROOT,'dev/ents_src/10_hound.js'),'utf8');
  assert(ents.includes("P.hr = look * .82"),'sniff presentation is not visually anchored to the hypothesis');
  return `head favored ${hd.toFixed(2)} rad immediately; search resumed with ${h.search.goal.k} by 0.75s`;
});

module.exports=S;
