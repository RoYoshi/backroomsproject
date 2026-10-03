'use strict';
const assert=require('assert'),{G,world,box,DP,context,valid}=require('./fixtures');
const ground=box('ground',-1200,-1200,3500,3500,-20,0),cases={
 flat:{d:world([ground]),o:{victim:{x:300,y:300,z:0,angle:0}}},
 stairs:{d:world([ground,...Array.from({length:7},(_,i)=>box('step'+i,80*i,200,80,300,0,(i+1)*12))]),o:{victim:{x:280,y:350,z:48,angle:0,vx:-140},src:{x:220,y:350,z:36}}},
 ramp:{d:world([box('ramp',0,0,1200,600,{a:.4,b:0,c:-20},{a:.4,b:0,c:0})]),o:{victim:{x:300,y:300,z:127.2,angle:0,vx:40},src:{x:254,y:300,z:110}}},
 wall:{d:world([ground,box('wall',380,-500,50,1800,0,500,true)]),o:{victim:{x:300,y:300,z:0,angle:0,vx:160},wallDistance:80}},
 underside:{d:world([ground,box('ceiling',-500,-500,1800,1800,130,150)]),o:{victim:{x:300,y:300,z:30,angle:0,vz:420},src:{x:254,y:300,z:30}}},
 ledge:{d:world([ground,box('ledge',200,200,450,200,104,120)]),o:{victim:{x:610,y:300,z:120,angle:0,vx:170}}},
 stacked:{d:world([ground,box('upper',-500,-500,1800,1800,162,180)]),o:{victim:{x:300,y:300,z:300,angle:0,vz:-900},src:{x:254,y:300,z:300}}}
};
const results=[];
for(const kind of ['Hound','Smiler'])for(const v of 'ABCD')for(const [name,fixture]of Object.entries(cases)){
 const g=G.compile(fixture.d),S=DP.create(context(g,kind,v,fixture.o));let maxStep=0,maxReach=0,unsupported=0,contacts=0;
 for(let i=0;i<480;i++){const b={x:S.b.x,y:S.b.y,z:S.b.z},n=S.stepN,asleep=S.state==='SLEEPING';DP.tick(S);assert.equal(S.stepN-n,asleep?0:4);try{valid(S);}catch(e){console.log('FAILED CASE',JSON.stringify({kind,v,fixture:name,tick:i,snapshot:DP.snapshot(S)}));throw e;}maxStep=Math.max(maxStep,Math.hypot(S.b.x-b.x,S.b.y-b.y,S.b.z-b.z));maxReach=Math.max(maxReach,...S.h.map(h=>Math.hypot(h.x-S.b.x,h.y-S.b.y,h.z-S.b.z-9)));if(!S.b.supportId)unsupported++;contacts+=S.b.contacts.length;}
 assert(S.stepN>=Math.ceil(S.dur*240));assert(S.eq.has&&!S.eq.held);results.push({kind,v,fixture:name,state:S.state,z:S.b.z,support:S.b.supportId,maxStep,maxReach,unsupported,contacts,diagnostics:[S.b,...S.h,S.eq,S.hat].flatMap(o=>o.diagnostics).length});
 console.log('PASS',kind,v,name,JSON.stringify(results.at(-1)));
}
console.log(JSON.stringify({gate:'Z25',status:'PASS',cases:results.length,results}));
