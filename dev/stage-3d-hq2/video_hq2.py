#!/usr/bin/env python3
"""Stage 3D HQ2 - a filmed walk-through on real browser pages: two windows and a late joiner, side by side (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/video_hq2.py --game DIR --out DIR

Three pages, each recorded by the browser itself (Playwright's own video of the page), at 720 x 480:
  Alice and Bob (ordinary players, god mode, the monsters removed) meet in Level 0's one-tile corridor:
    1  Alice holds D into Bob, who stands still: she stops at contact (her page predicts it; the server agrees)
    2  Bob is moved 30 px aside: Alice holds D again and slides past his shoulder
    3  Alice walks back and presses NEW RUN: the server's blast; Bob watches it
    4  Carol opens the game 1.5 s after the blast: she sees what is left (a late joiner)
    5  Alice presses SPAWN: a new run
Every page shows, in its top left corner, burnt into the film: HQ2, the build hash (sha256 of the production files the server serves and
runs - the same files at any later commit give the same hash), the page's role, its frame time (the mean of its last 10 frames, from
requestAnimationFrame) and the wall clock; and the current step.  The three films are aligned on the wall clock and put side by side
(ffmpeg): film.mp4.  Also written: each page's own film (.webm), stills at each step, and timeline.json (when each step began, the
build hash and the files it covers, every page's frame-time samples)."""
import os, sys, asyncio, argparse, json, time, hashlib, subprocess, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 720, 480
Y, XA, XB = 720, 862, 1012
BUILD_FILES = ['server.js', 'server/peers.js', 'sim.js', 'death_srv.js', 'dphys.js', 'mp.js', 'move.js', 'gore.js', 'ents.js', 'index.html', 'assets/index-DKbV5Nv9.js', 'assets/net-wire.js']
h = hashlib.sha256()
for f in BUILD_FILES: h.update(f.encode() + b'\0' + open(os.path.join(A_.game, f), 'rb').read())
BUILD = h.hexdigest()[:12]
OVERLAY = r"""((build, role)=>{ const add=()=>{ if(document.getElementById('hq2film')) return; const d=document.createElement('div'); d.id='hq2film';
    d.style.cssText='position:fixed;left:8px;top:8px;z-index:2147483647;font:12px/1.35 monospace;color:#fff;background:rgba(0,0,0,.72);padding:5px 8px;border-radius:3px;pointer-events:none;white-space:pre';
    document.documentElement.appendChild(d); const S=window.__film={step:'',ft:[]}; let last=0;
    const tick=t=>{ if(last){ S.ft.push(t-last); if(S.ft.length>10) S.ft.shift(); } last=t; const m=S.ft.length?S.ft.reduce((a,b)=>a+b,0)/S.ft.length:0;
      const c=new Date(); d.textContent='HQ2 build '+build+'  '+role+'\nframe '+m.toFixed(0)+' ms   '+c.toTimeString().slice(0,8)+'.'+String(c.getMilliseconds()).padStart(3,'0')+(S.step?'\n'+S.step:''); requestAnimationFrame(tick) };
    requestAnimationFrame(tick) };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',add); else add(); })"""
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
FT = "()=>window.__film?window.__film.ft.slice():null"


