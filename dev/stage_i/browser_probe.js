'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {fixture,server,launch,open,pixels,diagnostics}=require('../stage_h/browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{const s=await server(fixture());let browser,c;try{
 browser=await launch();c=await open(browser,s,'Stage I measured browser');await c.command({c:'freeze',on:1});
 await c.teleport({x:160,y:160,z:0,support:'support:ground-north'});
 await c.page.waitForFunction(()=>__spatial.view.snapshot().groups.every(g=>g.fade===1),null,{timeout:30000});
 const rows=[];for(const quality of [1,.5]){await c.page.evaluate(q=>{__spatial.config.quality=q;},quality);const samples=[];for(let i=0;i<3;i++){const start=performance.now(),capture=await pixels(c.page);assert(capture.lit>1000&&capture.error===0);samples.push({completedRoundTripMs:performance.now()-start,capture});}rows.push({quality,samples,inspect:await c.inspect(),classification:'BOUNDED MEASUREMENT; software GPU, no hardware certification'});}
 c.validate();const result={status:'PASS',runtime:process.version,browser:browser.version(),gpu:rows[0].inspect.gpu,viewport:{width:960,height:600},dpr:1,rows,errors:c.errors,externalFailures:c.failed};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){if(c)fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),diagnostics:await diagnostics(c)},null,2));throw e;}finally{if(browser)await browser.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
