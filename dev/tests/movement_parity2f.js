/* Direct real move.js trace parity; browser rendering/input latency are not simulated. */
'use strict';
const assert=require('assert'),path=require('path');if(!process.argv[2])throw Error('Provide extracted 2E baseline');const roots=[path.resolve(process.argv[2]),require('../paths')];
function run(root,mode){const {World,WORLD}=require(root+'/dev/harness'),{makeMover}=require(root+'/dev/move_model');const w=World(1),m=makeMover(w.sim,WORLD,()=>0),H=m.H;let x=4000,y=3504,ix=1,iy=0;
 if(mode==='deep'){let found;for(let yy=96;yy<6800&&!found;yy+=48)for(let xx=96;xx<9100;xx+=48)if(WORLD.surfaceAt(xx,yy,w.ad.rooms)==='deep'&&w.ad.clear(xx,yy,16,'walk')){found={x:xx,y:yy};break;}assert(found);({x,y}=found);}
 if(mode==='vault'){const r=WORLD.PROPS.find(p=>p.id==='L1').rect;x=r.x+r.w/2;y=r.y-120;ix=0;iy=1;}
 if(mode==='crawl'){const r=WORLD.CRAWL.find(p=>p.type!=='gap');x=r.exits[0].x;y=r.exits[0].y;ix=r.exits[1].x-x;iy=r.exits[1].y-y;}
 H.x=x;H.y=y;if(mode==='recovery'){H.stamina=0;H.exhausted=true;ix=iy=0;}
 const out=[];for(let n=0;n<600;n++){m.step(ix,iy,['sprint','slide','deep','vault'].includes(mode),mode==='crouch'||mode==='crawl',1/60,mode==='slide'&&n===60);out.push([H.x,H.y,H.vx,H.vy,H.stamina,H.exhausted,m.mv.s]);}
 assert.equal(WORLD.MOVE.radius,15);assert.equal(WORLD.MOVE.recoverAt,36);if(mode==='recovery'){const i=out.findIndex(q=>!q[5]);assert(i>0);assert(out[i][4]>=36&&out[i-1][4]>=36&&out[i-2][4]<36);}return out;}
let total=0;for(const m of ['walk','sprint','crouch','crawl','slide','vault','deep','recovery']){const a=run(roots[0],m),b=run(roots[1],m);assert.deepStrictEqual(a,b);console.log(`PASS ${m}: ${a.length} identical real move.js ticks`);total+=a.length;}console.log(`${total} movement trace pairs identical; radius 15; recovery threshold 36`);
