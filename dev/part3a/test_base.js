'use strict';
const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),G=require('../../world_geometry'),V=require('../../world_view'),L=require('../../levels/level0'),W=require('../../world'),M=require('../../world_motion'),{build}=require('../../levels/level0_spatial');
const a=build(),b=build();assert.deepStrictEqual(a,b);assert.equal(a.contentHash,G.contentHash(a));
const g=G.compile(a),v=V.compile(a),flat=G.compile(L,W).flat;
assert(a.solids.length>64);assert.equal(v.solids.length,a.solids.length);assert.equal(a.lights.length,90);assert.deepEqual(a.lights.map(l=>l.id),L.flat.lampIds);
assert.deepEqual(a.production.rooms,L.flat.rooms);assert.equal(a.bounds.max.x,9216);assert.equal(a.bounds.max.y,6912);
const reversed=JSON.parse(JSON.stringify(a));reversed.solids.reverse();assert.deepEqual(V.compile(reversed),v);
let floorCells=0;for(let y=0;y<72;y++)for(let x=0;x<96;x++)if(flat.kc[y*96+x]){const p={x:(x+.5)*96,y:(y+.5)*96,z:0};assert(a.supportPatches.some(s=>s.plane.c===0&&s.polygon.every((v,i)=>{const q=s.polygon[(i+1)%s.polygon.length];return (q.x-v.x)*(p.y-v.y)-(q.y-v.y)*(p.x-v.x)>=0;})),'source floor '+x+','+y);if(flat.sl(p.x,p.y))assert(g.supports({radius:1,height:1},p,[-.001,.001]).length,'walkable source floor '+x+','+y);floorCells++;}
const spawn=a.anchors.find(a=>a.kind==='spawn');assert(g.clearance(M.PROFILES.stand,spawn.position).fits);assert(Math.hypot(spawn.position.x-flat.Ic.x,spawn.position.y-flat.Ic.y)<=48);
let rays=0,blockedAfter64=0;for(const lamp of a.lights){const from={...lamp.position,z:50},to={x:from.x+150,y:from.y+75,z:50};const cpu=g.raycast(from,to,'visible'),view=V.visible(v,from,to);if(cpu&&cpu.t<.999){assert(!view);if(v.solids.findIndex(s=>s.id===cpu.primitiveId)>64)blockedAfter64++;}rays++;}
// An adversarial late-sorted wall must block even when it lies beyond the old batch.
const wall=v.solids.find(s=>s.id.startsWith('solid:wall')&&s.index>64&&s.min.x>100&&s.max.x<9000);const mid={x:(wall.min.x+wall.max.x)/2,y:(wall.min.y+wall.max.y)/2,z:80};assert(!V.visible(v,{...mid,x:wall.min.x-10},{...mid,x:wall.max.x+10}));
const out={status:'PASS',revision:a.geometryRevision,hash:a.contentHash,serializedSha256:crypto.createHash('sha256').update(JSON.stringify(a,null,2)+'\n').digest('hex'),repeatedBuilds:2,floorCells,rooms:a.production.rooms.length,props:a.production.props.length,lamps:a.lights.length,solids:a.solids.length,patches:a.supportPatches.length,spaces:a.spaces.length,chunks:Object.keys(v.chunks).length,permutedInputIdentical:true,rayComparisons:rays,lateBatchWall:wall.id,spawn};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
