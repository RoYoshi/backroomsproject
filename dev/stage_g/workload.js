'use strict';
const assert=require('assert'),create=require('../../sim'),{field}=require('../stage_f/fixture');
function workload(count,extra={}){const sim=create({world:field(),seed:992,director:false,worldEpoch:()=> 'g4:bounded',...extra});const players=[];for(let i=0;i<count;i++){const p=sim.addPlayer(i+1);sim.join(p,0);Object.assign(p,{x:350+i*220,y:600});players.push(p);}for(const p of players){assert(sim.admin.previewKill(p,'hound','A').ok);sim.removePlayer(p);}return sim;}
module.exports={workload};
