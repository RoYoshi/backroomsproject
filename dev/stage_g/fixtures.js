'use strict';
const {G,M,world:baseWorld,box,clone}=require('../stage_c/helpers'),DP=require('../../death_srv').DP;
function world(solids,o={}){return baseWorld(solids,{bounds:{min:{x:-2000,y:-2000,z:-10000},max:{x:8000,y:8000,z:10000}},...o});}
function field(){return world([box('ground',-1500,-1500,4000,4000,-20,0)]);}
function context(g,kind='Hound',v='A',o={}){
 const plan=DP.PLAN(kind,v,o.wallDistance??40),victim={x:300,y:300,z:0,angle:0,vx:0,vy:0,vz:0,...o.victim};
 return {kind,v,geometry:g,victim,src:{x:victim.x-46,y:victim.y,z:victim.z,...o.src},dir:0,hits:plan.hits||[.24,.74,1.2,1.7],kn:plan.kn,drag:plan.dr,seed:12345,eqKind:'flashlight',hat:'cap',dur:DP.DURS[kind][v],...o};
}
function masses(S){return [S.b,...S.h,S.at,...(S.eq.has&&!S.eq.held?[S.eq]:[]),...(S.hat.has&&!S.hat.on?[S.hat]:[])];}
function valid(S){const assert=require('assert');for(const o of masses(S)){assert(['x','y','z','vx','vy','vz'].every(k=>Number.isFinite(o[k])),'nonfinite '+o.shape.id);assert(S.motion.fit(o),'penetration '+o.shape.id+' '+JSON.stringify(o));assert(!o.sleeping||o.stable&&!!o.supportId,'unsupported sleep');}for(const h of S.h)assert(Math.hypot(h.x-S.b.x,h.y-S.b.y,h.z-S.b.z-9)<=40.1,'hand escaped constraint');}
module.exports={G,M,world,box,clone,DP,field,context,masses,valid};
