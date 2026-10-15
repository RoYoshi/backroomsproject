/* Stage 3H continuation (C3b) - the page scripts' differential: the page environment added to Stage 3H0's cli_env.js (development only;
 * loaded by dev/tools/gate/golden/page_scripts.js's harness page, never by the game).
 *
 * cli_env.js gives the closed world: a fake clock and timers, seeded randomness, a recording Web Audio, recorded listeners, recording
 * game objects (__H.gfx, __H.container).  This adds what the page's own scripts touch:
 *   - every 2D canvas context records its calls and property writes (each call and its arguments, rounded; drawImage's source by id);
 *   - __H.G(name): a recording Graphics (PixiJS's drawing object as the scripts use it: any method call is recorded and returns the
 *     object, so chains work; x, y, alpha, rotation, visible, scale, position, children);
 *   - __H.dom(): the page's elements as the scripts left them (tag, id, class, inline style, short text), for the trace;
 *   - __H.level: Level 0 as L.O.S.T.'s sim.level0.js builds it with this page's WORLD (collision, rooms, ray casts), the same on both
 *     sides of the comparison. */
(() => {
  'use strict';
  const H = window.__H, rec = window.__rec;
  const r3 = v => typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : String(v)) : v;
  const arg = v => (v instanceof HTMLCanvasElement || v instanceof HTMLImageElement) ? '~el:' + (v.id || v.tagName) : (v && v.__gid) ? '~' + v.__gid : (v && typeof v === 'object' && !Array.isArray(v) && v.constructor && v.constructor.name === 'CanvasGradient') ? '~grad' : r3(v);
  /* canvas contexts */
  const realGet = HTMLCanvasElement.prototype.getContext;
  let cvN = 0;
  HTMLCanvasElement.prototype.getContext = function (kind, o) {
    const c = realGet.call(this, kind, o);
    if (kind !== '2d' || !c) { rec('getContext', this.id || 'canvas', kind); return c; }
    if (c.__recp) return c.__recp;
    const id = this.id || ('cv' + (++cvN));
    rec('getContext', id, kind);
    const p = new Proxy(c, {
      get(t, k) {
        const v = Reflect.get(t, k, t);
        if (typeof v !== 'function') return v;
        return (...a) => {
          rec('cx', id, String(k), ...a.map(arg));
          const res = v.apply(t, a);
          if (res && typeof res === 'object' && /Gradient|Pattern/.test(res.constructor && res.constructor.name || '')) { const add = res.addColorStop; if (add) res.addColorStop = (o2, col) => { rec('cx.stop', id, r3(o2), col); return add.call(res, o2, col); }; }
          if (k === 'getImageData') { let s = 0; for (let i = 0; i < res.data.length; i += 13) s = (s * 31 + res.data[i]) | 0; rec('cx.imageData', id, res.width, res.height, s); }
          if (k === 'measureText') rec('cx.measure', id, r3(res.width));
          return res;
        };
      },
      set(t, k, v) { rec('cx=', id, String(k), arg(v)); t[k] = v; return true; },
    });
    Object.defineProperty(c, '__recp', { value: p });
    return p;
  };
  /* a recording Graphics */
  let gN = 0;
  H.G = (name) => {
    const gid = (name || 'g') + (++gN), data = { __gid: gid, x: 0, y: 0, alpha: 1, rotation: 0, visible: true, children: [], parent: null };
    data.scale = { x: 1, y: 1, set(a, b) { rec('scale.set', gid, r3(a), b === undefined ? '~u' : r3(b)); this.x = a; this.y = b === undefined ? a : b; } };
    data.position = { set(a, b) { rec('position.set', gid, r3(a), r3(b)); data.x = a; data.y = b; } };
    data.pivot = { set(a, b) { rec('pivot.set', gid, r3(a), r3(b)); } };
    data.skew = { x: 0, y: 0, set(a, b) { rec('skew.set', gid, r3(a), r3(b)); } };
    const g = new Proxy(data, {
      get(t, k) {
        if (k in t || typeof k === 'symbol') return t[k];
        if (k === 'toJSON' || k === 'then' || k.startsWith('__')) return undefined;       // a script's own marker (view.__hound, view.__s) is unset until it sets it
        return (...a) => { rec('g', gid, String(k), ...a.map(x => x && typeof x === 'object' && !x.__gid ? JSON.stringify(x, (kk, vv) => r3(vv)) : arg(x))); if (k === 'addChild') for (const x of a) { if (x && x.__gid) { t.children.push(x); x.parent = g; } } if (k === 'removeChildren') t.children.length = 0; return g; };
      },
      set(t, k, v) { if (typeof k === 'string' && t[k] !== v) rec('g=', gid, k, arg(v)); t[k] = v; return true; },
    });
    return g;
  };
  H.Gclass = function GraphicsLike() { return H.G('gc'); };
  /* the page's elements, as the scripts left them */
  H.dom = () => [document.body.className].concat([...document.body.querySelectorAll('*')].filter(e => !e.closest('[data-harness]') && e.tagName !== 'SCRIPT')
    .map(e => [e.tagName, e.id, e.className && typeof e.className === 'string' ? e.className : '', e.getAttribute('style') || '', e.width !== undefined && e.tagName === 'CANVAS' ? e.width + 'x' + e.height : '', e.childElementCount ? '' : (e.textContent || '').slice(0, 60)]));
  /* Level 0, from L.O.S.T.'s server module (the same text on both sides), with this page's WORLD */
  if (window.__level0) H.level = window.__level0(window.WORLD, window.__level0Defs);   // (C4c) with the level's one definition
})();
