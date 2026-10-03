'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const AI=require('../../ai'),V=require('../../world_view'),G=require('../../world_geometry'),M=require('../../world_motion');
const {fixture,adapter}=require('../stage_e/fixture'),{player}=require('../stage_e/test_helpers'),{hiddenPair,counted,trace}=require('../stage_e/test_entities');
function run(){
 const d=fixture(),model=V.compile(d),views=[new V.LocalView(model,'h3'),new V.LocalView(model,'h3')],worldBefore=JSON.stringify(d);
 const pairs=[];
 for(const kind of ['hound','smiler']){
  pairs.push(hiddenPair(kind,true));
  const runs=[0,1].map(()=>{const en=AI.create({adapter:adapter(d),seed:401}),e=en.spawn(kind,260,160,{z:0}),counts=counted(e),p=player({x:160,y:160,z:180,kind:'camcorder',light:true});e.ang=Math.PI;return{en,e,counts,p};});
  for(let tick=0;tick<360;tick++){
   views[0].update({x:160,y:160,z:0},1/60,{epoch:'h3',enabled:true});views[1].update({x:160+(tick%2)*10,y:160,z:180},1/60,{epoch:'h3',enabled:tick%31<15});
   for(let i=0;i<2;i++){const r=runs[i];r.en.geo.a.presentation={view:views[i].snapshot(),quality:i?.5:1,nv:!!i,zoom:i?4:1,camera:{x:160,y:160,z:i?180:0},ir:i?2:0};r.en.setPlayers([r.p]);r.en.step(1/60);}
   assert.deepEqual(trace(runs[0].e,runs[0].counts),trace(runs[1].e,runs[1].counts),'view/IR changed '+kind+' tick '+tick);
  }
  pairs.push({kind,viewToggleTicks:360,decisionsAndRng:'IDENTICAL'});
 }
 assert.equal(JSON.stringify(d),worldBefore);
 // Run the production CPU presentation reference against accepted E light truth.
 const win={TFB_VIEW:V,TFB_GEOMETRY:G,TFB_MOTION:M,TFB_WORLD:d},context={window:win,Math,Map,Set,Number,Object,JSON,performance:{now:()=>0}};vm.runInNewContext(fs.readFileSync(require.resolve('../../spatial_client'),'utf8'),context);
 win.__spatial.bind({H:{}},{},{});const geo=new AI.Geo(adapter(d));geo.a.blackout=()=>true;
 const cases=[];
 for(const kind of ['flashlight','headlamp','lantern'])for(const z of [0,180]){
  const p=player({x:160,y:160,z:0,angle:0,pitch:0,light:true,kind,shape:M.PROFILES.stand}),target={x:240,y:160,z,shape:M.PROFILES.stand},k=geo.a.kinds[kind];
  win.__spatial.state.lights=[{id:'actual',kind,origin:{x:160,y:160,z:50},direction:{x:1,y:0,z:0},range:k.range,arc:k.omni?Math.PI*2:k.arc,power:k.power,near:24,channel:'visible'}];
  const actual=win.__spatial.lightAt(geo.eye(target)),accepted=geo.lightAt(target,[p]);assert(Math.abs(actual-accepted)<1e-12);cases.push({kind,z,actual,accepted});
 }
 const q={x:240,y:160,z:50};win.__spatial.state.lights[0].channel='ir';assert.equal(win.__spatial.lightAt(q),.04);assert(win.__spatial.lightAt(q,'ir')>0);
 return{status:'PASS',pairs,cases,geometryUnchanged:true,channelsSeparated:true};
}
if(require.main===module)console.log(JSON.stringify(run(),null,2));module.exports={run};
