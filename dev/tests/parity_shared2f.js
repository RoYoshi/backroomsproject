/* Controlled parity, not historical seed equivalence. Actual species/senses/physics;
 * fixed same traits, initial state, and .5 random draws in both implementations.
 * Stationary visible players ensure identical observations between perception updates.
 * Anonymous sound, multiple conflicting leads and habit-conditioned searches are deliberate 2F exceptions. */
'use strict';
const assert=require('assert'),path=require('path');
if(!process.argv[2])throw Error('Provide extracted Stage 2E directory');
const roots=[path.resolve(process.argv[2]),require('../paths')];
function run(root,kind,light,look,group){const {World,AI}=require(root+'/dev/harness'),w=World(913),e=w[kind](5000,3504);w.eng.rng=()=>.5;e.rng=()=>.5;if(e.streams)for(const k in e.streams)e.streams[k]=()=>.5;e.tr={...AI.SPECIES[kind].traits};e.sp.init(w.eng,e);e.ang=0;e.thinkT=0;e.tierT=1e9;e.act=kind==='hound'?'rest':e.act;e.rest=1e9;w.player(5450,3504,{light,angle:look?Math.PI:0});if(group)w.player(5540,3540,{light:false});const out=[];w.run(8,()=>{out.push(JSON.stringify({x:e.x,y:e.y,a:e.ang,s:e.state,act:e.act,t:e.target,sp:e.speed,ag:e.ag,eye:e.eyeT,watch:e.watchT,path:e.path,hold:e.holdT,cap:!!e.cap}));});return out;}
let n=0;for(const kind of ['hound','smiler'])for(const light of [false,true])for(const look of [false,true])for(const group of [false,true]){const a=run(roots[0],kind,light,look,group),b=run(roots[1],kind,light,look,group);try{assert.deepStrictEqual(a,b);console.log(`PASS ${kind} light=${light} gaze=${look} group=${group}: ${a.length} identical ticks`);n+=a.length;}catch(err){const i=a.findIndex((v,j)=>v!==b[j]);console.log(`FAIL ${kind} light=${light} gaze=${look} group=${group} first tick ${i}\nold ${a[i]}\nnew ${b[i]}`);process.exitCode=1;}}
console.log(`${n} tick pairs identical across complete passing cases`);
