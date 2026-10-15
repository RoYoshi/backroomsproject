import {Application,Assets,Container,Graphics,Texture,TilingSprite} from 'pixi.js';
import {TILE,COLS,ROWS,cells,rooms,pitCells,crates,lights,isFloor,rayDistance,lighting} from '../shared/world';
import {player} from '../shared/movement';
import {EntityView,smilerViews} from './entity-view';
import {smilers,entity} from '../shared/entity';
import {traces} from '../shared/evidence';
import {PlayerView} from './player-view';
import {visibilityPolygon,smooth} from '../shared/vision';
import {DeathSequence,type CaptureKind} from './death';
import {LIGHT_SPECS,type LightKind} from '../shared/equipment';
import {corpses,addCorpse,clearCorpses} from '../shared/remains';
import {CorpseView} from './corpse-view';
import {appearance} from './appearance';
import {drawArrival,fallShake} from './arrival';
/* where a light starts: a position and, for a beam, the angle it points at */
export type LightOrigin={x:number;y:number;angle:number};
/* reveal(center, arc, range, strength, tint): clear the darkness over a cone of one light (lineage B06: made for any origin and colour
   by revealFrom, so the other players' lights and (B20) the camcorder's infrared are drawn the same way) */
export type Reveal=(center:number,arc:number,range:number,strength:number,tint?:boolean)=>void;
export type RevealFrom=(origin:LightOrigin,r:number,g:number,b:number)=>Reveal;
export class Renderer{
 entityView=new EntityView();
 /* (B09, B21; owner BPP) one view per server Hound slot: 64 */
 hv=Array.from({length:64},()=>new EntityView());
 /* (B09, owner BR-R) the ceiling lamps' fittings, drawn above the creatures and drifting a little against the floor */
 lampTop=new Graphics();
 traceViews:Graphics[]=[];app=new Application();world=new Container();person=new PlayerView();camera={x:player.x-350,y:player.y};scale=.9;light=document.querySelector<HTMLCanvasElement>('#light')!;ctx=this.light.getContext('2d')!;lampShapes:number[][]=[];width=0;height=0;death=new DeathSequence();creatures=new Container();sightMask=new Graphics();sightPoints:number[]=[];scenePoints:number[]=[];corpseLayer=new Container();corpseViews=new Map<string,CorpseView>();
 /* (B26, owner BR-R) the camera's base scale: 1.25 (v11 1.18) */
 baseScale=1.25;shakeX=0;shakeY=0;
 async init(){await this.app.init({resizeTo:window,background:'#776a36',antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,preference:'webgl'});document.querySelector('#game')!.appendChild(this.app.canvas);this.app.stage.addChild(this.world);
  // (B03) the carpet's path is relative to the page
  this.build(await Assets.load<Texture>('./assets/carpet.png'));
  lights.forEach(l=>{const a:number[]=[];for(let i=0;i<96;i++){const angle=i/96*Math.PI*2,d=rayDistance(l.x,l.y,angle,380);a.push(l.x+Math.cos(angle)*d,l.y+Math.sin(angle)*d);}this.lampShapes.push(a);});this.resize();window.addEventListener('resize',()=>this.resize());}
 /* (B22, owner S.P.A.C.E.) the page's camera policy (window.__cameraPolicy) gives the base scale; without it, v11's rule at 1.25 */
 resize(){this.width=innerWidth;this.height=innerHeight;this.light.width=innerWidth;this.light.height=innerHeight;this.baseScale=window.__cameraPolicy?window.__cameraPolicy.baseScale(innerWidth,innerHeight):innerWidth<700?.85:1.25;this.scale=this.baseScale;}
 build(floorTexture:Texture){let seed=42;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const floor=new TilingSprite({texture:floorTexture,width:COLS*TILE,height:ROWS*TILE});floor.tileScale.set(.32);this.world.addChild(floor);
 const g=new Graphics();this.world.addChild(g);
 // Moist carpet darkens in irregular patches. No grid joints or floor paint.
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(cells[y*COLS+x]){
  const px=x*TILE,py=y*TILE;
  if(rand()<.20)g.ellipse(px+rand()*90,py+rand()*90,20+rand()*55,10+rand()*28).fill({color:0x493f1e,alpha:.05+rand()*.09});
  if(rand()<.025)g.ellipse(px+rand()*80,py+rand()*80,13+rand()*16,7+rand()*11).fill({color:0x1f3427,alpha:.12});
 }
 // Every exposed wall is wallpaper, with scuffed trim and a low ceiling lip. (B02) The RED ROOMS' walls are red.
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!cells[y*COLS+x]){
  const px=x*TILE,py=y*TILE;
  const red=x>=51&&x<69&&y>=51&&y<63;
  g.rect(px,py,TILE,TILE).fill(red?0x683429:0x7c713b);
  if(isFloor(x,y+1)){
   g.rect(px,py+TILE-46,TILE,43).fill(red?0xa45444:0xc6ba73);
   g.rect(px,py+TILE-46,TILE,5).fill(red?0xc77760:0xd8cc8a);
   g.rect(px,py+TILE-3,TILE,10).fill({color:0x332e19,alpha:.45});
   g.rect(px,py+TILE-16,TILE,13).fill(red?0x723a32:0xa7965b);
   for(let j=0;j<4;j++){
    const bx=px+j*24+9;
    g.moveTo(bx,py+TILE-39).lineTo(bx+4,py+TILE-34).lineTo(bx,py+TILE-29).lineTo(bx-4,py+TILE-34).closePath().stroke({color:0x9e9259,alpha:.35,width:1.5});
    g.circle(bx,py+TILE-24,1.4).fill({color:0x9a8d52,alpha:.35});
   }
  }
  if(isFloor(x+1,y)){
   g.rect(px+TILE-27,py,27,TILE).fill(red?0xab5848:0xbbae69);
   g.rect(px+TILE-5,py,5,TILE).fill(0x9b8b50);
   for(let j=0;j<3;j++)g.circle(px+TILE-15,py+14+j*29,2).fill({color:0x897e48,alpha:.35});
  }
  if(isFloor(x-1,y)){
   g.rect(px,py,27,TILE).fill(red?0xa34e43:0xb6a75f);
   g.rect(px,py,5,TILE).fill(0x8b7b45);
   for(let j=0;j<3;j++)g.circle(px+15,py+14+j*29,2).fill({color:0x897e48,alpha:.35});
  }
  if(isFloor(x,y-1)){
   g.rect(px,py,TILE,23).fill(red?0xa35244:0xb5a763);
   g.rect(px,py,TILE,5).fill(0x8b7b45);
  }
 }
 // (B14) the level's props, drawn by world.js (the shared WORLD)
 window.WORLD.drawProps(g);
 // Floor openings read as deep square wells and stop movement and sight. (B02) Darker, with a thinner lit rim.
 for(const p of pitCells){const x=p.x*TILE,y=p.y*TILE;
  g.rect(x,y,TILE,TILE).fill(0x060707);
  g.rect(x+7,y+7,TILE-14,TILE-14).fill(0x010202);
  g.moveTo(x,y+TILE).lineTo(x+TILE,y+TILE).lineTo(x+TILE,y).stroke({color:0xc59d5f,width:5,alpha:.62});
  g.rect(x+11,y+TILE-13,TILE-22,5).fill({color:0x2e271c,alpha:.78});
 }
 // (B02) the PILLAR HALL's pillars
 for(const c of crates){
  g.roundRect(c.x-6,c.y-6,c.w+12,c.h+12,5).fill({color:0x332b18,alpha:.24});
  g.roundRect(c.x,c.y,c.w,c.h,4).fill(0x918148).stroke({color:0x4d4327,width:3});
  g.rect(c.x+7,c.y+7,c.w-14,c.h-14).fill(0xb4a45e);
  g.moveTo(c.x+7,c.y+c.h-11).lineTo(c.x+c.w-7,c.y+c.h-11).stroke({color:0x5f532d,width:4});
 }
 // (B02) the BLACKOUT ZONE, the RED ROOMS, the DEEP CARPET and the DAMP ROOMS are tinted; the ARCH GALLERY has its arches
 const dim=rooms[6],redRoom=rooms[8],deep=rooms[11],damp=rooms[7],arches=rooms[9];
 g.rect(dim.x*TILE,dim.y*TILE,dim.w*TILE,dim.h*TILE).fill({color:0x050706,alpha:.48});
 g.rect(redRoom.x*TILE,redRoom.y*TILE,redRoom.w*TILE,redRoom.h*TILE).fill({color:0x761815,alpha:.25});
 g.rect(deep.x*TILE,deep.y*TILE,deep.w*TILE,deep.h*TILE).fill({color:0x57451f,alpha:.14});
 g.rect(damp.x*TILE,damp.y*TILE,damp.w*TILE,damp.h*TILE).fill({color:0x3f4934,alpha:.09});
 for(let x=arches.x+2;x<arches.x+arches.w-2;x+=4){
  const cx=(x+.5)*TILE,top=(arches.y+3)*TILE,bottom=(arches.y+arches.h-3)*TILE;
  g.moveTo(cx-36,top+74).lineTo(cx-36,top+28).quadraticCurveTo(cx,top-16,cx+36,top+28).lineTo(cx+36,top+74).stroke({color:0xd3c372,alpha:.36,width:7});
  g.moveTo(cx-36,bottom).lineTo(cx-36,bottom-46).quadraticCurveTo(cx,bottom-88,cx+36,bottom-46).lineTo(cx+36,bottom).stroke({color:0x8f824e,alpha:.22,width:5});
 }
 // Fluorescents float in an implied low ceiling and reflect on the carpet. (B09) Their fittings are on the ceiling layer; (B24, owners
 // BR-R and L.O.S.T.) the Level 0 remaster, when the page has it, gives the Graphics each lamp is drawn into (window.__l0v.lamp).
 this.lampTop.clear();
 lights.forEach((l,i)=>{
  const red=l.x>=redRoom.x*TILE&&l.y>=redRoom.y*TILE,top=window.__l0v?__l0v.lamp(i,l,this.lampTop):this.lampTop;
  g.ellipse(l.x,l.y+30,65,26).fill({color:red?0xff3d21:0xf3e9a1,alpha:red?.22:.11});
  g.roundRect(l.x-38,l.y+24,76,12,6).fill({color:0x000000,alpha:.13});
  top.roundRect(l.x-45,l.y-15,90,28,3).fill({color:0x333333,alpha:.9});
  top.roundRect(l.x-43,l.y-13,86,24,2).fill({color:0x5f5a3b,alpha:.95});
  top.rect(l.x-37,l.y-8,74,13).fill(red?0xff4a35:i%13===0?0x918e61:0xfff4bc);
  top.rect(l.x-32,l.y-4,64,4).fill({color:0xffffff,alpha:i%13===0?.12:.75});
  top.moveTo(l.x-43,l.y+10).lineTo(l.x+43,l.y+10).stroke({color:0x413e28,alpha:.6,width:3});
 });
 traces.forEach((trace,i)=>{
  const v=new Graphics();v.position.set(trace.x,trace.y);v.ellipse(0,5,20,9).fill({color:0x9af1d7,alpha:.11});
  v.roundRect(-15,-12,30,22,3).fill(0x273a34).stroke({color:0xa6d3b8,width:1.5});
  v.roundRect(-11,-8,22,12,1).fill(0x7ab5a1).rect(-8,-5,14,2).fill(0xe1f8d7).rect(-8,-1,17,1).fill(0xd4f3d4);
  v.circle(8,7,2).fill(0xf0d692);v.moveTo(-17,12).lineTo(17,12).stroke({color:0xd9f2d1,alpha:.5,width:1});
  this.traceViews[i]=v;this.world.addChild(v);
 });
 this.creatures.addChild(this.entityView,...this.hv,...smilerViews,this.death.foreground);this.lampTop.alpha=.84;
 this.world.addChild(this.corpseLayer,this.death.blood,this.death.debris,this.person,this.creatures,this.sightMask,this.lampTop);this.creatures.mask=this.sightMask;
 // (B24, B25) the remaster is given the built world, the floor's Graphics, the lamps' layer and (presentation cost) the application
 if(window.__l0v)__l0v.built(this.world,g,this.lampTop,this.app);}

 beginDeath(time:number){
  // (B14, owners BR-R and G.I.B.) a kill recorded in the last 9 s (window.__kill: the server's or ents.js's) decides the attacker and
  // where it struck from; without one, ents.js makes the local kill's record (localKill)
  let kill=window.__kill&&performance.now()-window.__kill.at<9e3?window.__kill:null;
  const kind:CaptureKind=kill?kill.k:entity.caughtBy==='Smiler'?'Smiler':'Hound';
  window.__lastCause=kind;
  const index=kind==='Smiler'?kill&&kill.slot>=0?kill.slot:smilers.reduce((best,s,i)=>Math.hypot(s.x-player.x,s.y-player.y)<Math.hypot(smilers[best].x-player.x,smilers[best].y-player.y)?i:best,0):-1,
   source=kill?{x:kill.ax,y:kill.ay}:index<0?entity:smilers[index];
  if(!kill&&window.__ents&&window.__ents.localKill)kill=window.__ents.localKill(kind,player,source);
  window.__kill=null;this.death.start(kind,time,source,index,null,kill);
  // (B12) the network script hears of it
  if(window.__net&&window.__net.deathStart)window.__net.deathStart(this.death);
 }
 /* lightOn: whether the wanderer's light was on (the corpse keeps it as lo) */
 completeDeath(time:number,lightOn:boolean){
  const d=this.death;if(!d.finished||d.corpseId)return;
  // (B14) the corpse also keeps whether the light was on and the death's variant; (B18) a physical death adds its remains
  d.corpseId=addCorpse({ownerId:player.id,name:player.name,createdAt:time,cause:d.kind,x:d.body.x,y:d.body.y,angle:d.body.angle,scaleX:d.body.scaleX,scaleY:d.body.scaleY,attackAngle:d.angle,appearance:{...appearance},equipment:{...player.equipment},blood:d.bursts.map(b=>({x:b.x,y:b.y,seed:b.seed})),dropped:{...d.torch},hat:{x:d.victim.x+Math.cos(d.angle+1.2)*40,y:d.victim.y+Math.sin(d.angle+1.2)*40,angle:d.angle+1.8},lo:lightOn?1:0,variant:d.variant,...(d.ph?window.__dphys!.remains(d):{})}).id;
  const attacker=d.attackerIndex<0?entity:smilers[d.attackerIndex];Object.assign(attacker,{x:d.attacker.x,y:d.attacker.y,angle:d.attacker.angle});
 }
 clearRemains(){clearCorpses();this.corpseViews.forEach(v=>v.destroy({children:true}));this.corpseViews.clear();}
 resetDeath(){this.death.reset();this.person.scale.set(1);this.person.alpha=1;this.entityView.alpha=0;smilerViews.forEach(v=>{v.scale.set(1);v.alpha=0;});this.scale=this.baseScale;this.shakeX=this.shakeY=0;}
 frame(dt:number,started:boolean,flash:boolean,time:number){
  const death=this.death;if(death.active)death.frame(time);
  const focus=death.active?death.body:player,targetX=focus.x-(started?0:350),k=1-Math.exp(-8*dt);
  this.camera.x+=(targetX-this.camera.x)*k;this.camera.y+=(focus.y-this.camera.y)*k;
  // (B11) the camcorder's zoom (window.__cam.zoomCur), a faster settle outside a death
  this.scale+=(this.baseScale*(death.active?1.4:1)*(window.__cam?window.__cam.zoomCur:1)-this.scale)*(1-Math.exp(-dt*(death.active?3:9)));
  // the shake: (B16, B18) a physical death moves the camera itself (its ph.cam; (B34) scaled by the death lab, window.__dcamK); (B11)
  // the camcorder's; (B12) a fall's landing
  this.shakeX=(death.active?death.ph?death.ph.cam.x*this.scale*(window.__dcamK?window.__dcamK():1):Math.sin(time*97)*death.shake:0)+(window.__cam?window.__cam.shakeX(time):0)+fallShake(time,0);
  this.shakeY=(death.active?death.ph?death.ph.cam.y*this.scale*(window.__dcamK?window.__dcamK():1):Math.cos(time*113)*death.shake*.7:0)+(window.__cam?window.__cam.shakeY(time):0)+fallShake(time,1);
  // (B09) the ceiling layer drifts against the floor
  this.lampTop.scale.set(1.06);this.lampTop.position.set(-.06*this.camera.x,-.06*this.camera.y);
  this.world.scale.set(this.scale);this.world.position.set(this.width/2-this.camera.x*this.scale+this.shakeX,this.height/2-this.camera.y*this.scale+this.shakeY);
  this.sightPoints=visibilityPolygon(focus.x,focus.y,700);this.scenePoints=visibilityPolygon(focus.x,focus.y,700,24);this.sightMask.clear().poly(this.sightPoints).fill(0xffffff);
  // (B12) the page hides some bodies (window.__hideBodies); (B32) gore.js culls others
  for(const record of corpses){let view=this.corpseViews.get(record.id);if(!view){view=new CorpseView(record);this.corpseViews.set(record.id,view);this.corpseLayer.addChild(view);}view.visible=(record.id!==death.corpseId||!death.active)&&!(window.__hideBodies&&window.__hideBodies.has(record.ownerId))&&!(window.__gore&&window.__gore.cull&&window.__gore.cull(record,this));}
  // (B09) a body that left the list (the server's list replaced it) loses its view
  if(this.corpseViews.size>corpses.length||[...this.corpseViews.keys()].some(id=>!corpses.some(r=>r.id===id)))for(const [id,view] of [...this.corpseViews])if(!corpses.some(r=>r.id===id)){view.destroy({children:true});this.corpseViews.delete(id);}
  this.person.update(time,flash);this.person.alpha=1;this.person.scale.set(1);
  // (B12) a fall into the level, a vanish
  drawArrival(this,time);
  // (B09) the local Hound when there is no server (or it is the one killing); the server's Hounds (window.__hounds) in their views, but
  // not the killer during its kill nor (B12) one the page hides (window.__fxKill); (B12) nor a Smiler the page hides (__fxKillS)
  this.entityView.update(started&&(death.active&&death.kind==='Hound'||!(window.__net&&window.__net.on)),time,dt,flash);
  this.hv.forEach((view,k)=>{view.g=window.__hounds&&window.__hounds[k]||null;view.update(started&&!!view.g&&!(death.active&&death.kind==='Hound'&&window.__killer===k)&&!(window.__fxKill&&window.__fxKill.has(k)),time,dt,flash);});
  smilerViews.forEach((view,k)=>view.update(started&&!(window.__fxKillS&&window.__fxKillS.has(k)),time,dt,flash));
  if(death.active){
   const b=death.body;this.person.position.set(b.x,b.y);this.person.rotation=b.angle;this.person.scale.set(b.scaleX,b.scaleY);this.person.alpha=b.alpha;
   // (B15) the pose of a physical death
   this.person.deathPose(death.injury,death.impact,death.elapsed>.24,death);
   const attacker=death.attackerIndex<0?this.entityView:smilerViews[death.attackerIndex];
   attacker.position.set(death.attacker.x,death.attacker.y);attacker.rotation=death.attacker.angle+Math.PI/2;attacker.alpha=1;
   // (B14, B16) ents.js poses the attacker
   if(death.kind==='Hound')this.entityView.attackPose(death.grip,death.impact,death.variant,death);
   else{attacker.scale.set(1+smooth(.3,1.7,death.elapsed)*.9);if(window.__ents)window.__ents.attackSmiler(attacker,time,1/60,death);}
  }
  this.traceViews.forEach((v,i)=>{v.visible=started&&!traces[i].found&&!death.active;v.alpha=.76+.24*Math.sin(time*3+i*2);v.scale.set(1+.04*Math.sin(time*2.5+i));});
  this.drawLight(flash,time);
 }
 polygon(ctx:CanvasRenderingContext2D,a:number[]){ctx.beginPath();ctx.moveTo(a[0],a[1]);for(let i=2;i<a.length;i+=2)ctx.lineTo(a[i],a[i+1]);ctx.closePath();}
 drawLight(flash:boolean,time:number){
  const c=this.ctx,s=this.scale,ox=this.width/2-this.camera.x*s+this.shakeX,oy=this.height/2-this.camera.y*s+this.shakeY;
  c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,this.width,this.height);
  // Opaque black is the default. Every light is clipped to the viewer's sight.
  c.fillStyle='#000';c.fillRect(0,0,this.width,this.height);
  const polygon=(points:number[])=>this.polygon(c,points.map((v,i)=>v*s+(i%2?oy:ox)));
  const rect=(x:number,y:number,w:number,h:number)=>c.fillRect(x*s+ox,y*s+oy,w*s,h*s);
  const radial=(x:number,y:number,inner:number,outer:number)=>c.createRadialGradient(x*s+ox,y*s+oy,inner*s,x*s+ox,y*s+oy,outer*s);
  c.save();polygon(this.scenePoints);c.clip();c.globalCompositeOperation='destination-out';
  // (B23, owner BR-RoLE) the per-light compositor (window.__brRole), when it is on, draws the ambient light, the lamps and the carried
  // light itself
  const compositor=window.__brRole&&window.__brRole.on()?window.__brRole:null,eye=this.death.active?this.death.body:player,ambient=radial(eye.x,eye.y,18,670);
  if(!compositor){ambient.addColorStop(0,'rgba(0,0,0,.14)');ambient.addColorStop(.5,'rgba(0,0,0,.045)');ambient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ambient;rect(eye.x-670,eye.y-670,1340,1340);}
  if(!compositor&&!lighting.blackout)lights.forEach((l,i)=>{
   const sx=l.x*s+ox,sy=l.y*s+oy;if(sx< -390||sy< -390||sx>this.width+390||sy>this.height+390)return;
   c.save();polygon(this.lampShapes[i]);c.clip();const g=radial(l.x,l.y,6,380);
   // (B14) ents.js dims a lamp (window.__ents.lamp); (B20) the camcorder's lamp gain; never past .9
   const glow=Math.min(.9,(i%13===0?.13+.06*Math.max(0,Math.sin(time*11+i)):.43)*(window.__ents?window.__ents.lamp(l.x,l.y,time):1)*(window.__cam?window.__cam.lampGain():1));
   g.addColorStop(0,`rgba(0,0,0,${glow})`);g.addColorStop(.5,`rgba(0,0,0,${glow*.35})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;rect(l.x-380,l.y-380,760,760);c.restore();
  });
  // (B10) the carried light leaves from where the view holds it (the eased beam, PlayerView.beam)
  const origin:LightOrigin=this.death.active?this.death.torch:this.person.beam||player,spec=LIGHT_SPECS[player.equipment.kind];
  const color=player.equipment.color,r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  const revealFrom:RevealFrom=(origin,r,g,b)=>(center,arc,range,strength,tint=false)=>{
   const points:number[]=[origin.x,origin.y],n=Math.max(24,Math.ceil(arc*45));
   for(let i=0;i<=n;i++){const a=center-arc/2+i/n*arc,d=Math.max(0,rayDistance(origin.x,origin.y,a,range)-1);points.push(origin.x+Math.cos(a)*d,origin.y+Math.sin(a)*d);}
   c.save();polygon(points);c.clip();const gradient=radial(origin.x,origin.y,6,range);
   gradient.addColorStop(0,`rgba(0,0,0,${strength})`);gradient.addColorStop(.25,`rgba(0,0,0,${strength*.83})`);gradient.addColorStop(.7,`rgba(0,0,0,${strength*.28})`);gradient.addColorStop(1,'rgba(0,0,0,0)');
   c.fillStyle=gradient;rect(origin.x-range,origin.y-range,range*2,range*2);
   if(tint){c.globalCompositeOperation='source-over';const glow=radial(origin.x,origin.y,5,range);glow.addColorStop(0,`rgba(${r},${g},${b},${strength*.2})`);glow.addColorStop(.6,`rgba(${r},${g},${b},${strength*.065})`);glow.addColorStop(1,`rgba(${r},${g},${b},0)`);c.fillStyle=glow;rect(origin.x-range,origin.y-range,range*2,range*2);}
   c.restore();
  },reveal=revealFrom(origin,r,g,b);
  if(compositor)compositor.draw(c,{t:time,on:flash,r:s,ox,oy,w:this.width,h:this.height,viewer:eye,src:origin,kind:player.equipment.kind,color,death:this.death.active});
  // without the compositor, a light that is on and is not night vision: the glow around the body and the light itself; (B35, B36;
  // owners G.I.B. and BR-RoLE) a dying light (window.__deathLight.own) at its own power, none when it is out
  if(!compositor&&flash&&!spec.nv){
   const power=this.death.active&&window.__deathLight?window.__deathLight.own():1;
   if(power>0){
    reveal(0,Math.PI*2,this.death.active?150:52,(this.death.active?.73:.35)*power);
    const flicker=spec.omni?.93+Math.sin(time*17)*.035+Math.sin(time*31)*.025:1;
    if(spec.omni)reveal(0,Math.PI*2,spec.range,spec.power*flicker*power,true);
    else{const pass=1-(1-spec.power*power)**(1/12);for(let i=0;i<12;i++)reveal(origin.angle,spec.arc*(1-i*.063),spec.range,pass,true);}
   }
  }
  // (B20) the camcorder's infrared view; (B06) the other players' lights
  if(window.__cam&&!this.death.active)window.__cam.irDraw(revealFrom,{x:origin.x,y:origin.y,angle:origin.angle??player.angle});
  if(window.__peerLights&&window.__peerLights.length)drawPeers(revealFrom,time,!!compositor);
  c.restore();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';
  const vignette=c.createRadialGradient(this.width/2,this.height/2,this.height*.18,this.width/2,this.height/2,Math.max(this.width,this.height)*.7);
  vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(0,0,0,.65)');c.fillStyle=vignette;c.fillRect(0,0,this.width,this.height);
  // (B14) the black fade of ents.js's death plan
  if(this.death.active&&this.death.black>.002){c.fillStyle=`rgba(0,0,0,${this.death.black})`;c.fillRect(0,0,this.width,this.height);}
  // Reflections share the same corner mask and gradual exposure as the body.
  c.save();c.setTransform(s,0,0,s,ox,oy);this.polygon(c,this.sightPoints);c.clip();
  smilerViews.forEach((view,i)=>{
   if(!view.visible||view.alpha<.001)return;
   // (B14) ents.js draws the eyes of a Smiler it drew
   if(window.__ents&&view.__smiler){window.__ents.smilerGlow(c,view,smilers[i],performance.now()/1e3,player,1);return;}
   // (B01, B02; owner BR-R) the eyes glow brighter as the body fades, and further away
   const sm=smilers[i],glow=(1-smooth(180,900,Math.hypot(sm.x-player.x,sm.y-player.y)))*(.18+.75*(1-view.alpha))*Math.min(1,.25+view.alpha*2.8);
   c.save();c.translate(view.x,view.y);c.rotate(view.rotation);c.scale(view.scale.x,view.scale.y);
   c.globalAlpha=glow;c.shadowColor='#edffe7';c.shadowBlur=7;c.fillStyle='#f2f5df';
   for(const side of [-1,1]){c.beginPath();c.ellipse(side*8,-7,3.5,5,0,0,Math.PI*2);c.fill();}
   c.beginPath();c.moveTo(-13,3);c.quadraticCurveTo(0,18,13,3);c.strokeStyle='#edf2dc';c.lineWidth=1.65;c.stroke();c.restore();
  });c.restore();
  if(this.death.active){
   c.setTransform(1,0,0,1,0,0);
   if(this.death.impact>.05){const pulse=c.createRadialGradient(this.width/2,this.height/2,this.height*.25,this.width/2,this.height/2,this.width*.65);pulse.addColorStop(0,'transparent');pulse.addColorStop(1,`rgba(115,3,8,${Math.min(.5,this.death.impact*.5)})`);c.fillStyle=pulse;c.fillRect(0,0,this.width,this.height);}
   c.fillStyle=`rgba(2,1,1,${this.death.shade})`;c.fillRect(0,0,this.width,this.height);
  }
 }
}
/* (B06, owners BPP and BR-R) the other players' lights (window.__peerLights, from mp.js), each through the same reveal as the local
   light: (B20) a camcorder's infrared is drawn by cam.js (window.__cam.peerIR); (B23) with the compositor on, it draws the rest itself;
   (B35) a dying light at its own power (pw); a dead player's, an unlit one and night vision draw nothing */
function drawPeers(revealFrom:RevealFrom,time:number,compositor:boolean){
 for(const p of window.__peerLights!){
  if(p.kind==='camcorder'){if(window.__cam)window.__cam.peerIR(revealFrom,p);continue;}
  if(compositor)continue;
  const spec=LIGHT_SPECS[p.kind as LightKind]||LIGHT_SPECS.flashlight,color=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#ffe7b2',r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16),origin={x:p.x,y:p.y,angle:p.angle},reveal=revealFrom(origin,r,g,b);
  const power=p.pw==null?1:+p.pw;
  if(p.dead||!p.on||spec.nv||!(power>0))continue;
  reveal(0,Math.PI*2,52,.35*power);
  const flicker=spec.omni?.93+Math.sin(time*17+p.x)*.035+Math.sin(time*31+p.y)*.025:1;
  if(spec.omni)reveal(0,Math.PI*2,spec.range,spec.power*flicker*power,true);
  else{const pass=1-(1-spec.power*power)**(1/12);for(let i=0;i<12;i++)reveal(origin.angle,spec.arc*(1-i*.063),spec.range,pass,true);}
 }
}
