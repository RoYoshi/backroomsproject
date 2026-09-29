/* Network + dread layer.
 * - Talks to server.js over a WebSocket. When connected, the server owns the Hound, Smilers,
 *   blackouts and evidence; this file mirrors them into the game's own objects every frame.
 * - Falls back to the game's built-in single-player AI when there is no server.
 * - Also draws other wanderers and adds the proximity scare effects. */
(() => {
const cv = document.getElementById('mp'), cx = cv.getContext('2d'), dread = document.getElementById('dread'),
  game = document.getElementById('game'), light = document.getElementById('light'),
  net = Object.assign(document.createElement('div'), { id: 'net', textContent: 'SOLO' });
document.body.appendChild(net);
const room = new URLSearchParams(location.search).get('room') || 'main';

let ws, retry = 0, myId = null, lastSend = 0, everConnected = false;
let snap = null, me = '', mseq = 0, handled = 0, wonShown = false, peersN = 0, kicked = false;
const adm = { unlocked: false, pass: null, open: false, data: null, you: null, err: '', sigP: '', sigW: '' };
const peers = new Map(), pending = {};          // pending: evidence indices we just picked up locally
const N = window.__net = {
  on: false,
  tick() {                                          // called by the game's fixed-step loop while online
    const A = window.__api;
    if (A && me && mseq > handled && !A.G.caught) { handled = mseq; A.G.caught = true; A.G.caughtBy = me; }
  },
  join() { tx({ t: 'join' }); },
  respawn() { handled = Math.max(handled, mseq); tx({ t: 'respawn' }); },
  collected(i) { const H = window.__api && window.__api.H; if (i >= 0 && H) { pending[i] = performance.now(); tx({ t: 'c', i, x: Math.round(H.x), y: Math.round(H.y) }); } },
};
const tx = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function connect() {
  if (location.protocol === 'file:') return;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(room)); } catch { return; }
  ws.onopen = () => {
    retry = 0; handled = 0; mseq = 0; me = ''; everConnected = true;
    const A = window.__api; if (A && A.started()) tx({ t: 'join' });      // re-enter the world after a reconnect
    if (adm.pass) tx({ t: 'admin', pass: adm.pass });                         // stay unlocked across reconnects (kept in memory only)
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hi') myId = m.id;
    else if (m.t === 'admin') {
      adm.unlocked = !!m.ok; adm.err = m.ok ? '' : (m.wait ? 'TOO MANY TRIES · WAIT ' + m.wait + 'S' : 'WRONG PASSCODE');
      if (!m.ok) adm.pass = null;
      renderAdmin();
    }
    else if (m.t === 'tp') { const A = window.__api; A && A.tp(m.x, m.y); }
    else if (m.t === 'revive') { const A = window.__api; A && A.revive(); }
    else if (m.t === 'msg') showMsg(m.text, m.from);
    else if (m.t === 'kick') { kicked = true; document.getElementById('kicked').hidden = false; }
    else if (m.t === 's') {
      const now = performance.now(), seen = new Set();
      for (const p of m.p) {
        seen.add(p.id);
        const o = peers.get(p.id) || { x: p.x, y: p.y };
        Object.assign(o, p, { tx: p.x, ty: p.y, seen: now }); peers.set(p.id, o);
      }
      for (const [id, o] of peers) if (!seen.has(id)) { dropAvatar(o); peers.delete(id); }
      peersN = m.p.length; me = m.me || ''; mseq = m.ms | 0;
      if (m.e) { snap = m.e; N.on = true; }
      if (m.ad) { adm.data = m.ad; adm.you = m.you; renderAdminData(); }
    }
  };
  ws.onclose = () => {
    N.on = false; snap = null; for (const o of peers.values()) dropAvatar(o); peers.clear(); window.__peerLights = [];
    net.textContent = everConnected ? 'SOLO · RECONNECTING' : 'SOLO';
    adm.unlocked = false; renderAdmin();
    if (!kicked) setTimeout(connect, Math.min(8000, 1000 * ++retry));
  };
}
connect();

