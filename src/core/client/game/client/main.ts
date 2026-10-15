import './style.css';
import {Application} from 'pixi.js';
import {PlayerView} from './player-view';
import {appearance,saveAppearance,type Appearance} from './appearance';
import {equipment,saveEquipment} from './loadout';
import {LIGHT_SPECS,LIGHT_PARTS,partsFor,validLight,carriedLightAt,type LightKind,type LightEquipment} from '../shared/equipment';
import {traces,resetTraces,collected,takeTrace} from '../shared/evidence';
import {entity,resetEntity,resumeEntities,updateEntity,updateSmilers,smilers} from '../shared/entity';
import {Renderer} from './render';
import {ambience as audio} from './audio';
import {player,step} from '../shared/movement';
import {cells,COLS,ROWS,TILE,spawn,rooms,lights,lighting,resetLighting,stepLighting,nearby,rayDistance,isFloor,blocksSight} from '../shared/world';
import {corpses,addCorpse,type Corpse} from '../shared/remains';
import {passable,center,nearest,findPath,clearSegment,clearPoint} from '../shared/navigation';
import {exposureAt,smooth} from '../shared/vision';
import {drawGear} from './gear-art';
import {DeathSequence} from './death';
import {EntityView,SmilerView} from './entity-view';
import {arrival,safeRespawn} from './arrival';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const renderer=new Renderer(),keys=new Set<string>(),death=renderer.death;
/* (lineage B10, B11; owner P.O.C.K.E.T.) flash: the carried light is on; the camcorder starts lowered */
let started=false,paused=false,flash=equipment.kind!=='camcorder',map=false,last=performance.now(),accumulator=0,uiTime=0;
let mouseX=innerWidth*.7,mouseY=innerHeight*.5,mouseActive=false,customizing=false,previousPause=false,won=false,deathFinished=false;
/* (B22, owner S.P.A.C.E.) the fixed-step timing: the page's (window.TFB_TIMING, timing.js), else 60 steps a second, at most 15 in one
   frame, a frame's time capped at .25 s */
const timing=window.TFB_TIMING||{FIXED_DT:1/60,MAX_CATCHUP_STEPS:15,frameDelta:(now:number,previous:number)=>Math.min(.25,Math.max(0,(now-previous)/1e3))};
function pause(value:boolean){if(entity.caught)return;paused=value;keys.clear();$('dialog').hidden=!value;if(value&&audio.context)void audio.context.suspend();else if(started)audio.start();}
function toggleMap(){map=!map;$('mapPanel').hidden=!map;drawMap();}
/* (B09, owner BPP) the evidence count is no longer shown (the level has no traces) */
function updateEvidence(){}
/* (B10, owner P.O.C.K.E.T.) the cartograph's map: the level as a weak signal, 6 px a cell. Cells near the wanderer show clearly, far
   ones drop out; rooms are dashed outlines until the wanderer is near, their codes ?? until then; bodies are red crosses; the wanderer
   a drifting, pulsing dot; static, scan lines, a vignette and the signal's readout. fr: noise that changes five times a second; st:
   noise that does not change. */
