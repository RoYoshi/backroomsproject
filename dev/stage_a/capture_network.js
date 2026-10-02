'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{root,make,save,pick,clean}=require('./trace_io');
Date.now=()=>0;const out=path.resolve(process.argv[2]||path.join(__dirname,'traces')),src=fs.readFileSync(path.join(root,'mp.js'),'utf8');let now=0;
const body=src.slice(src.indexOf('const NET = {'),src.indexOf('window.__netPose'));
const callback=src.match(/NET.onEpoch = \(\) => \{[^\n]+?\};/)[0];
const hMap=new Map([[1,{slot:0}]]),hSlots=[1,2],sSlot=[1],M=new Function('performance','window','hMap','hSlots','sSlot',body+'\n'+callback+'\nreturn {NET,netReset,netHist,netPose};')({now:()=>now},{},hMap,hSlots,sSlot);
const T=make('network/entity-interpolation-and-reset',31,'mp.js',{packets:'20 Hz, fixed arrival jitter and occasional 50 ms stale report; sample at 60 Hz'},['Literal current NET functions and epoch callback with test slot containers; no browser renderer/socket. Real wire tests are recorded separately. Existing >250 ms backward-clock heuristic is frozen, not redesigned.']);
function record(tick,phase,input=null){T.records.push({tick,phase,input,epoch:M.NET.epoch,offset:M.NET.off,lastSt:M.NET.lastSt,h1:M.netPose('h1'),m1:M.netPose('m1'),history:[...M.NET.hist].map(([id,h])=>({id,samples:h.map(q=>({...q}))})),slots:{hound:[...hSlots],smiler:[...sSlot],mapSize:hMap.size}});}
for(let k=0;k<80;k++){now=k*50+(k*17%41);const st=60+k*.05-(k%17===5?.05:0),packet={st,h:[{i:1,x:5000+k*10,y:3000,a:k*.01}],m:[{i:1,x:3000,y:3000+k*2,a:0}]};M.netHist(packet,now);for(let f=0;f<3;f++){now=k*50+(k*17%41)+f*1000/60;record(k*3+f,'normal+jitter',f===0?packet:null);}}assert.equal(M.NET.epoch,0);
now=4500;M.netHist({st:1,h:[{i:1,x:1000,y:1200,a:0}],m:[]},now);record(240,'world-clock-reset');assert.equal(M.netPose('h1').x,1000);assert.equal(hMap.size,0);assert(hSlots.every(x=>x===null));
M.netReset();record(241,'disconnect');assert.equal(M.NET.off,null);assert.equal(M.NET.hist.size,0);now=4600;M.netHist({st:2,h:[{i:1,x:1200,y:1400,a:1}]},now);record(242,'reconnect');assert.equal(M.netPose('h1').x,1200);
const index=[save(out,'network-interpolation',T)];

const peerStart=src.indexOf('    const px = o.x, py = o.y;',src.indexOf('function drawPeers'));
const peerEnd=src.indexOf('    if (A && A.mkAvatar && layer)',peerStart);
assert(peerStart>=0&&peerEnd>peerStart);
const peerStep=new Function('o','dt','angDiff',src.slice(peerStart,peerEnd));
const peerMove=new Function('window',src.slice(src.indexOf('const SNAMES ='),src.indexOf('/* what a fallen wanderer'))+'\nreturn peerMv;')({});
const angDiff=(a,b)=>{let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;else if(d<-Math.PI)d+=Math.PI*2;return d;};
const PT=make('network/peer-render-pose',null,'mp.js',{frames:180,fps:60,wireEveryFrames:3},['Literal drawPeers position/velocity/heading smoothing and peerMv extracted from current mp.js. Presentation trace only, not physics reference. Existing peer easing is per render frame; no claim of render-rate equality. Avatar/Pixi drawing omitted.']);
const peer={x:1000,y:1200,tx:1000,ty:1200,a:0,mv:[1,170,100,0]};
for(let frame=0;frame<180;frame++){if(frame%3===0){peer.tx+=8.5;peer.a=frame>=90?.8:0;}if(frame===90)peer.mv=[6,240,75,0];if(frame===125)peer.mv=[1,170,75,0];peerStep(peer,1/60,angDiff);PT.records.push({frame,tick:frame+1,...pick(peer,['x','y','tx','ty','vx','vy','a','ang','dist']),pose:peerMove(peer,1+frame/60)});}
index.push(save(out,'network-peer-pose',PT));

const {World}=require('../harness'),w=World(950),s=w.sim,p=s.addPlayer(200);const L=make('network/authoritative-lifecycle',950,'dev/sim_glue.js',{clock:'explicit seconds',captureFixture:'admin captureMode(play), real close Hound'},['Actual sim methods and authoritative capture engine. Server socket/session orchestration separately covered by audit_net/live; this is a deterministic headless lifecycle trace. No Z protocol exists.']);let tick=0,cursor=0;
function rec(action,result){L.records.push({tick,action,result,life:s.lifeOf(p),player:pick(p,['id','life','dseq','x','y','vx','vy','stamina','safe','active','dead','reviveOk','caught','kill']),events:w.evLog.slice(cursor).map(e=>pick(e,['t','pid','eid','kind','variant','ph','why']))});cursor=w.evLog.length;}
rec('menu',true);assert(s.join(p,100));rec('join',true);assert(!s.respawn(p));rec('living-respawn-rejected',false);assert(!s.join(p,101));rec('living-join-rejected',false);
p.safe=0;p.x=5000;p.y=3504;const h=w.hound(p.x-30,p.y);s.admin.captureMode('play');h.state='HUNTING';h.target=p.id;h.ang=0;
for(;tick<600&&!p.caught&&!p.dead;){w.step();tick++;rec('capture-approach',null);}assert(p.caught,'real capture fixture');assert(!s.respawn(p));rec('held-respawn-rejected',false);assert(!s.join(p,110));rec('held-join-rejected',false);assert(!s.leave(p,110));rec('held-leave-rejected',false);assert(s.forfeit(p));rec('disconnect-forfeit',true);assert(p.dead);assert(s.respawn(p));rec('dead-respawn',true);assert(!s.respawn(p));rec('second-respawn-rejected',false);
assert(s.vanish(p,200));rec('new-run-vanish',true);assert(!s.join(p,201));rec('premature-new-run-rejected',false);assert(s.join(p,203));rec('completed-new-run',true);
index.push(save(out,'network-lifecycle',L));fs.writeFileSync(path.join(out,'network-index.json'),JSON.stringify(index,null,2)+'\n');console.log(index.map(x=>({name:x.name,records:x.records})));
