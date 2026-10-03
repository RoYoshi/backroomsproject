'use strict';
// Actual served resources and browser execution, supplementing unchanged Stage D
// composition tests with explicit HTTP/request-failure accounting.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{serve,launch}=require('../stage_d/browser_support');
const root=path.resolve(__dirname,'../..');
(async()=>{const server=await serve(root);let browser;const pages=[];try{
 browser=await launch();
 for(const url of ['/stage_d.html?manual=1','/']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[],http=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url().replace(server.url,''),error:r.failure()}));
  page.on('response',r=>http.push({url:r.url().replace(server.url,''),status:r.status()}));
  await page.goto(server.url+url,{waitUntil:'networkidle'});
  if(url.startsWith('/stage_d'))await page.waitForFunction(()=>window.stageD?.ready);
  else{await page.waitForFunction(()=>!!window.__api&&!!document.querySelector('#game canvas'));await page.locator('#name').fill('Stage E validation');await page.locator('#enter').click();await page.waitForFunction(()=>window.__api.started());await page.waitForLoadState('networkidle');}
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(http.filter(r=>r.status>=400),[]);
  pages.push({url,errors,failed,http});await page.close();
 }
 const result={status:'PASS',runtime:process.version,browser:browser.version(),pages};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{if(browser)await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
