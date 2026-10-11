/* Stage 3H0 - the client golden harness's page environment (development only; loaded by the harness page before world.js and mp.js,
 * never by the game).
 *
 * A closed world for mp.js in a real Chromium page:
 *   - time:       performance.now / Date.now / new Date() read a fake clock; setTimeout / setInterval / clear* are a fake scheduler (due order,
 *                 ties in creation order, an overdue interval fires once);
 *   - randomness: Math.random is a seeded generator;
 *   - network:    WebSocket is a fake whose sends are recorded and whose open / message / close the scene triggers;
 *   - audio:      AudioContext is a fake that records every node, connection, parameter change and start / stop, on the fake clock;
 *   - the game:   window.__api (installed by the scene, as the bundle would, after mp.js), window.__ents, __mv, __cam, __sfx, __inv,
 *                 __glitchSound, __glitchFrame are recording stubs with simple deterministic behavior;
 *   - the page:   every addEventListener and MutationObserver.observe is recorded; confirm() answers yes; the clipboard is a recorder.
 * Everything goes to window.__T (one array per entry, prefixed by the fake time).  The same environment runs the accepted parent's mp.js
 * and the working tree's, so their traces can be compared byte for byte. */
(() => {
  'use strict';
  const T = window.__T = [];
  let NOW = 1000;
  const r3 = v => typeof v === 'number' ? (Number.isFinite(v) ? v : String(v)) : v;
  const ser = (v, d = 0) => {
    if (v === null || v === undefined) return v === undefined ? '~u' : null;
    if (typeof v === 'number') return r3(v);
    if (typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'function') return '~fn';
    if (v instanceof Element) return '~el:' + (v.id || v.tagName);
    if (v && v.__rid) return '~' + v.__rid;
    if (ArrayBuffer.isView(v)) return '~typed' + v.length;
    if (Array.isArray(v)) return d > 6 ? '~arr' + v.length : v.slice(0, 80).map(x => ser(x, d + 1)).concat(v.length > 80 ? ['~more' + (v.length - 80)] : []);
    if (typeof v === 'object') { if (d > 6) return '~obj'; const o = {}; for (const k of Object.keys(v)) o[k] = ser(v[k], d + 1); return o; }
    return String(v);
  };
  const rec = window.__rec = (...e) => { T.push([NOW, ...e.map(x => ser(x))]); };

  /* ---------- fake clock and timers ---------- */
  const EPOCH = Date.UTC(2026, 0, 1);
  const realNow = performance.now.bind(performance);                // kept for the timing side channel (cli_perf.js), never for the trace
  performance.now = () => NOW;
  const RD = Date;
  window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(EPOCH + NOW); } static now() { return EPOCH + NOW; } };
  let tseq = 0; const timers = new Map();
  const add = (fn, ms, a, rep) => { const id = ++tseq; ms = +ms || 0; if (ms < 1) ms = rep ? 1 : 0; timers.set(id, { id, fn, ms, a, rep, due: NOW + ms }); rec(rep ? 'setInterval' : 'setTimeout', id, ms); return id; };
  window.setTimeout = (fn, ms, ...a) => add(fn, ms, a, false);
  window.setInterval = (fn, ms, ...a) => add(fn, ms, a, true);
  window.clearTimeout = window.clearInterval = id => { if (timers.delete(id)) rec('clearTimer', id); };
  const errs = [];
  const H = window.__H = {
    get now() { return NOW; },
    advance(ms) {
      const end = NOW + ms;
      for (;;) {
        let nx = null;
        for (const t of timers.values()) if (t.due <= end && (!nx || t.due < nx.due || (t.due === nx.due && t.id < nx.id))) nx = t;
        if (!nx) break;
        NOW = Math.max(NOW, nx.due);
        if (nx.rep) nx.due = NOW + nx.ms; else timers.delete(nx.id);
        rec('fire', nx.id);
        try { nx.fn(...nx.a); } catch (e) { rec('timer.throw', nx.id, String(e && e.message)); errs.push(String(e && e.stack)); }
      }
      NOW = end;
    },
    pending: () => [...timers.values()].map(t => [t.id, t.ms, t.rep, t.due]),
    errs,
    perf: { mpMs: 0, mpCalls: 0, msgMs: 0, msgCalls: 0 },                  // real time spent inside mp.js's hook and message handler (cli_perf.js); not traced
    realNow,
  };

  /* ---------- seeded randomness ---------- */
  let rs = 0x5eed3d0;
  Math.random = () => { rs |= 0; rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ---------- listeners, observers, dialogs, clipboard, storage ---------- */
  const addEL = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    const self = this == null ? window : this;              // a bare addEventListener(...) call from sloppy code: the global object, as the browser does
    rec('addEventListener', self === window ? 'window' : self === document ? 'document' : (self.id ? '#' + self.id : self.tagName || String(self)), type, opt === undefined ? '~u' : ser(opt));
    return addEL.call(self, type, fn, opt);
  };
  const obs = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function (target, o) { rec('MutationObserver.observe', target === document.body ? 'body' : (target.id || target.tagName), o); return obs.call(this, target, o); };
  window.confirm = q => { rec('confirm', q); return true; };
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { rec('clipboard.writeText', t.length, t.slice(0, 120)); return Promise.resolve(); } } }); } catch (e) { rec('clipboard.stub.failed'); }
  try { localStorage.clear(); } catch (e) { }
  const lsSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { rec('localStorage.setItem', k, v); return lsSet.call(this, k, v); };

  /* ---------- fake WebSocket ---------- */
  let wsN = 0;
  class FakeWS {
    constructor(url, proto) { this.url = url; this.readyState = 0; this.n = ++wsN; FakeWS.all.push(this); rec('ws.new', this.n, url, proto === undefined ? '~u' : proto); }
    send(d) { rec('ws.send', this.n, String(d)); }
    close(c, r) { rec('ws.close', this.n, c === undefined ? '~u' : c); }
  }
  FakeWS.all = []; Object.assign(FakeWS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = FakeWS;
  H.ws = () => FakeWS.all[FakeWS.all.length - 1];
  H.open = () => { const w = H.ws(); w.readyState = 1; rec('ws.open', w.n); w.onopen && w.onopen({}); };
  H.msg = m => { const w = H.ws(); const data = typeof m === 'string' ? m : JSON.stringify(m); rec('ws.recv', w.n, data.length > 300 ? data.slice(0, 300) + '…' : data);
    if (w.onmessage) { const t = realNow(); try { w.onmessage({ data }); } finally { H.perf.msgMs += realNow() - t; H.perf.msgCalls++; } } };
  H.close = () => { const w = H.ws(); w.readyState = 3; rec('ws.closed', w.n); w.onclose && w.onclose({}); };

  /* ---------- fake audio ---------- */
  let nodeN = 0;
  const param = (owner, name, v) => {
    const p = { __rid: owner + '.' + name, _v: v };
    Object.defineProperty(p, 'value', { get() { return this._v; }, set(x) { this._v = x; rec('param', p.__rid, x); } });
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues'])
      p[m] = (...a) => { rec('param.' + m, p.__rid, ...a); return p; };
    p.connect = () => p;
    return p;
  };
  function node(ctx, kind, params) {
    const id = kind + (++nodeN), n = { __rid: id, context: ctx };
    for (const [k, v] of Object.entries(params || {})) n[k] = param(id, k, v);
    n.connect = d => { rec('connect', id, d && d.__rid || ser(d)); return d; };
    n.disconnect = () => rec('disconnect', id);
    n.start = (t) => { rec('start', id, t === undefined ? '~u' : t, n.buffer ? n.buffer.__sum() : null); };
    n.stop = t => rec('stop', id, t === undefined ? '~u' : t);
    return n;
  }
  class FakeAC {
    constructor(o) { this.__rid = 'ctx' + (++nodeN); this.sampleRate = 44100; this.state = 'running'; this.t0 = NOW; this.destination = { __rid: this.__rid + '.dest' }; rec('AudioContext.new', this.__rid, o === undefined ? '~u' : ser(o)); }
    get currentTime() { return (NOW - this.t0) / 1000; }
    createOscillator() { const n = node(this, 'osc', { frequency: 440, detune: 0 }); let ty = 'sine'; Object.defineProperty(n, 'type', { get: () => ty, set: v => { ty = v; rec('osc.type', n.__rid, v); } }); n.setPeriodicWave = w => rec('setPeriodicWave', n.__rid, w.__rid); rec('create', n.__rid); return n; }
    createGain() { const n = node(this, 'gain', { gain: 1 }); rec('create', n.__rid); return n; }
    createBiquadFilter() { const n = node(this, 'biquad', { frequency: 350, Q: 1, gain: 0 }); let ty = 'lowpass'; Object.defineProperty(n, 'type', { get: () => ty, set: v => { ty = v; rec('biquad.type', n.__rid, v); } }); rec('create', n.__rid); return n; }
    createStereoPanner() { const n = node(this, 'pan', { pan: 0 }); rec('create', n.__rid); return n; }
    createBufferSource() { const n = node(this, 'src', { playbackRate: 1 }); let b = null, lp = false; Object.defineProperty(n, 'buffer', { get: () => b, set: v => { b = v; rec('src.buffer', n.__rid, v && v.__rid); } }); Object.defineProperty(n, 'loop', { get: () => lp, set: v => { lp = v; rec('src.loop', n.__rid, v); } }); rec('create', n.__rid); return n; }
    createBuffer(ch, len, rate) {
      const id = 'buf' + (++nodeN), data = Array.from({ length: ch }, () => new Float32Array(len));
      rec('createBuffer', id, ch, len, rate);
      return { __rid: id, length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: i => data[i], __sum() { let s = 0; for (const d of data) for (let i = 0; i < d.length; i += 7) s += d[i] * (1 + (i % 13)); return +s.toFixed(6); } };
    }
    createPeriodicWave(re, im) { const id = 'wave' + (++nodeN); rec('createPeriodicWave', id, Array.from(re), Array.from(im)); return { __rid: id }; }
    resume() { rec('ctx.resume', this.__rid); this.state = 'running'; return Promise.resolve(); }
    suspend() { rec('ctx.suspend', this.__rid); this.state = 'suspended'; return Promise.resolve(); }
  }
  window.AudioContext = window.webkitAudioContext = FakeAC;
  window.OfflineAudioContext = class extends FakeAC { constructor(c, l, r) { super(); rec('OfflineAudioContext.new', c, l, r); } startRendering() { return Promise.resolve({ getChannelData: () => new Float32Array(44100 * 3) }); } };
  H.audioCtx = () => new FakeAC();

  /* ---------- recording helpers for game objects ---------- */
  let ridN = 0;
  const watch = H.watch = (obj, name) => {
    Object.defineProperty(obj, '__rid', { value: name, enumerable: false });
    return new Proxy(obj, { set(t, k, v) { if (typeof k === 'string' && k !== '__rid' && !Object.is(t[k], v)) rec('set', name, k, v); t[k] = v; return true; } });   // a write of the value already there changes nothing, so it is not recorded
  };
  const container = name => { const c = { __rid: name, children: [] }; c.addChild = (...xs) => { for (const x of xs) { rec('addChild', name, x && x.__rid || ser(x)); if (x && typeof x === 'object') x.parent = c; c.children.push(x); } return xs[0]; }; c.removeChild = x => { rec('removeChild', name, x && x.__rid || ser(x)); const i = c.children.indexOf(x); if (i >= 0) c.children.splice(i, 1); if (x) x.parent = null; return x; }; return c; };
  H.container = container;
  const gfx = (name, extra) => {
    const o = Object.assign({ alpha: 1, rotation: 0, visible: true, x: 0, y: 0, parent: null }, extra || {});
    o.scale = { set: (a, b) => rec('scale.set', name, a, b === undefined ? '~u' : b) };
    o.position = { set: (a, b) => rec('position.set', name, a, b) };
    o.destroy = opt => rec('destroy', name, opt === undefined ? '~u' : opt);
    return watch(o, name);
  };
  H.gfx = gfx;
  H.nextId = p => p + (++ridN);
})();