function drawMap(){
 if(!map)return;
 const canvas=$<HTMLCanvasElement>('map'),c=canvas.getContext('2d')!,n=6,T=performance.now()/1e3,sd=Math.floor(T*5),
  fr=(a:number,b=0)=>{const x=Math.sin(a*127.1+b*311.7+sd*74.7)*43758.5453;return x-Math.floor(x);},
  st=(a:number,b=0)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x);},
  px=player.x/TILE,py=player.y/TILE;
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle='#070b08';c.fillRect(0,0,canvas.width,canvas.height);
 c.strokeStyle='rgba(150,170,110,.07)';c.lineWidth=1;c.beginPath();
 for(let x=0;x<=canvas.width;x+=36){c.moveTo(x,0);c.lineTo(x,canvas.height);}
 for(let y=0;y<=canvas.height;y+=36){c.moveTo(0,y);c.lineTo(canvas.width,y);}
 c.stroke();c.save();c.translate((fr(1)-.5)*1.8,(fr(2)-.5)*1.8);
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
  if(!cells[y*COLS+x])continue;
  const d=Math.hypot(x-px,y-py),dropout=Math.min(.6,Math.max(0,(d-9)/55))+.05;
  if(st(x,y)<dropout)continue;
  const strength=d<12?.5:d<30?.36:.24,jitter=(st(x,y+7)-.5)*1.7+(fr(x,y)<.04?(fr(x+3,y)-.5)*5:0);
  c.fillStyle=`rgba(196,180,104,${strength+st(y,x)*.14})`;c.fillRect(x*n+jitter,y*n+(st(y,x+9)-.5)*1.4,n-1+(st(x,y+3)-.5)*1.5,n-1);
 }
 c.lineWidth=1.3;c.font='10px IBM Plex Mono, monospace';
 for(const room of rooms){
  const d=Math.hypot(room.x+room.w/2-px,room.y+room.h/2-py),near=d<34;
  c.strokeStyle=near?'rgba(232,238,170,.85)':'rgba(232,238,170,.22)';c.setLineDash(near?[]:[5,4]);c.beginPath();
  const corners=[[room.x,room.y],[room.x+room.w,room.y],[room.x+room.w,room.y+room.h],[room.x,room.y+room.h],[room.x,room.y]],seed=room.x*7.1+room.y*3.3;
  for(let side=0;side<4;side++){
   const from=corners[side],to=corners[side+1];
   // (the x wobble's `to?3.4:1.6` is always 3.4: every side has its end)
   for(let s=0;s<=4;s++){
    const f=s/4,x=(from[0]+(to[0]-from[0])*f)*n+(st(seed+side*9+s,3)-.5)*(to?3.4:1.6)+(fr(side,s)-.5)*.9,y=(from[1]+(to[1]-from[1])*f)*n+(st(seed+side*9+s,5)-.5)*3.4+(fr(s,side)-.5)*.9;
    if(s)c.lineTo(x,y);else c.moveTo(x,y);
   }
  }
  c.stroke();c.setLineDash([]);c.fillStyle=near?'rgba(240,232,170,.8)':'rgba(200,195,140,.3)';
  c.fillText(near&&fr(room.x)>.08?`${room.code}`:'??',(room.x+1)*n+(st(seed,1)-.5)*3,(room.y+2)*n+(st(seed,2)-.5)*3);
 }
 c.fillStyle='rgba(190,60,60,.85)';
 for(const body of corpses){c.fillRect(body.x/TILE*n-2,body.y/TILE*n-.5,5,1.6);c.fillRect(body.x/TILE*n-.5,body.y/TILE*n-2,1.6,5);}
 const dx=Math.sin(T*.7)*4+(fr(4)<.04?(fr(5)-.5)*30:0),dy=Math.cos(T*.9)*4+(fr(6)<.04?(fr(7)-.5)*30:0),bx=px*n+dx,by=py*n+dy,pulse=T*1.4%1;
 c.strokeStyle=`rgba(255,241,167,${.5*(1-pulse)})`;c.lineWidth=1.4;c.beginPath();c.arc(bx,by,4+pulse*14,0,Math.PI*2);c.stroke();
 c.fillStyle='#fff1a7';c.beginPath();c.arc(bx,by,3.2,0,Math.PI*2);c.fill();c.restore();
 for(let i=0;i<2;i++){const y=fr(11+i)*canvas.height;c.fillStyle=`rgba(200,255,200,${.03+fr(13+i)*.06})`;c.fillRect(0,y,canvas.width,2+fr(15+i)*8);}
 for(let i=0;i<46;i++){c.fillStyle=`rgba(210,230,190,${fr(i,9)*.3})`;c.fillRect(fr(i,1)*canvas.width,fr(i,2)*canvas.height,2,1.5);}
 c.fillStyle='rgba(0,0,0,.13)';
 for(let y=0;y<canvas.height;y+=3)c.fillRect(0,y,canvas.width,1);
 const vignette=c.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*.3,canvas.width/2,canvas.height/2,canvas.width*.65);
 vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.6)');c.fillStyle=vignette;c.fillRect(0,0,canvas.width,canvas.height);
 c.fillStyle='rgba(180,196,130,.78)';c.font='11px IBM Plex Mono, monospace';
 c.fillText(`SIGNAL ${38+(fr(9)*24|0)}%   DRIFT ±${(2+fr(10)*5).toFixed(1)}`,12,20);
}
/* the wanderer comes back after a death: (B05, owner BPP) the network script hears of it; (B12) at a safe point, falling in; (B02)
   rested; (B14) the movement script (window.__mv) starts again */