/* ---------- mirror the server's monsters into the game ---------- */
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function follow(o, t, k) {                          // smooth toward the server position, snap if far
  const px = o.x, py = o.y;
  if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; } else { o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; }
  o.angle += angDiff(t.a, o.angle) * k;
  o.distance += Math.hypot(o.x - px, o.y - py);
  if (Math.abs(o.distance - t.d) > 150) o.distance = t.d;
  o.state = t.s;
}
function applyServerState(dt) {
  const A = window.__api, s = snap;
  if (!A || !s) return;
  const k = 1 - Math.exp(-dt * 15);
  follow(A.G, s.h, k); A.G.grace = s.h.g; A.G.pressure = s.h.p;
  s.m.forEach((t, i) => A.q[i] && follow(A.q[i], t, k));
  A.V.blackout = !!s.b;
  let changed = false; const now = performance.now();
  A.el.forEach((e, i) => {
    let f = s.ev[i] === '1';
    if (!f && pending[i] && now - pending[i] < 2500) f = true;    // our own pickup, server not caught up yet
    if (f !== e.found) { e.found = f; changed = true; }
  });
  if (changed) A.yu();
  if (s.w && !wonShown && A.started()) { A.win(); }
  if (wonShown && !s.w && A.unwin) A.unwin();
  wonShown = !!s.w;
}

/* ---------- audio ---------- */
let ac, drone, dg, beatT = 0;
const soundOn = () => /ON/.test(document.getElementById('sound')?.textContent || 'ON');
function initAudio() {
  if (ac) return;
  try {
    ac = new AudioContext();
    drone = ac.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 43;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    dg = ac.createGain(); dg.gain.value = 0;
    drone.connect(f).connect(dg).connect(ac.destination); drone.start();
  } catch {}
}
addEventListener('pointerdown', initAudio); addEventListener('keydown', initAudio);
function thump(v, f) {
  if (!ac || !soundOn()) return;
  const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
  o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(38, n + .16);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + .2);
  o.connect(g).connect(ac.destination); o.start(n); o.stop(n + .22);
}
function burst(len, v) {
  if (!ac || !soundOn()) return;
  const b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.5;
  const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = v; s.buffer = b; s.connect(g).connect(ac.destination); s.start();
}
new MutationObserver(() => { if (document.body.classList.contains('captured')) burst(1.1, .9); })
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* online note on the pause screen */
const pauseNote = document.querySelector('#dialog .lore-credit');
if (pauseNote) {
  const n = document.createElement('p'); n.className = 'lore-credit'; n.id = 'onlineNote'; n.hidden = true;
  n.textContent = 'Online: pausing does not stop the halls. The monsters keep moving.';
  pauseNote.before(n);
}


/* ---------- other wanderers ---------- */
const tip = Object.assign(document.createElement('div'), { id: 'peerTip' });
document.body.appendChild(tip);
let mx = -1e3, my = -1e3;
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } });
let view = null;
const parseLook = s => { const [hat, texture, hands, main, backpack] = String(s || 'none|plain|#e6bb76|#ffcc77|none').split('|'); return { hat, texture, hands, main, backpack }; };
function dropAvatar(o) { if (o.av) { o.av.parent && o.av.parent.removeChild(o.av); o.av.destroy({ children: true }); o.av = null; } }
setInterval(() => { for (const [id, o] of [...peers]) if (!peers.has(id)) dropAvatar(o); }, 2000);

