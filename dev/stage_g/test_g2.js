'use strict';
const assert=require('assert'),{G,world,box,DP,context,valid}=require('./fixtures');
const ledge=()=>world([box('lower',-1200,-1200,3000,3000,-20,0),box('upper',200,200,450,150,104,120)]);
const g=G.compile(ledge()),S=DP.create(context(g,'Hound','A',{victim:{x:300,y:322,z:120,angle:0}}));
let released=null,fallingGear=false;
for(let i=0;i<600;i++){DP.tick(S);valid(S);released||=S.physicalEvents.find(e=>e.type==='release'&&e.object==='light');if(!S.eq.held&&S.eq.z<100)fallingGear=true;for(const h of S.h)if(h.brace)assert(h.supportId&&Math.abs(h.z-h.brace.z)<10);}
assert(released);assert(fallingGear);assert.equal(S.b.supportId,'support:upper');assert.equal(S.eq.supportId,'support:lower');assert(S.eq.sleeping);
const snap=DP.snapshot(S);assert.equal(snap.beam.object,'light');assert.equal(snap.beam.support,'support:lower');assert(Math.abs(snap.beam.origin.z-S.eq.z)<.001);assert(S.decals.length>0);
for(const d of S.decals){assert.equal(d.primitiveId,'solid:upper');assert.equal(d.support,'support:upper');const r={...d.origin};for(const k of ['x','y','z'])r[k]+=d.basis.u[k]*d.local.u+d.basis.v[k]*d.local.v;assert(Math.hypot(r.x-d.point.x,r.y-d.point.y,r.z-d.point.z)<1e-8);}
console.log('PASS Z28 body stays on upper, independent released light lands below; beam follows light; decals bind exactly one face',JSON.stringify({body:snap.body,light:snap.light,beam:snap.beam,release:released}));
// Almost no overlap, including the symmetric thin-support case: a passive mass
// must leave unstable contact rather than satisfy XY-only rest forever.
for(const dx of [-.001,.001]){
 const U=DP.create(context(g,'Smiler','B',{victim:{x:668+dx,y:300,z:120,angle:0},src:{x:710,y:300,z:120}}));
 for(let i=0;i<480;i++){DP.tick(U);valid(U);}
 assert(U.b.z<1);assert.equal(U.b.supportId,'support:lower');
}
const narrow=G.compile(world([box('lower',-500,-500,1500,1500,-20,0),box('needle',299.99,100,.02,500,100,120)]));
const N=DP.create(context(narrow,'Smiler','B',{victim:{x:300,y:300,z:120,angle:0}}));
for(let i=0;i<480;i++){DP.tick(N);valid(N);}assert(N.b.z<1);
console.log('PASS ledge tolerance both sides and tiny symmetric support do not hold a corpse');
const fall=DP.create(context(g,'Hound','A',{victim:{x:450,y:270,z:120,angle:0,vx:1100}}));
let lost=false,emptyBrace=false;
for(let i=0;i<600;i++){DP.tick(fall);valid(fall);if(!fall.b.supportId)lost=true;for(const h of fall.h)if(h.brace&&!h.supportId)emptyBrace=true;}
assert(lost);assert(!emptyBrace);assert.equal(fall.b.supportId,'support:lower');
const trail=fall.spatialTrail;assert(trail.some(p=>p.support==='support:upper'),'upper trail');assert(trail.some(p=>p.support==='support:lower'),'lower trail');assert(new Set(trail.map(p=>p.segment)).size>=2,'air gap breaks trail');
console.log('PASS trail breaks during flight and resumes on contacted lower surface',JSON.stringify(trail.map(p=>({segment:p.segment,support:p.support,z:p.point.z}))));
console.log('G2 PASS');