function respawn(){
 if(window.__net)window.__net.respawn();
 resumeEntities();renderer.resetDeath();deathFinished=false;won=false;flash=equipment.kind!=='camcorder';
 Object.assign(player,safeRespawn(),{vx:0,vy:0,distance:0,stamina:100,sprinting:false,exhausted:false});if(window.__mv)window.__mv.reset();
 audio.lastStep=0;accumulator=0;renderer.camera={x:player.x,y:player.y};$('caught').hidden=true;$('won').hidden=true;document.body.classList.remove('captured');pause(false);updateEvidence();
}
/* (B39, owners BPP and G.I.B.) the world's epoch changed (an admin reset): a death on this screen ends, the wanderer stands at (x, y)
   (no fall) and its own bodies are gone. False when it was not dead. */
function worldEnd(x:number,y:number){
 if(!entity.caught)return false;
 resumeEntities();renderer.resetDeath();deathFinished=false;won=false;flash=equipment.kind!=='camcorder';
 Object.assign(player,{x,y,vx:0,vy:0,distance:0,stamina:100,sprinting:false,exhausted:false});if(window.__mv)window.__mv.reset();
 audio.lastStep=0;accumulator=0;renderer.camera={x:player.x,y:player.y};$('caught').hidden=true;$('won').hidden=true;document.body.classList.remove('captured');pause(false);
 for(let i=corpses.length;i--;)if(!corpses[i].remote&&String(corpses[i].ownerId)===String(player.id))corpses.splice(i,1);
 return true;
}
/* a run starts: (B12) the wanderer is shown again, a vanish ends, the run menu closes; (B10, owner P.O.C.K.E.T.) the inventory
   empties; (B05) the network script joins; the wanderer falls in at a safe point (B12), rested (B02) */
