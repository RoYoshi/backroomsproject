/* Trial 4: R/G/B sliders enhance existing color controls; original inputs retain all persistence and network ownership.
 * No new save keys. Event dispatch uses the original color picker contract.
 *
 * Post-Trial 4 review: each slider group is kept with its picker (the group sits after the picker's own label, or after the HUD
 * swatches, so it was never found from the picker's parent and the sliders never followed the picker: a swatch, a reset or the saved
 * colour left them showing another colour, the numbers never moved, and the next slider step wrote the stale channel into the saved
 * colour).  The sliders now always show the colour in effect: the picker's, or for the HUD its Default swatch when no colour is chosen
 * (the saved setting '' - the HUD picker itself keeps whatever was last chosen).  They are refreshed when the picker changes, after
 * any click (swatches and resets set the picker without an event), when a group comes into view, and before it is used.
 */
(() => {
  'use strict';
  const targets = [['avatarMain', 'Body'], ['avatarHands', 'Hands'], ['lightColor', 'Beam'], ['stColor', 'HUD']];
  const hex = s => /^#[\da-f]{6}$/i.test(s || '') ? s.toLowerCase() : '#f3e7a7';
  const channel = (s, n) => parseInt(hex(s).slice(1 + 2 * n, 3 + 2 * n), 16);
  const groups = new Map();                                              // picker id -> { picker, trio, sliders, outs }
  // the colour the sliders stand for
  function current(g) {
    if (g.picker.id === 'stColor' && window.__settings && __settings.get) {
      const c = __settings.get().c;
      if (!c) { const d = __settings.swatches ? __settings.swatches().find(x => !x[0]) : null; return hex(d && d[2]); }
    }
    return hex(g.picker.value);
  }
  function sync(g) {
    if (!g) return;
    const c = current(g);
    g.sliders.forEach((s, n) => { const v = channel(c, n); if (+s.value !== v) s.value = String(v); if (g.outs[n].value !== String(v)) g.outs[n].value = String(v); });
  }
  const syncAll = () => { for (const g of groups.values()) sync(g); };
  const seen = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) sync(e.target.__rgb); }) : null;
  function mount(id, name) {
    const picker = document.getElementById(id);
    if (!picker || picker.type !== 'color' || picker.dataset.rgbReady) return;
    picker.dataset.rgbReady = '1';
    const trio = document.createElement('fieldset');
    trio.className = 'rgb-trio'; trio.setAttribute('aria-label', name + ' RGB channels');
    const legend = document.createElement('legend'); legend.textContent = name + ' RGB'; trio.appendChild(legend);
    const g = { picker, trio, sliders: [], outs: [] };
    for (const [n, title] of ['Red', 'Green', 'Blue'].entries()) {
      const label = document.createElement('label'); label.className = 'rgb-channel';
      const text = document.createElement('span'); text.textContent = title;
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '255'; slider.step = '1'; slider.dataset.channel = String(n);
      slider.setAttribute('aria-label', name + ' ' + title);
      const val = document.createElement('output'); val.setAttribute('aria-hidden', 'true');   // the slider itself announces its value
      label.append(text, slider, val); trio.append(label);
      g.sliders.push(slider); g.outs.push(val);
      slider.addEventListener('input', () => {
        const base = current(g);
        const next = '#' + [0, 1, 2].map(i => (i === n ? +slider.value : channel(base, i)).toString(16).padStart(2, '0')).join('');
        picker.value = next;
        // Existing source handles appearance replication, preview, HUD persistence, and swatch state.
        picker.dispatchEvent(new Event('input', { bubbles: true }));
        sync(g);
      });
      slider.addEventListener('change', () => picker.dispatchEvent(new Event('change', { bubbles: true })));
    }
    // Keep picker inside its original label: attach beside the label to avoid nested-label pointer confusion.
    const swatches = id === 'stColor' && picker.closest('#stSw');
    const parent = picker.closest('label');
    if (swatches && swatches.parentElement) swatches.insertAdjacentElement('afterend', trio);
    else if (parent && parent.parentElement) parent.insertAdjacentElement('afterend', trio);
    else picker.insertAdjacentElement('afterend', trio);
    groups.set(id, g); trio.__rgb = g;
    picker.addEventListener('input', () => sync(g));
    picker.addEventListener('change', () => sync(g));
    trio.addEventListener('focusin', () => sync(g));                     // before the keyboard moves a slider
    trio.addEventListener('pointerdown', () => sync(g));                 // before a drag starts
    if (seen) seen.observe(trio);
    sync(g);
  }
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
