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
let snap = null, me = '', mseq = 0, handled = 0, wonShown = false, peersN = 0;
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
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hi') myId = m.id;
    else if (m.t === 's') {
      const now = performance.now(), seen = new Set();
      for (const p of m.p) {
        seen.add(p.id);
        const o = peers.get(p.id) || { x: p.x, y: p.y };
        Object.assign(o, p, { tx: p.x, ty: p.y, seen: now }); peers.set(p.id, o);
      }
      for (const id of peers.keys()) if (!seen.has(id)) peers.delete(id);
      peersN = m.p.length; me = m.me || ''; mseq = m.ms | 0;
      if (m.e) { snap = m.e; N.on = true; }
    }
  };
  ws.onclose = () => {
    N.on = false; snap = null; peers.clear();
    net.textContent = everConnected ? 'SOLO · RECONNECTING' : 'SOLO';
    setTimeout(connect, Math.min(8000, 1000 * ++retry));
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

/* ---------- per-frame hook (called by the game every frame) ---------- */
let k = 0, stingCd = 6;
window.__mp = ({ p, cam, sc, run, started, light: lightOn, G, q, los, t }) => {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);

  if (N.on) applyServerState(t);
  const note = document.getElementById('onlineNote'); if (note) note.hidden = !N.on;

  /* --- network send --- */
  const now = performance.now();
  if (ws && ws.readyState === 1 && now - lastSend > (started ? 50 : 250)) {
    lastSend = now;
    ws.send(JSON.stringify({
      t: 'p', x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
      a: +p.angle.toFixed(2), r: p.sprinting ? 1 : 0, l: lightOn ? 1 : 0, k: p.equipment?.kind,
      n: (document.getElementById('nameplate')?.textContent || 'WANDERER').slice(0, 20), c: p.equipment?.color,
    }));
    net.textContent = N.on ? 'ONLINE · ROOM ' + room.toUpperCase() + ' · ' + (peersN + 1) + ' WANDERER' + (peersN ? 'S' : '') + ' · SHARED MONSTERS'
                           : 'CONNECTING…';
  }
  /* --- draw other wanderers (beneath the darkness mask, so unlit players stay hidden) --- */
  for (const o of peers.values()) {
    o.x += (o.tx - o.x) * .25; o.y += (o.ty - o.y) * .25;
    const sx = W / 2 + (o.x - cam.x) * sc, sy = H / 2 + (o.y - cam.y) * sc;
    if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
    const dx = o.x - p.x, dy = o.y - p.y, dist = Math.hypot(dx, dy);
    if (dist > 30 && los && los(p.x, p.y, Math.atan2(dy, dx), dist) < dist - 20) continue;   // walls block sight
    const r = 13 * sc, col = o.c || '#ffe7b2';
    cx.save(); cx.translate(sx, sy);
    if (o.d) {
      cx.strokeStyle = '#a33'; cx.lineWidth = 3; cx.beginPath();
      cx.moveTo(-r, -r); cx.lineTo(r, r); cx.moveTo(r, -r); cx.lineTo(-r, r); cx.stroke();
    } else {
      cx.rotate(o.a);
      const g = cx.createRadialGradient(r * 4, 0, 0, r * 4, 0, r * 5);
      g.addColorStop(0, col + '88'); g.addColorStop(1, col + '00');
      cx.fillStyle = g; cx.beginPath(); cx.arc(r * 4, 0, r * 5, 0, 7); cx.fill();
      cx.fillStyle = '#2b3a33'; cx.beginPath(); cx.arc(0, 0, r, 0, 7); cx.fill(); cx.strokeStyle = col; cx.lineWidth = 2; cx.stroke();
      cx.fillStyle = col; cx.beginPath(); cx.arc(r * .55, 0, r * .3, 0, 7); cx.fill();
    }
    cx.restore(); cx.font = '500 11px IBM Plex Mono,monospace'; cx.textAlign = 'center';
    cx.fillStyle = '#d6e2c8cc'; cx.fillText(o.n || 'WANDERER', sx, sy - r - 9);
  }
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