function drawPeers(p, cam, sc, los, dt, W, H) {
  const A = window.__api; const lights = []; let hover = null, best = 1e9;
  const layer = A && A.layer && A.layer();
  const now = performance.now() / 1000;
  view = { cam, sc, W, H };
  for (const o of peers.values()) {
    const px = o.x, py = o.y;
    o.x += (o.tx - o.x) * .3; o.y += (o.ty - o.y) * .3;
    const step = Math.hypot(o.x - px, o.y - py), inv = 1 / Math.max(dt, .001);
    o.vx = (o.vx || 0) + (((o.x - px) * inv) - (o.vx || 0)) * .25;
    o.vy = (o.vy || 0) + (((o.y - py) * inv) - (o.vy || 0)) * .25;
    o.dist = (o.dist || 0) + step;
    o.ang = o.ang === undefined ? o.a : o.ang + angDiff(o.a, o.ang) * .35;
    if (A && A.mkAvatar && layer) {
      if (!o.av) { o.look = parseLook(o.lk); o.gear = { kind: o.k || 'flashlight', color: o.c || '#ffe7b2' }; o.av = A.mkAvatar(o.look, o.gear); layer.addChild(o.av); }
      Object.assign(o.look, parseLook(o.lk)); o.gear.kind = o.k || 'flashlight'; o.gear.color = o.c || '#ffe7b2';
      o.src = Object.assign(o.src || {}, { x: o.x, y: o.y, angle: o.ang, vx: o.vx, vy: o.vy, distance: o.dist });
      o.av.update(now, !!o.l && !o.d, false, o.src);
      if (o.d) o.av.deathPose(1, 0, false);
    }
    const dx = o.x - p.x, dy = o.y - p.y, dist = Math.hypot(dx, dy);
    if (dist < 950) lights.push({ x: o.x, y: o.y, angle: o.ang, kind: o.k || 'flashlight', color: o.c || '#ffe7b2', on: !!o.l, dead: !!o.d });
    /* hover: only for wanderers you can actually see (in line of sight and lit) */
    const sx = W / 2 + (o.x - cam.x) * sc, sy = H / 2 + (o.y - cam.y) * sc;
    const dm = Math.hypot(mx - sx, my - sy);
    if (dm < 30 * sc && dm < best && dist < 800 && (dist < 30 || !los || los(p.x, p.y, Math.atan2(dy, dx), dist) >= dist - 20)) {
      best = dm; hover = { o, sx, sy };          // every wanderer carries a small aura, so anyone in line of sight is visible
    }
  }
  window.__peerLights = lights;
  if (hover) {
    tip.textContent = (hover.o.n || 'WANDERER') + (hover.o.d ? ' · DOWN' : '');
    tip.style.left = hover.sx + 'px'; tip.style.top = (hover.sy - 26 * sc) + 'px'; tip.style.display = 'block';
  } else tip.style.display = 'none';
}
N.peerScreen = () => peers.size && view ? [...peers.values()].map(o => ({ n: o.n, look: o.lk, kind: o.k, color: o.c, lightOn: o.l, hasAvatar: !!o.av,
  sx: view.W / 2 + (o.x - view.cam.x) * view.sc, sy: view.H / 2 + (o.y - view.cam.y) * view.sc })) : [];



