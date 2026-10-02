'use strict';
const { World, LONG } = require('./lib.js');
const near = (a,b,e=.04) => Math.abs(a-b) <= e;
const ad = (a,b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
module.exports = [
  { name:'LOOK01 Hound visual head tracks legitimate current visual evidence without changing sensory head', fn(){
    const w=World(301), h=w.hound(5000,LONG.y), p=w.player(5200,LONG.y+300,{light:false});
    h.ang=0; h.head=.17; h.target=p.id;
    h.mem.p.set(p.id,{id:p.id,seen:true,hv:{x:p.x,y:p.y},conf:1,lkx:p.x,lky:p.y});
    const s=h.sp.snap(h), want=Math.atan2(300,200);
    return {ok:near(s.h,.17,.011)&&near(s.lh,Math.min(1.18,want),.02),note:`sensory=${s.h} visual=${s.lh} want=${want.toFixed(2)}`};
  }},
  { name:'LOOK02 Hound visual head uses remembered evidence, never live hidden player coordinates', fn(){
    const w=World(302), h=w.hound(5000,LONG.y), p=w.player(5200,LONG.y,{light:false});
    h.ang=0; h.target=p.id; h.mem.p.set(p.id,{id:p.id,seen:false,hv:null,conf:.8,lkx:5200,lky:LONG.y+220});
    const a=h.sp.snap(h).lh; p.x=1000; p.y=1000; const b=h.sp.snap(h).lh;
    return {ok:near(a,b,.0001)&&near(a,Math.atan2(220,200),.02),note:`before=${a} after hidden move=${b}`};
  }},
  { name:'LOOK03 Hound visual neck remains anatomically bounded', fn(){
    const w=World(303), h=w.hound(5000,LONG.y), p=w.player(4700,LONG.y,{light:false});
    h.ang=0; h.target=p.id; h.mem.p.set(p.id,{id:p.id,seen:true,hv:{x:p.x,y:p.y},conf:1,lkx:p.x,lky:p.y});
    const s=h.sp.snap(h); return {ok:near(Math.abs(s.lh),1.18,.011),note:`rear target clamps to ${s.lh} rad`};
  }},
  { name:'LOOK04 Smiler face aim follows its own perceived/remembered evidence, not live hidden position', fn(){
    const w=World(304), m=w.smiler(5000,LONG.y), p=w.player(5200,LONG.y+160,{light:false});
    m.ang=0; m.target=p.id; m.mem.p.set(p.id,{id:p.id,seen:true,visual:{x:p.x,y:p.y},conf:1,lkx:p.x,lky:p.y});
    const a=m.sp.snap(m).lh, want=Math.atan2(160,200); m.mem.p.get(p.id).seen=false; m.mem.p.get(p.id).visual=null; p.x=1000;p.y=1000; const b=m.sp.snap(m).lh;
    return {ok:near(a,want,.02)&&near(b,want,.02),note:`visible=${a} remembered=${b} want=${want.toFixed(2)}`};
  }},
];
