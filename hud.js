/* The settings model and the HUD's own polish.
 * Stage 3C: this file no longer draws a settings dropdown. assets/ui.js draws the Settings page and reads / writes through
 * window.__settings. The saved preferences stay where they always were (localStorage fb_settings_v1, same fields), so
 * nobody's HUD colour, size, opacity, toggles or volume is reset. Stage 3C adds one field, rm (reduced motion: 'auto' follows
 * the device, 'on', 'off'); a save without it reads as 'auto', and a damaged value falls back to its default.
 * Stage 3C QA1 (the minimal HUD): the fields keep their names, some change meaning, and saves carry v: 2.
 *   title  - the location reveals (LEVEL 0 as a run begins, each new part of the level as you enter it); there is no permanent title.
 *   keys   - a one-line reminder of your keys inside that reveal; there is no permanent controls strip.
 *   coords - the optional position overlay, now OFF by default. A save from before QA1 (no v) has it switched off once: the old
 *            default was on, and an old toggle must not bring permanent telemetry back. Anyone can switch it on again.
 *   auto   - kept in the save, no longer used (it faded the controls strip, which is gone).
 * The HUD itself: stamina appears while it changes and fades once full; a dormant health slot waits for a real health value
 * (window.__hud.health(v): the game has no health yet, so nothing calls it).
 * Independent of the network layer, so it works offline / solo too. */
