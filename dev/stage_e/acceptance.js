'use strict';
// Invoke implemented objective suites; preserve the frozen authority matrix.
const matrix=require('../stage_a/future_matrix.json');
const suites={core:()=>require('./test_core').run(),motion:()=>require('./test_motion').run(),sensors:()=>require('./test_sensors').run(),entities:()=>require('./test_entities').run()};
const required={Z10:['motion','entities'],Z11:['core','motion'],Z12:['entities'],Z13:['sensors'],Z14:['sensors','entities'],Z15:['sensors','entities'],Z16:['entities'],Z17:['entities']};
const results=new Map();
function cases(ids){return ids.map(id=>({name:id+' '+matrix.find(r=>r.id===id).scenario,fn(){
 const evidence=[];
 for(const name of required[id]){if(!results.has(name))results.set(name,suites[name]());const result=results.get(name);if(result.status!=='PASS')throw Error(name+' failed');evidence.push(name+': '+result.groups+' objective groups');}
 return {ok:true,note:'Stage E scope; real geometry/motion/generated AI: '+evidence.join(', ')};
}}));}
function standalone(rows){let pass=0;for(const row of rows){try{const r=row.fn();if(r.ok)pass++;console.log((r.ok?'PASS ':'FAIL ')+row.name+' '+r.note);}catch(e){console.error('FAIL '+row.name,e);}}console.log(pass+'/'+rows.length+' passed');if(pass!==rows.length)process.exitCode=1;}
module.exports={cases,standalone};
