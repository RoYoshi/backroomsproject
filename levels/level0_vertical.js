'use strict';
// Local production additions, in existing Level 0 coordinates. No motion tuning.
const UPPER={x:5568,y:720,w:1152,h:288},STAIRS={x:5568,y:1008,w:96,h:480},RAMP={x:6336,y:1008,w:192,h:480};
const PIT={x:576,y:5472,w:288,h:480},DOWN={x:576,y:5664,w:288,h:288},LOWER={x:576,y:5472,w:288,h:192};
const CRAWL={x:1632,y:816,w:288,h:96};
function subtract(rect,holes){let pieces=[rect];for(const h of holes){const out=[];for(const r of pieces){const x=Math.max(r.x,h.x),y=Math.max(r.y,h.y),right=Math.min(r.x+r.w,h.x+h.w),bottom=Math.min(r.y+r.h,h.y+h.h);if(right<=x||bottom<=y){out.push(r);continue;}
 for(const q of [{x:r.x,y:r.y,w:r.w,h:y-r.y},{x:r.x,y:bottom,w:r.w,h:r.y+r.h-bottom},{x:r.x,y,w:x-r.x,h:bottom-y},{x:right,y,w:r.x+r.w-right,h:bottom-y}])if(q.w>0&&q.h>0)out.push(q);}pieces=out;}return pieces;}
