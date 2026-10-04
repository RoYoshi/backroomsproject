'use strict';
const assert=require('assert'),fs=require('fs'),AI=require('../../ai'),M=require('../../world_motion'),make=require('../../sim'),d=require('../../levels/level0_spatial.json');
const out=process.argv[2],sim=make({world:d,seed:42,director:false}),geo=sim.engine.geo,g=geo.geometry,rows=[];
const save=()=>{if(out)fs.writeFileSync(out,JSON.stringify({status:rows.every(r=>r.ok)?'PASS':'FAIL',hash:d.contentHash,nodes:geo.N,rows,stats:geo.navStats},null,2)+'\n');};
const pose=(x,y,z=0)=>{const p={x,y,z},s=g.supports(M.PROFILES.stand,p,[z-.01,z+.01])[0];assert(s,JSON.stringify(p));return {...p,supportId:s.id};};
const cases=[['base',{...d.anchors.find(a=>a.kind==='spawn').position},pose(4728,3192)],['upper',pose(6192,864),pose(6192,864,180)],['lower',pose(720,5976),pose(720,5520,-96)],['upper-return',pose(6192,864,180),pose(7056,1104)]];
for(const kind of ['hound','smiler'])for(const [name,start,goal]of cases){const begin=performance.now();let row={kind,name,start,goal,ok:false};try{const profile=M.ENTITY_PROFILES[kind],caps=AI.SPECIES[kind].caps,m=M.create(g),b=m.initialize({...start},'walk',profile),path=geo.pathPose(b,goal,caps);row.path=path;assert(path?.length,'graph route');let ticks=0,links=[];
 for(const wp of path){if(wp.link?.kind==='crawl')b.shape={...profile,height:24,eyeHeight:18};else if(g.clearance(profile,b).fits)b.shape=profile;
  let t=wp.link?m.beginTraversal(b,wp.link,{vaultSpeed:caps.VAULT_SPEED}):null;if(wp.link){assert(t,'physical link entry '+wp.link.id);links.push(wp.link.id);}let arrived=false;
  for(let n=0;n<1200;n++){const target=t?t.finish:wp,dx=target.x-b.x,dy=target.y-b.y,dist=Math.hypot(dx,dy),v=Math.min(100,dist*60);if(!t&&dist<.001){arrived=true;break;}const intent={x:dist?dx/dist*v:0,y:dist?dy/dist*v:0};if(t){if(m.advanceTraversal(b,t,intent)==='done'){arrived=true;break;}}else{b.vx=intent.x;b.vy=intent.y;m.step(b);}ticks++;assert(g.clearance(b.shape,b).fits,'full body clearance');}assert(arrived,'waypoint stalled '+JSON.stringify({wp,pose:{x:b.x,y:b.y,z:b.z}}));
 }assert(Math.abs(b.z-goal.z)<.11,'final elevation');assert.equal(g.supportPatch(b.supportId).navSurfaceId,g.supportPatch(goal.supportId||b.supportId).navSurfaceId);Object.assign(row,{ok:true,ticks,links,finalPose:{x:b.x,y:b.y,z:b.z,support:b.supportId}});console.log('PASS',kind,name,ticks,links.join(','));
 }catch(e){row.error=e.stack;console.error('FAIL',kind,name,e.message);}row.ms=performance.now()-begin;rows.push(row);save();}
for(const gap of d.production.tightGapSurfaces){const chart=geo.charts.get(gap.navSurfaceId);for(const i of chart.cells.values())for(const kind of ['hound','smiler'])assert(!geo.passableFor(i,AI.SPECIES[kind].caps));}
if(rows.some(r=>!r.ok))process.exitCode=1;
