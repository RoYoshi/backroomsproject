'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {fixture,server,launch,open,diagnostics}=require('./browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
async function difference(page,id) {return page.evaluate(id=>{const s=__spatial,p=s.pass,l=s.state.last,opts={camera:l.camera,eye:l.eye,view:s.view,actors:s.state.packets};p.render(opts);const a=p.pixels();p.render({...opts,actors:opts.actors.filter(p=>p.id!==id&&p.owner!==id)});const b=p.pixels();let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;p.render(opts);return{changed,glError:p.gl.getError(),packet:opts.actors.find(p=>p.id===id)};},id);}
(async()=>{const s=await server(fixture());let browser,a,b;const checks=[];try{
 browser=await launch();a=await open(browser,s,'H2 lower');b=await open(browser,s,'H2 upper');await a.command({c:'freeze',on:1});
 await a.teleport({x:160,y:160,z:0,support:'support:ground-north'});await b.teleport({x:160,y:160,z:180,support:'support:upper-west'});
 await a.page.waitForFunction(()=>__spatial.view.snapshot().groups.every(g=>g.fade===1),null,{timeout:15000});await b.page.waitForFunction(()=>__spatial.view.snapshot().groups.every(g=>g.fade===0),null,{timeout:15000});const initial=[await a.inspect(),await b.inspect()];assert.equal(initial[0].world.contentHash,initial[1].world.contentHash);assert.equal(initial[0].network.world.worldEpoch,initial[1].network.world.worldEpoch);assert.equal(initial[0].cutaway.groups[0].fade,1);assert.equal(initial[1].cutaway.groups[0].fade,0);
 checks.push({name:'Z29 same authoritative world; same XY lower and upper clients',initial});
 const aid=await a.page.evaluate(()=>__api.H.id),bid=await b.page.evaluate(()=>__api.H.id);
 await a.page.waitForFunction(id=>__spatial.state.packets.some(p=>p.id==='p'+id),bid);await b.page.waitForFunction(id=>__spatial.state.packets.some(p=>p.id==='p'+id),aid);
 const peerMasks=[await difference(a.page,'p'+bid),await difference(b.page,'p'+aid)];assert(peerMasks.every(p=>p.packet&&p.changed===0&&p.glError===0));checks.push({name:'upper/lower live peer fragments make zero pixels through slab',peerMasks});
 const upper=await a.command({c:'spatial-entity',kind:'hound',pose:{x:200,y:160,z:180,support:'support:upper-west'}}),uid='h'+upper.msg.split(' ').at(-1);
 const lower=await a.command({c:'spatial-entity',kind:'hound',pose:{x:220,y:160,z:0,support:'support:ground-north'}}),lid='h'+lower.msg.split(' ').at(-1);
 await a.page.waitForFunction(ids=>ids.every(id=>__spatial.state.packets.some(p=>p.id===id)),[uid,lid]);
 const masks={hidden:await difference(a.page,uid),visible:await difference(a.page,lid)};assert.equal(masks.hidden.changed,0);assert(masks.visible.changed>20);checks.push({name:'full procedural Hound (including eyes) hidden negative and visible positive control',masks});
 const su=await a.command({c:'spatial-entity',kind:'smiler',pose:{x:240,y:200,z:180,support:'support:upper-west'}}),sid='m'+su.msg.split(' ').at(-1);
 await a.page.waitForFunction(id=>__spatial.state.packets.some(p=>p.id===id),sid);
 const smiler=await a.page.evaluate(id=>{const s=__api.q.find(s=>'m'+s.sid===id);s.face=1;s.state='ATTACKING';__spatial.render();return {id,face:s.face,pose:__spatial.state.packets.find(p=>p.id===id)};},sid);
 const smilerMask=await difference(a.page,sid);assert.equal(smilerMask.changed,0);checks.push({name:'adversarial fully displayed real Smiler face stays masked',smiler,smilerMask});
 const baseB=await b.inspect();await a.page.evaluate(()=>{__spatial.config.cutaway=false;__spatial.config.camera={x:160,y:160,z:30};__spatial.config.quality=.5;__cam.S.nvOn=false;});await a.page.waitForFunction(()=>__spatial.view.snapshot().groups.every(g=>g.fade===0),null,{timeout:15000});
 const changed=[await a.inspect(),await b.inspect()];assert.equal(changed[0].cutaway.groups[0].fade,0);assert.deepEqual(changed[1].cutaway,baseB.cutaway);assert.deepEqual(changed[1].last.target,baseB.last.target);assert.deepEqual(changed[1].last.camera,baseB.last.camera);assert.equal(changed[1].last.quality,baseB.last.quality);assert.equal(changed[0].world.contentHash,initial[0].world.contentHash);
 for(let i=0;i<2;i++)for(const k of ['x','y','z','support','generation'])assert.equal(changed[i].network.pose[k],initial[i].network.pose[k]);
 checks.push({name:'A camera/cutaway/NV/quality leaves B and physical poses unchanged',changed});
 await a.page.evaluate(()=>{__spatial.config.cutaway=true;__spatial.config.camera=null;__spatial.config.quality=1;__spatial.config.labels=true;});await a.page.waitForFunction(()=>__spatial.view.snapshot().groups.every(g=>g.fade===1)&&__spatial.state.packets.some(p=>p.kind==='label'),null,{timeout:15000});
 await a.page.evaluate(()=>{__ents.dbgCfg.on=true;__ents.drawDebug(null,{cam:__spatial.state.last.camera,sc:__spatial.state.last.scope.scale,W:innerWidth,H:innerHeight});});
 const layers=await a.page.evaluate(()=>Object.fromEntries(['mp','light','peerTip','aiDebug','glitchFx'].map(id=>[id,document.getElementById(id)?getComputedStyle(document.getElementById(id)).display:'absent'])));
 await a.page.screenshot({path:path.join(out,'lower-labels-debug.png')});await b.page.screenshot({path:path.join(out,'upper.png')});
 checks.push({name:'independent world layers mask policy',layers});assert(Object.values(layers).every(x=>x==='none'||x==='absent'),'legacy world-space Canvas/DOM layers cannot bypass mask');
 const labels=await a.page.evaluate(()=>__spatial.state.packets.filter(p=>p.kind==='label'));assert(labels.some(p=>p.owner===lid)&&!labels.some(p=>p.owner===uid),'production labels use physical visibility before masked composition');
 assert.equal((await difference(a.page,uid)).changed,0);a.validate();b.validate();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',browser:browser.version(),gpu:changed[0].gpu,checks,labels,errors:[a.errors,b.errors],resources:[a.http,b.http]},null,2));console.log('PASS Z29 production two-client independence and depth/masks');
 }catch(e){for(const [id,c]of [['a',a],['b',b]])if(c){await c.page.screenshot({path:path.join(out,id+'-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,id+'-diagnostic.json'),JSON.stringify(await diagnostics(c),null,2));}fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),stack:e.stack,checks,server:s.log},null,2));throw e;}finally{if(browser)await browser.close();await s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={difference};
