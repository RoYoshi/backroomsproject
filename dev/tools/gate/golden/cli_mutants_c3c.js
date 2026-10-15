/* Stage 3H continuation C3c (M-024) - seam mutants of mp.js's modules (development only; used by the gate's cli_mutants step through
 * dev/tools/gate/golden/cli_golden_c3c.js --mutants).
 *
 * Each mutant breaks one seam C3c made, once, in this tree's built mp.js (in memory: the file is never touched): the session's late
 * wiring; a message handed to the wrong owner's function, or not handed on; an owner's function the session, the world epoch or the
 * per-frame hook no longer calls; a reader given the wrong value.  The scenes it names must then give a trace that differs from the
 * unchanged tree's: a seam the scenes cannot see would prove nothing, so every mutant here changes what the page does. */
'use strict';
const ALL = ['load', 'menu_online', 'run_online', 'interp', 'fx_bodies', 'facade', 'admin', 'reconnect_solo', 'hum_dread', 'nr_answers', 'nr_reconnect', 'hum_fixtures', 'c3c_poses', 'c3c_epoch', 'c3c_deathlight', 'c3c_misc', 'c3c_mode_a', 'c3c_mode_b'];
module.exports = [
  /* the late wiring */
  { id: 'wire_not_called', find: 'session.wire({ glitch, cartograph, monsters, space, wanderers, deaths, admin });', repl: '', scenes: ['run_online'], why: 'the composition never hands the session its later modules (every message that reaches one of them fails)' },
  { id: 'wire_swapped', find: '({ blendTick, resolid, softCount, softTp, solidCount, solidOff, solidPeers, stopBlend } = space);', repl: '({ blendTick, resolid, softCount, softTp, solidCount, solidOff, solidPeers: resolid, stopBlend } = space);', scenes: ['c3c_poses'], why: "the session's solidPeers is wired to another S.P.A.C.E. function" },
  /* the session hands each message to its owner */
  { id: 'login_to_wrong_owner', find: "else if (m.t === 'admin') loginAnswer(m);", repl: "else if (m.t === 'admin') aresAnswer(m);", scenes: ['admin'], why: "the login's answer is handed to the command answer's function" },
  { id: 'bodies_not_handed', find: 'if (oldWorld(m.w)) return; takeBodies(m.b); }', repl: 'if (oldWorld(m.w)) return; takeBodies([]); }', scenes: ['fx_bodies'], why: 'the corpses the server sends are not handed to G.I.B.' },
  { id: 'fx_skips_timeline', find: "&& oldWorld(m.wn)) return; fxMsg(m); }", repl: "&& oldWorld(m.wn)) return; startFx(m); }", scenes: ['c3c_deathlight'], why: "a death's message skips G.I.B.'s light timeline (only the replay starts)" },
  { id: 'st_not_flushed', find: "if (m.e && typeof m.e.st === 'number') flushSt(m.e.st);", repl: "if (m.e && typeof m.e.st === 'number') flushSt(0);", scenes: ['c3c_deathlight'], why: "the snapshot's server clock is not handed to G.I.B.'s timeline" },
  { id: 'kill_not_noted', find: 'killSeq = m.ms; killNoted(m); announceKill(m.mk);', repl: 'killSeq = m.ms; announceKill(m.mk);', scenes: ['c3c_deathlight'], why: "our kill record's arrival is not noted by G.I.B. (its death id and moment)" },
  { id: 'killer_by_nobody', find: '      markKiller(A, me);', repl: "      markKiller(A, '');", scenes: ['run_online'], why: "N.A.N.I. is not told who killed us (the Hound's slot is never marked)" },
  { id: 'corpse_not_hidden', find: '      if (myId) hideCorpse(myId);', repl: '      if (myId) showCorpse(myId);', scenes: ['run_online'], why: "our corpse is not hidden while we are still dying" },
  { id: 'join_keeps_exit', find: 'join() { nrBusy = 0; runMenuWords(false); resetExit();', repl: 'join() { nrBusy = 0; runMenuWords(false);', scenes: ['c3c_poses'], why: "joining again does not bring us back from L.O.S.T.'s exit (we stay not solid)" },
  { id: 'close_keeps_solid', find: 'fastAck = false; lastK = -1; solidOff();', repl: 'fastAck = false; lastK = -1;', scenes: ['c3c_poses'], why: 'a closed connection leaves the solid peers in place' },
  { id: 'close_keeps_kill', find: 'cpNow = 0; clearKill(); soloOff();', repl: 'cpNow = 0; soloOff();', scenes: ['facade'], why: "a closed connection leaves N.A.N.I.'s kill record (its clearSlots is not a seam the page can see: netReset, just before, clears the slots through NET.onEpoch, as at M8)" },
  { id: 'close_keeps_hold', find: '    debugGone(); noFails();\n    unhold();\n', repl: '    debugGone(); noFails();\n', scenes: ['reconnect_solo'], why: "a closed connection leaves move.js's held state" },
  { id: 'close_keeps_admin', find: '    adminOffline();  ', repl: '    void 0;  ', scenes: ['reconnect_solo'], why: 'a closed connection leaves the admin panel unlocked' },
  { id: 'no_relogin', find: '    relogin();  ', repl: '    void 0;  ', scenes: ['reconnect_solo'], why: 'a new connection does not ask the panel to send the passcode again' },
  /* the world epoch asks each owner */
  { id: 'epoch_keeps_fx', find: 'worldW = w; worldEnds++;\n  endAllFx();', repl: 'worldW = w; worldEnds++;', scenes: ['c3c_epoch'], why: "the world epoch leaves G.I.B.'s replays playing" },
  { id: 'epoch_keeps_lights', find: '  oldLights();  ', repl: '  void 0;  ', scenes: ['c3c_epoch'], why: "the world epoch leaves the old world's dying lights and wall stains" },
  { id: 'epoch_keeps_own_death', find: 'handled = mseq; forgetOwnDeath(); clearKill();', repl: 'handled = mseq; clearKill();', scenes: ['c3c_epoch'], why: 'the world epoch leaves our own death\'s record' },
  { id: 'epoch_keeps_killer', find: 'clearKill(); clearKiller(); if (myId) showCorpse(myId);', repl: 'clearKill(); if (myId) showCorpse(myId);', scenes: ['c3c_epoch'], why: "the world epoch leaves N.A.N.I.'s killer slot" },
  /* the owners' readers */
  { id: 'reader_snap', find: 'const A = window.__api, s = snap(), E = EN();', repl: 'const A = window.__api, s = snap() && null, E = EN();', scenes: ['run_online'], why: "N.A.N.I. reads no snapshot (the monsters are not mirrored)" },
  { id: 'reader_grace', find: 'grace = Math.max(0, graceUntil() - performance.now() / 1000);', repl: 'grace = Math.max(0, 0 - performance.now() / 1000);', scenes: ['run_online'], why: 'N.A.N.I. reads no spawn grace' },
  { id: 'reader_exited', find: 'nrBusy() === 2 || exited() || (A.G && A.G.caught)', repl: 'nrBusy() === 2 || (A.G && A.G.caught)', scenes: ['c3c_poses'], why: "S.P.A.C.E. no longer reads L.O.S.T.'s exit flag (we stay solid after leaving)" },
  { id: 'reader_kill_state', find: 'if (N.on && me() && mseq() > handled() && A', repl: 'if (N.on && me() && mseq() > mseq() && A', scenes: ['facade'], why: "the per-frame hook misreads the session's handled kill (the pause screen no longer gives way)" },
  { id: 'reader_nr_last', find: 'const nf = adm.nf, last = nrLast(), lastTxt', repl: 'const nf = adm.nf, last = null, lastTxt', scenes: ['c3c_misc'], why: "the admin panel no longer reads the session's last NEW RUN answer" },
  { id: 'reader_connected', find: "$a('admErr').textContent = connected() ? adm.err : ", repl: "$a('admErr').textContent = true ? adm.err : ", scenes: ['admin'], why: "the admin panel no longer reads whether the session is connected" },
  { id: 'reader_mouse', find: 'const dm = Math.hypot(mx() - sx, my() - sy);', repl: 'const dm = Math.hypot(my() - sx, mx() - sy);', scenes: ['menu_online'], why: "G.I.B.'s drawing reads BR-R's mouse the wrong way round" },
  /* the per-frame hook asks each owner */
  { id: 'frame_no_send', find: '  sendPose(now, p, started, lightOn);', repl: '  sendPose(now, p, true, lightOn);', scenes: ['menu_online'], why: 'the per-frame hook tells the session we are in a run while in the menu (the menu\'s pose rate)' },
  { id: 'frame_no_drone', find: '  setDrone(k);\n', repl: '  setDrone(0);\n', scenes: ['hum_dread'], why: 'the per-frame hook no longer hands Spacious Audio the dread\'s level' },
  { id: 'frame_no_fade', find: '  fadeHit(t);\n', repl: '  fadeHit(0);\n', scenes: ['run_online'], why: "the per-frame hook no longer fades N.A.N.I.'s hit flash" },
  { id: 'frame_no_note', find: '  onlineNote(N.on);\n', repl: '  onlineNote(true);\n', scenes: ['load', 'reconnect_solo'], why: 'the per-frame hook shows the online note offline too' },
  { id: 'frame_no_solo_item', find: 'soloGlitches(p); soloItems(); }', repl: 'soloGlitches(p); }', scenes: ['reconnect_solo'], why: 'the per-frame hook no longer asks P.O.C.K.E.T. for the offline cartograph' },
  { id: 'mirror_swapped', find: 'glitchesFrom(s.gw); itemsFrom(s.it);', repl: 'glitchesFrom(s.it); itemsFrom(s.gw);', scenes: ['run_online'], why: "N.A.N.I. hands the server's walls and items to the wrong owners" },
  { id: 'bodies_no_id', find: 'function applyBodies() { tellId();', repl: 'function applyBodies() {', scenes: ['c3c_misc'], why: 'G.I.B. hands the game the bodies without the session telling it our id first' },
  { id: 'poses_not_solid', find: '  resolid();  ', repl: '  void 0;  ', scenes: ['c3c_poses'], why: "B+'s fresher poses no longer move the bodies S.P.A.C.E. steers us round" },
  { id: 'hover_not_shown', find: '  hoverTip(hover, sc);  ', repl: '  hoverTip(null, sc);  ', scenes: ['menu_online'], why: "G.I.B.'s drawing no longer hands BR-R the wanderer under the mouse" },
];
module.exports.ALL = ALL;
