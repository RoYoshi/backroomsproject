/* sim.js - server-side Level 0 monster simulation.
 * The map, pathfinding, Hound and Smiler AI below are the game's own code, extracted from the
 * production bundle (assets/index-*.js) and generalised from one player to many.
 * The section marked 'multiplayer glue' is new. */
'use strict';
const WORLD=require('../g/world.js');
module.exports=function createSim(){
var FBW=96,FBH=72,Oc=[{x:3,y:27,w:18,h:18,name:`YELLOW HALL`,code:`01`},{x:25,y:25,w:19,h:20,name:`REPEATING ROOMS`,code:`02`},{x:49,y:28,w:18,h:17,name:`SEGMENTED ROOMS`,code:`03`},{x:25,y:7,w:20,h:12,name:`HUMMING ROOMS`,code:`04`},{x:4,y:7,w:17,h:12,name:`NORTH ROOMS`,code:`05`},{x:50,y:7,w:25,h:11,name:`LONG ROOM`,code:`06`},{x:4,y:50,w:18,h:13,name:`BLACKOUT ZONE`,code:`07`},{x:27,y:51,w:18,h:12,name:`DAMP ROOMS`,code:`08`},{x:51,y:51,w:18,h:12,name:`RED ROOMS`,code:`09`},{x:73,y:27,w:19,h:18,name:`ARCH GALLERY`,code:`10`},{x:77,y:7,w:15,h:14,name:`PILLAR HALL`,code:`11`},{x:73,y:51,w:19,h:13,name:`DEEP CARPET`,code:`12`}],kc=new Uint8Array(FBW*FBH);function Ac(e,t,n,r){for(let i=t;i<t+r;i++)for(let t=e;t<e+n;t++)t>=0&&i>=0&&t<FBW&&i<FBH&&(kc[i*FBW+t]=1)}function jc(e,t,n,r){for(let i=t;i<t+r;i++)for(let t=e;t<e+n;t++)t>=0&&i>=0&&t<FBW&&i<FBH&&(kc[i*FBW+t]=0)}Oc.forEach(e=>Ac(e.x,e.y,e.w,e.h)),[[20,33,6,4],[43,34,7,4],[66,34,8,4],[21,56,7,4],[44,57,8,4],[68,56,6,4],[19,11,7,4],[44,11,7,4],[74,11,4,4],[10,18,4,10],[32,18,4,8],[57,17,4,12],[82,20,4,8],[10,44,4,7],[33,44,4,8],[58,44,4,8],[82,44,4,8]].forEach(e=>Ac(...e)),[[9,28,1,8],[9,38,1,6],[15,32,1,12],[30,26,1,7],[30,35,1,9],[37,26,1,10],[37,38,1,6],[26,31,6,1],[34,39,9,1],[54,29,1,8],[54,39,1,5],[61,29,1,6],[61,37,1,7],[50,34,5,1],[57,40,9,1],[31,8,1,8],[38,10,1,8],[26,13,6,1],[34,15,10,1],[10,8,1,8],[16,10,1,8],[5,13,6,1],[56,8,1,7],[64,10,1,7],[71,8,1,8],[51,13,6,1],[59,15,6,1],[10,51,1,9],[16,53,1,9],[5,56,6,1],[33,52,1,10],[40,54,1,8],[28,57,6,1],[57,52,1,10],[64,54,1,8],[52,57,6,1],[79,28,1,7],[79,38,1,6],[86,31,1,12],[74,35,6,1],[83,8,1,5],[83,15,1,5],[79,52,1,10],[86,54,1,8],[74,58,6,1]].forEach(e=>jc(...e)),[[9,35,1,2],[15,36,1,2],[30,32,1,3],[37,35,1,3],[31,31,2,1],[39,39,2,1],[54,36,1,3],[61,34,1,3],[53,34,2,1],[62,40,2,1],[31,12,1,2],[38,13,1,2],[30,13,2,1],[39,15,2,1],[10,12,1,2],[16,14,1,2],[9,13,2,1],[56,12,1,2],[64,13,1,2],[71,12,1,2],[55,13,2,1],[63,15,2,1],[10,55,1,2],[16,57,1,2],[9,56,2,1],[33,56,1,2],[40,58,1,2],[32,57,2,1],[57,56,1,2],[64,58,1,2],[56,57,2,1],[79,34,1,2],[86,36,1,2],[78,35,2,1],[83,12,1,2],[83,17,1,2],[79,56,1,2],[86,58,1,2],[78,58,2,1]].forEach(e=>Ac(...e));WORLD.carve(kc,FBW);var Mc=[{x:53,y:9},{x:57,y:9},{x:61,y:9},{x:65,y:9},{x:69,y:9},{x:53,y:15},{x:57,y:15},{x:61,y:15},{x:65,y:15},{x:69,y:15}];for(let e of Mc)jc(e.x,e.y,1,1);var Nc=[];for(let e=0;e<FBH;e++)for(let t=0;t<FBW;t++)kc[e*FBW+t]||Nc.push({x:t*96,y:e*96,w:96,h:96});var Pc=[];for(let e of[79.5,84.5,89.5])for(let t of[9.5,14.5,19.5])Pc.push({x:e*96-28,y:t*96-28,w:56,h:56});var Fc=[];Oc.forEach((e,t)=>{if(t!==6)for(let n=e.x+2;n<e.x+e.w-1;n+=5)for(let r=e.y+2;r<e.y+e.h-1;r+=5)kc[r*FBW+n]&&Fc.push({x:(n+.5)*96,y:(r+.5)*96})});var Ic={x:960,y:3264},V={blackout:!1,elapsed:0,next:36,duration:0,number:0};function Lc(){Object.assign(V,{blackout:!1,elapsed:0,next:36,duration:0,number:0})}function Rc(e){return V.elapsed+=e,!V.blackout&&V.elapsed>=V.next?(V.blackout=!0,V.elapsed=0,V.duration=4.5+V.number%3,V.number++,`start`):V.blackout&&V.elapsed>=V.duration?(V.blackout=!1,V.elapsed=0,V.next=44+V.number%4*10,`end`):null}var zc=(e,t)=>e>=0&&t>=0&&e<FBW&&t<FBH&&kc[t*FBW+e]===1;function Bc(e,t){let n=[],r=Math.floor(e/96),i=Math.floor(t/96);for(let e=i-1;e<=i+1;e++)for(let t=r-1;t<=r+1;t++)zc(t,e)||n.push({x:t*96,y:e*96,w:96,h:96});for(let r of Pc)Math.abs(r.x-e)<250&&Math.abs(r.y-t)<250&&n.push(r);return WORLD.addNear(n,e,t)}var Vc=new Set(Mc.map(e=>e.y*FBW+e.x)),Hc=(e,t)=>e<0||t<0||e>=FBW||t>=FBH||!zc(e,t)&&!Vc.has(t*FBW+e);function Uc(e,t,n,r){let i=Math.cos(n),a=Math.sin(n),o=i>=0?1:-1,s=a>=0?1:-1,c=Math.floor(e/96),l=Math.floor(t/96),u=r;if(Hc(c,l))return 0;let d=Math.abs(i)<1e-10?1/0:96/Math.abs(i),f=Math.abs(a)<1e-10?1/0:96/Math.abs(a),p=Math.abs(i)<1e-10?1/0:((c+ +(o>0))*96-e)/i,m=Math.abs(a)<1e-10?1/0:((l+ +(s>0))*96-t)/a;for(;Math.min(p,m)<u;)if(Math.abs(p-m)<1e-8){let e=p;if(Hc(c+o,l)||Hc(c,l+s)){u=e;break}if(c+=o,l+=s,p+=d,m+=f,Hc(c,l)){u=e;break}}else if(p<m){let e=p;if(c+=o,p+=d,Hc(c,l)){u=e;break}}else{let e=m;if(l+=s,m+=f,Hc(c,l)){u=e;break}}for(let n of Pc){if(Math.abs(i)<1e-10&&(e<n.x||e>n.x+n.w)||Math.abs(a)<1e-10&&(t<n.y||t>n.y+n.h))continue;let r=Math.abs(i)<1e-10?-1/0:(n.x-e)/i,o=Math.abs(i)<1e-10?1/0:(n.x+n.w-e)/i,s=Math.abs(a)<1e-10?-1/0:(n.y-t)/a,c=Math.abs(a)<1e-10?1/0:(n.y+n.h-t)/a,l=Math.max(Math.min(r,o),Math.min(s,c));Math.min(Math.max(r,o),Math.max(s,c))>=Math.max(0,l)&&l>=0&&(u=Math.min(u,l))}return Math.max(0,u)}var Wc={kind:`flashlight`,color:`#ffe7b2`},Gc={flashlight:{label:`Flashlight`,range:390,arc:.92,power:.58,spill:56,omni:!1},headlamp:{label:`Headlamp`,range:262,arc:1.95,power:.5,spill:82,omni:!1},lantern:{label:`Lantern`,range:228,arc:Math.PI*2,power:.5,spill:200,omni:!0},camcorder:{label:`Night Vision Camcorder`,range:1,arc:.1,power:0,spill:1,omni:!1}},Kc=(e,t,n)=>{let r=Math.max(0,Math.min(1,(n-e)/(t-e)));return r*r*(3-2*r)};function qc(e,t,n){if(!n)return 0;let r=Gc[e.equipment?.kind]||Gc.flashlight,i=t.x-e.x,a=t.y-e.y,o=Math.hypot(i,a),s=Math.atan2(a,i)-e.angle,c=Math.abs(Math.atan2(Math.sin(s),Math.cos(s))),l=r.omni?1:1-Kc(r.arc*.11,r.arc*.5,c);return r.power*(1-Kc(24,r.range,o))*Math.max(l,(1-Kc(10,r.spill,o))*.4)}
var el=[1,2,3,4,5,6,7,8].map(e=>{let t=Oc[e],n=(t.x+t.w*.48)*96,r=(t.y+t.h*.55)*96;return Bc(n,r).some(e=>Math.hypot(n-Math.max(e.x,Math.min(n,e.x+e.w)),r-Math.max(e.y,Math.min(r,e.y+e.h)))<48)&&(n=(t.x+t.w*.7)*96,r=(t.y+t.h*.35)*96),{x:n,y:r,found:!1,room:t.name}});function tl(){for(let e of el)e.found=!1}function nl(){return el.reduce((e,t)=>e+Number(t.found),0)}function rl(e,t){let n=el.find(n=>!n.found&&Math.hypot(e-n.x,t-n.y)<42);return n?(n.found=!0,n):null}var il=48,W=FBW*2,al=FBH*2,ol=21;function sl(e,t,n=ol){return Bc(e,t).every(r=>Math.hypot(e-Math.max(r.x,Math.min(e,r.x+r.w)),t-Math.max(r.y,Math.min(t,r.y+r.h)))>=n)}function cl(e,t,n=ol){let r=Math.hypot(t.x-e.x,t.y-e.y),i=Math.ceil(r/12);for(let r=0;r<=i;r++){let a=i?r/i:0;if(!sl(e.x+(t.x-e.x)*a,e.y+(t.y-e.y)*a,n))return!1}return!0}var ll=new Uint8Array(W*al);for(let e=0;e<al;e++)for(let t=0;t<W;t++){let n=(t+.5)*il,r=(e+.5)*il;ll[e*W+t]=Number(zc(Math.floor(n/96),Math.floor(r/96))&&sl(n,r))}var ul=e=>({x:(e%W+.5)*il,y:(Math.floor(e/W)+.5)*il});function dl(e,t=!1){let n=-1,r=1/0,i=Math.floor(e.x/il),a=Math.floor(e.y/il);for(let o=Math.max(0,a-4);o<=Math.min(al-1,a+4);o++)for(let a=Math.max(0,i-4);a<=Math.min(W-1,i+4);a++){let i=o*W+a;if(!ll[i])continue;let s=ul(i),c=Math.hypot(e.x-s.x,e.y-s.y);c<r&&cl(e,s,t?1:ol)&&(n=i,r=c)}return n}function fl(e,t){let n=dl(e),r=dl(t,!0);if(n<0||r<0)return[];let i=new Int32Array(W*al).fill(-1),a=new Int32Array(W*al),o=0,s=1;for(a[0]=n,i[n]=n;o<s&&i[r]<0;){let e=a[o++];for(let t of[e-1,e+1,e-W,e+W])t<0||t>=W*al||!ll[t]||i[t]>=0||Math.abs(t%W-e%W)+Math.abs(Math.floor(t/W)-Math.floor(e/W))===1&&(i[t]=e,a[s++]=t)}if(i[r]<0)return[];let c=[];for(let e=r;e!==n;e=i[e])c.push(ul(e));return c.push(ul(n)),c.reverse(),cl(ul(r),t)&&c.push({...t}),c}function pl(e,t,n,r=ol){let i={...e};for(let a of[`x`,`y`]){e[a]+=a===`x`?t:n;for(let t of Bc(e.x,e.y)){let n=e.x-Math.max(t.x,Math.min(e.x,t.x+t.w)),o=e.y-Math.max(t.y,Math.min(e.y,t.y+t.h)),s=Math.hypot(n,o);s<r&&(s>0?(e.x+=n/s*(r-s),e.y+=o/s*(r-s)):e[a]=i[a])}}}var G={x:7872,y:3264,angle:Math.PI,state:`patrol`,distance:0,grace:14,caught:!1,caughtBy:``,pressure:0,adaptation:0,memory:{x:7872,y:3264,vx:0,vy:0,age:100,confidence:0}},ml=[{x:7872,y:3264},{x:5664,y:3360},{x:8064,y:5376},{x:5664,y:1152}],hl=0,gl={...ml[0]},K=[],_l=0,vl=0,yl=0,bl=0,xl=0,Sl=0,Cl=0,wl=0,Tl=0,El=0,Dl=0,Ol=0,kl=(e,t)=>Math.atan2(Math.sin(e-t),Math.cos(e-t));function Al(e,t,n=700){let r=t.x-e.x,i=t.y-e.y,a=Math.hypot(r,i);return a<n&&Uc(e.x,e.y,Math.atan2(i,r),a+1)>=a-.5}function jl(e,t){G.state!==e&&(G.state=e,K=[],_l=0,xl=0,Tl=0),t&&(gl={...t})}function Ml(e,t,n){for(let r of[0,.6,-.6,1.2,-1.2,Math.PI]){let i={x:e.x+Math.cos(t+r)*n,y:e.y+Math.sin(t+r)*n};if(sl(i.x,i.y)&&fl(G,i).length)return i}return{x:e.x,y:e.y}}function Nl(){Object.assign(G,{x:7872,y:3264,angle:Math.PI,state:`patrol`,distance:0,grace:14,caught:!1,caughtBy:``,pressure:0,adaptation:0}),Object.assign(G.memory,{x:G.x,y:G.y,vx:0,vy:0,age:100,confidence:0}),hl=0,gl={...ml[0]},K=[],_l=0,vl=0,yl=0,bl=0,xl=0,Sl=0,Cl=0,wl=0,Tl=0,El=0,Ol=0,Dl=0,Rl()}function Pl(){G.caught=!1,G.caughtBy=``,G.grace=5,jl(`search`,G.memory),El=0,q.forEach(e=>{e.state=`search`,e.lost=0,e.repath=0})}function Fl(e,t=!0){let n=Math.hypot(e.x-G.x,e.y-G.y),r=qc(e,G,t)>.025,i=Math.abs(kl(Math.atan2(e.y-G.y,e.x-G.x),G.angle));return Al(G,e,r?560:V.blackout?270:460)&&(n<85||i<1.4||r&&n<360)}function Il(e,t,n,r=!0){if(!G.caught){if(yl+=n,G.grace=Math.max(0,G.grace-n),vl-=n,_l-=n,Sl-=n,wl=Math.max(0,wl-n),G.memory.age+=n,vl<=0){vl=.12;let n=G.grace<=0&&Fl(e,r),i=Math.hypot(e.x-G.x,e.y-G.y);if(n){Object.assign(G.memory,{x:e.x,y:e.y,vx:e.vx,vy:e.vy,age:0,confidence:1}),bl=0,El=0;let t=Math.abs(kl(Math.atan2(G.y-e.y,G.x-e.x),e.angle))<.4&&!e.sprinting;jl(`chase`);if(G.state===`chase`){let t={x:e.x+e.vx*.42,y:e.y+e.vy*.42};gl=sl(t.x,t.y)?t:{x:e.x,y:e.y}}}else{bl+=.12,G.memory.confidence=Math.max(0,G.memory.confidence-.015),(G.state===`chase`||G.state===`stalk`)&&bl>.42&&(jl(`search`,G.memory),El=0);let n=Math.hypot(e.vx,e.vy),r=t?850:260;if(G.grace<=0&&n>38&&i<r&&Sl<=0&&G.state!==`chase`){Sl=.85;let t=fl(G,e),n=0,i=G;for(let e of t)n+=Math.hypot(e.x-i.x,e.y-i.y),i=e;if(t.length&&n<r){let t={x:(Math.floor(e.x/48)+.5)*48,y:(Math.floor(e.y/48)+.5)*48};sl(t.x,t.y)&&(Object.assign(G.memory,{...t,vx:0,vy:0,age:0,confidence:.55}),jl(`investigate`,t),El=0)}}}}if((G.state===`search`||G.state===`investigate`)&&(xl+=n,xl>14&&(hl=(hl+1)%ml.length,jl(`patrol`,ml[hl]))),Math.hypot(gl.x-G.x,gl.y-G.y)<33&&G.state!==`chase`&&G.state!==`stalk`){if(Tl+=n,G.angle+=Math.sin(Tl*3.6)*n*1.7,Tl>(G.state===`patrol`?.65:1.15)){if(Tl=0,G.state===`patrol`)hl=(hl+1)%ml.length,gl={...ml[hl]};else if(++El<4){let e=Math.atan2(G.memory.vy,G.memory.vx)+[0,.85,-.85,Math.PI][El%4];gl=Ml(G.memory,e,120+El*48),G.state=`search`}else hl=(hl+1)%ml.length,jl(`patrol`,ml[hl]);K=[],_l=0}}else{for(_l<=0&&(_l=.4,K=fl(G,gl));K.length&&Math.hypot(K[0].x-G.x,K[0].y-G.y)<19;)K.shift();let t=K[0];if(t){for(let e=Math.min(K.length-1,6);e>0;e--)if(cl(G,K[e])){t=K[e];break}let i=t.x-G.x,a=t.y-G.y,o=kl(Math.atan2(a,i),G.angle);G.angle+=Math.max(-4*n,Math.min(4*n,o));let s=G.state===`chase`?256+G.pressure*30:G.state===`stalk`?92:G.state===`investigate`?158:G.state===`search`?117:97;Math.hypot(e.x-G.x,e.y-G.y)<360&&Al(e,G)&&Math.abs(kl(Math.atan2(G.y-e.y,G.x-e.x),e.angle))<.38&&!t&&G.state===`chase`&&wl<=0?(Cl+=n,s*=.3+G.adaptation*.1,Cl>1.15&&(Cl=0,wl=5,G.adaptation=Math.min(3,G.adaptation+1))):Cl=Math.max(0,Cl-n*2);let c=Math.min(Math.hypot(i,a),s*n*Math.max(.15,Math.cos(o))),l={x:G.x,y:G.y};pl(G,Math.cos(G.angle)*c,Math.sin(G.angle)*c),G.distance+=Math.hypot(G.x-l.x,G.y-l.y)}}if(G.grace<=0)for(let pl_ of alive())if(Math.hypot(pl_.x-G.x,pl_.y-G.y)<34&&Al(G,pl_)){catchPlayer(pl_,`Hound`);break}}}var Ll=[{x:6432,y:1152},{x:1632,y:5568}],q=Ll.map((e,t)=>({...e,origin:{...e},angle:0,state:`lurk`,distance:0,route:[],repath:0,lost:0,notice:0,wait:0,memory:{...e},goal:{...e},side:t===0?1:-1}));function Rl(){q.forEach((e,t)=>Object.assign(e,{...Ll[t],state:`lurk`,angle:0,distance:0,route:[],repath:0,lost:0,notice:0,wait:0,memory:{...Ll[t]},goal:{...Ll[t]}}))}function zl(n){for(let r of q){let e=nearestAlive(r);if(!e)continue;let t=e.light;r.repath-=n,r.wait+=n;let i=Math.hypot(e.x-r.x,e.y-r.y),a=SG<=0&&Al(r,e,560),o=qc(e,r,t),s=a&&(o>.014||i<165||r.state!==`lurk`&&i<420||e.sprinting&&i<470),c=s&&Math.abs(kl(Math.atan2(r.y-e.y,r.x-e.x),e.angle))<.48;if(s){if(r.memory={x:e.x,y:e.y},r.lost=0,(r.state===`lurk`||r.state===`return`||r.state===`search`)&&(r.state=`watch`,r.wait=0,r.notice=0),r.notice+=n,r.state===`watch`){if(r.angle+=kl(Math.atan2(e.y-r.y,e.x-r.x),r.angle)*Math.min(1,n*4),e.sprinting||!c&&r.notice>.48||i<82)r.state=`pursue`,r.wait=0}r.state===`stalk`&&(!c||r.wait>2.4)&&(r.state=`pursue`,r.wait=0),r.state===`pursue`&&(r.goal={...r.memory},!e.sprinting&&c&&!t&&r.wait>.72&&i>125&&(r.state=`watch`,r.wait=0))}else r.lost+=n,r.notice=Math.max(0,r.notice-n*.3),[`pursue`,`stalk`,`watch`].includes(r.state)&&r.lost>.5&&(r.state=`search`,r.goal={...r.memory},r.repath=0,r.wait=0),r.state===`search`&&r.lost>7&&(r.state=`return`,r.goal={...r.origin},r.repath=0);if(r.state===`lurk`){r.angle+=Math.sin(yl*.45+r.side)*n*.12;continue}if(r.state===`watch`)continue;if(r.state===`return`&&Math.hypot(r.x-r.origin.x,r.y-r.origin.y)<25){r.state=`lurk`,r.route=[];continue}if(r.state===`search`&&Math.hypot(r.x-r.goal.x,r.y-r.goal.y)<25){r.angle+=Math.sin(r.wait*2)*n;continue}for(r.repath<=0&&(r.route=fl(r,r.goal),r.repath=.5);r.route.length&&Math.hypot(r.route[0].x-r.x,r.route[0].y-r.y)<20;)r.route.shift();let l=r.route[0];if(!l)continue;let u=kl(Math.atan2(l.y-r.y,l.x-r.x),r.angle);r.angle+=Math.max(-4*n,Math.min(4*n,u));let d=r.state===`pursue`?232+PR*18:r.state===`stalk`?92:112,f={x:r.x,y:r.y};if(pl(r,Math.cos(r.angle)*d*n*Math.max(.2,Math.cos(u)),Math.sin(r.angle)*d*n*Math.max(.2,Math.cos(u))),r.distance+=Math.hypot(r.x-f.x,r.y-f.y),r.state===`pursue`&&i<29&&Al(r,e)){catchPlayer(e,`Smiler`);continue}}}

/* ---------- multiplayer glue (v12: several hounds, packs, random smilers, glitched walls, shared bodies) ---------- */
var SG=14,PR=0;const ANCHOR={x:1056,y:3264};   // spawn is hard against a wall; this open spot next to it is used for reachability checks
                                  // shared "grace" and pressure used by the smilers
const players=[];
let frozen=false,speed=1,bmode=`auto`,runT=0;
const MAX_HOUNDS=3,MAX_SMILERS=5,MAX_BODIES=24;
const rnd=(a,b)=>a+Math.random()*(b-a);
const alive=()=>players.filter(p=>p.active&&!p.dead&&!p.exited&&p.safe<=0&&!p.god);
const GHOST={x:-9e4,y:-9e4,vx:0,vy:0,angle:0,sprinting:false,light:false,equipment:{kind:`flashlight`}};
function nearestAlive(from){let b=null,bd=1/0;for(const p of alive()){const d=Math.hypot(p.x-from.x,p.y-from.y);if(d<bd){bd=d;b=p}}return b}

/* --- hounds: the game's single-hound AI keeps its state in module variables, so each hound owns a copy of
       that state and it is swapped in while that hound is being stepped --- */
const GK=[`x`,`y`,`angle`,`state`,`distance`,`grace`,`caught`,`caughtBy`,`pressure`,`adaptation`,`memory`];
const pullV=()=>({hl,gl,K,_l,vl,yl,bl,xl,Sl,Cl,wl,Tl,El,Dl,Ol,ml});
const pushV=v=>{({hl,gl,K,_l,vl,yl,bl,xl,Sl,Cl,wl,Tl,El,Dl,Ol,ml}=v)};
function withHound(h,fn){for(const k of GK)G[k]=h.g[k];pushV(h.v);try{return fn()}finally{for(const k of GK)h.g[k]=G[k];h.v=pullV()}}
const hounds=[],packs=[];let nextHoundId=1,nextPackId=1,spawnT=0,packT=0,justCaught=false;

function randomSpot(minSpawn,avoid,minAvoid,mustReach=true){
  for(let t=0;t<600;t++){
    const idx=(Math.random()*W*al)|0;if(!ll[idx])continue;
    const p=ul(idx);
    if(Math.hypot(p.x-Ic.x,p.y-Ic.y)<minSpawn)continue;
    if(avoid.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<minAvoid))continue;
    if(!sl(p.x,p.y))continue;
    if(mustReach&&!fl(p,ANCHOR).length)continue;
    return p;
  }
  return null;
}
function patrolRoute(){const r=[];for(let i=0;i<4;i++){const p=randomSpot(0,r,1400);if(p)r.push({x:p.x,y:p.y})}return r.length?r:[{x:7872,y:3264}]}
function newHound(minSpawn=3000,awayFrom=[]){
  const at=randomSpot(minSpawn,awayFrom.concat(hounds.map(h=>h.g)),1500);if(!at)return null;
  const route=patrolRoute();
  const h={id:nextHoundId++,pack:null,cd:rnd(8,25),
    g:{x:at.x,y:at.y,angle:rnd(0,6.283),state:`patrol`,distance:0,grace:awayFrom.length?0:rnd(12,20),caught:false,caughtBy:``,pressure:0,adaptation:0,memory:{x:at.x,y:at.y,vx:0,vy:0,age:100,confidence:0}},
    v:{hl:0,gl:{...route[0]},K:[],_l:0,vl:0,yl:0,bl:0,xl:0,Sl:0,Cl:0,wl:0,Tl:0,El:0,Dl:0,Ol:0,ml:route}};
  hounds.push(h);return h;
}
function killHound(h){leavePack(h);const i=hounds.indexOf(h);if(i>=0)hounds.splice(i,1)}

