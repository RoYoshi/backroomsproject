'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open,diagnostics}=require('../stage_h/browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{const s=await server(require('../../levels/level0_spatial.json'));let browser,a;const rows=[];
const save=(status,error)=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status,rows,error:error&&String(error),server:s.log},null,2));
try{
 browser=await launch();a=await open(browser,s,'3B reset observer');await a.command({c:'freeze',on:1});await a.page.evaluate(()=>{
  __spatial.config.quality=.5;window.__cameraResets=[];const original=TFB_VIEW.CameraElevation.prototype.update;
  TFB_VIEW.CameraElevation.prototype.update=function(...args){const before=this.resets,from=this.z,key=this.key,value=original.apply(this,args);if(this.omega===24&&before!==this.resets)__cameraResets.push({from,oldKey:key,target:args[0],dt:args[1],...this.snapshot(),physical:{x:__api.H.x,y:__api.H.y,z:__api.H.z},network:__net.spatialState()?.pose});return value;};
 });
 const capture=async name=>{await a.page.waitForFunction(()=>{const s=__spatial.state,n=__net.spatialState();return !n.awaiting&&!n.blocked&&s.presentation&&Math.abs(s.presentation.camera.z-s.presentation.targetZ)<.01&&s.presentation.camera.key.startsWith(n.world.worldEpoch);},null,{timeout:60000});const r=await a.page.evaluate(()=>({resets:__cameraResets.splice(0),state:__spatial.inspect()}));rows.push({name,...r});save('IN_PROGRESS');assert(r.resets.length,name+' reset observed');for(const q of r.resets){assert.equal(q.z,q.target,name+' must snap on reset');assert.equal(q.velocity,0);}assert(Math.abs(r.state.presentation.camera.z-r.state.presentation.targetZ)<.01);console.log('PASS '+name);return r;};
 await a.teleport({x:6192,y:864,z:180,support:'support:upper:long-room'});await capture('authorized teleport 0 to upper 180');
 await a.teleport({x:720,y:5568,z:-96,support:'support:lower:blackout'});await capture('authorized teleport upper to lower minus96');
 const epoch=(await a.inspect()).network.world.worldEpoch;await a.command({c:'world'});await a.page.waitForFunction(e=>__net.spatialState()?.world.worldEpoch!==e,epoch);await capture('world reset changes epoch and snaps presentation');
 await a.command({c:'freeze',on:1});await a.teleport({x:6192,y:864,z:180,support:'support:upper:long-room'});await capture('upper before reconnect');
 const old=await a.page.evaluate(()=>{window.__oldWire=__wire;const id=__api.H.id;__wire.close();return id;});
 await a.page.waitForFunction(id=>__wire!==__oldWire&&__net.on&&__api.H.id!==id&&__net.spatialState()?.pose?.generation>0,old,{timeout:60000});await capture('actual socket disconnect and reconnect');
 await a.page.evaluate(pass=>__net.testAuth(pass),process.env.ADMIN_PASSCODE);await a.page.waitForFunction(()=>__messages.some(m=>m.t==='admin'&&m.ok));
 await a.command({c:'freeze',on:1});await a.teleport({x:6192,y:864,z:180,support:'support:upper:long-room'});await capture('upper before lifecycle reset');
 const id=await a.page.evaluate(()=>__api.H.id),life=(await a.inspect()).network.pose.generation;
 await a.command({c:'spatial-entity',kind:'hound',pose:{x:6144,y:864,z:180,support:'support:upper:long-room'}});
 await a.command({c:'preview',k:'hound',var:'B'});await a.page.waitForFunction(()=>__api.death().finished,null,{timeout:60000});await capture('death camera attaches to authoritative body');
 await a.command({c:'revive',id});await a.page.waitForFunction(life=>__net.spatialState().pose.generation>life,life,{timeout:60000});await capture('authorized revive and respawn life reset');
 a.validate();save('PASS');
}catch(e){save('FAIL',e);if(a){await a.page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(await diagnostics(a).catch(()=>null),null,2));}throw e;}finally{await browser?.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
