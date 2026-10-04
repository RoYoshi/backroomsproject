'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open,pixels,diagnostics}=require('../stage_h/browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{const def=require('../../levels/level0_spatial.json'),s=await server(def);let browser,a;try{
 browser=await launch();a=await open(browser,s,'Part 3A base');await a.command({c:'freeze',on:1});
 await a.page.waitForFunction(()=>__spatial.state.last.cutaway.groups.filter(g=>g.target).every(g=>g.fade===1),null,{timeout:30000});
 const ready=await a.page.evaluate(()=>({tick:__net.spatialState().pose.tick,epoch:__net.spatialState().world.worldEpoch}));
 await a.page.waitForFunction(r=>__spatial.state.last.cutaway.worldEpoch===r.epoch&&__spatial.state.packets.some(p=>p.id==='p'+__api.H.id&&p.tick>=r.tick),ready,{timeout:30000});
 const pix=await pixels(a.page),state=await a.inspect();fs.writeFileSync(path.join(out,'spawn-raw.json'),JSON.stringify({pix,state,console:a.consoleErrors,errors:a.errors},null,2));assert(pix.error===0&&pix.lit>1000,'production pixels');assert.equal(state.last.occluders,def.solids.length);await a.page.screenshot({path:path.join(out,'spawn.png')});
 await a.teleport({x:7056,y:1104,z:0,support:'support:ground:6912_768_288_768'});
 await a.page.waitForFunction(()=>__spatial.state.last.camera.x===7056&&__spatial.state.last.cutaway.groups.filter(g=>g.target).every(g=>g.fade===1),null,{timeout:30000});
 const densePixels=await pixels(a.page),dense=await a.inspect();fs.writeFileSync(path.join(out,'dense-raw.json'),JSON.stringify({densePixels,dense,console:a.consoleErrors,errors:a.errors},null,2));assert(dense.last.occluderBatches>1,'real multi-batch frame');assert.equal(dense.last.occluders,def.solids.length);assert(densePixels.lit>1000&&densePixels.error===0);
 await a.page.screenshot({path:path.join(out,'long-room.png')});
 a.validate();
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',browser:browser.version(),pixels:pix,state,densePixels,dense,errors:a.errors,console:a.consoleErrors,externalFailures:a.failed,server:s.log},null,2));console.log('PASS production base browser, all geometry and multiple occluder batches');
}catch(e){if(a){await a.page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(await diagnostics(a),null,2));}fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),stack:e.stack,server:s.log,console:a?.consoleErrors,errors:a?.errors},null,2));throw e;}finally{if(browser)await browser.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
