'use strict';
// Stage H acceptance: these gates launch real served production Pixi clients.
// Missing browser dependencies, timeouts, pixel leaks and HTTP/GL errors fail.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'../..'),cache=new Map(),scripts={Z29:['browser_h2.js'],Z30:['browser_h3.js','browser_h4.js']};
let destination;
function run(file){
 if(!cache.has(file)){
  if(!destination){const base=path.resolve(process.env.TFB_EVIDENCE_DIR||path.join(root,'dev/stage_h/evidence/view25d'));fs.mkdirSync(base,{recursive:true});destination=fs.mkdtempSync(path.join(base,'browser-'));}
  const out=path.join(destination,file.replace('.js',''));fs.mkdirSync(out);
  const r=spawnSync(process.execPath,[path.join(root,'dev/stage_h',file),out],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:16*1024*1024}),output=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');
  fs.writeFileSync(path.join(out,'process.log'),output);let result;try{result=JSON.parse(fs.readFileSync(path.join(out,'result.json')));}catch{}
  const ok=r.status===0&&result?.status==='PASS';cache.set(file,{ok,note:file+' '+(ok?'PASS':'FAIL')+' (real browser evidence: '+out+')',output});
 }
 return cache.get(file);
}
const cases=require('../stage_a/future_matrix.json').filter(x=>x.entry==='view25d').map(x=>({name:x.id+' '+x.scenario,fn:()=>{const rows=scripts[x.id].map(run);return {ok:rows.every(r=>r.ok),note:rows.map(r=>r.note).join('; ')+(x.id==='Z30'?'; coordinates H-Z14 real visible/IR/aftermath acceptance':'')};}}));
if(require.main===module){let failed=0;for(const c of cases){const r=c.fn();console.log((r.ok?'PASS ':'FAIL ')+c.name+' '+r.note);failed+=!r.ok;}if(failed)for(const r of cache.values())if(!r.ok)console.error(r.output);console.log((cases.length-failed)+'/'+cases.length+' view25d gates passed');process.exitCode=failed?1:0;}
module.exports=cases;
