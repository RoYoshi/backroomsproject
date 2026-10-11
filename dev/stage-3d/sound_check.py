#!/usr/bin/env python3
"""Stage 3D - what a death sounds like, and to whom; the death camera's shake with reduced motion (development only).

  python3 dev/stage-3d/sound_check.py --game DIR --out FILE.json

Headless Chromium plays the game's Web Audio without a speaker; the tool counts what is played instead.  Alice (admin) dies through the
admin death lab at normal speed (Hound C into a wall, then Smiler A); Bob (god mode) watches from about 150 px, Carol from far away
(about 1,600 px, out of earshot).  On every page:
  - every call of the game's death sound (the bundle's audio death(kind, options)) with its options: the blows' times, gain, pan, muffling;
  - every death event the physics offered to the sound (ents deathEvent: wall, eq, eqhit, hat), and the sounds those started;
  - every audio source started while the death plays (AudioScheduledSourceNode.start), against the same span of quiet before it.
Then once more with the game's sound switched OFF on Bob (nothing may play) and once with reduced motion on Alice (the settings' 'rm'
class): the largest camera shake during the death (the scene's shakeX/shakeY) with and without.
The server runs with a synthetic admin passcode (lib3d.PASS)."""
import os, sys, asyncio, argparse, time, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
ARGS = lib3d.ARGS + ['--autoplay-policy=no-user-gesture-required']
INIT = """(()=>{ window.__snd={starts:0, log:[]}; const P=window.AudioScheduledSourceNode&&AudioScheduledSourceNode.prototype; if(P){ const s=P.start; P.start=function(...a){ window.__snd.starts++; return s.apply(this,a) } } })()"""
HOOK = """()=>{ const A=__api, Z=A.audio&&A.audio(); const L=window.__snd.log;
  if(Z && Z.death && !Z.__w){ const d=Z.death.bind(Z); Z.death=(k,O)=>{ L.push({t:performance.now(), what:'death', kind:k, hits:O&&O.hits||(window.__dsndHits&&window.__dsndHits(k))||null, gain:O&&O.gain, pan:O&&O.pan, lp:O&&O.lp}); return d(k,O) }; Z.__w=1 }
  const E=window.__ents; if(E && E.deathEvent && !E.__w){ const f=E.deathEvent; E.deathEvent=(q,jl,S)=>{ if(['wall','eq','eqhit','hat'].includes(q.k)) L.push({t:performance.now(), what:'event', k:q.k, sp:q.sp?Math.round(q.sp):null}); return f(q,jl,S) }; E.__w=1 }
  const G=window.__gore; if(G && G.cull && !G.__ws){ const c=G.cull; G.cull=(r,s)=>{ window.__scn=s; return c(r,s) }; G.__ws=1 }
  return !!(Z && Z.context) }"""
SHAKE = """()=>{ window.__shk=0; const f=()=>{ const s=window.__scn; if(s && __api.death().active) window.__shk=Math.max(window.__shk, Math.hypot(s.shakeX||0, s.shakeY||0)); if(!window.__shkStop) requestAnimationFrame(f) }; window.__shkStop=false; requestAnimationFrame(f) }"""


async def die(A, kind, v, spot):
    await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", spot); await A.wait_for_timeout(2500)
    if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
    await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
    s0 = await A.evaluate("()=>__api.death().startAt")
    for attempt in range(3):                                   # a preview can be refused for a moment (the last death's entity still busy)
        await lib3d.click(A, f'[data-c=preview][data-k={kind}][data-var={v}]')
        t0 = time.time(); ok = False
        while time.time() - t0 < 6 and not ok:
            ok = await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s", s0)
            if not ok: await A.wait_for_timeout(50)
        if ok: break
        await A.wait_for_timeout(2500); await lib3d.ensure_alive(A)
        if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
        await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
    await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
    return ok


