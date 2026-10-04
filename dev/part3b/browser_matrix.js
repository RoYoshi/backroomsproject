'use strict';
// Full production world, actual two clients, retained physical/pixel assertions.
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open,diagnostics}=require('../stage_h/browser_support');
const V=require('../../world_view'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const cases=[
 {id:'16x9',w:1280,h:720,dpr:1,ui:1,q:1,zoom:1,nv:false},
 {id:'16x10',w:1280,h:800,dpr:1,ui:.5,q:1,zoom:1,nv:false},
 {id:'ultrawide',w:3440,h:1440,dpr:1,ui:1,q:1,zoom:1,nv:false},
 {id:'high-dpr',w:1280,h:720,dpr:2,ui:1.5,q:1,zoom:1,nv:false},
 {id:'4k',w:3840,h:2160,dpr:1,ui:2,q:1,zoom:1,nv:false},
 {id:'reduced',w:1280,h:720,dpr:1,ui:2,q:.5,zoom:1,nv:false},
 {id:'nv-low-zoom2',w:1280,h:800,dpr:1,ui:1,q:1,zoom:2,nv:true,ir:1},
 {id:'nv-high-zoom4-dpr',w:1280,h:720,dpr:2,ui:1,q:.5,zoom:4,nv:true,ir:2}
];
(async()=>{const s=await server(require('../../levels/level0_spatial.json'));let browser,a,b;const rows=[];
const save=(status,error)=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status,rows,error:error&&String(error),server:s.log},null,2));
try{
 browser=await launch();b=await open(browser,s,'3B upper matrix');await b.command({c:'freeze',on:1});await b.teleport({x:6192,y:864,z:180,support:'support:upper:long-room'});await b.page.evaluate(()=>{__spatial.config.quality=.5;__api.gear.eq.kind=__api.H.equipment.kind='lantern';});
 const made=await b.command({c:'spatial-entity',kind:'hound',pose:{x:6120,y:864,z:0,support:'support:ground:5472_768_672_96'}});
 const target='h'+made.msg.split(' ').at(-1),bid=await b.page.evaluate(()=>__api.H.id);let first,upper;
 await b.page.waitForFunction(()=>__spatial.state.last.camera.z===180&&__spatial.state.last.quality===.5&&__spatial.view.snapshot().groups.every(g=>g.fade===(g.target?1:0)),null,{timeout:60000});upper=await b.inspect();
 for(const c of cases){
  a=await open(browser,s,'3B '+c.id,{viewport:{width:c.w,height:c.h},deviceScaleFactor:c.dpr});await a.teleport({x:6192,y:864,z:0,support:'support:ground:6144_768_672_96'});
  await a.page.evaluate(c=>{__settings.set('s',c.ui);__spatial.config.quality=c.q;__spatial.config.labels=false;__api.gear.eq.kind=__api.H.equipment.kind=c.nv?'camcorder':'lantern';__cam.S.nvOn=c.nv;__cam.S.ir=c.ir||0;__cam.S.zoomIdx=c.zoom===4?2:c.zoom===2?1:0;},c);
  await a.page.waitForFunction(({c,target,bid})=>{const s=__spatial.state;return s.packets.some(p=>p.id===target)&&s.packets.some(p=>p.id==='p'+bid)&&s.last.camera.z===0&&s.last.quality===c.q&&s.last.nv===c.nv&&Math.abs(__cam.zoomCur-c.zoom)<1e-6&&s.cutaway!==null&&__spatial.view.snapshot().groups.every(g=>g.fade===(g.target?1:0));},{c,target,bid},{timeout:90000});
  const r=await a.page.evaluate(({c,target,bid})=>{
   const s=__spatial,V=TFB_VIEW;s.render(true);const p=s.pass,o=s.state.renderOptions,t=o.actors.find(p=>p.id===target),screen=V.project({...t,z:t.z+t.height/2},o.camera,s.state.last.scope.scale),point={x:innerWidth/2+screen.x,y:innerHeight/2+screen.y};
   const diff=(actors,lights)=>{p.render(o);const x=p.pixels();p.render({...o,actors,lights});const y=p.pixels();let n=0;for(let i=0;i<x.length;i+=4)if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2])n++;return n;};
   const hidden=diff(o.actors.filter(p=>p.id!=='p'+bid&&p.owner!=='p'+bid),o.lights.filter(l=>l.id!=='p'+bid)),positive=diff(o.actors.filter(p=>p.id!==target&&p.owner!==target),o.lights);
   p.render(o);p.renderer.resetState();const hit=s.pickAt(point.x,point.y),aim=s.aim(point),peer=o.actors.find(p=>p.id==='p'+bid),hs=V.project({...peer,z:peer.z+peer.height/2},o.camera,s.state.last.scope.scale),hiddenPick=s.pickAt(innerWidth/2+hs.x,innerHeight/2+hs.y);
   const times=[];for(let i=0;i<3;i++){const n=s.state.frames,start=performance.now();s.render(true);p.pixels();if(s.state.frames!==n+1)throw Error('Capture not fresh');times.push(performance.now()-start);}
   const stats=s.state.last,current=s.state.renderOptions,scope=stats.scope,bounds=s.model.definition.bounds;
   const lo={x:Math.min(scope.minX,current.eye.x),y:Math.min(scope.minY,current.eye.y),z:Math.min(bounds.min.z,current.eye.z)},hi={x:Math.max(scope.maxX,current.eye.x),y:Math.max(scope.maxY,current.eye.y),z:Math.max(bounds.max.z,current.eye.z)};
   for(const l of current.lights)if(Math.hypot(Math.max(scope.minX-l.origin.x,0,l.origin.x-scope.maxX),Math.max(scope.minY-l.origin.y,0,l.origin.y-scope.maxY))<=l.range)for(const k of ['x','y','z']){lo[k]=Math.min(lo[k],l.origin[k]);hi[k]=Math.max(hi[k],l.origin[k]);}
   const expectedCandidates=s.model.solids.filter(v=>['x','y','z'].every(k=>v.max[k]>=lo[k]-V.BOUNDARY&&v.min[k]<=hi[k]+V.BOUNDARY)).map(v=>v.id);
   return {case:c,hit,aim,hiddenPick,hiddenPixels:hidden,positivePixels:positive,peer,stats,expectedCandidates,world:s.inspect().world,pose:s.inspect().network.pose,cutaway:s.view.snapshot(),drainedFrameMs:times,glError:p.gl.getError(),gpu:s.inspect().gpu,uiScale:getComputedStyle(document.documentElement).getPropertyValue('--hs')};
  },{c,target,bid});
  rows.push(r);save('IN_PROGRESS');assert.equal(r.hit.actorId,target);assert.notEqual(r.hiddenPick.actorId,'p'+bid);assert.equal(r.hiddenPixels,0);assert(r.positivePixels>20);assert.equal(r.glError,0);assert.equal(r.stats.occluders,910);assert.equal(r.stats.ignoredContinuousCeilings,288);assert.deepEqual(r.stats.submittedCandidateIds,r.expectedCandidates);assert.equal(r.stats.occluderBatches,Math.ceil(r.expectedCandidates.length/64));if(c.zoom===1)assert(r.stats.occluderBatches>1);assert(r.stats.target.width*r.stats.target.height<=4194304);assert.equal(+r.uiScale,c.ui);assert.deepEqual(r.stats.scope,V.footprint(c.w,c.h,r.stats.camera,r.stats.zoom));assert.equal(r.cutaway.groups.filter(g=>g.target).length,1);assert.equal(r.cutaway.groups.find(g=>g.id==='view:long-room:upper-slab').fade,1);
  if(!first)first=r;for(const k of ['x','y','z'])assert(Math.abs(r.hit.point[k]-first.hit.point[k])<.001);assert(Math.abs(r.aim.pitch-first.aim.pitch)<.0001);
  if(c.id==='reduced'){assert.deepEqual(r.stats.submittedCandidateIds,first.stats.submittedCandidateIds);assert.deepEqual(r.stats.scope,first.stats.scope);assert.deepEqual(r.cutaway,first.cutaway);assert.equal(r.hiddenPixels,first.hiddenPixels);assert.deepEqual(r.world,first.world);}
  const other=await b.inspect();for(const k of ['camera','quality','scope'])assert.deepEqual(other.last[k],upper.last[k]);assert.deepEqual(other.cutaway,upper.cutaway);for(const k of ['x','y','z','support','generation'])assert.equal(other.network.pose[k],upper.network.pose[k]);
  a.validate();await a.page.screenshot({path:path.join(out,c.id+'.png')});await a.context.close();a=null;console.log('PASS production matrix '+c.id);
 }
 b.validate();save('PASS');
}catch(e){save('FAIL',e);for(const [id,c]of [['a',a],['b',b]])if(c){await c.page.screenshot({path:path.join(out,'failure-'+id+'.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'diagnostic-'+id+'.json'),JSON.stringify(await diagnostics(c).catch(()=>null),null,2));}throw e;}finally{await browser?.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
