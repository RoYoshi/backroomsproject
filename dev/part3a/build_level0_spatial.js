'use strict';
const fs=require('fs'),path=require('path'),G=require('../../world_geometry'),{build}=require('../../levels/level0_spatial');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../../levels/level0_spatial.json'));
const d=build();G.validate(d);fs.writeFileSync(out,JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',file:out,revision:d.geometryRevision,hash:d.contentHash,counts:Object.fromEntries(['solids','supportPatches','navSurfaces','traversalLinks','spaces','portals','lights','anchors','viewGroups'].map(k=>[k,d[k].length]))}));
