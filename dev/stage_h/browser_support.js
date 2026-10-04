'use strict';
const assert=require('assert');
const {launch}=require('../stage_d/browser_support'),{server}=require('../stage_f/wire'),{fixture}=require('../stage_e/fixture');
async function open(browser,s,name,options={}) {
 const context=await browser.newContext({viewport:{width:960,height:600},...options}),page=await context.newPage(),errors=[],consoleErrors=[],failed=[],http=[];
 context.__evidence={page,errors,consoleErrors,failed,http};
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.text().includes('GL_INVALID'))consoleErrors.push(m.text());});
 page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1'))http.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{const Native=WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);window.__wire=this;window.__messages=[];window.__sent=[];window.__commands=[];window.__aresSerial=0;const send=this.send.bind(this);this.send=value=>{const m=JSON.parse(value);__sent.push({...m,pass:undefined});if(m.t!=='sp')__commands.push({...m,pass:undefined});if(__sent.length>500)__sent.shift();send(value);};this.addEventListener('message',e=>{const m=JSON.parse(e.data);__messages.push(m);if(m.t==='ares')__aresSerial++;if(__messages.length>1000)__messages.shift();});}};});
 await page.goto('http://127.0.0.1:'+s.port+'/?room=stage-h');
 const bootAt=Date.now();await page.waitForFunction(()=>window.__spatial?.state.ready&&window.__net?.on,null,{timeout:120000});context.__evidence.readyWaitMs=Date.now()-bootAt;
 await page.locator('#name').fill(name);await page.locator('#enter').click();
 await page.waitForFunction(()=>__api.started()&&__net.spatialState()?.pose?.generation>0&&__spatial.state.packets.length>0,null,{timeout:30000});
 await page.evaluate(pass=>__net.testAuth(pass),process.env.ADMIN_PASSCODE);await page.waitForFunction(()=>__messages.some(m=>m.t==='admin'&&m.ok));
 const command=async m=>{
  const paused=await page.evaluate(()=>__api.paused());
  if(!paused)await page.evaluate(()=>document.querySelector('#help').click());
  // Freeze local input through the real pause UI while old proposals drain.
  // The authoritative world and its fixed tick keep running normally.
  await page.waitForTimeout(250);
  await page.evaluate(m=>{window.__commandStart=__aresSerial;const p=__net.spatialState().pose;__wire.send(JSON.stringify({...m,t:'a',worldEpoch:p.worldEpoch,life:p.generation,ack:p.discontinuity}));},m);
  await page.waitForFunction(()=>__aresSerial>__commandStart);
  const r=await page.evaluate(()=>__messages.filter(v=>v.t==='ares').at(-1));
  if(!paused)await page.evaluate(()=>__api.unpause());
  assert(r.ok,JSON.stringify(r));return r;
 };
 const teleport=async pose=>{await command({c:'spatial-tp',pose});await page.waitForFunction(p=>Math.hypot(__api.H.x-p.x,__api.H.y-p.y,__api.H.z-p.z)<.15,pose,{timeout:15000});};
 const inspect=()=>page.evaluate(()=>__spatial.inspect());
 const validate=()=>{assert.deepEqual(errors,[]);assert(!consoleErrors.some(s=>s.includes('GL_INVALID')),consoleErrors.join('\n'));assert(!failed.some(r=>r.url.startsWith('http://127.0.0.1')));assert(!http.some(r=>r.status>=400));};
 await command({c:'god',id:await page.evaluate(()=>__api.H.id)});
 return {context,page,command,teleport,inspect,validate,errors,consoleErrors,failed,http};
}
async function pixels(page) {return page.evaluate(()=>{const before=__spatial.state.frames;__spatial.render(true);if(__spatial.state.frames!==before+1)throw Error('Forced production capture did not advance exactly one frame');const p=__spatial.pass.pixels();let hash=2166136261,lit=0;for(let i=0;i<p.length;i+=4){if(p[i]+p[i+1]+p[i+2]>30)lit++;for(let j=0;j<3;j++)hash=Math.imul(hash^p[i+j],16777619)>>>0;}return{hash:hash.toString(16),lit,frameBefore:before,frameAfter:__spatial.state.frames,error:__spatial.pass.gl.getError()};});}
async function diagnostics(c){return c.page.evaluate(()=>({spatial:window.__spatial?.inspect(),netOn:window.__net?.on,boot:performance.getEntriesByType('navigation').map(n=>({load:n.loadEventEnd,dom:n.domContentLoadedEventEnd})),events:window.__messages?.filter(m=>m.t!=='s'),lastMessages:window.__messages?.slice(-3),commands:window.__commands,sent:window.__sent?.slice(-10)}));}
module.exports={open,pixels,diagnostics,launch,server,fixture};
