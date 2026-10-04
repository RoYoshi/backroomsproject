/* Stage D presentation only. No simulation imports, ticks, RNG, or world mutation.
 * Browser: TFB_VIEW; Node: require('./world_view'). Frozen Stage C solids in,
 * view-local packets/fades out. The WebGL2 backend extends a shipped Pixi context.
 */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./camera_policy'):root.__cameraPolicy);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TFB_VIEW=api;
})(typeof window==='object'?window:globalThis,function(cameraPolicy){
  'use strict';
  const ELEVATION=.5,MAX_SOLIDS=64,MAX_PLANES=8,BOUNDARY=.005,MAX_PIXELS=4194304;
  // Part 3B parameters are presentation units, never movement constants.
  const DEPTH=Object.freeze({coefficient:1/3600,minScale:.94,maxScale:1.06,cameraOmega:24,maxCameraLag:28,renderOmega:40,maxRenderLag:8,landingAmplitude:1.25,landingDuration:.18,resetGap:.25});
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function denominator(z,camera){return camera.depth?clamp(1-DEPTH.coefficient*(z-camera.z),1/DEPTH.maxScale,1/DEPTH.minScale):1;}
  function layerScale(z,camera){return 1/denominator(z,camera);}
  function depthBreaks(camera){return camera.depth?[camera.z+(1-1/DEPTH.minScale)/DEPTH.coefficient,camera.z+(1-1/DEPTH.maxScale)/DEPTH.coefficient]:[];}
  // Part 3B HQ1 presentation lock. A topDown camera is strictly orthographic:
  // pitch/tilt 0, no oblique offset and no Z-based XY scale of any geometry.
  // Wall depth is LOCAL: each exposed vertical face is drawn as one bounded band
  // inset into its own footprint (mitred with the face it meets), so rectangles
  // stay rectangles and room footprints never move. A virtual camera height
  // relative to the smoothed camera Z sizes the bands; that is the stair/fall
  // cue. The physical face, never the band, owns masks, light and picking.
  const BAND=Object.freeze({reach:52,height:640,cue:.5,min:3,max:28,share:.35,cover:2});
  const RELATIVE=Object.freeze(['player','peer','hound','smiler','vanish','body','hand:0','hand:1','light','hat','replay']);
  function topDownCamera(camera){return camera?.topDown===true;}
  function magnification(z,camera){return BAND.height/(BAND.height-clamp(z-camera.z,-4*BAND.height,BAND.cue*BAND.height));}
  function bandWidth(solid,camera){if(!topDownCamera(camera)||!solid?.bands?.length)return 0;const w=BAND.reach*(magnification(solid.zBand[1],camera)-magnification(solid.zBand[0],camera));return Math.min(BAND.max,BAND.share*solid.thickness,Math.max(BAND.min,w));}
  // Each client anchors relative actor scale to ITS local player: exactly 1.0.
  function presentedZ(actor){return actor.z+(actor.renderOffset||0);}
  function relativeScale(actor,camera){if(!Number.isFinite(camera?.anchorZ)||!RELATIVE.includes(actor?.kind))return 1;return 1/clamp(1-DEPTH.coefficient*(presentedZ(actor)-camera.anchorZ),1/DEPTH.maxScale,1/DEPTH.minScale);}
  function facingAway(band,eye){return band.normal.x*(eye.x-band.a.x)+band.normal.y*(eye.y-band.a.y)<-.01;}
  // Exact constant-target critically damped update. Independent instances own
  // all state; no actor, geometry, simulation clock or network pose is written.
  class CameraElevation {
    constructor(omega=DEPTH.cameraOmega,lag=DEPTH.maxCameraLag){this.key=null;this.z=0;this.velocity=0;this.resets=0;this.omega=omega;this.lag=lag;this.target=0;}
    update(target,dt,key='local',linear=false){
      if(!Number.isFinite(target))throw Error('Non-finite presentation elevation');
      if(this.key!==key||!Number.isFinite(dt)||dt>DEPTH.resetGap||dt<0){this.key=key;this.target=target;this.z=target;this.velocity=0;this.resets++;return this.z;}
      const w=this.omega,t=Math.max(0,dt),v=linear&&t>0?(target-this.target)/t:0;
      // Exact response to a linearly moving target. Constant-target mode is
      // retained for discrete event tests; production samples use linear input.
      const y=this.z-(linear?this.target:target)+2*v/w,b=this.velocity-v+w*y,e=Math.exp(-w*t);
      this.z=target-2*v/w+(y+b*t)*e;this.velocity=v+(this.velocity-v-w*b*t)*e;this.target=target;
      const bounded=clamp(this.z,target-this.lag,target+this.lag);
      if(bounded!==this.z){this.z=bounded;this.velocity=0;}
      return this.z;
    }
    snapshot(){return {z:this.z,velocity:this.velocity,key:this.key,resets:this.resets};}
  }
  class ActorElevation {
    constructor(){this.spring=new CameraElevation(DEPTH.renderOmega,DEPTH.maxRenderLag);this.previous=null;this.landingAge=Infinity;this.landingStrength=0;}
    update(pose,dt,key='actor'){
      const previous=this.previous,mode=pose.motionMode||pose.mode,shape=pose.shape||{height:pose.height||60};
      const reset=!previous||previous.key!==key||dt>DEPTH.resetGap||Math.hypot(pose.x-previous.x,pose.y-previous.y)>256||Math.abs(pose.z-previous.z)>64;
      let z=this.spring.update(pose.z,reset?Infinity:dt,key,true);
      if(reset){this.landingAge=Infinity;this.landingStrength=0;}
      else if(previous.mode==='airborne'&&mode==='grounded'){
        this.landingAge=0;this.landingStrength=clamp(Math.abs(previous.vz||0)/420,0,1);
      }else this.landingAge+=Math.max(0,dt);
      const u=this.landingAge/DEPTH.landingDuration,settle=u>=0&&u<1?-DEPTH.landingAmplitude*this.landingStrength*16*u*u*(1-u)*(1-u):0;
      const limit=Math.min(DEPTH.maxRenderLag,(shape.height||60)*.14);
      z=pose.z+clamp(z-pose.z+settle,-limit,limit);
      this.previous={key,x:pose.x,y:pose.y,z:pose.z,vz:pose.vz,mode};
      return {z,offset:z-pose.z,settle,reset,physicalZ:pose.z,support:pose.supportId??pose.support};
    }
  }
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  function project(p,camera,scale,e=camera.elevation??ELEVATION){const s=scale/denominator(p.z,camera);return {x:s*(p.x-camera.x),y:s*((p.y-camera.y)-e*(p.z-camera.z))};}
  function depth(p,camera,e=camera.elevation??ELEVATION){return (e*(p.y-camera.y)+(p.z-camera.z))/Math.sqrt(1+e*e);}
  function onPlane(screen,z,camera,scale,e=camera.elevation??ELEVATION){const w=denominator(z,camera);return {x:screen.x*w/scale+camera.x,y:screen.y*w/scale+camera.y+e*(z-camera.z),z};}
  // A bounded projection is three projective regions. Split triangles exactly
  // at their two shared Z planes so GPU interpolation of PHYSICAL vWorld is
  // exact, including ramps/walls crossing a clamp. Merely clamping vertices
  // would silently bend the inverse and physical masks inside a triangle.
  function clipDepthTriangles(vertices,camera){
    if(!camera.depth)return vertices instanceof Float32Array?vertices:new Float32Array(vertices);
    const cuts=depthBreaks(camera),out=[];
    const clip=(poly,z,above)=>{const result=[];for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ia=above?a[2]>=z:a[2]<=z,ib=above?b[2]>=z:b[2]<=z;
      if(ia)result.push(a);if(ia!==ib){const t=(z-a[2])/(b[2]-a[2]);result.push(a.map((v,k)=>v+(b[k]-v)*t));}
    }return result;};
    for(let i=0;i<vertices.length;i+=24){let pieces=[[Array.from(vertices.slice(i,i+8)),Array.from(vertices.slice(i+8,i+16)),Array.from(vertices.slice(i+16,i+24))]];
      for(const z of cuts){const next=[];for(const poly of pieces){const zs=poly.map(v=>v[2]);if(Math.min(...zs)<z&&Math.max(...zs)>z)next.push(clip(poly,z,false),clip(poly,z,true));else next.push(poly);}pieces=next;}
      for(const p of pieces)for(let j=1;j<p.length-1;j++)out.push(...p[0],...p[j],...p[j+1]);
    }return new Float32Array(out);
  }
  function footprint(width,height,camera,zoom=1){const base=cameraPolicy.visibleWorld(width,height),z=Math.max(1,Math.min(4,zoom)),v={width:base.width/z,height:base.height/z,scale:base.scale*z};return {...v,minX:camera.x-v.width/2,maxX:camera.x+v.width/2,minY:camera.y-v.height/2,maxY:camera.y+v.height/2};}
  function within(p,box){return p.x>=box.minX&&p.x<=box.maxX&&p.y>=box.minY&&p.y<=box.maxY;}
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
  const zAt=(plane,p)=>plane.a*p.x+plane.b*p.y+plane.c;
  function normalPlane(x,y,z,d){const n=Math.hypot(x,y,z);return [x/n,y/n,z/n,d/n];}
  function compile(definition){
    // Own presentation data; never freeze or annotate the caller's world object.
    definition=JSON.parse(JSON.stringify(definition));definition.solids.sort((a,b)=>a.id.localeCompare(b.id));
    if(definition.geometryMode!=='spatial')throw Error('Stage D backend accepts spatial fixtures only; Level 0 keeps its existing fast path');
    if(new Set(definition.solids.map(s=>s.id)).size!==definition.solids.length)throw Error('Spatial visibility capacity requires unique primitive IDs');
    const continuousInterior=definition.assetId==='world:level0-spatial'&&definition.production?.sourceAssetId==='world:level0';
    // Semantic interpretation belongs only to this private presentation model.
    // The physical definition/hash/arrays are never annotated or rewritten.
    const role=g=>!continuousInterior?'legacyCutaway':g.id.startsWith('view:ceiling:')||g.id==='view:long-room:upper-roof'?'continuousInteriorCeiling':g.id.startsWith('view:long-room:')?'overlapSlab':'localCover';
    const ignored=new Set((definition.viewGroups||[]).filter(g=>role(g)==='continuousInteriorCeiling').flatMap(g=>g.solidIds));
    const vertices=[],packets=[],solids=definition.solids.slice().sort((a,b)=>a.id.localeCompare(b.id)).map((s,index)=>{
      if(s.footprint.length+2>MAX_PLANES)throw Error('Stage D convex plane capacity exceeded');
      let area=0;for(let i=0;i<s.footprint.length;i++){const a=s.footprint[i],b=s.footprint[(i+1)%s.footprint.length];area+=a.x*b.y-b.x*a.y;}
      if(area<=0)throw Error('Expected validated CCW convex Stage C footprint');
      const planes=s.footprint.map((a,i)=>{const b=s.footprint[(i+1)%s.footprint.length],x=b.y-a.y,y=a.x-b.x;return normalPlane(x,y,0,x*a.x+y*a.y);});
      planes.push(normalPlane(s.lower.a,s.lower.b,-1,-s.lower.c),normalPlane(-s.upper.a,-s.upper.b,1,s.upper.c));
      const lo=s.footprint.map(p=>({...p,z:zAt(s.lower,p)})),hi=s.footprint.map(p=>({...p,z:zAt(s.upper,p)})),all=lo.concat(hi);
      const min={x:Math.min(...all.map(p=>p.x)),y:Math.min(...all.map(p=>p.y)),z:Math.min(...all.map(p=>p.z))},max={x:Math.max(...all.map(p=>p.x)),y:Math.max(...all.map(p=>p.y)),z:Math.max(...all.map(p=>p.z))};
      const first=vertices.length/8,tri=(a,b,c,n)=>{for(const p of [a,b,c])vertices.push(p.x,p.y,p.z,n[0],n[1],n[2],0,0);};
      for(let i=1;i<lo.length-1;i++){tri(lo[0],lo[i+1],lo[i],planes[planes.length-2]);tri(hi[0],hi[i],hi[i+1],planes[planes.length-1]);}
      for(let i=0;i<lo.length;i++){const j=(i+1)%lo.length;tri(lo[i],lo[j],hi[j],planes[i]);tri(lo[i],hi[j],hi[i],planes[i]);}
      packets.push({id:s.id,index,cameraIgnored:ignored.has(s.id),first,count:vertices.length/8-first,min,max,materialId:s.materialId});
      const centroid={x:s.footprint.reduce((a,p)=>a+p.x,0)/s.footprint.length,y:s.footprint.reduce((a,p)=>a+p.y,0)/s.footprint.length};
      const thickness=Math.min(...planes.slice(0,s.footprint.length).map(p=>Math.max(...s.footprint.map(v=>p[3]-p[0]*v.x-p[1]*v.y))));
      return {id:s.id,index,planes,min,max,cameraIgnored:ignored.has(s.id),footprint:s.footprint,lower:s.lower,upper:s.upper,visible:!!s.channels.visible,ir:!!s.channels.ir,materialId:s.materialId,zBand:[zAt(s.lower,centroid),zAt(s.upper,centroid)],thickness,bands:[]};
    });
    const groups=(definition.viewGroups||[]).filter(g=>g.cutawayEligible===true&&role(g)!=='continuousInteriorCeiling').slice().sort((a,b)=>a.id.localeCompare(b.id)).flatMap(g=>{
      const members=solids.filter(s=>g.solidIds.includes(s.id)),kind=role(g);
      // Each finite tread is its own overhead cover. The upper slab and its
      // edge walls remain one small structural group, not the whole LONG ROOM.
      return continuousInterior&&g.id==='view:long-room:stairs'?members.map(s=>({id:g.id+':'+s.id.split(':').at(-1),kind,solids:[s]})):[{id:g.id,kind,solids:members}];
    });
    const chunks={};for(const s of solids){for(let y=Math.floor(s.min.y/768);y<=Math.floor(s.max.y/768);y++)for(let x=Math.floor(s.min.x/768);x<=Math.floor(s.max.x/768);x++){const key=x+','+y;(chunks[key]||(chunks[key]=[])).push(s.index);}}
    buildBands(solids,chunks,new Set(groups.flatMap(g=>g.solids.map(s=>s.id))));const planar=planarMesh(solids);
    return freeze({solids,groups,packets,vertices,planarVertices:planar.vertices,planarPackets:planar.packets,definition,chunks,continuousInterior,ignoredCeilings:[...ignored].sort()});
  }
  // A face (or part of one) is internal when the point just outside it near
  // its top lies inside another DRAWN solid (wall pieces of one mass, a lintel
  // or overhead flush with its wall), or when a never-cut-away solid sits
  // directly on that edge (a floor slab's rim under a wall). Physical masks
  // still decide what is actually seen on every band that remains.
  function exposedSpans(s,k,solids,chunks,cutaway){
    const fp=s.footprint,a=fp[k],b=fp[(k+1)%fp.length],n={x:s.planes[k][0],y:s.planes[k][1]},L=Math.hypot(b.x-a.x,b.y-a.y),e=.05;if(L<1e-6)return [];
    const from={x:a.x+n.x*e,y:a.y+n.y*e},to={x:b.x+n.x*e,y:b.y+n.y*e},covered=[];
    for(const i of candidates({solids,chunks},{x:Math.min(from.x,to.x),y:Math.min(from.y,to.y),z:-Infinity},{x:Math.max(from.x,to.x),y:Math.max(from.y,to.y),z:Infinity})){
      const c=solids[i];if(c===s||c.cameraIgnored)continue;let t0=0,t1=1,ok=true;
      for(let j=0;j<c.footprint.length&&ok;j++){const p=c.planes[j],A=p[0]*from.x+p[1]*from.y-p[3],B=p[0]*(to.x-from.x)+p[1]*(to.y-from.y);if(Math.abs(B)<1e-12){if(A>1e-9)ok=false;}else if(B<0)t0=Math.max(t0,-A/B);else t1=Math.min(t1,-A/B);if(t1-t0<=1e-9)ok=false;}
      if(!ok)continue;const m={x:a.x+(b.x-a.x)*(t0+t1)/2,y:a.y+(b.y-a.y)*(t0+t1)/2},top=zAt(s.upper,m),z=top-Math.min(BAND.cover,.1*(top-zAt(s.lower,m))),lo=zAt(c.lower,m),hi=zAt(c.upper,m);
      if((lo<=z&&hi>=z)||(!cutaway.has(c.id)&&lo<=top+.5&&hi>=top+.5))covered.push([t0,t1]);
    }
    covered.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);const open=[];let t=0;
    for(const [x,y]of covered){if((x-t)*L>=.5)open.push([t,x]);t=Math.max(t,y);}
    if((1-t)*L>=.5)open.push([t,1]);return open;
  }
  // Each band is a pure perpendicular strip (no shear, no taper). Its ends are
  // classified once: 'convex' (meets this solid's next face; overlapping
  // strips split on the corner diagonal by depth), 'concave' (meets another
  // solid's face across an inner room corner; the strip is extended one band
  // width so both strips fill that corner, split on the diagonal), 'square'.
  function buildBands(solids,chunks,cutaway){
    const drawn=solids.filter(s=>!s.cameraIgnored),ends=new Map(),key=p=>Math.round(p.x*64)+','+Math.round(p.y*64),near=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6;
    for(const s of drawn){const fp=s.footprint;for(let k=0;k<fp.length;k++){const a=fp[k],b=fp[(k+1)%fp.length],n={x:s.planes[k][0],y:s.planes[k][1]};
      for(const [t0,t1]of exposedSpans(s,k,solids,chunks,cutaway)){
        const band={id:s.bands.length,edge:k,normal:n,t0,t1,a:{x:a.x+(b.x-a.x)*t0,y:a.y+(b.y-a.y)*t0},b:{x:a.x+(b.x-a.x)*t1,y:a.y+(b.y-a.y)*t1}};
        band.za=[zAt(s.lower,band.a),zAt(s.upper,band.a)];band.zb=[zAt(s.lower,band.b),zAt(s.upper,band.b)];s.bands.push(band);
        for(const end of ['a','b']){const at=key(band[end]);if(!ends.has(at))ends.set(at,[]);ends.get(at).push({s,band,end});}
      }}}
    for(const s of drawn)for(const band of s.bands)for(const end of ['a','b']){
      const X=band[end],Y=band[end==='a'?'b':'a'],L=Math.hypot(X.x-Y.x,X.y-Y.y),d={x:(X.x-Y.x)/L,y:(X.y-Y.y)/L},n=band.normal,count=s.footprint.length;let partner=null,join='square';
      if(end==='a'?band.t0<=1e-9:band.t1>=1-1e-9){const edge=end==='a'?(band.edge+count-1)%count:(band.edge+1)%count;partner=s.bands.find(q=>q.edge===edge&&near(q[end==='a'?'b':'a'],X))||null;if(partner)join='convex';}
      if(!partner)for(const o of ends.get(key(X))||[]){
        if(o.s===s||Math.abs(o.s.max.z-s.max.z)>1||!near(o.band[o.end],X))continue;const q=o.band,Z=q[o.end==='a'?'b':'a'];
        if(q.normal.x*d.x+q.normal.y*d.y<-.7&&(Z.x-X.x)*n.x+(Z.y-X.y)*n.y>.5){partner=q;join='concave';break;}
      }
      band['join'+end]=join;
    }
  }
  // Triangles of one band at width w. Every vertex carries its PHYSICAL face
  // point p, unit display offset o (display = p.xy + o*w) and depth lift k
  // above the solid's top. Main strip: k .5 at the base edge to .1 at the inset
  // edge, so at a convex corner the strip nearer its own base wins: a diagonal
  // seam. Concave extension: k = .3 - .2*past + .2*inset, which hands the
  // shared inner-corner square to each face on the correct side of the
  // diagonal. Extensions show the face's end column (physically clamped a
  // quarter pixel inside the exposed span, clear of the touching neighbour).
  function bandMesh(b,w){
    const n=b.normal,i={x:-n.x,y:-n.y},L=Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y),u={x:(b.b.x-b.a.x)/L,y:(b.b.y-b.a.y)/L},zero={x:0,y:0},inside=Math.min(.25,L/4);
    const A0={x:b.a.x,y:b.a.y,z:b.za[0]},A1={x:b.a.x,y:b.a.y,z:b.za[1]},B0={x:b.b.x,y:b.b.y,z:b.zb[0]},B1={x:b.b.x,y:b.b.y,z:b.zb[1]};
    // x: exact display anchor; p: sampled PHYSICAL point (x stepped s along the
    // face, u == (-n.y,n.x) for CCW footprints); display = x.xy + o*w.
    const v=(x,o,k,s=0)=>({x,s,o,k,p:{x:x.x+u.x*s,y:x.y+u.y*s,z:x.z},d:{x:x.x+o.x*w,y:x.y+o.y*w}}),quad=(a,b,c,d)=>[[a,b,c],[a,c,d]];
    const tris=quad(v(A0,zero,.5),v(B0,zero,.5),v(B1,i,.1),v(A1,i,.1));
    if(b.joina==='concave'){const e={x:-u.x,y:-u.y};tris.push(...quad(v(A0,zero,.3,inside),v(A0,e,.1,inside),v(A1,{x:e.x+i.x,y:e.y+i.y},.3,inside),v(A1,i,.5,inside)));}
    if(b.joinb==='concave')tris.push(...quad(v(B0,zero,.3,-inside),v(B0,u,.1,-inside),v(B1,{x:u.x+i.x,y:u.y+i.y},.3,-inside),v(B1,i,.5,-inside)));
    return tris;
  }
  function planarMesh(solids){
    const vertices=[],packets=[],push=(p,n,o,k,s=0)=>vertices.push(p.x,p.y,p.z,n[0],n[1],n[2],o.x,o.y,k,s);
    for(const s of solids){const first=vertices.length/10,top=s.planes[s.planes.length-1],hi=s.footprint.map(p=>({x:p.x,y:p.y,z:zAt(s.upper,p)}));
      for(let i=1;i<hi.length-1;i++)for(const p of [hi[0],hi[i],hi[i+1]])push(p,top,{x:0,y:0},0);
      for(const b of s.bands)for(const tri of bandMesh(b,0))for(const q of tri)push(q.x,[b.normal.x,b.normal.y,0],q.o,q.k,q.s);
      packets.push({id:s.id,index:s.index,cameraIgnored:s.cameraIgnored,first,count:vertices.length/10-first,min:s.min,max:s.max,materialId:s.materialId});
    }
    return {vertices,packets,stride:10};
  }
  function barycentric(tri,x,y){
    const [a,b,c]=tri,det=(b.d.y-c.d.y)*(a.d.x-c.d.x)+(c.d.x-b.d.x)*(a.d.y-c.d.y);if(Math.abs(det)<1e-12)return null;
    const l1=((b.d.y-c.d.y)*(x-c.d.x)+(c.d.x-b.d.x)*(y-c.d.y))/det,l2=((c.d.y-a.d.y)*(x-c.d.x)+(a.d.x-c.d.x)*(y-c.d.y))/det,l3=1-l1-l2;
    if(l1<-1e-9||l2<-1e-9||l3<-1e-9)return null;return {point:{x:a.p.x*l1+b.p.x*l2+c.p.x*l3,y:a.p.y*l1+b.p.y*l2+c.p.y*l3,z:a.p.z*l1+b.p.z*l2+c.p.z*l3},k:a.k*l1+b.k*l2+c.k*l3};
  }
  // Exact CPU inverse of the top-down draw: the highest drawn fragment (caps at
  // their physical XY, eye-facing bands at their inset XY) under one point.
  function displayedSurface(model,x,y,camera,eye,view){
    let best=null;const reach=2*BAND.max+1,consider=c=>{if(!best||c.depth>best.depth+1e-9||(Math.abs(c.depth-best.depth)<=1e-9&&c.order>best.order))best=c;};
    for(const i of candidates(model,{x:x-reach,y:y-reach,z:-Infinity},{x:x+reach,y:y+reach,z:Infinity})){
      const s=model.solids[i];if(s.cameraIgnored||view?.fadeFor(s.id)>=1)continue;
      if(s.footprint.every((a,k)=>s.planes[k][0]*x+s.planes[k][1]*y-s.planes[k][3]<=1e-9)){const z=zAt(s.upper,{x,y});consider({solid:s,kind:'cap',depth:z,order:i*65536,point:{x,y,z}});}
      const w=bandWidth(s,camera);if(!(w>0))continue;
      for(const b of s.bands){if(facingAway(b,eye))continue;const tris=bandMesh(b,w);for(let t=0;t<tris.length;t++){const hit=barycentric(tris[t],x,y);if(hit)consider({solid:s,kind:'band',band:b.id,depth:s.max.z+hit.k,order:i*65536+1+b.id*8+t,point:hit.point});}}
    }
    return best;
  }
  function surfaceBand(s,surface){
    const p=surface.point,n=surface.normal;let best=null,gap=Infinity;
    for(const b of s.bands){if(b.normal.x*n.x+b.normal.y*n.y<.99)continue;const dx=b.b.x-b.a.x,dy=b.b.y-b.a.y,L=Math.hypot(dx,dy),t=((p.x-b.a.x)*dx+(p.y-b.a.y)*dy)/(L*L),g=Math.max(0,-t,t-1)*L+Math.abs((p.x-b.a.x)*b.normal.x+(p.y-b.a.y)*b.normal.y);if(g<gap){gap=g;best=b;}}
    return gap<=2?best:null;
  }
  // Convex segment clipping. Expanding occluders is conservative at thin edges.
  function interval(s,from,to,margin=0){let enter=0,exit=1;for(const n of s.planes){const a=n[0]*from.x+n[1]*from.y+n[2]*from.z-n[3]-margin,b=n[0]*(to.x-from.x)+n[1]*(to.y-from.y)+n[2]*(to.z-from.z);if(Math.abs(b)<1e-9){if(a>0)return null;}else if(b<0)enter=Math.max(enter,-a/b);else exit=Math.min(exit,-a/b);if(enter>exit)return null;}return {enter,exit};}
  function candidates(model,min,max){const ids=new Set();for(let y=Math.floor((min.y-BOUNDARY)/768);y<=Math.floor((max.y+BOUNDARY)/768);y++)for(let x=Math.floor((min.x-BOUNDARY)/768);x<=Math.floor((max.x+BOUNDARY)/768);x++)for(const i of model.chunks[x+','+y]||[])ids.add(i);return [...ids].sort((a,b)=>a-b).filter(i=>{const s=model.solids[i];return ['x','y','z'].every(k=>s.max[k]>=min[k]-BOUNDARY&&s.min[k]<=max[k]+BOUNDARY);});}
  function visible(model,eye,point,receiver=-1){const len=Math.hypot(point.x-eye.x,point.y-eye.y,point.z-eye.z);if(len<1e-6)return true;for(const i of candidates(model,{x:Math.min(eye.x,point.x),y:Math.min(eye.y,point.y),z:Math.min(eye.z,point.z)},{x:Math.max(eye.x,point.x),y:Math.max(eye.y,point.y),z:Math.max(eye.z,point.z)})){const s=model.solids[i];if(!s.visible)continue;const t=interval(s,eye,point,s.index===receiver?0:BOUNDARY);if(t&&t.exit>1e-6&&t.enter<1-(s.index===receiver?.03/len:0))return false;}return true;}
  function pickingRay(screen,camera,scale,e=camera.elevation??ELEVATION){
    if(camera.depth){const zs=[camera.z+4096,...depthBreaks(camera).slice().reverse(),camera.z-4096],points=zs.map(z=>onPlane(screen,z,camera,scale,e));
      return {from:points[0],to:points.at(-1),segments:points.slice(1).map((to,i)=>({from:points[i],to}))};}
    const p=onPlane(screen,camera.z,camera,scale,e),n=Math.hypot(e,1),v={x:0,y:e/n,z:1/n},d=depth(p,camera,e);
    const at=t=>({x:p.x+v.x*t,y:p.y+v.y*t,z:p.z+v.z*t});
    return {from:at(4096-d),to:at(-4096-d)};
  }
  function cameraClear(model,point,ray,view,receiver=-1){
    if(ray.segments){
      for(const segment of ray.segments){if(segment.from.z<=point.z+1e-7)continue;const from=segment.from,to=segment.to.z<point.z?point:segment.to,len=Math.hypot(from.x-to.x,from.y-to.y,from.z-to.z);
        for(const s of model.solids){if(s.cameraIgnored||view?.fadeFor(s.id)>=1)continue;const h=interval(s,to,from,0);if(h&&h.exit>(s.index===receiver?.03/len:1e-7)&&h.enter<1)return false;}}
      return true;
    }
    const len=Math.hypot(ray.from.x-point.x,ray.from.y-point.y,ray.from.z-point.z);
    for(const s of model.solids){if(s.cameraIgnored||view?.fadeFor(s.id)>=1)continue;const h=interval(s,point,ray.from,0);if(h&&h.exit>(s.index===receiver?.03/len:1e-7)&&h.enter<1)return false;}return true;
  }
  function cylinderInterval(p,ray){
    const r=p.radius||p.shape?.radius;if(!(r>0)||!(p.height>0))return null;
    const x=ray.from.x-p.x,y=ray.from.y-p.y,dx=ray.to.x-ray.from.x,dy=ray.to.y-ray.from.y,dz=ray.to.z-ray.from.z,a=dx*dx+dy*dy,b=2*(x*dx+y*dy),c=x*x+y*y-r*r;
    let lo=0,hi=1;if(a<1e-12){if(c>0)return null;}else{const d=b*b-4*a*c;if(d<0)return null;lo=Math.max(lo,(-b-Math.sqrt(d))/(2*a));hi=Math.min(hi,(-b+Math.sqrt(d))/(2*a));}
    if(Math.abs(dz)<1e-12){if(ray.from.z<p.z||ray.from.z>p.z+p.height)return null;}else{const x=(p.z-ray.from.z)/dz,y=(p.z+p.height-ray.from.z)/dz;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}return lo<=hi?{enter:lo,exit:hi}:null;
  }
  function pick(model,{screen,camera,eye,width,height,view,actors=[],zoom=1,exclude=null}){
    const scope=footprint(width,height,camera,zoom),ray=pickingRay(screen,camera,scope.scale),hits=[],planar=topDownCamera(camera);
    // Top-down: the displayed fragment under the cursor, mapped to its exact
    // physical point, still has to be seen by the eye. Bands pick their face.
    if(planar){const s=displayedSurface(model,ray.from.x,ray.from.y,camera,eye,view);
      if(s&&s.solid.visible&&within(s.point,scope)&&visible(model,eye,s.point,s.solid.index))hits.push({kind:'face',primitiveId:s.solid.id,presentation:s.kind,t:(ray.from.z-s.depth)/(ray.from.z-ray.to.z),point:s.point});}
    for(const segment of ray.segments||[ray]){
    const at=t=>Object.fromEntries(['x','y','z'].map(k=>[k,segment.from[k]+(segment.to[k]-segment.from[k])*t]));
    const add=(t,data,receiver=-1)=>{if(t<0||t>1)return;const point=at(t);if(within(point,scope)&&visible(model,eye,point,receiver)&&cameraClear(model,point,ray,view,receiver))hits.push({...data,t:ray.segments?(ray.from.z-point.z)/(ray.from.z-ray.to.z):t,point});};
    if(!planar)for(const s of model.solids){if(!s.visible||s.cameraIgnored||view?.fadeFor(s.id)>=1)continue;const h=interval(s,segment.from,segment.to,0);if(h){add(h.enter,{kind:'face',primitiveId:s.id},s.index);add(h.exit,{kind:'face',primitiveId:s.id},s.index);}}
    for(const p of actors){if(p.id===exclude||p.observable===false||!within(p,scope)||!['player','peer','hound','smiler','body','hand:0','hand:1','light','hat','replay','item','exit'].includes(p.kind))continue;const offset=p.renderOffset||0,k=relativeScale(p,camera),visual=k===1?{...p,z:p.z+offset}:{...p,z:p.z+offset,radius:(p.radius||p.shape?.radius)*k},h=cylinderInterval(visual,segment);if(h)for(const t of [h.enter,h.exit]){
      // Relative scale is presentation only: the hit maps back to the body.
      const presentationPoint=at(t),point=k===1?{...presentationPoint,z:presentationPoint.z-offset}:{x:p.x+(presentationPoint.x-p.x)/k,y:p.y+(presentationPoint.y-p.y)/k,z:presentationPoint.z-offset};
      if(within(point,scope)&&visible(model,eye,point)&&cameraClear(model,presentationPoint,ray,view))hits.push({kind:'actor',actorId:p.id,t:ray.segments?(ray.from.z-presentationPoint.z)/(ray.from.z-ray.to.z):t,point,presentationPoint});
    }}
    }
    hits.sort((a,b)=>a.t-b.t||(a.actorId||a.primitiveId).localeCompare(b.actorId||b.primitiveId));
    // A fully faded group stops blocking the CAMERA only. Every candidate's
    // eye ray above still sees every physical solid, so fading grants no hit.
    const result=hits[0]||{kind:'plane',point:onPlane(screen,eye.z,camera,scope.scale)};
    return {...result,distance:Math.hypot(result.point.x-eye.x,result.point.y-eye.y,result.point.z-eye.z),ray,scope};
  }
  class LocalView {
    constructor(model,epoch='fixture:1'){this.model=model;this.epoch=epoch;this.focusSpace=[];this.groups=new Map(model.groups.map(g=>[g.id,{fade:0,target:false}]));this.solidGroups=new Map(model.solids.map(s=>[s.id,model.groups.filter(g=>g.solids.some(q=>q.id===s.id)).map(g=>g.id)]));}
    reset(epoch){this.epoch=epoch;this.focusSpace=[];for(const s of this.groups.values()){s.fade=0;s.target=false;}}
    update(focus,dt,{epoch=this.epoch,enabled=true,elevationScale,camera=null}={}){
      // A top-down camera probes straight up; legacy fixtures keep their oblique e.
      elevationScale=elevationScale??camera?.elevation??ELEVATION;
      if(epoch!==this.epoch)this.reset(epoch);
      this.focus={...focus};this.focusSpace=this.model.definition.spaces.filter(s=>focus.x>=s.bounds.min.x&&focus.x<=s.bounds.max.x&&focus.y>=s.bounds.min.y&&focus.y<=s.bounds.max.y&&focus.z>=s.bounds.min.z&&focus.z<=s.bounds.max.z).map(s=>s.id).sort();
      const center={x:focus.x,y:focus.y,z:focus.z+30},toward=p=>({x:p.x,y:p.y+elevationScale*4096,z:p.z+4096});
      // Depth and top-down cameras probe the body itself (a crawler's head is
      // below a 28-unit roof); a top-down probe then rises straight up.
      const probe=camera?.depth||topDownCamera(camera)?[1,(focus.height||60)/2,(focus.height||60)-1].flatMap(z=>[0,-(focus.radius||15),focus.radius||15].map(x=>({x:focus.x+x,y:focus.y,z:focus.z+z}))):[center];
      const probeRays=probe.map(p=>({point:p,ray:camera?.depth?pickingRay(project(p,camera,1,elevationScale),camera,1,elevationScale):null}));
      const under=s=>{
        // Local eligibility is physical XY overlap plus headroom below the
        // actual underside; an oblique camera ray from outside grants nothing.
        const radius=focus.radius||15,h=focus.height||60;
        if(focus.z+h>zAt(s.lower,focus)+.1)return false;
        return s.footprint.every((a,i)=>{const b=s.footprint[(i+1)%s.footprint.length],dx=b.x-a.x,dy=b.y-a.y;return dx*(focus.y-a.y)-dy*(focus.x-a.x)>=-radius*Math.hypot(dx,dy);});
      };
      for(const g of this.model.groups){const state=this.groups.get(g.id),eligible=g.kind==='legacyCutaway'||g.solids.some(under);
        const obstructed=eligible&&g.solids.some(s=>probeRays.some(({point:p,ray})=>{if(!ray){const t=interval(s,p,toward(p),state.target?4:0);return t&&t.exit>0&&t.enter>1e-6;}
          return ray.segments.some(r=>{if(r.from.z<=p.z)return false;const from=r.to.z<p.z?p:r.to,t=interval(s,from,r.from,state.target?4:0);return t&&t.exit>0&&t.enter>1e-6;});}));
        state.target=enabled&&obstructed;const step=Math.max(0,Math.min(.25,dt))/(state.target?.15:.25);state.fade=state.target?Math.min(1,state.fade+step):Math.max(0,state.fade-step);
      }
      return this.snapshot();
    }
    fadeFor(id){let v=0;for(const key of this.solidGroups.get(id)||[])v=Math.max(v,this.groups.get(key).fade);return v;}
    snapshot(){return {worldEpoch:this.epoch,continuousInterior:this.model.continuousInterior,ignoredCeilings:this.model.ignoredCeilings.length,focus:{...this.focus},focusSpace:this.focusSpace.slice(),groups:Array.from(this.groups,([id,s])=>({id,...s}))};}
  }
  const vertexShader=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;layout(location=3) in vec2 aBand;
  uniform vec3 uCamera,uEye;uniform vec2 uViewport,uFaceN,uFaceZ;uniform float uScale,uElevation,uDepth,uBand,uLayer;uniform int uKind,uTopDown,uSurfBand;
  out vec3 vWorld;out vec3 vNormal;out vec2 vUV;
  // Top-down bands: a vertical-face vertex keeps its PHYSICAL position (masks,
  // light, scope) and is only displaced on screen by its unit offset times this
  // solid's band width, on a depth layer lifted aBand.x above the solid's top.
  // Faces turned away from the eye are culled (the cap shows there instead).
  void main(){vec3 p=aPosition-uCamera;vec2 shift=vec2(0.);float d=(uElevation*p.y+p.z)/sqrt(1.+uElevation*uElevation);vWorld=aPosition;vNormal=aNormal;vUV=aUV;
    if(uTopDown==1&&uKind==0&&abs(aNormal.z)<.5){if(dot(aNormal.xy,uEye.xy-aPosition.xy)<-.01){gl_Position=vec4(2.,2.,2.,1.);return;}shift=aUV*uBand;d=uLayer+aBand.x-uCamera.z;vWorld.xy+=vec2(-aNormal.y,aNormal.x)*aBand.y;}
    else if(uSurfBand==1){shift=-uFaceN*uBand*clamp((aPosition.z-uFaceZ.x)/max(uFaceZ.y-uFaceZ.x,.001),0.,1.);d=uLayer+.55-uCamera.z;}
    vec2 q=uScale*vec2(p.x+shift.x,p.y+shift.y-uElevation*p.z);float w=uDepth>0.?clamp(1.-uDepth*p.z,${1/1.06},${1/.94}):1.;gl_Position=vec4(2.*q.x/uViewport.x,-2.*q.y/uViewport.y,-d/4096.,w);}`;
  const fragmentShader=`#version 300 es
  precision highp float;precision highp int;
  in vec3 vWorld;in vec3 vNormal;in vec2 vUV;out vec4 outColor;
  uniform sampler2D uSolids,uArt,uLights,uCandidates;uniform int uSolidColumns,uBatchCount,uCount,uReceiver,uKind,uLightCount,uLighting,uNV;
  uniform vec4 uFailures[64];uniform int uFailCount;uniform vec3 uEye;uniform vec4 uScope,uTint,uProxy;uniform float uFade,uTop,uSensorGain,uBloom,uEmission,uPoseOffset;uniform int uSurface,uTopDown;
  vec4 solidData(int column,int index){return texelFetch(uSolids,ivec2((index%uSolidColumns)*10+column,index/uSolidColumns),0);}
  bool rayClear(vec3 source,vec3 p,int channel){vec3 delta=p-source;float len=length(delta);if(len<.000001)return true;
    vec3 rayMin=min(p,source),rayMax=max(p,source);
    for(int batch=0;batch<uBatchCount;batch++)for(int slot=0;slot<${MAX_SOLIDS};slot++){int ordinal=batch*${MAX_SOLIDS}+slot;if(ordinal>=uCount)break;int i=int(texelFetch(uCandidates,ivec2(slot,batch),0).r);vec4 lo=solidData(0,i),hi=solidData(1,i);if((int(hi.w)&channel)==0)continue;
      if(any(lessThan(rayMax,lo.xyz-vec3(${BOUNDARY})))||any(greaterThan(rayMin,hi.xyz+vec3(${BOUNDARY}))))continue;
      float enter=0.,leave=1.;bool hit=true;
      for(int j=0;j<${MAX_PLANES};j++){if(j>=int(lo.w))break;vec4 n=solidData(j+2,i);float a=dot(n.xyz,source)-n.w-(i==uReceiver?0.:${BOUNDARY}),b=dot(n.xyz,delta);if(abs(b)<.0000001){if(a>0.){hit=false;break;}}else if(b<0.)enter=max(enter,-a/b);else leave=min(leave,-a/b);if(enter>leave){hit=false;break;}}
      float endpoint=i==uReceiver?.03/len:0.;if(hit&&leave>.000001&&enter<1.-endpoint)return false;
    }return true;
  }
  vec3 illumination(vec3 p){
    if(uLighting==0)return vec3(1.);
    vec3 visible=vec3(.04);float ir=0.;
    for(int i=0;i<uLightCount;i++){
      vec4 o=texelFetch(uLights,ivec2(0,i),0),d=texelFetch(uLights,ivec2(1,i),0),c=texelFetch(uLights,ivec2(2,i),0),cfg=texelFetch(uLights,ivec2(3,i),0);
      bool infrared=cfg.x>1.5;if(infrared&&uNV==0)continue;
      vec3 delta=p-o.xyz;float dist=length(delta);if(dist>=o.w)continue;
      if(d.w<6.28){float yaw=atan(delta.y,delta.x)-atan(d.y,d.x),pitch=atan(delta.z,length(delta.xy))-atan(d.z,length(d.xy));if(abs(atan(sin(yaw),cos(yaw)))>d.w*.5||abs(pitch)>d.w*.5)continue;}
      if(!rayClear(o.xyz,p,infrared?2:1))continue;
      float strength=cfg.y*(1.-smoothstep(cfg.z,o.w,dist));if(cfg.w>.5)for(int k=0;k<64;k++){if(k>=uFailCount)break;if(length(p-uFailures[k].xyz)<uFailures[k].w)strength*=.06;}
      if(infrared)ir=max(ir,strength);else visible=max(visible,vec3(.04)+c.rgb*strength*2.08);
    }
    if(uNV==1){float v=max(min(.9,max(visible.r,max(visible.g,visible.b))*uSensorGain),ir);v*=1.-.7*uBloom*smoothstep(120.,300.,length(p-uEye));return vec3(.55,1.,.62)*v;}
    return min(vec3(1.),visible);
  }
  void main(){if(uSurface==1){vec4 lo=solidData(0,uReceiver);for(int j=0;j<8;j++){if(j>=int(lo.w))break;vec4 n=solidData(j+2,uReceiver);if(dot(n.xyz,vWorld)-n.w>.08)discard;}}
    if(vWorld.x<uScope.x||vWorld.y<uScope.y||vWorld.x>uScope.z||vWorld.y>uScope.w)discard;
    vec4 art=uKind==1?texture(uArt,vUV):vec4(1.);if(art.a<.15)discard;
    // ALL physical occluders participate, including every faded camera group.
    vec3 query=vWorld-vec3(0.,0.,uPoseOffset);
    // Production billboards query their physical cylinder, never fabricated
    // elevations caused by the camera-facing art plane. Labels stay at their
    // own world point and also require an observable physical owner.
    if(uProxy.z>=0.){vec2 d=query.xy-uProxy.xy;float n=length(d);if(n>uProxy.z)query.xy=uProxy.xy+d*(uProxy.z/n);query.z=clamp(query.z,uProxy.w,uTop);}
    bool inSight=rayClear(uEye,query,1);
    // Unseen opaque geometry still blocks the camera. Only eligible cutaway may remove it.
    if(!inSight&&uKind!=0)discard;
    // Stable screen-door fade, no blend-order shortcut or translucent depth leak.
    const int bayer[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    ivec2 cell=ivec2(gl_FragCoord.xy)&3;if((float(bayer[cell.y*4+cell.x])+.5)/16.<uFade)discard;
    if(!inSight){outColor=vec4(0.,0.,0.,1.);return;}
    float shade=uKind==0?.55+.45*abs(dot(normalize(vNormal),normalize(vec3(-.35,-.5,1.)))):1.;
    vec3 lit=illumination(query);if(uEmission>0.&&max(art.r,max(art.g,art.b))>.7)lit=max(lit,vec3(.85));vec3 color=uTint.rgb*art.rgb*shade*lit;
    if(uKind==0){if(uTopDown==0||vNormal.z>.5){vec2 g=abs(fract(vWorld.xy/48.)-.5);if(min(g.x,g.y)<.012)color*=.86;}
      // Top-down wall face: the floor crease reads darker than the top edge.
      if(uTopDown==1&&abs(vNormal.z)<.5){vec4 lo=solidData(0,uReceiver),hi=solidData(1,uReceiver);color*=.74+.26*clamp((vWorld.z-lo.z)/max(1.,hi.z-lo.z),0.,1.);}}
    outColor=vec4(inSight?color:vec3(0.),1.);
  }`;
  function program(gl){const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const vs=shader(gl.VERTEX_SHADER,vertexShader),fs=shader(gl.FRAGMENT_SHADER,fragmentShader),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  function color(id,material){if(material==='material:wet')return [.28,.33,.28,1];if(material==='material:deep')return [.32,.27,.18,1];if(material==='material:carpet'&&(id.includes('ground')||id.includes('wall')))return id.includes('ground')?[.39,.37,.23,1]:[.59,.55,.32,1];if(id.includes('tread'))return [.65,.52,.30,1];if(id.includes('upper'))return [.57,.52,.35,1];if(id.includes('ramp'))return [.54,.60,.49,1];if(id.includes('ground')||id.includes('platform'))return [.39,.37,.29,1];return [.48,.47,.41,1];}
  class SpatialPass {
    // Pixi owns the context and original-art extraction; this isolated canvas then
    // belongs to this pass until dispose. Never interleave unsynchronized Pixi draws.
    constructor(renderer,model,art){
      const gl=renderer.gl;if(!gl||typeof gl.texStorage2D!=='function')throw Error('Stage D requires WebGL2; production Level 0 remains available');
      this.renderer=renderer;this.gl=gl;this.model=model;this.canvas=renderer.canvas;this.program=program(gl);this.uniforms={};
      for(const n of ['Candidates','BatchCount','SolidColumns','Camera','Viewport','Scale','Elevation','Depth','PoseOffset','Solids','Art','Count','Receiver','Kind','Eye','Scope','Tint','Fade','Proxy','Top','Lights','LightCount','Lighting','NV','Surface','SensorGain','Bloom','Emission','Failures[0]','FailCount','TopDown','Band','Layer','SurfBand','FaceN','FaceZ'])this.uniforms[n]=gl.getUniformLocation(this.program,'u'+n);
      const makeVAO=(data,band=false)=>{const vao=gl.createVertexArray(),buffer=gl.createBuffer(),stride=band?40:32;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);for(const [i,n,offset]of [[0,3,0],[1,3,12],[2,2,24],...(band?[[3,2,32]]:[])]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,stride,offset);}return {vao,buffer};};
      // Attribute 3 exists only in the top-down band mesh and is read only there.
      this.world=makeVAO(new Float32Array(model.vertices));this.proxy=makeVAO(new Float32Array(48));this.planar=makeVAO(new Float32Array(model.planarVertices),true);
      this.maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);this.solidColumns=Math.max(1,Math.ceil(model.solids.length/this.maxTexture));this.solidRows=Math.max(1,Math.ceil(model.solids.length/this.solidColumns));if(this.solidColumns*10>this.maxTexture)throw Error('Spatial geometry exceeds device texture capacity; no geometry omitted');const data=new Float32Array(this.solidColumns*this.solidRows*40);for(const s of model.solids){data.set([s.min.x,s.min.y,s.min.z,s.planes.length,s.max.x,s.max.y,s.max.z,(+s.visible+2*(+s.ir)),...s.planes.flat()],s.index*40);}
      // Pixi extraction leaves pixel-store state behind. Geometry data must NEVER be premultiplied.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      this.solidTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.solidTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,this.solidColumns*10,this.solidRows,0,gl.RGBA,gl.FLOAT,data);this.textureParams();
      this.candidateTexture=gl.createTexture();this.candidateRows=Math.max(1,Math.ceil(model.solids.length/MAX_SOLIDS));if(this.candidateRows>this.maxTexture)throw Error('Spatial batch index exceeds device capacity; no occluders omitted');gl.bindTexture(gl.TEXTURE_2D,this.candidateTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,MAX_SOLIDS,this.candidateRows,0,gl.RED,gl.FLOAT,new Float32Array(MAX_SOLIDS*this.candidateRows));this.textureParams();
      this.art=[];for(const canvas of art){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);this.textureParams();this.art.push({tex,width:canvas.width/2,height:canvas.height/2,bytes:canvas.width*canvas.height*4});}
      this.lightCapacity=128;this.lightTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.lightTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,128,0,gl.RGBA,gl.FLOAT,new Float32Array(128*16));this.textureParams();
      this.fbo=gl.createFramebuffer();this.color=gl.createTexture();this.depth=gl.createRenderbuffer();this.staticBytes=8192+MAX_SOLIDS*this.candidateRows*4+data.byteLength+model.vertices.length*4+model.planarVertices.length*4+this.art.reduce((a,b)=>a+b.bytes,0);this.target={width:0,height:0};
    }
    textureParams(){const gl=this.gl;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    resize(width,height,dpr=1,quality=1){this.width=Math.max(1,width);this.height=Math.max(1,height);this.dpr=dpr;this.quality=quality===.5?.5:1;const resolution=Math.min(Math.max(1,dpr),Math.sqrt(MAX_PIXELS/(this.width*this.height)))*this.quality;const w=Math.max(1,Math.floor(this.width*resolution)),h=Math.max(1,Math.floor(this.height*resolution));this.canvas.style.width=this.width+'px';this.canvas.style.height=this.height+'px';if(w===this.target.width&&h===this.target.height)return;this.canvas.width=w;this.canvas.height=h;const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.bindTexture(gl.TEXTURE_2D,this.color);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.textureParams();gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.color,0);gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete Stage D depth target');this.target={width:w,height:h};}
    quad(actor,e,kind,scale=1){if(actor.surface){const {point,basis,normal,width,height}=actor.surface,v=[];for(const [u,t]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const x=(u-.5)*width,y=(t-.5)*height;v.push(...['x','y','z'].map(k=>point[k]+basis.u[k]*x+basis.v[k]*y+normal[k]*.04),normal.x,normal.y,normal.z,u,t);}return new Float32Array(v);}const art=this.art[actor.art||0],w=(kind===2?22:art.width)*scale,h=(kind===2?6:art.height)*scale,origin={x:actor.x,y:actor.y,z:actor.z+(actor.renderOffset||0)+(kind===2?(actor.height||60)-3:(actor.height||60)/2)},v=[];for(const [u,t]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const x=(u-.5)*w,y=(t-.5)*h;v.push(origin.x+x,origin.y+y/(1+e*e),origin.z-e*y/(1+e*e),0,e,1,u,t);}return new Float32Array(v);}
    render({camera,eye,view,actors=[],overlays=[],elevationScale,reverse=false,lights=null,nv=false,sensorGain=1.45,bloom=0,failures=[],zoom=1}){
      const planar=topDownCamera(camera);elevationScale=elevationScale??camera.elevation??(planar?0:ELEVATION);
      const gl=this.gl,u=this.uniforms,scope=footprint(this.width,this.height,camera,zoom);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);
      // Conservative light and solid broad phase. Every eye/receiver and light/receiver
      // segment lies in this hull; cutaway never participates in candidate selection.
      const allLights=lights;lights=lights&&lights.filter(l=>Math.hypot(Math.max(scope.minX-l.origin.x,0,l.origin.x-scope.maxX),Math.max(scope.minY-l.origin.y,0,l.origin.y-scope.maxY))<=l.range);
      const bounds=this.model.definition.bounds,min={x:Math.min(scope.minX,eye.x),y:Math.min(scope.minY,eye.y),z:Math.min(bounds.min.z,eye.z)},max={x:Math.max(scope.maxX,eye.x),y:Math.max(scope.maxY,eye.y),z:Math.max(bounds.max.z,eye.z)};for(const l of lights||[])for(const k of ['x','y','z']){min[k]=Math.min(min[k],l.origin[k]);max[k]=Math.max(max[k],l.origin[k]);}const selected=candidates(this.model,min,max),batchCount=Math.ceil(selected.length/MAX_SOLIDS);const indices=new Float32Array(MAX_SOLIDS*this.candidateRows);indices.set(selected);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.target.width,this.target.height);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.disable(gl.STENCIL_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      gl.uniform3f(u.Camera,camera.x,camera.y,camera.z);gl.uniform3f(u.Eye,eye.x,eye.y,eye.z);gl.uniform2f(u.Viewport,this.width,this.height);gl.uniform1f(u.Scale,scope.scale);gl.uniform1f(u.Elevation,elevationScale);gl.uniform1f(u.Depth,camera.depth?DEPTH.coefficient:0);gl.uniform1i(u.TopDown,planar?1:0);gl.uniform1i(u.SurfBand,0);gl.uniform1f(u.Band,0);gl.uniform1f(u.Layer,0);gl.uniform4f(u.Scope,scope.minX,scope.minY,scope.maxX,scope.maxY);gl.uniform1i(u.Count,selected.length);gl.uniform1i(u.BatchCount,batchCount);gl.uniform1i(u.SolidColumns,this.solidColumns);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.candidateTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,MAX_SOLIDS,this.candidateRows,gl.RED,gl.FLOAT,indices);gl.uniform1i(u.Candidates,3);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.solidTexture);gl.uniform1i(u.Solids,0);gl.uniform1i(u.Art,1);
      // No sampled texture may alias the active color attachment, even in an untaken shader branch.
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.art[0].tex);
      if(lights&&lights.length>this.maxTexture)throw Error('Spatial light texture exceeds device capacity; cannot omit emitters');this.lightCapacity=Math.max(128,lights?.length||0);
      const lightData=new Float32Array(this.lightCapacity*16);for(const [i,l]of (lights||[]).entries())lightData.set([l.origin.x,l.origin.y,l.origin.z,l.range,l.direction.x,l.direction.y,l.direction.z,l.arc,...(l.color||[1,1,1]),0,l.channel==='ir'?2:1,l.power,l.near||24,l.kind==='lamp'?1:0],i*16);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.lightTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,this.lightCapacity,0,gl.RGBA,gl.FLOAT,lightData);gl.uniform1i(u.Lights,2);gl.uniform1i(u.LightCount,lights?.length||0);gl.uniform1i(u.Lighting,lights?1:0);gl.uniform1i(u.NV,nv?1:0);gl.uniform1i(u.Surface,0);gl.uniform1f(u.Emission,0);gl.uniform1f(u.SensorGain,sensorGain);gl.uniform1f(u.Bloom,bloom);if(failures.length>64)throw Error('Spatial lamp-failure capacity exceeded');gl.uniform1i(u.FailCount,failures.length);const failData=new Float32Array(256);failures.forEach((f,i)=>failData.set([f.x,f.y,f.z,f.r],i*4));gl.uniform4fv(u['Failures[0]'],failData);
      gl.uniform1f(u.PoseOffset,0);let draws=0,bands=null;const scales={};gl.uniform1i(u.Kind,0);gl.uniform4f(u.Proxy,0,0,-1,0);gl.uniform1f(u.Top,0);
      if(planar){
        // Static orthographic mesh: caps at their exact footprints plus local face
        // bands. Only per-solid band widths change with the smoothed camera Z.
        gl.bindVertexArray(this.planar.vao);bands={quads:0,eyeFacing:0,culled:0,widths:{},joins:{convex:0,concave:0,square:0}};
        const packets=reverse?this.model.planarPackets.slice().reverse():this.model.planarPackets;
        for(const p of packets){if(p.cameraIgnored||p.max.x<scope.minX||p.min.x>scope.maxX||p.max.y<scope.minY||p.min.y>scope.maxY)continue;const s=this.model.solids[p.index],w=bandWidth(s,camera);
          gl.uniform1i(u.Receiver,p.index);gl.uniform1f(u.Fade,view?view.fadeFor(p.id):0);gl.uniform4fv(u.Tint,color(p.id,p.materialId));gl.uniform1f(u.Band,w);gl.uniform1f(u.Layer,s.max.z);gl.drawArrays(gl.TRIANGLES,p.first,p.count);draws++;
          for(const b of s.bands){bands.quads++;if(facingAway(b,eye))bands.culled++;else bands.eyeFacing++;bands.joins[b.joina]++;bands.joins[b.joinb]++;}if(s.bands.length)bands.widths[s.zBand.join('..')]=w;}
      }else{
      gl.bindVertexArray(this.world.vao);
      const projectionKey=camera.depth?camera.z:'flat';
      if(this.projectionKey!==projectionKey){
        const data=[],cuts=depthBreaks(camera);this.projectedPackets=[];
        for(const p of this.model.packets){const source=this.model.vertices.slice(p.first*8,(p.first+p.count)*8),mesh=cuts.some(z=>p.min.z<z&&p.max.z>z)?clipDepthTriangles(source,camera):source;
          this.projectedPackets.push({...p,first:data.length/8,count:mesh.length/8});for(const v of mesh)data.push(v);}
        gl.bindBuffer(gl.ARRAY_BUFFER,this.world.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);this.projectionKey=projectionKey;this.projectedVertexBytes=data.length*4;
      }
      const packets=reverse?this.projectedPackets.slice().reverse():this.projectedPackets;
      for(const p of packets){if(p.cameraIgnored||p.max.x<scope.minX||p.min.x>scope.maxX||p.max.y<scope.minY||p.min.y>scope.maxY)continue;gl.uniform1i(u.Receiver,p.index);gl.uniform1f(u.Fade,view?view.fadeFor(p.id):0);gl.uniform4fv(u.Tint,color(p.id,p.materialId));gl.drawArrays(gl.TRIANGLES,p.first,p.count);draws++;}
      }
      const proxy=(actor,kind)=>{if(actor.observable===false||!within(actor,scope))return;
        // Wall-mounted art follows its face's band; a face turned away is unseen.
        let surfBand=0;if(planar&&actor.surface&&Math.abs(actor.surface.normal.z)<.5){const s=this.model.solids.find(q=>q.id===actor.surface.primitiveId),b=s&&surfaceBand(s,actor.surface);if(!b||facingAway(b,eye))return;
          const at=actor.surface.point;gl.uniform2f(u.FaceN,b.normal.x,b.normal.y);gl.uniform2f(u.FaceZ,zAt(s.lower,at),zAt(s.upper,at));gl.uniform1f(u.Band,bandWidth(s,camera));gl.uniform1f(u.Layer,s.max.z);surfBand=1;}
        gl.uniform1i(u.SurfBand,surfBand);const scale=kind===1&&!actor.surface?relativeScale(actor,camera):1;if(scale!==1||RELATIVE.includes(actor.kind))scales[actor.id]=scale;
        gl.bindVertexArray(this.proxy.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.proxy.buffer);const mesh=clipDepthTriangles(this.quad(actor,elevationScale,kind,scale),camera);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.DYNAMIC_DRAW);gl.uniform1i(u.Kind,kind);gl.uniform1f(u.PoseOffset,actor.renderOffset||0);gl.uniform1f(u.Emission,actor.emissive?1:0);gl.uniform4f(u.Proxy,actor.x,actor.y,Number.isFinite(actor.visibilityRadius)?actor.visibilityRadius:-1,actor.z+.01);gl.uniform1f(u.Top,actor.z+(actor.height||60)-.01);gl.uniform1i(u.Receiver,actor.surface?this.model.solids.findIndex(s=>s.id===actor.surface.primitiveId):-1);gl.uniform1i(u.Surface,actor.surface?1:0);gl.uniform1f(u.Fade,0);gl.uniform4fv(u.Tint,kind===2?[1,.1,.85,1]:[1,1,1,1]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.art[actor.art||0].tex);gl.drawArrays(gl.TRIANGLES,0,mesh.length/8);draws++;};
      for(const a of reverse?actors.slice().reverse():actors)proxy(a,1);
      // An annotation submitted LAST still passes both physical and camera depth.
      for(const a of overlays)proxy(a,2);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,this.target.width,this.target.height,0,0,this.target.width,this.target.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
      this.last={scope,zoom,ignoredContinuousCeilings:this.model.ignoredCeilings.length,projection:{mode:planar?'top-down':camera.depth?'layer-depth':'oblique',elevation:elevationScale,enabled:!!camera.depth,coefficient:DEPTH.coefficient,minScale:DEPTH.minScale,maxScale:DEPTH.maxScale,vertexBytes:planar?this.model.planarVertices.length*4:this.projectedVertexBytes,anchorZ:Number.isFinite(camera.anchorZ)?camera.anchorZ:null,band:planar?{...BAND}:null,bands,relativeScales:scales},lightCount:lights?.length||0,lighting:!!lights,nv,drawCalls:draws,passes:2,physicalVisibility:'exact convex rays across every deterministic 64-solid candidate batch',geometryChunks:Object.keys(this.model.chunks).length,candidateOccluders:selected.length,occluderBatches:batchCount,submittedCandidateIds:selected.map(i=>this.model.solids[i].id),totalLightCount:allLights?.length||0,occluders:this.model.solids.filter(s=>s.visible).length,triangles:(planar?this.model.planarVertices.length/30:this.model.vertices.length/24)+actors.length*2+overlays.length*2,target:{...this.target,depth:'DEPTH_COMPONENT24',color:'RGBA8'},logical:{width:this.width,height:this.height,dpr:this.dpr},quality:this.quality,newResourceBytes:this.staticBytes+this.target.width*this.target.height*8,actorTextureBytes:this.art.slice(1).reduce((n,a)=>n+a.bytes,0),lightTextureBytes:this.lightCapacity*64,defaultColorBytesEstimate:this.target.width*this.target.height*4,eye:{...eye},camera:{...camera},elevationScale,cutaway:view?.snapshot()};return this.last;
    }
    pixels(){const gl=this.gl,b=new Uint8Array(this.target.width*this.target.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.fbo);gl.readPixels(0,0,this.target.width,this.target.height,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;}
    dispose(){const g=this.gl;for(const o of [this.world,this.proxy,this.planar]){g.deleteBuffer(o.buffer);g.deleteVertexArray(o.vao);}for(const t of [this.solidTexture,this.candidateTexture,this.lightTexture,this.color,...this.art.filter(x=>!x.borrowed).map(x=>x.tex)])g.deleteTexture(t);g.deleteFramebuffer(this.fbo);g.deleteRenderbuffer(this.depth);g.deleteProgram(this.program);}
  }
  return Object.freeze({DEPTH,BAND,RELATIVE,denominator,layerScale,depthBreaks,clipDepthTriangles,CameraElevation,ActorElevation,ELEVATION,MAX_SOLIDS,MAX_PLANES,MAX_PIXELS,BOUNDARY,project,depth,onPlane,footprint,within,freeze,compile,candidates,interval,visible,pickingRay,cameraClear,cylinderInterval,pick,LocalView,SpatialPass,
    topDownCamera,magnification,bandWidth,presentedZ,relativeScale,facingAway,bandMesh,displayedSurface,surfaceBand});
});
