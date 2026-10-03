'use strict';
// Supplemental network/error observation; pixel gates stay in the retained
// Stage D harness. Uses the actual served package and a fresh test browser.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {serve,launch}=require('../stage_d/browser_support');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
(async()=>{
  const server=await serve(root);let browser;const results=[];
  try{
    browser=await launch();
    for(const url of ['/stage_d.html?manual=1','/']){
      const page=await browser.newPage({viewport:{width:1280,height:720}}),scriptErrors=[],networkErrors=[],httpErrors=[];
      page.on('pageerror',e=>scriptErrors.push(String(e)));
      const resource=url=>({url:url.startsWith(server.url)?url.slice(server.url.length):url,local:url.startsWith(server.url)});
      page.on('requestfailed',r=>networkErrors.push({...resource(r.url()),error:r.failure()?.errorText}));
      page.on('response',r=>{if(r.status()>=400)httpErrors.push({...resource(r.url()),status:r.status()});});
      await page.goto(server.url+url,{waitUntil:'load'});
      if(url.startsWith('/stage_d'))await page.waitForFunction(()=>window.stageD?.ready);
      else {await page.waitForFunction(()=>window.__api&&document.querySelector('#game canvas'));await page.locator('#name').fill('Stage E verification');await page.locator('#enter').click();await page.waitForFunction(()=>window.__api.started());}
      await page.waitForLoadState('networkidle');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.deepEqual(scriptErrors,[]);assert.deepEqual(networkErrors.filter(e=>e.local),[]);assert.deepEqual(httpErrors.filter(e=>e.local),[]);
      results.push({url,scriptErrors,networkErrors,httpErrors});await page.close();
    }
    const external=results.flatMap(r=>[...r.networkErrors,...r.httpErrors].filter(e=>!e.local));
    const result={status:external.length?'BLOCKED_EXTERNAL_RESOURCES':'PASS',localResources:'PASS',scriptErrors:'NONE',runtime:process.version,browser:browser.version(),external,results};
    if(external.length)process.exitCode=2;
    if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
