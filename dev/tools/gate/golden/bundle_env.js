/* dev/tools/gate/golden/bundle_env.js - the deterministic page for the compiled client's differential test (development only; injected by
 * bundle_diff.js before any of the page's own scripts; never loaded by the game).  Stage 3H continuation C4.
 *
 * The real page (public/index.html: every classic script, the compiled bundle, PixiJS drawing with WebGL), made deterministic so that two
 * pages that load different builds of the bundle can be stepped frame by frame and compared:
 *   - time: performance.now, Date.now and new Date() read a virtual clock.  setTimeout / setInterval and requestAnimationFrame are queued
 *     and run only when the driver steps a frame: the clock advances by one frame (1000/60 ms), the timers that fall due fire in due order
 *     (ties in creation order), then the animation-frame callbacks registered before the frame run in order;
 *   - randomness: Math.random is a seeded generator (crypto.getRandomValues and randomUUID too);
 *   - asynchronous I/O: what the page starts (fetch, an image's decode, createImageBitmap, a Web Worker's answer, document.fonts.ready
 *     and the font events) completes for real, but is handed to the page only at the start of a frame, in the order it was asked for;
 *     fetch's response is read whole first and given as an object whose methods resolve at once.  The driver steps the first frames one
 *     at a time and waits, before each, until nothing is pending outside the page either (requests, fonts);
 *   - the network: WebSocket is a fake whose sends are recorded; the driver opens it, delivers messages and closes it at frame boundaries;
 *   - audio: AudioContext (and its nodes, buffers, decodeAudioData) is a recording fake on the virtual clock; HTMLMediaElement.play is
 *     recorded and resolves;
 *   - CSS animations and transitions: each paused when first seen and set to its own time on the virtual clock every frame;
 *   - focus: the page is always visible and focused (real blur, focus and visibilitychange events are held back; the driver sends its own).
 * What each frame did is recorded as digests, one record per frame (FR): the count of Math.random calls, the game's state through
 * window.__api, the document (every element's attributes and text), every 2D canvas call, every audio call, every call made through the
 * window objects the bundle and the classic scripts share (__ents, __net, __gore, ...), the WebSocket sends, the errors, and a digest of
 * the WebGL canvas's pixels after the frame.  The last few frames' full text is kept (window.__BD.ring) to show where two pages differ. */
