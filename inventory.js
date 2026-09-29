/* Inventory (TAB), light-source loadout + part customisation, and the cartograph item.
 *
 * - TAB opens a side drawer: your equipped light (with a live, close-up picture) and what you are carrying.
 *   The game keeps running while it is open; it is not a pause menu.
 * - There is no map by default. The Cartograph is a rare paranormal device that lies somewhere in each world; once you carry it,
 *   M opens its crude, unstable sketch of the halls.
 * - The "Light parts" block in the Customize panel lets you colour every element of your flashlight / torch / chestlamp.
 * The light art itself lives in the game bundle (window.__api.gear.draw); this file only re-plays it onto a 2D canvas for previews. */
(() => {
  const $ = id => document.getElementById(id);
  const KINDS = { flashlight: 'Flashlight', headlamp: 'Headlamp', lantern: 'Lantern', camcorder: 'Night Vision Camcorder' };
  const KIND_TEXT = {
    flashlight: 'A long, narrow, soft-edged beam that follows your mouse. The best reach there is, but it sees almost nothing to the sides.',
    headlamp: 'A wider cone strapped to your head. Hands-free and always where you look, with a shorter reach and a slightly dimmer beam.',
    lantern: 'A warm camping lantern carried at your side. It lights a circle around you, not what lies ahead. Short to medium reach.',
    camcorder: 'Gives off no light at all. Raise it and see the dark through the lens: grainy green-gray, zoomable with the wheel. The night-vision sensor overheats, so watch TEMP.',
  };
  const CARD_TEXT = {
    flashlight: 'Longest reach. Narrow, soft-edged beam that follows your mouse.',
    headlamp: 'Hands-free. Wider, shorter cone that follows where you look.',
    lantern: 'Warm glow all around you. Short reach, no aim needed.',
    camcorder: 'No light. Night vision through the lens; it overheats.',
  };
  const KIND_STATS = {           // [reach, spread] out of 5, shown on the loadout cards
    flashlight: [5, 1], headlamp: [3, 3], lantern: [2, 5], camcorder: null,
  };
  const KIND_KEYS = { camcorder: 'F raise / lower · N night vision · WHEEL zoom' };
  const DEF_COL = { flashlight: '#ffe7b2', headlamp: '#fff0c8', lantern: '#ffc98a', camcorder: '#ffe7b2' };
  const DRAW_X = { cr: 1, hat: 'none' };
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
    close() { close(); },
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
  function paintLight(cv, kind, scale, t, tilt, colour) {
    const A = window.__api; if (!A || !A.gear || !cv) return;
    const g = A.gear, eq = g.eq, c = cv.getContext('2d'), dpr = devicePixelRatio || 1, W = cv.clientWidth || cv.width / dpr, H = cv.clientHeight || cv.height / dpr;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const hex = colour || eq.color, P = g.parts(eq, kind), col = parseInt(hex.slice(1), 16);
    // soft pool of light behind it
    if (kind !== 'camcorder') { const gr = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, Math.min(W, H) * .55); gr.addColorStop(0, hex + '55'); gr.addColorStop(1, hex + '00'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
    else { const gr = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, Math.min(W, H) * .55); gr.addColorStop(0, '#5cff7a22'); gr.addColorStop(1, '#5cff7a00'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
    const SPAN = { flashlight: [34, -8, 0], headlamp: [40, -11, 0], lantern: [28, -9, 0], camcorder: [31, -2, -6.5] }[kind] || [34, -8, 0], k = Math.min(W, H) * scale / SPAN[0];
    c.save(); c.translate(W / 2, H / 2); c.rotate((kind === 'headlamp' ? tilt * .25 : tilt) + Math.sin(t * 1.1) * .04); c.scale(k, k); c.translate(-SPAN[2], -SPAN[1]);
    g.draw(new Rec(c), kind, P, col, true, t, -1, DRAW_X);
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
      <div class="inv-equip-info"><h3 id="invLightName">FLASHLIGHT</h3><p id="invLightText"></p><p class="inv-keys" id="invKeys"></p><div class="inv-sw" id="invSw"></div></div>
    </div>
    <div class="inv-row"><button id="invToggle" type="button">LIGHT ON <kbd>F</kbd></button></div>
    <div class="inv-label">CARRYING</div>
    <div class="inv-grid" id="invGrid"></div>
    <div class="inv-detail" id="invDetail"></div>`;
  document.body.appendChild(root);
  let items = [], ctx = { last: '' };

  function swatches() {
    const A = window.__api; if (!A || !A.gear) return '';
    const g = A.gear, k = g.eq.kind, P = g.parts(g.eq, k);
    return g.defs[k].map(d => `<i title="${d[1]}" style="background:${P[d[0]]}"></i>`).join('') + (k === 'camcorder' ? '' : `<i title="Beam" class="beam" style="background:${g.eq.color}"></i>`);
  }
  function render() {
    const A = window.__api; if (!A || !A.gear) return;
    const k = A.gear.eq.kind;
    $('invLightName').textContent = KINDS[k].toUpperCase();
    $('invLightText').textContent = KIND_TEXT[k];
    $('invSw').innerHTML = swatches();
    $('invKeys').textContent = KIND_KEYS[k] || '';
    const st = ($('lightStatus') && $('lightStatus').textContent) || 'ON', on = /\bON\b|RAISED/.test(st) && !/LOWERED/.test(st);
    $('invToggle').innerHTML = (k === 'camcorder' ? (on ? 'RAISED' : 'LOWERED') : on ? 'LIGHT ON' : 'LIGHT OFF') + ' <kbd>F</kbd>'; $('invToggle').classList.toggle('off', !on);
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
    if (ap && !ap.hidden && A && A.gear) { paintLight($('lightZoom'), A.gear.eq.kind, .82, t, -.42); document.querySelectorAll('#lightCards canvas').forEach(cv => paintLight(cv, cv.dataset.kind, .8, t, -.42, cv.dataset.kind === A.gear.eq.kind ? A.gear.eq.color : DEF_COL[cv.dataset.kind])); }
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
    if (b.id === 'invToggle') { $('touchFlash').click(); setTimeout(render, 30); return; }
    if (b.classList.contains('inv-slot')) { inv.sel = +b.dataset.i; render(); return; }
    if (b.id === 'invUse') { if (A && A.map) A.map(); setTimeout(render, 30); return; }
  });
  setInterval(() => { if (inv.open && blocked()) close(); }, 250);
  setInterval(() => { if (inv.open) { const s = ($('lightStatus') || {}).textContent || ''; if (s !== ctx.last) { ctx.last = s; render(); } } }, 400);

  /* ---------- light parts (Customize panel) ---------- */
  /* ---------- loadout cards (Customize panel) ---------- */
  const css = document.createElement('style');
  css.textContent = `
#lightCards{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 2px}
#lightCards .lc{display:grid;grid-template-columns:64px 1fr;gap:4px 10px;align-items:center;text-align:left;padding:8px 9px;background:#0b1413;border:1px solid #75807555;color:#cdd7cf;cursor:pointer;font:11px IBM Plex Mono,monospace;letter-spacing:.6px}
#lightCards .lc:hover:not(:disabled){border-color:#c9d99a}
#lightCards .lc.on{border-color:#e9d98a;background:#1a170a}
#lightCards .lc:disabled{cursor:not-allowed;opacity:.55}
#lightCards .lc.on:disabled{opacity:1}
#lightCards canvas{width:64px;height:64px;grid-row:1/3;background:#070c0b;border:1px solid #ffffff10}
#lightCards b{font-weight:600;letter-spacing:1.4px;font-size:11px;color:#f2ead0;align-self:end}
#lightCards small{font-size:9.5px;line-height:1.35;color:#9fada4;align-self:start;letter-spacing:.3px}
#lightCards i{display:block;font-style:normal;color:#e9d98a;font-size:9px;letter-spacing:1px;margin-top:3px}
#lightLock{grid-column:1/-1;font:10px/1.5 IBM Plex Mono,monospace;letter-spacing:.8px;color:#f0b48a;margin:2px 0 0}
.inv-keys{font-size:9.5px;letter-spacing:.8px;color:#c9d99a;margin:4px 0 2px}
#loadoutBtn{margin-top:10px;background:none;border:1px solid #75807588;color:#cdd7cf;padding:9px 14px;letter-spacing:2px;font:11px IBM Plex Mono,monospace;cursor:pointer}
#loadoutBtn:hover{border-color:#e9d98a;color:#f2ead0}
@media (max-width:560px){#lightCards{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
  const cards = Object.assign(document.createElement('div'), { id: 'lightCards', role: 'radiogroup' }), lockNote = Object.assign(document.createElement('p'), { id: 'lightLock' });
  const bar = n => '▮'.repeat(n) + '▯'.repeat(5 - n);
  function loadoutLocked() { const A = window.__api, c = $('caught'); return !!(A && A.started && A.started() && (!c || c.hidden)); }
  function buildCards() {
    const A = window.__api; if (!A || !A.gear) return;
    const k0 = A.gear.eq.kind, lock = loadoutLocked();
    cards.innerHTML = Object.keys(KINDS).map(k => {
      const st = KIND_STATS[k], line = st ? `REACH ${bar(st[0])} SPREAD ${bar(st[1])}` : 'NO LIGHT · NIGHT VISION';
      return `<button type="button" class="lc ${k === k0 ? 'on' : ''}" data-kind="${k}" role="radio" aria-checked="${k === k0}" ${lock ? 'disabled' : ''}><canvas data-kind="${k}" width="64" height="64"></canvas><b>${KINDS[k].toUpperCase()}</b><small>${CARD_TEXT[k]}<i>${line}</i></small></button>`;
    }).join('');
    lockNote.textContent = lock ? 'LOADOUT LOCKED · you carry one device per run. Get caught and choose again, or reload to start over.' : '';
    lockNote.hidden = !lock;
    const sel = $('lightKind'), lab = sel && sel.closest('label'); if (lab) lab.style.display = 'none';
    const lc = $('lightColor'), lcl = lc && lc.closest('label'); if (lcl) lcl.style.display = k0 === 'camcorder' ? 'none' : '';
    const d = $('lightDescription'); if (d) d.style.display = 'none';
    const host = $('lightParts'); if (host && cards.parentNode !== host.parentNode) { host.parentNode.insertBefore(lockNote, host); host.parentNode.insertBefore(cards, lockNote); }
    kick();
  }
  cards.addEventListener('click', e => {
    const b = e.target.closest('button.lc'); if (!b || b.disabled || loadoutLocked()) return;
    const k = b.dataset.kind, s = $('lightKind'); if (!s || s.value === k) return;
    s.value = k; s.dispatchEvent(new Event('change', { bubbles: true }));
    const lc = $('lightColor'); if (lc && Object.values(DEF_COL).includes(String(lc.value).toLowerCase())) { lc.value = DEF_COL[k]; lc.dispatchEvent(new Event('input', { bubbles: true })); }
    buildCards(); buildParts(); render();
  });
  // caught screen: pick a different device before respawning
  const lo = Object.assign(document.createElement('button'), { id: 'loadoutBtn', type: 'button', textContent: 'CHANGE LOADOUT' });
  const cp = document.querySelector('#caught .panel'); if (cp) cp.appendChild(lo);
  lo.addEventListener('click', () => { window.__loadout = true; $('customize').click(); });
  ['doneAppearance', 'closeAppearance'].forEach(id => { const b = $(id); b && b.addEventListener('click', () => { window.__loadout = false; }); });
  const zoom = Object.assign(document.createElement('canvas'), { id: 'lightZoom', width: 260, height: 170 });
  function buildParts() {
    const host = $('lightParts'), A = window.__api; if (!host || !A || !A.gear) return;
    const g = A.gear, k = g.eq.kind, P = g.parts(g.eq, k);
    host.innerHTML = `<div class="lp-head"><span>${KINDS[k].toUpperCase()} · PARTS</span><button type="button" id="lpReset">RESET</button></div>` +
      `<div class="lp-fields">${g.defs[k].map(d => `<label>${d[1]}<input type="color" data-part="${d[0]}" value="${P[d[0]]}"></label>`).join('')}</div>`;
    host.insertBefore(zoom, host.firstChild); buildCards();
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
  document.addEventListener('change', e => { if (e.target && e.target.id === 'lightKind') { buildParts(); buildCards(); render(); } });
  const cust = $('customize'); if (cust) cust.addEventListener('click', () => setTimeout(() => { buildParts(); buildCards(); kick(); }, 30));
  const init = () => { if (window.__api && window.__api.gear) { buildParts(); render(); } else setTimeout(init, 300); };
  init();
  // used by tests
  inv._paint = paintLight;
})();
