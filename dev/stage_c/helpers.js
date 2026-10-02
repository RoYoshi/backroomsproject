'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),G=require('../../world_geometry'),M=require('../../world_motion'),fixture=require('../fixtures/world_25d');
const clone=x=>JSON.parse(JSON.stringify(x)),root=path.resolve(__dirname,'../..');
function world(solids,options={}){
 const d=clone(fixture);d.assetId='world:stage-c-test';d.geometryRevision='fixture-c1';d.bounds={min:{x:-500,y:-500,z:-500},max:{x:2000,y:2000,z:1000}};
 for(const k of ['supportPatches','navSurfaces','traversalLinks','spaces','portals','lights','viewGroups','anchors'])d[k]=[];
 d.solids=solids.map(s=>({...s})).sort((a,b)=>a.id.localeCompare(b.id));
 for(const s of d.solids)if(!s.noSupport)d.supportPatches.push({id:s.id.replace('solid:','support:'),polygon:clone(s.footprint),plane:clone(s.upper),normal:{x:-s.upper.a/Math.hypot(s.upper.a,s.upper.b,1),y:-s.upper.b/Math.hypot(s.upper.a,s.upper.b,1),z:1/Math.hypot(s.upper.a,s.upper.b,1)},solidId:s.id,materialId:s.materialId,navSurfaceId:null,supports:true});
 d.supportPatches.sort((a,b)=>a.id.localeCompare(b.id));Object.assign(d,options);return d;
}
function box(id,x,y,w,h,low,high,noSupport=false){return {id:'solid:'+id,footprint:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],lower:typeof low==='number'?{a:0,b:0,c:low}:low,upper:typeof high==='number'?{a:0,b:0,c:high}:high,materialId:'material:concrete',channels:{collision:true,visible:true,ir:true,acousticTransmission:.1},noSupport};}
function mover(def=fixture,initial={x:160,y:160,z:0},props=[]){
 const geometry=G.compile(def),adapter=M.motorAdapter(geometry,props),WORLD=require('../../world'),H={vx:0,vy:0,vz:0,angle:0,distance:0,stamina:100,exhausted:false,...initial},keys=new Set(),api={H,keys,spatialMotion:adapter},win={WORLD,__api:api};let tick=0;
 const context=vm.createContext({window:win,Math,console,performance:{now:()=>tick*1000/60},document:{getElementById:()=>null}});
 vm.runInContext(fs.readFileSync(path.join(root,'move.js'),'utf8'),context,{filename:'move.js'});
 return {H,mv:win.__mv,geometry,adapter,step(ix=0,iy=0,run=false,c=false){if(c)keys.add('KeyC');else keys.delete('KeyC');win.__mv.step(ix,iy,run,1/60);tick++;},snapshot(){return [H.x,H.y,H.z,H.vx,H.vy,H.vz,H.supportId,H.motionMode,H.stamina,H.exhausted,win.__mv.s,H.distance,H.tick];}};
}
module.exports={G,M,fixture,clone,world,box,mover};
