/* THE FAR BACKROOMS - Stage 3C UI controller.
 *
 * One owner for the game's menus: the main menu (PLAY / CUSTOMIZE / SETTINGS / CREDITS), the shared sheet behaviour (open,
 * close, focus trap, Escape, focus return), the Settings and Credits pages, reduced motion, and the run-state focus hooks.
 *
 * It never re-implements what the game does. The game bundle wires its own buttons by id (#enter starts a run, #customize
 * opens the customize panel, #help pauses, #resume / #reset / #retry / #playAgain / #runSpawn / #runEnd ...); this file
 * only presses those same buttons, watches the panels the bundle shows and hides, and draws the menu around them.
 * Loaded before hud.js and inventory.js, so its capture-phase keys run first - but only while one of its own modals is open.
 * Event-driven: no per-frame work, except the menu's pointer parallax (one style write per animation frame, and only while
 * the menu is open and the pointer moves).
 *
 *   window.__ui = { version, go(view, sub), state(), settingsPages(), close() }   (go: 'home' | 'play' | 'customize' |
 *   'settings' | 'credits' | 'controls'; sub: a settings page or a customize tab) */
(() => {
  'use strict';
  const VERSION = 'stage-3c';
  const $ = id => document.getElementById(id);
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const shown = el => !!el && !el.hidden && el.getClientRects().length > 0;
  const focusables = el => [...el.querySelectorAll(FOCUSABLE)].filter(e => shown(e) && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;
  const KINDS = { flashlight: 'Flashlight', headlamp: 'Headlamp', lantern: 'Lantern', camcorder: 'Night Vision Camcorder' };
  const KIND_LINE = {
    flashlight: 'Longest reach. A narrow beam that follows your mouse.',
    headlamp: 'Hands-free. A wider, shorter cone that turns with you.',
    lantern: 'A warm glow all around you. Short reach, no aiming.',
    camcorder: 'No visible light. Its night vision sees by infrared, and it overheats.',
  };
  const NAME_KEY = 'tfb.wanderer.name';
  const coarse = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  /* ---------------------------------------------------------------- reduced motion */
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const motionMode = () => { const s = window.__settings && __settings.get(); return (s && s.rm) || 'auto'; };
  const reduced = () => { const m = motionMode(); return m === 'on' || (m === 'auto' && mq.matches); };
  const applyMotion = () => root.classList.toggle('rm', reduced());
  mq.addEventListener && mq.addEventListener('change', applyMotion);
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
    const m = topModal(); if (!m) return;
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

  /* ---------------------------------------------------------------- the main menu */
  const menu = $('menu');
  const navBtns = () => [...menu.querySelectorAll('.mm-item')];
  let current = 'play';
  function syncNav() {
    const top = stack.length ? stack[stack.length - 1].el.id : (vis('appearancePanel') ? 'appearancePanel' : '');
    current = top === 'uiSettings' ? 'settings' : top === 'uiCredits' ? 'credits' : top === 'appearancePanel' ? 'customize' : 'play';
    navBtns().forEach(b => { const on = b.dataset.go === current; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  if (menu) {
    menu.addEventListener('click', e => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      e.preventDefault(); go(b.dataset.go, b.dataset.sub, b);
    });
    menu.addEventListener('keydown', e => {                                  // arrows move through the menu list
      const b = e.target.closest && e.target.closest('.mm-item'); if (!b) return;
      const l = navBtns(), i = l.indexOf(b), d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
      if (d) { e.preventDefault(); l[(i + d + l.length) % l.length].focus(); }
    });
    // parallax: the pointer leans the title and the haze a few pixels (one style write per frame, only while it moves)
    let px = 0, py = 0, pend = false;
    menu.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduced()) return;
      px = (e.clientX / innerWidth - .5) * 2; py = (e.clientY / innerHeight - .5) * 2;
      if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; menu.style.setProperty('--mx', px.toFixed(3)); menu.style.setProperty('--my', py.toFixed(3)); }); }
    });
    const nm = $('name');
    if (nm) { try { const v = localStorage.getItem(NAME_KEY); if (v && !nm.value) nm.value = v.slice(0, 20); } catch (e) { } }
    const enter = $('enter');
    if (enter) enter.addEventListener('click', () => { try { const v = (nm && nm.value || '').trim(); if (v) localStorage.setItem(NAME_KEY, v); else localStorage.removeItem(NAME_KEY); } catch (e) { } }, true);
    // Enter in the name field starts the run through the game's own handler; remember the name on that path too
    if (nm) nm.addEventListener('keydown', e => { if (e.key === 'Enter') { try { const v = nm.value.trim(); if (v) localStorage.setItem(NAME_KEY, v); else localStorage.removeItem(NAME_KEY); } catch (er) { } } }, true);
    const note = $('mmNote'); if (note && coarse()) note.textContent = 'Headphones recommended. Use the on-screen pad to move; tap PAUSE for the menu.';
  }

  /* the loadout summary on the PLAY panel (drawn once per change: no loop) */
  function loadoutSummary() {
    const A = window.__api; if (!A || !A.gear) return;
    const k = A.gear.eq.kind, cv = $('mmLight');
    const kn = $('mmKind'), kt = $('mmKindText');
    if (kn) kn.textContent = KINDS[k] || k;
    if (kt) kt.textContent = KIND_LINE[k] || '';
    if (cv && window.__inv && __inv._paint) { try { __inv._paint(cv, k, .78, 0, -.5); } catch (e) { } }
  }

  /* ---------------------------------------------------------------- navigation */
  function go(view, sub, opener) {
    view = view || 'home';
    if (view === 'home' || view === 'play') {
      closeAll();
      if (vis('appearancePanel')) { const d = $('doneAppearance'); if (d) d.click(); }   // the game's own close (saves, restores the pause state)
      if (vis('menu')) { syncNav(); if (view === 'play') { const n = $('name'); (n && !coarse() ? n : $('enter'))?.focus({ preventScroll: false }); } }
      return;
    }
    if (view === 'customize') {
      closeAll();
      window.__uiCustomizeTab = sub || 'wanderer';
      // already open: only the tab changes. (Pressing #customize again would make the game remember "paused" as the state
      // to return to, and closing would then pause a run that was never started.)
      if (!vis('appearancePanel')) { const c = $('customize'); if (c) c.click(); }
      requestAnimationFrame(syncNav);
      return;
    }
    if (view === 'settings' || view === 'controls') { buildSettings(); showPage(view === 'controls' ? 'controls' : (sub || lastPage)); openSheet(settingsEl, opener); return; }
    if (view === 'credits') { buildCredits(); openSheet(creditsEl, opener); return; }
  }

  /* ---------------------------------------------------------------- settings */
  let settingsEl = null, lastPage = 'sound';
  const PAGES = [['sound', 'Sound'], ['hud', 'HUD'], ['graphics', 'Graphics'], ['controls', 'Controls']];
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
  <div class="us-row"><span>Sound<small>Ambience, footsteps, hum and entities.</small></span><button type="button" class="u-switch" role="switch" id="stSound" aria-label="Sound"></button></div>
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
  <h3>Graphics</h3><p class="u-note">How finely the lights and their shadows are drawn. Every level lights the same places: higher only draws them more finely. Low suits phones and older computers.</p>
  <div class="us-row wide"><span>Lighting and shadows</span><div class="us-seg" role="radiogroup" aria-label="Lighting and shadows quality" id="stLq">${['low', 'medium', 'high'].map(q => `<button type="button" class="u-btn" role="radio" data-lq="${q}">${q}</button>`).join('')}</div></div>