function newRun(){
 window.__hideSelf=false;arrival.vanish=null;$('runMenu').hidden=true;if(window.__inv)window.__inv.reset();if(window.__net)window.__net.join();
 resetEntity();resetLighting();resetTraces();renderer.clearRemains();renderer.resetDeath();deathFinished=false;won=false;flash=equipment.kind!=='camcorder';
 Object.assign(player,safeRespawn(),{vx:0,vy:0,distance:0,stamina:100,sprinting:false,exhausted:false});if(window.__mv)window.__mv.reset();player.name=$<HTMLInputElement>('name').value.trim()||'Wanderer';
 audio.lastStep=0;accumulator=0;started=true;paused=false;keys.clear();renderer.camera={x:player.x,y:player.y};
 $('dialog').hidden=$('menu').hidden=$('caught').hidden=$('won').hidden=$('mapPanel').hidden=true;map=false;$('hud').hidden=false;
 $('nameplate').textContent=player.name;document.body.classList.add('playing');document.body.classList.remove('captured');updateEvidence();audio.start();
}
$('enter').onclick=newRun;
$<HTMLInputElement>('name').addEventListener('keydown',e=>{if(e.key==='Enter')newRun();});
$('sound').onclick=()=>{$('sound').textContent=audio.toggle()?'SOUND OFF':'SOUND ON';};
$('help').onclick=()=>pause(true);$('resume').onclick=()=>pause(false);
// (B12) RESET is NEW RUN; the run menu (after a vanish): spawn, customize, or back to the title
$('reset').onclick=newRunPressed;$('retry').onclick=respawn;$('playAgain').onclick=newRun;
$('runSpawn').onclick=newRun;$('runCustomize').onclick=()=>($('customize').onclick as ()=>void)();$('runEnd').onclick=()=>{$('runMenu').hidden=true;$('menu').hidden=false;};
$('closeMap').onclick=toggleMap;
// (B11) the camcorder script (window.__cam) hears when the light is raised or lowered
$('touchFlash').onclick=()=>{flash=!flash;if(window.__cam)window.__cam.toggled(equipment.kind,flash);};
const previewApp=new Application(),previewPerson=new PlayerView();
previewApp.init({width:300,height:150,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true}).then(()=>{
 $('avatarPreview').appendChild(previewApp.canvas);previewPerson.position.set(150,70);previewPerson.scale.set(2.5);previewApp.stage.addChild(previewPerson);previewApp.ticker.add(()=>{if(customizing)previewPerson.update(performance.now()/1000,true,true);});
 // (B31, owner FRONT) the customize preview's application, for the page's two-area customize screen
 window.__avatarApp=previewApp;
}).catch(()=>{$('avatarPreview').textContent='Preview unavailable. Your choices still apply in game.';});
function closeAppearance(){customizing=false;$('appearancePanel').hidden=true;pause(previousPause);$('customize').focus();}
// (B11) a dead wanderer may customize while the loadout screen (window.__loadout) is open
$('customize').onclick=()=>{if(entity.caught&&!window.__loadout)return;previousPause=paused;pause(true);customizing=true;$('dialog').hidden=true;$('appearancePanel').hidden=false;$('avatarHat').focus();};
$('closeAppearance').onclick=$('doneAppearance').onclick=closeAppearance;
for(const [id,key] of [['avatarHat','hat'],['avatarTexture','texture'],['avatarHands','hands'],['avatarMain','main'],['avatarBackpack','backpack']] as const){
 const el=$(id) as HTMLInputElement|HTMLSelectElement;el.value=appearance[key];el.addEventListener('input',()=>{appearance[key]=el.value;saveAppearance();});
}
/* (B11, owner P.O.C.K.E.T.) the four lights */
const lightDescriptions:Record<LightKind,string>={flashlight:'Long-range directional visibility. A narrow, strong beam that follows your mouse.',headlamp:'Wide, medium-range coverage that turns with your head. Best on the move.',lantern:'Warm light all around you. Great for rooms, poor for long corridors.',camcorder:'No light at all. Raise it (F), then switch on night vision (N) to see the dark.'};
function updateLightDescription(){$('lightDescription').textContent=lightDescriptions[equipment.kind];}
$<HTMLSelectElement>('lightKind').value=equipment.kind;$<HTMLInputElement>('lightColor').value=equipment.color;
// (B11) a new light starts on (a camcorder lowered), and the camcorder script starts again
$('lightKind').addEventListener('change',()=>{equipment.kind=$<HTMLSelectElement>('lightKind').value as LightKind;flash=equipment.kind!=='camcorder';if(window.__cam)window.__cam.reset();saveEquipment();updateLightDescription();});
$('lightColor').addEventListener('input',()=>{equipment.color=$<HTMLInputElement>('lightColor').value;saveEquipment();});updateLightDescription();
$('appearancePanel').addEventListener('keydown',e=>{if(e.key==='Tab'){const els=Array.from($('appearancePanel').querySelectorAll<HTMLElement>('button,input,select'));const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.addEventListener('keydown',e=>{
 if(customizing){if(e.code==='Escape'){e.preventDefault();closeAppearance();}return;}
 if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(started&&!won)pause(!paused);return;}if(!started||paused||entity.caught||won)return;
 // (B11) the camcorder script hears of F; (B10) the map needs the cartograph (window.__inv, the inventory)
 keys.add(e.code);if(!e.repeat){if(e.code==='KeyF'){flash=!flash;if(window.__cam)window.__cam.toggled(equipment.kind,flash);}if(e.code==='KeyM'&&window.__inv&&window.__inv.has('cartograph'))toggleMap();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(started&&!customizing&&!won)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!customizing&&!won)pause(true);});
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){mouseX=e.clientX;mouseY=e.clientY;mouseActive=true;}});
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key!);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key!);});
/* NEW RUN pressed (B12, owners G.I.B. and FRONT; B37, owner BPP). (B37) With a server, the server decides (window.__net.nr: it calls
   newRunApproved when it agrees). Else a wanderer not started, dead, done or already leaving begins a new run at once, and any other
   vanishes where it stands (2.7 s), its light left on the floor, the network script told. */
