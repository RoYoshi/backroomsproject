/** @part public/mp.js - core: the page's network and dread layer opens (the IIFE): what the page gives it; a module: mpCore
 * A module (continuation C3c, M-024): the page's environment, read once when the script loads - the helper scripts' codecs, the snapshot
 * interpolation, NEW RUN's words and the hum (window.__mpLib), the page's elements, the room and the peers' drawing mode from the
 * address - and the lamp-failure sound registered on ents.js's object, at the same moment as before. The session's state that M8 kept
 * here moved to its owner: the connection, the snapshot and the B+ counters to B++'s mp.session.js; the entity slots to N.A.N.I.'s
 * mp.monsters.js; the exit flag to L.O.S.T.'s mp.glitch.js; the bodies to G.I.B.'s mp.deaths.js; the status line's element to the
 * session, which writes it. mp.compose.js makes it first.
 * imports: -
 * exports: buildHum, cv, cx, dread, EN, game, humUpdate, light, lookStr, NET, netHist, netPose, netReset, nrButton, parseLook, partList,
 *          partObj, PEER_MODE, PEER_SNAP, room, runMenuWords, toRec
 * provides: mpCore
 * uses: -
 * writes: -
 */
/* Network + dread layer.
 * - Talks to server.js over a WebSocket. When connected, the server owns the Hounds, Smilers,
 *   blackouts, glitched walls and dead bodies; this file mirrors them into the game's own objects every frame.
 * - Falls back to the game's built-in single-player AI when there is no server.
 * - Also draws other wanderers and adds the proximity scare effects. */
(() => {
function mpCore() {
const { lookStr, partList, partObj, parseLook, toRec } = window.__mpLib.wire;   // Stage 3H0: the look / light / corpse wire codec (assets/net-wire.js, loaded before this file)
const { NET, netReset, netHist, netPose } = window.__mpLib.interp;   // Stage 3H0: the snapshot interpolation (assets/net-interp.js, loaded just before this file)
const { nrButton, runMenuWords } = window.__mpLib.newrun;   // Stage 3H2 (C-3): NEW RUN's button and run-menu words (assets/net-newrun.js, loaded before this file)
const { buildHum, humUpdate } = window.__mpLib.hum;   // Stage 3H2 (C-4): the fluorescent hum (assets/mp-hum.js, loaded before this file)
const cv = document.getElementById('mp'), cx = cv.getContext('2d'), dread = document.getElementById('dread'),
  game = document.getElementById('game'), light = document.getElementById('light');
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
const EN = () => window.__ents;
if (EN()) EN().onFail = f => EN().smilerVoice(f.x, f.y, 'blackout');      // a lamp going out has a sound of its own
return { buildHum, cv, cx, dread, EN, game, humUpdate, light, lookStr, NET, netHist, netPose, netReset, nrButton, parseLook, partList, partObj, PEER_MODE, PEER_SNAP, room, runMenuWords, toRec };
}
