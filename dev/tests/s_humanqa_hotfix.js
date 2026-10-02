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

module.exports=S;
