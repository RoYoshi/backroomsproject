'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const BASE='b0f7c297fcd58c4e12a5666dcdfbd5624120178aaf1515080e219584d3947e60';
const root=path.resolve(__dirname,'../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function clean(v){if(v===undefined||typeof v==='function')return undefined;if(typeof v==='number'&&!Number.isFinite(v))return {$number:String(v)};if(Array.isArray(v))return v.map(q=>clean(q)??null);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().flatMap(k=>{const a=clean(v[k]);return a===undefined?[]:[[k,a]];}));return v;}
function make(scenario,seed,source,inputs,limitations=[]){return {format:'tfb-reference-v1',baseline:'v23.3.6-hqa-search-polish',baselineSha256:BASE,runtime:{node:process.version,platform:process.platform,arch:process.arch},scenario,seed,tickRate:60,source,sourceSha256:hash(fs.readFileSync(path.join(root,source))),inputs,limitations,records:[]};}
function save(out,name,data){fs.mkdirSync(out,{recursive:true});const bytes=Buffer.from(JSON.stringify(clean(data))+'\n');const zipped=zlib.gzipSync(bytes,{level:9});fs.writeFileSync(path.join(out,name+'.json.gz'),zipped);return {name,scenario:data.scenario,records:data.records.length,sha256:hash(zipped),semanticSha256:hash(bytes),bytes:zipped.length,uncompressedBytes:bytes.length};}
function pick(o,keys){return Object.fromEntries(keys.filter(k=>o&&o[k]!==undefined).map(k=>[k,clean(o[k])]));}
function diff(a,b,p='',tol=0,out=[]){if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=tol)return out;if(a===b)return out;if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){for(const k of [...new Set([...Object.keys(a),...Object.keys(b)])].sort())diff(a[k],b[k],p+'.'+k,tol,out);}else out.push({field:p,expected:a,actual:b});return out;}
module.exports={root,BASE,hash,clean,make,save,pick,diff};