async def main():
    os.makedirs(A_.out, exist_ok=True); vids = os.path.join(A_.out, 'pages'); os.makedirs(vids, exist_ok=True)
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, os.path.join(A_.out, 'server.log')); errs = []
    T = {'tool': 'dev/stage-3d-hq2/video_hq2.py', 'game': A_.game, 'build': BUILD, 'buildFiles': BUILD_FILES, 'steps': [], 'pages': {}, 'frameMs': {}}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ctx = {}
            for role in ('Alice', 'Bob', 'Carol'):
                c = await b.new_context(viewport={'width': W, 'height': H}, record_video_dir=os.path.join(vids, role.lower()), record_video_size={'width': W, 'height': H})
                await c.add_init_script(f"({OVERLAY})('{BUILD}', '{role.upper()}')"); ctx[role] = c
            async def step(label, pages):
                T['steps'].append({'t': time.time(), 'step': label}); print(label, flush=True)
                for P in pages: await P.evaluate("(s)=>{ if(window.__film) window.__film.step=s }", label)
            T['pages']['Alice'] = time.time(); A = await Q.join(ctx['Alice'], port, 'h2film', 'Alice', errs); aid = await A.evaluate("()=>__api.H.id")
            Q.place(port, 'h2film', (), god=(aid,), clear=True)
            T['pages']['Bob'] = time.time(); B = await Q.join(ctx['Bob'], port, 'h2film', 'Bob', errs); bid = await B.evaluate("()=>__api.H.id")
            Q.place(port, 'h2film', [(bid, XB, Y), (aid, XA, Y)], god=(aid, bid), clear=True)
            await A.wait_for_timeout(1500)
            for P, a in ((A, 0.0), (B, 3.1416)): await Q.lib3d.aim(P, a, W, H)
            await A.wait_for_timeout(1200)
            await step('1  Alice walks into Bob, who stands still', (A, B))
            await A.bring_to_front(); await A.keyboard.down('KeyD'); await A.wait_for_timeout(2600); await A.keyboard.up('KeyD'); await A.wait_for_timeout(1200)
            await A.screenshot(path=os.path.join(A_.out, 'still_1_alice.png')); await B.screenshot(path=os.path.join(A_.out, 'still_1_bob.png'))
            await step('2  Bob stands aside: Alice slides past his shoulder', (A, B))
            Q.place(port, 'h2film', [(bid, XB, Y - 30)], clear=True); await A.wait_for_timeout(1200)
            await A.bring_to_front(); await A.keyboard.down('KeyD'); await A.wait_for_timeout(1800)
            await A.screenshot(path=os.path.join(A_.out, 'still_2_alice.png')); await B.screenshot(path=os.path.join(A_.out, 'still_2_bob.png'))
            await A.wait_for_timeout(600); await A.keyboard.up('KeyD'); await A.wait_for_timeout(800)
            await step('3  Alice walks back; NEW RUN: the server\'s blast', (A, B))
            await A.keyboard.down('KeyA'); await A.wait_for_timeout(1000); await A.keyboard.up('KeyA'); await A.wait_for_timeout(800)
            await A.evaluate(PRESS); await A.wait_for_timeout(1500)
            await A.screenshot(path=os.path.join(A_.out, 'still_3_alice.png')); await B.screenshot(path=os.path.join(A_.out, 'still_3_bob.png'))
            await step('4  Carol opens the game: a late joiner', (A, B))
            T['pages']['Carol'] = time.time(); C = await Q.join(ctx['Carol'], port, 'h2film', 'Carol', errs)
            cid = await C.evaluate("()=>__api.H.id"); Q.place(port, 'h2film', [(cid, XB - 60, Y)], god=(cid,), clear=True)
            await C.evaluate("(s)=>{ if(window.__film) window.__film.step=s }", '4  Carol opens the game: a late joiner')
            await C.wait_for_timeout(2500)
            for nm, P in (('alice', A), ('bob', B), ('carol', C)): await P.screenshot(path=os.path.join(A_.out, f'still_4_{nm}.png'))
            await step('5  Alice presses SPAWN: a new run', (A, B, C))
            T['spawned'] = await A.evaluate(SPAWN); await A.wait_for_timeout(3000)
            for nm, P in (('alice', A), ('bob', B), ('carol', C)): await P.screenshot(path=os.path.join(A_.out, f'still_5_{nm}.png'))
            T['frameMs'] = {nm: await P.evaluate(FT) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
            T['end'] = time.time(); T['pageErrors'] = errs[:20]
            paths = {}
            for role, P in (('Alice', A), ('Bob', B), ('Carol', C)): paths[role] = await P.video.path()
            for c in ctx.values(): await c.close()
            await b.close()
            T['videos'] = {}
            for role, src in paths.items():
                dst = os.path.join(A_.out, role.lower() + '.webm'); shutil.move(src, dst); T['videos'][role] = os.path.basename(dst)
            shutil.rmtree(vids, ignore_errors=True)
    finally:
        Q.lib3d.stop_server(srv)
    t0 = T['pages']['Alice']; pads = {r: max(0.0, T['pages'][r] - t0) for r in ('Alice', 'Bob', 'Carol')}
    inp = []
    for r in ('Alice', 'Bob', 'Carol'): inp += ['-i', os.path.join(A_.out, r.lower() + '.webm')]
    fl = ';'.join(f"[{i}:v]tpad=start_duration={pads[r]:.2f}:color=black,setpts=PTS-STARTPTS,scale={W}:{H},fps=15[v{i}]" for i, r in enumerate(('Alice', 'Bob', 'Carol'))) + ';[v0][v1][v2]hstack=inputs=3:shortest=0[out]'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + inp + ['-filter_complex', fl, '-map', '[out]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', os.path.join(A_.out, 'film.mp4')]
    T['ffmpeg'] = subprocess.run(cmd, capture_output=True, text=True).returncode; T['alignSeconds'] = pads
    with open(os.path.join(A_.out, 'timeline.json'), 'w') as f: json.dump(T, f, indent=1); f.write('\n')
    print(json.dumps({'build': BUILD, 'ffmpeg': T['ffmpeg'], 'spawned': T.get('spawned'), 'errors': T.get('pageErrors')}))


asyncio.run(main())
