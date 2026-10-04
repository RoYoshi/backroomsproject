'use strict';
// Real production WorldDefinition through the normal server, plus actual wire join.
const fs=require('fs'),assert=require('assert'),vm=require('vm'),crypto=require('crypto');
const {server,connect}=require('../stage_f/wire'),{get}=require('../stage_d/browser_support');
(async()=>{const d=require('../../levels/level0_spatial.json'),s=await server(d);let client;try{
 const html=await get(s.port,'/'),config=await get(s.port,'/world_config.js');assert.equal(html.status,200);assert.equal(config.status,200);
 const context={window:{}};vm.runInNewContext(config.bytes.toString(),context);assert.equal(JSON.stringify(context.window.TFB_WORLD),JSON.stringify(d));
 const modules=[];for(const name of ['world_view.js','spatial_client.js','world_geometry.js','world_motion.js','mp.js','glitch.js','assets/index-DKbV5Nv9.js']){const r=await get(s.port,'/'+name);assert.equal(r.status,200);assert(r.bytes.equals(fs.readFileSync(require('path').resolve(__dirname,'../..',name))));modules.push({name,status:r.status,sha256:crypto.createHash('sha256').update(r.bytes).digest('hex')});}
 client=await connect(s,d,'part3a-package');await client.join();const pose=client.client.pose;assert.equal(pose.z,0);assert(pose.support);assert.equal(client.hi.protocol.geometryHash,d.contentHash);
 const result={status:'PASS',runtime:process.version,hash:d.contentHash,solids:d.solids.length,worldConfigBytes:config.bytes.length,worldConfigExact:true,modules,pose,protocol:client.hi.protocol};fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log('PASS normal production server, exact content and real spatial wire join');
 }finally{if(client)client.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
