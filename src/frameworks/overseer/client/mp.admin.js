/** @part public/mp.js - OVERSEER: the admin menu (press `)
 * provides: $a, LS, TABS, bodyMonsters, bodyPlayers, btn, live, liveMap, panel, rowW, sec, showMsg
 * uses: adm
 * writes: -
 */
/* ---------- admin menu (press ` ) ----------
 * Tabs: PLAYERS · MONSTERS · DEATHS (preview any death on yourself, choose the capture style; Stage 3D HQ3: your own NEW RUN - the instant
 * gib - and UNLIMITED NEW RUN for yourself) · WORLD · DEBUG (debug mode with the AI overlay).
 * Everything the panel does is a command to the server; the server answers each one with a one-line status (ares).  A toggle shows the
 * state the server says it is in (UNLIMITED NEW RUN: nf in every admin snapshot, nrf after a change), never the state a click hoped for. */
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { const v = localStorage.getItem('adm.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('adm.' + k, JSON.stringify(v)); } catch { } } };
const TABS = [['players', 'PLAYERS'], ['monsters', 'MONSTERS'], ['deaths', 'DEATHS'], ['world', 'WORLD'], ['debug', 'DEBUG']];
adm.tab = LS.get('tab', 'players'); if (!TABS.some(t => t[0] === adm.tab)) adm.tab = 'players';
adm.side = LS.get('side', 'left') === 'right' ? 'right' : 'left';
adm.lay = Object.assign({ ai: true, you: true, srv: true, log: true, compact: false, nav: false, col: false, grid: false, links: false, search: false, crawl: false, evid: false }, LS.get('lay', {})); adm.sel = 0;
adm.opts = Object.assign({ close: true, auto: true, back: true }, LS.get('opts', {}));
adm.sig = ''; adm.res = null; adm.rv = null;
document.head.appendChild(Object.assign(document.createElement('style'), { id: 'admStyle2', textContent: `
#adminPanel{width:364px}#adminPanel.right{left:auto;right:38px}
.adm-tabs{display:flex;gap:1px;margin:-4px -6px 10px;border-bottom:1px solid #75807555}
.adm-tab{flex:1;padding:8px 0 7px;font:600 10px IBM Plex Mono,monospace;letter-spacing:1.3px;color:#8d9e94;background:none;border:0;border-bottom:2px solid transparent;cursor:pointer;margin-bottom:-1px}
.adm-tab:hover{color:#cfd8cb}.adm-tab.on{color:#eef4da;border-bottom-color:#b9cb91}
.adm-status{min-height:15px;margin-top:12px;padding-top:9px;border-top:1px solid #75807533;font-size:10px;letter-spacing:1.4px;color:#9dff9d}.adm-status.bad{color:#ffb0a0}
.adm-sub{color:#8d9e94;font-size:10px;margin:1px 0 7px;letter-spacing:.6px}
.adm-help{color:#8d9e94;font-size:10px;line-height:1.5;letter-spacing:.5px;margin:8px 0 0}
.adm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
button.adm.adm-pv{display:block;white-space:normal;text-align:left;padding:8px 9px;line-height:1.35}button.adm.adm-pv b{color:#b9cb91;margin-right:5px;font-size:12px}button.adm.adm-pv small{display:block;color:#8d9e94;font-size:9px;letter-spacing:.4px;margin-top:2px}
button.adm.adm-big{width:100%;padding:11px 8px;font-size:12px;letter-spacing:2px}
.adm-ent{display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid #75807522}.adm-ent .k{width:34px;font-weight:600}.adm-ent .k.h{color:#ff9a5c}.adm-ent .k.s{color:#9fe8ff}.adm-ent .st{flex:1;color:#aab6ac;font-size:10px;letter-spacing:.4px}
` }));
const panel = document.createElement('div'); panel.id = 'adminPanel'; panel.hidden = true;
panel.innerHTML = `<div class="adm-head"><b>ADMIN</b><span id="admWho"></span><button class="adm" data-a="dock" title="Move the panel to the other side of the screen" aria-label="Move the panel">⇄</button><button class="adm" data-a="close" aria-label="Close admin">✕</button></div>
<div id="admLogin"><label for="admPass">PASSCODE</label><div class="adm-row"><input id="admPass" type="password" autocomplete="off" maxlength="40"><button class="adm" data-a="unlock">UNLOCK</button></div><p class="adm-note" id="admErr"></p></div>
<div id="admMain" hidden><div class="adm-tabs" id="admTabs"></div><div id="admBody"></div>
<div id="admBroadcast"><div class="adm-sec">BROADCAST</div><div class="adm-row"><input id="admText" maxlength="140" placeholder="Message to everyone" autocomplete="off"><button class="adm" data-a="msg">SEND</button></div></div>
<div class="adm-status" id="admStatus"></div></div>`;
document.body.appendChild(panel);
const banner = Object.assign(document.createElement('div'), { id: 'adminMsg', hidden: true }); document.body.appendChild(banner);
const kickedBox = Object.assign(document.createElement('div'), { id: 'kicked', hidden: true, innerHTML: '<div><h2>Removed by an admin.</h2><p>Reload the page to rejoin.</p></div>' }); document.body.appendChild(kickedBox);
let msgTimer = 0;
function showMsg(text, from) {
  banner.textContent = (from ? from + ': ' : '') + text; banner.hidden = false;
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { banner.hidden = true; }, 8000);
}
const $a = id => document.getElementById(id);
const SNM = (window.WORLD && window.WORLD.SN) || ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
const btn = (label, attrs, on, cls) => `<button class="adm${on ? ' on' : ''}${cls ? ' ' + cls : ''}" ${attrs}>${label}</button>`;
let liveMap = {};                                                     // text that changes every update (positions, states): patched in place so buttons are never rebuilt under the mouse
const live = (key, text) => { liveMap[key] = String(text); return `<span data-live="${key}">${esc(text)}</span>`; };
const rowW = h => `<div class="adm-row wrap">${h}</div>`;
const sec = t => `<div class="adm-sec">${t}</div>`;

function bodyPlayers(d) {
  const mine = d.pl.find(p => p.id === adm.you);
  return sec('WANDERERS · ' + d.pl.length) + d.pl.map(pl => {
    const you = pl.id === adm.you, tags = [you ? 'YOU' : '', pl.ad ? 'ADMIN' : '', !pl.a ? 'MENU' : '', pl.d ? 'DEAD' : '', pl.g ? 'GOD' : ''].filter(Boolean).join(' · ');
    const line = (SNM[pl.st] || 'stand') + ' · ' + pl.x + ',' + pl.y + (!you && mine ? ' · ' + Math.round(Math.hypot(pl.x - mine.x, pl.y - mine.y)) + ' px away' : '');
    return `<div class="adm-player"><div><b>${esc(pl.n || 'WANDERER')}</b> <i>${tags}</i></div><div class="adm-sub">${live('p' + pl.id, line)}</div><div class="adm-row wrap">` +
      (you ? '' : btn('BRING', `data-c="bring" data-id="${pl.id}"`) + btn('GO TO', `data-c="goto" data-id="${pl.id}"`)) +
      (pl.d ? btn('REVIVE', `data-c="revive" data-id="${pl.id}"`) : '') + btn('GOD', `data-c="god" data-id="${pl.id}"`, pl.g) +
      (you ? '' : btn('KICK', `data-c="kick" data-id="${pl.id}" data-confirm="Kick ${esc(pl.n)}?"`)) + '</div></div>';
  }).join('') + '<p class="adm-help">Living wanderers are solid to each other: BRING and GO TO put a player on the nearest free spot beside the other, not on top. MENU = not in the halls (never joined, or after their NEW RUN until SPAWN). Corpses and the dead never block anyone.</p>';
}
function bodyMonsters(d) {
  const mine = d.pl.find(p => p.id === adm.you), sp = v => btn(v + '×', `data-c="speed" data-v="${v}"`, d.sp === v);
  const ents = (d.es || []).slice().sort((a, b) => a[0] - b[0]);
  const mh = d.mh || 64, ms = d.ms || 64;
  return sec(`MONSTERS · ${d.hn} HOUND${d.hn === 1 ? '' : 'S'} (ADMIN MAX ${mh})${d.pk ? ' · PACK' : ''} · ${d.sn} SMILER${d.sn === 1 ? '' : 'S'} (ADMIN MAX ${ms})`) +
    rowW(btn(d.fz ? 'FROZEN' : 'FREEZE', `data-c="freeze" data-on="${d.fz ? 0 : 1}"`, d.fz) + btn('SUMMON HOUND TO ME', 'data-c="summon"') + btn('RESPAWN ALL', 'data-c="monsters"')) +
    `<div class="adm-row wrap" style="margin-top:6px">` + btn('+ HOUND', 'data-c="hounds" data-mode="add" data-n="1"') + btn('+10 HOUNDS', 'data-c="hounds" data-mode="add" data-n="10"') + btn('− HOUND', 'data-c="hounds" data-mode="remove" data-n="1"') + btn('+ SMILER', 'data-c="smilers" data-mode="add" data-n="1"') + btn('+10 SMILERS', 'data-c="smilers" data-mode="add" data-n="10"') + btn('− SMILER', 'data-c="smilers" data-mode="remove" data-n="1"') + '</div>' +
    sec('PUT ONE NEAR ME') + rowW(btn('+ HOUND NEAR', 'data-c="near" data-k="hound"') + btn('+ SMILER NEAR', 'data-c="near" data-k="smiler"')) +
    sec('WORLD SPEED') + rowW(sp(0.25) + sp(0.5) + sp(1) + sp(2) + sp(3)) +
    sec('ENTITIES · ' + ents.length) + (ents.length ? ents.map(e => {
      const dist = mine ? ' · ' + Math.round(Math.hypot(e[3] - mine.x, e[4] - mine.y)) + ' px' : '';
      return `<div class="adm-ent"><span class="k ${e[1] ? 's' : 'h'}">${e[1] ? 'S' : 'H'}#${e[0]}</span><span class="st">${live('e' + e[0], e[2] + ' · ' + ({ n: 'near', m: 'mid', f: 'far' }[e[5]] || e[5]) + (e[6] ? ' · HOLDING SOMEONE' : '') + dist)}</span>` + btn('GO TO', `data-c="entgoto" data-eid="${e[0]}"`) + btn('REMOVE', `data-c="entdel" data-eid="${e[0]}"`) + '</div>';
    }).join('') : '<p class="adm-help">No entities right now.</p>');
}
