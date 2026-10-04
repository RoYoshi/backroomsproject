'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
function suite(label){
 const base=path.resolve(process.env.TFB_EVIDENCE_DIR||path.join(os.tmpdir(),'tfb-stage-i'));
 fs.mkdirSync(base,{recursive:true});const out=fs.mkdtempSync(path.join(base,label+'-')),cache=new Map();
 function run(name,args,timeout=300000){if(cache.has(name))return cache.get(name);
  const start=performance.now(),r=spawnSync(args[0],args.slice(1),{cwd:root,encoding:'utf8',timeout,maxBuffer:32*1024*1024,env:{...process.env,TFB_EVIDENCE_DIR:path.join(out,name+'-raw')}});
  fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):''));
  const row={name,command:args,exitCode:r.status,signal:r.signal,seconds:(performance.now()-start)/1000,ok:r.status===0,evidence:path.join(out,name+'.log')};cache.set(name,row);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({runtime:process.version,rows:[...cache.values()]},null,2));return row;
 }
 return {out,run,root};
}
function standalone(cases){let pass=0;for(const c of cases){try{const r=c.fn();console.log((r.ok?'PASS ':'FAIL ')+c.name+' '+r.note);pass+=!!r.ok;}catch(e){console.error('FAIL '+c.name,e);}}console.log(pass+'/'+cases.length+' passed');process.exitCode=pass===cases.length?0:1;}
module.exports={suite,standalone};
