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
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  function project(p,camera,scale,e=ELEVATION){return {x:scale*(p.x-camera.x),y:scale*((p.y-camera.y)-e*(p.z-camera.z))};}
  function depth(p,camera,e=ELEVATION){return (e*(p.y-camera.y)+(p.z-camera.z))/Math.sqrt(1+e*e);}
  function onPlane(screen,z,camera,scale,e=ELEVATION){return {x:screen.x/scale+camera.x,y:screen.y/scale+camera.y+e*(z-camera.z),z};}
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
      packets.push({id:s.id,index,first,count:vertices.length/8-first,min,max,materialId:s.materialId});
      return {id:s.id,index,planes,min,max,visible:!!s.channels.visible,ir:!!s.channels.ir};
    });
    const groups=(definition.viewGroups||[]).filter(g=>g.cutawayEligible===true).slice().sort((a,b)=>a.id.localeCompare(b.id)).map(g=>({id:g.id,solids:solids.filter(s=>g.solidIds.includes(s.id))}));
    const chunks={};for(const s of solids){for(let y=Math.floor(s.min.y/768);y<=Math.floor(s.max.y/768);y++)for(let x=Math.floor(s.min.x/768);x<=Math.floor(s.max.x/768);x++){const key=x+','+y;(chunks[key]||(chunks[key]=[])).push(s.index);}}
    return freeze({solids,groups,packets,vertices,definition,chunks});
  }
  // Convex segment clipping. Expanding occluders is conservative at thin edges.
  function interval(s,from,to,margin=0){let enter=0,exit=1;for(const n of s.planes){const a=n[0]*from.x+n[1]*from.y+n[2]*from.z-n[3]-margin,b=n[0]*(to.x-from.x)+n[1]*(to.y-from.y)+n[2]*(to.z-from.z);if(Math.abs(b)<1e-9){if(a>0)return null;}else if(b<0)enter=Math.max(enter,-a/b);else exit=Math.min(exit,-a/b);if(enter>exit)return null;}return {enter,exit};}
  function candidates(model,min,max){const ids=new Set();for(let y=Math.floor(min.y/768);y<=Math.floor(max.y/768);y++)for(let x=Math.floor(min.x/768);x<=Math.floor(max.x/768);x++)for(const i of model.chunks[x+','+y]||[])ids.add(i);return [...ids].sort((a,b)=>a-b).filter(i=>{const s=model.solids[i];return ['x','y','z'].every(k=>s.max[k]>=min[k]-BOUNDARY&&s.min[k]<=max[k]+BOUNDARY);});}
  function visible(model,eye,point,receiver=-1){const len=Math.hypot(point.x-eye.x,point.y-eye.y,point.z-eye.z);if(len<1e-6)return true;for(const i of candidates(model,{x:Math.min(eye.x,point.x),y:Math.min(eye.y,point.y),z:Math.min(eye.z,point.z)},{x:Math.max(eye.x,point.x),y:Math.max(eye.y,point.y),z:Math.max(eye.z,point.z)})){const s=model.solids[i];if(!s.visible)continue;const t=interval(s,eye,point,s.index===receiver?0:BOUNDARY);if(t&&t.exit>1e-6&&t.enter<1-(s.index===receiver?.03/len:0))return false;}return true;}
  function pickingRay(screen,camera,scale,e=ELEVATION){
    const p=onPlane(screen,camera.z,camera,scale,e),n=Math.hypot(e,1),v={x:0,y:e/n,z:1/n},d=depth(p,camera,e);
    const at=t=>({x:p.x+v.x*t,y:p.y+v.y*t,z:p.z+v.z*t});
    return {from:at(4096-d),to:at(-4096-d)};
  }
  function cameraClear(model,point,ray,view,receiver=-1){
    const len=Math.hypot(ray.from.x-point.x,ray.from.y-point.y,ray.from.z-point.z);
    for(const s of model.solids){if(view?.fadeFor(s.id)>=1)continue;const h=interval(s,point,ray.from,0);if(h&&h.exit>(s.index===receiver?.03/len:1e-7)&&h.enter<1)return false;}return true;
  }
  function cylinderInterval(p,ray){
    const r=p.radius||p.shape?.radius;if(!(r>0)||!(p.height>0))return null;
    const x=ray.from.x-p.x,y=ray.from.y-p.y,dx=ray.to.x-ray.from.x,dy=ray.to.y-ray.from.y,dz=ray.to.z-ray.from.z,a=dx*dx+dy*dy,b=2*(x*dx+y*dy),c=x*x+y*y-r*r;
    let lo=0,hi=1;if(a<1e-12){if(c>0)return null;}else{const d=b*b-4*a*c;if(d<0)return null;lo=Math.max(lo,(-b-Math.sqrt(d))/(2*a));hi=Math.min(hi,(-b+Math.sqrt(d))/(2*a));}
    if(Math.abs(dz)<1e-12){if(ray.from.z<p.z||ray.from.z>p.z+p.height)return null;}else{const x=(p.z-ray.from.z)/dz,y=(p.z+p.height-ray.from.z)/dz;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}return lo<=hi?{enter:lo,exit:hi}:null;
  }
  function pick(model,{screen,camera,eye,width,height,view,actors=[],zoom=1,exclude=null}){
    const scope=footprint(width,height,camera,zoom),ray=pickingRay(screen,camera,scope.scale),at=t=>Object.fromEntries(['x','y','z'].map(k=>[k,ray.from[k]+(ray.to[k]-ray.from[k])*t])),hits=[];
    const add=(t,data,receiver=-1)=>{if(t<0||t>1)return;const point=at(t);if(within(point,scope)&&visible(model,eye,point,receiver)&&cameraClear(model,point,ray,view,receiver))hits.push({...data,t,point});};
    for(const s of model.solids){if(!s.visible||view?.fadeFor(s.id)>=1)continue;const h=interval(s,ray.from,ray.to,0);if(h){add(h.enter,{kind:'face',primitiveId:s.id},s.index);add(h.exit,{kind:'face',primitiveId:s.id},s.index);}}
    for(const p of actors){if(p.id===exclude||p.observable===false||!within(p,scope)||!['player','peer','hound','smiler','body','hand:0','hand:1','light','hat','replay','item','exit'].includes(p.kind))continue;const h=cylinderInterval(p,ray);if(h){add(h.enter,{kind:'actor',actorId:p.id});add(h.exit,{kind:'actor',actorId:p.id});}}
    hits.sort((a,b)=>a.t-b.t||(a.actorId||a.primitiveId).localeCompare(b.actorId||b.primitiveId));
    // A fully faded group stops blocking the CAMERA only. Every candidate's
    // eye ray above still sees every physical solid, so fading grants no hit.
    const result=hits[0]||{kind:'plane',point:onPlane(screen,eye.z,camera,scope.scale)};
    return {...result,distance:Math.hypot(result.point.x-eye.x,result.point.y-eye.y,result.point.z-eye.z),ray,scope};
  }
  class LocalView {
    constructor(model,epoch='fixture:1'){this.model=model;this.epoch=epoch;this.focusSpace=[];this.groups=new Map(model.groups.map(g=>[g.id,{fade:0,target:false}]));this.solidGroups=new Map(model.solids.map(s=>[s.id,model.groups.filter(g=>g.solids.some(q=>q.id===s.id)).map(g=>g.id)]));}
    reset(epoch){this.epoch=epoch;this.focusSpace=[];for(const s of this.groups.values()){s.fade=0;s.target=false;}}
    update(focus,dt,{epoch=this.epoch,enabled=true,elevationScale=ELEVATION}={}){
      if(epoch!==this.epoch)this.reset(epoch);
      this.focus={...focus};this.focusSpace=this.model.definition.spaces.filter(s=>focus.x>=s.bounds.min.x&&focus.x<=s.bounds.max.x&&focus.y>=s.bounds.min.y&&focus.y<=s.bounds.max.y&&focus.z>=s.bounds.min.z&&focus.z<=s.bounds.max.z).map(s=>s.id).sort();
      const center={x:focus.x,y:focus.y,z:focus.z+30},end={x:center.x,y:center.y+elevationScale*4096,z:center.z+4096};
      for(const g of this.model.groups){const state=this.groups.get(g.id);const obstructed=g.solids.some(s=>{const t=interval(s,center,end,state.target?4:0);return t&&t.exit>0&&t.enter>1e-6;});state.target=enabled&&obstructed;const step=Math.max(0,Math.min(.25,dt))/(state.target?.15:.25);state.fade=state.target?Math.min(1,state.fade+step):Math.max(0,state.fade-step);}
      return this.snapshot();
    }
    fadeFor(id){let v=0;for(const key of this.solidGroups.get(id)||[])v=Math.max(v,this.groups.get(key).fade);return v;}
    snapshot(){return {worldEpoch:this.epoch,focus:{...this.focus},focusSpace:this.focusSpace.slice(),groups:Array.from(this.groups,([id,s])=>({id,...s}))};}
  }
  const vertexShader=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;
  uniform vec3 uCamera;uniform vec2 uViewport;uniform float uScale,uElevation;
  out vec3 vWorld;out vec3 vNormal;out vec2 vUV;
  void main(){vec3 p=aPosition-uCamera;vec2 q=uScale*vec2(p.x,p.y-uElevation*p.z);float d=(uElevation*p.y+p.z)/sqrt(1.+uElevation*uElevation);gl_Position=vec4(2.*q.x/uViewport.x,-2.*q.y/uViewport.y,-d/4096.,1.);vWorld=aPosition;vNormal=aNormal;vUV=aUV;}`;
  const fragmentShader=`#version 300 es
  precision highp float;precision highp int;
  in vec3 vWorld;in vec3 vNormal;in vec2 vUV;out vec4 outColor;
  uniform sampler2D uSolids,uArt,uLights,uCandidates;uniform int uSolidColumns,uBatchCount,uCount,uReceiver,uKind,uLightCount,uLighting,uNV;
  uniform vec4 uFailures[64];uniform int uFailCount;uniform vec3 uEye;uniform vec4 uScope,uTint,uProxy;uniform float uFade,uTop,uSensorGain,uBloom,uEmission;uniform int uSurface;
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
    vec3 query=vWorld;
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
    if(uKind==0){vec2 g=abs(fract(vWorld.xy/48.)-.5);if(min(g.x,g.y)<.012)color*=.86;}
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
      for(const n of ['Candidates','BatchCount','SolidColumns','Camera','Viewport','Scale','Elevation','Solids','Art','Count','Receiver','Kind','Eye','Scope','Tint','Fade','Proxy','Top','Lights','LightCount','Lighting','NV','Surface','SensorGain','Bloom','Emission','Failures[0]','FailCount'])this.uniforms[n]=gl.getUniformLocation(this.program,'u'+n);
      const makeVAO=data=>{const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);for(const [i,n,offset]of [[0,3,0],[1,3,12],[2,2,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,32,offset);}return {vao,buffer};};
      this.world=makeVAO(new Float32Array(model.vertices));this.proxy=makeVAO(new Float32Array(48));
      this.maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);this.solidColumns=Math.max(1,Math.ceil(model.solids.length/this.maxTexture));this.solidRows=Math.max(1,Math.ceil(model.solids.length/this.solidColumns));if(this.solidColumns*10>this.maxTexture)throw Error('Spatial geometry exceeds device texture capacity; no geometry omitted');const data=new Float32Array(this.solidColumns*this.solidRows*40);for(const s of model.solids){data.set([s.min.x,s.min.y,s.min.z,s.planes.length,s.max.x,s.max.y,s.max.z,(+s.visible+2*(+s.ir)),...s.planes.flat()],s.index*40);}
      // Pixi extraction leaves pixel-store state behind. Geometry data must NEVER be premultiplied.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      this.solidTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.solidTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,this.solidColumns*10,this.solidRows,0,gl.RGBA,gl.FLOAT,data);this.textureParams();
      this.candidateTexture=gl.createTexture();this.candidateRows=Math.max(1,Math.ceil(model.solids.length/MAX_SOLIDS));if(this.candidateRows>this.maxTexture)throw Error('Spatial batch index exceeds device capacity; no occluders omitted');gl.bindTexture(gl.TEXTURE_2D,this.candidateTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,MAX_SOLIDS,this.candidateRows,0,gl.RED,gl.FLOAT,new Float32Array(MAX_SOLIDS*this.candidateRows));this.textureParams();
      this.art=[];for(const canvas of art){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);this.textureParams();this.art.push({tex,width:canvas.width/2,height:canvas.height/2,bytes:canvas.width*canvas.height*4});}
      this.lightCapacity=128;this.lightTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.lightTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,128,0,gl.RGBA,gl.FLOAT,new Float32Array(128*16));this.textureParams();
      this.fbo=gl.createFramebuffer();this.color=gl.createTexture();this.depth=gl.createRenderbuffer();this.staticBytes=8192+MAX_SOLIDS*this.candidateRows*4+data.byteLength+model.vertices.length*4+this.art.reduce((a,b)=>a+b.bytes,0);this.target={width:0,height:0};
    }
    textureParams(){const gl=this.gl;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    resize(width,height,dpr=1,quality=1){this.width=Math.max(1,width);this.height=Math.max(1,height);this.dpr=dpr;this.quality=quality===.5?.5:1;const resolution=Math.min(Math.max(1,dpr),Math.sqrt(MAX_PIXELS/(this.width*this.height)))*this.quality;const w=Math.max(1,Math.floor(this.width*resolution)),h=Math.max(1,Math.floor(this.height*resolution));this.canvas.style.width=this.width+'px';this.canvas.style.height=this.height+'px';if(w===this.target.width&&h===this.target.height)return;this.canvas.width=w;this.canvas.height=h;const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.bindTexture(gl.TEXTURE_2D,this.color);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.textureParams();gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.color,0);gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete Stage D depth target');this.target={width:w,height:h};}
    quad(actor,e,kind){if(actor.surface){const {point,basis,normal,width,height}=actor.surface,v=[];for(const [u,t]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const x=(u-.5)*width,y=(t-.5)*height;v.push(...['x','y','z'].map(k=>point[k]+basis.u[k]*x+basis.v[k]*y+normal[k]*.04),normal.x,normal.y,normal.z,u,t);}return new Float32Array(v);}const art=this.art[actor.art||0],w=kind===2?22:art.width,h=kind===2?6:art.height,origin={x:actor.x,y:actor.y,z:actor.z+(kind===2?(actor.height||60)-3:(actor.height||60)/2)},v=[];for(const [u,t]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const x=(u-.5)*w,y=(t-.5)*h;v.push(origin.x+x,origin.y+y/(1+e*e),origin.z-e*y/(1+e*e),0,e,1,u,t);}return new Float32Array(v);}
    render({camera,eye,view,actors=[],overlays=[],elevationScale=ELEVATION,reverse=false,lights=null,nv=false,sensorGain=1.45,bloom=0,failures=[],zoom=1}){
      const gl=this.gl,u=this.uniforms,scope=footprint(this.width,this.height,camera,zoom);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);
      // Conservative light and solid broad phase. Every eye/receiver and light/receiver
      // segment lies in this hull; cutaway never participates in candidate selection.
      const allLights=lights;lights=lights&&lights.filter(l=>Math.hypot(Math.max(scope.minX-l.origin.x,0,l.origin.x-scope.maxX),Math.max(scope.minY-l.origin.y,0,l.origin.y-scope.maxY))<=l.range);
      const bounds=this.model.definition.bounds,min={x:Math.min(scope.minX,eye.x),y:Math.min(scope.minY,eye.y),z:Math.min(bounds.min.z,eye.z)},max={x:Math.max(scope.maxX,eye.x),y:Math.max(scope.maxY,eye.y),z:Math.max(bounds.max.z,eye.z)};for(const l of lights||[])for(const k of ['x','y','z']){min[k]=Math.min(min[k],l.origin[k]);max[k]=Math.max(max[k],l.origin[k]);}const selected=candidates(this.model,min,max),batchCount=Math.ceil(selected.length/MAX_SOLIDS);const indices=new Float32Array(MAX_SOLIDS*this.candidateRows);indices.set(selected);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.target.width,this.target.height);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.disable(gl.STENCIL_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      gl.uniform3f(u.Camera,camera.x,camera.y,camera.z);gl.uniform3f(u.Eye,eye.x,eye.y,eye.z);gl.uniform2f(u.Viewport,this.width,this.height);gl.uniform1f(u.Scale,scope.scale);gl.uniform1f(u.Elevation,elevationScale);gl.uniform4f(u.Scope,scope.minX,scope.minY,scope.maxX,scope.maxY);gl.uniform1i(u.Count,selected.length);gl.uniform1i(u.BatchCount,batchCount);gl.uniform1i(u.SolidColumns,this.solidColumns);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.candidateTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,MAX_SOLIDS,this.candidateRows,gl.RED,gl.FLOAT,indices);gl.uniform1i(u.Candidates,3);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.solidTexture);gl.uniform1i(u.Solids,0);gl.uniform1i(u.Art,1);
      // No sampled texture may alias the active color attachment, even in an untaken shader branch.
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.art[0].tex);
      if(lights&&lights.length>this.maxTexture)throw Error('Spatial light texture exceeds device capacity; cannot omit emitters');this.lightCapacity=Math.max(128,lights?.length||0);
      const lightData=new Float32Array(this.lightCapacity*16);for(const [i,l]of (lights||[]).entries())lightData.set([l.origin.x,l.origin.y,l.origin.z,l.range,l.direction.x,l.direction.y,l.direction.z,l.arc,...(l.color||[1,1,1]),0,l.channel==='ir'?2:1,l.power,l.near||24,l.kind==='lamp'?1:0],i*16);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.lightTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,this.lightCapacity,0,gl.RGBA,gl.FLOAT,lightData);gl.uniform1i(u.Lights,2);gl.uniform1i(u.LightCount,lights?.length||0);gl.uniform1i(u.Lighting,lights?1:0);gl.uniform1i(u.NV,nv?1:0);gl.uniform1i(u.Surface,0);gl.uniform1f(u.Emission,0);gl.uniform1f(u.SensorGain,sensorGain);gl.uniform1f(u.Bloom,bloom);if(failures.length>64)throw Error('Spatial lamp-failure capacity exceeded');gl.uniform1i(u.FailCount,failures.length);const failData=new Float32Array(256);failures.forEach((f,i)=>failData.set([f.x,f.y,f.z,f.r],i*4));gl.uniform4fv(u['Failures[0]'],failData);
      let draws=0;gl.bindVertexArray(this.world.vao);gl.uniform1i(u.Kind,0);gl.uniform4f(u.Proxy,0,0,-1,0);gl.uniform1f(u.Top,0);
      const packets=reverse?this.model.packets.slice().reverse():this.model.packets;
      for(const p of packets){if(p.max.x<scope.minX||p.min.x>scope.maxX||p.max.y<scope.minY||p.min.y>scope.maxY)continue;gl.uniform1i(u.Receiver,p.index);gl.uniform1f(u.Fade,view?view.fadeFor(p.id):0);gl.uniform4fv(u.Tint,color(p.id,p.materialId));gl.drawArrays(gl.TRIANGLES,p.first,p.count);draws++;}
      const proxy=(actor,kind)=>{if(actor.observable===false||!within(actor,scope))return;gl.bindVertexArray(this.proxy.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.proxy.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.quad(actor,elevationScale,kind),gl.DYNAMIC_DRAW);gl.uniform1i(u.Kind,kind);gl.uniform1f(u.Emission,actor.emissive?1:0);gl.uniform4f(u.Proxy,actor.x,actor.y,Number.isFinite(actor.visibilityRadius)?actor.visibilityRadius:-1,actor.z+.01);gl.uniform1f(u.Top,actor.z+(actor.height||60)-.01);gl.uniform1i(u.Receiver,actor.surface?this.model.solids.findIndex(s=>s.id===actor.surface.primitiveId):-1);gl.uniform1i(u.Surface,actor.surface?1:0);gl.uniform1f(u.Fade,0);gl.uniform4fv(u.Tint,kind===2?[1,.1,.85,1]:[1,1,1,1]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.art[actor.art||0].tex);gl.drawArrays(gl.TRIANGLES,0,6);draws++;};
      for(const a of reverse?actors.slice().reverse():actors)proxy(a,1);
      // An annotation submitted LAST still passes both physical and camera depth.
      for(const a of overlays)proxy(a,2);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,this.target.width,this.target.height,0,0,this.target.width,this.target.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
      this.last={scope,zoom,lightCount:lights?.length||0,lighting:!!lights,nv,drawCalls:draws,passes:2,physicalVisibility:'exact convex rays across every deterministic 64-solid candidate batch',geometryChunks:Object.keys(this.model.chunks).length,candidateOccluders:selected.length,occluderBatches:batchCount,submittedCandidateIds:selected.map(i=>this.model.solids[i].id),totalLightCount:allLights?.length||0,occluders:this.model.solids.filter(s=>s.visible).length,triangles:this.model.vertices.length/24+actors.length*2+overlays.length*2,target:{...this.target,depth:'DEPTH_COMPONENT24',color:'RGBA8'},logical:{width:this.width,height:this.height,dpr:this.dpr},quality:this.quality,newResourceBytes:this.staticBytes+this.target.width*this.target.height*8,actorTextureBytes:this.art.slice(1).reduce((n,a)=>n+a.bytes,0),lightTextureBytes:this.lightCapacity*64,defaultColorBytesEstimate:this.target.width*this.target.height*4,eye:{...eye},camera:{...camera},elevationScale,cutaway:view?.snapshot()};return this.last;
    }
    pixels(){const gl=this.gl,b=new Uint8Array(this.target.width*this.target.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.fbo);gl.readPixels(0,0,this.target.width,this.target.height,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;}
    dispose(){const g=this.gl;for(const o of [this.world,this.proxy]){g.deleteBuffer(o.buffer);g.deleteVertexArray(o.vao);}for(const t of [this.solidTexture,this.candidateTexture,this.lightTexture,this.color,...this.art.filter(x=>!x.borrowed).map(x=>x.tex)])g.deleteTexture(t);g.deleteFramebuffer(this.fbo);g.deleteRenderbuffer(this.depth);g.deleteProgram(this.program);}
  }
  return Object.freeze({ELEVATION,MAX_SOLIDS,MAX_PLANES,MAX_PIXELS,BOUNDARY,project,depth,onPlane,footprint,within,freeze,compile,candidates,interval,visible,pickingRay,cameraClear,cylinderInterval,pick,LocalView,SpatialPass});
});
