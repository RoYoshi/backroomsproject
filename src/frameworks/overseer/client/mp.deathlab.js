/** @part public/mp.js - OVERSEER: the death lab (window.__dlab: the clock, the x-ray, the overlay)
 * provides: previewTick, renderAdmin, renderAdminData, renderStatus
 * uses: $a, EN, LS, N, TABS, adm, bodyMonsters, bodyPlayers, btn, buildHum, giveItem, live, liveMap, myId, nrLast, panel, room, rowW,
 *       sec, tx, ws
 * writes: liveMap
 */
/* ---- the death lab: the clock, the x-ray and the overlay are client-side (window.__dlab, read by dphys.js and the debug renderer); placing is a teleport ---- */
const DL = () => window.__dlab || (window.__dlab = { on: false, paused: false, speed: 1, step: 0, xray: false, viz: false });
function labSet(k, v) {
  const L = DL();
  if (k === 'speed') L.speed = +v; else if (k === 'pause') L.paused = !L.paused; else if (k === 'step') { L.paused = true; L.step = (L.step | 0) + (+v || 1); }
  else if (k === 'xray') L.xray = !L.xray; else if (k === 'viz') L.viz = !L.viz; else if (k === 'reset') { L.speed = 1; L.paused = false; L.step = 0; }
  L.on = L.speed !== 1 || L.paused;
}
function findSpot(kind) {
  const A = window.__api; if (!A || !A.sl || !A.Uc) return null; const H = A.H, gl = window.__glitches || [], lamps = A.lamps || [], TAU2 = Math.PI * 2;
  const ok = (x, y) => A.sl(x, y, 24) && !gl.some(g => Math.hypot(g.x - x, g.y - y) < 260) && !lamps.some(l => Math.hypot(l.x - x, l.y - y) < 230);
  const ray = (x, y, a) => A.Uc(x, y, a, 260);
  if (kind === 'crawl') { const W0 = window.WORLD; let b = null, bd = 1e9; for (const c of (W0 && W0.CRAWL) || []) for (const x of c.exits) { const d = Math.hypot(x.x - H.x, x.y - H.y); if (d < bd && A.sl(x.x + x.nx * 30, x.y + x.ny * 30, 22)) { bd = d; b = { x: x.x + x.nx * 30, y: x.y + x.ny * 30, a: Math.atan2(-x.ny, -x.nx), n: 'OUTSIDE CRAWLSPACE ' + c.id + ' (' + x.face + ' side) - CROUCH + CRAWL IN' }; } } return b; }
  for (let R = 0; R < 3200; R += 64) {
    const n = Math.max(1, Math.round(R / 40)) * 4;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU2, x = H.x + Math.cos(a0) * R, y = H.y + Math.sin(a0) * R; if (!ok(x, y)) continue;
      if (kind === 'door') { for (const [ax, px] of [[0, Math.PI / 2], [Math.PI / 2, 0]]) { const w = ray(x, y, px) + ray(x, y, px + Math.PI); if (w < 200 && w > 70 && ray(x, y, ax) > 250 && ray(x, y, ax + Math.PI) > 250) { const sx = x + Math.cos(ax + Math.PI) * 170, sy = y + Math.sin(ax + Math.PI) * 170; if (ok(sx, sy)) return { x: sx, y: sy, a: ax, n: 'BEFORE A DOORWAY' }; } } continue; }
      if (kind === 'pillar') { let hit = 0, nearA = 0; for (let k = 0; k < 16; k++) { const d = ray(x, y, k / 16 * TAU2); if (d < 130) { hit++; nearA = k / 16 * TAU2; } } if (hit >= 2 && hit <= 5 && ray(x, y, nearA + Math.PI) > 240) { const gx = x + Math.cos(nearA) * 200, gy = y + Math.sin(nearA) * 200; if (!A.sl(gx, gy, 10) && ok(x, y)) return { x, y, a: nearA, n: 'BY A PILLAR / WALL END' }; } continue; }
      if (kind === 'open') { let good = true; for (let k = 0; k < 8; k++) if (ray(x, y, k / 8 * TAU2) < 210) { good = false; break; } if (good) return { x, y, a: 0, n: 'OPEN ROOM' }; }
      else for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU2;
        if (kind === 'wall') { const dd = ray(x, y, a); if (dd > 72 && dd < 108 && ray(x, y, a + .5) > 60 && ray(x, y, a - .5) > 60 && ray(x, y, a + Math.PI) > 150) return { x, y, a: a + Math.PI, n: 'NEAR A WALL' }; }
        else { const d1 = ray(x, y, a), d2 = ray(x, y, a + Math.PI / 2); if (d1 > 60 && d1 < 115 && d2 > 60 && d2 < 115 && ray(x, y, a + Math.PI) > 150 && ray(x, y, a + Math.PI * 1.5) > 150) return { x, y, a: a + Math.PI * 1.25, n: 'IN A CORNER' }; }
      }
    }
  }
  return null;
}
function bodyDeaths(d) {
  const cm = d.cm || 'auto', cb = (m, l) => btn(l, `data-c="capmode" data-mode="${m}"`, cm === m);
  const pv = (k, v, t, sub) => `<button class="adm adm-pv" data-c="preview" data-k="${k}" data-var="${v}"><b>${v}</b>${t}<small>${sub}</small></button>`;
  const tg = (o, l) => btn(l, `data-a="opt" data-o="${o}"`, adm.opts[o]);
  const L = DL(), sp = v => btn(v + '×', `data-a="dl" data-k="speed" data-v="${v}"`, L.speed === v), dl = (k, t, on, v) => btn(t, `data-a="dl" data-k="${k}"${v !== undefined ? ` data-v="${v}"` : ''}`, on);
  const lab = sec('DEATH LAB · WATCH IT SLOWLY') + rowW(sp(1) + sp(.5) + sp(.25) + dl('pause', L.paused ? '▶ PLAY' : '❚❚ PAUSE', L.paused) + dl('step', 'STEP 1 FRAME', false, 1) + dl('step', 'STEP 6', false, 6)) +
    rowW(dl('xray', 'X-RAY ATTACKER', L.xray) + dl('viz', 'SHOW PATHS · FORCES', L.viz) + btn('REPLAY LAST', 'data-a="replay"') + dl('reset', 'RESET CLOCK', false)) +
    sec('PLACE ME FIRST') + rowW(btn('OPEN ROOM', 'data-a="place" data-w="open"') + btn('NEAR A WALL', 'data-a="place" data-w="wall"') + btn('IN A CORNER', 'data-a="place" data-w="corner"')) +
    '<p class="adm-help">The clock, x-ray and overlay only change what YOU see. Set the speed or pause before you press a death button; the panel stays open if CLOSE THE PANEL is off. Green: body path · white: velocity · purple: spin · orange/blue: hands (ring = where the spring wants it, dot = where it is) · yellow: the light · red dashed: attacker · red x: wall hits.</p>';
  const nf = adm.nf, last = nrLast, lastTxt = !last ? 'NOT PRESSED YET ON THIS CONNECTION' : last.ok ? 'APPROVED (EVENT ' + last.de + ')' : last.why === 'cooldown' ? 'REFUSED · WAIT ' + Math.ceil(+last.wait || 0) + ' S' : 'REFUSED · ' + ({ state: 'NOT IN A RUN (SPAWN FIRST)', dead: 'DEAD', held: 'HELD BY AN ENTITY', epoch: 'THE WORLD WAS JUST RESET' }[last.why] || String(last.why).toUpperCase());
  const mine = sec('YOUR NEW RUN · INSTANT GIB') + rowW(btn(nf ? '● UNLIMITED NEW RUN ON' : '○ UNLIMITED NEW RUN OFF', `data-c="nrfree" data-on="${nf ? 0 : 1}"`, nf)) +
    `<div class="adm-sub">SERVER SAYS: ${nf ? 'ON' : 'OFF'} · LAST NEW RUN: ${live('nrlast', lastTxt)}</div>` +
    '<p class="adm-help">NEW RUN (Esc, then NEW RUN) blows YOUR wanderer into pieces at once: the server decides, everyone sees the same pieces, and they stay as your corpse until your next death or NEW RUN. Normally once every 30 s. UNLIMITED NEW RUN skips that wait for you alone, on this connection only (OFF again after a reconnect); you still have to be alive, free and back in a run (SPAWN) first. WORLD → NEW RUN FOR EVERYONE is a different thing: it resets the whole room and never blows anybody up.</p>';
  return mine + lab + sec('CAPTURE STYLE (FOR REAL CATCHES)') + rowW(cb('auto', 'AUTO') + cb('quick', 'ALWAYS QUICK') + cb('play', 'ALWAYS PLAY')) +
    '<p class="adm-help">AUTO: each entity decides. QUICK: every catch is an instant kill. PLAY: every catch is a held victim (down, crawl, dragged, maybe let go) for 5-15 s before the kill. Set PLAY, then SUMMON A HOUND, to watch the long version.</p>' +
    sec('PLAY A DEATH ON ME · HOUND') + `<div class="adm-grid">${pv('hound', 'A', 'THROAT', 'lunge from the front, held down')}${pv('hound', 'B', 'DRAGGED', 'pulled down and dragged away')}${pv('hound', 'C', 'WALL SLAM', 'needs a wall 1-2 body lengths off')}${pv('hound', 'D', 'EXHAUSTED', 'goes down in a heap')}</div>` +
    sec('PLAY A DEATH ON ME · SMILER') + `<div class="adm-grid">${pv('smiler', 'A', 'RUSH', 'out of the dark, arms reaching')}${pv('smiler', 'B', 'CORNERED', 'it closes in, everything goes black')}${pv('smiler', 'C', 'LIGHT FAILURE', 'the lamps die, one last dark')}${pv('smiler', 'D', 'PLAYED WITH', 'knocked back, dragged, slow')}</div>` +
    sec('AFTER IT PLAYS') + rowW(tg('close', 'CLOSE THE PANEL') + tg('auto', 'AUTO-REVIVE') + tg('back', 'BACK TO THIS SPOT')) +
    '<p class="adm-help">This runs the real kill on you: everyone in the room sees it and your body stays. It works through god mode and spawn protection, uses the nearest free hound or smiler, and tells you here if it cannot be done.</p>';
}
function bodyWorld(d) {
  return sec('LIGHTS') + rowW(['auto', 'on', 'off'].map(m => btn(m === 'auto' ? 'AUTO' : 'BLACKOUT ' + m.toUpperCase(), `data-c="blackout" data-mode="${m}"`, d.bo === m)).join('')) +
    sec(`GLITCHED WALLS · ${d.gw}`) + rowW(btn('GO TO NEAREST', 'data-c="glitch" data-mode="tp"') + btn('MOVE THEM', 'data-c="glitch" data-mode="new"')) +
    sec(`CARTOGRAPH · ${d.it ? 'ON THE FLOOR' : 'TAKEN'}`) + rowW(btn('GO TO IT', 'data-c="item" data-mode="tp"') + btn('MOVE IT', 'data-c="item" data-mode="new"') + btn('GIVE ME ONE', 'data-a="give"')) +
    sec('RUN · THE WHOLE ROOM') + rowW(btn('NEW RUN FOR EVERYONE', 'data-c="world" data-confirm="Reset the whole world for everyone? Every corpse, blood stain and dying light goes; everyone in a run starts again. Nobody is blown up."')) +
    '<p class="adm-help">A world reset, not anyone\'s own NEW RUN: nobody is blown up and no NEW RUN cooldown starts. Every death, gib, corpse, wall stain and dying light of the old world goes on every screen. Your own instant-gib NEW RUN is in the DEATHS tab.</p>';
}
function bodyDebug(d) {
  const L = (k, t) => btn(t, `data-a="lay" data-l="${k}"`, adm.lay[k]);
  return sec('DEBUG MODE') + `<button class="adm adm-big${adm.dbg ? ' on' : ''}" data-a="dbg">${adm.dbg ? '● DEBUG MODE ON' : '○ DEBUG MODE OFF'}</button>` +
    '<p class="adm-help">An overlay for admins only. The server sends its data to you alone, and only while this is on.</p>' +
    sec('LAYERS') + rowW(L('ai', 'AI ENTITIES') + L('you', 'YOU + HEARING') + L('srv', 'SERVER') + L('log', 'AI EVENTS')) +
    sec('ENTITY LABELS') + rowW(btn('FULL', 'data-a="lab" data-v="0"', !adm.lay.compact) + btn('COMPACT', 'data-a="lab" data-v="1"', adm.lay.compact)) +
    sec('NAVIGATION') + rowW(L('nav', 'ROUTES') + L('col', 'COLLISION') + L('grid', 'WALKABLE') + L('links', 'VAULT LINKS')) +
    rowW(btn('SELECT NEAREST', 'data-a="navsel" data-v="near"') + btn('NEXT ENTITY', 'data-a="navsel" data-v="next"') + btn(adm.sel ? 'SELECTED #' + adm.sel + ' ✕' : 'NONE SELECTED', 'data-a="navsel" data-v="none"', !!adm.sel)) +
    rowW(btn('FOLLOW ME', 'data-c="nav" data-cmd="follow"') + btn('COME HERE', 'data-c="nav" data-cmd="come"') + btn('HUNT ME (AI)', 'data-c="nav" data-cmd="hunt"') + btn('CLEAR TARGET', 'data-c="nav" data-cmd="clear"')) +
    rowW(btn('FORCE REPATH', 'data-c="nav" data-cmd="repath"') + btn('DROP ROUTE', 'data-c="nav" data-cmd="noroute"') + btn('RESET STUCK', 'data-c="nav" data-cmd="unstuck"') + btn('GO TO IT', 'data-a="navgo"')) +
    rowW(btn('ME → DOORWAY', 'data-a="place" data-w="door"') + btn('ME → PILLAR', 'data-a="place" data-w="pillar"') + btn('ME → CORNER', 'data-a="place" data-w="corner"') + btn('ME → OPEN ROOM', 'data-a="place" data-w="open"')) +
    sec('EVIDENCE · LIGHT') + rowW(L('evid', 'EVIDENCE + LEADS')) +
    '<p class="adm-help">EVIDENCE + LEADS: dashed rings are anonymous leads (white = a light source it saw, yellow = a beam, orange = a lit wall, brown = a lit floor; ring size = how unsure). A lead names nobody. Diamonds are evidence on the record it holds (red = seen, violet = heard, yellow = light it later pinned on that person). The label adds DECIDE (state and its reason), any retarget, the last light it noticed, and EYE CONTACT. The selected entity shows all of it plus its traits.</p>' +
    sec('CHASE · SEARCH · HIDING') + rowW(L('search', 'SEARCH + MEMORY') + L('crawl', 'CRAWLSPACES') + btn('ME → CRAWLSPACE', 'data-a="place" data-w="crawl"') + btn('HUNT ME (AI)', 'data-c="nav" data-cmd="hunt"')) +
    '<p class="adm-help">SEARCH + MEMORY (every hound, full detail on the selected one): amber square = where it last had you, amber arrow = the way it saw you going, dashed ring = how unsure it is where you are now (the estimate at its centre), violet = the last sound it heard from you, blue cross = where it is searching and why (continue = down the way you went, exit = a crawlspace exit, enter = going in, sound = a noise). The label shows the search phase, legs searched, time left, memory age and the reason it gave up. CRAWLSPACES: cyan = the space inside, dashed = what covers it from above (table top / wall), dots = the ways in and out, and whether the selected entity can use it (green) or must go round (red).</p>' +
    '<p class="adm-help">ROUTES: green = the route (orange = a vault, violet = crawl), white cross = the aim point it steers at, blue arrow = the heading it wants, white arrow = how it actually moves, dashed yellow = running straight at the goal. The selected entity also shows why it last re-planned, its stuck timer and counters (routes / wall touches / hard hits / stuck / recoveries / emergencies). COLLISION: its collision circle and the wall blocks around it. WALKABLE: floor near you, brighter = more room. FOLLOW / COME are navigation only; HUNT ME runs the real AI.</p>' +
    sec('TOOLS') + rowW(btn('COPY REPORT', 'data-a="copy"') + btn(d.fz ? 'UNFREEZE' : 'FREEZE THE HALLS', `data-c="freeze" data-on="${d.fz ? 0 : 1}"`, d.fz) + btn('SLOW MOTION 0.25×', 'data-c="speed" data-v="0.25"', d.sp === .25) + btn('NORMAL SPEED', 'data-c="speed" data-v="1"', d.sp === 1)) +
    '<p class="adm-help">AI ENTITIES: dashed ring = how far it can see; red line = last known position of its target (yellow: only heard or remembered); purple = last sound it heard; blue cross = where it is searching; green = its path; the label shows state, target, mood, capture. YOU: your state, stamina and the dashed ring of how far you are heard right now. COPY REPORT puts the room, players, entities, recent events and timings on the clipboard, ready to paste into a bug report.</p>';
}
const BODIES = { players: bodyPlayers, monsters: bodyMonsters, deaths: bodyDeaths, world: bodyWorld, debug: bodyDebug };
function renderTabs() { $a('admTabs').innerHTML = TABS.map(([k, n]) => `<button class="adm-tab${adm.tab === k ? ' on' : ''}" data-a="tab" data-t="${k}">${n}</button>`).join(''); }
function renderStatus() {
  const el = $a('admStatus'); if (!el) return;
  const r = adm.res, fresh = r && performance.now() - r.at < 6000;
  el.textContent = fresh ? r.msg : ''; el.classList.toggle('bad', !!(fresh && !r.ok));
}
function renderAdmin() {
  panel.hidden = !adm.open; panel.classList.toggle('right', adm.side === 'right');
  $a('admLogin').hidden = adm.unlocked; $a('admMain').hidden = !adm.unlocked;
  $a('admErr').textContent = ws && ws.readyState === 1 ? adm.err : 'Admin needs the online server (not available in solo mode).';
  $a('admWho').textContent = adm.unlocked ? ' · ROOM ' + room.toUpperCase() : '';
  if (adm.open && !adm.unlocked) setTimeout(() => $a('admPass').focus(), 0);
  if (adm.unlocked) { renderTabs(); adm.sig = ''; renderAdminData(); renderStatus(); }
}
function renderAdminData() {
  const d = adm.data; if (!adm.open || !adm.unlocked || !d) return;
  liveMap = {};
  const html = (BODIES[adm.tab] || bodyPlayers)(d), sig = adm.tab + '|' + html.replace(/(<span data-live="[^"]+">)[^<]*(<\/span>)/g, '$1$2'), body = $a('admBody');
  if (sig !== adm.sig) { body.innerHTML = html; adm.sig = sig; }
  else for (const el of body.querySelectorAll('[data-live]')) { const t = liveMap[el.dataset.live]; if (t !== undefined && el.textContent !== t) el.textContent = t; }
  $a('admBroadcast').hidden = adm.tab !== 'players';
}
function toggleAdmin() { adm.open = !adm.open; renderAdmin(); }
function unlock() { const v = $a('admPass').value; if (!v) return; adm.pass = v; adm.err = ''; tx({ t: 'admin', pass: v }); $a('admPass').value = ''; }
function sendMsg() { const el = $a('admText'), text = el.value.trim(); if (text) { tx({ t: 'a', c: 'msg', text }); el.value = ''; } }
/* debug mode: the master switch tells the server to start (or stop) sending its data; the layers only decide what is drawn here */
function applyDbg() {
  const E = EN(); if (E) { Object.assign(E.dbgCfg, adm.lay, { on: adm.dbg, side: adm.side === 'left' ? 'right' : 'left' }); if (!adm.dbg) E.clearDebug(); }
  LS.set('lay', adm.lay);
}
function copyText(text) {
  const fallback = () => { const ta = Object.assign(document.createElement('textarea'), { value: text }); ta.style.cssText = 'position:fixed;left:-999px;top:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { } ta.remove(); return ok; };
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  return Promise.resolve(fallback());
}
function report() {
  const A = window.__api, E = EN(), d = adm.data || {}, mv = window.__mv || {};
  return JSON.stringify({
    when: new Date().toISOString(), room, you: adm.you, at: A ? { x: Math.round(A.H.x), y: Math.round(A.H.y), stamina: Math.round(A.H.stamina) } : null, move: { state: mv.s, speed: Math.round(mv.speed || 0), surface: mv.surf },
    world: { frozen: d.fz, speed: d.sp, blackout: d.bo, hounds: d.hn, smilers: d.sn, capture: d.cm }, players: d.pl, entities: d.es, ai: E && E.dbg, log: E && E.dbgX.lg.map(l => '[' + l.t + '] ' + l.x), server: E && E.dbgX.pf, ping: E && E.dbgX.ping, fps: E && Math.round(E.fps), agent: navigator.userAgent,
  }, null, 1);
}
/* after "play a death on me": wait for the death to run, revive (optional), and put the admin back where the preview was (optional) - so the next preview is one click away */
function previewTick() {
  const A = window.__api, r = adm.rv; if (!r || !A) return;
  const now = performance.now();
  if (now - r.t0 > 60000 || !adm.unlocked) { adm.rv = null; return; }
  if (r.stage === 0) { if (A.G.caught) r.stage = 1; else if (now - r.t0 > 8000) adm.rv = null; }
  else if (r.stage === 1) { if (A.G.caught && A.death && A.death().finished) { r.stage = 2; r.t1 = now; } }
  else if (r.stage === 2) {
    if (adm.opts.auto && !r.sent && now - r.t1 > 1300) { r.sent = true; tx({ t: 'a', c: 'revive', id: myId }); }
    if (!A.G.caught) r.stage = 3;
  } else if (r.stage === 3 && A.fall && A.fall() < 0) { if (adm.opts.back) { A.tp(r.pos.x, r.pos.y); A.H.angle = r.pos.a; } adm.rv = null; }
}
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'close') { adm.open = false; renderAdmin(); return; }
  if (a === 'unlock') return unlock();
  if (a === 'msg') return sendMsg();
  if (a === 'give') { giveItem('cartograph'); return; }
  if (a === 'dock') { adm.side = adm.side === 'left' ? 'right' : 'left'; LS.set('side', adm.side); applyDbg(); renderAdmin(); return; }
  if (a === 'tab') { adm.tab = b.dataset.t; LS.set('tab', adm.tab); renderAdmin(); return; }
  if (a === 'dbg') { adm.dbg = !adm.dbg; applyDbg(); tx({ t: 'a', c: 'debug', on: adm.dbg ? 1 : 0 }); adm.sig = ''; renderAdminData(); return; }
  if (a === 'lay') { adm.lay[b.dataset.l] = !adm.lay[b.dataset.l]; applyDbg(); adm.sig = ''; renderAdminData(); return; }
  if (a === 'lab') { adm.lay.compact = b.dataset.v === '1'; applyDbg(); adm.sig = ''; renderAdminData(); return; }
  if (a === 'dl') { labSet(b.dataset.k, b.dataset.v); adm.sig = ''; renderAdminData(); return; }
  if (a === 'navsel') {
    const L = (EN() && EN().dbg) || [], A = window.__api; if (b.dataset.v === 'none') adm.sel = 0;
    else if (!L.length) adm.res = { ok: false, msg: 'TURN DEBUG MODE ON FIRST (the list comes from the server)', at: performance.now() };
    else if (b.dataset.v === 'near' && A) { let bd = 1e18; for (const d of L) { const dd = Math.hypot(d.x - A.H.x, d.y - A.H.y); if (dd < bd) { bd = dd; adm.sel = d.i; } } }
    else { const ids = L.map(d => d.i).sort((x, y) => x - y), k = ids.indexOf(adm.sel); adm.sel = ids[(k + 1) % ids.length]; }
    if (EN()) EN().navSel = adm.sel; renderAdminData(); return;
  }
  if (a === 'navgo') { const d = ((EN() && EN().dbg) || []).find(q => q.i === adm.sel); if (d) tx({ t: 'a', c: 'entgoto', eid: d.i }); else { adm.res = { ok: false, msg: 'SELECT AN ENTITY FIRST', at: performance.now() }; renderStatus(); } return; }
  if (a === 'place') { const sp = findSpot(b.dataset.w), A = window.__api; adm.res = sp && A ? (A.tp(sp.x, sp.y), A.H.angle = sp.a, { ok: true, msg: 'MOVED YOU: ' + sp.n, at: performance.now() }) : { ok: false, msg: 'NO SUCH SPOT NEARBY - WALK SOMEWHERE ELSE FIRST', at: performance.now() }; renderStatus(); return; }
  if (a === 'replay') { const r = adm.lastPv; if (!r) { adm.res = { ok: false, msg: 'NOTHING TO REPLAY YET', at: performance.now() }; renderStatus(); return; } const A = window.__api; adm.rv = A ? { stage: 0, t0: performance.now(), pos: { x: A.H.x, y: A.H.y, a: A.H.angle } } : null; tx({ t: 'a', c: 'preview', k: r.k, var: r.var }); return; }
  if (a === 'opt') { adm.opts[b.dataset.o] = !adm.opts[b.dataset.o]; LS.set('opts', adm.opts); adm.sig = ''; renderAdminData(); return; }
  if (a === 'copy') { copyText(report()).then(ok => { adm.res = { ok, msg: ok ? 'REPORT COPIED TO THE CLIPBOARD' : 'COULD NOT COPY: CLIPBOARD BLOCKED', at: performance.now() }; renderStatus(); }); return; }
  if (!b.dataset.c) return;
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  const o = { t: 'a', c: b.dataset.c };
  if (b.dataset.id) o.id = +b.dataset.id;
  if (b.dataset.eid) o.eid = +b.dataset.eid;
  if (b.dataset.v) o.v = +b.dataset.v;
  if (b.dataset.mode) o.mode = b.dataset.mode;
  if (b.dataset.k) o.k = b.dataset.k;
  if (b.dataset.var) o.var = b.dataset.var;
  if (b.dataset.on !== undefined) o.on = +b.dataset.on;
  if (b.dataset.n) o.n = +b.dataset.n;
  if (b.dataset.cmd) o.cmd = b.dataset.cmd;
  if (o.c === 'nav') { if (!adm.sel) { adm.res = { ok: false, msg: 'SELECT AN ENTITY FIRST', at: performance.now() }; renderStatus(); return; } o.eid = adm.sel; }
  if (o.c === 'preview') { adm.lastPv = { k: o.k, var: o.var }; const A = window.__api; adm.rv = A ? { stage: 0, t0: performance.now(), pos: { x: A.H.x, y: A.H.y, a: A.H.angle } } : null; }
  tx(o);
});
panel.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (e.target.id === 'admPass') unlock(); else if (e.target.id === 'admText') sendMsg(); } if (e.key === 'Escape') { adm.open = false; renderAdmin(); } });
addEventListener('keydown', e => { if (e.code === 'Backquote' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleAdmin(); } });
setInterval(() => { if (adm.dbg && adm.unlocked) tx({ t: 'ping', ts: performance.now() }); }, 1000);
setInterval(renderStatus, 1000);

/* Stage 3H2 (C-4): the fluorescent light hum - buildHum, humUpdate, its crackles, thunk and strike-back, and its state - is
 * assets/mp-hum.js's; mp.js reads it at start-up (above), calls humUpdate() every frame and keeps the offline check below. */
/* offline spectrum check (used by tests): energy at chosen frequencies, in dB relative to full scale */
N.testHum = async freqs => {
  const oc = new OfflineAudioContext(1, 44100 * 3, 44100), h = buildHum(oc, oc.destination); h.out.gain.value = 1;
  const buf = await oc.startRendering(), x = buf.getChannelData(0).subarray(44100), out = {};
  for (const f of freqs) { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * f * i / 44100; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } out[f] = +(20 * Math.log10(Math.hypot(re, im) * 2 / x.length + 1e-9)).toFixed(1); }
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); out.peak = +pk.toFixed(3); return out;
};

