/* Isolated Stage D harness. All placements are deterministic presentation fixtures,
 * not gameplay actors or network state. The production page never imports this. */
import {Application,Avatar} from './stageD-pixi.js';
const V=window.TFB_VIEW,G=window.TFB_GEOMETRY,manual=new URLSearchParams(location.search).has('manual');
const definition=V.freeze(await (await fetch('./assets/stageD-world.json')).json()),geometry=G.compile(definition),model=V.compile(definition);
const snapshot=V.freeze({epoch:'stage-c-fixture:1',actors:[
 {id:'lower-local',x:160,y:160,z:0,art:0},{id:'upper-same-xy',x:160,y:160,z:180,art:1},
 {id:'lower-peer',x:240,y:200,z:0,art:2},{id:'upper-peer',x:300,y:460,z:180,art:2},
 {id:'stair-local',x:368,y:440,z:132,art:0},{id:'ramp-peer',x:880,y:148,z:122.5,art:1},
 {id:'ramp-local',x:1040,y:200,z:180,art:0},{id:'wall-front',x:1108,y:240,z:0,art:1},
 {id:'wall-partial',x:1108,y:266,z:0,art:2},{id:'wall-camera-partial',x:1108,y:315,z:0,art:0},
 {id:'wall-physical-hidden',x:1140,y:440,z:0,art:1},{id:'wall-physical-front',x:1050,y:440,z:0,art:2},
 {id:'crawl-proxy',x:140,y:770,z:0,height:24,art:0},
 {id:'balcony-proxy',x:880,y:660,z:120,art:0},{id:'lower-drop-proxy',x:880,y:930,z:-96,art:1}
]});
const scenes=V.freeze({
 lower:{label:'Lower space · slab cutaway',focus:{x:160,y:160,z:0},camera:{x:400,y:330,z:0}},
 upper:{label:'Upper space · same world snapshot',focus:{x:160,y:160,z:180},camera:{x:400,y:330,z:180}},
 stairs:{label:'Stairwell · continuous elevation',focus:{x:368,y:440,z:132},camera:{x:430,y:330,z:132}},
 ramp:{label:'Ramp · real sloped depth',focus:{x:1040,y:200,z:180},camera:{x:830,y:300,z:180}},
 wall:{label:'Wall · front / partial / hidden',focus:{x:1108,y:210,z:0},camera:{x:990,y:350,z:0}},
 window:{label:'Window · physical opening',focus:{x:680,y:380,z:20},camera:{x:870,y:390,z:20}},
 crawl:{label:'Crawl roof · occlusion remains solid',focus:{x:70,y:770,z:0},eyeHeight:18,camera:{x:330,y:790,z:0}},
 balcony:{label:'Balcony · drop / lower platform',focus:{x:880,y:660,z:120},camera:{x:890,y:750,z:120}}
});
const views=[];let sceneName='lower',pair=false,cut=true,quality=1,last=performance.now();
async function makeView(){
 const app=new Application();await app.init({width:16,height:16,preference:'webgl',background:'#000000',antialias:false,autoStart:false,preserveDrawingBuffer:true});app.stop();
 const art=[];for(const main of ['#d7be69','#d9685e','#72b4b9']){const a=new Avatar({main,hands:'#b78265',hat:'none',texture:'plain',backpack:'canvas'},{kind:'flashlight',color:'#ffffff'});art.push(app.renderer.extract.canvas({target:a,resolution:2}));a.destroy({children:true});}
 const pass=new V.SpatialPass(app.renderer,model,art),view=new V.LocalView(model,snapshot.epoch);document.querySelector('#views').appendChild(app.canvas);const v={app,pass,view};views.push(v);return v;
}
function configuration(name=sceneName){const c=scenes[name];return {camera:{...c.camera},focus:{...c.focus},eye:{x:c.focus.x,y:c.focus.y,z:c.focus.z+(c.eyeHeight||50)},elevationScale:.5};}
function draw(options={}){
 const results=[];for(let i=0;i<views.length;i++){
  const v=views[i];v.app.canvas.style.display=i&&!pair?'none':'block';if(i&&!pair)continue;
  const c={...configuration(pair?(i?'upper':'lower'):sceneName),...options};const focus=c.focus;
  v.pass.resize(innerWidth/(pair?2:1),innerHeight,devicePixelRatio,options.quality??quality);
  if(options.settle){for(let n=0;n<20;n++)v.view.update(focus,.025,{enabled:options.cutaway??cut,epoch:snapshot.epoch,elevationScale:c.elevationScale});}
  else v.view.update(focus,options.dt??0,{enabled:options.cutaway??cut,epoch:snapshot.epoch,elevationScale:c.elevationScale});
  const actors=snapshot.actors.filter(a=>!(options.exclude||[]).includes(a.id)&&(!options.only||options.only.includes(a.id)));
  const overlays=snapshot.actors.filter(a=>(options.overlays||[]).includes(a.id));
  results.push(v.pass.render({...c,view:v.view,actors,overlays,reverse:!!options.reverse}));
 }
 document.querySelector('#info').textContent=`${pair?'Independent lower / upper observers':scenes[sceneName].label} · physical XYZ · scale ${results[0].scope.scale.toFixed(3)} · ${results[0].drawCalls} draws · ${model.solids.length} immutable solids. Stage D only; human QA pending.`;
 return results;
}
function setScene(name,options={}){if(!scenes[name])throw Error('Unknown fixture view');sceneName=name;document.querySelector('#scene').value=name;return draw({settle:true,...options});}
function digest(bytes){let h=2166136261,lit=0;for(let i=0;i<bytes.length;i++){h=Math.imul(h^bytes[i],16777619);if(i%4===0&&(bytes[i]||bytes[i+1]||bytes[i+2]))lit++;}return {hash:(h>>>0).toString(16),lit,pixels:bytes.length/4};}
try{
 await makeView();await makeView();
 const select=document.querySelector('#scene');for(const [id,s]of Object.entries(scenes)){const o=document.createElement('option');o.value=id;o.textContent=s.label;select.appendChild(o);}select.onchange=()=>setScene(select.value);
 document.querySelector('#cut').onclick=()=>{cut=!cut;document.querySelector('#cut').textContent='Cutaway '+(cut?'on':'off');draw();};
 document.querySelector('#quality').onclick=()=>{quality=quality===1?.5:1;document.querySelector('#quality').textContent=quality===1?'Full quality':'Reduced quality';draw();};
 document.querySelector('#pair').onclick=()=>{pair=!pair;draw({settle:true});};
 document.querySelector('#views').style.display='flex';
 const gl=views[0].pass.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
 window.stageD={ready:true,model,geometry,snapshot,scenes,views,configuration,draw,setScene,digest,pixels:(i=0)=>views[i].pass.pixels(),
  pair:(value)=>{pair=value;return draw({settle:true});},worldHash:()=>G.contentHash(definition),snapshotHash:()=>G.sha256(G.canonical(snapshot)),
  metadata:()=>({runtime:'shipped Pixi 8.21.0 / WebGL2',gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),browser:navigator.userAgent,worldHash:G.contentHash(definition),snapshotHash:G.sha256(G.canonical(snapshot)),views:views.filter((v,i)=>pair||i===0).map(v=>v.pass.last)}),
  finish:()=>gl.finish()};
 setScene('lower');window.addEventListener('resize',()=>draw());
 if(!manual)requestAnimationFrame(function frame(t){draw({dt:Math.min(.25,(t-last)/1000)});last=t;requestAnimationFrame(frame);});
}catch(e){document.querySelector('#error').textContent=String(e);console.error(e);throw e;}