function newRunPressed(){
 const net=window.__net;
 if(net&&net.nr&&started&&!won&&net.nr(newRunApproved))return;
 // (B12 wrote the last clause, paused===false&&false, which is always false)
 if(!started||entity.caught||won||arrival.vanish||paused===false&&false){newRun();return;}
 const now=performance.now()/1e3,turn=player.angle+Math.PI/2,c=Math.cos(turn),s=Math.sin(turn);
 arrival.vanish={t0:now,dur:2.7};pause(false);keys.clear();
 addCorpse({ownerId:player.id,name:player.name,createdAt:now,cause:'Vanish',x:player.x,y:player.y,angle:0,scaleX:1,scaleY:1,attackAngle:0,appearance:{...appearance},equipment:{...player.equipment},blood:[],dropped:{x:player.x+13*c+13*s,y:player.y+13*s-13*c,angle:player.angle+Math.PI/2+.5},hat:{x:player.x,y:player.y,angle:0}});
 if(window.__net&&window.__net.vanish)window.__net.vanish({x:player.x,y:player.y,a:player.angle});
}
/* (B37) the server agreed: the wanderer vanishes quickly (0.8 s) and is hidden; (B38, owner G.I.B.) its light goes out */
function newRunApproved(){if(!started||won)return;arrival.vanish={t0:performance.now()/1e3,dur:.8};window.__hideSelf=true;flash=false;pause(false);keys.clear();}
/* (B12) the vanish is over: the wanderer leaves the run (the network script and the inventory hear of it) and the run menu opens */
function vanished(){arrival.vanish=null;window.__hideSelf=true;started=false;paused=false;keys.clear();document.body.classList.remove('playing');$('hud').hidden=true;$('mapPanel').hidden=true;map=false;if(window.__net&&window.__net.leave)window.__net.leave();if(window.__inv&&window.__inv.close)window.__inv.close();$('runMenu').hidden=false;}
/* (B04) a frame that throws is reported, and the loop goes on */
function frame(time:number){try{frameBody(time);}catch(err){console.error(err);}requestAnimationFrame(frame);}
function frameBody(time:number){
 const dt=timing.frameDelta(time,last);last=time;
 // (B12) no input during a fall or a vanish; a vanish ends in time
 if(arrival.fall||arrival.vanish)keys.clear();
 if(arrival.vanish&&performance.now()/1e3-arrival.vanish.t0>=arrival.vanish.dur)vanished();
 const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),dy=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
 if(started&&!paused&&!entity.caught&&!won){
  // (B11) every light aims with the mouse (v11's chest lamp followed the movement)
  if(mouseActive){const px=innerWidth/2+(player.x-renderer.camera.x)*renderer.scale,py=innerHeight/2+(player.y-renderer.camera.y)*renderer.scale;player.angle=Math.atan2(mouseY-py,mouseX-px);}
  else if(dx||dy)player.angle=Math.atan2(dy,dx);
  accumulator+=dt;
  // (B22) fixed steps of the page's length, at most the page's number in one frame
  for(let steps=0,fixedDt=timing.FIXED_DT;accumulator+1e-12>=fixedDt&&steps<timing.MAX_CATCHUP_STEPS;steps++){
   step(dx,dy,sprint,fixedDt);
   // (B05, owner BPP) with a server the lights are the server's
   if(!(window.__net&&window.__net.on))stepLighting(fixedDt);
   // (B05) the trace found (window.__c) is told to the server
   if(window.__c=takeTrace(player.x,player.y)){
    if(window.__net)window.__net.collected(traces.indexOf(window.__c));
    audio.collect();updateEvidence();entity.pressure=collected()/traces.length;
    if(collected()===traces.length){won=true;keys.clear();$('won').hidden=false;accumulator=0;break;}
   }
   // (B05) with a server, the server moves the entities (window.__net.tick); (B02) the Hound hears a sprint by the wanderer's own flag
   if(window.__net&&window.__net.on)window.__net.tick();else{updateEntity(player,player.sprinting,fixedDt,flash);updateSmilers(player,flash,fixedDt);}
   accumulator-=fixedDt;
   if(entity.caught){
    keys.clear();accumulator=0;renderer.beginDeath(time/1e3);audio.death(entity.caughtBy==='Smiler'?'Smiler':'Hound');deathFinished=false;
    $('caughtTitle').textContent=entity.caughtBy==='Smiler'?'You fed the dark.':'It found you.';
    $('caughtAdvice').textContent=(entity.caughtBy==='Smiler'?'It waited for you to look away.':'It remembered where you ran.')+' Your body and dropped gear remain in this run.';
    $('mapPanel').hidden=true;map=false;document.body.classList.add('captured');break;
   }
  }
  // (B14) the movement script (window.__mv) plays the steps when it is on the page
  if(!entity.caught){const room=rooms.find(r=>player.x>=r.x*TILE&&player.x<(r.x+r.w)*TILE&&player.y>=r.y*TILE&&player.y<(r.y+r.h)*TILE);const surface=room?.name==='DAMP ROOMS'?'wet':room?.name==='LONG ROOM'?'hollow':'carpet';if(window.__mv)window.__mv.foot(audio,surface);else audio.footstep(player.distance,Math.hypot(player.vx,player.vy),surface);}
 }
 // (B14) a server Smiler's own state (ls) counts first
 const pursuer=smilers.filter(s=>['pursue','stalk','watch'].includes(s.ls||s.state)).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
 const nearSmiler=!!pursuer&&Math.hypot(pursuer.x-player.x,pursuer.y-player.y)<Math.hypot(entity.x-player.x,entity.y-player.y),threat=nearSmiler?pursuer:entity;
 audio.threat(threat.x-player.x,threat.y-player.y,nearSmiler?(pursuer.ls||pursuer.state)==='pursue':entity.state==='chase',started&&!paused&&!entity.caught&&!won&&entity.grace<=0,nearSmiler?'smiler':'hound');
 // (B11) the camcorder script's clock runs in play, and it knows whether the camcorder is raised
 if(window.__cam)window.__cam.tick(paused||entity.caught||won||!started?0:dt,started&&!paused&&!won&&!entity.caught&&equipment.kind==='camcorder'&&flash,equipment.kind);
 // (B12) a hidden wanderer carries no light
 renderer.frame(dt,started,flash&&!window.__hideSelf,time/1e3);
 // (B03, B05; owner BPP) the multiplayer script's seam (mp.js), every frame
 if(window.__mp)window.__mp({p:player,cam:renderer.camera,sc:renderer.scale,run:started&&!paused&&!won&&!entity.caught,started,light:flash,G:entity,q:smilers,los:rayDistance,t:dt});
 if(entity.caught&&!deathFinished&&death.finished){renderer.completeDeath(time/1e3,flash);deathFinished=true;$('caught').hidden=false;}
 uiTime+=dt;if(uiTime>.12){
  uiTime=0;$('encounterHint').hidden=!started||entity.grace<=0||paused||entity.caught||won;$('blackoutHint').hidden=!started||paused||won||entity.caught||!lighting.blackout;
  $('coords').textContent=`X ${Math.round(player.x).toString().padStart(4,'0')} / Y ${Math.round(player.y).toString().padStart(4,'0')}`;
  const r=rooms.find(r=>player.x>=r.x*TILE&&player.x<(r.x+r.w)*TILE&&player.y>=r.y*TILE&&player.y<(r.y+r.h)*TILE);
  // (B14) the movement script names the pace; (B02) exhaustion, and the stamina bar (the number is written as it is)
  $('sector').textContent=r?`${r.code} / ${r.name}`:'— / CONNECTING PASSAGE';$('pace').textContent=window.__mv?window.__mv.label(dx||dy):dx||dy?player.exhausted?'EXHAUSTED':player.sprinting?'SPRINTING':'WALKING':'STANDING';
  $('staminaFill').style.width=`${Math.max(0,player.stamina)}%`;$('staminaText').textContent=Math.round(player.stamina) as unknown as string;
  // (B11) a camcorder is raised or lowered
  $('lightStatus').textContent=LIGHT_SPECS[equipment.kind].label.toUpperCase()+(equipment.kind==='camcorder'?flash?' RAISED':' LOWERED':flash?' ON':' OFF');drawMap();
 }
}
/* window.__api: the bundle's facade for the page's scripts (52 members; their readers: src/core/client/bundle/API_CONTRACT.md). The
   member names are the ones the scripts read, the v11 bundle's minified names among them (Bc, Uc, Oc, ...). Added by B05, B06, B09,
   B10, B12, B13, B14, B18, B19, B39. */