/* ---------- admin menu (press ` ) ---------- */
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const panel = document.createElement('div'); panel.id = 'adminPanel'; panel.hidden = true;
panel.innerHTML = `<div class="adm-head"><b>ADMIN</b><span id="admWho"></span><button class="adm" data-a="close" aria-label="Close admin">✕</button></div>
<div id="admLogin"><label for="admPass">PASSCODE</label><div class="adm-row"><input id="admPass" type="password" autocomplete="off" maxlength="40"><button class="adm" data-a="unlock">UNLOCK</button></div><p class="adm-note" id="admErr"></p></div>
<div id="admMain" hidden><div id="admPlayers"></div><div id="admWorld"></div>
<div class="adm-sec">BROADCAST</div><div class="adm-row"><input id="admText" maxlength="140" placeholder="Message to everyone" autocomplete="off"><button class="adm" data-a="msg">SEND</button></div></div>`;
document.body.appendChild(panel);
const banner = Object.assign(document.createElement('div'), { id: 'adminMsg', hidden: true }); document.body.appendChild(banner);
const kickedBox = Object.assign(document.createElement('div'), { id: 'kicked', hidden: true, innerHTML: '<div><h2>Removed by an admin.</h2><p>Reload the page to rejoin.</p></div>' }); document.body.appendChild(kickedBox);
let msgTimer = 0;
function showMsg(text, from) {
  banner.textContent = (from ? from + ': ' : '') + text; banner.hidden = false;
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { banner.hidden = true; }, 8000);
}
const $a = id => document.getElementById(id);
function renderAdmin() {
  panel.hidden = !adm.open;
  $a('admLogin').hidden = adm.unlocked; $a('admMain').hidden = !adm.unlocked;
  $a('admErr').textContent = ws && ws.readyState === 1 ? adm.err : 'Admin needs the online server (not available in solo mode).';
  $a('admWho').textContent = adm.unlocked ? ' · ROOM ' + room.toUpperCase() : '';
  if (adm.open && !adm.unlocked) setTimeout(() => $a('admPass').focus(), 0);
  if (adm.unlocked) renderAdminData();
}
function renderAdminData() {
  const d = adm.data; if (!adm.open || !adm.unlocked || !d) return;
  const btn = (label, attrs, on) => `<button class="adm${on ? ' on' : ''}" ${attrs}>${label}</button>`;
  const players = d.pl.map(pl => {
    const you = pl.id === adm.you, tags = [you ? 'YOU' : '', pl.ad ? 'ADMIN' : '', !pl.a ? 'MENU' : '', pl.d ? 'DOWN' : '', pl.g ? 'GOD' : ''].filter(Boolean).join(' · ');
    return `<div class="adm-player"><div><b>${esc(pl.n || 'WANDERER')}</b> <i>${tags}</i></div><div class="adm-row wrap">` +
      (you ? '' : btn('BRING', `data-c="bring" data-id="${pl.id}"`) + btn('GO TO', `data-c="goto" data-id="${pl.id}"`)) +
      (pl.d ? btn('REVIVE', `data-c="revive" data-id="${pl.id}"`) : '') + btn('GOD', `data-c="god" data-id="${pl.id}"`, pl.g) +
      (you ? '' : btn('KICK', `data-c="kick" data-id="${pl.id}" data-confirm="Kick ${esc(pl.n)}?"`)) + '</div></div>';
  }).join('');
  const sp = v => btn(v + '×', `data-c="speed" data-v="${v}"`, d.sp === v);
  const world = `<div class="adm-sec">MONSTERS · HOUND ${esc(d.hs).toUpperCase()}</div><div class="adm-row wrap">` +
    btn(d.fz ? 'FROZEN' : 'FREEZE', `data-c="freeze" data-on="${d.fz ? 0 : 1}"`, d.fz) + btn('SUMMON HOUND TO ME', 'data-c="summon"') + btn('RESET', 'data-c="monsters"') + '</div>' +
    `<div class="adm-sec">WORLD SPEED</div><div class="adm-row wrap">${sp(0.5)}${sp(1)}${sp(2)}${sp(3)}</div>` +
    `<div class="adm-sec">LIGHTS</div><div class="adm-row wrap">` + ['auto', 'on', 'off'].map(m => btn(m === 'auto' ? 'AUTO' : 'BLACKOUT ' + m.toUpperCase(), `data-c="blackout" data-mode="${m}"`, d.bo === m)).join('') + '</div>' +
    `<div class="adm-sec">EVIDENCE ${d.ev} / 8${d.won ? ' · CLEARED' : ''}</div><div class="adm-row wrap">` + btn('COMPLETE ALL', 'data-c="evidence" data-mode="all"') + btn('RESET', 'data-c="evidence" data-mode="reset"') + '</div>' +
    `<div class="adm-sec">RUN</div><div class="adm-row wrap">` + btn('NEW RUN FOR EVERYONE', 'data-c="world" data-confirm="Reset the whole world?"') + '</div>';
  if (players !== adm.sigP) { $a('admPlayers').innerHTML = '<div class="adm-sec">WANDERERS</div>' + players; adm.sigP = players; }
  if (world !== adm.sigW) { $a('admWorld').innerHTML = world; adm.sigW = world; }
}
function toggleAdmin() { adm.open = !adm.open; renderAdmin(); }
function unlock() { const v = $a('admPass').value; if (!v) return; adm.pass = v; adm.err = ''; tx({ t: 'admin', pass: v }); $a('admPass').value = ''; }
function sendMsg() { const el = $a('admText'), text = el.value.trim(); if (text) { tx({ t: 'a', c: 'msg', text }); el.value = ''; } }
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'close') { adm.open = false; renderAdmin(); return; }
  if (b.dataset.a === 'unlock') return unlock();
  if (b.dataset.a === 'msg') return sendMsg();
  if (!b.dataset.c) return;
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  const o = { t: 'a', c: b.dataset.c };
  if (b.dataset.id) o.id = +b.dataset.id;
  if (b.dataset.v) o.v = +b.dataset.v;
  if (b.dataset.mode) o.mode = b.dataset.mode;
  if (b.dataset.on !== undefined) o.on = +b.dataset.on;
  tx(o);
});
panel.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (e.target.id === 'admPass') unlock(); else if (e.target.id === 'admText') sendMsg(); } if (e.key === 'Escape') { adm.open = false; renderAdmin(); } });
addEventListener('keydown', e => { if (e.code === 'Backquote' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleAdmin(); } });

