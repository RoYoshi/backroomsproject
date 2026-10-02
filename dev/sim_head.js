/* sim.js - server-side Level 0 monster simulation.
 * The map, pathfinding, Hound and Smiler AI below are the game's own code, extracted from the
 * production bundle (assets/index-*.js) and generalised from one player to many.
 * The section marked 'multiplayer glue' is new. */
'use strict';
const WORLD=require('./world.js');
const GEOMETRY=require('./world_geometry.js'),LEVEL0=require('./levels/level0.js');
module.exports=function createSim(opts){opts=opts||{};
var WG=GEOMETRY.compile(LEVEL0,WORLD),{FBW,FBH,Oc,kc,Mc,Nc,Pc,Fc,Ic}=WG.flat,V={blackout:!1,elapsed:0,next:36,duration:0,number:0};function Lc(){Object.assign(V,{blackout:!1,elapsed:0,next:36,duration:0,number:0})}function Rc(e){return V.elapsed+=e,!V.blackout&&V.elapsed>=V.next?(V.blackout=!0,V.elapsed=0,V.duration=4.5+V.number%3,V.number++,`start`):V.blackout&&V.elapsed>=V.duration?(V.blackout=!1,V.elapsed=0,V.next=44+V.number%4*10,`end`):null}var {zc,Bc,Hc,Uc}=WG.flat;var Wc={kind:`flashlight`,color:`#ffe7b2`},Gc={flashlight:{label:`Flashlight`,range:390,arc:.92,power:.58,spill:56,omni:!1},headlamp:{label:`Headlamp`,range:262,arc:1.95,power:.5,spill:82,omni:!1},lantern:{label:`Lantern`,range:228,arc:Math.PI*2,power:.5,spill:200,omni:!0},camcorder:{label:`Night Vision Camcorder`,range:1,arc:.1,power:0,spill:1,omni:!1}},Kc=(e,t,n)=>{let r=Math.max(0,Math.min(1,(n-e)/(t-e)));return r*r*(3-2*r)};function qc(e,t,n){if(!n)return 0;let r=Gc[e.equipment?.kind]||Gc.flashlight,i=t.x-e.x,a=t.y-e.y,o=Math.hypot(i,a),s=Math.atan2(a,i)-e.angle,c=Math.abs(Math.atan2(Math.sin(s),Math.cos(s))),l=r.omni?1:1-Kc(r.arc*.11,r.arc*.5,c);return r.power*(1-Kc(24,r.range,o))*Math.max(l,(1-Kc(10,r.spill,o))*.4)}
var el=WG.flat.el;function tl(){for(let e of el)e.found=!1}function nl(){return el.reduce((e,t)=>e+Number(t.found),0)}function rl(e,t){let n=el.find(n=>!n.found&&Math.hypot(e-n.x,t-n.y)<42);return n?(n.found=!0,n):null}var {il,W,al,ol,sl,cl,ll,ul,dl,fl,pl}=WG.flat;
