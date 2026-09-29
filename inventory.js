/* Inventory (TAB), light-source part customisation, and the cartograph item.
 *
 * - TAB opens a side drawer: your equipped light (with a live, close-up picture) and what you are carrying.
 *   The game keeps running while it is open; it is not a pause menu.
 * - There is no map by default. The Cartograph is a rare paranormal device that lies somewhere in each world; once you carry it,
 *   M opens its crude, unstable sketch of the halls.
 * - The "Light parts" block in the Customize panel lets you colour every element of your flashlight / torch / chestlamp.
 * The light art itself lives in the game bundle (window.__api.gear.draw); this file only re-plays it onto a 2D canvas for previews. */
(() => {
  const $ = id => document.getElementById(id);
  const KINDS = { flashlight: 'Flashlight', chestlamp: 'Chestlamp', torch: 'Torch' };
  const KIND_TEXT = {
    flashlight: 'A narrow handheld beam. It rides in your hand, so it lags behind your aim and shuffles as you walk.',
    chestlamp: 'A wide, short beam strapped to your chest. It points where you move.',
    torch: 'A short, flickering light in every direction. It sways in your fist as you walk.',
  };
  const ITEMS = {
    cartograph: {
      name: 'CARTOGRAPH', tag: 'PARANORMAL DEVICE',
      desc: 'Nobody made this. It hums against your palm and draws the halls in shaky lines. It knows the layout, almost. The farther from you, the less it can be trusted.',
      use: 'M',
    },
  };

  /* ---------- state ---------- */
  const inv = window.__inv = {
    items: [], sel: -1, open: false,
    has(id) { return this.items.includes(id); },
    give(id, found) {
      if (!ITEMS[id] || this.has(id)) return false;
      this.items.push(id); this.sel = this.items.length - 1;
      if (found) { toast('FOUND · ' + ITEMS[id].name, 'Press TAB to see what you are carrying. M opens it.'); const A = window.__api, z = A && A.audio && A.audio(); try { z && z.collect && z.collect(); } catch { } }
      render(); return true;
    },
    reset() { this.items = []; this.sel = -1; close(); render(); },
    toggle() { this.open ? close() : openInv(); },
  };

  /* ---------- toast ---------- */
  const toastEl = Object.assign(document.createElement('div'), { id: 'invToast', hidden: true });
  document.body.appendChild(toastEl);
  let toastT = 0;
  function toast(a, b) {
    toastEl.innerHTML = '<b>' + a + '</b>' + (b ? '<span>' + b + '</span>' : ''); toastEl.hidden = false; toastEl.classList.remove('in'); void toastEl.offsetWidth; toastEl.classList.add('in');
    clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 5200);
  }

  /* ---------- 2D replay of the game's own light art ---------- */
  class Rec {
    constructor(c) { this.c = c; this.ops = []; this.done = false; }
    _a(f) { if (this.done) { this.ops = []; this.done = false; } this.ops.push(f); return this; }
    rect(x, y, w, h) { return this._a(p => p.rect(x, y, w, h)); }
    roundRect(x, y, w, h, r = 0) { return this._a(p => p.roundRect(x, y, w, h, r)); }
    ellipse(x, y, rx, ry) { return this._a(p => { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }); }
    circle(x, y, r) { return this.ellipse(x, y, r, r); }
    poly(a) { return this._a(p => { p.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) p.lineTo(a[i], a[i + 1]); p.closePath(); }); }
    moveTo(x, y) { return this._a(p => p.moveTo(x, y)); }
    lineTo(x, y) { return this._a(p => p.lineTo(x, y)); }
    quadraticCurveTo(a, b, x, y) { return this._a(p => p.quadraticCurveTo(a, b, x, y)); }
    _path() { const p = new Path2D(); for (const f of this.ops) f(p); return p; }
    _col(v) { const n = typeof v === 'number' ? v : v.color, al = typeof v === 'number' ? 1 : (v.alpha ?? 1); return [`#${(n >>> 0).toString(16).padStart(6, '0')}`, al]; }
    fill(v) { const [c, a] = this._col(v); this.c.save(); this.c.globalAlpha = a; this.c.fillStyle = c; this.c.fill(this._path()); this.c.restore(); this.done = true; return this; }
    stroke(v) { const [c, a] = this._col(v); this.c.save(); this.c.globalAlpha = a; this.c.strokeStyle = c; this.c.lineWidth = v.width ?? 1; this.c.lineCap = v.cap || 'butt'; this.c.lineJoin = v.join || 'miter'; this.c.stroke(this._path()); this.c.restore(); this.done = true; return this; }
  }
  function paintLight(cv, kind, scale, t, tilt) {
    const A = window.__api; if (!A || !A.gear || !cv) return;
    const g = A.gear, eq = g.eq, c = cv.getContext('2d'), dpr = devicePixelRatio || 1, W = cv.clientWidth || cv.width / dpr, H = cv.clientHeight || cv.height / dpr;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const P = g.parts(eq, kind), col = parseInt(eq.color.slice(1), 16);
    // soft pool of light behind it
    const gr = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, Math.min(W, H) * .55); gr.addColorStop(0, eq.color + '55'); gr.addColorStop(1, eq.color + '00'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const SPAN = { flashlight: [34, -8], torch: [58, -16], chestlamp: [36, -8] }[kind] || [34, -8], k = Math.min(W, H) * scale / SPAN[0];
    c.save(); c.translate(W / 2, H / 2); c.rotate(tilt + Math.sin(t * 1.1) * .04); c.scale(k, k); c.translate(0, -SPAN[1]);
    g.draw(new Rec(c), kind, P, col, true, t, -1);
    c.restore();
  }
  function paintCartograph(cv, t) {
    if (!cv) return; const c = cv.getContext('2d'), dpr = devicePixelRatio || 1, W = cv.clientWidth || 64, H = cv.clientHeight || 64;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    c.setTransform(dpr * W / 64, 0, 0, dpr * H / 64, 0, 0); c.clearRect(0, 0, 64, 64);
    c.save(); c.translate(32, 33); c.rotate(-.12);
    c.strokeStyle = '#9aa08a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(11, -22); c.lineTo(15, -30); c.stroke(); c.fillStyle = '#c9d2b0'; c.beginPath(); c.arc(15, -30, 1.7, 0, 7); c.fill();
    c.fillStyle = '#2b2a22'; c.strokeStyle = '#0d0d0a'; c.lineWidth = 1.4; c.beginPath(); c.roundRect(-16, -22, 32, 44, 5); c.fill(); c.stroke();
    c.fillStyle = '#07100a'; c.beginPath(); c.roundRect(-12, -18, 24, 26, 2); c.fill();
    c.strokeStyle = 'rgba(206,196,120,.85)'; c.lineWidth = 1; c.beginPath();
    const j = Math.floor(t * 4); const r = k => { const x = Math.sin(k * 12.9 + j * 4.1) * 43758.5; return x - Math.floor(x); };
    c.moveTo(-9 + r(1), -14 + r(2)); c.lineTo(2 + r(3), -14 + r(4)); c.lineTo(2 + r(5), -3 + r(6)); c.lineTo(8 + r(7), -3 + r(8)); c.lineTo(8 + r(9), 4); c.moveTo(-9, -3 + r(10)); c.lineTo(-3 + r(11), -3); c.lineTo(-3, 4 + r(12)); c.stroke();
    c.fillStyle = '#fff1a7'; c.beginPath(); c.arc(-3 + Math.sin(t * .9) * 2, 1 + Math.cos(t * .7) * 2, 1.5, 0, 7); c.fill();
    c.fillStyle = '#6d6a52'; c.beginPath(); c.arc(-6, 15, 3.4, 0, 7); c.fill(); c.fillStyle = '#a63b32'; c.beginPath(); c.arc(5, 15, 1.7, 0, 7); c.fill(); c.fillStyle = '#4c4a3a'; c.fillRect(9, 13.5, 4.5, 3);
    c.restore();
  }

  /* ---------- DOM ---------- */
  const root = document.createElement('aside');
  root.id = 'inventory'; root.hidden = true; root.setAttribute('aria-label', 'Inventory');
  root.innerHTML = `
    <div class="inv-head"><b>INVENTORY</b><span><kbd>TAB</kbd> to close</span></div>
    <div class="inv-label">EQUIPPED · LIGHT</div>
    <div class="inv-equip">
      <canvas id="invLight" width="132" height="132"></canvas>
      <div class="inv-equip-info"><h3 id="invLightName">FLASHLIGHT</h3><p id="invLightText"></p><div class="inv-sw" id="invSw"></div></div>
    </div>
    <div class="inv-kinds" id="invKinds"></div>
    <div class="inv-row"><button id="invToggle" type="button">LIGHT ON <kbd>F</kbd></button><button id="invCustom" type="button">CUSTOMIZE</button></div>
    <div class="inv-label">CARRYING</div>
    <div class="inv-grid" id="invGrid"></div>
    <div class="inv-detail" id="invDetail"></div>`;
  document.body.appendChild(root);
  let items = [], ctx = { last: '' };

  function swatches() {
    const A = window.__api; if (!A || !A.gear) return '';
    const g = A.gear, k = g.eq.kind, P = g.parts(g.eq, k);
    return g.defs[k].map(d => `<i title="${d[1]}" style="background:${P[d[0]]}"></i>`).join('') + `<i title="Beam" class="beam" style="background:${g.eq.color}"></i>`;
  }
  function render() {
    const A = window.__api; if (!A || !A.gear) return;
    const k = A.gear.eq.kind;
    $('invLightName').textContent = KINDS[k].toUpperCase();
    $('invLightText').textContent = KIND_TEXT[k];
    $('invSw').innerHTML = swatches();
    $('invKinds').innerHTML = Object.keys(KINDS).map(x => `<button type="button" data-kind="${x}" class="${x === k ? 'on' : ''}">${KINDS[x]}</button>`).join('');
    const on = /ON/.test(($('lightStatus') && $('lightStatus').textContent) || 'ON');
    $('invToggle').innerHTML = (on ? 'LIGHT ON' : 'LIGHT OFF') + ' <kbd>F</kbd>'; $('invToggle').classList.toggle('off', !on);
    const slots = 6, grid = [];
    for (let i = 0; i < slots; i++) {
      const id = inv.items[i];
      grid.push(id ? `<button type="button" class="inv-slot full ${i === inv.sel ? 'sel' : ''}" data-i="${i}" title="${ITEMS[id].name}"><canvas class="inv-ic" data-id="${id}" width="64" height="64"></canvas><span>${ITEMS[id].name}</span></button>` : `<div class="inv-slot empty"><span>—</span></div>`);
    }
    $('invGrid').innerHTML = grid.join('');
    const id = inv.items[inv.sel];
    if (id) {
      const it = ITEMS[id], showing = window.__api.mapOpen && window.__api.mapOpen();
      $('invDetail').innerHTML = `<div class="inv-tag">${it.tag}</div><h4>${it.name}</h4><p>${it.desc}</p><button type="button" id="invUse">${showing ? 'PUT AWAY' : 'OPEN'} <kbd>${it.use}</kbd></button>`;
    } else {
      $('invDetail').innerHTML = `<p class="inv-empty">${inv.items.length ? 'Select something.' : 'Your pockets are empty. Something out in the halls might be worth carrying.'}</p>`;
    }
  }

  /* ---------- open / close ---------- */
  let raf = 0;
  function frame() {
    raf = 0;
    const t = performance.now() / 1000, A = window.__api;
    if (inv.open && A && A.gear) {
      paintLight($('invLight'), A.gear.eq.kind, .8, t, -.5);
      root.querySelectorAll('.inv-ic').forEach(cv => paintCartograph(cv, t));
    }
    const ap = $('appearancePanel');
    if (ap && !ap.hidden && A && A.gear) paintLight($('lightZoom'), A.gear.eq.kind, .82, t, -.42);
    if (inv.open || (ap && !ap.hidden)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function blocked() {
    return ['dialog', 'caught', 'won', 'menu'].some(id => { const el = $(id); return el && !el.hidden; }) || !($('appearancePanel') || {}).hidden;
  }
  function openInv() {
    const A = window.__api; if (!A || !A.started() || blocked()) return;
    inv.open = true; root.hidden = false; render(); kick();
    if (inv.sel < 0 && inv.items.length) inv.sel = 0;
  }
  function close() { inv.open = false; root.hidden = true; }

  /* ---------- input ---------- */
  addEventListener('keydown', e => {
    const A = window.__api; if (!A || !A.started()) return;
    const tgt = e.target, typing = tgt instanceof HTMLInputElement || tgt instanceof HTMLSelectElement || tgt instanceof HTMLTextAreaElement;
    if (e.code === 'Tab') {
      if (($('appearancePanel') || {}).hidden === false) return;                 // the customize panel keeps its own focus trap
      if (typing && tgt.id !== 'name') return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) inv.toggle();
      return;
    }
    if (inv.open && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  // aiming must not follow the mouse while it is over the drawer
  addEventListener('pointermove', e => { if (inv.open && e.target instanceof Element && e.target.closest('#inventory')) e.stopImmediatePropagation(); }, true);
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const A = window.__api;
    if (b.dataset.kind) { const s = $('lightKind'); s.value = b.dataset.kind; s.dispatchEvent(new Event('change', { bubbles: true })); buildParts(); render(); return; }
    if (b.id === 'invToggle') { $('touchFlash').click(); setTimeout(render, 30); return; }
    if (b.id === 'invCustom') { close(); $('customize').click(); setTimeout(() => { const p = $('lightParts'); if (p) p.scrollIntoView({ block: 'center' }); }, 60); return; }
    if (b.classList.contains('inv-slot')) { inv.sel = +b.dataset.i; render(); return; }
    if (b.id === 'invUse') { if (A && A.map) A.map(); setTimeout(render, 30); return; }
  });
  setInterval(() => { if (inv.open && blocked()) close(); }, 250);
  setInterval(() => { if (inv.open) { const s = ($('lightStatus') || {}).textContent || ''; if (s !== ctx.last) { ctx.last = s; render(); } } }, 400);

  /* ---------- light parts (Customize panel) ---------- */
  const zoom = Object.assign(document.createElement('canvas'), { id: 'lightZoom', width: 260, height: 170 });
  function buildParts() {
    const host = $('lightParts'), A = window.__api; if (!host || !A || !A.gear) return;
    const g = A.gear, k = g.eq.kind, P = g.parts(g.eq, k);
    host.innerHTML = `<div class="lp-head"><span>${KINDS[k].toUpperCase()} · PARTS</span><button type="button" id="lpReset">RESET</button></div>` +
      `<div class="lp-fields">${g.defs[k].map(d => `<label>${d[1]}<input type="color" data-part="${d[0]}" value="${P[d[0]]}"></label>`).join('')}</div>`;
    host.insertBefore(zoom, host.firstChild);
    zoom.setAttribute('aria-label', 'Close-up of your light source');
    kick();
  }
  document.addEventListener('input', e => {
    const t = e.target; if (!(t instanceof HTMLInputElement) || !t.dataset.part) return;
    const A = window.__api, g = A.gear, k = g.eq.kind; (g.eq.parts[k] || (g.eq.parts[k] = {}))[t.dataset.part] = t.value; g.save(); render();
  });
  document.addEventListener('click', e => {
    if (!(e.target instanceof Element) || e.target.id !== 'lpReset') return;
    const g = window.__api.gear, k = g.eq.kind; g.eq.parts[k] = Object.fromEntries(g.defs[k].map(d => [d[0], d[2]])); g.save(); buildParts(); render();
  });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'lightKind') { buildParts(); render(); } });
  const cust = $('customize'); if (cust) cust.addEventListener('click', () => setTimeout(() => { buildParts(); kick(); }, 30));
  const init = () => { if (window.__api && window.__api.gear) { buildParts(); render(); } else setTimeout(init, 300); };
  init();
  // used by tests
  inv._paint = paintLight;
})();
