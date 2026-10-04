'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),V=require('../../world_view'),Old=require('./reference/world_view'),G=require('../../world_geometry'),d=require('../../levels/level0_spatial.json');
const out=path.resolve(process.argv[2]),rows=[],before=JSON.stringify(d),model=V.compile(d),old=Old.compile(d),g=G.compile(d);fs.mkdirSync(path.dirname(out),{recursive:true});
const save=(status,error)=>fs.writeFileSync(out,JSON.stringify({status,rows,error:error&&{message:String(error),stack:error.stack}},null,2)+'\n');
const physical=m=>m.solids.map(s=>Object.fromEntries(['id','index','planes','min','max','visible','ir'].map(k=>[k,s[k]])));
function view(p,enabled=true){const v=new V.LocalView(model);v.update(p,.25,{camera:{...p,depth:true},enabled});return v;}
try{
 assert.deepEqual(physical(model),physical(old));assert.equal(model.solids.length,910);assert(model.ignoredCeilings.length>200);
 assert(model.packets.filter(p=>p.cameraIgnored).every(p=>p.id.startsWith('solid:ceiling:')||p.id==='solid:upper:ceiling'));
 assert(!model.groups.some(g=>g.kind==='continuousInteriorCeiling'));assert(model.groups.every(g=>['localCover','overlapSlab'].includes(g.kind)));
 rows.push({name:'continuous ceilings are camera-only omissions; all physical convex planes/channels identical',ignored:model.ignoredCeilings.length,groups:model.groups.map(g=>({id:g.id,kind:g.kind,solids:g.solids.map(s=>s.id)}))});save('IN_PROGRESS');
 const inside={x:1776,y:864,z:0,height:24,radius:15},outside={x:1584,y:864,z:0,height:60,radius:15},a=view(inside),b=view(outside),cover='solid:crawl:north:roof';
 assert.equal(a.fadeFor(cover),1);assert.equal(b.fadeFor(cover),0);assert.deepEqual(a.snapshot().groups.filter(x=>x.target).map(x=>x.id),['view:crawl:north:roof']);
 const outsideLow=view({...outside,height:24});assert.equal(outsideLow.fadeFor(cover),0);assert(V.visible(model,{...outside,z:18},{...inside,z:12}),'positive physical sight through crawl mouth');
 const camera={...outside,depth:true},point={...inside,z:12},ray=V.pickingRay(V.project(point,camera,1),camera,1);assert(!V.cameraClear(model,point,ray,outsideLow),'opaque cover still blocks top-down outside camera');
 assert.equal(view(inside,false).fadeFor(cover),0);assert.equal(a.fadeFor(cover),1,'second view update does not mutate first');
 rows.push({name:'NORTH independent inside/outside/crouched-outside cover and camera mask',inside:a.snapshot(),outside:b.snapshot()});save('IN_PROGRESS');
 const lower={x:6192,y:864,z:0,height:60,radius:15},upper={...lower,z:180},l=view(lower),u=view(upper),slab='solid:upper:long-room';
 assert.equal(l.fadeFor(slab),1);assert.equal(u.fadeFor(slab),0);assert.deepEqual(l.snapshot().groups.filter(x=>x.target).map(x=>x.id),['view:long-room:upper-slab']);
 assert(!V.visible(model,{...lower,z:50},{...upper,z:210}));assert(!V.visible(model,{...upper,z:230},{...lower,z:30}));
 rows.push({name:'LONG ROOM only the local slab/edge group fades; upper/lower physical rays still blocked',lower:l.snapshot(),upper:u.snapshot()});save('IN_PROGRESS');
 const anchors=d.anchors.filter(a=>a.position).slice(0,160),rays=[];
 for(let i=0;i<anchors.length;i++){const a={...anchors[i].position,z:anchors[i].position.z+25},b={...anchors[(i*37+11)%anchors.length].position,z:anchors[(i*37+11)%anchors.length].position.z+35};assert.equal(V.visible(model,a,b),Old.visible(old,a,b));rays.push({a,b,visible:V.visible(model,a,b)});}
 for(const z of [0,180]){const p={x:6192,y:864,z:z+50},q={...p,z:z+190};for(const channel of ['collision','visible','ir'])assert(g.raycast(p,q,channel),'physical ceiling '+channel);}
 const acousticBefore=g.propagateSound({...inside,z:12},{...outside,z:18});a.update(upper,.25,{camera:{...upper,depth:true}});assert.deepEqual(g.propagateSound({...inside,z:12},{...outside,z:18}),acousticBefore);
 assert.equal(JSON.stringify(d),before);rows.push({name:'parent visual rays, physical ceiling collision/visible/IR and acoustic truth unchanged',rays,acoustic:acousticBefore});save('PASS');console.log('PASS continuous interior, NORTH local cover, LONG overlap, independent views and exact parent physical rays');
}catch(e){save('FAIL',e);throw e;}
