import {Container,Graphics} from 'pixi.js';
import {entity,smilers,type Smiler} from '../shared/entity';
import {player} from '../shared/movement';
import {exposureAt} from '../shared/vision';

/* (lineage B11, owner BR-R) what the camcorder (cam.js, window.__cam.fx) does to an entity seen through it: the alpha the view is drawn
   at. Night-vision-only entities vanish without night vision; an effect may scale, obscure or skew the view, and the camcorder is told
   (touch) when a strongly seen entity interferes with it. */
function camcorderFx(alpha:number,kind:'hound'|'smiler',view:Container,time:number){
 const cam=window.__cam,fx=cam&&cam.fx&&cam.fx(kind);
 if(!fx)return alpha;
 const nv=cam.nv;
 if(fx.onlyNV&&!nv)return 0;
 alpha*=fx.gain??1;
 if(fx.obscure)alpha*=1-fx.obscure*(.5+.5*Math.sin(time*7+view.x*.01));
 view.skew.set(fx.distort?Math.sin(time*37)*fx.distort*.05:0,0);
 if(nv&&alpha>.2&&(fx.interfere||fx.static||fx.glitch))cam.touch(fx,alpha);
 return alpha;
}

/* A Hound is an emaciated humanoid built to move on all fours. (B02, owner BR-R) its body and jaw were rebuilt; (B14, owners BR-R and
   N.A.N.I.) its limbs, hair and every movement are drawn by ents.js (window.__ents.initHound / drawHound / attackHound), which reads
   these parts by name. */
