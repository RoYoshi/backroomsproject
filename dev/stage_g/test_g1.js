'use strict';
const assert=require('assert'),{G,world,box,DP,field,context,valid}=require('./fixtures');
const g=G.compile(field()),results=[];
for(const kind of ['Hound','Smiler'])for(const v of 'ABCD'){
 const S=DP.create(context(g,kind,v));
 for(let tick=0;tick<420;tick++){const before=S.stepN,sleeping=S.state==='SLEEPING';DP.tick(S);assert.equal(S.stepN,before+(sleeping?0:4));valid(S);}
 assert.equal(S.h.length,2);assert(S.h.every(h=>h.dampingRatio>0&&h.z>1));
 results.push({kind,v,substeps:S.stepN,state:S.state,z:S.b.z,hands:S.h.map(h=>h.z),gearZ:S.eq.z,diagnostics:[S.b,...S.h,S.at,S.eq,S.hat].flatMap(o=>o.diagnostics)});
}
console.log(JSON.stringify(results,null,2));
const mk=()=>DP.create(context(g,'Hound','B'));
const ref=mk();for(let i=0;i<360;i++)DP.tick(ref);
for(const fps of [30,60,120,144,240,360]){const S=mk();for(let frame=1;frame<=6*fps;frame++){DP.advance(S,frame/fps);DP.pose(S);}assert.deepEqual(JSON.parse(JSON.stringify(DP.snapshot(S))),JSON.parse(JSON.stringify(DP.snapshot(ref))));}
console.log('PASS deterministic identical reruns and 30/60/120/144/240/360 sampling; exact four substeps');
const slabs=G.compile(world([box('ground',-1000,-1000,3000,3000,-20,0),box('slab',-1000,-1000,3000,3000,160,162)]));
const falling=DP.create(context(slabs,'Smiler','B',{victim:{x:300,y:300,z:300,angle:0,vz:-900},src:{x:254,y:300,z:300}}));
for(let i=0;i<360;i++){DP.tick(falling);valid(falling);assert(falling.b.z>=162-1e-6);}
assert.equal(falling.b.supportId,'support:slab');
const below=DP.create(context(slabs,'Smiler','B',{victim:{x:300,y:300,z:40,angle:0,vz:650},src:{x:254,y:300,z:40}}));
let top=-Infinity;for(let i=0;i<360;i++){DP.tick(below);valid(below);top=Math.max(top,below.b.z);assert(below.b.z+18<=160+.1);}
assert(top>70);assert.equal(below.b.supportId,'support:ground');
console.log('PASS first thin slab wins and underside collision; no promotion to hidden upper support');
console.log('G1 PASS');
