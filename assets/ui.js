/* THE FAR BACKROOMS - Stage 3C UI controller (QA1: the main menu rebuilt from the user's rough draft, and its theme).
 *
 * One owner for the game's menus: the main menu (PLAY and its entry / CUSTOMIZE / SETTINGS / CREDITS, the identity rail, the
 * utility rail), the main-menu theme, the shared sheet behaviour (open, close, focus trap, Escape, focus return), the Settings,
 * Credits and Help pages, reduced motion, and the run-state focus hooks.
 *
 * It never re-implements what the game does. The game bundle wires its own buttons by id (#enter starts a run, #customize
 * opens the customize panel, #help pauses, #resume / #reset / #retry / #playAgain / #runSpawn / #runEnd ...); this file
 * only presses those same buttons, watches the panels the bundle shows and hides, and draws the menu around them.
 * Loaded before hud.js and inventory.js, so its capture-phase keys run first - but only while one of its own modals is open.
 * Event-driven: no per-frame work, except the menu's pointer parallax (one style write per animation frame, and only while
 * the menu is open and the pointer moves).
 *
 *   window.__ui = { version, go(view, sub), state(), settingsPages(), close(), entryOpen(), theme }   (go: 'home' | 'play' |
 *   'customize' | 'settings' | 'credits' | 'controls' | 'help'; sub: a settings page or a customize tab; 'play' opens the entry,
 *   'home' closes it; theme.info() reports the menu music's state) */
