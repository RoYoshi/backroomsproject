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
      page.on('requestfailed',r=>networkErrors.push({url:new URL(r.url()).pathname,error:r.failure()?.errorText}));
      page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:new URL(r.url()).pathname,status:r.status()});});
      await page.goto(server.url+url,{waitUntil:'load'});
      if(url.startsWith('/stage_d'))await page.waitForFunction(()=>window.stageD?.ready);
      else await page.waitForFunction(()=>window.__api&&document.querySelector('#game canvas'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.deepEqual(scriptErrors,[]);assert.deepEqual(networkErrors,[]);assert.deepEqual(httpErrors,[]);
      results.push({url,scriptErrors,networkErrors,httpErrors});await page.close();
    }
    const result={status:'PASS',runtime:process.version,browser:browser.version(),results};
    if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
