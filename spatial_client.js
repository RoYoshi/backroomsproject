/* Production adapter for the existing Pixi application and world_view pass.
 * The host selects the immutable world. This module owns presentation only;
 * movement, replication and aftermath continue through accepted C/F/G modules.
 */
(() => {
  'use strict';
  const V = window.TFB_VIEW;
  const clone = x => JSON.parse(JSON.stringify(x));
  let A, R, P, geometry, model, view, pass, artEpoch;
  const art = new Map(), labelArt = new Map();
  const audioSequences = new Map();
  const config = { cutaway: true, quality: 1, camera: null, focus: null, labels: false };
  const state = { ready: false, frames: 0, dt: 0, time: 0, started: false, lightOn: false, packets: [], trace: [] };
  function spawn() {
    const p = geometry.definition.anchors.find(a => a.kind === 'spawn');
    if (!p) throw Error('Spatial world has no spawn anchor');
    return geometry ? { ...p.position, z: p.position?.z ?? p.z, x: p.position?.x ?? p.x, y: p.position?.y ?? p.y } : null;
  }
  function bind(api, renderer, pixi) {
    A = api; R = renderer; P = pixi;
    geometry = window.TFB_GEOMETRY.compile(window.TFB_WORLD);
    model = V.compile(geometry.definition);
    A.spatialMotion = window.TFB_MOTION.motorAdapter(geometry);
    A.spatialMotion.motion.initialize(Object.assign(A.H, spawn()));
    view = new V.LocalView(model, 'connecting');
    A.worldGeometry = geometry;
  }
  async function init() {
    R.app.stop(); R.app.resizeTo = null;
    // The original renderer remains the sole owner. Each frame has an explicit
    // Pixi-to-owned-pass boundary, with every renderer cache reset on return.
    R.resize();
    const blank = document.createElement('canvas'); blank.width = blank.height = 2;
    pass = new V.SpatialPass(R.app.renderer, model, [blank]);
    R.spatial = api;
    R.camera = { ...spawn() };
    document.body.dataset.worldMode = 'spatial';
    // These planar world layers are replaced by packets in the spatial pass.
    // Screen HUD remains on the existing page; no alternate application exists.
    const css = document.createElement('style');
    css.textContent = ['mp','light','peerTip','aiDebug','glitchFx'].map(id => 'body[data-world-mode="spatial"] #' + id).join(',') + '{display:none!important}';
    document.head.appendChild(css);
    // The planar debug renderer cannot submit an unmasked secondary canvas.
    // Its existing switch enables depth-tested actor labels in this pass.
    const debug = window.__ents?.drawDebug;
    if (debug) window.__ents.drawDebug = function (...args) {
      if (window.TFB_WORLD) return;
      return debug.apply(this, args);
    };
    state.ready = true;
  }
  function prepare(dt, started, lightOn, time) {
    Object.assign(state, { dt, started, lightOn, time });
  }
  function entry(id, kind, look, gear) {
    let e = art.get(id);
    if (!e || e.kind !== kind) {
      if (e) { e.texture?.destroy(true); e.wrap.destroy({ children: true }); }
      const display = kind === 'graphic' ? new P.Graphics() : kind === 'hound' ? new A.Wl() : kind === 'smiler' ? new A.Gl({ off: false }) : A.mkAvatar(look || A.look, gear || A.H.equipment);
      const wrap = new P.Container(); wrap.addChild(display);
      e = { kind, display, wrap, size: kind === 'hound' ? 256 : 128 };
      art.set(id, e);
    }
    e.used = state.frames;
    return e;
  }
  function texture(e) {
    const r = R.app.renderer, size = e.size;
    if (!e.texture) e.texture = r.generateTexture({ target: e.wrap, frame: new P.Rectangle(-size / 2, -size / 2, size, size), resolution: 1 });
    else r.render({ container: e.wrap, target: e.texture, transform: new P.Matrix().translate(size / 2, size / 2), clearColor: [0, 0, 0, 0] });
    return { tex: r.texture.getGlSource(e.texture.source).texture, width: size, height: size, bytes: size * size * 4, borrowed: true };
  }
  function livePacket(id, kind, pose, data, look, gear) {
    if (!pose || !['x', 'y', 'z'].every(k => Number.isFinite(pose[k]))) return null;
    const e = entry(id, kind, look, gear), d = e.display;
    const p = { ...data, ...pose, angle: pose.yaw ?? pose.a ?? data.angle ?? 0, distance: data.distance || 0 };
    if (kind === 'hound') {
      d.g = p; window.__ents.drawHound(d, p, state.time, state.dt);
      d.rotation = p.angle + Math.PI / 2;
    } else if (kind === 'smiler') {
      window.__ents.drawSmiler(d, p, state.time, state.dt, 1);
      d.rotation = p.angle + Math.PI / 2;
    } else {
      d.look = look || A.look; d.lightGear = gear || A.H.equipment;
      d.update(state.time, data.lightOn ?? state.lightOn, false, p);
    }
    d.position.set(0, 0); d.visible = true; d.alpha = 1;
    const slot = pass.art.length; pass.art.push(texture(e));
    const shape = pose.shape || geometry.definition.colliderProfiles.find(s => s.id === pose.profile);
    const packet = { id, kind, x: pose.x, y: pose.y, z: pose.z, height: pose.height || shape?.height || 60, radius: shape?.radius || 15, art: slot, support: pose.support ?? pose.supportId, mode: pose.mode ?? pose.motionMode, tick: pose.tick, generation: pose.generation };
    // A camera-facing art rectangle is not a physical body. It may extend
    // below a slab even when its owner's entire physical volume is above it.
    packet.emissive = kind === 'hound' || kind === 'smiler'; packet.observable = perceivable(packet); packet.visibilityRadius = packet.radius;
    return packet;
  }
  function eyePoint() {
    const own = A.G.caught && window.__spatialAftermath?.get(A.H.id)?.spatial;
    if (own) return {x:own.state.body.x,y:own.state.body.y,z:own.state.body.z+9};
    const p = A.H;
    return { x: p.x, y: p.y, z: p.z + (window.TFB_MOTION.PROFILES[p.posture || 'stand']?.eyeHeight || 50) };
  }
  function perceivable(p) {
    if (!p || !['x','y','z'].every(k => Number.isFinite(p[k]))) return false;
    const shape = p.shape || geometry.definition.colliderProfiles.find(s => s.id === p.profile);
    const eye = eyePoint(), h = p.height || shape?.height || 60, r = (p.radius || shape?.radius || 0) * .7;
    return [1,h / 2,h - 1].some(z => [[0,0],[r,0],[-r,0],[0,r],[0,-r]].some(([x,y]) => V.visible(model, eye, { x: p.x + x, y: p.y + y, z: p.z + z })));
  }
  function sample(id) { return window.__spatialHistory?.()?.sample(id, performance.now()); }
  function adminData(d) {
    if (!d) return d;
    const pl = d.pl.filter(p => p.id === A.H.id || perceivable(sample('p' + p.id)));
    const es = (d.es || []).filter(e => perceivable(sample((e[1] ? 'm' : 'h') + e[0])));
    return { ...d, pl, es, hn: es.filter(e => !e[1]).length, sn: es.filter(e => e[1]).length };
  }
  function label(packet, text) {
    if (packet.observable === false || !perceivable(packet)) return null;
    let a = labelArt.get(text); const gl = pass.gl;
    if (!a) {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 32;
      const c = canvas.getContext('2d'); c.font = '24px ui-monospace,monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(1,3,254,26); c.fillStyle = '#e8e2bf'; c.fillText(text.slice(0,30),128,16);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas); pass.textureParams();
      a = { tex, width: 192, height: 24, bytes: 256 * 32 * 4, borrowed: true }; labelArt.set(text,a);
    }
    a.used = state.frames;
    const slot = pass.art.length; pass.art.push(a);
    return { ...packet, id: 'label:' + packet.id, owner: packet.id, kind: 'label', z: packet.z + packet.height + 6, height: 1, visibilityRadius: undefined, art: slot };
  }
  const direction = (yaw=0,pitch=0) => ({x:Math.cos(yaw)*Math.cos(pitch),y:Math.sin(yaw)*Math.cos(pitch),z:Math.sin(pitch)});
  function light(id,kind,origin,dir,color,ir=0) {
    const c=kind==='camcorder'?window.__cam.CFG.IR[ir]:A.Gc[kind];if(!c)return null;
    return {id,kind,origin:{...origin},direction:{...dir},range:c.range,arc:c.omni?Math.PI*2:c.arc,power:c.power,channel:kind==='camcorder'?'ir':'visible',color:kind==='camcorder'?[1,1,1]:[1,3,5].map(i=>parseInt((color||'#ffe7b2').slice(i,i+2),16)/255),near:24};
  }
  function lighting(net) {
    const lights=geometry.definition.lights.filter(l=>l.channel==='ir'||!A.V.blackout).map(l=>({id:l.id,kind:'lamp',origin:l.position,direction:l.direction,range:l.range,arc:Math.PI*2,power:l.power,channel:l.channel,color:[1,1,1],near:40}));
    const add=(id,p,gear,on,ir)=>{if(!p||!on)return;const profile=p.shape||geometry.definition.colliderProfiles.find(s=>s.id===p.profile)||window.TFB_MOTION.PROFILES.stand;
      const l=light(id,gear.kind,{x:p.x,y:p.y,z:p.z+profile.eyeHeight},direction(p.yaw??p.angle,p.pitch),gear.color,ir);if(l)lights.push(l);};
    if(!A.G.caught)add('p'+A.H.id,A.H,A.H.equipment,A.lightOn(),window.__cam.irNet);
    for(const p of net?.peers||[])if(!p.d)add('p'+p.id,{...sample('p'+p.id),pitch:p.pitch},p.gear,!!p.l,p.ir);
    for(const r of window.__spatialAftermath?.values()||[]){const a=r.spatial,b=a.state.beam,eq=a.event.equipment;if(eq.light&&eq.kind!=='camcorder'&&b){const l=light(a.key+':beam',eq.kind,b.origin,b.direction,eq.color);if(l)lights.push(l);}}
    return lights;
  }
  function lamps(packets) {
    for(const l of geometry.definition.lights){const e=entry(l.id,'graphic'),g=e.display;g.clear();
      // Same five procedural fluorescent-fixture strokes as the retained Pixi build.
      g.roundRect(-45,-15,90,28,3).fill({color:3355443,alpha:.9});g.roundRect(-43,-13,86,24,2).fill({color:6249019,alpha:.95});g.rect(-37,-8,74,13).fill(A.V.blackout?9539169:16774332);g.rect(-32,-4,64,4).fill({color:16777215,alpha:A.V.blackout?.12:.75});g.moveTo(-43,10).lineTo(43,10).stroke({color:4275752,alpha:.6,width:3});
      const slot=pass.art.length;pass.art.push(texture(e));const p={id:l.id,kind:'lamp',...l.position,height:1,art:slot,radius:45,visibilityRadius:45,emissive:!A.V.blackout};p.observable=perceivable(p);packets.push(p);
    }
  }
  function beamDistance(range) {const o=eyePoint(),d=direction(A.H.angle,A.H.pitch),hit=geometry.raycast(o,{x:o.x+d.x*range,y:o.y+d.y*range,z:o.z+d.z*range},'ir');return hit?hit.t*range:range;}
  function lightAt(point,channel='visible') {
    let value=0;
    for(const l of state.lights||[]){if(l.channel!==channel)continue;const dx=point.x-l.origin.x,dy=point.y-l.origin.y,dz=point.z-l.origin.z,d=Math.hypot(dx,dy,dz);if(d>=l.range)continue;
      if(l.arc<6.28){const yaw=Math.atan2(dy,dx)-Math.atan2(l.direction.y,l.direction.x),pitch=Math.atan2(dz,Math.hypot(dx,dy))-Math.atan2(l.direction.z,Math.hypot(l.direction.x,l.direction.y));if(Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))>l.arc/2||Math.abs(pitch)>l.arc/2)continue;}
      const hit=geometry.raycast(l.origin,point,channel);if(hit&&hit.t<1-1e-7)continue;
      const t=Math.min(1,Math.max(0,(d-l.near)/(l.range-l.near)));let power=l.power;if(l.kind==='lamp')for(const f of state.failures||[])if(Math.hypot(point.x-f.x,point.y-f.y,point.z-f.z)<f.r)power*=.06;value=Math.max(value,power*(1-t*t*(3-2*t)));
    }return channel==='ir'?value:Math.min(1,.04+value*2.08);
  }
  function sound(source,near=120,far=1500) {
    const q=geometry.propagateSound(source,eyePoint());if(!q.audible)return{d:Infinity,g:0,pan:0,lp:700};
    const t=Math.min(1,Math.max(0,(q.distance-near)/(far-near))),gain=Math.pow(1-t*t*(3-2*t),1.5)*q.transmission;
    // Use the accepted acoustic bearing. There is no pitch/elevation cue and
    // no disclosure of the source's exact hidden floor.
    return{d:q.distance,g:gain,pan:Math.max(-1,Math.min(1,(q.observation.x-A.H.x)/520))*.85,lp:q.clear?9000:700};
  }
  function physicalAudio(key,sequence,source,speed,material,support) {
    if((audioSequences.get(key)??-1)>=sequence)return;audioSequences.set(key,sequence);
    window.__ents.spatialImpact(source,speed);state.audioEvents=state.audioEvents||[];state.audioEvents.push({key,sequence,source,speed,material,support});if(state.audioEvents.length>128)state.audioEvents.shift();
  }
  function motionAudio() {const p=A.H;for(const e of p.events||[])if(e.type==='land')physicalAudio('land:'+window.__net.spatialState()?.pose?.generation,e.tick,{x:p.x,y:p.y,z:p.z+.1},e.impactSpeed,e.materialId,e.supportId);}
  function beginDeath() {R.death.active=true;R.death.finished=false;R.death.corpseId=null;R.death.kind=A.G.caughtBy;}
  function completeDeath() {const a=window.__spatialAftermath?.get(A.H.id)?.spatial;if(a&&R.death.finished)R.death.corpseId=a.key;}
  function aftermath(packets) {
    state.aftermath=[];
    for(const r of window.__spatialAftermath?.values()||[]){const a=r.spatial,s=a.state,eq=a.event.equipment;
      if(a.identity.worldEpoch!==window.__net.spatialState().world.worldEpoch)continue;
      const [hat,textureName,hands,main,backpack]=eq.look.split('|'),look={hat,texture:textureName,hands,main,backpack},parts={};(A.gear.defs[eq.kind]||[]).forEach((d,i)=>parts[d[0]]=eq.parts.split(',')[i]||d[2]);const gear={kind:eq.kind,color:eq.color,parts:{[eq.kind]:parts}};
      if(r.k===A.H.id&&A.G.caught){R.death.active=true;R.death.kind=a.event.kind;R.death.finished=s.time>=s.duration;R.death.body={x:s.body.x,y:s.body.y,z:s.body.z,angle:s.body.yaw-Math.PI/2};}
      const masses=[s.body,...s.hands,s.light,s.hat,...(s.attackerOwned?[s.attacker]:[])].filter(Boolean);
      for(const o of masses){const id='d'+o.id,pose=(o.role==='attacker'?sample(a.attackerEntityId):sample(id))||{...o,z:o.z-(o.shape.centerOffset||0)},role=o.role,kind=role==='attacker'?a.event.kind.toLowerCase():'corpse';
        const e=entry(id,role==='light'?'graphic':kind,look,gear),d=e.display;
        if(role==='attacker'){
          if(kind==='hound')window.__ents.attackHound(d,Math.min(1,s.time/.4),s.phase==='impact'?1:0,a.event.variant);
          else window.__ents.attackSmiler(d,state.time,state.dt);
          d.rotation=o.yaw+Math.PI/2;
        }else if(role==='light'){
          d.clear();A.gear.draw(d,gear.kind,A.gear.parts(gear,gear.kind),parseInt(gear.color.slice(1),16),eq.light,state.time,-1,{hat});d.rotation=o.yaw;
        }else{
          d.look=look;d.lightGear=gear;d.update(state.time,eq.light,true,{...pose,angle:0,vx:0,vy:0,distance:0});
          for(const c of d.children)c.visible=false;
          if(role==='body'){d.body.visible=d.pack.visible=d.wounds.visible=true;window.__gore.wounds(d.wounds,Math.min(1,s.time/1.82),a.key,a.event.kind);if(gear.kind==='headlamp'){d.gear.visible=true;d.gear.position.set(0,0);}d.rotation=o.yaw;}
          else if(role.startsWith('hand:')){const hand=d.hands[+role.slice(-1)];hand.visible=true;hand.position.set(0,0);d.rotation=o.yaw;}
          else if(role==='hat'){d.hat.visible=true;d.hat.position.set(0,0);d.rotation=o.yaw;}
        }
        d.position.set(0,0);d.visible=true;d.alpha=1;const slot=pass.art.length;pass.art.push(texture(e));
        const p={id,kind:role==='attacker'?'replay':role,death:a.key,revision:o.revision,x:pose.x,y:pose.y,z:pose.z,height:o.shape.height,radius:o.shape.radius,shape:o.shape,visibilityRadius:o.shape.radius,art:slot,support:o.support,tick:a.tick,generation:a.identity.lifeGeneration};p.observable=perceivable(p);packets.push(p);
      }
      for(const decal of s.decals)surfacePacket(packets,a,decal,'decal:'+decal.id);
      for(let i=1;i<s.trail.length;i++){const x=s.trail[i-1],y=s.trail[i];if(x.segment===y.segment&&x.primitiveId===y.primitiveId&&x.face===y.face)surfacePacket(packets,a,y,'trail:'+y.substep,x);}
      state.aftermath.push({key:a.key,revision:a.revision,time:s.time,state:s.state,roles:masses.map(o=>o.role),decals:s.decals.length,trail:s.trail.length,beam:s.beam});
      if(!audioSequences.has(a.key))audioSequences.set(a.key,s.eventSequence); // late join does not replay old impacts
      for(const e of s.events)if(e.type==='contact'&&e.face){const f=e.face,p=Object.fromEntries(['x','y','z'].map(k=>[k,f.point[k]+f.normal[k]*.1]));physicalAudio(a.key,e.id,p,e.speed,geometry.definition.solids.find(s=>s.id===f.primitiveId)?.materialId,f.support);}
    }
  }
  function surfacePacket(packets,a,face,key,from) {
    if(face.geometryHash!==geometry.identity.contentHash)return;
    const id=a.key+':'+key,e=entry(id,'graphic'),d=e.display;d.clear();
    let point=face.point,width=96,height=96,basis=face.basis;
    if(from){const du=from.local.u-face.local.u,dv=from.local.v-face.local.v,L=Math.hypot(du,dv);if(L<3)return;const c=du/L,s=dv/L;
      basis={u:Object.fromEntries(['x','y','z'].map(k=>[k,face.basis.u[k]*c+face.basis.v[k]*s])),v:Object.fromEntries(['x','y','z'].map(k=>[k,-face.basis.u[k]*s+face.basis.v[k]*c]))};
      point=Object.fromEntries(['x','y','z'].map(k=>[k,(from.point[k]+face.point[k])/2]));width=L+40;height=48;
      window.__gore.smear(d,-L/2,0,L/2,0,a.event.seed+face.substep,1);
    }else window.__gore.drawPool(d,0,0,12,window.__gore.poolShape(a.event.seed+face.id),1,a.event.seed,1,0);
    // Reuse procedural art in the named face's local coordinates. Texture
    // bounds map to that face; shader clips spill to the physical primitive.
    const size=Math.ceil(Math.max(width,height));e.size=Math.max(128,size);d.scale.set(e.size/width,e.size/height);
    const slot=pass.art.length;pass.art.push(texture(e));d.scale.set(1);
    packets.push({id,kind:from?'trail':'decal',death:a.key,...point,height:1,art:slot,support:face.support,surface:{...face,point,basis,width,height}});
  }
  function render() {
    if (!state.ready) return;
    const start = performance.now(), net = window.__net.spatialState?.(), history = window.__spatialHistory?.();
    const local = A.H, focus = config.focus || local, epoch = net?.world?.worldEpoch || 'connecting';
    if (artEpoch !== epoch) {
      for (const e of art.values()) { e.texture?.destroy(true); e.wrap.destroy({ children: true }); }
      art.clear(); audioSequences.clear(); artEpoch = epoch;
    }
    state.frames++;
    const own = A.G.caught && window.__spatialAftermath?.get(local.id)?.spatial.state.body;
    const camera = config.camera || (own ? {x:own.x,y:own.y,z:own.z-(own.shape.centerOffset||0)} : { x: local.x, y: local.y, z: local.z });
    R.camera = { ...camera }; R.scale = window.__cameraPolicy.baseScale(innerWidth, innerHeight);
    const eye = eyePoint();
    // Simulation catch-up caps do not slow a client-local wall-clock fade.
    const viewDt = state.viewAt == null ? 0 : Math.min(.25, Math.max(0,(start - state.viewAt) / 1000)); state.viewAt = start;
    const cutStart = performance.now(); view.update({ x: focus.x, y: focus.y, z: focus.z }, viewDt, { epoch, enabled: config.cutaway });
    const cutMs = performance.now() - cutStart;
    const renderer = R.app.renderer;
    // Raw pass samplers must be detached before Pixi writes an actor's texture
    // again. Resetting Pixi's cache alone does not unbind raw WebGL samplers.
    const gl = renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const unit of [0, 1, 2]) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
    // Pixi resets its clear-color cache to transparent without issuing GL.
    gl.clearColor(0, 0, 0, 0);
    renderer.resetState();
    pass.art.length = 1;
    const packets = [];
    if (state.started && !A.G.caught && !window.__hideSelf) packets.push(livePacket('p' + local.id, 'player', { ...local, generation: net?.pose?.generation }, local));
    for (const peer of net?.peers || []) {
      if (peer.d) continue;
      const pose = history?.sample('p' + peer.id, performance.now());
      packets.push(livePacket('p' + peer.id, 'peer', pose, { ...peer, lightOn: !!peer.l }, peer.look, peer.gear));
    }
    const owned=new Set([...window.__spatialAftermath?.values()||[]].filter(r=>r.spatial.state.attackerOwned).map(r=>r.spatial.attackerEntityId));
    for (const h of window.__hounds || []) if (h&&!owned.has('h'+h.id)) packets.push(livePacket('h' + h.id, 'hound', history?.sample('h' + h.id, performance.now()), h));
    for (const s of A.q) if (!s.off && s.sid !== undefined && !owned.has('m'+s.sid)) packets.push(livePacket('m' + s.sid, 'smiler', history?.sample('m' + s.sid, performance.now()), s));
    aftermath(packets);lamps(packets);
    state.packets = packets.filter(Boolean);
    if (config.labels || window.__ents?.dbgCfg.on) for (const p of state.packets.slice()) {
      const peer = net?.peers.find(o => 'p' + o.id === p.id);
      const q = label(p, peer?.n || (p.kind === 'player' ? local.name : p.kind.toUpperCase() + ' ' + p.id));
      if (q) state.packets.push(q);
    }
    pass.resize(innerWidth, innerHeight, devicePixelRatio, config.quality);
    state.lights=lighting(net);state.failures=(window.__spatialFailures||[]).filter(f=>f.until>performance.now()/1000);state.renderOptions={ camera, eye, view, actors: state.packets, overlays: [], lights:state.lights, nv:window.__cam.nv, sensorGain:window.__cam.CFG.SENSOR_GAIN, bloom:window.__cam.bloom, failures:state.failures };
    state.last = pass.render(state.renderOptions);
    renderer.resetState();
    state.last.cpuMs = performance.now() - start; state.last.cutawayMs = cutMs;
    state.trace.push({ frame: state.frames, x: local.x, y: local.y, z: local.z, tick: local.tick, support: local.supportId, mode: local.motionMode, server: net?.pose });
    if (state.trace.length > 240) state.trace.shift();
    for (const [key, e] of art) if (e.used < state.frames - 2) { e.texture?.destroy(true); e.wrap.destroy({ children: true }); art.delete(key); }
    for (const [key, e] of labelArt) if (e.used < state.frames - 2) { gl.deleteTexture(e.tex); labelArt.delete(key); }
  }
  const api = window.__spatial = { bind, init, spawn, prepare, render, config, state, perceivable, sample, adminData, eyePoint, beginDeath, completeDeath, lightAt, beamDistance, sound, motionAudio,
    get geometry() { return geometry; }, get model() { return model; }, get view() { return view; }, get pass() { return pass; },
    inspect() { const gl = pass?.gl, ext = gl?.getExtension('WEBGL_debug_renderer_info'); return clone({ ready: state.ready, world: geometry?.identity, network: window.__net.spatialState?.(), frames: state.frames, packets: state.packets, last: state.last, cutaway: view?.snapshot(), gpu: gl && gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), renderer: 'existing production Pixi 8.21.0 / WebGL2' }); }
  };
})();
