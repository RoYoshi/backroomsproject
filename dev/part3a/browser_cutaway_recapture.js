'use strict';
// Revisit only the LONG ROOM views affected by the upper-edge cutaway repair.
// The other eleven rooms, lower route and crawl evidence remain preserved.
const fs=require('fs'),path=require('path'),assert=require('assert');
const G=require('../../world_geometry'),M=require('../../world_motion');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open,pixels,diagnostics}=require('../stage_h/browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:false});
const definition=require('../../levels/level0_spatial.json'),geometry=G.compile(definition);
const scenes=[
 ['room-06',{x:7056,y:1104,z:0}],
 ['stairs-base',{x:5616,y:1512,z:0}],
 ['stairs-mid',{x:5616,y:1244,z:108}],
 ['stairs-upper',{x:5616,y:951,z:180}],
 ['ramp-mid',{x:6432,y:1248,z:95.625}],
 ['ramp-upper',{x:6432,y:960,z:180}],
 ['overlap-lower',{x:6192,y:864,z:0}],
 ['overlap-upper',{x:6192,y:864,z:180}]
];
(async()=>{const s=await server(definition);let browser,a;const rows=[];
 const save=()=>fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(rows,null,2)+'\n');
 try{
  browser=await launch();a=await open(browser,s,'Level 0 cutaway recapture');
  await a.command({c:'freeze',on:1});
  await a.page.evaluate(()=>{__api.gear.eq.kind='lantern';__api.H.equipment.kind='lantern';__spatial.config.labels=false;__ents.dbgCfg.on=false;});
  for(const [name,pose] of scenes){
   const support=geometry.supports(M.PROFILES.stand,pose,[pose.z-.01,pose.z+.01])[0];assert(support,name);
   await a.teleport({...pose,support:support.id});
   await a.page.waitForFunction(()=>Math.hypot(__spatial.state.last.camera.x-__api.H.x,__spatial.state.last.camera.y-__api.H.y,__spatial.state.last.camera.z-__api.H.z)<.2&&__spatial.state.last.cutaway.groups.every(g=>g.fade===(g.target?1:0)),null,{timeout:40000});
   const pixelEvidence=await pixels(a.page),state=await a.inspect();
   const layers=await a.page.evaluate(()=>({labels:__spatial.state.packets.filter(p=>p.kind==='label').length,legacy:Object.fromEntries(['mp','light','peerTip','aiDebug','glitchFx'].map(id=>[id,document.getElementById(id)?getComputedStyle(document.getElementById(id)).display:'absent']))}));
   const row={name,pose,support:support.id,pixels:pixelEvidence,state,layers};rows.push(row);save();
   assert(pixelEvidence.lit>1000&&pixelEvidence.error===0,name);
   assert.equal(state.last.occluders,910);assert.equal(layers.labels,0);
   assert(Object.values(layers.legacy).every(v=>v==='none'||v==='absent'));
   assert(state.last.cutaway.groups.filter(g=>g.target).length<definition.viewGroups.length);
   const group=state.last.cutaway.groups.find(g=>g.id==='view:long-room:upper-slab');
   if(name==='overlap-lower')assert(group&&group.target&&group.fade===1,'local overhead slab and edge walls fade together');
   if(name==='overlap-upper')assert(group&&!group.target&&group.fade===0,'upper support remains visible from above');
   await a.page.screenshot({path:path.join(out,name+'.png')});console.log('PASS',name);
  }
  a.validate();
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',hash:definition.contentHash,scenes:rows.map(r=>r.name),browser:browser.version(),gpu:rows[0].state.gpu,checks:rows.length,labels:false,physicalSolids:910,unchangedEvidence:'../readability-01 (eleven other rooms, lower, crawl, full/reduced truth)',errors:a.errors,console:a.consoleErrors,externalFailures:a.failed,resources:a.http},null,2)+'\n');
 }catch(e){save();if(a){await a.page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(await diagnostics(a),null,2));}fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),stack:e.stack,server:s.log},null,2));throw e;}
 finally{if(browser)await browser.close();await s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
