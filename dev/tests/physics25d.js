'use strict';
// Stage G activation of the five original matrix gates. These execute the real
// shared kernel, server simulation, WebSocket lifecycle and spatial protocol.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const scripts={Z25:['test_g1.js','test_variants.js','test_initial.js'],Z26:['test_g3_wire.js','test_lifecycle.js'],Z27:['test_g3.js','test_g3_wire.js'],Z28:['test_g2.js'],Z31:['test_properties.js']},cache=new Map();
function run(file){if(!cache.has(file)){const r=spawnSync(process.execPath,[path.join(__dirname,'../stage_g',file)],{cwd:path.join(__dirname,'../..'),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024}),output=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');
 if(process.env.TFB_EVIDENCE_DIR){fs.mkdirSync(process.env.TFB_EVIDENCE_DIR,{recursive:true});let name=path.join(process.env.TFB_EVIDENCE_DIR,file+'.log'),i=1;while(fs.existsSync(name))name=path.join(process.env.TFB_EVIDENCE_DIR,file+'.'+i+++'.log');fs.writeFileSync(name,output);}
 cache.set(file,{ok:r.status===0,note:file+' exit '+r.status,output});}return cache.get(file);}
const matrix=require('../stage_a/future_matrix.json').filter(x=>x.entry==='physics25d');
const cases=matrix.map(x=>({name:x.id+' '+x.scenario,fn:()=>{const rows=scripts[x.id].map(run);return {ok:rows.every(r=>r.ok),note:rows.map(r=>r.note).join('; ')};}}));
if(require.main===module){let failed=0;for(const c of cases){const r=c.fn();console.log((r.ok?'PASS ':'FAIL ')+c.name+' '+r.note);failed+=!r.ok;}if(failed)for(const r of cache.values())if(!r.ok)console.error(r.output);console.log((cases.length-failed)+'/'+cases.length+' physics25d gates passed');process.exitCode=failed?1:0;}
module.exports=cases;
