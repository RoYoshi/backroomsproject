import {Application,Assets,Container,Graphics,Texture,TilingSprite} from 'pixi.js';
import {TILE,COLS,ROWS,cells,rooms,pitCells,lights,isFloor,rayDistance,lighting} from '../shared/world';
import {player} from '../shared/movement';
import {EntityView,smilerViews} from './entity-view';
import {smilers,entity} from '../shared/entity';
import {traces} from '../shared/evidence';
import {PlayerView} from './player-view';
import {visibilityPolygon,smooth} from '../shared/vision';
import {DeathSequence} from './death';
import {LIGHT_SPECS} from '../shared/equipment';
import {corpses,addCorpse,clearCorpses} from '../shared/remains';
import {CorpseView} from './corpse-view';
import {appearance} from './appearance';
export class Renderer{
 entityView=new EntityView();traceViews:Graphics[]=[];app=new Application();world=new Container();person=new PlayerView();camera={x:player.x-350,y:player.y};scale=.9;light=document.querySelector<HTMLCanvasElement>('#light')!;ctx=this.light.getContext('2d')!;lampShapes:number[][]=[];width=0;height=0;death=new DeathSequence();creatures=new Container();sightMask=new Graphics();sightPoints:number[]=[];scenePoints:number[]=[];corpseLayer=new Container();corpseViews=new Map<string,CorpseView>();baseScale=1.18;shakeX=0;shakeY=0;
 async init(){await this.app.init({resizeTo:window,background:'#776a36',antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,preference:'webgl'});document.querySelector('#game')!.appendChild(this.app.canvas);this.app.stage.addChild(this.world);this.build(await Assets.load<Texture>('/assets/carpet.png'));lights.forEach(l=>{const a:number[]=[];for(let i=0;i<96;i++){const angle=i/96*Math.PI*2,d=rayDistance(l.x,l.y,angle,380);a.push(l.x+Math.cos(angle)*d,l.y+Math.sin(angle)*d);}this.lampShapes.push(a);});this.resize();window.addEventListener('resize',()=>this.resize());}
 resize(){this.width=innerWidth;this.height=innerHeight;this.light.width=innerWidth;this.light.height=innerHeight;this.baseScale=innerWidth<700?.85:1.18;this.scale=this.baseScale;}
 build(floorTexture:Texture){let seed=42;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const floor=new TilingSprite({texture:floorTexture,width:COLS*TILE,height:ROWS*TILE});floor.tileScale.set(.32);this.world.addChild(floor);
 const g=new Graphics();this.world.addChild(g);
 // Moist carpet darkens in irregular patches. No grid joints or floor paint.
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(cells[y*COLS+x]){
  const px=x*TILE,py=y*TILE;
  if(rand()<.20)g.ellipse(px+rand()*90,py+rand()*90,20+rand()*55,10+rand()*28).fill({color:0x493f1e,alpha:.05+rand()*.09});
  if(rand()<.025)g.ellipse(px+rand()*80,py+rand()*80,13+rand()*16,7+rand()*11).fill({color:0x1f3427,alpha:.12});
 }
 // Every exposed wall is wallpaper, with scuffed trim and a low ceiling lip.
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!cells[y*COLS+x]){
  const px=x*TILE,py=y*TILE;
  const red=x>=44&&y>=34;
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
 // Floor openings read as deep square wells and stop movement and sight.
 for(const p of pitCells){const x=p.x*TILE,y=p.y*TILE;
  g.rect(x,y,TILE,TILE).fill(0x100d08);
  g.rect(x+7,y+7,TILE-14,TILE-14).fill(0x070606);
  g.moveTo(x,y+TILE).lineTo(x+TILE,y+TILE).lineTo(x+TILE,y).stroke({color:0xc5b985,width:6});
  g.rect(x+11,y+TILE-13,TILE-22,5).fill({color:0x403820,alpha:.7});
 }
 const dim=rooms[6],redRoom=rooms[8];
 g.rect(dim.x*TILE,dim.y*TILE,dim.w*TILE,dim.h*TILE).fill({color:0x090906,alpha:.39});
 g.rect(redRoom.x*TILE,redRoom.y*TILE,redRoom.w*TILE,redRoom.h*TILE).fill({color:0xb91712,alpha:.22});
 // Fluorescents float in an implied low ceiling and reflect on the carpet.
 lights.forEach((l,i)=>{
  const red=l.x>=redRoom.x*TILE&&l.y>=redRoom.y*TILE;
  g.ellipse(l.x,l.y+30,65,26).fill({color:red?0xff3d21:0xf3e9a1,alpha:red?.22:.11});
  g.roundRect(l.x-43,l.y-13,86,24,2).fill({color:0x5f5a3b,alpha:.55});
  g.rect(l.x-37,l.y-8,74,13).fill(red?0xff4a35:i%13===0?0x918e61:0xfff4bc);
  g.rect(l.x-32,l.y-4,64,4).fill({color:0xffffff,alpha:i%13===0?.12:.75});
  g.moveTo(l.x-43,l.y+10).lineTo(l.x+43,l.y+10).stroke({color:0x413e28,alpha:.5,width:3});
 });
 traces.forEach((trace,i)=>{
  const v=new Graphics();v.position.set(trace.x,trace.y);v.ellipse(0,5,20,9).fill({color:0x9af1d7,alpha:.11});
  v.roundRect(-15,-12,30,22,3).fill(0x273a34).stroke({color:0xa6d3b8,width:1.5});
  v.roundRect(-11,-8,22,12,1).fill(0x7ab5a1).rect(-8,-5,14,2).fill(0xe1f8d7).rect(-8,-1,17,1).fill(0xd4f3d4);
  v.circle(8,7,2).fill(0xf0d692);v.moveTo(-17,12).lineTo(17,12).stroke({color:0xd9f2d1,alpha:.5,width:1});
  this.traceViews[i]=v;this.world.addChild(v);
 });
 this.creatures.addChild(this.entityView,...smilerViews,this.death.foreground);this.world.addChild(this.corpseLayer,this.death.blood,this.death.debris,this.person,this.creatures,this.sightMask);this.creatures.mask=this.sightMask;}

