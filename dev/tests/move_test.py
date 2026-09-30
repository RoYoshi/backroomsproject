"""Movement tests (Part I): drives window.__mv.step directly in a paused solo game and checks the numbers.  python3 move_test.py"""
import os
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
import asyncio, subprocess, time, sys, json
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=8561
JS = r"""
() => {
  const A = __api, H = A.H, mv = __mv, W = WORLD, M = W.MOVE, out = {};
  const DT = 1/60;
  const reset = (x, y, o = {}) => { A.tp(x, y); mv.reset(); H.stamina = o.st ?? 100; H.exhausted = !!o.ex; H.vx = H.vy = 0; H.angle = o.ang || 0; H.distance = 0; A.keys.clear(); };
  const step = (ix, iy, run, n) => { for (let i = 0; i < n; i++) mv.step(ix, iy, run, DT); };
  const spd = () => Math.hypot(H.vx, H.vy);
  // a big open floor: the long corridor y=3504, x 3024..8784
  const CY = 3504;
  // ---- 1. stamina regeneration by state
  const regen = {};
  for (const [name, fn] of [['stand', () => step(0,0,false,120)], ['crouchStill', () => { A.keys.add('KeyC'); step(0,0,false,2); A.keys.delete('KeyC'); step(0,0,false,118); }], ['walk', () => step(1,0,false,120)], ['crouchWalk', () => { A.keys.add('KeyC'); step(1,0,false,2); A.keys.delete('KeyC'); step(1,0,false,118); }]]) {
    reset(3500, CY, { st: 20 }); const s0 = H.stamina; fn(); regen[name] = +((H.stamina - s0) / 2).toFixed(2);   // per second
  }
  out.regen = regen;
  // ---- 2. walking, running, stamina drain, exhaustion, recovery
  reset(3200, CY); step(1,0,false,90); out.walkSpeed = Math.round(spd()); out.walkStam = H.stamina; out.walkState = mv.s;
  reset(3200, CY); step(1,0,true,60); out.runSpeed = Math.round(spd()); out.runState = mv.s;
  reset(3200, CY); let t = 0, x0 = H.x, lowAt = -1, speedAt30 = 0, exAt = -1;
  while (t < 20 && exAt < 0) { step(1,0,true,1); t += DT; if (H.stamina < 30 && lowAt < 0) { lowAt = t; speedAt30 = spd(); } if (H.exhausted && exAt < 0) exAt = t; if (H.x > 8700) { H.x = 3200; x0 -= 5500; } }
  out.runToExhaust = { secs: +t.toFixed(1), dist: Math.round(H.x - x0), speedWhenLow: Math.round(speedAt30) };
  step(1,0,true,60); out.exhaustedRunSpeed = Math.round(spd()); out.exhaustedState = mv.s;                  // still moves, just slower - run is unavailable
  reset(3200, CY, { st: 0, ex: true }); step(1,0,false,60); out.exWalkSpeed = Math.round(spd());
  A.keys.add('KeyC'); step(1,0,false,2); A.keys.delete('KeyC'); step(1,0,false,60); out.exCrouchSpeed = Math.round(spd()); out.exCrouchState = mv.s;
  // recovery: stand still until it can run again
  reset(3200, CY, { st: 0, ex: true }); let rec = 0; while (H.exhausted && rec < 30) { step(0,0,false,1); rec += DT; } out.recoverStandSecs = +rec.toFixed(1);
  // ---- 3. crouch
  reset(3200, CY); A.keys.add('KeyC'); step(1,0,false,2); A.keys.delete('KeyC'); step(1,0,false,60); out.crouchSpeed = Math.round(spd()); out.crouchState = mv.s; out.crouchProf = mv.prof;
  A.keys.add('KeyC'); step(1,0,false,2); A.keys.delete('KeyC'); step(1,0,false,30); out.standAgain = mv.s;
  // ---- 4. slide: needs running speed; length depends on the surface
  const slideTest = (x, y, run = true, st = 100) => {
    reset(x, y, { st }); step(1,0,run,50);
    const s0 = spd(); A.keys.add('KeyC'); mv.step(1,0,run,DT); A.keys.delete('KeyC');
    const started = mv.s === 'slide'; let d0 = H.x, t = 0;
    while (mv.s === 'slide' && t < 6) { mv.step(1,0,false,DT); t += DT; }
    return { started, from: Math.round(s0), dist: Math.round(H.x - d0), secs: +t.toFixed(2), after: mv.s };
  };
  out.slideCarpet = slideTest(3400, CY);
  // concrete = LONG ROOM (room 6: x 50..75, y 7..18); wet = DAMP ROOMS
  const rooms = A.Oc.map((r, i) => [i, r.name, r.x, r.y, r.w, r.h]); out.rooms = rooms.map(r => r[1]);
  const room = n => A.Oc.find(r => r.name === n);
  const cr = room('LONG ROOM'), wr = room('DAMP ROOMS');
  const freeRun = (rm, need) => { for (let yy = rm.y * 96 + 96; yy < (rm.y + rm.h) * 96 - 96; yy += 24) for (let xx = rm.x * 96 + 96; xx < (rm.x + rm.w) * 96 - need - 96; xx += 24) { let ok = A.sl(xx, yy, 16); for (let d = 0; ok && d <= need; d += 24) ok = A.sl(xx + d, yy, 16); if (ok) return [xx, yy]; } return null; };
  const cp = cr && freeRun(cr, 500), wp = wr && freeRun(wr, 500); out.runsAt = { cp, wp };
  out.slideConcrete = cp ? slideTest(cp[0], cp[1]) : null;
  out.slideWet = wp ? slideTest(wp[0], wp[1]) : null;
  out.surfaces = { carpet: W.surfaceAt(3400, CY, A.Oc), concrete: cp ? W.surfaceAt(cp[0], cp[1], A.Oc) : null, wet: wp ? W.surfaceAt(wp[0], wp[1], A.Oc) : null };
  // slide from a walk: not available; from a low-stamina run: shorter
  reset(3400, CY); step(1,0,false,60); A.keys.add('KeyC'); mv.step(1,0,false,DT); A.keys.delete('KeyC'); out.slideFromWalk = mv.s;
  out.slideLowStam = slideTest(3400, CY, true, 20);
  // slide cancel is throttled: after a slide you cannot start another at once
  reset(3400, CY); step(1,0,true,50); A.keys.add('KeyC'); mv.step(1,0,true,DT); A.keys.delete('KeyC'); const first = mv.s === 'slide';
  step(0,0,false,3); A.keys.add('KeyC'); mv.step(1,0,true,DT); A.keys.delete('KeyC');           // cancel into a crouch
  step(1,0,true,6); A.keys.add('KeyC'); mv.step(1,0,true,DT); A.keys.delete('KeyC');
  out.slideChain = { first, secondImmediately: mv.s === 'slide', afterCancelState: mv.s, cd: +mv.slideCd.toFixed(2) };
  // ---- 5. vaults: approach a counter (L1) head-on
  const L1 = W.PROPS.find(p => p.id === 'L1'), r = L1.rect;
  const vaultTest = (label, o) => {
    reset(r.x + r.w / 2, r.y - (o.dist || 120), { st: o.st ?? 100, ex: !!o.ex });
    if (o.crouch) { A.keys.add('KeyC'); mv.step(0,0,false,DT); A.keys.delete('KeyC'); }
    const ang = o.ang || 0, ix = Math.sin(ang), iy = Math.cos(ang);
    let q = -1, ev = null, n = 0, cost = 0, s0 = H.stamina, tv = 0, crossed = false, sp0 = 0;
    for (let i = 0; i < 400; i++) { mv.step(ix, iy, !!o.run, DT); if (mv.vault && q < 0) { q = mv.q; sp0 = mv.vault ? Math.round(Math.hypot(mv.vault.ex - mv.vault.sx, mv.vault.ey - mv.vault.sy)) : 0; ev = mv.ev.slice(); } if (H.y > r.y + r.h + 10) { crossed = true; break; } }
    out['vault_' + label] = { q, ev, crossed, stamCost: +(s0 - H.stamina).toFixed(1), endState: mv.s, yEnd: Math.round(H.y), rectY: [Math.round(r.y), Math.round(r.y + r.h)] };
  };
  vaultTest('run', { run: true });
  vaultTest('walk', {});
  vaultTest('crouch', { crouch: true });
  vaultTest('runLowStamina', { run: true, st: 8 });
  vaultTest('walkLowStamina', { st: 2 });
  vaultTest('runExhausted', { run: true, st: 0, ex: true });
  vaultTest('runAngled', { run: true, ang: 1.0, dist: 50 });
  vaultTest('runVeryAngled', { run: true, ang: 1.45, dist: 50 });
  vaultTest('walkAngled', { ang: 1.0, dist: 50 });
  // a vault attempt on open floor does nothing
  reset(3400, CY); step(1,0,true,90); out.openFloorVault = mv.s;
  // ---- 6. crawl: a wall hole (G1) needs a crouch; a walking player who pushes on it lowers himself
  const G1 = W.PROPS.find(p => p.id === 'G1'), gc = G1.cell;
  reset(gc.x - 90, gc.y + 48); let seq = [], reach = false;
  step(1,0,false,40); out.walkIntoHoleBlocked = Math.round(H.x - gc.x);                      // stopped short at first
  A.keys.add('KeyC'); step(1,0,false,2); A.keys.delete('KeyC');
  for (let i = 0; i < 260; i++) { mv.step(1,0,false,DT); if (!seq.length || seq[seq.length-1] !== mv.s) seq.push(mv.s); if (H.x > gc.x + gc.w + 30) { reach = true; break; } }
  out.crawlThroughHole = { seq, reach, x: Math.round(H.x - gc.x) };
  // walking up to a hole eventually crouches on its own
  reset(gc.x - 90, gc.y + 48); let auto = false, s2 = []; for (let i = 0; i < 400; i++) { mv.step(1,0,false,DT); if (!s2.length || s2[s2.length-1] !== mv.s) s2.push(mv.s); if (H.x > gc.x + gc.w + 30) { auto = true; break; } }
  out.autoLower = { seq: s2, through: auto };
  // running into the hole just bumps
  reset(gc.x - 200, gc.y + 48); step(1,0,true,90); out.runIntoHole = { x: Math.round(H.x - gc.x), state: mv.s };
  // under a table (U1): crawl beneath
  const U1 = W.PROPS.find(p => p.id === 'U1'); reset(U1.rect.x - 60, U1.rect.y + U1.rect.h / 2);
  A.keys.add('KeyC'); step(1,0,false,2); A.keys.delete('KeyC'); let ss = []; for (let i = 0; i < 260; i++) { mv.step(1,0,false,DT); if (!ss.length || ss[ss.length-1] !== mv.s) ss.push(mv.s); }
  out.underTable = { seq: ss, x: Math.round(H.x - U1.rect.x), w: U1.rect.w };
  // ---- 7. windows: a sill in a partition wall
  const W1 = W.PROPS.find(p => p.id === 'W1'), wr1 = W1.rect; reset(wr1.x - 100, wr1.y + wr1.h / 2); let wq = -1, wc = false;
  for (let i = 0; i < 300; i++) { mv.step(1,0,true,DT); if (mv.vault && wq < 0) wq = mv.q; if (H.x > wr1.x + wr1.w + 20) { wc = true; break; } }
  out.windowVault = { q: wq, crossed: wc };
  // ---- 8. noise reported to the server (state + speed) and events
  reset(3200, CY); step(1,0,true,60); out.netRun = mv.net();
  A.tp(3200, CY); mv.reset();
  out.M = M;
  return out;
}
"""
async def main():
    subprocess.run(['fuser','-k',f'{PORT}/tcp'],stderr=subprocess.DEVNULL)
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'--directory',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=ARGS)
        c=await b.new_context(viewport={'width':640,'height':420}); pg=await c.new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        await pg.goto(f'http://localhost:{PORT}/'); await pg.wait_for_timeout(2500)
        await pg.fill('#name','Tester'); await pg.click('#enter'); await pg.evaluate("()=>window.__net && __net.testAuth && __net.testAuth('smoor')"); await pg.wait_for_timeout(5000)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)          # pause the game loop: only our steps move the player
        print('paused', await pg.evaluate("()=>__api.paused()"))
        r=await pg.evaluate(JS)
        if '-v' in sys.argv: print(json.dumps(r,indent=1))
        bad=verdicts(r)
        print('errs',errs)
        await b.close()
    srv.terminate()
    print('\nRESULT','OK' if not bad and not errs else f'{len(bad)} failing check(s): '+'; '.join(bad))
    sys.exit(1 if bad or errs else 0)

