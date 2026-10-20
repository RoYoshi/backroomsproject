/* Trial 4: R/G/B sliders enhance existing color controls; original inputs retain all persistence and network ownership.
 * No new save keys. Event dispatch uses the original color picker contract.
 *
 * Post-Trial 4 review: each slider group is kept with its picker (the group sits after the picker's own label, or after the HUD
 * swatches, so it was never found from the picker's parent and the sliders never followed the picker: a swatch, a reset or the saved
 * colour left them showing another colour, the numbers never moved, and the next slider step wrote the stale channel into the saved
 * colour).  The sliders now always show the colour in effect: the picker's, or for the HUD its Default swatch when no colour is chosen
 * (the saved setting '' - the HUD picker itself keeps whatever was last chosen).  They are refreshed when the picker changes, after
 * any click (swatches and resets set the picker without an event), when a group comes into view, and before it is used.
 *
 * Pre-Trial 3 polish P4: every channel's number is a field you can type in (0-255), beside its slider, and the browser's own colour
 * chooser is no longer the way in.
 *   - One source of truth, as before: the colour in effect (current(), the R4 rule).  A slider step or a typed number changes ONE
 *     channel of that colour and goes through the picker, with the picker's own events, exactly as the slider always did - the game
 *     saves it, replicates it and shows it as before.  No new save key.
 *   - Typing changes nothing until it is committed: Enter, leaving the field (change / blur) or the field's own arrow keys.  A whole
 *     number is committed, clamped to 0..255 (-5 -> 0, 300 -> 255); anything else (empty, letters, a fraction) puts back the value in
 *     effect.  While a field holds an uncommitted edit nothing overwrites it (a swatch, a reset or a refresh waits until you leave), it is
 *     marked aria-invalid when what it holds could not be committed, and Escape puts back the value in effect - only then, so Escape on
 *     a field with nothing pending still closes Settings or Customize as before (ui.js leaves an editing field's Escape to it).
 *   - The pickers stay in the page as the game's own adapters (it binds them by id), out of sight and out of the Tab order; a press on
 *     Customize's "Custom" label or on the HUD's rainbow swatch no longer opens the browser's chooser but goes to the colour's Red field.
 *     A small swatch beside "Custom" shows the colour in effect.
 */