/* ---------- fluorescent light hum ---------- */
/* Modelled on an old magnetic ballast: a 60 Hz mains buzz that is strongest at 120 Hz with a long tail of
 * harmonics, two slightly detuned copies beating slowly, a band of arc hiss chopped at 120 Hz, and a very
 * faint high whine. It is loudest near ceiling fixtures (and pans toward the nearest one), stutters with the
 * flickering fixtures, pops and crackles at random, and drops out with a thunk when a blackout hits and
 * comes back with a ballast-strike stutter. All levels are pre-master (the game's master gain is 0.14). */
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function buildHum(ctx, dest) {
  const out = ctx.createGain(); out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { out.connect(pan); pan.connect(dest); } else out.connect(dest);
  const src = [];
  const amps = [0, .42, 1, .5, .62, .24, .34, .12, .18, .07];              // harmonics 1..9 of 60 Hz
  const wave = ctx.createPeriodicWave(new Float32Array(amps.length), Float32Array.from(amps));
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = .4;
  const buzz = ctx.createGain(); buzz.gain.value = .2; lp.connect(buzz); buzz.connect(out);
  for (const f of [60.0, 60.42]) {                                          // slow beating between the two
    const o = ctx.createOscillator(); o.setPeriodicWave(wave); o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = .5; o.connect(g); g.connect(lp); src.push(o);
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = .23;            // the buzz slowly breathes
  const lfoG = ctx.createGain(); lfoG.gain.value = .02; lfo.connect(lfoG); lfoG.connect(buzz.gain); src.push(lfo);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;      // arc hiss, chopped at 120 Hz
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3100; bp.Q.value = .8;
  const hiss = ctx.createGain(); hiss.gain.value = .05;
  const am = ctx.createOscillator(); am.frequency.value = 120; const amG = ctx.createGain(); amG.gain.value = .05;
  am.connect(amG); amG.connect(hiss.gain); ns.connect(bp); bp.connect(hiss); hiss.connect(out); src.push(am);
  const wh = ctx.createOscillator(); wh.frequency.value = 9300;             // faint ballast whine, drifting
  const whG = ctx.createGain(); whG.gain.value = .0022; wh.connect(whG); whG.connect(out);
  const dr = ctx.createOscillator(); dr.frequency.value = .07; const drG = ctx.createGain(); drG.gain.value = 40;
  dr.connect(drG); drG.connect(wh.frequency); src.push(wh, dr);
  src.forEach(o => o.start()); ns.start();
  return { ctx, dest, out, pan, buzz, hiss };
}
function humPop(h, vol, when) {                                              // tiny electrical crackle
  const c = h.ctx, len = Math.floor(c.sampleRate * (.006 + Math.random() * .02));
  const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * .25));
  const s = c.createBufferSource(); s.buffer = b;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900 + Math.random() * 1400;
  const g = c.createGain(); g.gain.value = vol; s.connect(hp); hp.connect(g); g.connect(h.out); s.start(when ?? c.currentTime);
}
function humThunk(h, when) {                                                 // relay / ballast dropping out
  const c = h.ctx, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(30, when + .35);
  g.gain.setValueAtTime(.55, when); g.gain.exponentialRampToValueAtTime(.001, when + .4);
  o.connect(g); g.connect(h.dest); o.start(when); o.stop(when + .42);
}
function humTink(h, when) {                                                  // starter strike: click + short ring
  const c = h.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(1350, when); o.frequency.exponentialRampToValueAtTime(900, when + .05);
  g.gain.setValueAtTime(.09, when); g.gain.exponentialRampToValueAtTime(.001, when + .07);
  o.connect(g); g.connect(h.dest); o.start(when); o.stop(when + .08);
  humPop(h, .9, when);
}
let hum = null, prevBo = false, holdUntil = 0, nextPopT = 0, nextDip = 8, dipEnd = 0, lastFlick = 1;
function humUpdate() {
  const A = window.__api; if (!A || !A.audio || !A.lamps) return;
  const Z = A.audio(); if (!Z || !Z.context || !Z.gain) return;
  if (!hum || hum.ctx !== Z.context) hum = buildHum(Z.context, Z.gain);
  const c = hum.ctx, now = c.currentTime, tt = performance.now() / 1000, bo = !!A.V.blackout, P = A.H;
  let d = 1e9, li = -1;
  for (let i = 0; i < A.lamps.length; i++) { const dd = Math.hypot(A.lamps[i].x - P.x, A.lamps[i].y - P.y); if (dd < d) { d = dd; li = i; } }
  let level = bo ? .025 : .34 + .66 * (1 - smooth(70, 640, d));             // whole level hums; near a fixture it roars
  const near = !bo && li >= 0 && li % 13 === 0 && d < 520;                   // the game's flickering fixtures
  if (near) {
    const sn = Math.sin(tt * 11 + li); level *= .5 + .5 * Math.max(0, sn);
    if ((sn > .02) !== (lastFlick > .02)) humPop(hum, .7, now);
    lastFlick = sn;
  }
  if (!bo && tt > nextDip) { nextDip = tt + 9 + Math.random() * 18; dipEnd = tt + .06 + Math.random() * .12; }   // ballast struggling
  if (tt < dipEnd) level *= .3;
  if (bo !== prevBo) {
    prevBo = bo; const g = hum.out.gain; g.cancelScheduledValues(now);
    if (bo) { g.setTargetAtTime(.02, now, .04); humThunk(hum, now); humPop(hum, .8, now); holdUntil = now + .4; }
    else {
      const L = .34 + .66 * (1 - smooth(70, 640, d)); g.setValueAtTime(.02, now);
      for (const [t, v] of [[.05, .7], [.09, .05], [.15, .9], [.2, .12], [.3, 1.15], [.6, 1]]) g.linearRampToValueAtTime(Math.min(1.2, v * L), now + t);
      humTink(hum, now + .05); humTink(hum, now + .15); humPop(hum, .6, now + .3); holdUntil = now + .65;
    }
  }
  if (now >= holdUntil) hum.out.gain.setTargetAtTime(level, now, .06);
  if (hum.pan) hum.pan.pan.setTargetAtTime(bo || li < 0 ? 0 : Math.max(-.7, Math.min(.7, (A.lamps[li].x - P.x) / 450)), now, .15);
  if (now >= nextPopT) {
    humPop(hum, (bo ? .15 : .5) * (.5 + Math.random()), now);
    if (Math.random() < .25) humPop(hum, .3 * Math.random(), now + .03 + Math.random() * .06);
    nextPopT = now + (bo ? 3 + Math.random() * 6 : near ? .18 + Math.random() * .5 : 1.4 + Math.random() * 5.5);
  }
}
/* offline spectrum check (used by tests): energy at chosen frequencies, in dB relative to full scale */
N.testHum = async freqs => {
  const oc = new OfflineAudioContext(1, 44100 * 3, 44100), h = buildHum(oc, oc.destination); h.out.gain.value = 1;
  const buf = await oc.startRendering(), x = buf.getChannelData(0).subarray(44100), out = {};
  for (const f of freqs) { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * f * i / 44100; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } out[f] = +(20 * Math.log10(Math.hypot(re, im) * 2 / x.length + 1e-9)).toFixed(1); }
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); out.peak = +pk.toFixed(3); return out;
};