</section>
<section class="us-page" id="stPage_controls" role="tabpanel" aria-labelledby="stTab_controls" hidden>
  <h3>Controls</h3><p class="u-note">Touch screens get an on-screen pad, a light button and a pause button.</p>
  <div class="us-keys">
    <h4>Moving</h4>${keys([['Move', 'W A S D / Arrows'], ['Run (drains stamina, louder)', 'Hold Shift'], ['Crouch / stand', 'C'], ['Slide (while running)', 'C'], ['Vault or crawl', 'Walk into it']])}
    <h4>Light</h4>${keys([['Aim a handheld light', 'Mouse'], ['Light on / off, raise the camcorder', 'F']])}
    <h4>Night Vision Camcorder</h4>${keys([['Night vision', 'N or right click'], ['Infrared illuminator off / low / high', 'B'], ['Zoom', 'Mouse wheel / Z']])}
    <h4>Everything else</h4>${keys([['Inventory', 'Tab'], ['Cartograph (once you carry it)', 'M'], ['Pause / resume', 'Esc']])}
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

  /* ---------------------------------------------------------------- run states: focus and body classes */
  let last = '';
  function state() {
    return vis('appearancePanel') ? 'customize' : vis('menu') ? 'menu' : vis('runMenu') ? 'run' : vis('caught') ? 'caught' : vis('won') ? 'won' : vis('dialog') ? 'paused' : vis('hud') ? 'playing' : 'boot';
  }
  function focusState() {
    const st = state();
    const target = st === 'paused' ? $('dialog') : st === 'caught' ? $('caught') : st === 'won' ? $('won') : st === 'run' ? $('runMenu') : st === 'menu' ? menu : null;
    if (!target) return;
    const into = st === 'menu' ? menu.querySelector(current === 'customize' ? '[data-go="customize"]' : '.mm-item.on') : null;
    const f = into || target.querySelector('.panel') || target;
    if (!f.hasAttribute('tabindex') && !f.matches(FOCUSABLE)) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  }
  function onState() {
    const st = state(), b = document.body.classList;
    b.toggle('ui-menu', vis('menu'));
    b.toggle('ui-paused', st === 'paused');
    if (st === last) return;
    const prev = last; last = st;
    if (st === 'menu') {
      if (prev && prev !== 'customize' && prev !== 'boot') closeAll();
      if (prev !== 'customize') { menu.classList.remove('enter'); void menu.offsetWidth; if (!reduced()) menu.classList.add('enter'); }
      loadoutSummary(); syncNav();
    }
    if (prev === 'customize') { loadoutSummary(); syncNav(); }
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
  const hook = () => { if (subbed || !window.__settings || !__settings.on) return; subbed = true; __settings.on(() => { syncSettings(); applyMotion(); }); applyMotion(); };
  document.addEventListener('DOMContentLoaded', hook);
  const boot = () => { hook(); if (window.__api && window.__api.gear) { loadoutSummary(); onState(); } else setTimeout(boot, 120); };
  boot();
  if (menu && !menu.hidden && !reduced()) menu.classList.add('enter');

  Object.assign(ui, { version: VERSION, go, state, close: closeSheet, closeAll, refresh: loadoutSummary, reduced });
  window.__ui = ui;
})();
