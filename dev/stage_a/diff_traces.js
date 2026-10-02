'use strict';
const fs=require('fs'),zlib=require('zlib'),{diff}=require('./trace_io');
const [a,b,t]=process.argv.slice(2);if(!a||!b){console.error('Usage: node dev/stage_a/diff_traces.js EXPECTED.json.gz ACTUAL.json.gz [tolerance=0]');process.exit(2);}
const load=p=>JSON.parse(p.endsWith('.gz')?zlib.gunzipSync(fs.readFileSync(p)):fs.readFileSync(p,'utf8'));
const A=load(a),B=load(b),tol=t===undefined?0:Number(t);if(!Number.isFinite(tol)||tol<0)throw Error('Invalid tolerance');
for(let i=0;i<Math.max(A.records.length,B.records.length);i++){const d=diff(A.records[i],B.records[i],'record',tol);if(d.length){console.log(JSON.stringify({status:'FIRST DIVERGENT TICK',index:i,tick:A.records[i]?.tick??B.records[i]?.tick,world:A.records[i]?.world??B.records[i]?.world,fields:d.slice(0,30)},null,2));process.exit(1);}}
console.log(JSON.stringify({status:'IDENTICAL RECORDS',records:A.records.length,tolerance:tol,metadataDifferences:diff({...A,records:[]},{...B,records:[]},'metadata',0)}));
