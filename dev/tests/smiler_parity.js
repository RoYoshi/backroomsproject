'use strict';
const assert=require('assert'),path=require('path');
// Optional comparison: node dev/tests/smiler_parity.js /absolute/path/to/extracted/stage2D
if(!process.argv[2]) throw Error('Provide the extracted Stage 2D game directory');
const roots=[path.resolve(process.argv[2]),require('../paths.js')];
function run(root,seed){const {World}=require(root+'/dev/harness'),w=World(seed),sm=[w.smiler(4800,3504),w.smiler(6600,3504)],ps=[w.player(5100,3504),w.player(6100,3504,{light:false})],tr=[];
 w.run(60,()=>{ps.forEach((p,i)=>{if(p.dead){w.sim.respawn(p);p.safe=0;}p.look=Math.sin(w.t*.5+i)*Math.PI;p.light=Math.floor(w.t/6)%2===i;if(!p.tx)p.go(p.x<5500?7200:4400,3504,'walk');});tr.push(JSON.stringify(sm.map(s=>({x:s.x,y:s.y,a:s.ang,state:s.state,act:s.act,target:s.target,debug:s.dbg,lead:s.mem.leads}))));});return tr;}
for(const seed of [10,20,30,40]){assert.deepStrictEqual(run(roots[0],seed),run(roots[1],seed));console.log('PASS isolated Smiler parity seed '+seed+': 3600 tick-identical states, movement, target, evidence and reasons');}