window.__api={
 lightOn:()=>!!flash&&!window.__hideSelf,
 bodyList:()=>corpses,
 death:()=>renderer.death,
 keys,
 Bc:nearby,Uc:rayDistance,Oc:rooms,Fc:lights,ll:passable,ul:center,fl:findPath,cl:clearSegment,dl:nearest,
 pl:null,
 qc:carriedLightAt,Ul:exposureAt,Gc:LIGHT_SPECS,
 beam:()=>renderer.person.beam,
 map:()=>toggleMap(),
 mapOpen:()=>map,
 gear:{eq:equipment,save:saveEquipment,defs:LIGHT_PARTS,parts:partsFor,fit:validLight,draw:drawGear},
 G:entity,q:smilers,V:lighting,el:traces,H:player,yu:updateEvidence,
 zc:isFloor,Hc:blocksSight,sl:clearPoint,Ic:spawn,
 bodyCount:()=>corpses.length,
 bodies:(list:Corpse[])=>{for(let i=corpses.length;i--;)if(corpses[i].remote)corpses.splice(i,1);for(const body of list)if(!corpses.some(c=>!c.remote&&'r'+c.ownerId===body.ownerId))corpses.push(body);},
 look:appearance,
 lamps:lights,
 audio:()=>audio,
 revive:()=>{if(entity.caught)respawn();},
 worldEnd:(x:number,y:number)=>worldEnd(x,y),
 tp:(x:number,y:number)=>{player.x=x;player.y=y;player.vx=player.vy=0;renderer.camera={x,y};},
 mkAvatar:(look?:Appearance,gear?:LightEquipment)=>new PlayerView(look,gear),
 layer:()=>renderer.creatures,
 floor:()=>renderer.corpseLayer,
 Jl:DeathSequence,Wl:EntityView,Gl:SmilerView,J:smooth,
 fall:()=>arrival.fall?Math.min(1,(performance.now()/1e3-arrival.fall.t0)/arrival.fall.dur):-1,
 started:()=>started,
 paused:()=>paused,
 unpause:()=>{if(paused)pause(false);},
 win:()=>{if(!won){won=true;keys.clear();accumulator=0;$('won').hidden=false;}},
 unwin:()=>{won=false;$('won').hidden=true;}
};
renderer.init().then(()=>requestAnimationFrame(frame)).catch(error=>{$('menu').innerHTML='<h2>Unable to start the renderer.</h2><p>Please enable hardware acceleration or try another browser.</p>';console.error(error);});