/* --- packs: two hounds that spot each other sometimes team up for a while --- */
function leavePack(h){
  const pk=h.pack;if(!pk)return;h.pack=null;pk.members=pk.members.filter(m=>m!==h);
  if(pk.leader===h)pk.leader=pk.members[0]||null;
  if(pk.members.length<2){for(const m of pk.members)m.pack=null;const i=packs.indexOf(pk);if(i>=0)packs.splice(i,1)}
}
function disband(pk){
  for(const m of pk.members){m.pack=null;m.cd=rnd(25,60);withHound(m,()=>{hl=(Math.random()*ml.length)|0;if(G.state!==`chase`)jl(`patrol`,ml[hl])})}
  const i=packs.indexOf(pk);if(i>=0)packs.splice(i,1);pk.members=[];
}
function packLogic(dt){
  for(const h of hounds)h.cd-=dt;
  for(const pk of packs.slice())if(runT>pk.until)disband(pk);
  packT-=dt;if(packT>0)return;packT=.5;
  for(let i=0;i<hounds.length;i++)for(let j=i+1;j<hounds.length;j++){
    const a=hounds[i],b=hounds[j];
    if(a.pack&&a.pack===b.pack)continue;
    if(a.cd>0||b.cd>0)continue;
    if(Math.hypot(a.g.x-b.g.x,a.g.y-b.g.y)>640||!Al(a.g,b.g,640))continue;
    a.cd=b.cd=rnd(20,45);                       // whether or not they bond, they need a while before deciding again
    if(Math.random()>.55)continue;              // "occasionally"
    const pk=a.pack||b.pack||{id:nextPackId++,members:[],leader:a,until:0};
    for(const m of[a,b])if(!m.pack){m.pack=pk;pk.members.push(m)}
    if(!packs.includes(pk))packs.push(pk);
    pk.until=runT+rnd(45,110);
  }
}
function flank(pk,h,cx,cy,heading){
  const idx=pk.members.indexOf(h),side=idx%2?1:-1,d=70+idx*38,px=cx-Math.sin(heading)*side*d,py=cy+Math.cos(heading)*side*d;
  return sl(px,py)?{x:px,y:py}:{x:cx,y:cy};
}
function packBehaviour(h){                       // runs with h swapped in
  const pk=h.pack;if(!pk||pk.members.length<2)return;
  const hunter=pk.members.find(m=>m!==h&&m.g.state===`chase`&&m.g.grace<=0);
  if(hunter&&G.state!==`chase`&&G.grace<=0){
    Object.assign(G.memory,hunter.g.memory,{age:0});G.grace=0;jl(`chase`);
    const m=G.memory;gl=flank(pk,h,m.x,m.y,Math.atan2(m.vy,m.vx)||hunter.g.angle);
  }else if(G.state===`chase`&&hunter){
    const m=G.memory;gl=flank(pk,h,m.x,m.y,Math.atan2(m.vy,m.vx)||G.angle);
  }else if(pk.leader&&pk.leader!==h&&G.state!==`chase`){
    const L=pk.leader.g,idx=pk.members.indexOf(h),ang=L.angle+Math.PI+(idx%2?.8:-.8),d=130+idx*45;
    let x=L.x+Math.cos(ang)*d,y=L.y+Math.sin(ang)*d;
    if(!sl(x,y)){x=L.x;y=L.y}
    if(G.state!==`patrol`&&G.state!==`search`&&G.state!==`investigate`)jl(`patrol`);
    if(G.state===`patrol`||G.state===`search`)G.grace=Math.min(G.grace,L.grace);
    gl={x,y};
  }
}

