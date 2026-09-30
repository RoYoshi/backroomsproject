const WORLD=require(require('./paths.js') + '/world.js');const sim=require('./sim_geo.js')();const D=sim.debug;
console.log('props',WORLD.PROPS.length);
const bad=[];
for(const p of WORLD.PROPS){
  const tiles=[];for(let y=p.ty;y<p.ty+p.th;y++)for(let x=p.tx;x<p.tx+p.tw;x++)tiles.push(D.kc[y*D.FBW+x]);
  if(tiles.some(v=>v!==1))bad.push(p.id+' cell not floor '+tiles);
  // free ring
  const ring=[];for(let y=p.ty-2;y<p.ty+p.th+2;y++)for(let x=p.tx-2;x<p.tx+p.tw+2;x++){const inside=x>=p.tx&&x<p.tx+p.tw&&y>=p.ty&&y<p.ty+p.th;if(!inside)ring.push(D.kc[y*D.FBW+x]===1)}
  console.log(p.id,p.type,p.kind,'ring free',ring.filter(Boolean).length+'/'+ring.length);
}
console.log('bad',bad);
// navigation: nav cells blocked near props in walk mode; free in crawl mode for gaps
const cnt=(mode)=>{WORLD.setMode(mode);let n=0;for(let i=0;i<D.W*D.al;i++){const c=D.ul(i);if(D.zc(Math.floor(c.x/96),Math.floor(c.y/96))&&D.sl(c.x,c.y))n++}return n};
console.log('walk cells',cnt('walk'),'under',cnt('under'),'crawl',cnt('crawl'));WORLD.setMode('walk');
console.log('legacy ll count',D.ll.reduce((a,b)=>a+b,0));
// connectivity of anchor to all rooms via fl
const a={x:1056,y:3264};for(const r of D.Oc){const p={x:(r.x+r.w/2)*96,y:(r.y+r.h/2)*96};console.log(r.name,D.fl(a,p).length)}
