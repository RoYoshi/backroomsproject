'use strict';
// Stage F real server/client gates; no fixture-only placeholder passes.
const fs=require('node:fs');
const {spawnSync}=require('node:child_process'),path=require('node:path');
const scripts={Z20:['test_f3.js','test_motor_wire.js','test_modes_latency.js'],Z21:['test_f3.js','test_limits.js','test_gait_wire.js'],Z22:['test_reconnect_wire.js'],Z23:['test_f4.js','test_history_wire.js'],Z24:['test_lifecycle.js']},cache=new Map();
function run(file){if(!cache.has(file)){const r=spawnSync(process.execPath,[path.join(__dirname,'../stage_f',file)],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});if(process.env.TFB_EVIDENCE_DIR){fs.mkdirSync(process.env.TFB_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.TFB_EVIDENCE_DIR,file+'.log'),r.stdout+r.stderr);}
cache.set(file,{ok:r.status===0,note:file+' exit '+r.status,output:r.stdout+r.stderr});}return cache.get(file);}
const cases=Object.entries(scripts).map(([id,files])=>({name:id+' Stage F real protocol acceptance',fn:()=>{const rows=files.map(run);return {ok:rows.every(r=>r.ok),note:rows.map(r=>r.note).join('; ')};}}));
if(require.main===module){let failed=0;for(const c of cases){const r=c.fn();console.log((r.ok?'PASS ':'FAIL ')+c.name+' '+r.note);failed+=!r.ok;}if(failed)for(const r of cache.values())if(!r.ok)console.error(r.output);process.exitCode=failed?1:0;}
module.exports=cases;