/* --- smilers --- */
function spawnSmilers(n){
  q.length=0;const pts=[];
  for(let i=0;i<n;i++){
    const p=randomSpot(1700,pts.concat(hounds.map(h=>h.g)),1100);if(!p)continue;pts.push(p);
    q.push({x:p.x,y:p.y,origin:{x:p.x,y:p.y},angle:rnd(0,6.283),state:`lurk`,distance:0,route:[],repath:0,lost:0,notice:0,wait:0,memory:{x:p.x,y:p.y},goal:{x:p.x,y:p.y},side:i%2?1:-1});
  }
}

/* --- glitched walls: the way out of Level 0 --- */
let glitches=[];
/* one rare find per world: a paranormal cartograph lying somewhere in the halls (first to reach it keeps it) */
let items=[];
function makeItems(){const p=randomSpot(1800,glitches,700);return p?[{id:`cartograph`,x:Math.round(p.x),y:Math.round(p.y)}]:[]}
function makeGlitches(n=3){
  const out=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let t=0;t<6000&&out.length<n;t++){
    const tx=(Math.random()*FBW)|0,ty=(Math.random()*FBH)|0;if(!zc(tx,ty))continue;
    const d=dirs[(Math.random()*4)|0],nx=tx+d[0],ny=ty+d[1];
    if(nx<1||ny<1||nx>=FBW-1||ny>=FBH-1||!Hc(nx,ny))continue;
    const cx=(tx+.5)*96,cy=(ty+.5)*96;if(!sl(cx,cy))continue;
    const x=cx+d[0]*48,y=cy+d[1]*48;
    if(Math.hypot(x-Ic.x,y-Ic.y)<2600||out.some(o=>Math.hypot(o.x-x,o.y-y)<2600))continue;
    if(!fl({x:cx,y:cy},ANCHOR).length)continue;
    out.push({x,y,nx:d[0],ny:d[1]});
  }
  return out;
}

