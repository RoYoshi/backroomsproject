'use strict';
// Read-only semantic export. Legacy source executes only for the explicit comparison root.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{createRequire}=require('module');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..')),req=createRequire(path.join(root,'sim.js')),WORLD=req('./world.js');
const names='FBW,FBH,Oc,kc,Mc,Nc,Pc,Fc,Ic,zc,Bc,Hc,Uc,el,il,W,al,ol,sl,cl,ll,ul,dl,fl,pl';
let flat;
if(fs.existsSync(path.join(root,'world_geometry.js')))flat=req('./world_geometry.js').compile(req('./levels/level0.js'),WORLD).flat;
else {const src=fs.readFileSync(path.join(root,'dev/sim_head.js'),'utf8');flat=new Function('WORLD',src.slice(src.indexOf('var FBW='))+'\nreturn {'+names+'};')(WORLD);}
const clean=v=>ArrayBuffer.isView(v)?Array.from(v):v instanceof Map?[...v].map(clean):Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k,x])=>typeof x!=='function').map(([k,x])=>[k,clean(x)])):v;
const data={};for(const n of names.split(','))if(typeof flat[n]!=='function')data[n]=clean(flat[n]);
data.props=clean(WORLD.PROPS);data.crawl=clean(WORLD.CRAWL);data.materials=clean(WORLD.SURF);
data.queries=[];
for(let ty=0;ty<flat.FBH;ty+=2)for(let tx=0;tx<flat.FBW;tx+=2){const x=(tx+.5)*96,y=(ty+.5)*96,q={x,y,floor:flat.zc(tx,ty),surface:WORLD.surfaceAt(x,y,flat.Oc),crawl:WORLD.crawlAt(x,y),low:WORLD.lowZone(x,y,10),modes:[]};for(const mode of ['walk','under','crawl','any']){WORLD.setMode(mode);q.modes.push({mode,blockers:flat.Bc(x,y),clear15:flat.sl(x,y,15),clear21:flat.sl(x,y,21),clear52:flat.sl(x,y,52)});}WORLD.setMode('walk');q.rays=[0,Math.PI/4,Math.PI/2,Math.PI,2.7].map(a=>flat.Uc(x,y,a,900));data.queries.push(q);}
Date.now=()=>0;
const sim=req('./sim.js')({seed:1}),geo=sim.engine.geo;
data.nav=Object.fromEntries(['cols','rows','N','cs','cls','clr','lamp','links'].map(k=>[k,clean(geo[k])]));
data.seeded=[];
for(const seed of [1,42,1701]){const s=req('./sim.js')({seed});const p=s.addPlayer(100);s.join(p,0);for(let i=0;i<120;i++)s.step(1/60);data.seeded.push({seed,entities:s.entities(),glitches:s.glitches,spawn:s.debug.Ic,blackout:s.debug.V,engine:s.engine.snapshot(),admin:s.admin.info()});}
const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(clean(data))+'\n'),{level:9});
if(process.argv[3])fs.writeFileSync(process.argv[3],bytes);else process.stdout.write(bytes);
