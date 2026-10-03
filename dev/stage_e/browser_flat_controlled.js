'use strict';
const path=require('path'),fs=require('fs'),assert=require('assert'),crypto=require('crypto'),{serve,launch}=require('../stage_d/browser_support');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..')),parent=process.argv[3]&&path.resolve(process.argv[3]),out=path.resolve(process.argv[4]||path.join(__dirname,'evidence'));if(!parent)throw Error('Supply pristine Stage D root as second argument');fs.mkdirSync(out,{recursive:true});
(async()=>{let browser;const results=[];try{browser=await launch();for(const [label,dir]of [['stage-c',parent],['stage-d',root]]){const server=await serve(dir);try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 // Stage E additive controlled capture. The retained Stage D harness is
 // untouched. Clock RPC latency leaves an observed 0/1 ms performance origin
 // difference, reproduced with parent against itself. Align absolute elapsed
 // times before screenshots; do not change game source, pixels, or assertions.
 await page.addInitScript(()=>{let seed=0x2d23c;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);window.WebSocket=class{constructor(){throw Error('Deterministic offline browser capture');}};});
 await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
 await page.goto(server.url+'/',{waitUntil:'load'});
 for(let i=0;i<100;i++){if(await page.evaluate(()=>!!window.__api&&!!document.querySelector('#game canvas')))break;await new Promise(r=>setTimeout(r,50));}
 await page.clock.runFor(1000-await page.evaluate(()=>performance.now()));assert.equal(await page.evaluate(()=>performance.now()),1000);await page.screenshot({path:path.join(out,'flat-'+label+'-menu.png'),animations:'disabled'});
 await page.evaluate(()=>{document.querySelector('#name').value='Stage D parity';document.querySelector('#enter').click();});await page.clock.runFor(2000-await page.evaluate(()=>performance.now()));assert.equal(await page.evaluate(()=>performance.now()),2000);
 assert(await page.evaluate(()=>window.__api.started()));await page.screenshot({path:path.join(out,'flat-'+label+'-playing.png'),animations:'disabled'});
 const state=await page.evaluate(()=>({elapsed:performance.now(),started:__api.started(),position:{x:__api.H.x,y:__api.H.y},scale:__cameraPolicy.baseScale(innerWidth,innerHeight),canvas:{width:document.querySelector('#game canvas').width,height:document.querySelector('#game canvas').height},network:__net.on,spatialLoaded:!!window.TFB_VIEW}));
 assert(!state.spatialLoaded);assert.deepEqual(errors,[]);const hashes={};for(const scene of ['menu','playing'])hashes[scene]=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,`flat-${label}-${scene}.png`))).digest('hex');results.push({label,hashes,state,errors});await context.close();
 }finally{await server.close();}}
 assert.deepEqual(results[0].state,results[1].state);assert.deepEqual(results[0].hashes,results[1].hashes,'Flat browser screenshot parity');const result={status:'PASS',browser:browser.version(),results,scope:'Real production Pixi page; deterministic SOLO fallback, seeded Math.random and elapsed-aligned frozen Playwright clock (menu 1000 ms, gameplay 2000 ms), CSS animations disabled for screenshots. Both menu and active gameplay screenshots byte-identical. Multiplayer is verified separately by inherited audits.'};fs.writeFileSync(path.join(out,'browser-flat.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
