'use strict';
// Real served production page, with an explicit equal RAF delivery schedule.
// The historical clock-only harness leaves RAF phase dependent on async boot.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {serve,launch}=require('../stage_d/browser_support');
// Part 3B HQ2 copy of dev/stage_h/browser_flat.js. Newer Playwright clocks may
// already read ~300 ms when the page is ready, so the original absolute 100 ms
// start needs negative ticks. Both sides now advance to one fixed T0 and then
// receive the identical equal 20 ms RAF schedule; comparison is unchanged.
const T0=1000;
(async()=>{const root=path.resolve(process.argv[2]||'.'),parent=path.resolve(process.argv[3]),out=path.resolve(process.argv[4]);fs.mkdirSync(out,{recursive:true});let browser;const rows=[];try{browser=await launch();for(const [label,dir]of [['parent',parent],['candidate',root]]){const s=await serve(dir);let context;try{
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.clock.install({time:new Date('2026-10-02T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
 await page.addInitScript(()=>{Object.defineProperty(BaseAudioContext.prototype,'currentTime',{configurable:true,get(){return performance.now()/1000;}});let seed=0x2d23c,id=0;const queue=new Map();Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);window.WebSocket=class{constructor(){throw Error('Controlled SOLO capture');}};window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=n=>queue.delete(n);window.__capture={frames:[],step(){const callbacks=[...queue.values()];queue.clear();const t=performance.now();this.frames.push({t,callbacks:callbacks.map(f=>f.name)});for(const f of callbacks)f(t);},ready:()=>[...queue.values()].some(f=>f.name==='Ou'),state:()=>({seed,queued:queue.size})};});
 await page.goto(s.url);for(let i=0;i<250&&!await page.evaluate(()=>window.__capture?.ready());i++)await new Promise(r=>setTimeout(r,20));assert(await page.evaluate(()=>__capture.ready()),'Production frame callback ready after image load');
 {const now=await page.evaluate(()=>performance.now());assert(now<T0,'page ready before fixed schedule start');await page.clock.runFor(T0-now);}
 for(let t=T0+100;t<=T0+1000;t+=20){await page.clock.runFor(t-await page.evaluate(()=>performance.now()));await page.evaluate(()=>__capture.step());}
 await page.screenshot({path:path.join(out,label+'-menu.png'),animations:'disabled'});
 await page.evaluate(()=>{document.querySelector('#name').value='Stage H parity';document.querySelector('#enter').click();});
 for(let t=T0+1020;t<=T0+2000;t+=20){await page.clock.runFor(t-await page.evaluate(()=>performance.now()));await page.evaluate(()=>__capture.step());}
 await page.screenshot({path:path.join(out,label+'-playing.png'),animations:'disabled'});
 const state=await page.evaluate(()=>({started:__api.started(),pose:{x:__api.H.x,y:__api.H.y,angle:__api.H.angle},scale:__cameraPolicy.baseScale(innerWidth,innerHeight),elapsed:performance.now(),schedule:__capture.frames,rng:__capture.state(),spatialLoaded:!!window.TFB_VIEW}));
 const hashes={};for(const scene of ['menu','playing'])hashes[scene]=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,label+'-'+scene+'.png'))).digest('hex');rows.push({label,state,hashes,errors});fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify({browser:browser.version(),rows},null,2)+'\n');
 }finally{if(context)await context.close();await s.close();}}
 assert.deepEqual(rows[0].state,rows[1].state);assert.deepEqual(rows[0].hashes,rows[1].hashes);assert(rows.every(r=>!r.errors.length&&!r.state.spatialLoaded&&r.state.started));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',browser:browser.version(),rows,scope:'Actual production HTTP/Pixi/Canvas output; equal explicit 50 Hz RAF schedule over real fixed-tick engine, seeded SOLO fallback. No production code or pixel changes.'},null,2)+'\n');console.log('PASS exact flat menu and gameplay pixels/state');
 }finally{if(browser)await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
