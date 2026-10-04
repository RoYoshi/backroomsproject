'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),V=require('../../world_view'),G=require('../../world_geometry'),M=require('../../world_motion'),d=require('../../levels/level0_spatial.json');
const out=path.resolve(process.argv[2]),g=G.compile(d),rows=[],traces=[];fs.mkdirSync(path.dirname(out),{recursive:true});
const save=(status,error)=>fs.writeFileSync(out,JSON.stringify({status,rows,traces,error:error&&String(error)},null,2)+'\n');
function trace(name,start,controller,count){const m=M.create(g),b=m.initialize({...start}),poses=[];for(let i=0;i<count;i++){
 controller(b,i);m.step(b);assert(g.clearance(b.shape,b).fits,name+' clearance');assert.equal(b.diagnostics.length,0,name+' diagnostics');poses.push({x:b.x,y:b.y,z:b.z,vz:b.vz,shape:b.shape,supportId:b.supportId,motionMode:b.motionMode,events:JSON.parse(JSON.stringify(b.events))});
 }const t={name,poses};traces.push(t);return t;}
function sample(poses,time){const n=Math.min(poses.length-1,time*60),i=Math.floor(n),u=n-i,a=poses[i],b=poses[Math.min(i+1,poses.length-1)];return {...a,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u,vz:a.vz+(b.vz-a.vz)*u};}
function replay(t,hz){const actor=new V.ActorElevation(),camera=new V.CameraElevation(),result=[];let now=0,n=0,maxOffset=0,maxLag=0;
 while(now<=t.poses.length/60+1){const p=V.freeze(sample(t.poses,now)),before=JSON.stringify(p),dt=now===0?0:now-last;
  const rendered=actor.update(p,dt,'life:1'),z=camera.update(rendered.z,dt,'life:1',true);assert.equal(JSON.stringify(p),before);
  maxOffset=Math.max(maxOffset,Math.abs(rendered.offset));maxLag=Math.max(maxLag,Math.abs(z-rendered.z));assert(maxOffset<=8+1e-9);assert(maxLag<=28+1e-9);assert(Math.abs(rendered.settle)<=1.25);
  result.push({time:now,physicalZ:p.z,renderZ:rendered.z,cameraZ:z,settle:rendered.settle,mode:p.motionMode,destinationScale:V.layerScale(t.destination??0,{z,depth:true})});
  var last=now;now+=hz==='jitter'?[1/240,1/60,.027,.008,.019][n++%5]:1/hz;
 }
 assert(Math.abs(result.at(-1).cameraZ-t.poses.at(-1).z)<.01,'settled camera');return {hz,maxOffset,maxLag,result};
}
function at(rows,time,key){let i=rows.findIndex(r=>r.time>=time);if(i<0)return rows.at(-1)[key];if(i===0)return rows[0][key];const a=rows[i-1],b=rows[i],u=(time-a.time)/(b.time-a.time);return a[key]+(b[key]-a[key])*u;}
try{
 for(const id of ['link:long-room-stairs:forward','link:long-room-stairs:reverse','link:long-room-ramp:forward','link:long-room-ramp:reverse','link:blackout-return:forward','link:blackout-return:reverse']){
  const proof=M.proveTraversal(g,d.traversalLinks.find(l=>l.id===id),M.PROFILES.stand,{record:true});assert(proof.ok,id);
  const poses=proof.poses.map((p,i,a)=>({...p,shape:M.PROFILES.stand,vz:i?(p.z-a[i-1].z)*60:0}));assert(poses.length);traces.push({name:id,poses});
 }
 trace('stairs-reversal',{x:5616,y:1512,z:0},(b,i)=>{b.vx=0;b.vy=i<140?-100:i<280?100:0;},330);
 trace('stairs-sideways-departure',{x:5616,y:1512,z:0},(b,i)=>{b.vx=i>=110&&i<175?100:0;b.vy=i<110?-100:0;},260);
 const high=trace('production-clearance-valid-airborne-180-to-0',{x:5616,y:1450,z:180},(b,i)=>{b.vx=0;b.vy=i<65?172:0;},140);high.destination=0;
 const low=trace('production-lower-rim-0-to-minus96',{x:936,y:5568,z:0},(b,i)=>{b.vx=i<120?-100:0;b.vy=0;},190);low.destination=-96;
 for(const t of [high,low]){assert(t.poses.some(p=>p.motionMode==='airborne'));assert(Math.abs(t.poses.at(-1).z-t.destination)<.06,t.name+' destination');const lands=t.poses.flatMap(p=>p.events).filter(e=>e.type==='land');assert.equal(lands.length,1,t.name+' exactly one physical landing');}
 save('IN_PROGRESS');
 for(const t of traces){const outputs=[30,60,120,144,240,'jitter'].map(hz=>replay(t,hz)),ref=outputs.find(r=>r.hz===240);let maxCameraDifference=0,maxRenderDifference=0;
  for(const r of outputs){for(let time=0;time<t.poses.length/60;time+=.025){maxCameraDifference=Math.max(maxCameraDifference,Math.abs(at(ref.result,time,'cameraZ')-at(r.result,time,'cameraZ')));maxRenderDifference=Math.max(maxRenderDifference,Math.abs(at(ref.result,time,'renderZ')-at(r.result,time,'renderZ')));}
   if(t.destination!==undefined){const falling=r.result.filter(p=>p.mode==='airborne');for(let i=1;i<falling.length;i++)assert(falling[i].destinationScale>=falling[i-1].destinationScale-1e-5,t.name+' destination approach');}
  }
  rows.push({name:t.name,maxCameraDifference,maxRenderDifference,schedules:outputs.map(r=>({hz:r.hz,maxOffset:r.maxOffset,maxLag:r.maxLag})),samples60:outputs[1].result});save('IN_PROGRESS');
  assert(maxCameraDifference<2.5,t.name+' camera time stability');assert(maxRenderDifference<3,t.name+' actor time stability');
 }
 const model=V.compile(d),view=new V.LocalView(model),camera={x:6192,y:864,z:0,depth:true},eye={...camera,z:50},scope=V.footprint(960,600,camera),picks=[];view.update(camera,.25);
 for(const offset of [-8,-2,0,2,8]){const target={id:'visible-peer',kind:'peer',x:6120,y:864,z:0,height:60,radius:15,renderOffset:offset},hidden={...target,id:'hidden-peer',z:180};
  const screen=V.project({...target,z:30+offset},camera,scope.scale),hit=V.pick(model,{screen,camera,eye,width:960,height:600,view,actors:[hidden,target]});
  assert.equal(hit.actorId,target.id);assert(Math.abs(hit.presentationPoint.z-hit.point.z-offset)<1e-9);assert(hit.point.z>=0&&hit.point.z<=60);picks.push({offset,hit});
 }rows.push({name:'smoothed visual picking returns physical body coordinates without slab leaks',picks});
 const a=new V.ActorElevation(),b=new V.ActorElevation(),pose={x:10,y:10,z:0,shape:M.PROFILES.stand,motionMode:'grounded'};a.update(pose,0,'one');b.update({...pose,z:180},0,'two');a.update({...pose,z:8},.02,'one');assert.equal(b.spring.z,180);
 assert(a.update({...pose,z:180},1/60,'teleport:2').reset);assert.equal(a.spring.z,180);assert.equal(a.update({...pose,z:-96},1,'teleport:2').z,-96);
 rows.push({name:'independent clients and reset',status:'PASS'});save('PASS');console.log('PASS real physical traces, stair reversal/side departure, ramps, both falls, bounded landing and six render schedules');
}catch(e){save('FAIL',e);throw e;}
