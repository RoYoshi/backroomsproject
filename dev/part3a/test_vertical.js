'use strict';
const assert=require('assert'),fs=require('fs'),G=require('../../world_geometry'),M=require('../../world_motion'),L=require('../../levels/level0'),{build}=require('../../levels/level0_spatial');
const out=process.argv[2],d=build(),g=G.compile(d),checks=[],traces=[];
const save=()=>{if(out)fs.writeFileSync(out,JSON.stringify({status:checks.every(c=>c.ok)?'PASS':'FAIL',hash:d.contentHash,checks,traces},null,2)+'\n');};
for(const link of d.traversalLinks)for(const [name,p]of [['player',M.PROFILES.stand],...Object.entries(M.ENTITY_PROFILES)]){
 if(!link.profileIds.includes(p.id))continue;const profile=link.kind==='crawl'?{...p,height:24,eyeHeight:18}:p;
 const r=M.proveTraversal(g,link,profile,{record:true});checks.push({id:link.id,profile:name,ok:r.ok,reason:r.reason,ticks:r.ticks,distance:r.distance,maxDelta:r.maxDelta,finalPose:r.finalPose});traces.push({id:link.id,profile:name,...r});save();
}
assert(checks.every(c=>c.ok),'Every permitted route executes physically');
const crawl={x:1776,y:864,z:0};assert(g.clearance(M.PROFILES.crawl,crawl).fits);assert(!g.clearance(M.PROFILES.stand,crawl).fits);assert(!g.clearance(M.ENTITY_PROFILES.smiler,crawl).fits);
checks.push({id:'crawl-body-clearance',ok:true,clearance:28,smilerRejected:true});
const low={x:6192,y:864,z:50},high={...low,z:208};assert(g.raycast(low,high,'visible'));assert(g.raycast(low,high,'ir'));assert(g.raycast(low,high,'collision'));
assert(g.clearance(M.PROFILES.stand,{...low,z:0}).fits);assert(g.clearance(M.PROFILES.stand,{...low,z:180}).fits);
checks.push({id:'same-XY-two-supported-bodies-and-separating-slab',ok:true});
// Exercise interruption at the real first riser; never finish by writing an endpoint.
for(const vx of [0,100]){const m=M.create(g),b=m.initialize({x:5616,y:1512,z:0});let n=0;while(!b.step&&n++<80){b.vx=0;b.vy=-100;m.step(b);}assert(b.step);const before={...b};b.vx=vx;b.vy=vx?0:100;m.step(b);assert.equal(b.step,null);assert(Math.hypot(b.x-before.x,b.y-before.y,b.z-before.z)<3);assert(g.clearance(b.shape,b).fits);}
checks.push({id:'stair-interruption-reversal-sideways',ok:true});
// Walk off the actual lower rim and resolve gravity onto the -96 support.
{const m=M.create(g),b=m.initialize({x:936,y:5568,z:0});let air=false,lands=0;for(let i=0;i<170;i++){b.vx=-100;b.vy=0;m.step(b);air ||= b.motionMode==='airborne';lands+=b.events.filter(e=>e.type==='land').length;assert(g.clearance(b.shape,b).fits);}assert(air);assert.equal(lands,1);assert.equal(b.supportId,'support:lower:blackout');assert(Math.abs(b.z+96)<.06);checks.push({id:'lower-rim-real-fall-and-contact',ok:true,lands,pose:{x:b.x,y:b.y,z:b.z}});}
save();
// Independent stand-height base circulation flood through swept 48-unit edges.
const cols=192,rows=144,shape=M.PROFILES.stand,open=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),pose=i=>({x:(i%cols+.5)*48,y:(Math.floor(i/cols)+.5)*48,z:0});
for(let i=0;i<open.length;i++){const p=pose(i);if(g.clearance(shape,p).fits&&g.supports(shape,p,[-.001,.001]).some(s=>s.navSurfaceId==='nav:base'))open[i]=1;}
const spawn=d.anchors.find(a=>a.kind==='spawn').position,start=Math.floor(spawn.y/48)*cols+Math.floor(spawn.x/48);assert(open[start]);seen[start]=1;const queue=[start];
for(let n=0;n<queue.length;n++){const i=queue[n],p=pose(i);for(const j of [i-cols,i+cols,i-1,i+1]){if(j<0||j>=open.length||!open[j]||seen[j])continue;const q=pose(j);if(Math.abs(q.x-p.x)+Math.abs(q.y-p.y)>48)continue;const hit=g.sweep(shape,p,{x:q.x-p.x,y:q.y-p.y,z:0});if(hit&&hit.t<1-1e-6)continue;seen[j]=1;queue.push(j);}}
const rooms=L.flat.rooms.map(r=>({id:r.id,name:r.name,reachableCells:queue.filter(i=>{const p=pose(i);return p.x>r.x*96&&p.x<(r.x+r.w)*96&&p.y>r.y*96&&p.y<(r.y+r.h)*96;}).length}));
assert(rooms.every(r=>r.reachableCells>0),'All twelve rooms remain reachable on base support');checks.push({id:'base-circulation',ok:true,reachableCells:queue.length,rooms});
assert.equal(JSON.stringify(d),JSON.stringify(build()));checks.push({id:'vertical-content-reproducible',ok:true});save();
console.log(JSON.stringify({status:'PASS',checks:checks.length,physicalRoutes:traces.length,baseReachable:queue.length,rooms:rooms.length,hash:d.contentHash}));
