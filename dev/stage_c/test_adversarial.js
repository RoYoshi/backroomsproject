'use strict';
const assert=require('assert'),{G,M,clone,world,box,fixture}=require('./helpers');
const shape=M.PROFILES.stand;let checks=0;
// Cross-product sign at adjacent vertices alone incorrectly accepts a pentagram.
const star=box('star',0,0,10,10,0,10);star.footprint=[0,2,4,1,3].map(i=>({x:100+50*Math.cos(i*2*Math.PI/5),y:100+50*Math.sin(i*2*Math.PI/5)}));
assert.throws(()=>G.compile(world([star])),/polygon/);checks++;
const a=box('a',0,0,100,100,0,10),b=clone(a);b.id='solid:b';b.footprint.push(b.footprint.shift());assert.throws(()=>G.compile(world([a,b])),/duplicate solid/);checks++;
const g=G.compile(fixture);assert.throws(()=>g.sweep(shape,{x:1e308,y:0,z:0},{x:1e308,y:0,z:0}),/coordinate/);checks++;
// Independent analytical floor TOI controls: varying speed, height, radius and thickness.
for(let i=1;i<=48;i++){
 const top=-90+i*3,thickness=.01+(i%7),floor=G.compile(world([box('floor',0,0,400,400,top-thickness,top)])),start={x:100+i,y:140,z:top+10+i},delta={x:0,y:0,z:-(100+i*30)},s={radius:1+i/3,height:1+i};
 const hit=floor.sweep(s,start,delta);assert(hit);assert(Math.abs(hit.t-(start.z-top-.05)/-delta.z)<1e-6);assert.equal(hit.primitiveId,'solid:floor');checks++;
}
// Finite corner: line passes within radius of a corner although both ends are clear.
const corner=G.compile(world([box('wall',100,100,20,20,0,100,true)]));
assert(corner.clearance(shape,{x:60,y:90,z:0}).fits);assert(corner.clearance(shape,{x:160,y:90,z:0}).fits);
const hit=corner.sweep(shape,{x:60,y:90,z:0},{x:100,y:0,z:0});assert(hit&&hit.t>0&&hit.t<1);checks++;
// Genuine small gap must become airborne rather than being bridged by support IDs.
const gap=G.compile(world([box('left',0,0,150,200,-10,0),box('right',182,0,180,200,-10,0)])),m=M.create(gap),body=m.initialize({x:120,y:100,z:0});let air=false;
for(let i=0;i<80;i++){body.vx=100;m.step(body);air ||=body.motionMode==='airborne';assert(gap.clearance(body.shape,body).fits);}assert(air);checks++;
// Repeated diagonal wall contact must stay out of solid and make tangential progress.
const wall=G.compile(world([box('floor',0,0,500,500,-10,0),box('wall',200,0,10,500,0,150,true)])),wm=M.create(wall),wb=wm.initialize({x:180,y:100,z:0});
for(let i=0;i<60;i++){wb.vx=100;wb.vy=100;wm.step(wb);assert(wall.clearance(wb.shape,wb).fits);}assert(wb.x<185.1&&wb.y>195);assert.equal(wb.diagnostics.length,0);checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'Independent TOI controls, invalid shape counterexamples, finite corners, real gaps and tangent motion'},null,2));
