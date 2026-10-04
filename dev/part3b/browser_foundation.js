'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{serve,launch}=require('../stage_d/browser_support');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{const s=await serve(root),rows=[],errors=[];let browser,page;const save=(status,error)=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status,rows,errors,error:error&&String(error)},null,2));try{
 browser=await launch();page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(s.url+'/stage_d.html?manual=1');await page.waitForFunction(()=>window.stageD?.ready);
 for(const z of [-96,0,90,180]){
  const result=await page.evaluate(z=>{const d=stageD,camera={x:400,y:330,z,depth:true};d.setScene('lower');d.draw({camera,only:['lower-local','lower-peer'],settle:true});const a=d.digest(d.pixels());
   d.draw({camera,only:['lower-local','lower-peer','upper-same-xy'],overlays:['upper-same-xy'],reverse:true});const b=d.digest(d.pixels());
   return {z,visible:a,hiddenAdded:b,glError:d.views[0].pass.gl.getError(),meta:d.views[0].pass.last};},z);
  rows.push(result);save('IN_PROGRESS');assert.equal(result.visible.hash,result.hiddenAdded.hash,'physical slab mask and reversed draw order');assert(result.visible.lit>1000);assert.equal(result.glError,0);
 }
 const seams=await page.evaluate(()=>{const d=stageD;d.setScene('ramp');const camera={x:830,y:300,z:-96,depth:true};d.draw({camera});const a=d.digest(d.pixels());d.draw({camera,reverse:true});return {a,b:d.digest(d.pixels()),error:d.views[0].pass.gl.getError()};});rows.push({name:'ramp crossing depth clamp',...seams});save('IN_PROGRESS');assert.equal(seams.a.hash,seams.b.hash);assert.equal(seams.error,0);
 await page.locator('#controls').evaluate(e=>e.style.display='none');await page.screenshot({path:path.join(out,'bounded-depth-ramp.png')});assert.deepEqual(errors,[]);save('PASS');console.log('PASS served WebGL depth foundation and hidden-layer masks');
 }catch(e){save('FAIL',e);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await browser?.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
