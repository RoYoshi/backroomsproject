'use strict';
// Additive Stage E test content. The frozen Stage A/C fixture is never rewritten.
const G=require('../../world_geometry'),M=require('../../world_motion'),base=require('../fixtures/world_25d');
const clone=x=>JSON.parse(JSON.stringify(x));
function canonical(d){for(const k of ['solids','supportPatches','navSurfaces','traversalLinks','spaces','portals','materials','lights','viewGroups','anchors','colliderProfiles'])d[k].sort((a,b)=>a.id.localeCompare(b.id));delete d.contentHash;return d;}
function fixture(){
 const d=clone(base);d.assetId='world:stage-e';d.geometryRevision='stage-e-1';
 for(const [name,capabilities]of [['hound',['walk','stairs','ramp','drop','crawl','vault']],['smiler',['walk','stairs','ramp','drop','vault']]])d.colliderProfiles.push({...M.ENTITY_PROFILES[name],capabilities});
 for(const surface of d.navSurfaces)surface.clearanceProfileIds.push('profile:hound','profile:smiler');
 for(const link of d.traversalLinks){
  link.profileIds.push('profile:hound','profile:smiler');
  let a,b,axis;
  if(link.kind==='stairs'){a={x:368,y:90,z:0};b={x:368,y:620,z:180};axis='x';if(link.id.endsWith('down'))[a,b]=[b,a];}
  else if(link.kind==='ramp'){a={x:620,y:148,z:0};b={x:1050,y:148,z:180};axis='y';}
  else {a={x:880,y:660,z:120};b={x:880,y:810,z:-96};axis='x';}
  link.entry=[{...a,[axis]:a[axis]-40},{...a,[axis]:a[axis]+40}];link.exit=[{...b,[axis]:b[axis]-40},{...b,[axis]:b[axis]+40}];
  link.corridor=[a,b];link.corridorRadius=40;
  link.durationRule='actual fixed-tick motion';link.progressRule='physical pose only';
 }
 return canonical(d);
}
function adapter(def=fixture()){
 const geometry=G.compile(def),b=def.bounds;
 return {geometry,key:geometry.identity.contentHash,W:b.max.x,H:b.max.y,rooms:[],lamps:[],blackout:()=>false,qc:()=>0,kinds:[],
  floor:()=>false,clear:()=>false,blockers:()=>[],ray:()=>0};
}
module.exports={fixture,adapter,canonical,clone};