function add({d,solid,space,nav,profiles}){
 const upperSpace=space(UPPER,'upper',180,344),lowerSpace=space(PIT,'depression',-96,164),crawlSpace=space(CRAWL,'crawl',0,28);
 const stairSpace=space(STAIRS,'stairs',0,344),rampSpace=space(RAMP,'ramp',0,344);
 // Real air openings at the two mouths, with centers above their local tread.
 // Segment visibility remains authoritative for sound through these portals.
 for(const [tag,r,sid]of [['stairs',STAIRS,stairSpace],['ramp',RAMP,rampSpace]])for(const upper of [false,true]){
  const y=upper?r.y:r.y+r.h,z0=upper?180:0,z1=upper?344:164;
  const target=upper?upperSpace:d.spaces.find(s=>s.id.startsWith('space:base:')&&r.x+r.w/2>s.bounds.min.x&&r.x+r.w/2<s.bounds.max.x&&y+1>=s.bounds.min.y&&y+1<=s.bounds.max.y)?.id;
  if(!target)throw Error('Missing production air mouth '+tag);
  const id='portal:long-room:'+tag+':'+(upper?'upper':'base'),p={id,fromSpaceId:sid,toSpaceId:target,polygon:[{x:r.x,y,z:z0},{x:r.x+r.w,y,z:z0},{x:r.x+r.w,y,z:z1},{x:r.x,y,z:z1}],channels:{visible:true,ir:true,acousticTransmission:1},traversalLinkId:null};
  d.portals.push(p);d.spaces.find(s=>s.id===sid).portalIds.push(id);d.spaces.find(s=>s.id===target).portalIds.push(id);
 }
 solid('upper:long-room',UPPER,164,180,'material:concrete','nav:upper','view:long-room:upper-slab');
 solid('upper:ceiling',UPPER,344,360,'material:concrete',null,'view:long-room:upper-roof',upperSpace);
 // The slab and its edge walls form one local overhead structure. When viewed
 // from below, fade them together so the retained camera can see the feet and
 // nearby floor. All six solids still participate in physical eye/light rays.
 for(const [name,r]of [['north',{x:5568,y:720,w:1152,h:16}],['west',{x:5568,y:736,w:16,h:272}],['east',{x:6704,y:736,w:16,h:272}],['south-west',{x:5664,y:992,w:672,h:16}],['south-east',{x:6528,y:992,w:176,h:16}]])solid('upper:edge:'+name,r,180,276,'material:concrete',null,'view:long-room:upper-slab');
 for(let i=0;i<15;i++){const h=(i+1)*12,r={x:STAIRS.x,y:STAIRS.y+STAIRS.h-(i+1)*32,w:STAIRS.w,h:32};solid('stairs:long-room:tread:'+String(i+1).padStart(2,'0'),r,h-16,h,'material:concrete','nav:stairs','view:long-room:stairs');}
 const ramp={a:0,b:-180/480,c:1488*180/480};solid('ramp:long-room',RAMP,{...ramp,c:ramp.c-16},ramp,'material:concrete','nav:ramp','view:long-room:ramp');
 const down={a:0,b:1/3,c:-96-5664/3};solid('ramp:depression',DOWN,{...down,c:down.c-16},down,'material:carpet','nav:depression-ramp');
 solid('lower:blackout',LOWER,-112,-96,'material:carpet','nav:lower');
 for(const [name,r]of [['north',{x:576,y:5456,w:288,h:16}],['west',{x:560,y:5472,w:16,h:480}],['east',{x:864,y:5472,w:16,h:480}],['south',{x:576,y:5952,w:288,h:16}]])solid('lower:retaining:'+name,r,-112,0,'material:carpet');
 solid('crawl:north:roof',CRAWL,28,76,'material:carpet',null,'view:crawl:north:roof',crawlSpace);
 solid('crawl:north:side:north',{x:1632,y:816,w:288,h:12},0,28,'material:carpet');
 solid('crawl:north:side:south',{x:1632,y:900,w:288,h:12},0,28,'material:carpet');
 const all=[...profiles.keys()].filter(x=>x!=='profile:corpse');
 function pair(id,kind,from,to,a,b,axis,width,patchIds,allowed=all){for(const reverse of [false,true]){
  const A=reverse?b:a,B=reverse?a:b,fromId=reverse?to:from,toId=reverse?from:to,name='link:'+id+(reverse?':reverse':':forward');
  const region=p=>[-width/2,width/2].map(v=>({...p,[axis]:p[axis]+v}));
  const link={id:name,kind,fromSurfaceId:fromId,toSurfaceId:toId,entry:region(A),exit:region(B),corridor:[A,B],corridorRadius:width/2,supportPatchIds:patchIds,profileIds:allowed,capabilityFlags:kind==='crawl'?['crawl']:[],durationRule:'actual fixed-tick motion',progressRule:'physical pose only',interruptionRule:'retain actual pose; resolve grounded/airborne',landingRule:'physical contact at named destination',costRule:'physical path distance and accepted traversal time',directed:true,clearanceRequired:true};d.traversalLinks.push(link);nav(fromId).boundaryLinkIds.push(name);if(toId!==fromId)nav(toId).boundaryLinkIds.push(name);
 }}
 pair('long-room-stairs','stairs','nav:base','nav:upper',{x:5616,y:1512,z:0},{x:5616,y:960,z:180},'x',80,d.supportPatches.filter(p=>p.navSurfaceId==='nav:stairs').map(p=>p.id));
 pair('long-room-ramp','ramp','nav:base','nav:upper',{x:6432,y:1512,z:0},{x:6432,y:960,z:180},'x',160,['support:ramp:long-room']);
 pair('blackout-return','ramp','nav:base','nav:lower',{x:720,y:5976,z:0},{x:720,y:5520,z:-96},'x',240,['support:ramp:depression']);
 // A real crawl corridor on base support; navigation may use this link only
 // with the accepted low profile. The roof remains a physical occluder.
 pair('north-crawl','crawl','nav:base','nav:base',{x:1608,y:864,z:0},{x:1944,y:864,z:0},'y',64,[],all.filter(id=>id!=='profile:smiler'));
 d.production.features=[
  {id:'upper:long-room',roomId:'room:06',rect:UPPER,z:180,supportId:'support:upper:long-room',spaceId:upperSpace},
  {id:'stairs:long-room',roomId:'room:06',rect:STAIRS,z:[0,180],risers:15,rise:12,tread:32,linkId:'link:long-room-stairs:forward'},
  {id:'ramp:long-room',roomId:'room:06',rect:RAMP,z:[0,180],supportId:'support:ramp:long-room',linkId:'link:long-room-ramp:forward'},
  {id:'lower:blackout',roomId:'room:07',rect:LOWER,z:-96,supportId:'support:lower:blackout',returnLinkId:'link:blackout-return:reverse',spaceId:lowerSpace},
  {id:'crawl:north',roomId:'room:05',rect:CRAWL,z:0,clearance:28,linkId:'link:north-crawl:forward',spaceId:crawlSpace}
 ];
}
module.exports={UPPER,STAIRS,RAMP,PIT,DOWN,LOWER,CRAWL,subtract,add};
