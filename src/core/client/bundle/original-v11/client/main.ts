import './style.css';
import {Application} from 'pixi.js';
import {PlayerView} from './player-view';
import {appearance,saveAppearance} from './appearance';
import {equipment,saveEquipment} from './loadout';
import {LIGHT_SPECS,type LightKind} from '../shared/equipment';
import {traces,resetTraces,collected,takeTrace} from '../shared/evidence';
import {entity,resetEntity,resumeEntities,updateEntity,updateSmilers,smilers} from '../shared/entity';
import {Renderer} from './render';
import {Ambience} from './audio';
import {player,step} from '../shared/movement';
import {cells,COLS,ROWS,TILE,spawn,rooms,lighting,resetLighting,stepLighting} from '../shared/world';
import {corpses} from '../shared/remains';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const renderer=new Renderer(),audio=new Ambience(),keys=new Set<string>(),death=renderer.death;
let started=false,paused=false,flash=true,map=false,last=performance.now(),accumulator=0,uiTime=0;
let mouseX=innerWidth*.7,mouseY=innerHeight*.5,mouseActive=false,customizing=false,previousPause=false,won=false,deathFinished=false;
function pause(value:boolean){if(entity.caught)return;paused=value;keys.clear();$('dialog').hidden=!value;if(value&&audio.context)void audio.context.suspend();else if(started)audio.start();}
function toggleMap(){map=!map;$('mapPanel').hidden=!map;drawMap();}
function updateEvidence(){$('evidenceCount').textContent=`${collected()} / ${traces.length}`;}
function drawMap(){
 if(!map)return;const c=$<HTMLCanvasElement>('map').getContext('2d')!;c.fillStyle='#000';c.fillRect(0,0,640,460);c.save();
 const p=renderer.sightPoints;if(p.length){c.beginPath();c.moveTo(p[0]/TILE*10,p[1]/TILE*10);for(let i=2;i<p.length;i+=2)c.lineTo(p[i]/TILE*10,p[i+1]/TILE*10);c.closePath();c.clip();}
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(cells[y*COLS+x]){c.fillStyle='#a99a5b';c.fillRect(x*10,y*10,9,9);}
 for(const body of corpses){c.fillStyle='#8c343a';c.fillRect(body.x/TILE*10-1,body.y/TILE*10-1,3,3);}
 c.fillStyle='#fff1a7';c.beginPath();c.arc(player.x/TILE*10,player.y/TILE*10,4,0,Math.PI*2);c.fill();c.restore();
}
function respawn(){
 resumeEntities();renderer.resetDeath();deathFinished=false;won=false;flash=true;Object.assign(player,spawn,{vx:0,vy:0,distance:0});
 audio.lastStep=0;accumulator=0;renderer.camera={...spawn};$('caught').hidden=true;$('won').hidden=true;document.body.classList.remove('captured');pause(false);updateEvidence();
}
function newRun(){
 resetEntity();resetLighting();resetTraces();renderer.clearRemains();renderer.resetDeath();deathFinished=false;won=false;flash=true;
 Object.assign(player,spawn,{vx:0,vy:0,distance:0});player.name=$<HTMLInputElement>('name').value.trim()||'Wanderer';
 audio.lastStep=0;accumulator=0;started=true;paused=false;keys.clear();renderer.camera={...spawn};
 $('dialog').hidden=$('menu').hidden=$('caught').hidden=$('won').hidden=$('mapPanel').hidden=true;map=false;$('hud').hidden=false;
 $('nameplate').textContent=player.name;document.body.classList.add('playing');document.body.classList.remove('captured');updateEvidence();audio.start();
}
$('enter').onclick=newRun;
$<HTMLInputElement>('name').addEventListener('keydown',e=>{if(e.key==='Enter')newRun();});
$('sound').onclick=()=>{$('sound').textContent=audio.toggle()?'SOUND OFF':'SOUND ON';};
$('help').onclick=()=>pause(true);$('resume').onclick=()=>pause(false);$('reset').onclick=newRun;$('retry').onclick=respawn;$('playAgain').onclick=newRun;$('closeMap').onclick=toggleMap;$('touchFlash').onclick=()=>flash=!flash;
const previewApp=new Application(),previewPerson=new PlayerView();
previewApp.init({width:300,height:150,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true}).then(()=>{
 $('avatarPreview').appendChild(previewApp.canvas);previewPerson.position.set(150,70);previewPerson.scale.set(2.5);previewApp.stage.addChild(previewPerson);previewApp.ticker.add(()=>{if(customizing)previewPerson.update(performance.now()/1000,true,true);});
}).catch(()=>{$('avatarPreview').textContent='Preview unavailable. Your choices still apply in game.';});
function closeAppearance(){customizing=false;$('appearancePanel').hidden=true;pause(previousPause);$('customize').focus();}
$('customize').onclick=()=>{if(entity.caught)return;previousPause=paused;pause(true);customizing=true;$('dialog').hidden=true;$('appearancePanel').hidden=false;$('avatarHat').focus();};
$('closeAppearance').onclick=$('doneAppearance').onclick=closeAppearance;
for(const [id,key] of [['avatarHat','hat'],['avatarTexture','texture'],['avatarHands','hands'],['avatarMain','main'],['avatarBackpack','backpack']] as const){
 const el=$(id) as HTMLInputElement|HTMLSelectElement;el.value=appearance[key];el.addEventListener('input',()=>{appearance[key]=el.value;saveAppearance();});
}
const lightDescriptions={flashlight:'A narrow handheld beam with modest reach. Aim with the mouse.',chestlamp:'A wider, shorter beam. It follows the direction you move.',torch:'Short, flickering light in every direction. Color changes the flame and its glow.'};
function updateLightDescription(){$('lightDescription').textContent=lightDescriptions[equipment.kind];}
$<HTMLSelectElement>('lightKind').value=equipment.kind;$<HTMLInputElement>('lightColor').value=equipment.color;
$('lightKind').addEventListener('change',()=>{equipment.kind=$<HTMLSelectElement>('lightKind').value as LightKind;saveEquipment();updateLightDescription();});
$('lightColor').addEventListener('input',()=>{equipment.color=$<HTMLInputElement>('lightColor').value;saveEquipment();});updateLightDescription();
$('appearancePanel').addEventListener('keydown',e=>{if(e.key==='Tab'){const els=Array.from($('appearancePanel').querySelectorAll<HTMLElement>('button,input,select'));const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.addEventListener('keydown',e=>{
 if(customizing){if(e.code==='Escape'){e.preventDefault();closeAppearance();}return;}
 if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(started&&!won)pause(!paused);return;}if(!started||paused||entity.caught||won)return;
 keys.add(e.code);if(!e.repeat){if(e.code==='KeyF')flash=!flash;if(e.code==='KeyM')toggleMap();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(started&&!customizing&&!won)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!customizing&&!won)pause(true);});
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){mouseX=e.clientX;mouseY=e.clientY;mouseActive=true;}});
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key!);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key!);});
function frame(time:number){
 const dt=Math.min((time-last)/1000,.05);last=time;
 const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),dy=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
 if(started&&!paused&&!entity.caught&&!won){
  if(equipment.kind==='chestlamp'){if(dx||dy)player.angle=Math.atan2(dy,dx);}
  else if(mouseActive){const px=innerWidth/2+(player.x-renderer.camera.x)*renderer.scale,py=innerHeight/2+(player.y-renderer.camera.y)*renderer.scale;player.angle=Math.atan2(mouseY-py,mouseX-px);}
  else if(dx||dy)player.angle=Math.atan2(dy,dx);
  accumulator+=dt;
  while(accumulator>=1/60){
   step(dx,dy,sprint,1/60);stepLighting(1/60);
   if(takeTrace(player.x,player.y)){audio.collect();updateEvidence();entity.pressure=collected()/traces.length;if(collected()===traces.length){won=true;keys.clear();$('won').hidden=false;accumulator=0;break;}}
   updateEntity(player,sprint,1/60,flash);updateSmilers(player,flash,1/60);accumulator-=1/60;
   if(entity.caught){
    keys.clear();accumulator=0;renderer.beginDeath(time/1000);audio.death(entity.caughtBy==='Smiler'?'Smiler':'Hound');deathFinished=false;
    $('caughtTitle').textContent=entity.caughtBy==='Smiler'?'You fed the dark.':'It found you.';
    $('caughtAdvice').textContent=(entity.caughtBy==='Smiler'?'It waited for you to look away.':'It remembered where you ran.')+' Your body and dropped gear remain in this run.';
    $('mapPanel').hidden=true;map=false;document.body.classList.add('captured');break;
   }
  }
  if(!entity.caught){const room=rooms.find(r=>player.x>=r.x*TILE&&player.x<(r.x+r.w)*TILE&&player.y>=r.y*TILE&&player.y<(r.y+r.h)*TILE);const surface=room?.name==='DAMP ROOMS'?'wet':room?.name==='LONG ROOM'?'hollow':'carpet';audio.footstep(player.distance,Math.hypot(player.vx,player.vy),surface);}
 }
 const pursuer=smilers.filter(s=>['pursue','stalk','watch'].includes(s.state)).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
 const nearSmiler=!!pursuer&&Math.hypot(pursuer.x-player.x,pursuer.y-player.y)<Math.hypot(entity.x-player.x,entity.y-player.y),threat=nearSmiler?pursuer:entity;
 audio.threat(threat.x-player.x,threat.y-player.y,nearSmiler?pursuer.state==='pursue':entity.state==='chase',started&&!paused&&!entity.caught&&!won&&entity.grace<=0,nearSmiler?'smiler':'hound');
 renderer.frame(dt,started,flash,time/1000);
 if(entity.caught&&!deathFinished&&death.finished){renderer.completeDeath(time/1000);deathFinished=true;$('caught').hidden=false;}
 uiTime+=dt;if(uiTime>.12){
  uiTime=0;$('encounterHint').hidden=!started||entity.grace<=0||paused||entity.caught||won;$('blackoutHint').hidden=!started||paused||won||entity.caught||!lighting.blackout;
  $('coords').textContent=`X ${Math.round(player.x).toString().padStart(4,'0')} / Y ${Math.round(player.y).toString().padStart(4,'0')}`;
  const r=rooms.find(r=>player.x>=r.x*TILE&&player.x<(r.x+r.w)*TILE&&player.y>=r.y*TILE&&player.y<(r.y+r.h)*TILE);
  $('sector').textContent=r?`${r.code} / ${r.name}`:'— / CONNECTING PASSAGE';$('pace').textContent=dx||dy?sprint?'SPRINTING':'WALKING':'STANDING';
  $('lightStatus').textContent=LIGHT_SPECS[equipment.kind].label.toUpperCase()+(flash?' ON':' OFF');drawMap();
 }
 requestAnimationFrame(frame);
}
renderer.init().then(()=>requestAnimationFrame(frame)).catch(error=>{$('menu').innerHTML='<h2>Unable to start the renderer.</h2><p>Please enable hardware acceleration or try another browser.</p>';console.error(error);});