(() => {
  'use strict';
  const BD = window.__BD = { FR: [], ring: [], ringSize: 64, verbose: true, errors: [], frame: 0, booted: true, netMode: 'offline' };
  /* ---------- digests: 53-bit (cyrb53), over strings ---------- */
  const h53 = (str, seed = 0) => { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  BD.h53 = h53;
  /* a channel: a running digest of what it saw this frame, its count, and (verbose) the text */
  const chan = name => ({ name, n: 0, h: 0, txt: [] });
  const CH = BD.CH = { c2d: chan('c2d'), audio: chan('audio'), hook: chan('hook'), ws: chan('ws'), dom: chan('dom'), timers: chan('timers') };
  /* the two pages are served from two local servers (two ports): the origin is the one thing about them that differs, so it never
     enters a record (a string that holds it, the window, the document) */
  const ORIGIN = location.origin, unorigin = s => (s.includes(ORIGIN) ? s.split(ORIGIN).join('<origin>') : s);
  const put = (c, s) => { s = unorigin(String(s)); c.n++; c.h = (Math.imul(c.h ^ 0, 31) + parseInt(h53(s, c.n).slice(-6), 36)) | 0; if (BD.verbose || c.keep) c.txt.push(s); if (c.txt.length > 20000) c.txt.splice(0, 10000); };
  BD.put = put;
  const num = v => (typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v);
  /* names a minifier chooses (a class's, a function's) differ between two builds of the same source, so a value is never described by
     them: a built-in class by its name; any other class by the member names along its prototype chain (property names, which no
     minifier changes); a function that is not built in by its arity */
  const fnSrc = Function.prototype.toString, isNative = f => { try { return /\{\s*\[native code\]\s*\}\s*$/.test(fnSrc.call(f)); } catch (e) { return false; } };
  const cnames = new WeakMap();
  const cname = c => { if (cnames.has(c)) return cnames.get(c); let s;
    if (isNative(c)) s = c.name;
    else { const parts = []; for (let p = c.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) { if (p.constructor && isNative(p.constructor)) { parts.push(p.constructor.name); break; } parts.push(Object.getOwnPropertyNames(p).sort().join(',')); }
      s = 'C' + h53(parts.join('|')).slice(-6); }
    cnames.set(c, s); return s; };
  BD.cname = cname;
  const short = (v, d = 0) => {                                        // a compact, deterministic description of a value (never deep)
    if (v === null) return 'null'; if (v === undefined) return 'u';
    const t = typeof v; if (t === 'number') return num(v); if (t === 'string') return JSON.stringify(unorigin(v.length > 200 ? v.slice(0, 200) + '…' + v.length : v)); if (t === 'boolean') return String(v);
    if (t === 'function') return isNative(v) ? 'fn:' + v.name : 'fn/' + v.length;
    if (v === window) return 'obj:Window'; if (v === document) return 'obj:Document'; if (v === location) return 'obj:Location';
    if (v instanceof Element) return '<' + v.tagName + (v.id ? '#' + v.id : '') + '>';
    if (typeof Node === 'function' && v instanceof Node) return 'node:' + v.nodeName;
    if (ArrayBuffer.isView(v)) { let s = 0; for (let i = 0; i < v.length; i += Math.max(1, v.length >> 6)) s = (s * 31 + (+v[i] || 0) * 1000003) % 1e15; return 'typed' + v.length + ':' + s; }
    if (Array.isArray(v)) return d > 1 ? 'arr' + v.length : '[' + v.slice(0, 12).map(x => short(x, d + 1)).join(',') + (v.length > 12 ? ',…' + v.length : '') + ']';
    if (t === 'object') { const c = v.constructor, cn = typeof c === 'function' ? (c === Object ? '' : cname(c)) : '?';
      if (d > 1) return 'obj:' + (cn || 'Object'); const ks = Object.keys(v).slice(0, 24);
      return cn + '{' + ks.map(k => k + ':' + short(v[k], d + 1)).join(',') + '}'; }
    return String(v);
  };
  BD.short = short;

  /* ---------- the virtual clock, timers, animation frames ---------- */
  const FRAME_MS = 1000 / 60, EPOCH = Date.UTC(2026, 0, 1);
  let NOW = 1000;
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window), realST = window.setTimeout.bind(window);
  BD.realNow = realNow; BD.realSetTimeout = realST;
  performance.now = () => NOW;
  const RD = Date;
  window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(EPOCH + NOW); } static now() { return EPOCH + NOW; } };
  let tseq = 0; const timers = new Map();
  const addT = (fn, ms, a, rep) => { const id = ++tseq; ms = +ms || 0; if (ms < 0) ms = 0; if (rep && ms < 1) ms = 1; timers.set(id, { id, fn, ms, a, rep, due: NOW + ms }); put(CH.timers, (rep ? 'I' : 'T') + id + ':' + ms); return id; };
  window.setTimeout = (fn, ms, ...a) => addT(fn, ms, a, false);
  window.setInterval = (fn, ms, ...a) => addT(fn, ms, a, true);
  window.clearTimeout = window.clearInterval = id => { if (timers.delete(id)) put(CH.timers, 'x' + id); };
  let rafSeq = 0, rafQ = [];
  window.requestAnimationFrame = fn => { const id = ++rafSeq; rafQ.push({ id, fn }); return id; };
  window.cancelAnimationFrame = id => { rafQ = rafQ.filter(r => r.id !== id); };
  window.requestIdleCallback = (fn) => addT(() => fn({ didTimeout: false, timeRemaining: () => 0 }), 1, [], false);
  window.cancelIdleCallback = id => window.clearTimeout(id);
  const err = (where, e) => { const m = where + ': ' + String(e && e.message || e); BD.errors.push({ f: BD.frame, m, stack: String(e && e.stack || '').slice(0, 600) }); };
  const fire = (fn, a) => { try { typeof fn === 'function' ? fn(...a) : (0, eval)(String(fn)); } catch (e) { err('timer', e); } };
  function advance(ms) {
    const end = NOW + ms;
    for (;;) {
      let nx = null; for (const t of timers.values()) if (t.due <= end && (!nx || t.due < nx.due || (t.due === nx.due && t.id < nx.id))) nx = t;
      if (!nx) break;
      NOW = Math.max(NOW, nx.due); if (nx.rep) nx.due = NOW + nx.ms; else timers.delete(nx.id);
      fire(nx.fn, nx.a);
    }
    NOW = end;
  }
  BD.now = () => NOW;

  /* ---------- seeded randomness ---------- */
  let rs = (window.__BD_SEED ? 0x5eed3d0c + Math.imul(+window.__BD_SEED, 0x9e3779b1) : 0x5eed3d0c) | 0, rnd = 0; BD.rndMark = 0;
  const R = () => { rnd++; rs |= 0; rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = R;
  const gRV = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(R() * 4294967296) & (a.BYTES_PER_ELEMENT === 1 ? 255 : a.BYTES_PER_ELEMENT === 2 ? 65535 : 0xffffffff); return a; };
  if (crypto.randomUUID) crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(R() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  void gRV;

  /* ---------- asynchronous I/O, handed over at frame boundaries ---------- */
  const pend = []; let pendN = 0;
  const gate = (real, label) => new Promise((ok, no) => { const p = { n: ++pendN, label, settled: false, ok, no }; pend.push(p);
    real.then(v => { p.settled = true; p.v = v; }, e => { p.settled = true; p.e = e || new Error('rejected'); }); });
  BD.pending = () => pend.map(p => [p.n, p.label, p.settled]);
  async function settleAll(timeoutMs = 30000) { const t0 = realNow(); while (pend.some(p => !p.settled) || (BD.workersBusy && BD.workersBusy())) { if (realNow() - t0 > timeoutMs) { err('io', new Error('an I/O did not settle: ' + pend.filter(p => !p.settled).map(p => p.label).join(', '))); break; } await new Promise(r => realST(r, 5)); } }
  function release() { const ready = pend.filter(p => p.settled); for (const p of ready) { pend.splice(pend.indexOf(p), 1); if (p.e) p.no(p.e); else p.ok(p.v); } }
  const realFetch = window.fetch.bind(window);
  const fakeResponse = (r, buf) => { const text = () => new TextDecoder().decode(buf);
    return { ok: r.ok, status: r.status, statusText: r.statusText, url: r.url, redirected: r.redirected, type: r.type, headers: r.headers, bodyUsed: false,
      arrayBuffer: () => Promise.resolve(buf.slice(0)), text: () => Promise.resolve(text()), json: () => Promise.resolve(JSON.parse(text())),
      blob: () => Promise.resolve(new Blob([buf], { type: r.headers.get('content-type') || '' })), clone() { return fakeResponse(r, buf); } }; };
  window.fetch = (input, init) => { const url = typeof input === 'string' ? input : (input && input.url) || String(input); put(CH.ws, 'fetch ' + url);
    return gate(realFetch(input, init).then(async r => fakeResponse(r, await r.arrayBuffer())), 'fetch ' + url); };
  const realDecode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function () { return gate(realDecode.call(this), 'decode ' + this.src); };
  if (window.createImageBitmap) { const cib = window.createImageBitmap.bind(window); window.createImageBitmap = (...a) => gate(cib(...a), 'createImageBitmap'); }
  /* a Web Worker: real, but each answer is handed over at a frame boundary, in the order the questions were asked (PixiJS asks one
     question per message and gets one answer); pending until every question has its answer */
  const RW = window.Worker; let wN = 0; const workers = [];
  if (RW) window.Worker = class { constructor(url, opts) { this.__w = new RW(url, opts); this.__n = ++wN; this.__asked = 0; this.__answered = 0; this.__q = []; this.__L = []; this.onmessage = null; this.onerror = null; workers.push(this);
      this.__w.onmessage = e => { this.__answered++; this.__q.push(e.data); }; this.__w.onerror = e => { this.__answered++; this.__q.push({ __error: String(e && e.message) }); }; }
    postMessage(d, t) { this.__asked++; return this.__w.postMessage(d, t); }
    terminate() { this.__w.terminate(); this.__asked = this.__answered; }
    addEventListener(t, f) { if (t === 'message') this.__L.push(f); }
    removeEventListener(t, f) { if (t === 'message') this.__L = this.__L.filter(x => x !== f); } };
  BD.workersBusy = () => workers.some(w => w.__asked > w.__answered);
  const releaseWorkers = () => { for (const w of workers) for (const d of w.__q.splice(0)) { const ev = { data: d, target: w }; try { if (d && d.__error !== undefined) { if (w.onerror) w.onerror(ev); } else { if (w.onmessage) w.onmessage(ev); for (const f of w.__L.slice()) f.call(w, ev); } } catch (x) { err('worker', x); } } };
  BD.releaseWorkers = releaseWorkers;
  /* the fonts: document.fonts.ready and the loading events handed over at frame boundaries */
  const FS = document.fonts; let fontQ = [];
  if (FS) {
    const realReady = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(FS), 'ready');
    if (realReady && realReady.get) Object.defineProperty(FS, 'ready', { configurable: true, get() { return gate(realReady.get.call(FS), 'fonts.ready'); } });
    const fAdd = FS.addEventListener.bind(FS);
    FS.addEventListener = (t, f, o) => fAdd(t, e => { fontQ.push(() => { try { f.call(FS, e); } catch (x) { err('fonts.' + t, x); } }); }, o);
    for (const t of ['onloading', 'onloadingdone', 'onloadingerror']) { let h = null; Object.defineProperty(FS, t, { configurable: true, get: () => h, set: f => { h = f; } }); fAdd(t.slice(2), e => { if (h) fontQ.push(() => h.call(FS, e)); }); }
  }
  const releaseFonts = () => { const q = fontQ; fontQ = []; for (const f of q) f(); };
  try { delete window.caches; } catch (e) { }

  /* ---------- focus and visibility: always visible and focused ---------- */
  for (const ev of ['blur', 'focus', 'visibilitychange', 'pagehide', 'pageshow', 'freeze', 'resume'])
    window.addEventListener(ev, e => { if (!e.__bd) e.stopImmediatePropagation(); }, true);
  document.addEventListener('visibilitychange', e => { if (!e.__bd) e.stopImmediatePropagation(); }, true);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.hasFocus = () => true;

  /* ---------- the fake WebSocket ---------- */
  let wsN = 0;
  class FakeWS {
    constructor(url, proto) { this.url = String(url); this.readyState = 0; this.n = ++wsN; this.protocol = ''; this.bufferedAmount = 0; this.binaryType = 'blob'; this.L = {}; FakeWS.all.push(this); put(CH.ws, 'new ' + this.n + ' ' + this.url.replace(/^wss?:\/\/[^/]*/, '')); }
    send(d) { put(CH.ws, 'send ' + this.n + ' ' + String(d)); if (BD.onSend) BD.onSend(this.n, String(d)); }
    close(c) { put(CH.ws, 'close ' + this.n + ' ' + (c === undefined ? 'u' : c)); if (this.readyState < 2) { this.readyState = 2; BD.wsClosing.push(this); } }
    addEventListener(t, f) { (this.L[t] = this.L[t] || []).push(f); }
    removeEventListener(t, f) { if (this.L[t]) this.L[t] = this.L[t].filter(x => x !== f); }
    _emit(t, e) { e.target = this; try { if (this['on' + t]) this['on' + t](e); for (const f of (this.L[t] || []).slice()) f.call(this, e); } catch (x) { err('ws.' + t, x); } }
  }
  FakeWS.all = []; Object.assign(FakeWS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); Object.assign(FakeWS.prototype, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = FakeWS; BD.wsClosing = [];
  BD.ws = () => FakeWS.all[FakeWS.all.length - 1];
  BD.wsAll = () => FakeWS.all;
  BD.wsOpen = n => { const w = n ? FakeWS.all[n - 1] : BD.ws(); if (!w || w.readyState !== 0) return false; w.readyState = 1; put(CH.ws, 'open ' + w.n); w._emit('open', {}); return true; };
  BD.wsMsg = (m, n) => { const w = n ? FakeWS.all[n - 1] : BD.ws(); if (!w || w.readyState !== 1) return false; const data = typeof m === 'string' ? m : JSON.stringify(m); put(CH.ws, 'recv ' + w.n + ' ' + data.length + ' ' + h53(data)); w._emit('message', { data }); return true; };
  BD.wsClose = (n, code = 1006) => { const w = n ? FakeWS.all[n - 1] : BD.ws(); if (!w || w.readyState === 3) return false; w.readyState = 3; put(CH.ws, 'closed ' + w.n); w._emit('close', { code, reason: '', wasClean: false }); return true; };

  /* ---------- fake audio ---------- */
  let an = 0; const audioEnded = [];
  const A = s => put(CH.audio, s);
  const ADD_EV = { addEventListener(t, f) { (this.__L = this.__L || {})[t] = (this.__L[t] || []).concat([f]); }, removeEventListener(t, f) { if (this.__L && this.__L[t]) this.__L[t] = this.__L[t].filter(x => x !== f); } };
  function param(owner, name, v, min = -3.4028234663852886e38, max = 3.4028234663852886e38) {
    const id = owner + '.' + name; let val = v;
    const p = { __rid: id, defaultValue: v, minValue: min, maxValue: max, automationRate: 'a-rate' };
    Object.defineProperty(p, 'value', { get: () => val, set: x => { val = x; A('param ' + id + '=' + num(x)); } });
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime'])
      p[m] = (...a) => { A(m + ' ' + id + ' ' + a.map(num).join(',')); if (m === 'setValueAtTime' && a[1] <= ctxTime()) val = a[0]; return p; };
    p.setValueCurveAtTime = (curve, t, d) => { A('setValueCurveAtTime ' + id + ' ' + short(curve) + ' ' + num(t) + ' ' + num(d)); return p; };
    p.connect = () => p; return p;
  }
  let theCtxT0 = null; const ctxTime = () => (theCtxT0 === null ? 0 : (NOW - theCtxT0) / 1000);
  function node(ctx, kind, params, extra) {
    const id = kind + (++an), n = Object.assign(Object.create(ADD_EV), { __rid: id, context: ctx, channelCount: 2, channelCountMode: 'max', channelInterpretation: 'speakers', numberOfInputs: 1, numberOfOutputs: 1 });
    for (const [k, v] of Object.entries(params || {})) n[k] = param(id, k, v);
    n.connect = (d, o, i) => { A('connect ' + id + '>' + (d && d.__rid || short(d)) + (o !== undefined ? ':' + o : '') + (i !== undefined ? ':' + i : '')); return d; };
    n.disconnect = (d) => A('disconnect ' + id + (d ? '>' + (d.__rid || short(d)) : ''));
    n.start = (t, o, d) => { A('start ' + id + ' ' + [t, o, d].filter(x => x !== undefined).map(num).join(',') + (n.buffer ? ' buf=' + n.buffer.__sum() : '')); n.__started = true; };
    n.stop = t => { A('stop ' + id + ' ' + (t === undefined ? 'u' : num(t))); audioEnded.push({ n, at: Math.max(ctxTime(), t || 0) }); };
    Object.assign(n, extra || {}); A('create ' + id); return n;
  }
  function typed(n, name, v) { let x = v; Object.defineProperty(n, name, { get: () => x, set: y => { x = y; A(name + ' ' + n.__rid + '=' + short(y)); } }); }
  class FakeBuffer {
    constructor(o) { this.__rid = 'buf' + (++an); this.length = o.length; this.sampleRate = o.sampleRate; this.numberOfChannels = o.numberOfChannels || 1; this.duration = o.length / o.sampleRate; this.__d = Array.from({ length: this.numberOfChannels }, () => new Float32Array(o.length)); A('buffer ' + this.__rid + ' ' + this.numberOfChannels + 'x' + o.length + '@' + o.sampleRate); }
    getChannelData(i) { return this.__d[i]; }
    copyFromChannel(dst, c, o = 0) { dst.set(this.__d[c].subarray(o, o + dst.length)); }
    copyToChannel(src, c, o = 0) { this.__d[c].set(src, o); }
    __sum() { let s = 0; for (const d of this.__d) for (let i = 0; i < d.length; i += 3) s = (s + d[i] * (1 + (i % 17))) % 1e9; return this.__rid + ':' + s.toFixed(4); }
  }
  window.AudioBuffer = FakeBuffer;
  class FakeAC {
    constructor(o) { this.__rid = 'ctx' + (++an); this.sampleRate = (o && o.sampleRate) || 48000; this.state = 'running'; if (theCtxT0 === null) theCtxT0 = NOW; this.t0 = NOW; this.baseLatency = 0.01; this.outputLatency = 0.02;
      this.destination = Object.assign(Object.create(ADD_EV), { __rid: this.__rid + '.dest', maxChannelCount: 2, channelCount: 2, context: this, connect() { }, disconnect() { } });
      const L = { __rid: this.__rid + '.listener' }; for (const k of ['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'upX', 'upZ']) L[k] = param(L.__rid, k, 0); L.forwardZ = param(L.__rid, 'forwardZ', -1); L.upY = param(L.__rid, 'upY', 1);
      L.setPosition = (...a) => A('listener.setPosition ' + a.map(num)); L.setOrientation = (...a) => A('listener.setOrientation ' + a.map(num)); this.listener = L;
      A('AudioContext ' + this.__rid + ' ' + short(o)); }
    get currentTime() { return (NOW - this.t0) / 1000; }
    addEventListener() { } removeEventListener() { }
    createGain() { return node(this, 'gain', { gain: 1 }); }
    createOscillator() { const n = node(this, 'osc', { frequency: 440, detune: 0 }); typed(n, 'type', 'sine'); n.setPeriodicWave = w => A('setPeriodicWave ' + n.__rid + ' ' + w.__rid); return n; }
    createBiquadFilter() { const n = node(this, 'biquad', { frequency: 350, Q: 1, gain: 0, detune: 0 }); typed(n, 'type', 'lowpass'); n.getFrequencyResponse = () => { }; return n; }
    createStereoPanner() { return node(this, 'pan', { pan: 0 }); }
    createPanner() { const n = node(this, 'panner', { positionX: 0, positionY: 0, positionZ: 0, orientationX: 1, orientationY: 0, orientationZ: 0 });
      for (const [k, v] of Object.entries({ panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 1, maxDistance: 10000, rolloffFactor: 1, coneInnerAngle: 360, coneOuterAngle: 360, coneOuterGain: 0 })) typed(n, k, v);
      n.setPosition = (...a) => A('setPosition ' + n.__rid + ' ' + a.map(num)); n.setOrientation = (...a) => A('setOrientation ' + n.__rid + ' ' + a.map(num)); return n; }
    createBufferSource() { const n = node(this, 'src', { playbackRate: 1, detune: 0 }); typed(n, 'buffer', null); typed(n, 'loop', false); typed(n, 'loopStart', 0); typed(n, 'loopEnd', 0); return n; }
    createConstantSource() { return node(this, 'const', { offset: 1 }); }
    createBuffer(ch, len, rate) { return new FakeBuffer({ numberOfChannels: ch, length: len, sampleRate: rate }); }
    createDynamicsCompressor() { const n = node(this, 'comp', { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }); n.reduction = 0; return n; }
    createConvolver() { const n = node(this, 'conv', {}); typed(n, 'buffer', null); typed(n, 'normalize', true); return n; }
    createWaveShaper() { const n = node(this, 'shaper', {}); typed(n, 'curve', null); typed(n, 'oversample', 'none'); return n; }
    createDelay(max) { A('delay.max ' + num(max)); return node(this, 'delay', { delayTime: 0 }); }
    createAnalyser() { const n = node(this, 'analyser', {}); Object.assign(n, { fftSize: 2048, frequencyBinCount: 1024, minDecibels: -100, maxDecibels: -30, smoothingTimeConstant: 0.8 });
      n.getByteFrequencyData = a => a.fill(0); n.getFloatFrequencyData = a => a.fill(-100); n.getByteTimeDomainData = a => a.fill(128); n.getFloatTimeDomainData = a => a.fill(0); return n; }
    createChannelMerger(k) { return node(this, 'merge' + (k || 6), {}); }
    createChannelSplitter(k) { return node(this, 'split' + (k || 6), {}); }
    createIIRFilter(ff, fb) { A('iir ' + short(ff) + ' ' + short(fb)); return node(this, 'iir', {}); }
    createPeriodicWave(re, im) { const id = 'wave' + (++an); A('wave ' + id + ' ' + short(Array.from(re)) + ' ' + short(Array.from(im))); return { __rid: id }; }
    createMediaElementSource(el) { return node(this, 'media', {}, { mediaElement: el }); }
    createMediaStreamDestination() { return node(this, 'stream', {}, { stream: {} }); }
    decodeAudioData(ab, ok, no) { const b = new FakeBuffer({ numberOfChannels: 2, length: 4800 + ((ab && ab.byteLength) || 0) % 4800, sampleRate: 48000 }); A('decode ' + ((ab && ab.byteLength) || 0) + ' ' + b.__rid); if (ok) ok(b); return Promise.resolve(b); }
    resume() { A('resume ' + this.__rid); this.state = 'running'; return Promise.resolve(); }
    suspend() { A('suspend ' + this.__rid); this.state = 'suspended'; return Promise.resolve(); }
    close() { A('close ' + this.__rid); this.state = 'closed'; return Promise.resolve(); }
  }
  window.AudioContext = window.webkitAudioContext = FakeAC;
  window.OfflineAudioContext = class extends FakeAC { constructor(c, l, r) { super({ sampleRate: r }); A('Offline ' + short([c, l, r])); this.length = l; } startRendering() { return Promise.resolve(new FakeBuffer({ numberOfChannels: 2, length: this.length || 1, sampleRate: this.sampleRate })); } };
  for (const [cls, make] of [['GainNode', 'createGain'], ['OscillatorNode', 'createOscillator'], ['BiquadFilterNode', 'createBiquadFilter'], ['StereoPannerNode', 'createStereoPanner'], ['AudioBufferSourceNode', 'createBufferSource'], ['DynamicsCompressorNode', 'createDynamicsCompressor'], ['ConvolverNode', 'createConvolver'], ['WaveShaperNode', 'createWaveShaper'], ['DelayNode', 'createDelay'], ['PannerNode', 'createPanner'], ['ConstantSourceNode', 'createConstantSource']])
    window[cls] = function (ctx, opts) { const n = ctx[make](); if (opts) for (const [k, v] of Object.entries(opts)) { if (n[k] && n[k].__rid && typeof v === 'number') n[k].value = v; else n[k] = v; } return n; };
  const HM = HTMLMediaElement.prototype;
  HM.play = function () { A('media.play ' + (this.id || this.currentSrc || this.src || '?').slice(-60)); return Promise.resolve(); };
  HM.pause = function () { A('media.pause ' + (this.id || this.src || '?').slice(-60)); };
  HM.load = function () { A('media.load ' + (this.src || '?').slice(-60)); };

  /* ---------- 2D canvas calls ---------- */
  const C2 = CanvasRenderingContext2D.prototype, cid = new WeakMap(); let cn = 0;
  const canvasName = c => { const el = c.canvas; if (el && el.id) return el.id; if (!cid.has(el)) cid.set(el, 'c' + (++cn)); return cid.get(el); };
  const argS = a => (a && typeof a === 'object' ? (a instanceof HTMLCanvasElement ? 'canvas:' + (a.id || (cid.get(a) || (cid.set(a, 'c' + (++cn)), cid.get(a)))) : a instanceof HTMLImageElement ? 'img:' + a.src.slice(-40) : a.__rid ? a.__rid : short(a)) : num(a));
  let gradN = 0;
  for (const k of Object.getOwnPropertyNames(C2)) {
    const d = Object.getOwnPropertyDescriptor(C2, k); if (!d || k === 'constructor' || k === 'canvas') continue;
    if (typeof d.value === 'function') {
      const f = d.value;
      C2[k] = function (...a) { const r = f.apply(this, a); const nm = canvasName(this);
        if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient' || k === 'createPattern') { r.__rid = k[6] + (++gradN); const ac = r.addColorStop; if (ac) r.addColorStop = function (o, c) { put(CH.c2d, nm + ' ' + r.__rid + '.stop ' + num(o) + ' ' + c); return ac.call(this, o, c); }; put(CH.c2d, nm + ' ' + k + ' ' + r.__rid + ' ' + a.map(argS).join(',')); return r; }
        if (k === 'getImageData' || k === 'measureText' || k === 'isPointInPath' || k === 'isPointInStroke' || k === 'getTransform' || k === 'getLineDash' || k === 'getContextAttributes') { put(CH.c2d, nm + ' ' + k + ' ' + a.map(argS).join(',') + (k === 'measureText' ? ' =' + num(r.width) : '')); return r; }
        put(CH.c2d, nm + ' ' + k + ' ' + a.map(argS).join(',')); return r; };
    } else if (d.set) {
      const s = d.set;
      Object.defineProperty(C2, k, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { put(CH.c2d, canvasName(this) + ' ' + k + '=' + argS(v)); s.call(this, v); } });
    }
  }

  /* ---------- the shared window objects: every call through them ---------- */
  const SHARED = ['__ents', '__net', '__cam', '__mv', '__gore', '__inv', '__sfx', '__hideSelf', '__dphys', '__kill', '__dcamK', '__peerLights', '__light', '__hounds', '__brRole', '__vol', '__pose',
    '__mp', '__lastCause', '__l0v', '__hideBodies', '__fxKillS', '__fxKill', '__dvic', '__dsndHits', '__dlab', '__deathLight', '__cameraPolicy', '__c', '__loadout', '__killer', '__avatarApp', '__deathMotion', '__glitches', '__items', '__glitchSound', '__glitchFrame', '__pose'];
  const wrapped = new WeakMap();
  const wrap = (v, path) => {
    if (!v || (typeof v !== 'object' && typeof v !== 'function')) return v;
    if (wrapped.has(v)) return wrapped.get(v);
    let p;
    const fixed = (t, k) => { const d = Reflect.getOwnPropertyDescriptor(t, k); return !!d && !d.configurable && (d.writable === false || (!d.set && !d.get && !('value' in d))); };   // a proxy must give such a property as it is
    if (typeof v === 'function') p = new Proxy(v, { apply(t, self, args) { put(CH.hook, path + '(' + args.map(x => short(x)).join(',') + ')'); return Reflect.apply(t, self, args); },
      get(t, k) { const x = Reflect.get(t, k); return typeof x === 'function' && typeof k === 'string' && k !== 'prototype' && k !== 'call' && k !== 'apply' && k !== 'bind' && !fixed(t, k) ? wrap(x, path + '.' + k) : x; } });
    else if (Array.isArray(v) || v instanceof Map || v instanceof Set || v instanceof Element || v instanceof EventTarget || ArrayBuffer.isView(v)) return v;
    else p = new Proxy(v, { get(t, k) { const x = Reflect.get(t, k); return typeof x === 'function' && typeof k === 'string' && !fixed(t, k) ? wrap(x, path + '.' + k) : x; } });
    wrapped.set(v, p); return p;
  };
  for (const name of new Set(SHARED)) {
    let raw;
    try { Object.defineProperty(window, name, { configurable: true, enumerable: true, get: () => wrap(raw, name), set: v => { raw = v; } }); } catch (e) { }
  }

  /* ---------- errors ---------- */
  window.addEventListener('error', e => err('error', e.error || e.message));
  window.addEventListener('unhandledrejection', e => err('rejection', e.reason));
  const ce = console.error.bind(console); console.error = (...a) => { BD.errors.push({ f: BD.frame, m: 'console.error: ' + a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 300) }); ce(...a); };

  /* ---------- the game's state, the document, the pixels ---------- */
  const stateOf = () => {
    const A = window.__api; if (!A) return 'no-api';
    const pick = (o, d = 0) => { if (o === null || o === undefined || typeof o !== 'object') return short(o); if (d > 2) return 'obj';
      if (Array.isArray(o)) return '[' + o.slice(0, 80).map(x => pick(x, d + 1)).join(',') + ']';
      const ks = Object.keys(o).filter(k => { const v = o[k]; return v === null || typeof v !== 'object' || Array.isArray(v) && v.length < 400 || (v.constructor === Object); }).sort();
      return '{' + ks.map(k => k + ':' + pick(o[k], d + 1)).join(',') + '}'; };
    const s = [];
    for (const k of ['H', 'G', 'q', 'V']) { try { s.push(k + '=' + pick(A[k])); } catch (e) { s.push(k + '!'); } }
    for (const k of ['started', 'paused', 'mapOpen', 'bodyCount']) { try { s.push(k + '=' + short(typeof A[k] === 'function' ? A[k]() : A[k])); } catch (e) { s.push(k + '!'); } }
    try { s.push('keys=' + [...(A.keys || [])].join('|')); } catch (e) { }
    try { s.push('gear=' + pick(A.gear)); } catch (e) { }
    return s.join(';');
  };
  const domOf = () => { const out = []; const walk = (el, d) => { if (d > 40) return; if (el.nodeType === 3) { const t = el.nodeValue; if (t.trim()) out.push('"' + t.trim().slice(0, 300)); return; }
    if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    let s = el.tagName; for (const a of el.attributes) s += ' ' + a.name + '=' + a.value.slice(0, 400); if (el.value !== undefined && typeof el.value === 'string' && el.tagName !== 'BUTTON' && el.tagName !== 'LI') s += ' :value=' + el.value; if (el.tagName === 'CANVAS') s += ' :' + el.width + 'x' + el.height;
    out.push(s); for (const c of el.childNodes) walk(c, d + 1); out.push('/'); }; walk(document.body, 0); return out.join('\n'); };
  BD.domOf = domOf; BD.stateOf = stateOf;
  const glCanvas = () => document.querySelector('#game canvas');
  let pix = null;
  const pixelsOf = () => { const c = glCanvas(); if (!c) return 'no-canvas'; const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'no-gl';
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; if (!pix || pix.length !== w * h * 4) pix = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pix); const u = new Uint32Array(pix.buffer); let a = 0x9e3779b9 | 0, b = 0x85ebca6b | 0;
    for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); b = (b + (u[i] ^ (i * 2654435761))) | 0; }
    return w + 'x' + h + ':' + (a >>> 0).toString(36) + (b >>> 0).toString(36); };
  BD.pixelsOf = pixelsOf;
  /* CSS animations and transitions on the virtual clock: each one, from the frame it is first seen, paused and set to its own time
     (getAnimations() brings the style up to date first, so a transition a change just started is among them) */
  function pinAnimations() { for (const an of document.getAnimations()) { if (an.__bd === undefined) { an.__bd = NOW; try { an.pause(); } catch (e) { } } try { an.currentTime = NOW - an.__bd; } catch (e) { } } }
  BD.pinAnimations = pinAnimations;
  const cssOf = () => { pinAnimations(); const out = []; for (const el of document.querySelectorAll('*')) { if (el.tagName === 'SCRIPT') continue; const cs = getComputedStyle(el), names = []; for (let i = 0; i < cs.length; i++) names.push(cs[i]); names.sort(); let s = ''; for (const n of names) s += n + ':' + cs.getPropertyValue(n) + ';'; out.push(h53(s)); } return out.length + ':' + h53(out.join(',')); };
  BD.cssOf = cssOf;
  BD.cssList = () => { pinAnimations(); const out = []; let i = 0; for (const el of document.querySelectorAll('*')) { i++; if (el.tagName === 'SCRIPT') continue; const cs = getComputedStyle(el), names = []; for (let k = 0; k < cs.length; k++) names.push(cs[k]); names.sort(); const props = {}; for (const n of names) props[n] = cs.getPropertyValue(n); out.push([i + ':' + el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''), props]); } return out; };

  /* ---------- a frame ---------- */
  let lastDom = '';
  function frame(opts) {
    BD.frame++;                                                        // (what happened since the last frame - input, the driver's own steps - belongs to this one)
    const r0 = BD.rndMark;
    release();                                                         // the I/O that completed since the last frame, in the order it was asked for
    releaseWorkers(); releaseFonts();
    advance(FRAME_MS);                                                 // the timers that fall due
    for (const e of audioEnded.splice(0)) { if (e.at <= ctxTime() && e.n.onended) { try { e.n.onended({ target: e.n }); } catch (x) { err('onended', x); } } else if (e.at > ctxTime()) audioEnded.push(e); }
    for (const w of BD.wsClosing.splice(0)) BD.wsClose(w.n, 1000);
    if (BD.netMode === 'offline') for (const w of FakeWS.all) if (w.readyState === 0 && w.__f !== undefined && w.__f < BD.frame) { w.readyState = 3; put(CH.ws, 'refused ' + w.n); w._emit('error', {}); w._emit('close', { code: 1006, reason: '', wasClean: false }); }
    for (const w of FakeWS.all) if (w.__f === undefined) w.__f = BD.frame;
    const P0 = realNow();
    const q = rafQ; rafQ = [];
    for (const r of q) { try { r.fn(NOW); } catch (e) { err('raf', e); } }
    const P1 = realNow();
    void document.body.offsetWidth;                                     // the layout now (a font it needs starts loading in this frame, not at a real one)
    pinAnimations();
    const dom = domOf(); if (dom !== lastDom) { put(CH.dom, dom); lastDom = dom; }
    const P2 = realNow();
    const st = stateOf();
    const P3 = realNow();
    const rec = { f: BD.frame, t: NOW, rnd: rnd - r0, st: h53(st), px: opts.pixels && BD.frame % opts.pixels === 0 ? pixelsOf() : '', css: opts.css ? cssOf() : '', err: BD.errors.length };
    const P4 = realNow(); const pr = BD.prof = BD.prof || { raf: 0, dom: 0, state: 0, px: 0, n: 0 }; pr.raf += P1 - P0; pr.dom += P2 - P1; pr.state += P3 - P2; pr.px += P4 - P3; pr.n++;
    for (const c of Object.values(CH)) rec[c.name] = c.n ? c.n + ':' + (c.h >>> 0).toString(36) : '';
    BD.FR.push(rec);
    BD.ring.push({ f: BD.frame, state: st, ch: Object.fromEntries(Object.values(CH).filter(c => c.txt.length).map(c => [c.name, c.txt.slice(-400)])) }); if (BD.ring.length > BD.ringSize) BD.ring.shift();
    for (const c of Object.values(CH)) { c.n = 0; c.h = 0; c.txt = []; }
    BD.rndMark = rnd;
    return rec;
  }
  /* the driver's entry: n frames; the I/O they started is settled for real before each next frame */
  BD.step = async (n, opts = {}) => { const out = []; for (let i = 0; i < n; i++) { await settleAll(); out.push(frame(opts)); if (opts.until && (0, eval)(opts.until)) break; } return out; };
  BD.setVerbose = v => { BD.verbose = v; for (const c of Object.values(CH)) c.keep = v; };
  BD.boot = () => { BD.booted = true; };
  BD.rafCount = () => rafQ.length;
  BD.timerCount = () => timers.size;
  BD.input = (type, init) => {                                          // a synthetic input event at a frame boundary
    const t = init && init.target ? document.querySelector(init.target) : (type.startsWith('key') ? (document.activeElement || document.body) : document.elementFromPoint(init.clientX | 0, init.clientY | 0) || document.body);
    const E = type.startsWith('key') ? KeyboardEvent : type.startsWith('pointer') ? PointerEvent : type.startsWith('touch') ? Event : MouseEvent;
    const ev = new E(type, Object.assign({ bubbles: true, cancelable: true, composed: true, view: window }, init || {})); ev.__bd = 1; t.dispatchEvent(ev); return true; };
})();
