'use strict';
const assert=require('assert'),{G,M,world,box,clone}=require('../stage_c/helpers');
const rows=[];
function transform(p,turn,mirror){let x=(p.x-250)*(mirror?-1:1),y=p.y-250;for(let i=0;i<turn;i++)[x,y]=[-y,x];return {...p,x:x+250,y:y+250};}
const d=world([box('floor',0,0,500,500,-20,0),box('wall',200,0,20,500,0,120,true)]);
let baseline;
for(const mirror of [false,true])for(let turn=0;turn<4;turn++){
 const def=clone(d);for(const s of def.solids){s.footprint=s.footprint.map(p=>transform(p,turn,mirror));if(mirror)s.footprint.reverse();}for(const s of def.supportPatches){s.polygon=s.polygon.map(p=>transform(p,turn,mirror));if(mirror)s.polygon.reverse();}
 const g=G.compile(def),m=M.create(g),b=m.initialize(transform({x:150,y:100,z:0},turn,mirror)),v=transform({x:350,y:250},turn,mirror),trace=[];
 for(let tick=0;tick<60;tick++){b.vx=v.x-250;b.vy=v.y-250;m.step(b);assert(g.clearance(b.shape,b).fits);trace.push({x:b.x,y:b.y,z:b.z,support:b.supportId});}
 if(!mirror&&turn===0)baseline=trace;
 for(let tick=0;tick<60;tick++){const expected=transform(baseline[tick],turn,mirror);assert(Math.hypot(trace[tick].x-expected.x,trace[tick].y-expected.y,trace[tick].z-expected.z)<1e-6,JSON.stringify({seed:0,world:g.identity,turn,mirror,firstDivergentTick:tick}));assert.equal(trace[tick].support,expected.support);}
 rows.push({property:'rotate/mirror physical collision',turn,mirror,world:g.identity,ticks:60});
}
const g=G.compile(d);assert(g.clearance(M.PROFILES.stand,{x:184.8,y:100,z:0}).fits);assert(!g.clearance(M.PROFILES.stand,{x:185.2,y:100,z:0}).fits);
const roof=G.compile(world([box('roof',0,0,500,500,70,85,true)]));assert(roof.clearance(M.PROFILES.stand,{x:100,y:100,z:9.8}).fits);assert(!roof.clearance(M.PROFILES.stand,{x:100,y:100,z:10.2}).fits);
const edge=G.compile(world([box('ledge',0,0,200,200,-20,0)]));assert(edge.supports(M.PROFILES.stand,{x:214.99,y:100,z:0},[-.1,.1]).length);assert.equal(edge.supports(M.PROFILES.stand,{x:215.01,y:100,z:0},[-.1,.1]).length,0);
rows.push({property:'ledge/roof/contact immediately inside and outside boundaries',samples:6});
const long=world([box('long',0,0,20000,400,-20,0)]);long.bounds.max.x=21000;const lg=G.compile(long),m=M.create(lg),b=m.initialize({x:100,y:100,z:0});b.vx=20000;m.step(b);assert(b.diagnostics.some(d=>d.code==='GROUND_SEGMENT_LIMIT'));assert(lg.clearance(b.shape,b).fits);assert(b.x<100+20000/60);assert.equal(b.vx,0);rows.push({property:'actual maximum iteration budget safe diagnostic',diagnostics:b.diagnostics,pose:{x:b.x,y:b.y,z:b.z},bounds:M.POLICY});
console.log(JSON.stringify({status:'PASS',runtime:process.version,seed:0,firstDivergentTick:null,rows},null,2));