async def main():
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []; R = {'tool': 'dev/stage-3d/sound_check.py', 'game': A_.game, 'runs': {}}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            ctx = [await b.new_context(viewport={'width': 760, 'height': 520}) for _ in range(3)]
            for c in ctx: await c.add_init_script(INIT)
            A = await lib3d.join(ctx[0], port, 'snd3d', 'Alice', errs); await lib3d.admin_open(A)
            B = await lib3d.join(ctx[1], port, 'snd3d', 'Bob', errs); C = await lib3d.join(ctx[2], port, 'snd3d', 'Carol', errs)
            for P in (B, C): pid = await P.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': pid}); await A.wait_for_timeout(300)
            await lib3d.admin_cmd(A, {'c': 'blackout', 'mode': 'off'})
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            for P in (A, B, C): R.setdefault('audio', []).append(await P.evaluate(HOOK))
            for tag, kind, v, sp, bob_off, rm in (('houndC', 'hound', 'C', 'wall', False, False), ('smilerA', 'smiler', 'A', 'open', False, False),
                                                  ('houndA_bobSoundOff', 'hound', 'A', 'open', True, False), ('houndA_reducedMotion', 'hound', 'A', 'open', False, True)):
                await lib3d.ensure_alive(A)
                spot = spots[sp]; await B.evaluate(lib3d.WATCH_FROM, spot); await C.evaluate("([x,y])=>{__api.tp(x+1600,y)}", spot)
                await B.evaluate("off=>{ const s=document.getElementById('sound'); if(s && (/OFF/.test(s.textContent)) !== off) s.click() }", bob_off)
                await A.evaluate("rm=>document.documentElement.classList.toggle('rm', rm)", rm)
                await A.wait_for_timeout(1500)
                for P in (A, B, C): await P.evaluate(HOOK)
                # quiet: the same span before the death, for the background rate of sources
                q0 = [await P.evaluate("()=>window.__snd.starts") for P in (A, B, C)]; await A.wait_for_timeout(3000); q1 = [await P.evaluate("()=>window.__snd.starts") for P in (A, B, C)]
                l0 = [await P.evaluate("()=>window.__snd.log.length") for P in (A, B, C)]
                await A.evaluate(SHAKE)
                started = await die(A, kind, v, spot); t0 = time.time()
                await A.wait_for_timeout(5600)
                shake = await A.evaluate("()=>{window.__shkStop=true; return +window.__shk.toFixed(3)}")
                R.setdefault('dcamK', {})[tag] = await A.evaluate("()=>window.__dcamK?window.__dcamK():null")
                s1 = [await P.evaluate("()=>window.__snd.starts") for P in (A, B, C)]
                logs = [await P.evaluate("n=>window.__snd.log.slice(n)", l0[i]) for i, P in enumerate((A, B, C))]
                R['runs'][tag] = {'quietStartsPer3s': [q1[i] - q0[i] for i in range(3)], 'deathStarts': [s1[i] - q1[i] for i in range(3)], 'victim': logs[0], 'spectator': logs[1], 'far': logs[2],
                                  'maxShake': shake, 'reducedMotion': rm, 'spectatorSoundOff': bob_off, 'started': started}
                print(tag, 'sources quiet', R['runs'][tag]['quietStartsPer3s'], 'death', R['runs'][tag]['deathStarts'], 'shake', shake, flush=True)
                print('  victim', [(x['what'], x.get('k') or x.get('kind'), x.get('hits')) for x in logs[0]][:8], flush=True)
                print('  spectator', [(x['what'], x.get('k') or x.get('kind'), x.get('gain') and round(x['gain'], 2)) for x in logs[1]][:8], flush=True)
                print('  far', [(x['what'], x.get('k') or x.get('kind')) for x in logs[2]][:8], flush=True)
                await lib3d.until_alive(A, 30)
            await B.evaluate("()=>{ const s=document.getElementById('sound'); if(s && /OFF/.test(s.textContent)) s.click() }")
            await A.evaluate("()=>document.documentElement.classList.remove('rm')")
            await b.close()
    finally:
        lib3d.stop_server(srv)
    R['errors'] = errs[:20]
    lib3d.dump(A_.out, R)

asyncio.run(main())
