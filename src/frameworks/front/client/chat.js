/* src/frameworks/front/client/chat.js -> public/assets/chat.js - F.R.O.N.T.: the page's two chats (post-3H Trial 2; docs/architecture/CHAT.md).
 *
 *   MENU · LOUNGE      a panel on the main menu: one chat for everyone on the main menu of this server, whatever room they will play in.
 *                      Its own WebSocket (/social), open only while the main menu is shown (never during a run), closed when the lounge
 *                      is turned off.  Wide screens: a panel at the lower right, foldable to its title.  Smaller screens: a Lounge
 *                      button at the end of the left rail opens it over the menu; Close or Esc puts it away.
 *   IN LEVEL · NEARBY  in a run, online: Enter (or the SAY button on a touch screen) opens a one-line composer; what is said goes to the
 *                      server ({t:'say'} through the send mp.js's session links in), which delivers it only to players near the speaker in the same room.
 *                      Each line heard shows as a bubble over its speaker for 3 to 5 s; a speaker off screen gets a small hint at the
 *                      screen's edge pointing their way instead.  No list, no history, no sidebar.
 *
 * Every text is shown with textContent (no markup, no links).  While a chat field has focus, every key goes to it alone: this script is
 * loaded before the page's other scripts and its window capture listener stops each keydown there from reaching the game, the menus or
 * the key remapping; Esc leaves the field.  Enter opens the composer only in a live, online run (offline, Enter does what it did).  When
 * the composer opens, the game's held keys are let go (__api.keys), so nobody walks on while typing.
 *
 * Controls: lounge on / off, folded / open (wide screens); per-sender mute for this visit (by the server's connection id, never by
 * name); speech bubbles shown / hidden and their text size (the composer's Options); saved as tfb.chat.v1 (the on / off, fold, bubbles
 * and size only: never a text, a name or a mute).  Screen readers: new lines are announced through one polite region, at most one
 * announcement every 2.5 s (more waiting lines are counted, not read one by one); the lounge only while focus is inside it.  Reduced
 * motion (html.rm): bubbles appear and go without fading.
 *
 * Hooks: window.__chat = { net(m, peer) (mp.js's session hands it 'heard' and 'said', with the speaker's peer record when it has one),
 * state() (for the checks) }; window.__chatFrame(frame) (mp.js's per-frame hook calls it after drawing the other players: where the
 * bubbles go).  Reads window.__api (started, paused, keys, G, H), window.__net (on, say), window.__peerNet (the other players' drawn
 * positions), window.__ui (the menu's state) and window.__epochDebug (the world's epoch).  Nothing else of the page changes. */
