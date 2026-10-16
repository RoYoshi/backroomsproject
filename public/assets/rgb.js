/* Trial 4: R/G/B sliders enhance existing color controls; original inputs retain all persistence and network ownership.
 * No new save keys. Event dispatch uses the original color picker contract.
 */
(() => {
  'use strict';
  const targets = [['avatarMain', 'Body'], ['avatarHands', 'Hands'], ['lightColor', 'Beam'], ['stColor', 'HUD']];
  const hex = s => /^#[\da-f]{6}$/i.test(s || '') ? s.toLowerCase() : '#f3e7a7';
  const channel = (s, n) => parseInt(hex(s).slice(1 + 2 * n, 3 + 2 * n), 16);
  function sync(picker) {
    const group = picker.parentElement && picker.parentElement.querySelector('.rgb-trio');
    if (!group) return;
    for (const input of group.querySelectorAll('input[type="range"]')) {
      const n = +input.dataset.channel, v = channel(picker.value, n);
      if (+input.value !== v) input.value = String(v);
      const label = input.parentElement.querySelector('output'); if (label) label.value = String(v);
    }
  }
  function mount(id, name) {
    const picker = document.getElementById(id);
    if (!picker || picker.type !== 'color' || picker.dataset.rgbReady) return;
    picker.dataset.rgbReady = '1';
    const trio = document.createElement('fieldset');
    trio.className = 'rgb-trio'; trio.setAttribute('aria-label', name + ' RGB channels');
    const legend = document.createElement('legend'); legend.textContent = name + ' RGB'; trio.appendChild(legend);
    for (const [n, title] of ['Red', 'Green', 'Blue'].entries()) {
      const label = document.createElement('label'); label.className = 'rgb-channel';
      const text = document.createElement('span'); text.textContent = title;
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '255'; slider.step = '1'; slider.dataset.channel = String(n);
      slider.setAttribute('aria-label', name + ' ' + title); slider.value = String(channel(picker.value, n));
      const val = document.createElement('output'); val.value = slider.value;
      label.append(text, slider, val); trio.append(label);
      slider.addEventListener('input', () => {
        const rgb = [0,1,2].map(i => i === n ? +slider.value : channel(picker.value, i));
        const next = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
        picker.value = next;
        // Existing source handles appearance replication, preview, HUD persistence, and swatch state.
        picker.dispatchEvent(new Event('input', { bubbles: true }));
        sync(picker);
      });
      slider.addEventListener('change', () => picker.dispatchEvent(new Event('change', { bubbles: true })));
    }
    // Keep picker inside its original label: attach beside the label to avoid nested-label pointer confusion.
    const swatches = id === 'stColor' && picker.closest('#stSw');
    const parent = picker.closest('label');
    if (swatches && swatches.parentElement) swatches.insertAdjacentElement('afterend', trio);
    else if (parent && parent.parentElement) parent.insertAdjacentElement('afterend', trio);
    else picker.insertAdjacentElement('afterend', trio);
    picker.addEventListener('input', () => sync(picker));
    picker.addEventListener('change', () => sync(picker));
    sync(picker);
  }
  function scan() { for (const [id, name] of targets) mount(id, name); }
  const dom = new MutationObserver(scan);
  dom.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => requestAnimationFrame(() => {
    scan();
    for (const [id] of targets) { const el = document.getElementById(id); if (el) sync(el); }
  }), true);
  scan();
})();