(() => {
  'use strict';
  const targets = [['avatarMain', 'Body'], ['avatarHands', 'Hands'], ['lightColor', 'Beam'], ['stColor', 'HUD']];
  const hex = s => /^#[\da-f]{6}$/i.test(s || '') ? s.toLowerCase() : '#f3e7a7';
  const channel = (s, n) => parseInt(hex(s).slice(1 + 2 * n, 3 + 2 * n), 16);
  const groups = new Map();                                              // picker id -> { picker, trio, sliders, nums, chip }
  // a typed number: a whole number (sign allowed), clamped to 0..255; anything else is null
  const parse = v => { const t = String(v == null ? '' : v).trim(); return /^[+-]?\d{1,6}$/.test(t) ? Math.max(0, Math.min(255, parseInt(t, 10))) : null; };
  // the colour the sliders stand for
  function current(g) {
    if (g.picker.id === 'stColor' && window.__settings && __settings.get) {
      const c = __settings.get().c;
      if (!c) { const d = __settings.swatches ? __settings.swatches().find(x => !x[0]) : null; return hex(d && d[2]); }
    }
    return hex(g.picker.value);
  }
  const editing = f => f.dataset.rgbEditing === '1';
  function sync(g) {
    if (!g) return;
    const c = current(g);
    g.sliders.forEach((s, n) => {
      const v = channel(c, n), f = g.nums[n];
      if (+s.value !== v && !editing(f)) s.value = String(v);
      if (!editing(f) && f.value !== String(v)) f.value = String(v);
    });
    if (g.chip) g.chip.style.setProperty('--rgb-c', c);
  }
  const syncAll = () => { for (const g of groups.values()) sync(g); };
  // one channel of the colour in effect, through the picker and its own events (as the slider always did)
  function set(g, n, v) {
    const base = current(g);
    const next = '#' + [0, 1, 2].map(i => (i === n ? v : channel(base, i)).toString(16).padStart(2, '0')).join('');
    g.picker.value = next;
    // Existing source handles appearance replication, preview, HUD persistence, and swatch state.
    g.picker.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function settle(f) { delete f.dataset.rgbEditing; f.setAttribute('aria-invalid', 'false'); }
  // a field's edit: committed (a whole number, clamped) or put back (anything else)
  function commit(g, n) {
    const f = g.nums[n], v = parse(f.value), was = channel(current(g), n);
    settle(f);
    if (v !== null && v !== was) { set(g, n, v); g.picker.dispatchEvent(new Event('change', { bubbles: true })); }
    sync(g);
    if (f.value !== String(channel(current(g), n))) f.value = String(channel(current(g), n));
  }
  function restore(g, n) { const f = g.nums[n]; settle(f); f.value = String(channel(current(g), n)); sync(g); }
  const seen = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) sync(e.target.__rgb); }) : null;
  function mount(id, name) {
    const picker = document.getElementById(id);
    if (!picker || picker.type !== 'color' || picker.dataset.rgbReady) return;
    picker.dataset.rgbReady = '1';
    const trio = document.createElement('fieldset');
    trio.className = 'rgb-trio'; trio.setAttribute('aria-label', name + ' RGB channels');
    const legend = document.createElement('legend'); legend.textContent = name + ' RGB'; trio.appendChild(legend);
    const g = { picker, trio, sliders: [], nums: [], chip: null };
    for (const [n, title] of ['Red', 'Green', 'Blue'].entries()) {
      const label = document.createElement('label'); label.className = 'rgb-channel';
      const text = document.createElement('span'); text.textContent = title;
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '255'; slider.step = '1'; slider.dataset.channel = String(n);
      slider.setAttribute('aria-label', name + ' ' + title);
      const num = document.createElement('input'); num.type = 'number'; num.min = '0'; num.max = '255'; num.step = '1'; num.inputMode = 'numeric';
      num.className = 'rgb-num'; num.dataset.channel = String(n); num.autocomplete = 'off'; num.setAttribute('aria-label', name + ' ' + title + ', 0 to 255');
      label.append(text, slider, num); trio.append(label);
      g.sliders.push(slider); g.nums.push(num);
      slider.addEventListener('input', () => { set(g, n, +slider.value); sync(g); });
      slider.addEventListener('change', () => picker.dispatchEvent(new Event('change', { bubbles: true })));
      // typing: nothing changes until it is committed; what cannot be committed is marked
      num.addEventListener('input', e => {
        if (!e.inputType) { commit(g, n); return; }                     // the field's own arrow keys / spin buttons: a step, committed at once
        num.dataset.rgbEditing = '1';
        const t = num.value.trim();
        num.setAttribute('aria-invalid', t !== '' && parse(t) === null ? 'true' : 'false');
      });
      num.addEventListener('change', () => { if (editing(num)) commit(g, n); });
      num.addEventListener('blur', () => { if (editing(num)) commit(g, n); });
      num.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(g, n); return; }
        if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();   // typing in the field never reaches the game
      });
    }
    // Keep picker inside its original label: attach beside the label to avoid nested-label pointer confusion.
    const swatches = id === 'stColor' && picker.closest('#stSw');
    const parent = picker.closest('label');
    if (swatches && swatches.parentElement) swatches.insertAdjacentElement('afterend', trio);
    else if (parent && parent.parentElement) parent.insertAdjacentElement('afterend', trio);
    else picker.insertAdjacentElement('afterend', trio);
    // the picker: the game's adapter, out of sight and out of the Tab order; its "Custom" label / rainbow swatch goes to the Red field
    picker.classList.add('rgb-native'); picker.tabIndex = -1; picker.setAttribute('aria-hidden', 'true');
    const way = swatches ? picker.closest('.u-sw') : parent;
    if (way) {
      way.classList.add('rgb-way');
      if (way.tagName === 'LABEL') { const chip = document.createElement('i'); chip.className = 'rgb-chip'; chip.setAttribute('aria-hidden', 'true'); way.insertBefore(chip, picker); g.chip = chip; }
      way.addEventListener('click', e => { if (!e.isTrusted) return; e.preventDefault(); e.stopPropagation(); g.nums[0].focus(); g.nums[0].select(); }, true);
    }
    groups.set(id, g); trio.__rgb = g;
    picker.addEventListener('input', () => sync(g));
    picker.addEventListener('change', () => sync(g));
    trio.addEventListener('focusin', () => sync(g));                     // before the keyboard moves a slider
    trio.addEventListener('pointerdown', () => sync(g));                 // before a drag starts
    if (seen) seen.observe(trio);
    sync(g);
  }
  // Escape on a field with an edit pending puts the value in effect back (and does nothing else); otherwise Escape is left alone
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const f = document.activeElement;
    if (!f || !f.classList || !f.classList.contains('rgb-num') || !editing(f)) return;
    const g = f.closest('.rgb-trio') && f.closest('.rgb-trio').__rgb; if (!g) return;
    e.preventDefault(); e.stopImmediatePropagation(); restore(g, +f.dataset.channel);
  }, true);
  function scan() {
    for (const [id, name] of targets) mount(id, name);
    if (targets.every(([id]) => groups.has(id))) dom.disconnect();
  }
  const dom = new MutationObserver(scan);
  dom.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => requestAnimationFrame(() => { scan(); syncAll(); }), true);
  addEventListener('load', syncAll);                                     // the game sets the saved colours after this script runs
  scan();
})();
