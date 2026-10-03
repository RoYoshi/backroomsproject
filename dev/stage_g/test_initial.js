'use strict';
const assert=require('assert'),{G,M,DP,world,box,context,valid}=require('./fixtures');
const g=G.compile(world([box('ground',0,0,700,700,-20,0),box('wall',340,0,30,700,0,300,true)]));
for(const x of [320,324.9])for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
 const S=DP.create(context(g,'Hound','A',{victim:{x,y:300,z:0,angle,shape:M.PROFILES.stand}}));valid(S);assert(Math.hypot(S.b.x-x,S.b.y-300,S.b.z)<4);for(let i=0;i<360;i++){DP.tick(S);valid(S);}console.log('PASS live-to-death envelope near wall',x,angle);
}
