'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib'),assert=require('assert'),{spawnSync}=require('child_process'),{hash,diff}=require('../stage_a/trace_io');
const root=path.resolve(__dirname,'../..'),manifest=require('./stageA-manifest.json');
const allowed=['assets/index-DKbV5Nv9.js','dev/sim_head.js','dev/sim_glue.js','index.html','server.js','sim.js','world.js'];
const run=(file,args=[])=>{const r=spawnSync(process.execPath,[path.join(root,file),...args],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;};
const changed=[];for(const [f,h] of Object.entries(manifest)){assert(fs.existsSync(path.join(root,f)),'Missing '+f);if(hash(fs.readFileSync(path.join(root,f)))!==h){assert(allowed.includes(f),'Unexpected original edit '+f);changed.push(f);}}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tfb-stage-b-'));const result={status:'PASS',runtime:process.version,changed,unchangedOriginals:Object.keys(manifest).length-changed.length,traces:0,records:0,metadataDifferences:[]};
try{
 run('dev/stage_b/test_geometry.js');
 const current=path.join(temp,'map.json.gz');run('dev/stage_b/export_world.js',[root,current]);assert(fs.readFileSync(current).equals(fs.readFileSync(path.join(__dirname,'level0-baseline.json.gz'))),'Map/data/nav/query/seed parity');result.mapExport='BYTE IDENTICAL';
 for(const group of ['motor','ai','death','navigation','network']){console.log('Capture '+group);run('dev/stage_a/capture_'+group+'.js',[temp]);const index=JSON.parse(fs.readFileSync(path.join(root,'dev/stage_a/traces',group+'-index.json')));
 for(const i of index){const name=i.name+'.json.gz',load=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(p))),a=load(path.join(root,'dev/stage_a/traces',name)),b=load(path.join(temp,name));
 const rd=diff(a.records,b.records);if(rd.length){const first=rd[0];throw Error('FIRST DIVERGENT TICK / FIELD '+name+' '+JSON.stringify(first));}
 const {records:ar,...am}=a,{records:br,...bm}=b,md=diff(am,bm);
 for(const d of md){assert(i.name==='network-lifecycle'&&d.field==='.sourceSha256','Unexpected metadata '+name+' '+JSON.stringify(d));assert.equal(d.actual,hash(fs.readFileSync(path.join(root,'dev/sim_glue.js'))));result.metadataDifferences.push({trace:i.name,...d});}
 result.traces++;result.records+=b.records.length;
 }}assert.equal(result.traces,46);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
