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
  function footprint(width,height,camera){const v=cameraPolicy.visibleWorld(width,height);return {...v,minX:camera.x-v.width/2,maxX:camera.x+v.width/2,minY:camera.y-v.height/2,maxY:camera.y+v.height/2};}
  function within(p,box){return p.x>=box.minX&&p.x<=box.maxX&&p.y>=box.minY&&p.y<=box.maxY;}
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
  const zAt=(plane,p)=>plane.a*p.x+plane.b*p.y+plane.c;
  function normalPlane(x,y,z,d){const n=Math.hypot(x,y,z);return [x/n,y/n,z/n,d/n];}
  function compile(definition){
    // Own presentation data; never freeze or annotate the caller's world object.
    definition=JSON.parse(JSON.stringify(definition));
    if(definition.geometryMode!=='spatial')throw Error('Stage D backend accepts spatial fixtures only; Level 0 keeps its existing fast path');
    if(definition.solids.length>MAX_SOLIDS)throw Error('Stage D bounded visibility capacity exceeded; never drop occluders');
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
      packets.push({id:s.id,index,first,count:vertices.length/8-first,min,max});
      return {id:s.id,index,planes,min,max,visible:!!s.channels.visible};
    });
    const groups=(definition.viewGroups||[]).filter(g=>g.cutawayEligible===true).slice().sort((a,b)=>a.id.localeCompare(b.id)).map(g=>({id:g.id,solids:solids.filter(s=>g.solidIds.includes(s.id))}));
    return freeze({solids,groups,packets,vertices,definition});
  }
  // Convex segment clipping. Expanding occluders is conservative at thin edges.
  function interval(s,from,to,margin=0){let enter=0,exit=1;for(const n of s.planes){const a=n[0]*from.x+n[1]*from.y+n[2]*from.z-n[3]-margin,b=n[0]*(to.x-from.x)+n[1]*(to.y-from.y)+n[2]*(to.z-from.z);if(Math.abs(b)<1e-9){if(a>0)return null;}else if(b<0)enter=Math.max(enter,-a/b);else exit=Math.min(exit,-a/b);if(enter>exit)return null;}return {enter,exit};}
  function visible(model,eye,point,receiver=-1){const len=Math.hypot(point.x-eye.x,point.y-eye.y,point.z-eye.z);if(len<1e-6)return true;for(const s of model.solids){if(!s.visible)continue;const t=interval(s,eye,point,s.index===receiver?0:BOUNDARY);if(t&&t.exit>1e-6&&t.enter<1-(s.index===receiver?.03/len:0))return false;}return true;}
  class LocalView {
    constructor(model,epoch='fixture:1'){this.model=model;this.epoch=epoch;this.focusSpace=[];this.groups=new Map(model.groups.map(g=>[g.id,{fade:0,target:false}]));}
    reset(epoch){this.epoch=epoch;this.focusSpace=[];for(const s of this.groups.values()){s.fade=0;s.target=false;}}
    update(focus,dt,{epoch=this.epoch,enabled=true,elevationScale=ELEVATION}={}){
      if(epoch!==this.epoch)this.reset(epoch);
      this.focus={...focus};this.focusSpace=this.model.definition.spaces.filter(s=>focus.x>=s.bounds.min.x&&focus.x<=s.bounds.max.x&&focus.y>=s.bounds.min.y&&focus.y<=s.bounds.max.y&&focus.z>=s.bounds.min.z&&focus.z<=s.bounds.max.z).map(s=>s.id).sort();
      const center={x:focus.x,y:focus.y,z:focus.z+30},end={x:center.x,y:center.y+elevationScale*4096,z:center.z+4096};
      for(const g of this.model.groups){const state=this.groups.get(g.id);const obstructed=g.solids.some(s=>{const t=interval(s,center,end,state.target?4:0);return t&&t.exit>0&&t.enter>1e-6;});state.target=enabled&&obstructed;const step=Math.max(0,Math.min(.25,dt))/(state.target?.15:.25);state.fade=state.target?Math.min(1,state.fade+step):Math.max(0,state.fade-step);}
      return this.snapshot();
    }
    fadeFor(id){let v=0;for(const g of this.model.groups)if(g.solids.some(s=>s.id===id))v=Math.max(v,this.groups.get(g.id).fade);return v;}
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
  uniform sampler2D uSolids,uArt;uniform int uCount,uReceiver,uKind;
  uniform vec3 uEye;uniform vec4 uScope,uTint;uniform float uFade;
  bool physical(vec3 p){vec3 delta=p-uEye;float len=length(delta);if(len<.000001)return true;
    vec3 rayMin=min(p,uEye),rayMax=max(p,uEye);
    for(int i=0;i<${MAX_SOLIDS};i++){if(i>=uCount)break;vec4 lo=texelFetch(uSolids,ivec2(0,i),0),hi=texelFetch(uSolids,ivec2(1,i),0);if(hi.w<.5)continue;
      if(any(lessThan(rayMax,lo.xyz-vec3(${BOUNDARY})))||any(greaterThan(rayMin,hi.xyz+vec3(${BOUNDARY}))))continue;
      float enter=0.,leave=1.;bool hit=true;
      for(int j=0;j<${MAX_PLANES};j++){if(j>=int(lo.w))break;vec4 n=texelFetch(uSolids,ivec2(j+2,i),0);float a=dot(n.xyz,uEye)-n.w-(i==uReceiver?0.:${BOUNDARY}),b=dot(n.xyz,delta);if(abs(b)<.0000001){if(a>0.){hit=false;break;}}else if(b<0.)enter=max(enter,-a/b);else leave=min(leave,-a/b);if(enter>leave){hit=false;break;}}
      float endpoint=i==uReceiver?.03/len:0.;if(hit&&leave>.000001&&enter<1.-endpoint)return false;
    }return true;
  }
  void main(){if(vWorld.x<uScope.x||vWorld.y<uScope.y||vWorld.x>uScope.z||vWorld.y>uScope.w)discard;
    vec4 art=uKind==1?texture(uArt,vUV):vec4(1.);if(art.a<.15)discard;
    // ALL physical occluders participate, including every faded camera group.
    bool inSight=physical(vWorld);
    // Unseen opaque geometry still blocks the camera. Only eligible cutaway may remove it.
    if(!inSight&&uKind!=0)discard;
    // Stable screen-door fade, no blend-order shortcut or translucent depth leak.
    const int bayer[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    ivec2 cell=ivec2(gl_FragCoord.xy)&3;if((float(bayer[cell.y*4+cell.x])+.5)/16.<uFade)discard;
    float shade=uKind==0?.55+.45*abs(dot(normalize(vNormal),normalize(vec3(-.35,-.5,1.)))):1.;
    vec3 color=uTint.rgb*art.rgb*shade;
    if(uKind==0){vec2 g=abs(fract(vWorld.xy/48.)-.5);if(min(g.x,g.y)<.012)color*=.86;}
    outColor=vec4(inSight?color:vec3(0.),1.);
  }`;
  function program(gl){const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const vs=shader(gl.VERTEX_SHADER,vertexShader),fs=shader(gl.FRAGMENT_SHADER,fragmentShader),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  function color(id){if(id.includes('tread'))return [.65,.52,.30,1];if(id.includes('upper'))return [.57,.52,.35,1];if(id.includes('ramp'))return [.54,.60,.49,1];if(id.includes('ground')||id.includes('platform'))return [.39,.37,.29,1];return [.48,.47,.41,1];}
  class SpatialPass {
    // Pixi owns the context and original-art extraction; this isolated canvas then
    // belongs to this pass until dispose. Never interleave unsynchronized Pixi draws.
    constructor(renderer,model,art){
      const gl=renderer.gl;if(!gl||typeof gl.texStorage2D!=='function')throw Error('Stage D requires WebGL2; production Level 0 remains available');
      this.renderer=renderer;this.gl=gl;this.model=model;this.canvas=renderer.canvas;this.program=program(gl);this.uniforms={};
      for(const n of ['Camera','Viewport','Scale','Elevation','Solids','Art','Count','Receiver','Kind','Eye','Scope','Tint','Fade'])this.uniforms[n]=gl.getUniformLocation(this.program,'u'+n);
      const makeVAO=data=>{const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);for(const [i,n,offset]of [[0,3,0],[1,3,12],[2,2,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,32,offset);}return {vao,buffer};};
      this.world=makeVAO(new Float32Array(model.vertices));this.proxy=makeVAO(new Float32Array(48));
      const data=new Float32Array(model.solids.length*10*4);for(const s of model.solids){data.set([s.min.x,s.min.y,s.min.z,s.planes.length,s.max.x,s.max.y,s.max.z,+s.visible,...s.planes.flat()],s.index*40);}
      // Pixi extraction leaves pixel-store state behind. Geometry data must NEVER be premultiplied.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      this.solidTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.solidTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,10,model.solids.length,0,gl.RGBA,gl.FLOAT,data);this.textureParams();
      this.art=[];for(const canvas of art){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);this.textureParams();this.art.push({tex,width:canvas.width/2,height:canvas.height/2,bytes:canvas.width*canvas.height*4});}
      this.fbo=gl.createFramebuffer();this.color=gl.createTexture();this.depth=gl.createRenderbuffer();this.staticBytes=data.byteLength+model.vertices.length*4+this.art.reduce((a,b)=>a+b.bytes,0);this.target={width:0,height:0};
    }
    textureParams(){const gl=this.gl;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    resize(width,height,dpr=1,quality=1){this.width=Math.max(1,width);this.height=Math.max(1,height);this.dpr=dpr;this.quality=quality===.5?.5:1;const resolution=Math.min(Math.max(1,dpr),Math.sqrt(MAX_PIXELS/(this.width*this.height)))*this.quality;const w=Math.max(1,Math.floor(this.width*resolution)),h=Math.max(1,Math.floor(this.height*resolution));this.canvas.style.width=this.width+'px';this.canvas.style.height=this.height+'px';if(w===this.target.width&&h===this.target.height)return;this.canvas.width=w;this.canvas.height=h;const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.bindTexture(gl.TEXTURE_2D,this.color);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.textureParams();gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.color,0);gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete Stage D depth target');this.target={width:w,height:h};}
    quad(actor,e,kind){const art=this.art[actor.art||0],w=kind===2?22:art.width,h=kind===2?6:art.height,origin={x:actor.x,y:actor.y,z:actor.z+(kind===2?(actor.height||60)-3:(actor.height||60)/2)},v=[];for(const [u,t]of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const x=(u-.5)*w,y=(t-.5)*h;v.push(origin.x+x,origin.y+y/(1+e*e),origin.z-e*y/(1+e*e),0,e,1,u,t);}return new Float32Array(v);}
    render({camera,eye,view,actors=[],overlays=[],elevationScale=ELEVATION,reverse=false}){
      const gl=this.gl,u=this.uniforms,scope=footprint(this.width,this.height,camera);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.target.width,this.target.height);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.disable(gl.STENCIL_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      gl.uniform3f(u.Camera,camera.x,camera.y,camera.z);gl.uniform3f(u.Eye,eye.x,eye.y,eye.z);gl.uniform2f(u.Viewport,this.width,this.height);gl.uniform1f(u.Scale,scope.scale);gl.uniform1f(u.Elevation,elevationScale);gl.uniform4f(u.Scope,scope.minX,scope.minY,scope.maxX,scope.maxY);gl.uniform1i(u.Count,this.model.solids.length);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.solidTexture);gl.uniform1i(u.Solids,0);gl.uniform1i(u.Art,1);
      // No sampled texture may alias the active color attachment, even in an untaken shader branch.
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.art[0].tex);
      let draws=0;gl.bindVertexArray(this.world.vao);gl.uniform1i(u.Kind,0);
      const packets=reverse?this.model.packets.slice().reverse():this.model.packets;
      for(const p of packets){if(p.max.x<scope.minX||p.min.x>scope.maxX||p.max.y<scope.minY||p.min.y>scope.maxY)continue;gl.uniform1i(u.Receiver,p.index);gl.uniform1f(u.Fade,view?view.fadeFor(p.id):0);gl.uniform4fv(u.Tint,color(p.id));gl.drawArrays(gl.TRIANGLES,p.first,p.count);draws++;}
      const proxy=(actor,kind)=>{if(!within(actor,scope))return;gl.bindVertexArray(this.proxy.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.proxy.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.quad(actor,elevationScale,kind),gl.DYNAMIC_DRAW);gl.uniform1i(u.Kind,kind);gl.uniform1i(u.Receiver,-1);gl.uniform1f(u.Fade,0);gl.uniform4fv(u.Tint,kind===2?[1,.1,.85,1]:[1,1,1,1]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.art[actor.art||0].tex);gl.drawArrays(gl.TRIANGLES,0,6);draws++;};
      for(const a of reverse?actors.slice().reverse():actors)proxy(a,1);
      // An annotation submitted LAST still passes both physical and camera depth.
      for(const a of overlays)proxy(a,2);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,this.target.width,this.target.height,0,0,this.target.width,this.target.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
      this.last={scope,drawCalls:draws,passes:2,physicalVisibility:'exact bounded per-fragment convex rays',occluders:this.model.solids.filter(s=>s.visible).length,triangles:this.model.vertices.length/24+actors.length*2+overlays.length*2,target:{...this.target,depth:'DEPTH_COMPONENT24',color:'RGBA8'},logical:{width:this.width,height:this.height,dpr:this.dpr},quality:this.quality,newResourceBytes:this.staticBytes+this.target.width*this.target.height*8,defaultColorBytesEstimate:this.target.width*this.target.height*4,eye:{...eye},camera:{...camera},elevationScale,cutaway:view?.snapshot()};return this.last;
    }
    pixels(){const gl=this.gl,b=new Uint8Array(this.target.width*this.target.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.fbo);gl.readPixels(0,0,this.target.width,this.target.height,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;}
    dispose(){const g=this.gl;for(const o of [this.world,this.proxy]){g.deleteBuffer(o.buffer);g.deleteVertexArray(o.vao);}for(const t of [this.solidTexture,this.color,...this.art.map(x=>x.tex)])g.deleteTexture(t);g.deleteFramebuffer(this.fbo);g.deleteRenderbuffer(this.depth);g.deleteProgram(this.program);}
  }
  return Object.freeze({ELEVATION,MAX_SOLIDS,MAX_PLANES,MAX_PIXELS,BOUNDARY,project,depth,onPlane,footprint,within,freeze,compile,interval,visible,LocalView,SpatialPass});
});
