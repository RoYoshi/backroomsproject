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
      const display = kind === 'hound' ? new A.Wl() : kind === 'smiler' ? new A.Gl({ off: false }) : A.mkAvatar(look || A.look, gear || A.H.equipment);
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
    return { id, kind, x: pose.x, y: pose.y, z: pose.z, height: pose.height || (kind === 'hound' ? 36 : kind === 'smiler' ? 48 : A.H.shape?.height || 60), art: slot, support: pose.support ?? pose.supportId, mode: pose.mode ?? pose.motionMode, tick: pose.tick, generation: pose.generation };
  }
  function eyePoint() {
    const p = A.H;
    return { x: p.x, y: p.y, z: p.z + (window.TFB_MOTION.PROFILES[p.posture || 'stand']?.eyeHeight || 50) };
  }
  function perceivable(p) {
    if (!p || !['x','y','z'].every(k => Number.isFinite(p[k]))) return false;
    const eye = eyePoint(), h = p.height || p.shape?.height || 60;
    return [1,h / 2,h - 1].some(z => V.visible(model, eye, { x: p.x, y: p.y, z: p.z + z }));
  }
  function sample(id) { return window.__spatialHistory?.()?.sample(id, performance.now()); }
  function adminData(d) {
    if (!d) return d;
    const pl = d.pl.filter(p => p.id === A.H.id || perceivable(sample('p' + p.id)));
    const es = (d.es || []).filter(e => perceivable(sample((e[1] ? 'm' : 'h') + e[0])));
    return { ...d, pl, es, hn: es.filter(e => !e[1]).length, sn: es.filter(e => e[1]).length };
  }
  function label(packet, text) {
    if (!perceivable(packet)) return null;
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
    return { ...packet, id: 'label:' + packet.id, owner: packet.id, kind: 'label', z: packet.z + packet.height + 6, height: 1, art: slot };
  }
  function render() {
    if (!state.ready) return;
    const start = performance.now(), net = window.__net.spatialState?.(), history = window.__spatialHistory?.();
    const local = A.H, focus = config.focus || local, epoch = net?.world?.worldEpoch || 'connecting';
    if (artEpoch !== epoch) {
      for (const e of art.values()) { e.texture?.destroy(true); e.wrap.destroy({ children: true }); }
      art.clear(); artEpoch = epoch;
    }
    state.frames++;
    const camera = config.camera || { x: local.x, y: local.y, z: local.z };
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
    for (const unit of [0, 1]) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
    // Pixi resets its clear-color cache to transparent without issuing GL.
    gl.clearColor(0, 0, 0, 0);
    renderer.resetState();
    pass.art.length = 1;
    const packets = [];
    if (state.started && !A.G.caught && !window.__hideSelf) packets.push(livePacket('p' + local.id, 'player', { ...local, generation: net?.pose?.generation }, local));
    for (const peer of net?.peers || []) {
      if (peer.dead) continue;
      const pose = history?.sample('p' + peer.id, performance.now());
      packets.push(livePacket('p' + peer.id, 'peer', pose, { ...peer, lightOn: !!peer.l }, peer.look, peer.gear));
    }
    for (const h of window.__hounds || []) if (h) packets.push(livePacket('h' + h.id, 'hound', history?.sample('h' + h.id, performance.now()), h));
    for (const s of A.q) if (!s.off && s.sid !== undefined) packets.push(livePacket('m' + s.sid, 'smiler', history?.sample('m' + s.sid, performance.now()), s));
    state.packets = packets.filter(Boolean);
    if (config.labels || window.__ents?.dbgCfg.on) for (const p of state.packets.slice()) {
      const peer = net?.peers.find(o => 'p' + o.id === p.id);
      const q = label(p, peer?.n || (p.kind === 'player' ? local.name : p.kind.toUpperCase() + ' ' + p.id));
      if (q) state.packets.push(q);
    }
    pass.resize(innerWidth, innerHeight, devicePixelRatio, config.quality);
    state.last = pass.render({ camera, eye, view, actors: state.packets, overlays: [] });
    renderer.resetState();
    state.last.cpuMs = performance.now() - start; state.last.cutawayMs = cutMs;
    state.trace.push({ frame: state.frames, x: local.x, y: local.y, z: local.z, tick: local.tick, support: local.supportId, mode: local.motionMode, server: net?.pose });
    if (state.trace.length > 240) state.trace.shift();
    for (const [key, e] of art) if (e.used < state.frames - 2) { e.texture?.destroy(true); e.wrap.destroy({ children: true }); art.delete(key); }
    for (const [key, e] of labelArt) if (e.used < state.frames - 2) { gl.deleteTexture(e.tex); labelArt.delete(key); }
  }
  const api = window.__spatial = { bind, init, spawn, prepare, render, config, state, perceivable, sample, adminData, eyePoint,
    get geometry() { return geometry; }, get model() { return model; }, get view() { return view; }, get pass() { return pass; },
    inspect() { const gl = pass?.gl, ext = gl?.getExtension('WEBGL_debug_renderer_info'); return clone({ ready: state.ready, world: geometry?.identity, network: window.__net.spatialState?.(), frames: state.frames, packets: state.packets, last: state.last, cutaway: view?.snapshot(), gpu: gl && gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), renderer: 'existing production Pixi 8.21.0 / WebGL2' }); }
  };
})();
