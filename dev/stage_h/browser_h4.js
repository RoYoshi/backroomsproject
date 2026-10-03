'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),zlib=require('zlib');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {fixture,server,launch,open,diagnostics}=require('./browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const cases=[
 {id:'16x9',w:1280,h:720,dpr:1,ui:1,q:1,zoom:1,nv:false},
 {id:'16x10-small-ui',w:1280,h:800,dpr:1,ui:.5,q:1,zoom:1,nv:false},
 {id:'ultrawide',w:3440,h:1440,dpr:1,ui:1,q:1,zoom:1,nv:false},
 {id:'high-dpr',w:1280,h:720,dpr:2,ui:1.5,q:1,zoom:1,nv:false},
 {id:'4k',w:3840,h:2160,dpr:1,ui:2,q:1,zoom:1,nv:false},
 {id:'reduced',w:1280,h:720,dpr:1,ui:2,q:.5,zoom:1,nv:false},
 {id:'nv-low-zoom2',w:1280,h:800,dpr:1,ui:1,q:1,zoom:2,nv:true,ir:1},
 {id:'nv-high-zoom4-dpr',w:1280,h:720,dpr:2,ui:1,q:.5,zoom:4,nv:true,ir:2}
];
(async()=>{const s=await server(fixture());let browser,a,b;const checks=[];const record=x=>{checks.push(x);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(checks,null,2));console.log(x.name);};try{
 browser=await launch();b=await open(browser,s,'H4 upper');await b.command({c:'freeze',on:1});await b.teleport({x:160,y:160,z:180,support:'support:upper-west'});
 const make=async(kind,x,z)=>{const r=await b.command({c:'spatial-entity',kind,pose:{x,y:160,z,support:z?'support:upper-west':'support:ground-north'}});return(kind==='hound'?'h':'m')+r.msg.split(' ').at(-1);};
 const target=await make('hound',220,0),hiddenH=await make('hound',200,180),hiddenS=await make('smiler',240,180);
 await b.page.evaluate(()=>{__api.look.hat='cap';__api.gear.eq.kind=__api.H.equipment.kind='lantern';});await b.page.waitForTimeout(350);await b.command({c:'preview',k:'hound',var:'B'});
 await b.page.waitForFunction(()=>__spatial.state.aftermath[0]?.state==='SLEEPING',null,{timeout:60000});const death=await b.page.evaluate(()=>__spatial.state.aftermath[0].key),baseB=await b.inspect();let first;
 for(const c of cases){
  a=await open(browser,s,'H4 '+c.id,{viewport:{width:c.w,height:c.h},deviceScaleFactor:c.dpr});await a.teleport({x:160,y:160,z:0,support:'support:ground-north'});
  await a.page.evaluate(c=>{__settings.set('s',c.ui);const q=document.getElementById('stQuality');q.value=String(c.q);q.dispatchEvent(new Event('change'));__spatial.config.labels=true;__ents.dbgCfg.on=true;__api.gear.eq.kind=__api.H.equipment.kind=c.nv?'camcorder':'lantern';__cam.S.nvOn=c.nv;__cam.S.ir=c.ir||0;__cam.S.zoomIdx=c.zoom===4?2:c.zoom===2?1:0;},c);
  await a.page.waitForFunction(({target,hiddenS,c})=>__spatial.state.packets.some(p=>p.id===target)&&__spatial.state.packets.some(p=>p.id===hiddenS)&&__spatial.view.snapshot().groups.every(g=>g.fade===1)&&Math.abs(__cam.zoomCur-c.zoom)<.000001&&__spatial.state.last.quality===c.q,{target,hiddenS,c},{timeout:45000});
  const result=await a.page.evaluate(({target,hiddenH,hiddenS,death,c})=>{
   const s=__spatial,V=TFB_VIEW;const sm=__api.q.find(s=>'m'+s.sid===hiddenS);sm.face=1;sm.state='ATTACKING';let touches=0;const touch=__cam.touch;__cam.touch=function(...args){touches++;return touch.apply(this,args);};__cam.registerFx('smiler',{gain:4,interfere:1,static:1,glitch:1});s.render(true);__cam.touch=touch;__cam.registerFx('smiler',null);
   const opts=s.state.renderOptions,p=s.pass,actor=opts.actors.find(p=>p.id===target),screen=V.project({...actor,z:actor.z+actor.height/2},opts.camera,s.state.last.scope.scale),point={x:innerWidth/2+screen.x,y:innerHeight/2+screen.y},hit=s.pickAt(point.x,point.y),aim=s.aim(point);
   const hidden=opts.actors.filter(p=>p.death===death||[hiddenH,hiddenS].includes(p.id)||[hiddenH,hiddenS].includes(p.owner));
   const diff=(actors,lights)=>{p.render(opts);const x=p.pixels();p.render({...opts,actors,lights});const y=p.pixels();let n=0;for(let i=0;i<x.length;i+=4)if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2])n++;return n;};
   const hiddenPixels=diff(opts.actors.filter(p=>!hidden.includes(p)),opts.lights),hiddenBeam=diff(opts.actors,opts.lights.filter(l=>l.id!==death+':beam')),positive=diff(opts.actors.filter(p=>p.id!==target&&p.owner!==target),opts.lights);
   const upper=opts.actors.find(p=>p.id===hiddenH),hs=V.project({...upper,z:upper.z+upper.height/2},opts.camera,s.state.last.scope.scale),hiddenPick=s.pickAt(innerWidth/2+hs.x,innerHeight/2+hs.y);
   const times=[];for(let i=0;i<3;i++){const start=performance.now();s.render(true);p.pixels();times.push(performance.now()-start);}
   const layers=Object.fromEntries(['mp','light','peerTip','aiDebug','glitchFx'].map(id=>[id,document.getElementById(id)?getComputedStyle(document.getElementById(id)).display:'absent']));
   return {case:c,point,hit,aim,hiddenPick,hiddenPixels,hiddenBeam,positive,touches,hiddenKinds:[...new Set(hidden.map(p=>p.kind))],layers,stats:s.state.last,pipeline:s.inspect().pipeline,drainedFrameMs:times,settings:__settings.get(),uiScale:getComputedStyle(document.documentElement).getPropertyValue('--hs'),glError:p.gl.getError(),world:s.inspect().world,pose:s.inspect().network.pose,packets:s.state.packets.length,canvases:[...document.querySelectorAll('canvas')].map(v=>({id:v.id,display:getComputedStyle(v).display,width:v.width,height:v.height}))};
  },{target,hiddenH,hiddenS,death,c});
  record({name:c.id+' production matrix',...result});
  assert.equal(result.hit.actorId,target);assert.notEqual(result.hiddenPick.actorId,hiddenH);assert.equal(result.hiddenPixels,0);assert.equal(result.hiddenBeam,0);assert(result.positive>20);assert.equal(result.touches,0);assert.equal(result.glError,0);assert(result.hiddenKinds.includes('body')&&result.hiddenKinds.includes('hand:0')&&result.hiddenKinds.includes('hand:1')&&result.hiddenKinds.includes('light')&&result.hiddenKinds.includes('hat')&&result.hiddenKinds.includes('decal')&&result.hiddenKinds.includes('trail'));assert(Object.values(result.layers).every(v=>v==='none'||v==='absent'));assert(result.stats.scope.width<=1536&&result.stats.scope.height<=864);assert.equal(result.stats.occluders,32);assert(result.stats.target.width*result.stats.target.height<=4194304);assert.equal(+result.uiScale,c.ui);
  if(!first)first=result;for(const k of ['x','y','z'])assert(Math.abs(result.hit.point[k]-first.hit.point[k])<.001,'world pick changes with pixels');assert(Math.abs(result.hit.distance-first.hit.distance)<.001);assert(Math.abs(result.aim.pitch-first.aim.pitch)<.0001);
  await a.page.mouse.move(result.point.x,result.point.y);await a.page.waitForFunction(()=>__sent.some(m=>m.t==='sp'&&m.samples.some(q=>Math.abs(q.pitch||0)>.01)),null,{timeout:15000});
  const wire=await a.page.evaluate(()=>({aim:__spatial.state.aim,sample:__sent.filter(m=>m.t==='sp').at(-1).samples.at(-1)}));assert(!['camera','quality','cutaway','zoom','nv'].some(k=>k in wire.sample||k in (wire.sample.presentation||{})));record({name:c.id+' actual mouse into accepted fixed-tick input',wire});
  const unchanged=await b.inspect();for(const k of ['camera','target','quality','scope'])assert.deepEqual(unchanged.last[k],baseB.last[k]);assert.deepEqual(unchanged.cutaway,baseB.cutaway);assert.equal(unchanged.world.contentHash,result.world.contentHash);for(const k of ['x','y','z','generation','support'])assert.equal(unchanged.network.pose[k],baseB.network.pose[k]);
  a.validate();await a.page.screenshot({path:path.join(out,c.id+'.png')});await a.context.close();a=null;
 }
 b.validate();await b.page.screenshot({path:path.join(out,'independent-upper.png')});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',browser:browser.version(),gpu:baseB.gpu,checks,independentUpper:baseB,performance:'Software SwiftShader only; timings are regression evidence, not hardware/capacity certification.'},null,2));console.log('PASS Z30 production viewport/quality/aim/leak matrix');
 }catch(e){for(const [i,ctx]of (browser?.contexts()||[]).entries()){const c=ctx.__evidence;if(c){await c.page.screenshot({path:path.join(out,i+'-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,i+'-diagnostic.json.gz'),zlib.gzipSync(JSON.stringify({...c,page:undefined,state:await diagnostics(c).catch(e=>String(e))},null,2)));}}fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),stack:e.stack,checks,server:s.log},null,2));throw e;}finally{if(browser)await browser.close();await s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
