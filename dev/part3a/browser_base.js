'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open,pixels,diagnostics}=require('../stage_h/browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{const def=require('../../levels/level0_spatial.json'),s=await server(def);let browser,a;try{
 browser=await launch();a=await open(browser,s,'Part 3A base');await a.command({c:'freeze',on:1});
 const pix=await pixels(a.page),state=await a.inspect();assert(pix.error===0&&pix.lit>1000,'production pixels');assert.equal(state.last.occluders,def.solids.length);assert(state.last.occluderBatches>1,'real multi-batch frame');
 await a.page.screenshot({path:path.join(out,'spawn.png')});a.validate();
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',browser:browser.version(),pixels:pix,state,errors:a.errors,console:a.consoleErrors,externalFailures:a.failed,server:s.log},null,2));console.log('PASS production base browser, all geometry and multiple occluder batches');
}catch(e){if(a){await a.page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(await diagnostics(a),null,2));}fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),stack:e.stack,server:s.log},null,2));throw e;}finally{if(browser)await browser.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