def verdicts(r):
    bad=[]
    def chk(name,ok,note):
        print(('PASS ' if ok else 'FAIL ')+name+'\n       '+note)
        if not ok: bad.append(name)
    M=r['M']
    chk('M01 speeds: walk 172, run 285, crouch 92, crawl 54 px/s', (r['walkSpeed'],r['runSpeed'],r['crouchSpeed'])==(172,285,92) and M['crawl']==54, f"walk {r['walkSpeed']}, run {r['runSpeed']}, crouch {r['crouchSpeed']}, crawl {M['crawl']}")
    chk('M02 states: walking is WALK, holding shift is RUN, C toggles CROUCH and back', r['walkState']=='walk' and r['runState']=='run' and r['crouchState']=='crouch' and r['standAgain'] in ('walk','stand'), f"{r['walkState']}/{r['runState']}/{r['crouchState']}/{r['standAgain']}")
    reg=r['regen']; chk('M03 stamina regenerates fastest standing still, slower crouching, slowest while moving', reg['stand']>reg['crouchStill']>reg['crouchWalk']>=reg['walk']-1 and reg['walk']>0, f"per second: stand {reg['stand']}, crouch {reg['crouchStill']}, crouch-walk {reg['crouchWalk']}, walk {reg['walk']}")
    chk('M04 running drains stamina: about 9-10 s of sprint from full (~2600 px), still at full speed until it is nearly gone', 8<=r['runToExhaust']['secs']<=11 and r['runToExhaust']['speedWhenLow']>=270, str(r['runToExhaust']))
    chk('M05 exhaustion slows you but never disables anything: you still walk (148), crouch, vault and slide; run is simply unavailable until you recover', r['exhaustedRunSpeed']==148 and r['exWalkSpeed']==148 and r['exCrouchSpeed']>60 and r['vault_runExhausted']['crossed'] and r['vault_runExhausted']['q']>=0, f"exhausted: run-key speed {r['exhaustedRunSpeed']}, walk {r['exWalkSpeed']}, crouch-walk {r['exCrouchSpeed']}, can vault: {r['vault_runExhausted']['crossed']}")
    chk('M06 stamina recovers standing still (exhaustion ends within ~2 s at rest)', r['recoverStandSecs']<=3, f"{r['recoverStandSecs']} s")
    sc,sn,sw=r['slideCarpet'],r['slideConcrete'],r['slideWet']
    chk('M07 slide length depends on the surface: carpet short < concrete medium < wet long', sc['started'] and sn['started'] and sw['started'] and sc['dist']<sn['dist']<sw['dist'] and sw['dist']>=2*sc['dist'], f"carpet {sc['dist']} px / {sc['secs']}s, concrete {sn['dist']} px / {sn['secs']}s, wet {sw['dist']} px / {sw['secs']}s")
    chk('M08 a slide needs running speed; low stamina makes it shorter', r['slideFromWalk']=='crouch' and r['slideLowStam']['dist']<sc['dist'], f"from a walk: {r['slideFromWalk']}; from a tired run {r['slideLowStam']['dist']} px vs {sc['dist']} px fresh")
    ch=r['slideChain']; chk('M09 no infinite slide-cancel chain: after a slide a new one is throttled', ch['first'] and not ch['secondImmediately'] and ch['cd']>.3, str(ch))
    va,vw,vc=r['vault_run'],r['vault_walk'],r['vault_crouch']
    chk('M10 three vaults by approach: run = FAST (costs stamina), walk = NORMAL, crouch = SLOW (free); labels are never shown', (va['q'],vw['q'],vc['q'])==(2,1,0) and va['stamCost']>vw['stamCost']>=vc['stamCost'] and vc['stamCost']<=.1, f"q run/walk/crouch = {va['q']}/{vw['q']}/{vc['q']}; stamina cost {va['stamCost']}/{vw['stamCost']}/{vc['stamCost']}")
    chk('M11 vault detection: shallow angles vault, a very oblique approach just bumps, open floor never triggers one', r['vault_runAngled']['q']>=0 and r['vault_runVeryAngled']['q']==-1 and r['openFloorVault']=='run', f"angled q {r['vault_runAngled']['q']}, very angled q {r['vault_runVeryAngled']['q']}, open floor {r['openFloorVault']}")
    chk('M12 a wall hole: walking stops short, crouching crawls through and stands again; walking up to it lowers you by itself; running into it bumps', r['walkIntoHoleBlocked']<0 and r['crawlThroughHole']['reach'] and 'crawl' in r['crawlThroughHole']['seq'] and r['autoLower']['through'] and 'crawl' in r['autoLower']['seq'] and r['runIntoHole']['x']<0, f"{r['crawlThroughHole']['seq']} / auto {r['autoLower']['seq']} / run bump at {r['runIntoHole']['x']}")
    chk('M13 crawling under low furniture, and vaulting a window sill', 'crawl' in r['underTable']['seq'] and r['windowVault']['crossed'], f"table: {r['underTable']['seq']}; window vault q={r['windowVault']['q']}")
    n=r['netRun']; chk('M14 the state the server hears is the real one (run, speed, stamina, exhausted flag)', n['s']==2 and n['sp']>=280 and 0<=n['st']<=100, str(n))
    return bad
asyncio.run(main())