(() => {
  'use strict';
  const VERSION = 'stage-3c-qa1';
  const $ = id => document.getElementById(id);
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const shown = el => !!el && !el.hidden && el.getClientRects().length > 0;
  const focusables = el => [...el.querySelectorAll(FOCUSABLE)].filter(e => e.tabIndex >= 0 && shown(e) && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden');   // what Tab can reach (roving radios keep one stop)
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;
  const KINDS = { flashlight: 'Flashlight', headlamp: 'Headlamp', lantern: 'Lantern', camcorder: 'Night Vision Camcorder' };
  const KIND_LINE = {
    flashlight: 'Longest reach. A narrow beam that follows your mouse.',
    headlamp: 'Hands-free. A wider, shorter cone that turns with you.',
    lantern: 'A warm glow all around you. Short reach, no aiming.',
    camcorder: 'Emits no visible light; its night vision uses infrared.',
  };
  const NAME_KEY = 'tfb.wanderer.name';
  const coarse = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  /* cosmetic backpacks are gone: a saved legacy pack becomes "none" before the game reads the save (this file runs before the
     game's module). Nothing else in the save changes. */
  try { const k = 'wanderer-appearance', a = JSON.parse(localStorage.getItem(k) || 'null');
    if (a && typeof a === 'object' && 'backpack' in a && a.backpack !== 'none') { a.backpack = 'none'; localStorage.setItem(k, JSON.stringify(a)); } } catch (e) { }

  /* ---------------------------------------------------------------- reduced motion */
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  // the settings model (hud.js) loads just after this file: until then the stored choice is read directly, so a saved "on" holds from the first frame
  const storedRm = () => { try { const v = JSON.parse(localStorage.getItem('fb_settings_v1') || '{}').rm; return ['auto', 'on', 'off'].includes(v) ? v : 'auto'; } catch (e) { return 'auto'; } };
  const motionMode = () => { const s = window.__settings && __settings.get(); return s ? (s.rm || 'auto') : storedRm(); };
  const reduced = () => { const m = motionMode(); return m === 'on' || (m === 'auto' && mq.matches); };
  const applyMotion = () => root.classList.toggle('rm', reduced());
  mq.addEventListener && mq.addEventListener('change', () => { applyMotion(); if (typeof syncSettings === 'function') syncSettings(); });
  applyMotion();

  /* the title is sized for a wide fallback face until Barlow Condensed has actually loaded (then html.u-cond: the full size).
     document.fonts.check() cannot tell: it answers true for a family with no @font-face at all. */
  const condCheck = () => { try { root.classList.toggle('u-cond', [...document.fonts].some(f => /Barlow Condensed/i.test(f.family) && f.status === 'loaded')); } catch (e) { } };
  if (document.fonts) { document.fonts.ready.then(condCheck); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', condCheck); }

  /* ---------------------------------------------------------------- sheets */
  const stack = [];                                   // open sheets, top last: { el, opener }
  const timers = new WeakMap();
  function openSheet(el, opener) {
    if (!el) return;
    const i = stack.findIndex(s => s.el === el); if (i >= 0) stack.splice(i, 1);
    stack.push({ el, opener: opener || document.activeElement });
    clearTimeout(timers.get(el)); el.hidden = false; void el.offsetWidth; el.classList.add('in');
    document.body.classList.add('ui-sheet-open');
    const f = el.querySelector('[data-autofocus]') || focusables(el)[0]; if (f) f.focus({ preventScroll: true });
    syncNav();
  }
  function closeSheet(el) {
    const i = el ? stack.findIndex(s => s.el === el) : stack.length - 1; if (i < 0) return;
    const [top] = stack.splice(i, 1);
    top.el.classList.remove('in');
    timers.set(top.el, setTimeout(() => { top.el.hidden = true; }, reduced() ? 0 : 380));
    if (!stack.length) document.body.classList.remove('ui-sheet-open');
    const back = top.opener && document.contains(top.opener) && shown(top.opener) ? top.opener : null;
    if (back) back.focus({ preventScroll: true }); else focusState();
    syncNav();
  }
  const closeAll = () => { while (stack.length) closeSheet(); };
  function sheet(id, title, sub) {
    const el = document.createElement('div');
    el.className = 'ui-sheet'; el.id = id; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', id + 'T');
    el.innerHTML = `<div class="us-back" data-close></div><section class="us-card"><div class="us-head"><div><h2 id="${id}T">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>` +
      `<button type="button" class="us-close" data-close><span>Close</span><kbd>Esc</kbd></button></div><div class="us-body"></div></section>`;
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(el); });
    el.addEventListener('keydown', e => { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); });   // typing / arrowing never reaches the game
    el.addEventListener('keyup', e => e.stopPropagation());
    document.body.appendChild(el);
    return el;
  }

  /* ---------------------------------------------------------------- keys: Escape and Tab inside UI modals */
  const vis = id => { const e = $(id); return !!e && !e.hidden; };
  function topModal() {
    if (stack.length) return { el: stack[stack.length - 1].el, sheet: true };
    if (vis('appearancePanel')) return null;          // the customize panel keeps its own trap and Escape (the game's)
    for (const id of ['caught', 'won', 'runMenu', 'dialog']) if (vis(id)) return { el: $(id), sheet: false };
    return null;
  }
  function trap(el, e) {
    const f = focusables(el); if (!f.length) { e.preventDefault(); return; }
    const a = document.activeElement, i = f.indexOf(a);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  }
  addEventListener('keydown', e => {
    const m = topModal();
    if (!m && e.key === 'Escape' && entryOpen && vis('menu') && !vis('appearancePanel')) { e.preventDefault(); e.stopImmediatePropagation(); closeEntry(true); return; }
    if (!m) return;
    if (e.key === 'Escape' && m.sheet) { e.preventDefault(); e.stopImmediatePropagation(); closeSheet(); return; }
    if (e.key === 'Tab') { trap(m.el, e); e.stopImmediatePropagation(); }       // focus stays in the modal; the inventory's TAB does not fire under it
  }, true);
  // Space presses the focused button in a menu or a modal. (The game cancels Space and the arrows on the window so they never
  // scroll the page; inside its menus that also stopped Space from pressing buttons.) Only for buttons inside menus and modals:
  // during play nothing changes.
  const MENUS = '#menu,#dialog,#caught,#won,#runMenu,.ui-sheet';
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    const t = e.target; if (!(t instanceof Element) || !t.closest(MENUS)) return;
    if (t.matches('button,[role=switch],[role=tab],[role=radio],a[href]')) e.stopPropagation();
  });

  /* ---------------------------------------------------------------- the main menu (QA1: built from the user's rough draft)
     PLAY opens the entry (Level 0, your name and light, ENTER LEVEL 0). Only ENTER LEVEL 0 - the game's own #enter - starts a run. */
  const menu = $('menu'), stageEl = $('mmStage'), entryEl = $('mmEntry');
  const navBtns = () => [...menu.querySelectorAll('.mm-play,.mm-row .mm-item')];
  let current = 'play', entryOpen = false, guardUntil = 0;
  function syncNav() {
    const top = stack.length ? stack[stack.length - 1].el.id : (vis('appearancePanel') ? 'appearancePanel' : '');
    current = top === 'uiSettings' ? 'settings' : top === 'uiCredits' ? 'credits' : top === 'uiHelp' ? 'help' : top === 'appearancePanel' ? 'customize' : 'play';
    if (!menu) return;
    menu.querySelectorAll('.mm-row [data-go],.mm-util [data-go]').forEach(b => { const on = b.dataset.go === current; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  const NAME_FALLBACK = 'Wanderer';
  const nm = $('name');
  const saveName = () => { try { const v = (nm && nm.value || '').trim(); if (v) localStorage.setItem(NAME_KEY, v); else localStorage.removeItem(NAME_KEY); } catch (e) { } };
  const nameNow = () => ((nm && nm.value || '').trim() || NAME_FALLBACK);
  function openEntry(byPointer) {
    if (!entryEl || !vis('menu')) return;
    if (!entryOpen) { entryOpen = true; stageEl.hidden = true; entryEl.hidden = false; menu.classList.add('in-entry'); }
    // a double click on PLAY must not also press ENTER LEVEL 0, which now sits under the pointer
    guardUntil = byPointer ? Date.now() + 450 : 0;
    menuRefresh(); entryFit();
    const e = $('enter'); if (e) e.focus({ preventScroll: true });
  }
  function closeEntry(focusPlay) {
    if (!entryOpen) return;
    entryOpen = false; entryEl.hidden = true; stageEl.hidden = false; menu.classList.remove('in-entry', 'mm-tight');
    if (focusPlay) { const p = $('mmPlay'); if (p) p.focus({ preventScroll: true }); }
  }
  // where the entry would cover the title (a short screen), the title steps back while the entry is open
  function entryFit() {
    const t = $('mmTitle'); if (!t) return;
    menu.classList.remove('mm-tight');
    if (entryOpen) menu.classList.toggle('mm-tight', entryEl.offsetTop < t.offsetTop + t.offsetHeight + 12);
  }
  addEventListener('resize', () => { if (entryOpen) entryFit(); });
  if (menu) {
    menu.addEventListener('click', e => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      e.preventDefault(); go(b.dataset.go, b.dataset.sub, b, e.detail > 0);
    });
    menu.addEventListener('keydown', e => {                                  // arrows move through PLAY and its row
      const b = e.target.closest && e.target.closest('.mm-play,.mm-row .mm-item'); if (!b) return;
      const l = navBtns(), i = l.indexOf(b), d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
      if (d) { e.preventDefault(); l[(i + d + l.length) % l.length].focus(); }
    });
    // parallax: the pointer leans the title a few pixels (one style write per frame, only while the mouse moves)
    let px = 0, py = 0, pend = false;
    menu.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduced()) return;
      px = (e.clientX / innerWidth - .5) * 2; py = (e.clientY / innerHeight - .5) * 2;
      if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; menu.style.setProperty('--mx', px.toFixed(3)); menu.style.setProperty('--my', py.toFixed(3)); }); }
    });
    if (nm) {
      try { const v = localStorage.getItem(NAME_KEY); if (v && !nm.value) nm.value = v.slice(0, 20); } catch (e) { }
      nm.addEventListener('input', () => { const n = $('mmEntryName'); if (n) n.textContent = nameNow(); });
      nm.addEventListener('change', saveName);
    }
    const enter = $('enter');
    if (enter) enter.addEventListener('click', saveName, true);
    const rn = $('mmRename');
    if (rn && nm) rn.addEventListener('click', () => { nm.focus(); nm.select(); });
    const snd = $('mmSound');
    if (snd) snd.addEventListener('click', () => { const s = $('sound'); if (s) s.click(); });   // the game's own SOUND ON/OFF
    const note = $('mmNote'); if (note && coarse()) note.textContent = 'Headphones recommended. Move with the on-screen control, bottom left. PAUSE is top right.';
    const ver = $('mmVer'), V = window.TFB_CREDITS && TFB_CREDITS.version; if (ver && V) ver.textContent = 'v' + V;
  }
  addEventListener('keydown', e => {
    const t = e.target;
    // Enter in the name field: on the menu it opens the entry (PLAY); inside the entry it is the game's own start, as before
    if (e.key === 'Enter' && t && t.id === 'name' && vis('menu')) {
      saveName();
      if (!entryOpen) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { openEntry(false); if (e.isTrusted) theme.unlock(); } }
      return;
    }
    // a held Enter that opened the entry never repeats into ENTER LEVEL 0
    if (e.key === 'Enter' && e.repeat && t && t.id === 'enter') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('click', e => {
    if (guardUntil && Date.now() < guardUntil && e.target && e.target.closest && e.target.closest('#enter')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // SOUND ON/OFF from anywhere (this rail, Settings, the header): the rail's icon and the theme follow the game's own flag
  document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#sound')) soundSync(); });
  function soundSync() {
    const Z = window.__api && __api.audio && __api.audio(), on = !(Z && Z.muted), b = $('mmSound');
    if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off'); b.dataset.tip = on ? 'Sound on' : 'Sound off'; }
    theme.sync();
  }

  /* what the menu shows about you: name, light, and your wanderer's colours on the little round glyph (drawn once per change) */
  function menuRefresh() {
    const A = window.__api; if (!A || !A.gear) return;
    const k = A.gear.eq.kind, kn = KINDS[k] || k;
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('mmKind', kn); set('mmKindText', KIND_LINE[k] || ''); set('mmEntryKind', kn); set('mmEntryName', nameNow());
    if (window.__inv && __inv._paint) for (const [id, s] of [['mmLight', .78], ['mmEntryLight', .8]]) { const cv = $(id); if (cv && shown(cv)) { try { __inv._paint(cv, k, s, 0, -.5); } catch (e) { } } }
    const g = $('mmGlyph'), L = A.look; if (g && L) { g.style.setProperty('--gm', L.main || '#ffcc77'); g.style.setProperty('--gh', L.hands || L.main || '#ffcc77'); }
  }
  const loadoutSummary = menuRefresh;

  /* the connection, from the game's own line (mp.js: SOLO / CONNECTING / ONLINE · ROOM x · n WANDERERS ...). On the menu you are
     not in the world, so the line's count (which includes you) becomes "the others inside". Rewritten only when it changes. */
  const netEl = $('net'), bootAt = Date.now();
  let connKey = '';
  function connRefresh() {
    if (!menu || !vis('menu')) return;
    const t = (netEl && netEl.textContent || '').trim(), m = /^ONLINE · ROOM (.+?) · (\d+) WANDERERS?\b/.exec(t);
    const c = m ? { mode: 'online', room: m[1], others: Math.max(0, +m[2] - 1) }
      : /RECONNECTING/.test(t) ? { mode: 'reconnecting' }
      : /^CONNECTING/.test(t) || (t === 'SOLO' && Date.now() - bootAt < 5000 && location.protocol !== 'file:') ? { mode: 'connecting' } : { mode: 'solo' };
    const key = JSON.stringify(c); if (key === connKey) return; connKey = key;
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('mmRoom', c.mode === 'online' ? 'Room ' + c.room : 'Connection');
    const link = $('mmLink'); if (link) { link.textContent = { online: 'Online', reconnecting: 'Reconnecting', connecting: 'Connecting', solo: 'Solo' }[c.mode]; link.dataset.mode = c.mode; }
    set('mmInside', c.mode === 'online' ? (c.others === 0 ? 'No one else is in the halls right now.' : c.others === 1 ? 'One other wanderer is in the halls right now.' : c.others + ' other wanderers are in the halls right now.')
      : c.mode === 'connecting' ? 'Looking for the server.' : c.mode === 'reconnecting' ? 'The server dropped. Trying again; you can still play alone.' : 'No server. You will play alone.');
    set('mmShared', c.mode === 'online' ? 'Everyone in this room walks the same halls and meets the same monsters.' : '');
  }
  if (netEl) new MutationObserver(connRefresh).observe(netEl, { childList: true, characterData: true, subtree: true });
  setTimeout(connRefresh, 5100);

  /* the title's tube dips now and then: a 0.9 s animation every 25-55 s while the menu is up (no animation runs in between) */
  let humT = 0;
  function humLater() {
    clearTimeout(humT);
    humT = setTimeout(() => {
      const t = $('mmTitle');
      if (t && vis('menu') && !reduced() && !document.hidden) { t.classList.remove('hum'); void t.offsetWidth; t.classList.add('hum'); setTimeout(() => t.classList.remove('hum'), 1000); }
      if (vis('menu')) humLater();
    }, 25000 + Math.random() * 30000);
  }

  /* ---------------------------------------------------------------- the main-menu theme (the user's MainTheme)
     The Intro plays once, the Loop follows it sample-accurately and repeats on its own (the Loop file is the whole repeating body,
     authored with its own seam). It plays only on the true main menu - through PLAY, Customize, Settings, Credits and Help - fades
     out over a second when ENTER LEVEL 0 starts the run, and starts again from the Intro when the menu comes back after a run.
     Its own small Web Audio graph: the game's audio graph only exists once a run starts (creating it starts the halls' ambience),
     so the menu cannot use it early; the theme follows the game's SOUND ON/OFF flag and the master volume all the same.
     Autoplay: nothing is created or fetched until the player's first press on the menu. The two files (22.6 MB, PCM, served
     uncached) are fetched once and then kept in this browser's Cache Storage under their content hashes. No per-frame work. */
  const THEME = { intro: 'assets/MainTheme_MenuIntro.wav', loop: 'assets/MainTheme_MenuLoop.wav', v: '64b2124b.848db3af', gain: .7, fade: 1, rate: 44100 };
  const theme = (() => {
    const CACHE = 'tfb-menu-theme-' + THEME.v;
    let ctx = null, out = null, bufs = null, loading = null, abort = null, srcs = [], fading = [], want = false, st = 'idle', loadT = 0, stopT = 0, hidPause = false;
    const T = { plays: 0, loads: 0, fetched: 0, cacheHits: 0, t0: null, loopAt: null, fadeAt: null, fadeEnd: null, error: null };
    const Z = () => window.__api && __api.audio && __api.audio();
    const muted = () => { const z = Z(); return !!(z && z.muted); };
    const vol = () => { const s = window.__settings && __settings.get && __settings.get(); const v = s ? s.vol : window.__vol; return Number.isFinite(v) ? v : 1; };
    const level = () => muted() ? 0 : THEME.gain * vol();
    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC({ sampleRate: THEME.rate, latencyHint: 'playback' }); }     // the files' own rate: decoding never resamples the seams
      catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
      out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
      return ctx;
    }
    async function get(path, signal) {
      const url = path + '?v=' + THEME.v;
      let cache = null, res = null;
      try { if (window.caches && window.isSecureContext) { cache = await caches.open(CACHE); res = await cache.match(url, { ignoreVary: true }); } } catch (e) { cache = null; res = null; }
      if (res) { T.cacheHits++; return res.arrayBuffer(); }
      res = await fetch(url, { signal, credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ab = await res.arrayBuffer(); T.fetched++;
      if (cache) cache.put(url, new Response(ab.slice(0), { headers: { 'Content-Type': 'audio/wav' } })).catch(() => { });
      return ab;
    }
    const decode = ab => new Promise((ok, no) => { const p = ctx.decodeAudioData(ab, ok, no); if (p && p.catch) p.catch(no); });
    function load() {
      if (bufs || loading || !ctx) return;
      st = 'loading'; T.loads++; abort = window.AbortController ? new AbortController() : null;
      const sig = abort && abort.signal;
      loading = Promise.all([get(THEME.intro, sig), get(THEME.loop, sig)]).then(([a, b]) => Promise.all([decode(a), decode(b)])).then(([ib, lb]) => {
        bufs = { intro: ib, loop: lb };
        try { caches.keys().then(ks => ks.forEach(k => { if (k.indexOf('tfb-menu-theme-') === 0 && k !== CACHE) caches.delete(k); })).catch(() => { }); } catch (e) { }
        if (want) start(); else st = 'ready';
      }).catch(e => { T.error = String(e && (e.name || e.message) || e); st = want ? 'error' : 'idle'; }).finally(() => { loading = null; abort = null; });
    }
    const loadSoon = ms => { clearTimeout(loadT); loadT = setTimeout(() => { if (want && vis('menu') && !muted()) load(); }, ms); };
    // the Intro at t0 (on a sample frame), the Loop at the frame right after the Intro's last one, looping its whole buffer
    function schedule(c, dest, t0, ib, lb) {
      const a = c.createBufferSource(), b = c.createBufferSource();
      a.buffer = ib; b.buffer = lb; b.loop = true;
      a.connect(dest); b.connect(dest);
      const t1 = t0 + ib.length / c.sampleRate;
      a.start(t0); b.start(t1);
      return { a, b, t1 };
    }
    function drop() { for (const s of srcs.concat(fading)) { try { s.stop(); } catch (e) { } try { s.disconnect(); } catch (e) { } } srcs = []; fading = []; }
    function start() {
      if (!ctx || !bufs) return;
      drop(); clearTimeout(stopT);
      const sr = ctx.sampleRate, now = ctx.currentTime, t0 = Math.ceil((now + .06) * sr) / sr;
      out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(level(), now);
      const s = schedule(ctx, out, t0, bufs.intro, bufs.loop);
      srcs = [s.a, s.b]; T.t0 = t0; T.loopAt = s.t1; T.plays++; st = 'playing';
      if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => { });
    }
    function stop(fade) {
      clearTimeout(loadT);
      if (loading && abort) abort.abort();                                   // the run started before the music arrived
      if (!ctx) { st = 'idle'; return; }
      if (!srcs.length) { if (ctx.state === 'running') ctx.suspend().catch(() => { }); if (st !== 'loading') st = bufs ? 'stopped' : 'idle'; return; }
      const now = ctx.currentTime, end = now + (fade ? THEME.fade : .03), g = out.gain;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, end);
      const mine = srcs; srcs = []; fading = mine;
      for (const s of mine) { try { s.stop(end + .01); } catch (e) { } }
      st = 'fading'; T.fadeAt = now; T.fadeEnd = end;
      clearTimeout(stopT);
      stopT = setTimeout(() => { for (const s of mine) { try { s.disconnect(); } catch (e) { } } if (fading === mine) fading = []; if (want) return; st = 'stopped'; ctx.suspend().catch(() => { }); }, (end - now) * 1000 + 150);
    }
    function setWant(on) {
      on = !!on; if (on === want) return; want = on;
      if (!on) { stop(true); return; }
      if (!ctx) { st = 'waiting'; return; }                                  // until the first press on the menu
      if (bufs) start(); else loadSoon(250);
    }
    function unlock() {                                                      // a press on the menu: the browser now lets sound start
      if (!want || !vis('menu')) return;
      const c = ensure(); if (!c) return;
      if (c.state !== 'running' && !document.hidden) c.resume().catch(() => { });
      if (bufs) { if (st !== 'playing') start(); } else if (!loading) loadSoon(250);
    }
    function sync() {                                                        // SOUND ON/OFF or the master volume changed
      if (!ctx || !out) return;
      if (st === 'playing') out.gain.setTargetAtTime(level(), ctx.currentTime, .05);
      if (want && !bufs && !loading && !muted() && vis('menu')) loadSoon(0);
    }
    const onPress = e => {
      if (!e.isTrusted) return;                                             // only a real press lets sound start
      if (e.type === 'pointerdown' && e.pointerType !== 'mouse') return;     // touch and pen unlock on release (the browsers' rule)
      if (e.type === 'pointerup' && e.pointerType === 'mouse') return;
      if (e.type === 'keydown' && (e.key === 'Escape' || e.repeat)) return;
      const t = e.target;
      if (t && t.closest && t.closest('#enter')) return;                    // this press starts the run: no music for it
      if (e.type === 'keydown' && e.key === 'Enter' && t && t.id === 'name' && entryOpen) return;
      unlock();
    };
    for (const n of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) addEventListener(n, onPress, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {                   // a hidden tab is silent; the music carries on where it was
      if (!ctx) return;
      if (document.hidden) { if (ctx.state === 'running') { hidPause = true; ctx.suspend().catch(() => { }); } }
      else if (hidPause) { hidPause = false; if (want && srcs.length) ctx.resume().catch(() => { }); }
    });
    return {
      want: setWant, sync, unlock, _schedule: schedule,
      info: () => ({ state: st, want, ctx: ctx ? ctx.state : null, sampleRate: ctx ? ctx.sampleRate : null, now: ctx ? ctx.currentTime : null, gain: out ? out.gain.value : null, level: level(), muted: muted(),
        introFrames: bufs ? bufs.intro.length : null, loopFrames: bufs ? bufs.loop.length : null, introRate: bufs ? bufs.intro.sampleRate : null, sources: srcs.length,
        loopSourceLoops: srcs[1] ? srcs[1].loop : null, loopSourceLoopStart: srcs[1] ? srcs[1].loopStart : null, loopSourceLoopEnd: srcs[1] ? srcs[1].loopEnd : null, ...T, files: THEME }),
    };
  })();

  /* ---------------------------------------------------------------- navigation */
  function go(view, sub, opener, byPointer) {
    view = view || 'home';
    if (view === 'home' || view === 'play') {
      closeAll();
      if (vis('appearancePanel')) { const d = $('doneAppearance'); if (d) d.click(); }   // the game's own close (saves, restores the pause state)
      if (vis('menu')) { if (view === 'play') openEntry(!!byPointer); else closeEntry(true); syncNav(); }
      return;
    }
    if (view === 'customize') {
      closeAll();
      window.__uiCustomizeTab = sub || 'wanderer';
      // already open: only the tab changes. (Pressing #customize again would make the game remember "paused" as the state
      // to return to, and closing would then pause a run that was never started.)
      if (!vis('appearancePanel')) { const c = $('customize'); if (c) c.click(); } else { czTab(window.__uiCustomizeTab); czSync(); window.__uiCustomizeTab = null; }
      requestAnimationFrame(syncNav);
      return;
    }
    if (view === 'settings' || view === 'controls') { buildSettings(); showPage(view === 'controls' ? 'controls' : (sub || lastPage)); openSheet(settingsEl, opener); return; }
    if (view === 'credits') { buildCredits(); openSheet(creditsEl, opener); return; }
    if (view === 'help') { buildHelp(); openSheet(helpEl, opener); return; }
  }

  /* ---------------------------------------------------------------- help (the right rail's "i"): how to play, where the controls are */
  let helpEl = null;
  function buildHelp() {
    if (helpEl) return;
    helpEl = sheet('uiHelp', 'Help');
    const touch = coarse();
    helpEl.querySelector('.us-body').innerHTML = `<section class="hp-sec"><h3>How to play</h3>
<p>Level 0 is a maze of yellow rooms under humming lights. Somewhere a wall is glitching: find it and walk through it to get out.</p>
<p>Something hunts in the dark. If it finds you, break its line of sight and move quietly. Running drains stamina, and it is loud.</p>
<p>You carry one light for the run, chosen in Customize. Others in your room walk the same halls and meet the same monsters.</p></section>
<section class="hp-sec"><h3>Controls</h3>
<p>${touch ? 'On a touch screen: move with the on-screen control at the bottom left; RUN, CROUCH, LIGHT and INV are at the bottom right; PAUSE is at the top right.' : 'Move with W A S D or the arrow keys, aim your light with the mouse, hold Shift to run, C to crouch, F for your light, Tab for the inventory, Esc to pause.'}</p>
<button type="button" class="u-btn" data-help-controls>Every control and key</button></section>`;
    helpEl.querySelector('[data-help-controls]').addEventListener('click', () => { const s = stack.find(x => x.el === helpEl), op = s && s.opener; closeSheet(helpEl); go('controls', undefined, op); });
  }

  /* ---------------------------------------------------------------- settings */
  let settingsEl = null, lastPage = 'sound';
  const PAGES = [['sound', 'Sound'], ['hud', 'HUD'], ['graphics', 'Display'], ['controls', 'Controls']];
  const pct = v => Math.round(v * 100) + '%';
  const rangeFill = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  function buildSettings() {
    if (settingsEl) return syncSettings();
    settingsEl = sheet('uiSettings', 'Settings', 'Saved on this device. Nothing here changes what you or the entities can see.');
    const SW = window.__settings ? __settings.swatches() : [];
    const keys = (rows) => rows.map(([a, b]) => `<span>${esc(a)}</span><b>${esc(b)}</b>`).join('');
    settingsEl.querySelector('.us-body').innerHTML = `<div class="us-split">
<nav class="us-pages" role="tablist" aria-label="Settings pages">${PAGES.map(([k, n]) => `<button type="button" role="tab" id="stTab_${k}" aria-controls="stPage_${k}" data-page="${k}">${n}</button>`).join('')}</nav>
<div>
<section class="us-page" id="stPage_sound" role="tabpanel" aria-labelledby="stTab_sound">
  <h3>Sound</h3><p class="u-note">Headphones recommended. The halls are quiet; footsteps and what moves in the dark carry.</p>
  <div class="us-row"><span>Sound<small>The menu music, the ambience, footsteps, hum and entities.</small></span><button type="button" class="u-switch" role="switch" id="stSound" aria-label="Sound"></button></div>
  <div class="us-row wide"><label class="us-slider"><span>Master volume</span><output id="stVolV"></output><input class="u-range" type="range" id="stVol" min="0" max="100" step="5" aria-label="Master volume"></label></div>
</section>
<section class="us-page" id="stPage_hud" role="tabpanel" aria-labelledby="stTab_hud" hidden>
  <h3>HUD</h3><p class="u-note">How the on-screen readouts look. The camera and what you can see never change.</p>
  <div class="us-prev" id="stPrev" aria-hidden="true"><span>OBJECTIVE<b>FIND A GLITCHED WALL</b></span><span>WALKING</span><span>STAMINA<b>82</b><i></i></span></div>
  <div class="us-row wide"><span>Colour</span><div class="u-sws" role="radiogroup" aria-label="HUD colour" id="stSw">${SW.map(([c, n, show]) => `<button type="button" class="u-sw" role="radio" data-c="${c}" title="${n}" aria-label="${n}" style="--sw:${c || show}"></button>`).join('')}<span class="u-sw pick" title="Custom colour"><input type="color" id="stColor" value="#f3e7a7" aria-label="Custom HUD colour"></span></div></div>
  <div class="us-row wide"><label class="us-slider"><span>Size</span><output id="stSizeV"></output><input class="u-range" type="range" id="stSize" min="50" max="200" step="5" aria-label="HUD size"></label></div>
  <div class="us-row wide"><label class="us-slider"><span>Opacity</span><output id="stOpV"></output><input class="u-range" type="range" id="stOp" min="30" max="100" step="5" aria-label="HUD opacity"></label></div>
  <div class="us-row"><span>Key hints<small>The controls line at the bottom left.</small></span><button type="button" class="u-switch" role="switch" data-k="keys" aria-label="Key hints"></button></div>
  <div class="us-row"><span>Fade key hints<small>They dim after a while, until a run starts again.</small></span><button type="button" class="u-switch" role="switch" data-k="auto" aria-label="Fade key hints"></button></div>
  <div class="us-row"><span>Coordinates<small>Your position, bottom right.</small></span><button type="button" class="u-switch" role="switch" data-k="coords" aria-label="Coordinates"></button></div>
  <div class="us-row"><span>Level and sector title<small>Top right.</small></span><button type="button" class="u-switch" role="switch" data-k="title" aria-label="Level and sector title"></button></div>
  <div class="us-actions"><button type="button" class="u-btn ghost" id="stHudReset">Reset HUD</button></div>
</section>
<section class="us-page" id="stPage_graphics" role="tabpanel" aria-labelledby="stTab_graphics" hidden>
  <h3>Display</h3>
  <div class="us-row wide"><span>Lighting and shadows<small>How finely the lights and their shadows are drawn. Every setting lights the same places: higher only draws them more finely. Low suits phones and older computers.</small></span><div class="us-seg" role="radiogroup" aria-label="Lighting and shadows quality" id="stLq">${['low', 'medium', 'high'].map(q => `<button type="button" class="u-btn" role="radio" data-lq="${q}">${q}</button>`).join('')}</div></div>
  <div class="us-row wide"><span>Reduced motion<small>Stops the menus' flicker and slides, the title's lean and light, the HUD's fades, and the screen effects' animation. System follows your device's setting.</small></span><div class="us-seg" role="radiogroup" aria-label="Reduced motion" id="stRm">${[['auto', 'System'], ['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" class="u-btn" role="radio" data-rm="${v}">${n}</button>`).join('')}</div><p class="u-note" id="stRmNow"></p></div>
</section>
<section class="us-page" id="stPage_controls" role="tabpanel" aria-labelledby="stTab_controls" hidden>
  <h3>Controls</h3><p class="u-note">Keyboard and mouse. On a touch screen the same actions are on screen.</p>
  <div class="us-keys">
    <h4>Moving</h4>${keys([['Move', 'W A S D / Arrows'], ['Run (drains stamina, louder)', 'Hold Shift'], ['Crouch / stand', 'C'], ['Slide (while running)', 'C'], ['Vault or crawl', 'Walk into it']])}
    <h4>Light</h4>${keys([['Aim a handheld light', 'Mouse'], ['Light on / off, raise the camcorder', 'F']])}
    <h4>Night Vision Camcorder</h4>${keys([['Night vision', 'N or right click'], ['Infrared illuminator off / low / high', 'B'], ['Zoom', 'Mouse wheel / Z']])}
    <h4>Everything else</h4>${keys([['Inventory', 'Tab'], ['Cartograph (once you carry it)', 'M'], ['Pause / resume', 'Esc']])}
    <h4>Touch</h4>${keys([['Move', 'Pad, bottom left'], ['Run, crouch, light, inventory', 'Buttons, bottom right'], ['Night vision, infrared, zoom', 'NV, IR, ZOOM (camcorder)'], ['Pause', 'PAUSE, top right']])}
  </div>
</section>
</div></div>`;
    const q = s => settingsEl.querySelector(s);
    settingsEl.querySelector('.us-pages').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) showPage(b.dataset.page, true); });
    settingsEl.querySelector('.us-pages').addEventListener('keydown', e => {
      const l = [...settingsEl.querySelectorAll('.us-pages button')], i = l.indexOf(document.activeElement);
      const d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
      if (d && i >= 0) { e.preventDefault(); const n = l[(i + d + l.length) % l.length]; n.focus(); showPage(n.dataset.page); }
    });
    const S = () => window.__settings;
    q('#stSound').addEventListener('click', () => { const s = $('sound'); if (s) s.click(); syncSettings(); });
    for (const [id, k, f] of [['stVol', 'vol', v => v / 100], ['stSize', 's', v => v / 100], ['stOp', 'o', v => v / 100]])
      q('#' + id).addEventListener('input', e => { S() && S().set(k, f(+e.target.value)); syncSettings(); });
    settingsEl.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { const s = S() && S().get(); if (!s) return; S().set(b.dataset.k, !s[b.dataset.k]); syncSettings(); }));
    q('#stSw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b && S()) { S().set('c', b.dataset.c); syncSettings(); } });
    q('#stColor').addEventListener('input', e => { S() && S().set('c', e.target.value.toLowerCase()); syncSettings(); });
    q('#stHudReset').addEventListener('click', () => { S() && S().reset('hud'); syncSettings(); });
    q('#stLq').addEventListener('click', e => { const b = e.target.closest('[data-lq]'); if (!b) return; setQuality(b.dataset.lq); syncSettings(); });
    q('#stRm').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b || !S()) return; S().set('rm', b.dataset.rm); applyMotion(); syncSettings(); });
    // radio groups: arrow keys move the choice (and the focus) along the group
    settingsEl.addEventListener('keydown', e => {
      const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0; if (!d) return;
      const b = e.target.closest && e.target.closest('[role=radiogroup] [role=radio]'); if (!b) return;
      e.preventDefault(); const l = [...b.closest('[role=radiogroup]').querySelectorAll('[role=radio]')], n = l[(l.indexOf(b) + d + l.length) % l.length]; n.focus(); n.click();
    });
    syncSettings();
  }
  function setQuality(qv) {
    const B = window.__brRole; if (!B || !B.setQuality) return;
    B.setQuality(qv);                                                         // the renderer's own tiers (sampling and resolution only)
    try { localStorage.setItem('tfb.lighting.quality', qv); } catch (e) { }   // remembered the way BR-RoLE remembers it
  }
  function showPage(p, focusPage) {
    if (!settingsEl) return;
    if (!PAGES.some(x => x[0] === p)) p = 'sound';
    lastPage = p;
    settingsEl.querySelectorAll('.us-pages button').forEach(b => { const on = b.dataset.page === p; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; b.toggleAttribute('data-autofocus', on); });
    settingsEl.querySelectorAll('.us-page').forEach(s => { s.hidden = s.id !== 'stPage_' + p; });
    if (focusPage) { const f = settingsEl.querySelector('#stTab_' + p); f && f.focus(); }
  }
  function syncSettings() {
    if (!settingsEl || !window.__settings) return;
    const s = __settings.get(), q = x => settingsEl.querySelector(x);
    const Z = window.__api && __api.audio && __api.audio(), on = !(Z && Z.muted);
    q('#stSound').setAttribute('aria-checked', on ? 'true' : 'false');
    for (const [id, v] of [['stVol', s.vol], ['stSize', s.s], ['stOp', s.o]]) { const r = q('#' + id); r.value = Math.round(v * 100); rangeFill(r); q('#' + id + 'V').textContent = pct(v); }
    settingsEl.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-checked', s[b.dataset.k] ? 'true' : 'false'));
    const custom = !!s.c && !__settings.swatches().some(x => x[0] === s.c);
    settingsEl.querySelectorAll('#stSw [data-c]').forEach(b => b.setAttribute('aria-checked', b.dataset.c === s.c ? 'true' : 'false'));
    q('#stSw .pick').classList.toggle('on', custom); if (s.c) q('#stColor').value = s.c;
    const pv = q('#stPrev'); pv.style.setProperty('--ps', Math.min(s.s, 1.4));
    const lq = window.__brRole && __brRole.quality ? __brRole.quality() : '';
    settingsEl.querySelectorAll('[data-lq]').forEach(b => b.setAttribute('aria-checked', b.dataset.lq === lq ? 'true' : 'false'));
    const rm = s.rm || 'auto';
    settingsEl.querySelectorAll('[data-rm]').forEach(b => b.setAttribute('aria-checked', b.dataset.rm === rm ? 'true' : 'false'));
    q('#stRmNow').textContent = rm === 'auto' ? (mq.matches ? 'Your device asks for reduced motion, so it is on.' : 'Your device does not ask for reduced motion, so it is off.') : '';
    // roving focus: one stop per radio group (the chosen one)
    settingsEl.querySelectorAll('[role=radiogroup]').forEach(g => { const l = [...g.querySelectorAll('[role=radio]')], on = l.find(x => x.getAttribute('aria-checked') === 'true') || l[0]; l.forEach(x => { x.tabIndex = x === on ? 0 : -1; }); });
  }
  const ui = { settingsPages: () => PAGES.map(p => p[0]) };

  /* ---------------------------------------------------------------- credits (from assets/credits_data.js) */
  let creditsEl = null;
  function buildCredits() {
    if (creditsEl) return;
    creditsEl = sheet('uiCredits', 'Credits');
    const D = window.TFB_CREDITS || { sections: [] }, out = [];
    for (const s of D.sections || []) {
      const ents = (s.entries || []).filter(e => e && e.name), hasText = !!(s.text && String(s.text).trim()), links = (s.links || []).filter(l => l && l.url && l.label);
      if (!ents.length && !hasText) continue;                                // an empty section is not shown
      out.push(`<section class="cr-sec"><h3>${esc(s.heading)}</h3>` +
        (hasText ? `<p class="cr-text">${esc(s.text)}${links.length ? ' ' + links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`).join(' / ') : ''}</p>` : '') +
        ents.map(e => `<div class="cr-entry"><b>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.name)}</a>` : esc(e.name)}</b><span>${esc(e.note || '')}</span></div>`).join('') + '</section>');
    }
    creditsEl.querySelector('.us-body').innerHTML = out.join('') || '<p class="cr-text">No credits yet.</p>';
  }

  /* ---------------------------------------------------------------- customize: WANDERER and LOADOUT (C3)
     The game binds its own fields by id and listens for 'input' / 'change' on them: the chips and swatches here only set those
     fields and fire the same events, so saving, the live preview, the light and what other wanderers see stay the game's. */
  const ap = $('appearancePanel');
  const SKIN = [['#ffcc77', 'Warm yellow'], ['#e6bb76', 'Sand'], ['#f3dcb2', 'Pale'], ['#d49a62', 'Ochre'], ['#a9724a', 'Umber'], ['#6e4a33', 'Dark brown'],
    ['#e7e0cc', 'Bone'], ['#a7b298', 'Moss'], ['#8e98c9', 'Slate blue'], ['#c87b6b', 'Clay'], ['#55524a', 'Charcoal'], ['#efd25c', 'Signal yellow']];
  const BEAM = [['#ffe7b2', 'Warm white'], ['#fff0c8', 'Soft white'], ['#ffc98a', 'Amber'], ['#ffffff', 'White'], ['#e6efff', 'Cool white'], ['#ffdf80', 'Gold']];
  const KIND_NOTE = {
    flashlight: 'The longest reach: a narrow beam that follows your mouse.',
    headlamp: 'Hands-free: a wider, shorter cone that turns with you.',
    lantern: 'A warm glow all around you. Short reach, no aiming.',
    camcorder: 'Night Vision Camcorder emits no visible light; its night vision uses infrared. F raises it, N switches night vision, B sets the infrared illuminator, the wheel zooms. It overheats.',
  };
  let czCur = 'wanderer';
  function czTab(t, focusTab) {
    if (!ap) return;
    czCur = t === 'loadout' ? 'loadout' : 'wanderer';
    ap.querySelectorAll('.cz-tabs [role=tab]').forEach(b => { const on = b.dataset.tab === czCur; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    const w = $('czWanderer'), l = $('czLoadout'); if (w) w.hidden = czCur !== 'wanderer'; if (l) l.hidden = czCur !== 'loadout';
    ap.dataset.tab = czCur;
    if (focusTab) { const b = $('czTab_' + czCur); if (b) b.focus({ preventScroll: true }); }
  }
  const czVal = id => { const e = $(id); return e ? String(e.value).toLowerCase() : ''; };
  function czSync() {
    if (!ap) return;
    ap.querySelectorAll('[data-for]').forEach(g => { const v = czVal(g.dataset.for); let any = false;
      g.querySelectorAll('[data-v]').forEach(b => { const on = b.dataset.v.toLowerCase() === v; any = any || on; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      if (!any) { const f = g.querySelector('[data-v]'); if (f) f.tabIndex = 0; }
      const pick = g.parentElement && g.parentElement.querySelector('.cz-pick'); if (pick) pick.classList.toggle('on', !any && g.classList.contains('u-sws')); });
    const A = window.__api, k = A && A.gear ? A.gear.eq.kind : 'flashlight';
    const note = $('czKindNote'); if (note) note.innerHTML = `<b>${esc(KINDS[k] || k)}</b>${esc(KIND_NOTE[k] || '')}`;
    const beam = $('czBeam'); if (beam) beam.hidden = k === 'camcorder';                // the camcorder has no beam
  }
  function czSet(id, v, ev) { const e = $(id); if (!e || String(e.value).toLowerCase() === String(v).toLowerCase()) return; e.value = v; e.dispatchEvent(new Event(ev || 'input', { bubbles: true })); }
  if (ap) {
    // build the chips from the game's own options, and the swatches from the palettes
    ap.querySelectorAll('.cz-chips[data-for]').forEach(g => { const sel = $(g.dataset.for); if (!sel) return;
      g.innerHTML = [...sel.options].map(o => `<button type="button" class="cz-chip" role="radio" data-v="${esc(o.value)}">${esc(o.textContent)}</button>`).join(''); });
    ap.querySelectorAll('.u-sws[data-for]').forEach(g => { const pal = g.dataset.for === 'lightColor' ? BEAM : SKIN;
      g.innerHTML = pal.map(([c, n]) => `<button type="button" class="u-sw" role="radio" data-v="${c}" title="${esc(n)}" aria-label="${esc(n)}" style="--sw:${c}"></button>`).join(''); });
    ap.addEventListener('click', e => {
      const t = e.target.closest('.cz-tabs [role=tab]'); if (t) { czTab(t.dataset.tab); czSync(); return; }
      const b = e.target.closest('[data-for] [data-v]'); if (!b) return;
      const g = b.closest('[data-for]'); czSet(g.dataset.for, b.dataset.v); czSync();
    });
    ap.addEventListener('keydown', e => {                                     // arrows: tabs and radio groups (roving focus, select on move)
      const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0; if (!d) return;
      const t = e.target.closest && e.target.closest('.cz-tabs [role=tab]');
      if (t) { e.preventDefault(); const l = [...ap.querySelectorAll('.cz-tabs [role=tab]')], n = l[(l.indexOf(t) + d + l.length) % l.length]; czTab(n.dataset.tab, true); czSync(); return; }
      const b = e.target.closest && e.target.closest('[data-for] [data-v]'); if (!b) return;
      e.preventDefault(); const l = [...b.parentElement.querySelectorAll('[data-v]')], n = l[(l.indexOf(b) + d + l.length) % l.length]; n.focus(); n.click();
    });
    ap.addEventListener('input', e => { if (e.target && e.target.type === 'color') czSync(); });
    document.addEventListener('change', e => { if (e.target && e.target.id === 'lightKind') setTimeout(czSync, 0); });
  }
  /* the live preview is a second, tiny renderer in the game: it draws only while this panel is open */
  let avatarApp = null;
  const previewRun = () => { if (!avatarApp) return; try { if (vis('appearancePanel')) avatarApp.start(); else avatarApp.stop(); } catch (e) { } };
  try { Object.defineProperty(window, '__avatarApp', { configurable: true, get: () => avatarApp, set: v => { avatarApp = v; previewRun(); } }); } catch (e) { }
  function czOpened() {
    const tab = window.__loadout ? 'loadout' : (window.__uiCustomizeTab || 'wanderer');
    window.__uiCustomizeTab = null;
    czTab(tab); czSync(); previewRun();
    const b = $('czTab_' + czCur); if (b) b.focus({ preventScroll: true });   // the game focuses a field that is now a hidden select
  }

  /* ---------------------------------------------------------------- run states: focus and body classes */
  let last = '';
  function state() {
    return vis('appearancePanel') ? 'customize' : vis('menu') ? 'menu' : vis('runMenu') ? 'run' : vis('caught') ? 'caught' : vis('won') ? 'won' : vis('dialog') ? 'paused' : vis('hud') ? 'playing' : 'boot';
  }
  function focusState() {
    const st = state();
    const target = st === 'paused' ? $('dialog') : st === 'caught' ? $('caught') : st === 'won' ? $('won') : st === 'run' ? $('runMenu') : st === 'menu' ? menu : null;
    if (!target) return;
    const into = st === 'menu' ? (entryOpen ? $('enter') : current === 'customize' ? menu.querySelector('.mm-row [data-go="customize"]') : menu.querySelector('.mm-row .mm-item.on') || $('mmPlay')) : null;
    const f = into || target.querySelector('.panel') || target;
    if (!f.hasAttribute('tabindex') && !f.matches(FOCUSABLE)) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  }
  function onState() {
    const st = state(), b = document.body.classList, inMenu = vis('menu');
    b.toggle('ui-menu', inMenu);
    b.toggle('ui-paused', st === 'paused');
    // the theme belongs to the true main menu (and everything opened over it); leaving it means ENTER LEVEL 0 began the run
    theme.want(inMenu);
    if (!inMenu) closeEntry(false);
    if (st === last) return;
    const prev = last; last = st;
    if (st === 'menu') {
      if (prev && prev !== 'customize' && prev !== 'boot') closeAll();
      if (prev !== 'customize') { menu.classList.remove('enter'); void menu.offsetWidth; if (!reduced()) menu.classList.add('enter'); }
      loadoutSummary(); syncNav(); connKey = ''; connRefresh(); soundSync(); humLater();
    }
    if (st === 'customize') czOpened();
    if (prev === 'customize') { previewRun(); loadoutSummary(); syncNav(); }
    if (st === 'playing') closeAll();
    if (prev && st !== 'playing' && st !== 'boot') setTimeout(() => { if (state() === st && !stack.length) focusState(); }, prev === 'customize' ? 0 : 60);
  }
  const mo = new MutationObserver(onState);
  for (const id of ['menu', 'hud', 'dialog', 'caught', 'won', 'runMenu', 'appearancePanel']) { const e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['hidden'] }); }

  /* the pause dialog's ways into settings and customize */
  const ps = $('pauseSettings'), pc = $('pauseCustomize');
  if (ps) ps.addEventListener('click', () => go('settings', undefined, ps));
  if (pc) pc.addEventListener('click', () => go('customize', 'wanderer'));
  /* the HUD's pause button presses the game's own pause (#help); the touch INV button opens the game's inventory drawer */
  const hp = $('hudPause');
  if (hp) hp.addEventListener('click', () => { const A = window.__api, h = $('help'); if (h && A && A.started() && !A.paused()) h.click(); });
  const ti = $('touchInv');
  if (ti) ti.addEventListener('click', () => { const A = window.__api; if (window.__inv && __inv.toggle && A && A.started() && !A.paused()) __inv.toggle(); });
  /* the settings model (hud.js) loads right after this file; the game's API arrives with the bundle (a module, later still) */
  let subbed = false;
  const hook = () => { if (subbed || !window.__settings || !__settings.on) return; subbed = true; __settings.on(() => { syncSettings(); applyMotion(); theme.sync(); }); applyMotion(); };
  document.addEventListener('DOMContentLoaded', hook);
  const boot = () => { hook(); if (window.__api && window.__api.gear) { loadoutSummary(); onState(); } else setTimeout(boot, 120); };
  boot();
  if (menu && !menu.hidden && !reduced()) menu.classList.add('enter');

  Object.assign(ui, { version: VERSION, go, state, close: closeSheet, closeAll, refresh: loadoutSummary, reduced, entryOpen: () => entryOpen, theme });
  window.__ui = ui;
})();
