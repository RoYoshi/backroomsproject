/* src/frameworks/overseer/server/admin.js - OVERSEER on the server: the admin panel's commands ({t:'a', c}), each answered on the panel's
 * status bar.  Only a client the passcode check has unlocked reaches them; that check, its lockout and the passcode stay in server.js.
 *
 * Stage 3H engine modernization (H3M-2): moved out of server.js without a change.  Every line between the factory's first line and its
 * return is server.js's own (at checkpoint M6a, f2db9d8: lines 172-235), comments and column included: nothing is re-indented, so each
 * line can be compared with server.js as it was (dev/stage-3h/tools/h2_move_proof.js does: dev/stage-3h-modernization/evidence/m2/).
 *   adminCommand(room, me, m)   one command: kick, revive, god, bring, goto, freeze, speed, blackout, hounds, smilers, glitch, item,
 *                               monsters, debug, near, summon, preview, capmode, entgoto, nav, entdel, world, nrfree, msg
 * What it uses of the server is given by server.js, never required: send(c, obj), aftOf (G.I.B.: a death still playing, which a revive
 * ends), moveTo (S.P.A.C.E.) and worldReset (core).  Its one timer is the kick's (150 ms), as it was.  Never served. */
module.exports = ({ send, aftOf, moveTo, worldReset }) => {
function adminCommand(room, me, m) {
  const sim = room.sim, target = room.clients.get(m.id | 0), A = sim.admin;
  const log = what => console.log(`[admin] room=${room.name} ${me.name}#${me.id}: ${what}`);
  const res = (ok, msg) => send(me, { t: 'ares', ok: !!ok, msg: String(msg).slice(0, 90) });         // a one-line answer for the panel's status bar
  const who = c => String(c.name || 'WANDERER').toUpperCase();
  switch (m.c) {
    case 'kick':
      if (target && target !== me) { log(`kick ${target.name}#${target.id}`); res(true, 'KICKED ' + who(target)); send(target, { t: 'kick' }); setTimeout(() => { try { target.sock.write(Buffer.from([0x88, 0])); target.sock.end(); } catch (e) {} }, 150); }
      break;
    case 'revive': if (target) {
      { const a = aftOf(room, target.id); if (a) { a.body = true; a.dropped = 'revived'; for (const c of room.clients.values()) if (c !== target) send(c, { t: 'fx', k: 'end', id: target.id, de: a.de }); } }   // Stage 3D: undone, so no corpse
      log(`revive ${target.name}`); target.player.dead = ''; target.player.reviveOk = true; target.player.safe = 3; A.endPreview(target.player); send(target, { t: 'revive' }); res(true, 'REVIVED ' + who(target)); } break;
    case 'god': if (target) { const on = A.god(target.player); log(`god ${target.name} -> ${on}`); res(true, 'GOD MODE ' + (on ? 'ON' : 'OFF') + ' · ' + who(target)); } break;
    case 'bring': if (target && target !== me) { log(`bring ${target.name}`); const { x, y } = me.player; moveTo(room, target, x, y); res(true, 'BROUGHT ' + who(target)); } break;
    case 'goto': if (target && target !== me) { log(`goto ${target.name}`); const { x, y } = target.player; moveTo(room, me, x, y); res(true, 'WENT TO ' + who(target)); } break;
    case 'freeze': log(`freeze ${!!m.on}`); A.freeze(m.on); res(true, m.on ? 'WORLD FROZEN' : 'WORLD RUNNING'); break;
    case 'speed': log(`speed ${m.v}`); A.speed(m.v); res(true, 'WORLD SPEED ×' + A.info().sp); break;
    case 'blackout': log(`blackout ${m.mode}`); A.blackout(m.mode); res(true, 'LIGHTS: ' + (m.mode === 'on' ? 'BLACKOUT ON' : m.mode === 'off' ? 'BLACKOUT OFF' : 'AUTO')); break;
    case 'hounds': {
      const add = m.mode !== 'remove', want = Math.max(1, Math.min(10, m.n | 0 || 1)); let done = 0;
      for (; done < want; done++) if (!(add ? A.addHound() : A.removeHound())) break;
      const inf = A.info(); log(`hound ${add ? 'add' : 'remove'} x${want} -> ${done}`);
      res(done > 0, done ? `${done} HOUND${done === 1 ? '' : 'S'} ${add ? 'ADDED' : 'REMOVED'} · ${inf.hn}/${inf.mh}` : (add ? `CANNOT ADD: LIMIT ${inf.mh} OR NO SPAWN SPOT` : 'NO HOUNDS TO REMOVE')); break;
    }
    case 'smilers': {
      const add = m.mode !== 'remove', want = Math.max(1, Math.min(10, m.n | 0 || 1)); let done = 0;
      for (; done < want; done++) if (!(add ? A.addSmiler() : A.removeSmiler())) break;
      const inf = A.info(); log(`smiler ${add ? 'add' : 'remove'} x${want} -> ${done}`);
      res(done > 0, done ? `${done} SMILER${done === 1 ? '' : 'S'} ${add ? 'ADDED' : 'REMOVED'} · ${inf.sn}/${inf.ms}` : (add ? `CANNOT ADD: LIMIT ${inf.ms} OR NO SPAWN SPOT` : 'NO SMILERS TO REMOVE')); break;
    }
    case 'glitch':
      log(`glitch ${m.mode}`);
      if (m.mode === 'new') { A.newGlitches(); res(true, 'GLITCHED WALLS MOVED'); }
      else { const g = A.nearestGlitch(me.player.x, me.player.y); if (g) { const x = g.x - g.nx * 96, y = g.y - g.ny * 96; moveTo(room, me, x, y); res(true, 'AT THE NEAREST GLITCHED WALL'); } }
      break;
    case 'item':
      log(`item ${m.mode}`);
      if (m.mode === 'new') { A.newItem(); res(true, 'CARTOGRAPH MOVED'); }
      else { const g = A.nearestItem(me.player.x, me.player.y); if (g) { const x = g.x + 70, y = g.y; moveTo(room, me, x, y); res(true, 'AT THE CARTOGRAPH'); } else res(false, 'THE CARTOGRAPH HAS BEEN TAKEN'); }
      break;
    case 'monsters': log('reset monsters'); A.resetMonsters(); res(true, 'MONSTERS RESPAWNED'); break;
    case 'debug':
      me.dbg = !!m.on; if (me.dbg) me.dbgSeq = Math.max(0, sim.logSeq - 14); log(`ai debug ${me.dbg}`); break;
    case 'near': { const k = m.k === 'smiler' ? 'smiler' : 'hound', ok = A.addNear(k, me.player.x, me.player.y); log(`spawn ${k} near`); res(ok, ok ? k.toUpperCase() + ' PLACED NEAR YOU' : 'LIMIT REACHED OR NO SPOT NEARBY'); break; }
    case 'summon': { const ok = A.summon(me.player.x, me.player.y, me.player.id); log('summon nearest hound'); res(ok, ok ? 'A HOUND IS COMING FOR YOU' : 'NO FREE HOUND TO SUMMON'); break; }
    case 'preview': {                                                             // DEATHS tab: one chosen death on the admin, through the real kill path
      const k = m.k === 'smiler' ? 'smiler' : 'hound', v = /^[ABCD]$/.test(m.var) ? m.var : 'A', r = A.previewKill(me.player, k, v);
      log(`preview death ${k} ${v}: ${r.ok ? 'ok' : r.why}`); res(r.ok, r.ok ? `PLAYING ${k.toUpperCase()} ${v}` : String(r.why).toUpperCase()); break;
    }
    case 'capmode': { const cm = A.captureMode(m.mode); log(`capture style ${cm}`); res(true, 'CAPTURE STYLE: ' + (cm === 'quick' ? 'ALWAYS QUICK KILLS' : cm === 'play' ? 'ALWAYS PLAY WITH THE VICTIM' : 'AUTO (THE ENTITY DECIDES)')); break; }
    case 'entgoto': { const e = A.entityAt(m.eid), s = e && A.spotNear(e.x, e.y); if (s) { moveTo(room, me, s.x, s.y); log(`goto entity ${m.eid}`); res(true, 'WENT TO ENTITY #' + (m.eid | 0)); } else res(false, 'NO SUCH ENTITY'); break; }
    case 'nav': { const r = room.sim.navCmd(m.eid | 0, String(m.cmd || ''), me.player); log(`nav ${m.cmd} #${m.eid}`); res(!!r, r ? 'ENTITY #' + (m.eid | 0) + ': ' + r : 'NO SUCH ENTITY'); break; }
    case 'entdel': { const ok = A.removeEntity(m.eid); log(`remove entity ${m.eid}`); res(ok, ok ? 'ENTITY #' + (m.eid | 0) + ' REMOVED' : 'NO SUCH ENTITY'); break; }
    case 'world': {                                                             // (Stage 3D HQ2: the world epoch - see worldReset)
      log('reset world'); worldReset(room); res(true, 'WORLD RESET FOR EVERYONE · NOBODY BLOWN UP · NO COOLDOWNS'); break;
    }
    case 'nrfree': {                                                            // Stage 3D HQ3: UNLIMITED NEW RUN - this admin's OWN NEW RUN skips the 30 s wait
      me.nrFree = !!m.on;                                                       // (on this connection only: off by default, gone with it; never another player's; nrIntent asks me.admin too)
      log(`unlimited new run ${me.nrFree ? 'on' : 'off'}`); send(me, { t: 'nrf', on: me.nrFree ? 1 : 0 });
      res(true, me.nrFree ? 'UNLIMITED NEW RUN ON · YOUR OWN NEW RUN SKIPS THE 30 S WAIT' : 'UNLIMITED NEW RUN OFF · THE 30 S WAIT IS BACK'); break;
    }
    case 'msg': { const text = String(m.text || '').slice(0, 140).trim(); if (text) { log(`broadcast "${text}"`); for (const c of room.clients.values()) send(c, { t: 'msg', text, from: me.name }); res(true, 'SENT'); } break; }
  }
}

return { adminCommand };
};
