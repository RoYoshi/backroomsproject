'use strict';
const assert=require('assert'),V=require('../../world_view'),{fixture}=require('../stage_e/fixture');
const d=fixture(),before=JSON.stringify(d),model=V.compile(d),camera={x:160,y:160,z:0},eye={x:160,y:160,z:52},view=new V.LocalView(model);
view.update(camera,.25);const actor={id:'target',kind:'hound',x:220,y:160,z:0,height:42,radius:18,observable:true};
const checks=[];
for(const [width,height,zoom] of [[960,600,1],[1280,720,1],[1280,800,1],[3440,1440,1],[3840,2160,1],[1280,720,2],[1280,720,4]]){
 const scope=V.footprint(width,height,camera,zoom),screen=V.project({...actor,z:21},camera,scope.scale),hit=V.pick(model,{screen,camera,eye,width,height,view,actors:[actor],zoom});assert.equal(hit.actorId,'target',JSON.stringify(hit));checks.push({width,height,zoom,point:hit.point,distance:hit.distance});
 for(const k of ['x','y','z'])assert(Math.abs(hit.point[k]-checks[0].point[k])<1e-8);
 assert(scope.width<=1536&&scope.height<=864);
}
const hidden={...actor,id:'hidden',z:180};let p=V.pick(model,{screen:V.project({...hidden,z:201},camera,1),camera,eye,width:1536,height:864,view,actors:[hidden]});assert.notEqual(p.actorId,'hidden');
view.update(camera,.25,{enabled:false});p=V.pick(model,{screen:V.project({...actor,z:21},camera,1),camera,eye,width:1536,height:864,view,actors:[actor]});assert.notEqual(p.actorId,'target','opaque camera slab must block picking');
const empty={solids:[]};p=V.pick(empty,{screen:{x:37,y:29},camera,eye,width:1536,height:864,actors:[]});assert.equal(p.kind,'plane');assert.equal(p.point.z,eye.z);assert.equal(p.point.x,197);assert.equal(p.point.y,215);
assert.equal(JSON.stringify(d),before);console.log(JSON.stringify({status:'PASS',checks,hiddenAndOpaqueCameraBlocked:true,definedEyePlane:true,geometryUnchanged:true},null,2));