/* ---------- per-frame hook (called by the game every frame) ---------- */
let k = 0, stingCd = 6;
window.__mp = ({ p, cam, sc, run, started, light: lightOn, G, q, los, t }) => {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);

  if (N.on) applyServerState(t);
  humUpdate();
  const note = document.getElementById('onlineNote'); if (note) note.hidden = !N.on;

  /* --- network send --- */
  const now = performance.now();
  if (ws && ws.readyState === 1 && now - lastSend > (started ? 50 : 250)) {
    lastSend = now;
    ws.send(JSON.stringify({
      t: 'p', x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
      a: +p.angle.toFixed(2), r: p.sprinting ? 1 : 0, l: lightOn ? 1 : 0, k: p.equipment?.kind,
      n: (document.getElementById('nameplate')?.textContent || 'WANDERER').slice(0, 20), c: p.equipment?.color,
      lk: window.__api ? [window.__api.look.hat, window.__api.look.texture, window.__api.look.hands, window.__api.look.main, window.__api.look.backpack].join('|') : undefined,
    }));
    net.textContent = N.on ? 'ONLINE · ROOM ' + room.toUpperCase() + ' · ' + (peersN + 1) + ' WANDERER' + (peersN ? 'S' : '') + ' · SHARED MONSTERS' + (adm.unlocked ? ' · ADMIN' : '')
                           : 'CONNECTING…';
  }
  /* --- other wanderers: real avatars (same look as yours), their own lights, hover name --- */
  drawPeers(p, cam, sc, los, t, W, H);
  /* --- dread: proximity to hound + smilers drives heartbeat, drone, vignette, shake, flicker --- */
  let d = 1e9;
  if (run) { d = Math.hypot(G.x - p.x, G.y - p.y); for (const s of q) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y)); }
  const target = run ? Math.max(0, Math.min(1, 1 - d / 620)) : 0;
  k += (target - k) * Math.min(1, t * (target > k ? 3 : .8));
  if (dg && ac) dg.gain.value = soundOn() ? k * k * .16 : 0;
  beatT -= t;
  if (k > .08 && beatT <= 0) { beatT = .95 - .6 * k; thump(.5 * k + .1, 70); setTimeout(() => thump(.35 * k + .06, 58), 140); }
  dread.style.opacity = k < .05 ? 0 : Math.min(1, k * 1.15) * (.75 + .25 * Math.sin(now / (140 - 70 * k)));
  game.style.transform = k > .55 ? `translate(${(Math.random() - .5) * k * 5}px,${(Math.random() - .5) * k * 5}px)` : '';
  light.style.opacity = k > .35 && Math.random() < k * .09 ? .35 + Math.random() * .4 : 1;
  stingCd -= t;
  if (k > .45 && stingCd <= 0) { stingCd = 9 + Math.random() * 10; burst(.35, .12 * k); }
};
})();
