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
  /* QA1 (Q2): the menu is not a run. Until ENTER LEVEL 0 the visitor's own wanderer is not drawn in the world and its light does
     not shine: this is the game's own hide-self state, the one END leaves you in (the bundle's Nend()), set here before the game's
     module runs. The game's start (Su(), every ENTER LEVEL 0 / SPAWN / RESTART) clears it, exactly as before. Nothing else changes:
     the server already keeps a visitor who has not joined out of the world (inactive: not broadcast, not alive for the AI). */
  window.__hideSelf = true;
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

  /* ---------------------------------------------------------------- keybinds (QA1 Q3)
     The game reads fixed key codes: the bundle's key set (W A S D / arrows, Shift) and its F, M and Esc; move.js's C;
     inventory.js's Tab; camcorder.js's N, B and Z. A rebound key is turned into the code the game already reads, here, at the
     window's capture phase before any game listener sees it; a default key that no longer belongs to its own action is held
     back. With the default bindings nothing is intercepted at all, so the game behaves exactly as before. Only while a run is
     live (started, not paused, nothing open over it); a release always follows the press it belongs to. Esc (pause), the mouse
     (aim, right-click night vision, wheel zoom) and the admin key are fixed and never offered. Saved as tfb.keys.v1. */
  const KB_KEY = 'tfb.keys.v1';
  const KB = [                                                             // [action, name, group, the game's own codes per slot]
    ['up', 'Move up', 'Moving', ['KeyW', 'ArrowUp']], ['left', 'Move left', 'Moving', ['KeyA', 'ArrowLeft']],
    ['down', 'Move down', 'Moving', ['KeyS', 'ArrowDown']], ['right', 'Move right', 'Moving', ['KeyD', 'ArrowRight']],
    ['run', 'Run (hold)', 'Moving', ['ShiftLeft', 'ShiftRight']], ['crouch', 'Crouch / stand, slide while running', 'Moving', ['KeyC', null]],
    ['light', 'Light on / off, raise the camcorder', 'Light', ['KeyF', null]],
    ['nv', 'Night vision', 'Night Vision Camcorder', ['KeyN', null]], ['ir', 'Infrared illuminator: off / low / high', 'Night Vision Camcorder', ['KeyB', null]],
    ['zoom', 'Zoom', 'Night Vision Camcorder', ['KeyZ', null]],
    ['inventory', 'Inventory', 'Everything else', ['Tab', null]], ['map', 'Cartograph (once you carry it)', 'Everything else', ['KeyM', null]],
  ];
  const KB_DEF = Object.fromEntries(KB.map(a => [a[0], a[3].slice()]));
  const kbClone = b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.slice()]));
  const GAME = (a, i) => KB_DEF[a][i] || KB_DEF[a][0];                   // the code the game reads for that action and slot
  // keys that are never offered: pause and admin, function keys (reload, fullscreen, devtools), the system's modifiers and toggles
  const NOBIND = /^(Escape|Backquote|F\d{1,2}|Meta\w*|OS\w*|Control\w*|Alt\w*|ContextMenu|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Fn\w*|Help|Power|Sleep|WakeUp|Eject|Launch\w*|Media\w*|Audio\w*|Browser\w*|Lang\d|Convert|NonConvert|KanaMode|Unidentified)$/;
  function kbLoad() {
    let r = null; try { r = JSON.parse(localStorage.getItem(KB_KEY) || 'null'); } catch (e) { }
    if (!r || r.v !== 1 || !r.b || typeof r.b !== 'object') return kbClone(KB_DEF);   // no save (or not ours): the defaults
    const b = kbClone(KB_DEF), seen = new Set();
    for (const [a] of KB) {
      const s = Array.isArray(r.b[a]) ? r.b[a] : KB_DEF[a];
      const ok = c => typeof c === 'string' && /^[A-Za-z0-9]+$/.test(c) && !NOBIND.test(c);
      b[a] = [ok(s[0]) ? s[0] : KB_DEF[a][0], s[1] === null ? null : ok(s[1]) ? s[1] : KB_DEF[a][1]];
      for (const c of b[a]) if (c) { if (seen.has(c)) return kbClone(KB_DEF); seen.add(c); }   // a damaged save never double-binds a key
    }
    return b;
  }
  let KBS = kbLoad(), T = new Map(), SWALLOW = new Set(), IDENT = true;
  function kbBuild() {
    T = new Map(); for (const [a] of KB) for (const i of [0, 1]) { const p = KBS[a][i]; if (p) T.set(p, GAME(a, i)); }
    SWALLOW = new Set(); for (const [a] of KB) for (const g of KB_DEF[a]) if (g && !T.has(g)) SWALLOW.add(g);
    IDENT = [...T].every(([p, g]) => p === g) && !SWALLOW.size;
  }
  kbBuild();
  const kbSave = () => { try { localStorage.setItem(KB_KEY, JSON.stringify({ v: 1, b: KBS })); } catch (e) { } };
  const kbSubs = new Set();
  const kbChanged = () => { kbBuild(); kbSubs.forEach(f => { try { f(); } catch (e) { } }); };
  // names: the user's own keyboard layout where the browser can tell (an AZERTY KeyW is "Z"), the position's QWERTY name if not
  const PRETTY = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', Space: 'Space', Tab: 'Tab', Enter: 'Enter',
    Backspace: 'Backspace', Delete: 'Del', Insert: 'Ins', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', NumpadEnter: 'Num Enter', NumpadAdd: 'Num +', NumpadSubtract: 'Num -',
    NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num .', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', IntlBackslash: '\\', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/', Escape: 'Esc' };
  let layoutMap = null;
  try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { layoutMap = m; kbChanged(); }).catch(() => { }); } catch (e) { }
  const keyName = c => !c ? '' : PRETTY[c] || (/^(Key[A-Z]|Digit\d)$/.test(c) ? String((layoutMap && layoutMap.get(c)) || c.replace(/^(Key|Digit)/, '')).toUpperCase()
    : /^Numpad\d$/.test(c) ? 'Num ' + c.slice(6) : c);
  const keys = {
    label: a => keyName(KBS[a] && KBS[a][0]),                             // the first key of an action, as the player sees it
    labels: a => { const l = (KBS[a] || []).filter(Boolean); return l.length === 2 && l.includes('ShiftLeft') && l.includes('ShiftRight') ? ['Shift'] : l.map(keyName); },   // both Shifts read as one
    move: () => ['up', 'left', 'down', 'right'].map(a => keyName(KBS[a][0])).join(' '),
    bindings: () => kbClone(KBS), defaults: () => kbClone(KB_DEF), isDefault: () => IDENT && KB.every(([a]) => KBS[a][0] === KB_DEF[a][0] && KBS[a][1] === KB_DEF[a][1]),
    on: f => { kbSubs.add(f); return () => kbSubs.delete(f); },
    reset() { KBS = kbClone(KB_DEF); try { localStorage.removeItem(KB_KEY); } catch (e) { } kbChanged(); },
  };
  window.__keys = keys;
  // the adapter
  const SYN = new WeakSet(), heldBy = new Map();                           // physical code -> the game code it went down as
  const KEYOF = c => /^Key[A-Z]$/.test(c) ? c.slice(3).toLowerCase() : /^Digit\d$/.test(c) ? c.slice(5) : /^Shift/.test(c) ? 'Shift' : c === 'Space' ? ' ' : c;
  const typingIn = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || !!(t && t.isContentEditable);
  const liveRun = () => { const A = window.__api; return !!(A && A.started && A.started() && !A.paused() && !stack.length && !vis('appearancePanel') && !vis('dialog') && !vis('caught') && !vis('won') && !vis('runMenu')); };
  function synth(e, type, code) {
    const ev = new KeyboardEvent(type, { key: KEYOF(code), code, location: code === 'ShiftLeft' ? 1 : code === 'ShiftRight' ? 2 : 0, repeat: e.repeat, shiftKey: e.shiftKey, bubbles: true, cancelable: true, composed: true });
    SYN.add(ev); (e.target && e.target.dispatchEvent ? e.target : window).dispatchEvent(ev); return ev;
  }
  let capturing = null;                                                    // a Controls slot waiting for its key
  addEventListener('keydown', e => {
    if (SYN.has(e) || capturing || IDENT) return;
    if (e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target) || !liveRun()) return;
    const g = T.get(e.code);
    if (g === undefined) { if (SWALLOW.has(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    heldBy.set(e.code, g);
    if (g === e.code) return;
    e.preventDefault(); e.stopImmediatePropagation();
    synth(e, 'keydown', g);
  }, true);
  addEventListener('keyup', e => {
    if (SYN.has(e)) return;
    const g = heldBy.get(e.code);
    if (g === undefined) { if (!IDENT && SWALLOW.has(e.code) && !typingIn(e.target) && liveRun()) e.stopImmediatePropagation(); return; }
    heldBy.delete(e.code);
    if (g === e.code) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if ([...heldBy.values()].includes(g)) return;                           // another key still holds that action down
    synth(e, 'keyup', g);
  }, true);
  addEventListener('blur', () => heldBy.clear());
  // capturing a new key for a Controls slot: every key goes here first (before the sheets' Escape / Tab handling and the game)
  addEventListener('keydown', e => {
    if (!capturing || SYN.has(e)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const { a, i } = capturing;
    if (e.code === 'Escape') { kbEnd('Cancelled.'); return; }
    if (e.code === 'Backspace' || e.code === 'Delete') {
      if (i === 1) { KBS[a][1] = null; kbSave(); kbChanged(); kbEnd(`${kbName(a)}: second key cleared.`); }
      else kbMsg('Every action keeps a first key. Press the key you want, or Esc to cancel.');
      return;
    }
    if (!e.code || NOBIND.test(e.code) || !/^[A-Za-z0-9]+$/.test(e.code)) { kbMsg(`${keyName(e.code) || 'That key'} is kept for the browser or the game. Press another key, or Esc to cancel.`); return; }
    kbTry(a, i, e.code);
  }, true);
  addEventListener('keyup', e => { if (capturing && !SYN.has(e)) e.stopImmediatePropagation(); }, true);
  const kbName = a => (KB.find(x => x[0] === a) || [, a])[1];
  let kbPending = null;                                                    // a conflict waiting for Swap or Cancel
  function kbTry(a, i, code) {
    if (KBS[a][i] === code) { kbEnd(); return; }
    let other = null; for (const [b] of KB) for (const j of [0, 1]) if (KBS[b][j] === code && !(b === a && j === i)) other = [b, j];
    if (!other) { KBS[a][i] = code; kbSave(); kbChanged(); kbEnd(`${kbName(a)}: ${keyName(code)}.`); return; }
    const [b, j] = other;
    if (b === a) { kbEnd(`${keyName(code)} is already ${kbName(a)}'s other key.`); return; }
    if (j === 0 && !KBS[a][i]) { kbEnd(`${keyName(code)} is ${kbName(b)}'s only key, and nothing would be left for it. Give ${kbName(b)} another key first.`); return; }
    kbPending = { a, i, b, j, code };
    capturing = null; kbRender();
    kbMsg(`${keyName(code)} is already used for ${kbName(b)}. Swap them (${kbName(b)} gets ${keyName(KBS[a][i]) || 'no second key'}), or cancel.`, true);
  }
  function kbSwap() {
    const p = kbPending; if (!p) return; kbPending = null;
    const was = KBS[p.a][p.i]; KBS[p.b][p.j] = was || null; KBS[p.a][p.i] = p.code;
    kbSave(); kbChanged(); kbMsg(`Swapped: ${kbName(p.a)} is ${keyName(p.code)}, ${kbName(p.b)} is ${keyName(was) || 'unset'}.`);
  }
  let kbMsgEl = null;
  function kbMsg(t, conflict) {
    if (!kbMsgEl) return;
    kbMsgEl.innerHTML = esc(t) + (conflict ? ' <button type="button" class="u-btn" data-kb="swap">Swap keys</button> <button type="button" class="u-btn ghost" data-kb="cancel">Cancel</button>' : '');
    kbMsgEl.classList.toggle('warn', !!conflict);
    if (conflict) { const s = kbMsgEl.querySelector('[data-kb=swap]'); if (s) s.focus(); }
  }
  function kbStart(a, i, btn) { kbPending = null; capturing = { a, i, btn }; kbRender(); kbMsg(`Press a key for ${kbName(a)}${i ? ' (second key)' : ''}. Esc cancels${i ? ', Delete clears it' : ''}.`); }
  function kbEnd(note) {
    const c = capturing; capturing = null; kbRender();
    if (note !== undefined) kbMsg(note);
    if (c && settingsEl) { const b = settingsEl.querySelector(`.kb-slot[data-a="${c.a}"][data-i="${c.i}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  // the Controls page body (built into Settings; redrawn on every change)
  function kbRender() {
    if (!settingsEl) return; const box = settingsEl.querySelector('#kbList'); if (!box) return;
    let g = '', h = '';
    for (const [a, name, grp] of KB) {
      if (grp !== g) { g = grp; h += `<h4>${esc(grp)}</h4>`; }
      const slot = i => { const c = KBS[a][i], cap = capturing && capturing.a === a && capturing.i === i;
        return `<button type="button" class="kb-slot${cap ? ' cap' : ''}${c ? '' : ' empty'}" data-a="${a}" data-i="${i}" aria-label="${esc(name)}, ${i ? 'second' : 'first'} key: ${c ? esc(keyName(c)) : 'none'}. Change">${cap ? 'Press a key' : c ? esc(keyName(c)) : '+'}</button>`; };
      const extra = a === 'nv' ? '<small>also right click</small>' : a === 'zoom' ? '<small>also the mouse wheel</small>' : '';
      h += `<span>${esc(name)}${extra}</span><span class="kb-pair">${slot(0)}${slot(1)}</span>`;
    }
    h += `<h4>Fixed</h4><span>Pause / resume</span><span class="kb-pair"><b>Esc</b></span><span>Aim a handheld light</span><span class="kb-pair"><b>Mouse</b></span><span>Vault or crawl</span><span class="kb-pair"><b>Walk into it</b></span>`;
    box.innerHTML = h;
    const rs = settingsEl.querySelector('#kbReset'); if (rs) rs.disabled = keys.isDefault();
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
    // (#mmNote is written by labelsRefresh(): the keys it names are the player's own)
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
  const helpControls = () => coarse() ? 'On a touch screen: put a thumb down low on the left of the screen and drag to move (the stick appears under your thumb); RUN, CROUCH, LIGHT and INV are at the bottom right; PAUSE is at the top right.'
    : `Move with ${keys.move()}${KBS.up[1] ? ' or ' + ['up', 'left', 'down', 'right'].map(a => keyName(KBS[a][1])).filter(Boolean).join(' ') : ''}, aim your light with the mouse, hold ${keys.label('run')} to run, ${keys.label('crouch')} to crouch, ${keys.label('light')} for your light, ${keys.label('inventory')} for the inventory, Esc to pause.`;
  /* playing it like an app (Q4): how to add it to a home screen, said once, here; nothing on the menu nags about it */
  const standalone = () => !!((window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) || navigator.standalone === true);
  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (helpEl) buildHelp(); });   // the browser's own offer, kept for Help instead of a banner
  addEventListener('appinstalled', () => { installEvt = null; if (helpEl) buildHelp(); });
  const helpApp = () => standalone()
    ? '<p>You are playing the installed app: no browser bar. It is always the live game; there is nothing to update.</p>'
    : '<p>Add The Far Backrooms to your home screen and it opens on its own, without the browser\'s address bar.</p>'
      + '<p>iPhone and iPad (Safari): Share, then Add to Home Screen. Android (Chrome): the menu, then Add to Home screen (or Install app, when it is offered).</p>'
      + '<p>In a browser tab everything works the same; the bar may just stay.</p>'
      + (installEvt ? '<button type="button" class="u-btn" data-help-install>Install the app</button>' : '');
  function buildHelp() {
    if (helpEl) { const c = helpEl.querySelector('[data-help-text]'); if (c) c.textContent = helpControls(); const a = helpEl.querySelector('[data-help-app]'); if (a) a.innerHTML = helpApp(); return; }
    helpEl = sheet('uiHelp', 'Help');
    helpEl.querySelector('.us-body').innerHTML = `<section class="hp-sec"><h3>How to play</h3>
<p>Level 0 is a maze of yellow rooms under humming lights. Somewhere a wall is glitching: find it and walk through it to get out.</p>
<p>Something hunts in the dark. If it finds you, break its line of sight and move quietly. Running drains stamina, and it is loud.</p>
<p>You carry one light for the run, chosen in Customize. Others in your room walk the same halls and meet the same monsters.</p></section>
<section class="hp-sec"><h3>Controls</h3>
<p data-help-text>${esc(helpControls())}</p>
<button type="button" class="u-btn" data-help-controls>Every control and key</button></section>
<section class="hp-sec"><h3>Play it like an app</h3><div data-help-app>${helpApp()}</div></section>`;
    helpEl.querySelector('[data-help-app]').addEventListener('click', e => { if (!e.target.closest('[data-help-install]') || !installEvt) return; const ev = installEvt; installEvt = null; try { ev.prompt(); } catch (x) { } buildHelp(); });
    helpEl.querySelector('[data-help-controls]').addEventListener('click', () => { const s = stack.find(x => x.el === helpEl), op = s && s.opener; closeSheet(helpEl); go('controls', undefined, op); });
  }

  /* ---------------------------------------------------------------- location reveals (QA1 Q3)
     As a run begins: THRESHOLD / LEVEL 0, the objective, and (if wanted) one line of keys; it fades after a few seconds. As you
     walk into a new part of the level: the game's own name for it (its sector line, "01 / YELLOW HALL"), smaller, then it fades.
     A part counts once you have been in it for a moment (no flicker along a border), connecting passages are not announced, and
     the same part is not announced twice in a row. Settings > HUD > Location reveals turns the names off (the objective and the
     key line still show as a run begins). Timers only: nothing runs between reveals. */
  const rvEl = $('hudReveal'), secEl = $('sector');
  let rvHideT = 0, rvGoneT = 0, rvBusyUntil = 0, rvLast = '', rvCand = '', rvCandT = 0, rvQueued = null, rvAdoptUntil = 0;
  const rvSet = (id, v) => { const e = $(id); if (e) { e.textContent = v || ''; e.hidden = !v; } };
  const rvOn = () => { const s = window.__settings && __settings.get(); return !s || s.title !== false; };
  const rvKeysOn = () => { const s = window.__settings && __settings.get(); return !s || s.keys !== false; };
  function rvShow(kind, eye, title, sub, keyLine, hold) {
    if (!rvEl) return;
    clearTimeout(rvHideT); clearTimeout(rvGoneT);
    rvEl.className = 'hud-reveal ' + kind; rvSet('rvEye', eye); rvSet('rvTitle', title); rvSet('rvSub', sub); rvSet('rvKeys', keyLine);
    rvEl.hidden = false; void rvEl.offsetWidth; rvEl.classList.add('in');
    rvBusyUntil = Date.now() + hold + 1300;
    rvHideT = setTimeout(() => { rvEl.classList.remove('in'); rvGoneT = setTimeout(() => { rvEl.hidden = true; if (rvQueued) { const q = rvQueued; rvQueued = null; q(); } }, reduced() ? 0 : 1300); }, hold);
  }
  function rvHide() { clearTimeout(rvHideT); clearTimeout(rvGoneT); rvQueued = null; if (rvEl) { rvEl.classList.remove('in'); rvEl.hidden = true; } }
  const objective = () => { const o = $('evidenceCount'); const t = (o && o.textContent || '').trim(); return t ? t.charAt(0) + t.slice(1).toLowerCase() : ''; };
  const keyLine = () => coarse() ? '' : `${keys.move()} move   ${keys.label('run')} run   ${keys.label('light')} light   ${keys.label('inventory')} inventory   Esc pause`;
  function rvRunStart() {
    rvLast = ''; rvCand = ''; rvQueued = null; rvAdoptUntil = Date.now() + 2500;   // where the run starts is not news: adopted quietly
    rvShow('entry', rvOn() ? 'Threshold' : '', rvOn() ? 'Level 0' : '', objective(), rvKeysOn() ? keyLine() : '', 3800);
  }
  function rvSector() {
    if (!rvOn() || !secEl || state() !== 'playing') return;
    const t = (secEl.textContent || '').trim();
    if (!t || /^—|CONNECTING/.test(t)) { rvCand = ''; return; }
    if (Date.now() < rvAdoptUntil) { rvLast = t; rvCand = ''; return; }
    if (t === rvLast) { rvCand = ''; return; }
    if (t !== rvCand) { rvCand = t; rvCandT = Date.now(); return; }
    if (Date.now() - rvCandT < 1500) return;
    rvLast = t; rvCand = '';
    const go = () => { if (state() === 'playing') rvShow('sector', 'Level 0', t, '', '', 2600); };
    if (Date.now() < rvBusyUntil) rvQueued = go; else go();
  }
  // the game rewrites the sector line about eight times a second; a change is acted on only once it has held for 1.5 s
  if (secEl) new MutationObserver(rvSector).observe(secEl, { childList: true, characterData: true, subtree: true });

  /* ---------------------------------------------------------------- settings */
  let settingsEl = null, lastPage = 'sound';
  const PAGES = [['sound', 'Sound'], ['hud', 'HUD'], ['graphics', 'Display'], ['controls', 'Controls']];
  const pct = v => Math.round(v * 100) + '%';
  const rangeFill = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  function buildSettings() {
    if (settingsEl) return syncSettings();
    settingsEl = sheet('uiSettings', 'Settings', 'Saved on this device. Nothing here changes what you or the entities can see.');
    const SW = window.__settings ? __settings.swatches() : [];
    const rowsOf = (rows) => rows.map(([a, b]) => `<span>${esc(a)}</span><b>${esc(b)}</b>`).join('');
    settingsEl.querySelector('.us-body').innerHTML = `<div class="us-split">
<nav class="us-pages" role="tablist" aria-label="Settings pages">${PAGES.map(([k, n]) => `<button type="button" role="tab" id="stTab_${k}" aria-controls="stPage_${k}" data-page="${k}">${n}</button>`).join('')}</nav>
<div>
<section class="us-page" id="stPage_sound" role="tabpanel" aria-labelledby="stTab_sound">
  <h3>Sound</h3><p class="u-note">Headphones recommended. The halls are quiet; footsteps and what moves in the dark carry.</p>
  <div class="us-row"><span>Sound<small>The menu music, the ambience, footsteps, hum and entities.</small></span><button type="button" class="u-switch" role="switch" id="stSound" aria-label="Sound"></button></div>
  <div class="us-row wide"><label class="us-slider"><span>Master volume</span><output id="stVolV"></output><input class="u-range" type="range" id="stVol" min="0" max="100" step="5" aria-label="Master volume"></label></div>
</section>
<section class="us-page" id="stPage_hud" role="tabpanel" aria-labelledby="stTab_hud" hidden>
  <h3>HUD</h3><p class="u-note">The world is the interface: during play the screen shows stamina only while it changes, and names where you are only as you arrive. The camera and what you can see never change.</p>
  <div class="us-prev" id="stPrev" aria-hidden="true"><span class="pv-rv">LEVEL 0</span><span class="pv-st">STAMINA<i></i></span></div>
  <div class="us-row wide"><span>Colour</span><div class="u-sws" role="radiogroup" aria-label="HUD colour" id="stSw">${SW.map(([c, n, show]) => `<button type="button" class="u-sw" role="radio" data-c="${c}" title="${n}" aria-label="${n}" style="--sw:${c || show}"></button>`).join('')}<span class="u-sw pick" title="Custom colour"><input type="color" id="stColor" value="#f3e7a7" aria-label="Custom HUD colour"></span></div></div>
  <div class="us-row wide"><label class="us-slider"><span>Size</span><output id="stSizeV"></output><input class="u-range" type="range" id="stSize" min="50" max="200" step="5" aria-label="HUD size"></label></div>
  <div class="us-row wide"><label class="us-slider"><span>Opacity</span><output id="stOpV"></output><input class="u-range" type="range" id="stOp" min="30" max="100" step="5" aria-label="HUD opacity"></label></div>
  <div class="us-row"><span>Location reveals<small>LEVEL 0 as a run begins, and the name of each new part of the level as you walk into it. Both fade away.</small></span><button type="button" class="u-switch" role="switch" data-k="title" aria-label="Location reveals"></button></div>
  <div class="us-row"><span>Key reminder<small>One line of your keys as a run begins, then it fades.</small></span><button type="button" class="u-switch" role="switch" data-k="keys" aria-label="Key reminder"></button></div>
  <div class="us-row"><span>Coordinates<small>Your position, bottom right. Off unless you want it.</small></span><button type="button" class="u-switch" role="switch" data-k="coords" aria-label="Coordinates"></button></div>
  <div class="us-actions"><button type="button" class="u-btn ghost" id="stHudReset">Reset HUD</button></div>
</section>
<section class="us-page" id="stPage_graphics" role="tabpanel" aria-labelledby="stTab_graphics" hidden>
  <h3>Display</h3>
  <div class="us-row wide"><span>Lighting and shadows<small>How finely the lights and their shadows are drawn. Every setting lights the same places: higher only draws them more finely. Low suits phones and older computers.</small></span><div class="us-seg" role="radiogroup" aria-label="Lighting and shadows quality" id="stLq">${['low', 'medium', 'high'].map(q => `<button type="button" class="u-btn" role="radio" data-lq="${q}">${q}</button>`).join('')}</div></div>
  <div class="us-row wide"><span>Reduced motion<small>Stops the menus' flicker and slides, the title's lean and light, the HUD's fades, and the screen effects' animation. System follows your device's setting.</small></span><div class="us-seg" role="radiogroup" aria-label="Reduced motion" id="stRm">${[['auto', 'System'], ['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" class="u-btn" role="radio" data-rm="${v}">${n}</button>`).join('')}</div><p class="u-note" id="stRmNow"></p></div>
</section>
<section class="us-page" id="stPage_controls" role="tabpanel" aria-labelledby="stTab_controls" hidden>
  <h3>Controls</h3><p class="u-note">Choose the keys. Each action can have a second key. Changes save on this device and apply at once; Esc, the mouse and the touch controls stay as they are.</p>
  <div class="us-keys kb" id="kbList"></div>
  <p class="kb-msg" id="kbMsg" role="status" aria-live="polite"></p>
  <div class="us-actions"><button type="button" class="u-btn ghost" id="kbReset">Reset controls to defaults</button></div>
  <div class="us-keys">
    <h4>Touch</h4>${rowsOf([['Move', 'The stick: touch anywhere low on the left'], ['Run, crouch, light, inventory', 'Buttons, bottom right'], ['Night vision, infrared, zoom', 'NV, IR, ZOOM (camcorder)'], ['Pause', 'PAUSE, top right']])}
  </div>
</section>
</div></div>`;
    const q = s => settingsEl.querySelector(s);
    kbMsgEl = q('#kbMsg');
    q('#kbList').addEventListener('click', e => { const b = e.target.closest('.kb-slot'); if (!b) return; if (capturing && capturing.a === b.dataset.a && capturing.i === +b.dataset.i) { kbEnd('Cancelled.'); return; } kbStart(b.dataset.a, +b.dataset.i, b); });
    kbMsgEl.addEventListener('click', e => { const b = e.target.closest('[data-kb]'); if (!b) return; if (b.dataset.kb === 'swap') kbSwap(); else { kbPending = null; kbMsg('Cancelled.'); } });
    q('#kbReset').addEventListener('click', () => { capturing = null; kbPending = null; keys.reset(); kbMsg('Controls are back to their defaults.'); });
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
    if (p !== 'controls' && capturing) kbEnd();
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
    kbRender();
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
    get camcorder() { return `Night Vision Camcorder emits no visible light; its night vision uses infrared. ${keys.label('light')} raises it, ${keys.label('nv')} switches night vision, ${keys.label('ir')} sets the infrared illuminator, the wheel (or ${keys.label('zoom')}) zooms. It overheats.`; },
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

  /* ---------------------------------------------------------------- the touch stick (QA1 Q4)
     A floating stick low on the left, on touch screens (it lives in the game's touch layer, shown only there and only in play).
     Put a thumb down anywhere in that zone and the stick appears under it; drag to move. It drives the same four direction keys
     the keyboard and the old pad drive, eight ways (a direction counts once the thumb leans more than 22.5 degrees towards it),
     so the game's own movement turns it into a walk: the same speed, diagonals normalised by the game, no analog advantage; and
     on touch the game's aim follows that direction, as before. A dead zone at the centre; the knob's travel is capped at the
     ring. Lifting, cancelling or losing the touch clears the move at once. Each touch is its own pointer, so the buttons on the
     right (RUN, CROUCH, LIGHT, INV, the camcorder's) work while the stick is held. Input-driven only: nothing runs while idle. */
  const stickZone = $('stickZone'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
  const STICK = { R: 52, DEAD: 12, LEAN: .383 };                          // travel radius (px), dead zone (px), sin(22.5 degrees)
  let stickId = null, stickX = 0, stickY = 0, stickWant = new Set();
  const stickOwned = new Set();                                            // keys the stick put down (a key the keyboard holds stays the keyboard's)
  function stickApply() {
    const A = window.__api; if (!A || !A.keys) return;
    const Q = A.keys, live = !!(A.started && A.started() && !A.paused());
    for (const c of [...stickOwned]) if (!live || !stickWant.has(c)) { Q.delete(c); stickOwned.delete(c); }
    if (!live) return;
    for (const c of stickWant) if (!Q.has(c)) { Q.add(c); stickOwned.add(c); }   // re-asserted on every move (a pause clears the game's keys)
  }
  function stickAt(px, py) {
    let dx = px - stickX, dy = py - stickY; const d = Math.hypot(dx, dy);
    if (d > STICK.R) { dx *= STICK.R / d; dy *= STICK.R / d; }
    if (stickKnob) stickKnob.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0)`;
    const want = new Set();
    if (d > STICK.DEAD) {
      const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
      if (ux > STICK.LEAN) want.add('KeyD'); else if (ux < -STICK.LEAN) want.add('KeyA');
      if (uy > STICK.LEAN) want.add('KeyS'); else if (uy < -STICK.LEAN) want.add('KeyW');
    }
    stickWant = want; stickApply();
  }
  function stickEnd(e) {
    if (stickId === null || (e && e.pointerId !== undefined && e.pointerId !== stickId)) return;
    stickId = null; stickWant = new Set(); stickApply();
    if (stickKnob) stickKnob.style.transform = '';
    if (stickZone) { stickZone.classList.remove('on'); stickZone.style.removeProperty('--sx'); stickZone.style.removeProperty('--sy'); }
  }
  if (stickZone) {
    stickZone.addEventListener('pointerdown', e => {
      if (stickId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const A = window.__api; if (!A || !A.started || !A.started() || A.paused()) return;
      e.preventDefault(); stickId = e.pointerId;
      try { stickZone.setPointerCapture(e.pointerId); } catch (x) { }
      const r = stickZone.getBoundingClientRect();
      stickX = e.clientX; stickY = e.clientY;
      stickZone.style.setProperty('--sx', (stickX - r.left) + 'px'); stickZone.style.setProperty('--sy', (stickY - r.top) + 'px');
      stickZone.classList.add('on');
      stickAt(stickX, stickY);
    });
    stickZone.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; e.preventDefault(); stickAt(e.clientX, e.clientY); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) stickZone.addEventListener(t, stickEnd);
    addEventListener('blur', () => stickEnd());
    document.addEventListener('visibilitychange', () => { if (document.hidden) stickEnd(); });
  }

  /* the touch buttons the game wires as clicks (LIGHT; the camcorder's NV, IR, ZOOM; INV): on a touch screen they act on the press
     itself, so they work while another finger holds the stick (browsers make no click for a tap while a second finger is down).
     The click a lone tap may still produce afterwards is swallowed, so a tap never acts twice: each touch press arms its button
     for exactly one following touch click, however long a busy page takes to deliver it (no timer). Clicks from a key or a mouse
     are never swallowed. RUN and CROUCH are the game's own hold buttons and already act on the press. */
  const PRESS = ['touchFlash', 'touchInv', 'touchNV', 'touchIR', 'touchZoom'], armed = new WeakSet();
  document.addEventListener('pointerdown', e => {
    const bt = e.target && e.target.closest && e.target.closest('#touch > button'); if (!bt || !PRESS.includes(bt.id)) return;
    if (e.pointerType === 'mouse') { armed.delete(bt); return; }
    e.preventDefault(); armed.add(bt); bt.click();
  }, true);
  document.addEventListener('click', e => {
    if (!e.isTrusted) return;
    const bt = e.target && e.target.closest && e.target.closest('#touch > button'); if (!bt || !armed.has(bt)) return;
    if ('pointerType' in e && (e.pointerType === '' || e.pointerType === 'mouse')) return;     // a key or a mouse: an ordinary click
    armed.delete(bt); e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  /* ---------------------------------------------------------------- every place that names a key follows the bindings (QA1 Q3) */
  function pauseKeys() {
    const box = document.querySelector('#dialog .controlRows'); if (!box) return;
    const sec = ['up', 'left', 'down', 'right'].map(a => keyName(KBS[a][1])).filter(Boolean).join(' ');
    const both = a => keys.labels(a).join(' / ');
    const rows = [['Move', keys.move() + (sec ? ' / ' + sec : '')], ['Run (drains stamina)', 'Hold ' + both('run')], ['Crouch / stand', both('crouch')], ['Slide (while running)', both('crouch')],
      ['Vault / crawl', 'Walk into it'], ['Aim handheld light', 'Mouse'], ['Toggle light / raise camcorder', both('light')], ['Night vision (camcorder)', both('nv') + ' / right click'],
      ['Infrared (camcorder)', both('ir')], ['Camera zoom (camcorder)', 'Wheel / ' + both('zoom')], ['Inventory', both('inventory')], ['Cartograph (once found)', both('map')], ['Pause / resume', 'Esc']];
    box.innerHTML = rows.map(([a, b]) => `<p><span>${esc(a)}</span><b>${esc(b.toUpperCase())}</b></p>`).join('');
  }
  // the camcorder's viewfinder line (camcorder.js writes it once and only toggles it afterwards): the same words, the player's keys
  function camHint() { const h = $('camHint'); if (h) h.innerHTML = `${esc(keys.label('nv').toUpperCase())} · NIGHT VISION &nbsp;&nbsp; ${esc(keys.label('ir').toUpperCase())} · IR POWER &nbsp;&nbsp; WHEEL · ZOOM &nbsp;&nbsp; ${esc(keys.label('light').toUpperCase())} · LOWER`; }
  function labelsRefresh() {
    const n = $('mmNote'); if (n) n.textContent = coarse() ? 'Headphones recommended. Touch low on the left and drag to move. PAUSE is top right.' : `Headphones recommended. Move with ${keys.move()}, aim your light with the mouse, Esc pauses.`;
    pauseKeys(); if (!IDENT || !keys.isDefault()) camHint(); kbRender(); if (helpEl) buildHelp(); if (vis('appearancePanel')) czSync();
  }
  keys.on(() => { camHint(); labelsRefresh(); });

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
  let hudWas = false, rvStartT = 0;
  function onState() {
    const st = state(), b = document.body.classList, inMenu = vis('menu');
    // a run has begun (the game shows its HUD): the LEVEL 0 reveal, a moment later; a run has ended: any reveal goes
    const hudNow = vis('hud') && !!(window.__api && __api.started && __api.started());
    if (hudNow && !hudWas) { clearTimeout(rvStartT); rvStartT = setTimeout(() => { const s2 = state(); if (s2 === 'playing' || s2 === 'paused') rvRunStart(); }, 450); }
    if (!hudNow && hudWas) { clearTimeout(rvStartT); rvHide(); }
    hudWas = hudNow;
    if (st === 'paused') { const o = $('pzObjective'), t = objective(); if (o && t) o.textContent = t; }
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
  const pk = $('pzKeys'); if (pk) pk.addEventListener('click', () => go('controls', undefined, pk));
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
  labelsRefresh();
  if (menu && !menu.hidden && !reduced()) menu.classList.add('enter');

  Object.assign(ui, { version: VERSION, go, state, close: closeSheet, closeAll, refresh: loadoutSummary, reduced, entryOpen: () => entryOpen, theme, keys, standalone,
    stick: () => ({ held: stickId !== null, want: [...stickWant].sort(), owned: [...stickOwned].sort() }),
    reveal: () => ({ shown: !!rvEl && !rvEl.hidden, kind: rvEl && rvEl.className, eye: ($('rvEye') || {}).textContent, title: ($('rvTitle') || {}).textContent, sub: ($('rvSub') || {}).textContent, keys: ($('rvKeys') || {}).textContent, last: rvLast }) });
  window.__ui = ui;
})();