/* --- bodies: one per player, visible to everyone (client sends the finished record) --- */
const bodies=new Map();let bodyVer=1;
function setBody(id,rec){bodies.delete(id);bodies.set(id,rec);while(bodies.size>MAX_BODIES)bodies.delete(bodies.keys().next().value);bodyVer++}

function catchPlayer(p,by){p.dead=by;p.dseq++;justCaught=true}
function houndTarget(){
  const a=alive();if(!a.length)return null;
  let best=null,bd=1/0;
  if(G.grace<=0)for(const p of a)if(Fl(p,p.light)){const d=Math.hypot(p.x-G.x,p.y-G.y);if(d<bd){bd=d;best=p}}
  if(best)return best;
  for(const p of a){if(Math.hypot(p.vx,p.vy)>38){const d=Math.hypot(p.x-G.x,p.y-G.y);if(d<(p.sprinting?850:260)&&d<bd){bd=d;best=p}}}
  if(best)return best;
  for(const p of a){const d=Math.hypot(p.x-G.x,p.y-G.y);if(d<bd){bd=d;best=p}}
  return best;
}
function spawnMonsters(nh,ns){
  hounds.length=0;packs.length=0;
  for(let i=0;i<nh;i++)newHound();
  spawnSmilers(ns);
}
function resetWorld(){
  Lc();runT=0;SG=14;PR=0;spawnT=rnd(70,150);packT=0;justCaught=false;
  spawnMonsters(Math.random()<.5?1:2,2+((Math.random()*4)|0));      // 1-2 hounds to begin with (up to 3 later), 2-5 smilers
  glitches=makeGlitches(3);items=makeItems();
  bodies.clear();bodyVer++;
}
function addPlayer(id){
  const p={id,x:Ic.x,y:Ic.y,vx:0,vy:0,angle:0,sprinting:false,light:true,equipment:{kind:`flashlight`},
    active:false,dead:``,dseq:0,safe:0,exited:false,t0:0};
  players.push(p);return p;
}
function removePlayer(p){const i=players.indexOf(p);if(i>=0)players.splice(i,1)}
function spawn(p){Object.assign(p,{x:Ic.x,y:Ic.y,vx:0,vy:0,dead:``,safe:3,exited:false})}
function join(p){
  const others=players.some(o=>o!==p&&o.active&&!o.exited);
  p.active=true;spawn(p);p.t0=runT;
  if(!others)resetWorld();
}
function respawn(p){if(p.active)spawn(p)}
function leave(p){p.active=false;p.dead=``}
function step(dt){
  for(const p of players)if(p.safe>0)p.safe-=dt;
  for(const p of players)if(p.active&&!p.dead&&!p.exited&&true)              // touching a glitched wall takes you out
    for(const g of glitches)if(Math.hypot(p.x-g.x,p.y-g.y)<54){p.exited=true;p.exitSeq=(p.exitSeq|0)+1;p.exitT=runT-p.t0;p.active=false;break}
  if(frozen)return;
  if(!players.some(p=>p.active&&!p.dead&&!p.exited))return;   // the halls hold their breath while nobody is alive
  dt*=speed;runT+=dt;
  if(bmode===`auto`)Rc(dt);else V.blackout=bmode===`on`;
  PR=PR+(Math.min(1,runT/540)-PR)*Math.min(1,dt);
  SG=Math.max(0,SG-dt);
  if(hounds.length<MAX_HOUNDS){spawnT-=dt;if(spawnT<=0){spawnT=rnd(80,190);if(Math.random()<.75)newHound(1800,alive())}}
  for(const h of hounds)withHound(h,()=>{
    G.pressure=PR;packBehaviour(h);
    const f=houndTarget()||GHOST;Il(f,f.sprinting,dt,f.light);
  });
  packLogic(dt);
  zl(dt);
  if(justCaught){                       // same "lose them" behaviour the single-player retry gave the monsters
    justCaught=false;SG=5;
    for(const h of hounds)withHound(h,()=>{G.grace=Math.max(G.grace,5);jl(`search`,G.memory);El=0});
    q.forEach(e=>{e.state=`search`;e.lost=0;e.repath=0});
  }
}
const r1=n=>Math.round(n*10)/10;
function entities(){
  return {h:hounds.map(h=>({i:h.id,x:r1(h.g.x),y:r1(h.g.y),a:+h.g.angle.toFixed(3),s:h.g.state,d:Math.round(h.g.distance),g:+h.g.grace.toFixed(1),k:h.pack?h.pack.id:0})),
    m:q.map(e=>({x:r1(e.x),y:r1(e.y),a:+e.angle.toFixed(3),s:e.state,d:Math.round(e.distance)})),
    b:V.blackout?1:0,p:+PR.toFixed(3),gw:glitches.map(g=>[Math.round(g.x),Math.round(g.y),g.nx,g.ny]),it:items.map(i=>[i.x,i.y,i.id])};
}
const admin={
  freeze(on){frozen=!!on},
  speed(v){speed=Math.max(.25,Math.min(3,+v||1))},
  blackout(mode){bmode=[`on`,`off`,`auto`].includes(mode)?mode:`auto`;if(bmode===`auto`)V.elapsed=0},
  god(p){p.god=!p.god;return p.god},
  resetMonsters(){spawnMonsters(Math.random()<.5?1:2,2+((Math.random()*4)|0));SG=8;runT=Math.min(runT,60)},
  resetWorld(){resetWorld();for(const p of players)if(p.active)spawn(p)},
  newGlitches(){glitches=makeGlitches(3)},
  newItem(){items=makeItems()},
  nearestItem(x,y){let b=null,bd=1/0;for(const i of items){const d=Math.hypot(i.x-x,i.y-y);if(d<bd){bd=d;b=i}}return b},
  addHound(){if(hounds.length>=MAX_HOUNDS)return false;const h=newHound(1500,alive());if(h)h.g.grace=0;return !!h},
  removeHound(){const h=hounds[hounds.length-1];if(h)killHound(h);return !!h},
  addSmiler(){if(q.length>=MAX_SMILERS)return false;const p=randomSpot(1200,q.concat(hounds.map(h=>h.g)),900);if(!p)return false;q.push({x:p.x,y:p.y,origin:{x:p.x,y:p.y},angle:0,state:`lurk`,distance:0,route:[],repath:0,lost:0,notice:0,wait:0,memory:{x:p.x,y:p.y},goal:{x:p.x,y:p.y},side:q.length%2?1:-1});return true},
  removeSmiler(){return !!q.pop()},
  nearestGlitch(x,y){let b=null,bd=1/0;for(const g of glitches){const d=Math.hypot(g.x-x,g.y-y);if(d<bd){bd=d;b=g}}return b},
  summon(x,y){                       // drop the nearest Hound a short way from (x,y) and point it at that spot
    const h=hounds.slice().sort((a,b)=>Math.hypot(a.g.x-x,a.g.y-y)-Math.hypot(b.g.x-x,b.g.y-y))[0];if(!h)return false;
    for(const d of [420,320,520,260,600])for(let k=0;k<16;k++){
      const a=k/16*Math.PI*2,px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
      if(sl(px,py)){withHound(h,()=>{G.x=px;G.y=py;G.grace=0;Object.assign(G.memory,{x,y,vx:0,vy:0,age:0,confidence:1});jl(`investigate`,{x,y});El=0});return true}
    }
    return false;
  },
  info(){return {fz:frozen?1:0,sp:speed,bo:bmode,hn:hounds.length,sn:q.length,gw:glitches.length,it:items.length,pk:packs.length,hs:hounds.map(h=>h.g.state).join(`,`)}},
};
function takeItem(p){const i=items.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<110);if(i<0)return null;return items.splice(i,1)[0].id}
resetWorld();return {takeItem,players,addPlayer,removePlayer,join,respawn,leave,step,entities,resetWorld,admin,setBody,
  get bodies(){return bodies},get bodyVer(){return bodyVer},get glitches(){return glitches},
  debug:{kc,Oc,Fc,Mc,Pc,zc,Hc,Uc,Bc,sl,ll,W,al,ul,fl,FBW,FBH,qc,G,q,V,Ic,hounds,packs,get glitches(){return glitches}}};

};