(() => {
  'use strict';
  if (window.__chat) return;
  const KEY = 'tfb.chat.v1', MAXCP = 160, LOG_MAX = 80, LIVE_GAP = 2500;
  const S = (() => {                                                     // the saved switches (nothing else is ever saved)
    const d = { on: true, fold: false, bubbles: true, big: false };
    let r = null; try { r = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { }
    if (r && r.v === 1) for (const k of Object.keys(d)) if (typeof r[k] === 'boolean') d[k] = r[k];
    return d;
  })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: 1 }, S))); } catch (e) { } };
  const $ = id => document.getElementById(id);
  const vis = id => { const e = $(id); return !!e && !e.hidden; };
  const API = () => window.__api, NET = () => window.__net;
  const reduced = () => document.documentElement.classList.contains('rm');
  const cps = s => { let n = 0; for (const _ of s) n++; return n; };
  function mk(tag, cls, text, attrs) {
    const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text;
    if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]);
    return e;
  }
  const WHY = {
    slow: m => `Too fast. Wait ${Math.max(1, +m.wait || 1)} s.`, busy: () => 'The lounge is busy. Try again in a moment.', repeat: () => 'You just said that.',
    long: () => `Too long: ${MAXCP} characters at most.`, empty: () => 'Nothing to send.', bad: () => 'That message has characters chat does not accept.',
    menu: () => 'Only players in the level can speak nearby.', dead: () => 'The dead cannot speak.',
  };
  const why = m => (WHY[m.why] || (() => 'Not sent.'))(m);

  /* ---------------------------------------------------------------- screen-reader announcements: one region, throttled */
  let live = null; const liveQ = []; let liveT = 0;
  function announce(s) {
    if (!live) { live = mk('p', 'u-vh', null, { id: 'chatLive', 'aria-live': 'polite', 'aria-atomic': 'true' }); document.body.appendChild(live); }
    liveQ.push(s); if (!liveT) liveFlush();
  }
  function liveFlush() {
    if (!liveQ.length) { liveT = 0; return; }
    const s = liveQ.length > 3 ? `${liveQ.length} new chat messages.` : liveQ.shift(); if (liveQ.length > 3) liveQ.length = 0;
    live.textContent = s; liveT = setTimeout(liveFlush, LIVE_GAP);
  }

  /* ================================================================ MENU · LOUNGE */
  const L = { ws: null, state: 'idle', id: null, online: 0, retry: 0, retryT: 0, pingT: 0, hideT: 0, nick: '', nickT: 0, muted: new Map(), unread: 0, sheet: false, noteT: 0, sent: 0, got: 0, opens: 0 };
  let lg = null;                                                         // the panel's elements, once built
  const wideMQ = matchMedia('(min-width:1180px) and (min-height:620px)');
  const myName = () => { const n = $('name'); return ((n && n.value) || '').trim() || 'Wanderer'; };
  function build() {
    const menu = $('menu'); if (!menu || lg) return;
    const sec = mk('section', 'lg', null, { id: 'lounge', 'aria-labelledby': 'lgT', 'data-chat': 'lounge' });
    const head = mk('div', 'lg-head');                                 // (a div: the game's stylesheet places every <header> at the top of the screen)
    const ttl = mk('h2', null, null, { id: 'lgT' }); ttl.append(mk('span', 'lg-name', 'Lounge'), mk('small', 'lg-scope', 'Everyone on the main menu'));
    const count = mk('b', 'lg-count', '', { id: 'lgCount' });
    const fold = mk('button', 'lg-fold', 'Hide', { type: 'button', id: 'lgFold', 'aria-controls': 'lgBody', 'aria-expanded': 'true' });
    head.append(ttl, count, fold);
    const body = mk('div', 'lg-body', null, { id: 'lgBody' });
    const logEl = mk('ol', 'lg-log', null, { id: 'lgLog', 'aria-label': 'Lounge messages', tabindex: '0' });
    const note = mk('p', 'lg-note', null, { id: 'lgNote' });
    const form = mk('form', 'lg-form', null, { id: 'lgForm', autocomplete: 'off' });
    const lab = mk('label', 'u-vh', 'Message the lounge', { for: 'lgText' });
    const input = mk('input', 'lg-input', null, { id: 'lgText', maxlength: String(MAXCP * 2), autocomplete: 'off', spellcheck: 'true', enterkeyhint: 'send', placeholder: 'Say something to the lounge', 'data-chat-input': '' });
    const send = mk('button', 'lg-send', 'Send', { type: 'submit' });
    form.append(lab, input, send);
    const tools = mk('div', 'lg-tools');
    const unmute = mk('button', 'lg-tool', '', { type: 'button', id: 'lgUnmute', hidden: '' });
    const off = mk('button', 'lg-tool', 'Turn the lounge off', { type: 'button', id: 'lgOff' });
    tools.append(unmute, off);
    const offBox = mk('div', 'lg-offbox', null, { id: 'lgOffBox', hidden: '' });
    offBox.append(mk('p', null, 'The lounge is off. Nobody here sees it or you.'), mk('button', 'lg-tool lg-on', 'Turn the lounge on', { type: 'button', id: 'lgOn' }));
    body.append(logEl, note, form, tools, offBox);
    sec.append(head, body);
    const foot = menu.querySelector('.mm-foot'); menu.insertBefore(sec, foot || null);
    // smaller screens: a button at the end of the left rail (under the connection) opens the lounge over the menu
    const rail = menu.querySelector('.mm-rail'); let ub = null;
    if (rail) {
      ub = mk('button', 'mm-lounge', null, { type: 'button', id: 'mmLounge', 'aria-label': 'Lounge', 'aria-controls': 'lounge', 'aria-expanded': 'false' });
      ub.append(mk('span', 'mm-lounge-k', 'Lounge'), mk('span', 'mm-lounge-n', '', { id: 'lgBtnCount' }), mk('i', 'lg-badge', '', { id: 'lgBadge', hidden: '', 'aria-hidden': 'true' }));
      rail.append(ub);
    }
    lg = { sec, head, count, fold, body, logEl, note, form, input, send, tools, unmute, off, offBox, ub };
    fold.addEventListener('click', () => { if (wideMQ.matches) { S.fold = !S.fold; save(); render(); if (!S.fold) input.focus(); } else sheet(false); });
    if (ub) ub.addEventListener('click', () => { if (wideMQ.matches) { S.fold = !S.fold; save(); render(); if (!S.fold) input.focus(); } else sheet(!L.sheet); });
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    off.addEventListener('click', () => { S.on = false; save(); sync(); render(); const b = $('lgOn'); if (b) b.focus(); });
    $('lgOn').addEventListener('click', () => { S.on = true; save(); sync(); render(); input.focus(); });
    unmute.addEventListener('click', () => { L.muted.clear(); sysLine('Everyone is unmuted.'); render(); });
    logEl.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('button[data-mute]'); if (!b) return;
      const id = +b.dataset.mute, nick = b.dataset.nick || 'someone';
      if (L.muted.has(id)) { L.muted.delete(id); sysLine(`${nick} is unmuted.`); }
      else { L.muted.set(id, nick); for (const li of [...logEl.querySelectorAll(`li[data-id="${id}"]`)]) li.remove(); sysLine(`${nick} is muted until you leave this page.`, { undo: id, nick }); }
      render();
    });
    input.addEventListener('focus', () => { L.unread = 0; render(); });
    const nameEl = $('name'); if (nameEl) for (const ev of ['change', 'blur']) nameEl.addEventListener(ev, nickLater);
    wideMQ.addEventListener('change', () => { if (wideMQ.matches) L.sheet = false; render(); });
    render();
  }
  function render() {
    if (!lg) return;
    const wide = wideMQ.matches, st = !S.on ? 'off' : L.state;
    lg.sec.dataset.state = st;
    lg.sec.classList.toggle('lg-folded', wide && S.fold);
    lg.sec.classList.toggle('lg-sheet', !wide && L.sheet);
    lg.sec.classList.toggle('lg-big', S.big);
    lg.fold.textContent = wide ? (S.fold ? 'Show' : 'Hide') : 'Close';
    lg.fold.setAttribute('aria-expanded', String(wide ? !S.fold : L.sheet));
    if (lg.ub) { lg.ub.setAttribute('aria-expanded', String(wide ? !S.fold : L.sheet)); lg.ub.classList.toggle('on', wide ? !S.fold : L.sheet); }
    lg.count.textContent = st === 'online' ? `${L.online} here` : st === 'connecting' ? 'Connecting' : st === 'off' ? 'Off' : st === 'down' ? 'Offline' : '';
    lg.offBox.hidden = S.on; lg.form.hidden = !S.on; lg.tools.hidden = !S.on; lg.logEl.hidden = !S.on;
    lg.input.disabled = st !== 'online'; lg.send.disabled = st !== 'online';
    lg.unmute.hidden = !L.muted.size; lg.unmute.textContent = `Unmute everyone (${L.muted.size})`;
    if (!L.noteT) lg.note.textContent = st === 'online' ? 'Names are not verified. Nothing is kept: lines vanish when you leave.' : st === 'connecting' ? 'Connecting to the lounge...' : st === 'down' ? 'The lounge cannot be reached. Trying again...' : '';
    const badge = $('lgBadge'), showUnread = L.unread > 0 && !(wide ? !S.fold : L.sheet);
    if (badge) { badge.hidden = !showUnread; badge.textContent = L.unread > 9 ? '9+' : String(L.unread); }
    const bc = $('lgBtnCount'); if (bc) bc.textContent = lg.count.textContent;
    if (lg.ub) lg.ub.setAttribute('aria-label', showUnread ? `Lounge, ${L.unread} new` : 'Lounge');
  }
  function sheet(open) {
    L.sheet = !!open; render();
    if (L.sheet) { const f = S.on ? lg.input : $('lgOn'); if (f && !f.disabled) f.focus(); else lg.fold.focus(); }
    else if (lg.ub) lg.ub.focus({ preventScroll: true });
  }
  function note(s) { if (!lg) return; clearTimeout(L.noteT); lg.note.textContent = s; L.noteT = setTimeout(() => { L.noteT = 0; render(); }, 4000); }
  function nearBottom() { const l = lg.logEl; return l.scrollHeight - l.scrollTop - l.clientHeight < 40; }
  function addLi(li) {
    const stick = nearBottom(); lg.logEl.append(li);
    while (lg.logEl.children.length > LOG_MAX) lg.logEl.firstElementChild.remove();
    if (stick) lg.logEl.scrollTop = lg.logEl.scrollHeight;
  }
  function sysLine(s, o) {
    if (!lg) return; const li = mk('li', 'lg-sys', s);
    if (o && o.undo) { const b = mk('button', 'lg-undo', 'Undo', { type: 'button', 'data-mute': String(o.undo), 'data-nick': o.nick }); li.append(' ', b); }
    addLi(li);
  }
  function line(m) {
    if (L.muted.has(m.id)) return;
    const own = m.id === L.id, li = mk('li', own ? 'lg-line lg-own' : 'lg-line', null, { 'data-id': String(m.id) });
    const who = own ? mk('span', 'lg-who', 'You') : mk('button', 'lg-who', m.nick, { type: 'button', 'data-mute': String(m.id), 'data-nick': m.nick, 'aria-label': `${m.nick}. Mute ${m.nick}`, title: `Mute ${m.nick}` });
    li.append(who, mk('span', 'lg-text', m.text));
    addLi(li); L.got++;
    const inside = lg.sec.contains(document.activeElement);
    if (!own && !inside) { L.unread++; render(); }
    if (!own && inside) announce(`${m.nick} says: ${m.text}`);
  }
  // the connection: only while the main menu is shown, the lounge on, and the tab not hidden for long
  const inMenu = () => vis('menu') && !(API() && API().started && API().started());
  const want = () => S.on && inMenu() && !document.hidden && location.protocol !== 'file:';
  function sync() {
    if (!lg) build();
    clearTimeout(L.hideT);
    if (want()) { if (!L.ws) connect(); }
    else if (L.ws) {
      if (S.on && inMenu() && document.hidden) L.hideT = setTimeout(sync2, 30000);   // a hidden tab keeps its place for 30 s
      else drop(!inMenu());
    }
    if (!inMenu() && L.sheet) { L.sheet = false; render(); }
  }
  function sync2() { if (document.hidden && L.ws) drop(false); }
  function connect() {
    clearTimeout(L.retryT); L.retryT = 0;
    let ws; try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/social'); } catch (e) { return; }
    L.ws = ws; L.state = 'connecting'; L.opens++; render();
    ws.onopen = () => { if (L.ws !== ws) return; L.nick = myName(); ws.send(JSON.stringify({ t: 'social_hello', nick: L.nick })); L.pingT = setInterval(() => { if (ws.readyState === 1) ws.send('{"t":"social_ping"}'); }, 25000); };
    ws.onmessage = e => {
      if (L.ws !== ws) return;
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'social_welcome') { L.id = m.id; L.online = m.online | 0; L.retry = 0; L.state = 'online'; render(); }
      else if (m.t === 'social_message' && typeof m.text === 'string' && typeof m.nick === 'string') line(m);
      else if (m.t === 'social_count') { L.online = m.online | 0; render(); }
      else if (m.t === 'social_error') note(why(m));
    };
    ws.onclose = () => {
      if (L.ws !== ws) return;
      clearInterval(L.pingT); L.ws = null; L.id = null;
      L.state = want() ? 'down' : 'idle'; render();
      if (want()) L.retryT = setTimeout(sync, Math.min(30000, 2000 * Math.pow(2, L.retry++)));
    };
  }
  function drop(forRun) {                                                // closed on purpose: a run began, the lounge was turned off, or the tab stayed hidden
    const ws = L.ws; L.ws = null; L.id = null; clearInterval(L.pingT); clearTimeout(L.retryT);
    if (ws) { try { ws.close(1000); } catch (e) { } }
    L.state = 'idle'; L.online = 0; L.unread = 0;
    if (forRun && lg) lg.logEl.textContent = '';                         // back from a run: a fresh lounge (nothing of it was received meanwhile)
    render();
  }
  function submit() {
    const t = lg.input.value.trim(); if (!t) return;
    if (cps(t) > MAXCP) { note(WHY.long()); return; }
    if (!L.ws || L.ws.readyState !== 1 || L.state !== 'online') { note('Not connected to the lounge yet.'); return; }
    L.ws.send(JSON.stringify({ t: 'social_send', text: t })); L.sent++;
    lg.input.value = '';
  }
  function nickLater() {
    clearTimeout(L.nickT);
    L.nickT = setTimeout(() => { const n = myName(); if (n !== L.nick && L.ws && L.ws.readyState === 1 && L.state === 'online') { L.nick = n; L.ws.send(JSON.stringify({ t: 'social_nick', nick: n })); } }, 800);
  }

  /* ================================================================ IN LEVEL · NEARBY */
  const B = new Map();                                                   // speaker id -> its bubble { el, txt, arrow, until, born, w, h, mode, x, y, a }
  const names = new Map(), recent = new Map(), muted = new Set();        // game session ids (this visit only)
  let hintEl = null, hintShown = false, sendSay = null, layer = null, comp = null, sayBtn = null, toastEl = null, toastT = 0, epoch = null, sayShown = false, heardN = 0, shownN = 0;
  const coarse = matchMedia('(pointer:coarse)');
  const myGameId = () => { const A = API(); return A && A.H ? A.H.id : null; };
  const overlayOpen = () => vis('dialog') || vis('caught') || vis('won') || vis('runMenu') || vis('appearancePanel') || vis('menu') || !!document.querySelector('.ui-sheet:not([hidden])');
  function canSpeak() {
    const A = API(), N = NET();
    return !!(A && N && N.on && typeof sendSay === 'function' && A.started && A.started() && !A.paused() && !(A.G && A.G.caught) && !overlayOpen());
  }
  function ensureLayer() { if (!layer) { layer = mk('div', 'chat-layer', null, { id: 'chatLayer', 'aria-hidden': 'true' }); document.body.appendChild(layer); } return layer; }
  function clearBubbles() { for (const b of B.values()) b.el.remove(); B.clear(); }
  function toast(s) {
    if (!toastEl) { toastEl = mk('p', 'say-toast', null, { id: 'sayToast', role: 'status' }); document.body.appendChild(toastEl); }
    toastEl.textContent = s; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }
  function heard(m, peer) {
    if (typeof m.text !== 'string' || typeof m.id !== 'number') return;
    heardN++;
    const own = m.id === myGameId();
    if (!own && peer && typeof peer.n === 'string') names.set(m.id, peer.n);
    if (!own) { recent.set(m.id, Date.now()); if (recent.size > 8) recent.delete(recent.keys().next().value); if (comp && comp.more.getAttribute('aria-expanded') === 'true') renderOptions(); }
    if (muted.has(m.id) || !S.bubbles) return;
    const L0 = ensureLayer();
    let b = B.get(m.id);
    if (!b) {
      const el = mk('div', own ? 'bb bb-own' : 'bb'), txt = mk('span', 'bb-text'), arrow = mk('i', 'bb-arrow');
      el.append(txt, arrow); L0.append(el);
      b = { el, txt, arrow, mode: '', x: NaN, y: NaN, a: NaN }; B.set(m.id, b);
    }
    // A per-message color is validated and room-scoped by the speech server. Older servers have no 'c'.
    const color = typeof m.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.c) ? m.c : '#e3c768';
    b.el.style.setProperty('--bb-accent', color);
    b.txt.textContent = m.text; b.el.classList.remove('bb-out'); b.el.classList.toggle('bb-big', S.big);
    const now = performance.now(); b.born = now; b.until = now + Math.max(3000, Math.min(5000, 3000 + 12.5 * cps(m.text))); b.w = 0; shownN++;
    if (!own) announce(`${names.get(m.id) || 'Someone'} nearby says: ${m.text}`);
  }
  // where the bubbles go: called by mp.js every frame (after the other players are drawn), with the frame's camera
  function ensureHint() {
    if (!hintEl) { hintEl = mk('p', 'say-keyhint', null, { id: 'chatKeyHint', hidden: '', 'aria-label': 'Press Enter for nearby chat' });
      hintEl.append(mk('kbd', null, 'ENTER'), document.createTextNode(' Nearby Chat')); document.body.appendChild(hintEl); }
    return hintEl;
  }
  function frame(f) {
    if (comp && !comp.form.hidden && !canSpeak()) closeComposer();
    const showHint = !coarse.matches && canSpeak() && (!comp || comp.form.hidden);
    if (showHint !== hintShown) { hintShown = showHint; ensureHint().hidden = !showHint; }
    if (coarse.matches) { const w = canSpeak() && (!comp || comp.form.hidden); if (w !== sayShown) { sayShown = w; ensureSay().hidden = !w; } }
    else if (sayShown) { sayShown = false; if (sayBtn) sayBtn.hidden = true; }
    if (!B.size) return;
    const A = API(), N = NET();
    const w = window.__epochDebug ? window.__epochDebug().w : null;
    if (!f || !f.run || !N || !N.on || !A || !A.started() || (A.G && A.G.caught) || vis('caught') || (epoch !== null && w !== epoch)) { epoch = w; clearBubbles(); return; }
    epoch = w;
    const now = performance.now(), me = myGameId(), list = window.__peerNet ? window.__peerNet().peers : [], pos = new Map();
    for (const o of list) pos.set(o.id, o);
    const W = f.W, H = f.H, sc = f.sc, cam = f.cam, M = 14;
    for (const [id, b] of B) {
      let x, y;
      if (id === me) { x = f.p.x; y = f.p.y; }
      else { const o = pos.get(id); if (!o || o.d) { b.el.remove(); B.delete(id); continue; } x = o.x; y = o.y; }   // gone, or dead: its words go too
      if (now >= b.until) { b.el.remove(); B.delete(id); continue; }
      b.el.classList.toggle('bb-out', !reduced() && b.until - now < 400);
      const sx = W / 2 + (x - cam.x) * sc, sy = H / 2 + (y - cam.y) * sc;
      const on = sx > M && sx < W - M && sy > M && sy < H - M;
      const mode = on ? 'bb-on' : 'bb-hint';
      if (mode !== b.mode) { b.el.classList.remove('bb-on', 'bb-hint'); b.el.classList.add(mode); b.mode = mode; b.w = 0; }
      if (!b.w) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
      let px, py, ang = 0;
      if (on) { px = sx - b.w / 2; py = sy - 26 * sc - 14 - b.h; px = Math.max(4, Math.min(W - b.w - 4, px)); py = Math.max(4, py); }
      else {                                                              // the edge of the screen, toward the speaker
        const dx = sx - W / 2, dy = sy - H / 2, hw = W / 2 - b.w / 2 - 12, hh = H / 2 - b.h / 2 - 12;
        const k = Math.min(Math.abs(hw / (dx || 1e-6)), Math.abs(hh / (dy || 1e-6)));
        px = W / 2 + dx * k - b.w / 2; py = H / 2 + dy * k - b.h / 2; ang = Math.atan2(dy, dx);
      }
      px = Math.round(px); py = Math.round(py);
      if (px !== b.x || py !== b.y) { b.el.style.transform = `translate3d(${px}px,${py}px,0)`; b.x = px; b.y = py; }
      if (!on && !(Math.abs(ang - b.a) <= .02)) { b.arrow.style.transform = `rotate(${ang.toFixed(3)}rad)`; b.a = ang; }
    }
  }
  // the composer
  function ensureComposer() {
    if (comp) return comp;
    const form = mk('form', 'say', null, { id: 'sayBox', hidden: '', 'data-chat': 'nearby', autocomplete: 'off', 'aria-label': 'Say something nearby' });
    const scope = mk('span', 'say-scope', 'Nearby', { title: 'Only players near you hear this' });
    const lab = mk('label', 'u-vh', 'Say to players near you', { for: 'sayText' });
    const input = mk('input', 'say-input', null, { id: 'sayText', maxlength: String(MAXCP * 2), autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Say something', 'data-chat-input': '' });
    const go = mk('button', 'say-go', 'Say', { type: 'submit' });
    const more = mk('button', 'say-more', 'Options', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'sayOpts' });
    const opts = mk('div', 'say-opts', null, { id: 'sayOpts', hidden: '' });
    form.append(scope, lab, input, go, more, opts);
    document.body.appendChild(form);
    comp = { form, input, go, more, opts };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const t = input.value.trim(), N = NET();
      if (t && cps(t) > MAXCP) { toast(WHY.long()); return; }
      if (t && typeof sendSay === 'function') {
        const v = window.__settings && window.__settings.get ? window.__settings.get().c : '';
        sendSay(t, typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '');
      }
      closeComposer();
    });
    more.addEventListener('click', () => { const o = more.getAttribute('aria-expanded') !== 'true'; more.setAttribute('aria-expanded', String(o)); opts.hidden = !o; if (o) renderOptions(); });
    opts.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.dataset.opt === 'bubbles') { S.bubbles = !S.bubbles; save(); if (!S.bubbles) clearBubbles(); }
      else if (b.dataset.opt === 'big') { S.big = !S.big; save(); for (const x of B.values()) { x.el.classList.toggle('bb-big', S.big); x.w = 0; } render(); }
      else if (b.dataset.mute) { const id = +b.dataset.mute; if (muted.has(id)) muted.delete(id); else { muted.add(id); const x = B.get(id); if (x) { x.el.remove(); B.delete(id); } } }
      renderOptions(); const again = opts.querySelector(`[data-opt="${b.dataset.opt || ''}"]${b.dataset.mute ? `,[data-mute="${b.dataset.mute}"]` : ''}`); if (again) again.focus();
    });
    form.addEventListener('focusout', e => { if (!form.contains(e.relatedTarget)) setTimeout(() => { if (!form.contains(document.activeElement)) closeComposer(); }, 0); });
    return comp;
  }
  function renderOptions() {
    const o = comp.opts; o.textContent = '';
    o.append(mk('button', 'say-opt', `Speech bubbles: ${S.bubbles ? 'shown' : 'hidden'}`, { type: 'button', 'data-opt': 'bubbles', 'aria-pressed': String(S.bubbles) }),
      mk('button', 'say-opt', `Text size: ${S.big ? 'large' : 'normal'}`, { type: 'button', 'data-opt': 'big', 'aria-pressed': String(S.big) }));
    const ids = [...recent.keys()].reverse();
    const h = mk('p', 'say-opt-h', ids.length ? 'People you heard (mute for this visit):' : 'Nobody nearby has spoken yet.'); o.append(h);
    for (const id of ids) { const n = names.get(id) || `Wanderer ${id}`, m = muted.has(id); o.append(mk('button', 'say-opt', `${n}: ${m ? 'muted' : 'heard'}`, { type: 'button', 'data-mute': String(id), 'aria-pressed': String(m), 'aria-label': `${m ? 'Unmute' : 'Mute'} ${n}` })); }
  }
  function openComposer() {
    if (!canSpeak()) return false;
    const c = ensureComposer(), A = API();
    if (A && A.keys && A.keys.clear) A.keys.clear();                     // nobody walks on while typing
    c.form.hidden = false; c.opts.hidden = true; c.more.setAttribute('aria-expanded', 'false');
    if (sayBtn) { sayBtn.hidden = true; sayShown = false; }
    c.input.focus({ preventScroll: true });
    return true;
  }
  function closeComposer() {
    if (!comp || comp.form.hidden) return;
    comp.form.hidden = true; comp.input.value = '';
    if (comp.form.contains(document.activeElement)) document.activeElement.blur();
  }
  function ensureSay() {
    if (sayBtn) return sayBtn;
    sayBtn = mk('button', 'say-touch', 'Say', { type: 'button', id: 'chatSay', hidden: '', 'aria-label': 'Say something nearby' });
    sayBtn.addEventListener('click', () => openComposer());
    document.body.appendChild(sayBtn); return sayBtn;
  }

  /* ---------------------------------------------------------------- keys: a chat field's keys are its own; Enter opens the composer */
  const typing = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || !!(t && t.isContentEditable);
  const inChat = t => !!(t && t.closest && t.closest('[data-chat]'));
  addEventListener('keydown', e => {
    const t = e.target;
    if (inChat(t)) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (comp && comp.form.contains(t)) closeComposer();
        else if (L.sheet) sheet(false);
        else if (t.blur) t.blur();
      }
      e.stopImmediatePropagation(); return;                              // the game, the menus and the key remapping never see it
    }
    if (e.key === 'Enter' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(t) && canSpeak()) { e.preventDefault(); e.stopImmediatePropagation(); openComposer(); }
  }, true);
  addEventListener('keypress', e => { if (inChat(e.target)) e.stopImmediatePropagation(); }, true);

  /* ---------------------------------------------------------------- wiring */
  window.__chat = {
    link(api) { if (api && typeof api.say === 'function') sendSay = api.say; },   // mp.js's session: its send of {t:'say'}
    net(m, peer) { if (!m) return; if (m.t === 'heard') heard(m, peer); else if (m.t === 'said' && m.ok === 0) toast(why(m)); },
    state: () => ({
      lounge: { state: S.on ? L.state : 'off', id: L.id, online: L.online, lines: lg ? lg.logEl.querySelectorAll('li.lg-line').length : 0, unread: L.unread, muted: L.muted.size, sheet: L.sheet, open: !!L.ws, opens: L.opens, sent: L.sent, got: L.got, wide: wideMQ.matches, folded: S.fold },
      nearby: { bubbles: [...B].map(([id, b]) => ({ id, mode: b.mode, x: b.x, y: b.y, w: b.w, h: b.h, a: Number.isFinite(b.a) ? +b.a.toFixed(3) : null })), composer: !!comp && !comp.form.hidden, say: sayShown, heard: heardN, shown: shownN, muted: muted.size },
      settings: Object.assign({}, S),
    }),
    open: () => openComposer(),
  };
  window.__chatFrame = frame;
  const start = () => {
    build(); sync();
    const mo = new MutationObserver(sync);
    for (const id of ['menu', 'hud']) { const e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['hidden'] }); }
    document.addEventListener('visibilitychange', sync);
    addEventListener('pageshow', sync);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
