/* v15.1 interface refinement. Kept separate to carry forward into later builds. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = '#settings,#inventory,#adminPanel,#appearancePanel,#dialog,#caught,#won,#runMenu,#menu,#mapPanel,header';
  const playKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyF','KeyM','KeyN','KeyZ','Space']);
  const clear = () => window.__api?.input?.clear();
  const typing = el => el instanceof Element && !!el.closest('input,select,textarea,[contenteditable="true"]');
  const modal = () => ['appearancePanel','caught','won','runMenu','dialog'].map($).find(el => el && !el.hidden);
  const focusable = host => [...host.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el =>
    !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getClientRects().length);
  function trap(e, host) {
    const all = focusable(host); if (!all.length) return;
    const i = all.indexOf(document.activeElement);
    if (e.shiftKey ? i <= 0 : i < 0 || i === all.length - 1) {
      e.preventDefault(); (e.shiftKey ? all[all.length - 1] : all[0]).focus();
    }
  }
  // Release keys even when another panel stops keyup bubbling.
  addEventListener('keyup', e => window.__api?.input?.release(e.code), true);
  document.addEventListener('keydown', e => {
    const host = modal();
    if (e.key === 'Tab' && host) { trap(e, host); e.stopPropagation(); return; }
    if (e.key === 'Escape' && host?.id === 'appearancePanel') {
      e.preventDefault(); e.stopImmediatePropagation(); $('doneAppearance').click(); window.__loadout = false; return;
    }
  }, true);
  // Let controls process arrows / Space before stopping gameplay handlers on window.
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.closest?.('header button')) { e.stopPropagation(); return; }
    if (playKeys.has(e.code) && (typing(e.target) || (e.target.closest?.(ui) && !e.target.closest?.('header')) || document.body.classList.contains('settings-open') || !$('adminPanel')?.hidden)) {
      clear(); e.stopPropagation();
      if (!typing(e.target) && !(e.code === 'Space' && e.target.closest?.('button,[role=button]'))) e.preventDefault();
    }
  });
  document.addEventListener('pointerdown', e => { if (e.target.closest?.(ui)) clear(); }, true);
  document.addEventListener('pointermove', e => { if (e.target.closest?.(ui)) e.stopPropagation(); }, true);
  document.addEventListener('focusin', e => { if (typing(e.target) || e.target.closest?.('#settings,#adminPanel')) clear(); });
  document.querySelectorAll('[data-key]').forEach(b => b.addEventListener('lostpointercapture', () => window.__api?.input?.release(b.dataset.key)));

  // Quiet header: full controls and customization live inside Settings.
  document.body.classList.add('polished-header');
  const settings = $('settings');
  const head = document.createElement('div'); head.className = 'st-head';
  const label = document.createElement('b'); label.textContent = 'SETTINGS';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '✕'; close.setAttribute('aria-label', 'Close settings');
  close.addEventListener('click', () => { window.__settings.open(false); $('settingsBtn').focus(); });
  head.append(label, close); settings.prepend(head);
  ['dialog','caught','won','runMenu'].forEach(id => { $(id).setAttribute('role', 'dialog'); $(id).setAttribute('aria-modal', 'true'); });
  $('invToast').setAttribute('role', 'status');
  $('invToast').setAttribute('aria-live', 'polite');
  $('appearancePanel').querySelector('.appearance-note').textContent = 'Appearance and colours save automatically on this device.';
  $('name').spellcheck = false;
  try { $('name').value = localStorage.getItem('fb_wanderer_name')?.slice(0, 20) || ''; } catch {}
  $('name').addEventListener('input', () => { try { localStorage.setItem('fb_wanderer_name', $('name').value.trim().slice(0, 20)); } catch {} });
  document.querySelector('.brand').addEventListener('click', e => e.preventDefault());

  // Mobile inventory access; a visible close button also works with a mouse.
  const bag = document.createElement('button'); bag.id = 'touchInventory'; bag.type = 'button'; bag.textContent = 'BAG'; bag.setAttribute('aria-label', 'Open inventory');
  bag.addEventListener('click', () => window.__inv?.toggle()); $('touch').appendChild(bag);
  document.querySelectorAll('#touch button').forEach(b => { b.type = 'button'; if (b.dataset.key) b.setAttribute('aria-label', ({KeyW:'Move up',KeyA:'Move left',KeyS:'Move down',KeyD:'Move right',ShiftLeft:'Sprint'})[b.dataset.key]); });

  // Connection status doubles as a room invite. Clipboard failure exposes a selectable link.
  const net = $('net'); net.setAttribute('role', 'button'); net.tabIndex = 0; net.title = 'Share this room'; net.setAttribute('aria-label', 'Connection status. Share this room');
  const invite = document.createElement('div'); invite.id = 'roomInvite'; invite.hidden = true;
  const inviteLabel = document.createElement('label'); inviteLabel.textContent = 'INVITE TO THIS ROOM'; inviteLabel.htmlFor = 'inviteUrl';
  const url = document.createElement('input'); url.id = 'inviteUrl'; url.readOnly = true; url.setAttribute('aria-label', 'Room invite link');
  const hint = document.createElement('p'); hint.textContent = 'Send this link to someone who can reach your server.';
  const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'COPY LINK';
  const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'CLOSE';
  const row = document.createElement('div'); row.append(copy, dismiss); invite.append(inviteLabel, url, hint, row); document.body.appendChild(invite);
  const share = () => {
    const link = new URL(location.href); link.hash = ''; link.searchParams.set('room', (link.searchParams.get('room') || 'main').slice(0,24).replace(/[^\w-]/g,'') || 'main');
    url.value = link.href; invite.hidden = false; copy.textContent = 'COPY LINK'; clear(); url.focus(); url.select();
  };
  const hideInvite = () => { invite.hidden = true; net.focus(); };
  net.addEventListener('click', share);
  net.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); share(); } });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url.value); copy.textContent = 'COPIED'; }
    catch { url.focus(); url.select(); copy.textContent = 'SELECTED · COPY MANUALLY'; }
  });
  dismiss.addEventListener('click', hideInvite);
  invite.addEventListener('pointerdown', clear);
  invite.addEventListener('keydown', e => { clear(); e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); hideInvite(); } });
  document.addEventListener('pointerdown', e => { if (!invite.hidden && !invite.contains(e.target) && !net.contains(e.target)) invite.hidden = true; });

  // Move focus to each newly shown menu and close transient panels on run transitions.
  const watch = el => {
    let visible = !el.hidden;
    new MutationObserver(() => {
      const next = !el.hidden; if (next && !visible) {
        clear(); window.__settings?.open(false); window.__inv?.close(); invite.hidden = true;
        requestAnimationFrame(() => { if (!el.hidden) focusable(el)[0]?.focus(); });
      }
      visible = next;
    }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
  };
  ['dialog','caught','won','runMenu'].map($).forEach(watch);
  const hud = $('hud'); let wasPlaying = !hud.hidden;
  new MutationObserver(() => {
    const playing = !hud.hidden;
    if (playing && !wasPlaying) { window.__settings?.open(false); invite.hidden = true; document.activeElement?.blur(); }
    wasPlaying = playing;
  }).observe(hud, { attributes: true, attributeFilter: ['hidden'] });
})();
