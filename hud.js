/* Settings dropdown: controls reference, customization (character shortcut + HUD colour/size/opacity), audio volume.
   Independent of the network layer, so it works offline / solo too. Preferences are kept in localStorage. */
(() => {
  const KEY = 'fb_settings_v1';
  const DEF = { c: '', s: 1, o: 1, keys: true, coords: true, title: true, auto: true, vol: 1 };
  let S = { ...DEF };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, +v || 0));
  const HEX = /^#[0-9a-f]{6}$/i;
  const SW = [['', 'DEFAULT', '#f3e7a7'], ['#ffb347', 'AMBER'], ['#8dff9f', 'GREEN'], ['#6fe6ff', 'CYAN'], ['#ffffff', 'WHITE'], ['#ff6b5e', 'RED'], ['#d59bff', 'VIOLET']];
  const $ = id => document.getElementById(id);

  /* ---------- apply ---------- */
  function apply() {
    const r = document.documentElement.style, b = document.body.classList;
    S.s = clamp(S.s, .5, 2); S.o = clamp(S.o, .3, 1); S.vol = clamp(S.vol, 0, 1);
    if (S.c && !HEX.test(S.c)) S.c = '';
    r.setProperty('--hs', S.s); r.setProperty('--ho', S.o);
    if (S.c) r.setProperty('--hc', S.c); else r.removeProperty('--hc');
    b.toggle('hudc', !!S.c); b.toggle('hud-nokeys', !S.keys); b.toggle('hud-nocoords', !S.coords); b.toggle('hud-notitle', !S.title);
    if (!S.auto) b.remove('hint-dim');
    window.__vol = S.vol;
    const Z = window.__api && window.__api.audio && window.__api.audio();
    if (Z && Z.gain && !Z.muted) Z.gain.gain.setTargetAtTime(.14 * S.vol, Z.context.currentTime, .05);
  }

  /* ---------- UI ---------- */
  const btn = Object.assign(document.createElement('button'), { id: 'settingsBtn', type: 'button', textContent: 'SETTINGS ▾' });
  btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
  const tools = document.querySelector('.tools'); if (tools) tools.insertBefore(btn, $('sound')?.nextSibling || null);

  const panel = document.createElement('div'); panel.id = 'settings'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Settings');
  const row = (k, v) => `<p><span>${k}</span><b>${v}</b></p>`;
  panel.innerHTML = `
<div class="st-tabs" role="tablist"><button data-tab="controls">CONTROLS</button><button data-tab="custom">CUSTOMIZE</button><button data-tab="audio">AUDIO</button></div>
<section data-pane="controls"><div class="st-rows">${row('Move', 'W A S D / ARROWS')}${row('Sprint', 'HOLD SHIFT')}${row('Aim handheld light', 'MOUSE')}${row('Toggle light', 'F')}${row('Toggle map', 'M')}${row('Pause / resume', 'ESC')}</div><p class="st-note">Touch devices get an on-screen pad. Sprinting drains stamina and is louder.</p></section>
<section data-pane="custom">
  <h3>WANDERER &amp; LIGHT</h3>
  <p class="st-note">Hat, colours, backpack, light source. Other players see it.</p>
  <button class="st-btn" data-act="appearance" type="button">OPEN CHARACTER EDITOR</button>
  <h3>HUD</h3>
  <div class="st-prev" id="stPrev"><span>EVIDENCE <b>3 / 8</b></span><span>WALKING</span><span class="stam">STAMINA <b>82</b><i><em></em></i></span></div>
  <div class="st-label">COLOUR</div>
  <div class="st-sw" id="stSw">${SW.map(([c, n, show]) => `<button type="button" data-c="${c}" title="${n}" aria-label="${n}" style="--sw:${c || show}"></button>`).join('')}<label class="st-pick" title="Custom colour"><input type="color" id="stColor" value="#f3e7a7"></label></div>
  <label class="st-slide">SIZE <output id="stSizeV"></output><input type="range" id="stSize" min="50" max="200" step="5"></label>
  <label class="st-slide">OPACITY <output id="stOpV"></output><input type="range" id="stOp" min="30" max="100" step="5"></label>
  <label class="st-chk"><input type="checkbox" id="stKeys"> Key hints (bottom-left)</label>
  <label class="st-chk"><input type="checkbox" id="stAuto"> Fade key hints after a while</label>
  <label class="st-chk"><input type="checkbox" id="stCoords"> Coordinates (bottom-right)</label>
  <label class="st-chk"><input type="checkbox" id="stTitle"> Level title (top-right)</label>
  <button class="st-btn dim" data-act="reset" type="button">RESET HUD</button>
</section>
<section data-pane="audio">
  <label class="st-slide">MASTER VOLUME <output id="stVolV"></output><input type="range" id="stVol" min="0" max="100" step="5"></label>
  <button class="st-btn" data-act="mute" type="button">TOGGLE SOUND</button>
  <p class="st-note">Headphones recommended. Volume covers ambience, footsteps, hum and monsters.</p>
</section>`;
  document.body.appendChild(panel);
  const q = s => panel.querySelector(s);

  function sync() {
    $('stSize').value = Math.round(S.s * 100); $('stSizeV').textContent = Math.round(S.s * 100) + '%';
    $('stOp').value = Math.round(S.o * 100); $('stOpV').textContent = Math.round(S.o * 100) + '%';
    $('stVol').value = Math.round(S.vol * 100); $('stVolV').textContent = Math.round(S.vol * 100) + '%';
    $('stKeys').checked = S.keys; $('stAuto').checked = S.auto; $('stCoords').checked = S.coords; $('stTitle').checked = S.title;
    if (S.c) $('stColor').value = S.c;
    panel.querySelectorAll('#stSw button').forEach(b => b.classList.toggle('on', b.dataset.c === S.c));
    panel.querySelector('.st-pick').classList.toggle('on', !!S.c && !SW.some(x => x[0] === S.c));
    const p = $('stPrev'); p.style.setProperty('--ps', Math.min(S.s, 1.4));
  }
  let tab = 'controls';
  const show = t => { tab = t; panel.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); panel.querySelectorAll('[data-pane]').forEach(s => s.hidden = s.dataset.pane !== t); place(); };
  function place() {
    const r = btn.getBoundingClientRect(), w = panel.offsetWidth || 360;
    panel.style.top = Math.round(r.bottom + 8) + 'px';
    panel.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
    panel.style.maxHeight = Math.max(160, innerHeight - r.bottom - 24) + 'px';
  }
  let closeT = 0;
  const open = v => {
    clearTimeout(closeT);
    if (v) { panel.hidden = false; void panel.offsetWidth; panel.classList.add('open'); }
    else { panel.classList.remove('open'); closeT = setTimeout(() => { panel.hidden = true; }, 190); }
    btn.setAttribute('aria-expanded', v ? 'true' : 'false'); btn.classList.toggle('on', v); btn.textContent = v ? 'SETTINGS ▴' : 'SETTINGS ▾';
    if (v) { sync(); show(tab); }
  };
  btn.addEventListener('click', e => { e.stopPropagation(); open(!panel.classList.contains('open')); });
  addEventListener('resize', () => { if (panel.classList.contains('open')) place(); });
  document.addEventListener('pointerdown', e => { if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn && !$('appearancePanel')?.contains(e.target)) open(false); });
  document.addEventListener('keydown', e => { if (panel.classList.contains('open') && e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); open(false); btn.focus(); } }, true);
  panel.addEventListener('keydown', e => e.stopPropagation());      // typing/arrowing in sliders must not move the wanderer
  panel.addEventListener('keyup', e => e.stopPropagation());

  const set = (k, v) => { S[k] = v; apply(); save(); sync(); };
  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) return show(b.dataset.tab);
    if (b.dataset.c !== undefined && b.closest('#stSw')) return set('c', b.dataset.c);
    if (b.dataset.act === 'appearance') { open(false); $('customize')?.click(); }
    else if (b.dataset.act === 'mute') { $('sound')?.click(); }
    else if (b.dataset.act === 'reset') { Object.assign(S, { c: '', s: 1, o: 1, keys: true, coords: true, title: true, auto: true }); apply(); save(); sync(); }
  });
  $('stColor').addEventListener('input', e => set('c', e.target.value.toLowerCase()));
  $('stSize').addEventListener('input', e => set('s', e.target.value / 100));
  $('stOp').addEventListener('input', e => set('o', e.target.value / 100));
  $('stVol').addEventListener('input', e => set('vol', e.target.value / 100));
  $('stKeys').addEventListener('change', e => set('keys', e.target.checked));
  $('stAuto').addEventListener('change', e => { set('auto', e.target.checked); if (e.target.checked) armHint(); });
  $('stCoords').addEventListener('change', e => set('coords', e.target.checked));
  $('stTitle').addEventListener('change', e => set('title', e.target.checked));

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

  apply(); sync();
  /* audio context is created on first user gesture; re-apply the stored volume once it exists */
  const iv = setInterval(() => { const Z = window.__api && window.__api.audio && window.__api.audio(); if (Z && Z.gain) { apply(); clearInterval(iv); } }, 500);
  window.__settings = { get: () => ({ ...S }), set, open };
})();
