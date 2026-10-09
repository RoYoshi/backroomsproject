/* The settings model and the HUD's own polish.
 * Stage 3C: this file no longer draws a settings dropdown. assets/ui.js draws the Settings page and reads / writes through
 * window.__settings. The saved preferences stay where they always were (localStorage fb_settings_v1, same fields), so
 * nobody's HUD colour, size, opacity, toggles or volume is reset.
 * Independent of the network layer, so it works offline / solo too. */
(() => {
  const KEY = 'fb_settings_v1';
  const DEF = { c: '', s: 1, o: 1, keys: true, coords: true, title: true, auto: true, vol: 1 };
  const HUD_KEYS = ['c', 's', 'o', 'keys', 'coords', 'title', 'auto'];
  let S = { ...DEF };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, +v || 0));
  const HEX = /^#[0-9a-f]{6}$/i;
  const SW = [['', 'Default', '#f3e7a7'], ['#ffb347', 'Amber'], ['#8dff9f', 'Green'], ['#6fe6ff', 'Cyan'], ['#ffffff', 'White'], ['#ff6b5e', 'Red'], ['#d59bff', 'Violet']];
  const $ = id => document.getElementById(id);
  const subs = new Set();

  /* ---------- apply ---------- */
  function apply() {
    const r = document.documentElement.style, b = document.body.classList;
    S.s = clamp(S.s, .5, 2); S.o = clamp(S.o, .3, 1); S.vol = clamp(S.vol, 0, 1);
    for (const k of ['keys', 'coords', 'title', 'auto']) S[k] = S[k] !== false;
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
    const sf = $('staminaFill'); let lv = '';
    obs(sf, () => { const m = /width:\s*([\d.]+)%/.exec(sf.getAttribute('style') || ''); if (!m) return; const w = +m[1], n = w < 25 ? 'low' : w < 55 ? 'mid' : 'ok'; if (n !== lv) { lv = n; sf.dataset.lv = n; } }, { attributes: true, attributeFilter: ['style'] });
    const hud = $('hud'); let shown = false;
    obs(hud, () => { const v = !hud.hidden; if (v && !shown) { armHint(); quietLoc(); } shown = v; }, { attributes: true, attributeFilter: ['hidden'] });
    if (hud && !hud.hidden) { shown = true; armHint(); quietLoc(); }
  }
  initHud();

  apply();
  /* audio context is created on first user gesture; re-apply the stored volume once it exists */
  const iv = setInterval(() => { const Z = window.__api && window.__api.audio && window.__api.audio(); if (Z && Z.gain) { apply(); clearInterval(iv); } }, 500);
  window.__settings = {
    get: () => ({ ...S }), set, reset, defaults: () => ({ ...DEF }), swatches: () => SW.map(x => x.slice()),
    on: f => { subs.add(f); return () => subs.delete(f); },
    armHint,
  };
})();
