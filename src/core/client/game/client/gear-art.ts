import type {Graphics} from 'pixi.js';
import type {LightKind,LightParts} from '../shared/equipment';
/* The carried lights, drawn (lineage B10; the headlamp, lantern and camcorder B11; owner P.O.C.K.E.T.).  Used for the Wanderer's own
 * gear (player-view.ts), the light a vanished player dropped (corpse-view.ts), and the loadout panel's preview (window.__api.gear.draw).
 *   g          the Graphics to draw into (the caller places and turns it)
 *   kind       which light; parts its part colours (#rrggbb, from partsFor)
 *   beam       the light's colour (a number); on: whether it is lit; time: seconds (the lantern's flame, the camcorder's lamp)
 *   handColor  the hand colour (a number) to draw the hands holding it, or -1 for no hands
 *   extra      cr: the camcorder's raise (0..1, the viewfinder opens past 0.05, its lamp blinks past 0.5); hat: the Wanderer's hat
 *              (the headlamp's strap goes over the head only without a hat or with a beanie; it sits higher under a cap or hard hat) */
export function drawGear(g:Graphics,kind:LightKind,parts:LightParts,beam:number,on:boolean,time:number,handColor:number,extra?:{cr?:number;hat?:string}){
 extra=extra||{};
 const hex=(c:string)=>parseInt(c.slice(1),16);
 const dark=(c:string,f:number)=>{const n=hex(c);return Math.round((n>>16&255)*f)<<16|Math.round((n>>8&255)*f)<<8|Math.round((n&255)*f);};
 const hands=handColor>=0;
 if(kind==='flashlight'){
  g.roundRect(-3.3,5,6.6,3.6,1.5).fill(dark(parts.body,.7)).stroke({color:0x15181a,width:1});
  g.roundRect(-3.8,-13,7.6,19,2).fill(hex(parts.body)).stroke({color:0x14131a,width:1.3});
  g.rect(-2.7,-12,1.2,17).fill({color:0xffffff,alpha:.16});
  g.rect(-3.8,-5,7.6,9).fill(hex(parts.grip));
  for(let i=0;i<4;i++)g.moveTo(-3.8,-4+i*2.3).lineTo(3.8,-3.4+i*2.3).stroke({color:0xffffff,alpha:.14,width:.7});
  g.poly([-3.8,-13,-5.9,-20.5,5.9,-20.5,3.8,-13]).fill(hex(parts.head)).stroke({color:0x14131a,width:1.2});
  g.rect(-5.9,-21.8,11.8,1.7).fill(dark(parts.head,.78));
  g.ellipse(0,-21.6,4.7,1.5).fill(on?beam:0x1a2222);
  if(on){g.ellipse(0,-22.8,6.8,2.3).fill({color:beam,alpha:.32});g.circle(0,-21.8,2.2).fill({color:0xffffff,alpha:.55});}
  g.roundRect(3.7,-7.5,2.3,4.6,1).fill(hex(parts.button)).stroke({color:0x14131a,width:.8});
  g.rect(4.1,-7,.7,3.2).fill({color:0xffffff,alpha:.3});
  if(hands){for(let i=0;i<3;i++)g.ellipse(-3.3,-3+i*2.9,2.3,1.6).fill(handColor).stroke({color:0x494832,width:.8});g.ellipse(3.2,-.4,2.3,1.7).fill(handColor).stroke({color:0x494832,width:.8});}
 }else if(kind==='lantern'){
  const frame=hex(parts.frame),handle=hex(parts.handle),cap=hex(parts.cap),flame=1+(on?Math.sin(time*13)*.05+Math.sin(time*7.3)*.03:0);
  if(on)g.circle(0,-13,16).fill({color:beam,alpha:.13});
  g.moveTo(-5.8,-10).quadraticCurveTo(0,3,5.8,-10).stroke({color:0x14131a,width:2.8,cap:'round'});
  g.moveTo(-5.8,-10).quadraticCurveTo(0,3,5.8,-10).stroke({color:handle,width:1.5,cap:'round'});
  g.circle(0,-13,8).fill(dark(parts.frame,.75)).stroke({color:0x14131a,width:1.2});
  g.circle(0,-13,5.9).fill(on?{color:beam,alpha:.92}:{color:0x28312a,alpha:.9});
  if(on){g.circle(0,-13,3.4*flame).fill({color:0xfff0b0,alpha:.85});g.circle(0,-13,1.5).fill({color:0xffffff,alpha:.9});}
  for(let i=0;i<6;i++){const r=i*Math.PI/3+.26;g.moveTo(Math.cos(r)*2.8,-13+Math.sin(r)*2.8).lineTo(Math.cos(r)*7.8,-13+Math.sin(r)*7.8).stroke({color:frame,width:1.3});}
  g.circle(0,-13,7.9).stroke({color:frame,width:1.1});
  g.circle(0,-13,2.7).fill(cap).stroke({color:0x14131a,width:.8});
  g.circle(-1,-14,.8).fill({color:0xffffff,alpha:.4});
  if(hands)for(const m of [-1,1])g.ellipse(m*2.6,1.2,2.1,1.5).fill(handColor).stroke({color:0x494832,width:.8});
 }else if(kind==='camcorder'){
  const cr=extra.cr??0,body=hex(parts.body),lens=hex(parts.lens),grip=hex(parts.grip),trim=hex(parts.trim);
  if(cr>.05){                                                               // the viewfinder, open while it is raised
   g.roundRect(-18.5,-6,9,12,1.5).fill(dark(parts.body,.8)).stroke({color:0x14131a,width:1});
   g.rect(-17.3,-4.6,6.6,9.2).fill(0x0a0e0d);
   g.rect(-17.3,-4.6,6.6,9.2).fill({color:0x6cfe9a,alpha:.24*cr*(.7+.3*Math.sin(time*3))});
  }
  g.roundRect(-9.5,-8,12,17,2.5).fill(body).stroke({color:0x14131a,width:1.3});
  g.rect(-9.5,-1.4,12,1.6).fill(trim);
  g.rect(-8.6,-7,1.4,15).fill({color:0xffffff,alpha:.1});
  g.roundRect(-8,-15.5,9,8,2).fill(dark(parts.lens,.7)).stroke({color:0x14131a,width:1});
  g.ellipse(-3.5,-15.6,4.4,1.7).fill(lens).stroke({color:0x14131a,width:.8});
  g.ellipse(-3.5,-15.6,3,1.05).fill(0x0b1220);
  g.ellipse(-4.3,-15.8,1,.45).fill({color:0x9fd0ff,alpha:.7});
  g.roundRect(-7,9,7,3.2,1).fill(dark(parts.body,.6)).stroke({color:0x14131a,width:.8});
  g.roundRect(2,-6,3.4,13,1.5).fill(grip).stroke({color:0x14131a,width:.8});
  g.circle(-7.6,-5.4,1.1).fill(cr>.5&&Math.sin(time*4)>0?0xff2a2a:0x491010);     // the recording lamp
  if(hands)for(let i=0;i<3;i++)g.ellipse(4.2,-3.4+i*3.6,2.1,1.5).fill(handColor).stroke({color:0x494832,width:.8});
 }else{                                                                     // the headlamp, on the head (its strap, bracket, housing, lens)
  const hy=extra.hat==='hardhat'||extra.hat==='cap'?-27:-20.5;
  if(!extra.hat||extra.hat==='none'||extra.hat==='beanie')for(const m of [-1,1]){
   g.moveTo(m*5.5,hy+3).quadraticCurveTo(m*18.5,hy+6,m*15.5,hy+22).stroke({color:0x15181a,width:4.6,cap:'round'});
   g.moveTo(m*5.5,hy+3).quadraticCurveTo(m*18.5,hy+6,m*15.5,hy+22).stroke({color:hex(parts.strap),width:2.9,cap:'round'});
  }
  g.roundRect(-9,hy-.6,18,3.2,1.3).fill(hex(parts.bracket)).stroke({color:0x15181a,width:.8});
  g.roundRect(-7,hy-4.4,14,7.6,2.6).fill(hex(parts.housing)).stroke({color:0x11151a,width:1.3});
  g.rect(-4.6,hy-1.6,9.2,.8).rect(-4.6,hy+.6,9.2,.8).fill({color:0,alpha:.35});
  g.ellipse(0,hy-4.9,5.3,1.8).fill(on?beam:0x1e292b).stroke({color:dark(parts.bracket,.6),width:.9});
  if(on){g.ellipse(0,hy-6,7.8,2.5).fill({color:beam,alpha:.3});g.circle(0,hy-5.2,1.7).fill({color:0xffffff,alpha:.5});}
  g.circle(4.6,hy+1.1,.9).fill(hex(parts.bracket));
 }
}
