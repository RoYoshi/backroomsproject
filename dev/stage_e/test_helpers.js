'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
// Expose existing functions for component tests without changing their source,
// replacing brains, scripting decisions, or adding production test hooks.
function internalAI(){
 const filename=path.resolve(__dirname,'../../ai.js'),source=fs.readFileSync(filename,'utf8'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
 const marker='return { create, S, SNAMES';if(!source.includes(marker))throw Error('AI export marker changed');
 m._compile(source.replace(marker,'return { updateVision, visualObservation, facedBy, touching, beginCapture, addLead, noteEv, perc, beamsOf, observeBeam, inferLead, lightSense, setState, follow, goTo, plan, directTo, tierOf, '+ 'create, S, SNAMES'),filename);return m.exports;
}
const player=(extra={})=>({id:1,x:220,y:168,z:0,st:0,posture:'stand',vx:0,vy:0,vz:0,sp:0,angle:Math.PI,pitch:0,alive:true,caught:false,light:false,kind:'flashlight',stamina:100,ex:0,prof:1,...extra});
module.exports={internalAI,player};
