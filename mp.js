/* Multiplayer client + dread layer. Game hooks in via window.__mp (called each frame). */
(()=>{
const cv=document.getElementById('mp'),cx=cv.getContext('2d'),dread=document.getElementById('dread'),
 game=document.getElementById('game'),light=document.getElementById('light'),
 net=Object.assign(document.createElement('div'),{id:'net',textContent:'SOLO'});
document.body.appendChild(net);
const room=new URLSearchParams(location.search).get('room')||'main';
let ws,myId=null,peers=new Map(),lastSend=0,retry=0;
function connect(){
 if(location.protocol==='file:')return;
 try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?room='+encodeURIComponent(room))}catch{return}
 ws.onopen=()=>{retry=0};
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.t==='hi')myId=m.id;
  else if(m.t==='s'){const now=performance.now(),seen=new Set();
   for(const p of m.p){seen.add(p.id);const o=peers.get(p.id)||{x:p.x,y:p.y};
    Object.assign(o,p,{tx:p.x,ty:p.y,seen:now});peers.set(p.id,o)}
   for(const id of peers.keys())if(!seen.has(id))peers.delete(id)}};
 ws.onclose=()=>{peers.clear();net.textContent='SOLO · RECONNECTING';setTimeout(connect,Math.min(8000,1000*++retry))};
}
connect();
/* ---------- audio ---------- */
let ac,drone,dg,beatT=0;
const soundOn=()=>/ON/.test(document.getElementById('sound')?.textContent||'ON');
function initAudio(){if(ac)return;try{ac=new AudioContext();
 drone=ac.createOscillator();drone.type='sawtooth';drone.frequency.value=43;
 const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=140;dg=ac.createGain();dg.gain.value=0;
 drone.connect(f).connect(dg).connect(ac.destination);drone.start()}catch{}}
addEventListener('pointerdown',initAudio);addEventListener('keydown',initAudio);
function thump(v,f){if(!ac||!soundOn())return;const o=ac.createOscillator(),g=ac.createGain(),n=ac.currentTime;
 o.frequency.setValueAtTime(f,n);o.frequency.exponentialRampToValueAtTime(38,n+.16);
 g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.001,n+.2);o.connect(g).connect(ac.destination);o.start(n);o.stop(n+.22)}
function burst(len,v){if(!ac||!soundOn())return;const b=ac.createBuffer(1,ac.sampleRate*len,ac.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)**1.5;
 const s=ac.createBufferSource(),g=ac.createGain();g.gain.value=v;s.buffer=b;s.connect(g).connect(ac.destination);s.start()}
new MutationObserver(()=>{if(document.body.classList.contains('captured'))burst(1.1,.9)})
 .observe(document.body,{attributes:true,attributeFilter:['class']});
/* ---------- per-frame hook ---------- */
let k=0,stingCd=6;
window.__mp=({p,cam,sc,run,G,q,los,t})=>{
 const dpr=devicePixelRatio||1,W=innerWidth,H=innerHeight;
 if(cv.width!==W*dpr||cv.height!==H*dpr){cv.width=W*dpr;cv.height=H*dpr}
 cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,W,H);
 /* --- network send --- */
 const now=performance.now();
 if(ws&&ws.readyState===1&&run!==undefined&&now-lastSend>66){lastSend=now;
  ws.send(JSON.stringify({t:'p',x:Math.round(p.x),y:Math.round(p.y),a:+p.angle.toFixed(2),
   n:(document.getElementById('nameplate')?.textContent||'WANDERER').slice(0,20),
   c:p.equipment?.color,d:document.body.classList.contains('captured')?1:0,r:p.sprinting?1:0}));
  net.textContent='ONLINE · ROOM '+room.toUpperCase()+' · '+(peers.size+1)+' WANDERER'+(peers.size?'S':'')}
 /* --- draw other wanderers (beneath the darkness mask, so unlit players stay hidden) --- */
 for(const o of peers.values()){o.x+=(o.tx-o.x)*.25;o.y+=(o.ty-o.y)*.25;
  const sx=W/2+(o.x-cam.x)*sc,sy=H/2+(o.y-cam.y)*sc;if(sx<-60||sy<-60||sx>W+60||sy>H+60)continue;
  const dx=o.x-p.x,dy=o.y-p.y,dist=Math.hypot(dx,dy);
  if(dist>30&&los&&los(p.x,p.y,Math.atan2(dy,dx),dist)<dist-20)continue; // walls block sight
  const r=13*sc,col=o.c||'#ffe7b2';
  cx.save();cx.translate(sx,sy);
  if(o.d){cx.strokeStyle='#a33';cx.lineWidth=3;cx.beginPath();cx.moveTo(-r,-r);cx.lineTo(r,r);cx.moveTo(r,-r);cx.lineTo(-r,r);cx.stroke()}
  else{cx.rotate(o.a);const g=cx.createRadialGradient(r*4,0,0,r*4,0,r*5);g.addColorStop(0,col+'88');g.addColorStop(1,col+'00');
   cx.fillStyle=g;cx.beginPath();cx.arc(r*4,0,r*5,0,7);cx.fill();
   cx.fillStyle='#2b3a33';cx.beginPath();cx.arc(0,0,r,0,7);cx.fill();cx.strokeStyle=col;cx.lineWidth=2;cx.stroke();
   cx.fillStyle=col;cx.beginPath();cx.arc(r*.55,0,r*.3,0,7);cx.fill()}
  cx.restore();cx.font='500 11px IBM Plex Mono,monospace';cx.textAlign='center';
  cx.fillStyle='#d6e2c8cc';cx.fillText(o.n||'WANDERER',sx,sy-r-9)}
 /* --- dread: proximity to hound + smilers drives heartbeat, drone, vignette, shake, flicker --- */
 let d=1e9;if(run){d=Math.hypot(G.x-p.x,G.y-p.y);for(const s of q)d=Math.min(d,Math.hypot(s.x-p.x,s.y-p.y))}
 const target=run?Math.max(0,Math.min(1,1-d/620)):0;k+=(target-k)*Math.min(1,t*(target>k?3:.8));
 if(dg&&ac){dg.gain.value=soundOn()?k*k*.16:0}
 beatT-=t;if(k>.08&&beatT<=0){beatT=.95-.6*k;thump(.5*k+.1,70);setTimeout(()=>thump(.35*k+.06,58),140)}
 dread.style.opacity=k<.05?0:Math.min(1,k*1.15)*(.75+.25*Math.sin(now/(140-70*k)));
 game.style.transform=k>.55?`translate(${(Math.random()-.5)*k*5}px,${(Math.random()-.5)*k*5}px)`:'';
 light.style.opacity=k>.35&&Math.random()<k*.09?.35+Math.random()*.4:1;
 stingCd-=t;if(k>.45&&stingCd<=0){stingCd=9+Math.random()*10;burst(.35,.12*k)}
};
})();