(() => {
  const KEY = 'fb_settings_v1';
  const DEF = { c: '', s: 1, o: 1, keys: true, coords: false, title: true, auto: true, vol: 1, rm: 'auto', v: 2 };
  const RM = ['auto', 'on', 'off'];
  const HUD_KEYS = ['c', 's', 'o', 'keys', 'coords', 'title', 'auto'];
  let S = { ...DEF };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, +v || 0));
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) ? +v : d;   // a damaged number reads as its default
  const HEX = /^#[0-9a-f]{6}$/i;
  const SW = [['', 'Default', '#f3e7a7'], ['#ffb347', 'Amber'], ['#8dff9f', 'Green'], ['#6fe6ff', 'Cyan'], ['#ffffff', 'White'], ['#ff6b5e', 'Red'], ['#d59bff', 'Violet']];
  const $ = id => document.getElementById(id);
  const subs = new Set();

  /* ---------- apply ---------- */
  function apply() {
    const r = document.documentElement.style, b = document.body.classList;
    S.s = clamp(num(S.s, DEF.s), .5, 2); S.o = clamp(num(S.o, DEF.o), .3, 1); S.vol = clamp(num(S.vol, DEF.vol), 0, 1);
    if (typeof S.c !== 'string') S.c = '';
    for (const k of ['keys', 'title', 'auto']) S[k] = S[k] !== false;
    S.coords = S.coords === true; S.v = DEF.v;
    if (!RM.includes(S.rm)) S.rm = 'auto';
    if (S.c && !HEX.test(S.c)) S.c = '';
    r.setProperty('--hs', S.s); r.setProperty('--ho', S.o);
    if (S.c) r.setProperty('--hc', S.c); else r.removeProperty('--hc');
    b.toggle('hudc', !!S.c); b.toggle('hud-nokeys', !S.keys); b.toggle('hud-nocoords', !S.coords); b.toggle('hud-notitle', !S.title);
    if (!S.auto) b.remove('hint-dim');
    window.__vol = S.vol;
    const Z = window.__api && window.__api.audio && window.__api.audio();
    if (Z && Z.gain && !Z.muted) Z.gain.gain.setTargetAtTime(.14 * S.vol, Z.context.currentTime, .05);
    subs.forEach(f => { try { f({ ...S }); } catch (e) {} });
  }
  const set = (k, v) => { if (!(k in DEF)) return; S[k] = v; apply(); save(); if (k === 'auto' && v) armHint(); };
  /* migrate: a save from before Stage 3C has no rm; write the sanitized settings back once so the stored copy is complete */
  let migrated = false;
  try { const raw = localStorage.getItem(KEY), o = raw && JSON.parse(raw); if (o && !('rm' in o)) migrated = true;
    if (o && !(o.v >= 2)) { S.coords = false; migrated = true; } } catch (e) { }   // QA1: a pre-QA1 save loses the old coordinates default (see the top)
  const reset = (which = 'hud') => { for (const k of which === 'hud' ? HUD_KEYS : Object.keys(DEF)) S[k] = DEF[k]; apply(); save(); };

  /* ---------- HUD polish: crossfades, stamina state, auto-fading hints ---------- */
  let hintT = 0, locT = 0;
  const armHint = () => { clearTimeout(hintT); document.body.classList.remove('hint-dim'); if (S.auto) hintT = setTimeout(() => document.body.classList.add('hint-dim'), 14000); };
  const quietLoc = () => { clearTimeout(locT); document.body.classList.remove('loc-quiet'); locT = setTimeout(() => document.body.classList.add('loc-quiet'), 7000); };
  const swap = el => { if (!el) return; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); };
  function initHud() {
    const obs = (el, fn, o) => el && new MutationObserver(fn).observe(el, o || { childList: true, characterData: true, subtree: true });
    ['pace', 'lightStatus', 'nameplate'].forEach(id => { const el = $(id); let prev = el && el.textContent; obs(el, () => { if (el.textContent !== prev) { prev = el.textContent; swap(el); } }); });
    const sec = $('sector'); let sprev = sec && sec.textContent; obs(sec, () => { if (sec.textContent !== sprev) { sprev = sec.textContent; swap(sec); quietLoc(); } });
    /* stamina is shown only while it means something: it appears as soon as it changes (spent or recovering), stays while it is
       below full, and fades a moment after it is full again. The game's own value and timing; nothing here touches them. */
    const sf = $('staminaFill'); let lv = '', last = null, stT = 0;
    const stam = on => { document.body.classList.toggle('stam-on', on); };
    obs(sf, () => { const m = /width:\s*([\d.]+)%/.exec(sf.getAttribute('style') || ''); if (!m) return; const w = +m[1], n = w < 25 ? 'low' : w < 55 ? 'mid' : 'ok';
      if (n !== lv) { lv = n; sf.dataset.lv = n; document.body.dataset.stam = n; }
      if (last !== null && w !== last) { stam(true); clearTimeout(stT); if (w >= 100) stT = setTimeout(() => stam(false), 1800); }
      else if (last === null && w < 100) stam(true);
      last = w; }, { attributes: true, attributeFilter: ['style'] });
    const hud = $('hud'); let shown = false;
    obs(hud, () => { const v = !hud.hidden; if (v && !shown) { armHint(); quietLoc(); } if (!v) { clearTimeout(stT); stam(false); last = null; } shown = v; }, { attributes: true, attributeFilter: ['hidden'] });
    if (hud && !hud.hidden) { shown = true; armHint(); quietLoc(); }
  }
  initHud();

  apply(); if (migrated) save();
  /* audio context is created on first user gesture; re-apply the stored volume once it exists */
  const iv = setInterval(() => { const Z = window.__api && window.__api.audio && window.__api.audio(); if (Z && Z.gain) { apply(); clearInterval(iv); } }, 500);
  /* the dormant health slot (bottom left, above stamina). Health is not in the game yet: nothing calls this, and the slot stays
     hidden until a real value arrives. health(v): v from 0 to 100 shows it (calm when full, urgent when low); null hides it. */
  window.__hud = {
    health(v) {
      const el = $('hudHealth'), f = $('hudHealthFill'); if (!el) return;
      const ok = typeof v === 'number' && isFinite(v); el.hidden = !ok; if (!ok) return;
      const p = clamp(v, 0, 100); if (f) f.style.width = p + '%'; el.dataset.lv = p < 25 ? 'low' : p < 60 ? 'mid' : p < 100 ? 'hurt' : 'full';
    },
  };
  window.__settings = {
    get: () => ({ ...S }), set, reset, defaults: () => ({ ...DEF }), swatches: () => SW.map(x => x.slice()),
    on: f => { subs.add(f); return () => subs.delete(f); },
    armHint,
  };
})();
