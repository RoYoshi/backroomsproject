/** @part public/mp.js - core: the page's network and dread layer opens (the IIFE): its imports, page elements, connection, snapshot and entity-slot state
 * provides: EN, NET, PEER_MODE, PEER_SNAP, PN, bodiesList, buildHum, cpNow, cv, cx, dread, everConnected, exited, fastAck, game,
 *           graceUntil, hMap, hSlots, handled, humUpdate, kicked, killSeq, lastK, lastSend, light, lookStr, me, mseq, myId, net, netHist,
 *           netPose, netReset, nrButton, parseLook, partList, partObj, peersN, retry, room, runMenuWords, sSlot, snap, toRec, ws
 * uses: -
 * writes: -
 */
/* Network + dread layer.
 * - Talks to server.js over a WebSocket. When connected, the server owns the Hounds, Smilers,
 *   blackouts, glitched walls and dead bodies; this file mirrors them into the game's own objects every frame.
 * - Falls back to the game's built-in single-player AI when there is no server.
 * - Also draws other wanderers and adds the proximity scare effects. */
(() => {
const { lookStr, partList, partObj, parseLook, toRec } = window.__mpLib.wire;   // Stage 3H0: the look / light / corpse wire codec (assets/net-wire.js, loaded before this file)
const { NET, netReset, netHist, netPose } = window.__mpLib.interp;   // Stage 3H0: the snapshot interpolation (assets/net-interp.js, loaded just before this file)
const { nrButton, runMenuWords } = window.__mpLib.newrun;   // Stage 3H2 (C-3): NEW RUN's button and run-menu words (assets/net-newrun.js, loaded before this file)
const { buildHum, humUpdate } = window.__mpLib.hum;   // Stage 3H2 (C-4): the fluorescent hum (assets/mp-hum.js, loaded before this file)
const cv = document.getElementById('mp'), cx = cv.getContext('2d'), dread = document.getElementById('dread'),
  game = document.getElementById('game'), light = document.getElementById('light'),
  net = Object.assign(document.createElement('div'), { id: 'net', textContent: 'SOLO' });
document.body.appendChild(net);
const room = new URLSearchParams(location.search).get('room') || 'main';
/* Stage 3E-0: how the other Wanderers are shown.
 *   'bplus' (the default): B, and the server's fresher accepted poses between its full snapshots ('q', asked for with 'caps' and used
 *           only once the server answers yes: an older server sends no 'q' and we stay at 50 ms), our own pose every ~33 ms (60 Hz screen)
 *   'b'     the snapshots alone, as HQ5; the drawn pose eased toward the newest one by ELAPSED TIME (.3 / .35 of the way per 1/60 s) -
 *           HQ5's own easing never ran: each snapshot set the drawn position outright, so they moved in 20 Hz steps
 *   'a'     Stage 3D HQ5 exactly.
 * DEV comparison only: ?peers=a or ?peers=b changes this page alone, never the server or anyone else */
const PEER_MODE = (() => { const v = new URLSearchParams(location.search).get('peers'); return v === 'a' || v === 'b' ? v : 'bplus'; })();
const PEER_SNAP = 96;                             // B / B+: a jump of more than this between where one is drawn and its new pose is shown at once (a teleport, a spawn)
let fastAck = false, lastK = -1;                   // B+: the server said yes to 'caps'; the newest server tick seen ('s' or 'q')
const PN = { s: 0, q: 0, qApplied: 0, qStale: 0, qUnknown: 0 };   // B+ DEV counters (window.__peerNet)

let ws, retry = 0, myId = null, lastSend = 0, everConnected = false;
let snap = null, me = '', mseq = 0, handled = 0, peersN = 0, kicked = false, exited = false;
let bodiesList = [];                              // corpses from the server (everyone's, one per player)
const CLIENT_ENTITY_SLOTS = 64;                 // stress/admin ceiling; ordinary director population is still 3 Hounds / <=5 Smilers
const hMap = new Map(), hSlots = Array(CLIENT_ENTITY_SLOTS).fill(null);
const sSlot = Array(CLIENT_ENTITY_SLOTS).fill(null); // entity id living in each preallocated Smiler render object
window.__hounds = hSlots;
let cpNow = 0, killSeq = -1, graceUntil = 0;      // what the server says is holding us / which death we already announced / the spawn grace
const EN = () => window.__ents;
if (EN()) EN().onFail = f => EN().smilerVoice(f.x, f.y, 'blackout');      // a lamp going out has a sound of its own