 beginDeath(time:number){
  const index=entity.caughtBy==='Smiler'?smilers.reduce((best,s,i)=>Math.hypot(s.x-player.x,s.y-player.y)<Math.hypot(smilers[best].x-player.x,smilers[best].y-player.y)?i:best,0):-1;
  this.death.start(entity.caughtBy==='Smiler'?'Smiler':'Hound',time,index<0?entity:smilers[index],index);
 }
 completeDeath(time:number){
  const d=this.death;if(!d.finished||d.corpseId)return;
  const corpse=addCorpse({ownerId:player.id,name:player.name,createdAt:time,cause:d.kind,x:d.body.x,y:d.body.y,angle:d.body.angle,scaleX:d.body.scaleX,scaleY:d.body.scaleY,attackAngle:d.angle,appearance:{...appearance},equipment:{...player.equipment},blood:d.bursts.map(b=>({x:b.x,y:b.y,seed:b.seed})),dropped:{...d.torch},hat:{x:d.victim.x+Math.cos(d.angle+1.2)*40,y:d.victim.y+Math.sin(d.angle+1.2)*40,angle:d.angle+1.8}});
  d.corpseId=corpse.id;const attacker=d.attackerIndex<0?entity:smilers[d.attackerIndex];Object.assign(attacker,{x:d.attacker.x,y:d.attacker.y,angle:d.attacker.angle});
 }
 clearRemains(){clearCorpses();this.corpseViews.forEach(v=>v.destroy({children:true}));this.corpseViews.clear();}
 resetDeath(){this.death.reset();this.person.scale.set(1);this.person.alpha=1;this.entityView.alpha=0;smilerViews.forEach(v=>{v.scale.set(1);v.alpha=0;});this.scale=this.baseScale;this.shakeX=this.shakeY=0;}
 frame(dt:number,started:boolean,flash:boolean,time:number){
  const death=this.death;if(death.active)death.frame(time);
  const focus=death.active?death.body:player,targetX=focus.x-(started?0:350),k=1-Math.exp(-8*dt);
  this.camera.x+=(targetX-this.camera.x)*k;this.camera.y+=(focus.y-this.camera.y)*k;
  this.scale+=(this.baseScale*(death.active?1.4:1)-this.scale)*(1-Math.exp(-dt*3));
  this.shakeX=death.active?Math.sin(time*97)*death.shake:0;this.shakeY=death.active?Math.cos(time*113)*death.shake*.7:0;
  this.world.scale.set(this.scale);this.world.position.set(this.width/2-this.camera.x*this.scale+this.shakeX,this.height/2-this.camera.y*this.scale+this.shakeY);
  this.sightPoints=visibilityPolygon(focus.x,focus.y,700);this.scenePoints=visibilityPolygon(focus.x,focus.y,700,24);this.sightMask.clear().poly(this.sightPoints).fill(0xffffff);
  for(const record of corpses){let view=this.corpseViews.get(record.id);if(!view){view=new CorpseView(record);this.corpseViews.set(record.id,view);this.corpseLayer.addChild(view);}view.visible=record.id!==death.corpseId||!death.active;}
  this.person.update(time,flash);this.person.alpha=1;this.person.scale.set(1);
  this.entityView.update(started,time,dt,flash);smilerViews.forEach(v=>v.update(started,time,dt,flash));
  if(death.active){
   const b=death.body;this.person.position.set(b.x,b.y);this.person.rotation=b.angle;this.person.scale.set(b.scaleX,b.scaleY);this.person.alpha=b.alpha;
   this.person.deathPose(death.injury,death.impact,death.elapsed>.24);
   const attacker=death.attackerIndex<0?this.entityView:smilerViews[death.attackerIndex];
   attacker.position.set(death.attacker.x,death.attacker.y);attacker.rotation=death.attacker.angle+Math.PI/2;attacker.alpha=1;
   if(death.kind==='Hound')this.entityView.attackPose(death.grip,death.impact);
   else attacker.scale.set(1+smooth(.3,1.7,death.elapsed)*.9);
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
  const eye=this.death.active?this.death.body:player;
  const ambient=radial(eye.x,eye.y,18,670);
  ambient.addColorStop(0,'rgba(0,0,0,.14)');ambient.addColorStop(.5,'rgba(0,0,0,.045)');ambient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ambient;rect(eye.x-670,eye.y-670,1340,1340);
  if(!lighting.blackout)lights.forEach((l,i)=>{
   const sx=l.x*s+ox,sy=l.y*s+oy;if(sx< -390||sy< -390||sx>this.width+390||sy>this.height+390)return;
   c.save();polygon(this.lampShapes[i]);c.clip();const g=radial(l.x,l.y,6,380);
   const glow=i%13===0?.13+.06*Math.max(0,Math.sin(time*11+i)):.43;
   g.addColorStop(0,`rgba(0,0,0,${glow})`);g.addColorStop(.5,`rgba(0,0,0,${glow*.35})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;rect(l.x-380,l.y-380,760,760);c.restore();
  });
  const origin=this.death.active?this.death.torch:player,spec=LIGHT_SPECS[player.equipment.kind];
  const color=player.equipment.color,r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  const reveal=(center:number,arc:number,range:number,strength:number,tint=false)=>{
   const points:number[]=[origin.x,origin.y],n=Math.max(24,Math.ceil(arc*45));
   for(let i=0;i<=n;i++){const a=center-arc/2+i/n*arc,d=Math.max(0,rayDistance(origin.x,origin.y,a,range)-1);points.push(origin.x+Math.cos(a)*d,origin.y+Math.sin(a)*d);}
   c.save();polygon(points);c.clip();const gradient=radial(origin.x,origin.y,6,range);
   gradient.addColorStop(0,`rgba(0,0,0,${strength})`);gradient.addColorStop(.25,`rgba(0,0,0,${strength*.83})`);gradient.addColorStop(.7,`rgba(0,0,0,${strength*.28})`);gradient.addColorStop(1,'rgba(0,0,0,0)');
   c.fillStyle=gradient;rect(origin.x-range,origin.y-range,range*2,range*2);
   if(tint){c.globalCompositeOperation='source-over';const glow=radial(origin.x,origin.y,5,range);glow.addColorStop(0,`rgba(${r},${g},${b},${strength*.2})`);glow.addColorStop(.6,`rgba(${r},${g},${b},${strength*.065})`);glow.addColorStop(1,`rgba(${r},${g},${b},0)`);c.fillStyle=glow;rect(origin.x-range,origin.y-range,range*2,range*2);}
   c.restore();
  };
  reveal(0,Math.PI*2,this.death.active?150:52,this.death.active?.73:.35);
  if(flash){
   const flicker=spec.omni?.93+Math.sin(time*17)*.035+Math.sin(time*31)*.025:1;
   if(spec.omni)reveal(0,Math.PI*2,spec.range,spec.power*flicker,true);
   else{const pass=1-Math.pow(1-spec.power,1/12);for(let i=0;i<12;i++)reveal(origin.angle,spec.arc*(1-i*.063),spec.range,pass,true);}
  }
  c.restore();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';
  const vignette=c.createRadialGradient(this.width/2,this.height/2,this.height*.18,this.width/2,this.height/2,Math.max(this.width,this.height)*.7);
  vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(0,0,0,.65)');c.fillStyle=vignette;c.fillRect(0,0,this.width,this.height);
 // Reflections share the same corner mask and gradual exposure as the body.
 c.save();c.setTransform(s,0,0,s,ox,oy);this.polygon(c,this.sightPoints);c.clip();
 smilerViews.forEach((view,i)=>{
  if(!view.visible||view.alpha<.001)return;
  const sm=smilers[i],d=Math.hypot(sm.x-player.x,sm.y-player.y);
  const glow=(1-smooth(180,780,d))*.8*view.alpha;
  c.save();c.translate(view.x,view.y);c.rotate(view.rotation);c.scale(view.scale.x,view.scale.y);
  c.globalAlpha=glow;c.shadowColor='#edffe7';c.shadowBlur=14;c.fillStyle='#edf6dd';
  for(const side of [-1,1]){c.beginPath();c.ellipse(side*8,-7,3.5,5,0,0,Math.PI*2);c.fill();}
  c.beginPath();c.moveTo(-13,3);c.quadraticCurveTo(0,18,13,3);c.strokeStyle='#e6f0dc';c.lineWidth=2;c.stroke();c.restore();
 });c.restore();
 if(this.death.active){
  c.setTransform(1,0,0,1,0,0);
  if(this.death.impact>.05){const pulse=c.createRadialGradient(this.width/2,this.height/2,this.height*.25,this.width/2,this.height/2,this.width*.65);pulse.addColorStop(0,'transparent');pulse.addColorStop(1,`rgba(115,3,8,${Math.min(.5,this.death.impact*.5)})`);c.fillStyle=pulse;c.fillRect(0,0,this.width,this.height);}
  c.fillStyle=`rgba(2,1,1,${this.death.shade})`;c.fillRect(0,0,this.width,this.height);
 }
}
}
