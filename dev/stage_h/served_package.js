'use strict';
// Actual flat and spatial host routes, immutable module bytes and private paths.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),vm=require('vm');
const {server}=require('../stage_f/wire'),{fixture}=require('../stage_e/fixture'),{get}=require('../stage_d/browser_support');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{const checks=[];for(const spatial of [false,true]){
 const definition=spatial?fixture():null,s=await server(definition);
 try{
  const html=await get(s.port,'/');assert.equal(html.status,200);const text=html.bytes.toString();
  const files=['camera_policy.js','timing_policy.js','levels/level0.js','world_geometry.js','world_motion.js','spatial_protocol.js','spatial_history.js','world_view.js','spatial_client.js','world.js','move.js','ents.js','mp.js','hud.js','gore.js','dphys.js','light.js','glitch.js','camcorder.js','inventory.js','sfx.js','assets/index-DKbV5Nv9.js'];
  const modules=[];for(const file of files){const r=await get(s.port,'/'+file);assert.equal(r.status,200,file);assert(r.bytes.equals(fs.readFileSync(path.join(root,file))),file);modules.push({file,status:r.status,sha256:sha(r.bytes)});}
  const config=await get(s.port,'/world_config.js');assert.equal(config.status,spatial?200:404);
  if(spatial){const context={window:{}};vm.runInNewContext(config.bytes.toString(),context);assert.equal(JSON.stringify(context.window.TFB_WORLD),JSON.stringify(definition));for(const file of ['world_config.js','world_view.js','spatial_client.js'])assert(text.indexOf('/'+file)<text.indexOf('./assets/index-DKbV5Nv9.js'));}
  else{assert(html.bytes.equals(fs.readFileSync(path.join(root,'index.html'))));assert(!text.includes('spatial_client.js'));}
  const rejected=[];for(const [url,status]of [['/server.js',404],['/sim.js',404],['/spatial_authority.js',404],['/death_srv.js',404],['/dev/stage_h/H4_STATUS.md',404],['/%',400],['/%00',400],['/assets/../../server.js',404]]){assert.equal((await get(s.port,url)).status,status,url);assert.equal((await get(s.port,'/')).status,200);rejected.push({url,status});}
  checks.push({mode:spatial?'spatial':'flat-compat',modules,configStatus:config.status,rejected});
 }finally{await s.close();}}
 const result={status:'PASS',checks,runtime:process.version};fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
