'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),G=require('../../world_geometry'),M=require('../../world_motion');
process.env.ADMIN_PASSCODE=require('crypto').randomBytes(24).toString('hex');
const {server,launch,open,pixels,diagnostics}=require('../stage_h/browser_support');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{const d=require('../../levels/level0_spatial.json'),g=G.compile(d),s=await server(d),rows=[];let browser,a,b;
const save=(status,error)=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status,rows,error:error&&String(error),server:s.log},null,2));
const ready=async c=>{await c.page.waitForFunction(()=>{const s=__spatial.state,h=__api.H;return Math.hypot(s.last.camera.x-h.x,s.last.camera.y-h.y)<.1&&s.last.cutaway.groups.filter(g=>g.target).every(g=>g.fade===1);},null,{timeout:60000});};
const tp=async(c,p,shape=M.PROFILES.stand)=>{const q=g.supports(shape,p,[p.z-.01,p.z+.01])[0];assert(q);await c.teleport({...p,support:q.id});await ready(c);};
const capture=async(c,name)=>{const pix=await pixels(c.page),state=await c.inspect();rows.push({name,pix,state});save('IN_PROGRESS');assert.equal(pix.error,0);assert(pix.lit>1000);assert.equal(state.last.occluders,910);assert(state.last.ignoredContinuousCeilings>200);await c.page.screenshot({path:path.join(out,name+'.png')});return state;};
const hidden=async(c,id,name)=>{const r=await c.page.evaluate(id=>{const s=__spatial,p=s.pass,opts=s.state.renderOptions,gl=p.gl;
 p.render(opts);const a=p.pixels();p.render({...opts,actors:opts.actors.filter(p=>p.id!=='p'+id&&p.owner!=='p'+id),lights:opts.lights.filter(l=>l.id!=='p'+id)});const b=p.pixels();let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;
 p.render(opts);p.renderer.resetState();return {changed,error:gl.getError(),peer:s.state.packets.find(p=>p.id==='p'+id)};},id);rows.push({name,...r});save('IN_PROGRESS');assert.equal(r.changed,0,name);assert.equal(r.error,0);};
try{
 browser=await launch();a=await open(browser,s,'3B inside');b=await open(browser,s,'3B outside');await a.command({c:'freeze',on:1});
 await a.page.evaluate(()=>__spatial.config.quality=.5);await b.page.evaluate(()=>__spatial.config.quality=.5);
 await tp(a,{x:1584,y:864,z:0});await a.page.bringToFront();await a.page.keyboard.down('c');await a.page.waitForFunction(()=>__mv.crouch);await a.page.keyboard.up('c');
 await a.page.keyboard.down('d');try{await a.page.waitForFunction(()=>__api.H.x>1768&&__api.H.shape.height===24,null,{timeout:90000});}finally{await a.page.keyboard.up('d');}await a.page.waitForFunction(()=>Math.abs(__api.H.vx)<.1);await ready(a);await tp(b,{x:1536,y:864,z:0});
 // HQ2: the crawler's beam previously pointed wherever the Enter click left the
 // mouse (toward the open mouth). Light physically escaping the mouth is truth,
 // not a leak, so aim deterministically along the tunnel (east, the crawl
 // direction) and wait until the outside client receives that beam.
 const crawler=await a.page.evaluate(()=>__api.H.id);await a.page.mouse.move(await a.page.evaluate(()=>innerWidth/2+300),await a.page.evaluate(()=>innerHeight/2));
 await a.page.waitForFunction(()=>Math.abs(__spatial.state.aim?.yaw??1)<.01,null,{timeout:30000});
 await b.page.waitForFunction(id=>{const l=__spatial.state.lights?.find(l=>l.id==='p'+id);return l&&l.direction.x>.99;},crawler,{timeout:30000});
 let inside=await capture(a,'north-inside'),outside=await capture(b,'north-outside');const aid=await a.page.evaluate(()=>__api.H.id),bid=await b.page.evaluate(()=>__api.H.id);
 assert.equal(inside.cutaway.groups.find(g=>g.id==='view:crawl:north:roof').fade,1);assert.equal(outside.cutaway.groups.find(g=>g.id==='view:crawl:north:roof').fade,0);
 await hidden(b,aid,'outside NORTH receives no hidden crawl peer or beam');
 // The ceiling convention remains constant even if local-cover cutaway is off.
 await b.page.evaluate(()=>__spatial.config.cutaway=false);const continuous=await capture(b,'north-continuous-cutaway-off');assert.equal(continuous.last.ignoredContinuousCeilings,outside.last.ignoredContinuousCeilings);await b.page.evaluate(()=>__spatial.config.cutaway=true);
 await a.page.bringToFront();await a.page.keyboard.down('a');try{await a.page.waitForFunction(()=>__api.H.x<1590,null,{timeout:90000});}finally{await a.page.keyboard.up('a');}await a.page.waitForFunction(()=>Math.abs(__api.H.vx)<.1);
 await a.page.keyboard.down('c');await a.page.waitForFunction(()=>!__mv.crouch);await a.page.keyboard.up('c');await a.page.waitForFunction(()=>__api.H.shape.height===60);
 await tp(a,{x:6192,y:864,z:0});await tp(b,{x:6192,y:864,z:180});
 for(const c of [a,b]){await c.page.evaluate(()=>{__api.gear.eq.kind=__api.H.equipment.kind='lantern';});await c.page.waitForFunction(()=>__spatial.state.lights.some(l=>l.id==='p'+__api.H.id&&l.kind==='lantern'));}
 inside=await capture(a,'long-lower');outside=await capture(b,'long-upper');
 assert.equal(inside.cutaway.groups.find(g=>g.id==='view:long-room:upper-slab').fade,1);assert.equal(outside.cutaway.groups.find(g=>g.id==='view:long-room:upper-slab').fade,0);
 await hidden(a,bid,'lower LONG receives no hidden upper peer or beam');await hidden(b,aid,'upper LONG receives no hidden lower peer or beam');
 assert.notEqual(inside.presentation.camera.z,outside.presentation.camera.z);a.validate();b.validate();save('PASS');console.log('PASS production two-client NORTH cover, continuous rooms, LONG overlap and hidden peer/beam pixel equality');
}catch(e){save('FAIL',e);for(const [name,c]of [['a',a],['b',b]])if(c){await c.page.screenshot({path:path.join(out,'failure-'+name+'.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'diagnostic-'+name+'.json'),JSON.stringify(await diagnostics(c),null,2));}throw e;}finally{await browser?.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