export class EntityView extends Container{
 limbs=new Graphics();spine=new Container();hair=new Graphics();jaw=new Graphics();
 /* (B09, owner BPP) the server Hound this view draws, set by the page (window.__hounds); unset, the view draws the local Hound */
 declare g?:{x:number;y:number;angle:number}|null;
 /* (B19, owner BR-RoLE) the light sample's scratch record (window.__light.mk) and the eased shade the view is tinted with */
 declare __lt?:TFB.LightSampleScratch;declare __shade?:number;
 constructor(){super();
  const shadow=new Graphics().ellipse(0,13,39,19).fill({color:0x000000,alpha:.46});
  this.addChild(shadow,this.limbs,this.spine);
  const body=new Graphics();
  body.poly([-12,-31,-20,-17,-17,4,-10,20,-3,27,8,25,17,10,19,-15,11,-31]).fill(0x817565).stroke({color:0x211d1a,width:2.4});
  body.ellipse(-10,-13,9,12).ellipse(10,-13,9,12).fill({color:0x9f927d,alpha:.72});
  body.poly([-8,7,-13,18,-4,28,7,26,13,13,8,5]).fill({color:0x685f54,alpha:.72});
  for(let i=0;i<7;i++){const y=-23+i*6;body.ellipse(0,y,2.5,1.9).fill(0xb7a993);if(i<5)body.moveTo(-3,y+1).quadraticCurveTo(-12,y+5,-15,y+2).moveTo(3,y+1).quadraticCurveTo(12,y+5,15,y+2).stroke({color:0xb4a48e,alpha:.72,width:1.45});}
  body.moveTo(-14,-18).quadraticCurveTo(-21,-1,-11,17).moveTo(14,-18).quadraticCurveTo(21,-1,10,17).stroke({color:0x2b2621,width:2.2});
  body.ellipse(-8,18,8,7).ellipse(8,18,8,7).fill({color:0x5b5249,alpha:.65});
  const jaw=this.jaw;
  jaw.ellipse(0,-32,14,15).fill(0x736a5e).stroke({color:0x1b1816,width:2.5});
  jaw.ellipse(0,-29,11,10).fill(0x100d0c);
  jaw.ellipse(0,-34,11,5).fill({color:0x1b1715,alpha:.75});
  for(let i=0;i<8;i++){const x=-9+i*2.6;jaw.poly([x,-36,x+1.2,-30,x+2.3,-36]).fill(0xe0d7bd);jaw.poly([x,-22,x+1.1,-28,x+2.2,-22]).fill(0xd6ccb5);}
  jaw.moveTo(-10,-29).quadraticCurveTo(0,-21,10,-29).stroke({color:0x592326,width:1.3});
  this.spine.addChild(body,jaw,this.hair);
  if(window.__ents)window.__ents.initHound(this);
 }
 update(active:boolean,time:number,dt:number,flash:boolean){
  const hound=this.g||entity;
  this.visible=active;if(!active){this.alpha=0;return;}
  // (B19) the light decides what can be seen of a Hound: it is drawn whole, through the camcorder's effect, and shaded by the light
  // at its position (window.__light, BR-RoLE)
  const target=camcorderFx(1,'hound',this,time),light=window.__light;
  this.alpha+=(target-this.alpha)*(1-Math.exp(-dt*(target>this.alpha?15:9)));
  if(light){
   const sample=light.sample(hound.x,hound.y,flash,this.__lt||(this.__lt=light.mk())),shade=light.shade(sample.total),previous=this.__shade??shade;
   this.__shade=previous+(shade-previous)*(1-Math.exp(-dt*8));
   const c=Math.round(this.__shade*255);
   this.tint=c<<16|c<<8|c;
  }
  this.position.set(hound.x,hound.y);this.rotation=hound.angle+Math.PI/2;this.scale.set(1);
  if(window.__ents)window.__ents.drawHound(this,hound,time,dt);
 }
 /* (B14, B16, B18) the capture: ents.js poses the Hound for the death's variant (and, B16, the death itself); X-ray mode
    (window.__dlab, the death lab) shows it faint */
 attackPose(grip:number,impact:number,variant?:string,death?:unknown){
  this.alpha=window.__dlab&&window.__dlab.xray?.28:1;
  if(window.__ents)window.__ents.attackHound(this,grip,impact,variant,death);
 }
}
/* A Smiler: (B02, B14) its body and face are drawn by ents.js (window.__ents.initSmiler / drawSmiler) */
export class SmilerView extends Container{
 body=new Graphics();face=new Graphics();smiler:Smiler;
 /* (B14) set by ents.js on a Smiler it drew: then it also draws the eyes' glow (render.ts) */
 declare __smiler?:unknown;
 constructor(smiler:Smiler){super();this.smiler=smiler;this.addChild(this.body,this.face);if(window.__ents)window.__ents.initSmiler(this);}
 update(active:boolean,time:number,dt:number,flash:boolean){
  const s=this.smiler;
  // (B09, B21) a Smiler slot the server has not filled is not drawn
  this.visible=active&&!s.off;if(!this.visible){this.alpha=0;return;}
  // (B01, B02, B19) how readable the Smiler is in the light (window.__light, BR-RoLE; else the local exposure), through the camcorder;
  // ents.js turns that into its presence (else: whole above .72, never below .12)
  const seen=camcorderFx(window.__light?window.__light.readability(s.x,s.y,flash):exposureAt(s.x,s.y,player,flash),'smiler',this,time),
   presence=window.__ents&&window.__ents.smilerPresence?window.__ents.smilerPresence(seen,this):seen>.72?1:Math.max(.12,seen);
  this.alpha+=(presence-this.alpha)*(1-Math.exp(-dt*(presence>this.alpha?16:9)));
  this.position.set(s.x,s.y);this.rotation=s.angle+Math.PI/2;
  // (B02, B14) it swells when it pursues or attacks, a little when it watches (the states of v11's own Smilers and of the server's)
  const scale=s.state==='PROVOKED'||s.state==='ATTACKING'||s.state==='pursue'?1.13:s.state==='WATCHING'||s.state==='watch'?1.02:1;
  this.scale.set(this.scale.x+(scale-this.scale.x)*(1-Math.exp(-dt*9)));
  if(window.__ents)window.__ents.drawSmiler(this,s,time,dt,seen);
 }
}
export const smilerViews=smilers.map(s=>new SmilerView(s));
