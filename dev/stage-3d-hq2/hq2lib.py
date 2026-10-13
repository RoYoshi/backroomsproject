"""Stage 3D HQ2 - shared helpers for the browser harnesses (development only).

Builds on dev/stage-3d/lib3d.py and dev/stage-3d-hq1/hq1lib.py.  Every server runs with the SYNTHETIC admin passcode (lib3d.PASS).
What is new here: ordinary (non-admin) test players - an admin's own movement skips the server's checks, so a collision test whose
players were admins would test nothing - placed by a quiet admin connection (ws_place.js, the admin BRING command)."""
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq1'))
import hq1lib as L          # noqa: E402  (hq1lib imports lib3d as L.lib3d)
lib3d = L.lib3d
PASS, ARGS, REPO = lib3d.PASS, lib3d.ARGS, lib3d.REPO


async def join(ctx, port, room, name, errs, query='', auth=False):
    """lib3d.join without the test passcode unless auth: an ordinary player whose every move the server checks"""
    P = await ctx.new_page()
    P.on('pageerror', lambda e: errs.append(name + ' pageerror: ' + str(e)[:300]))
    P.on('console', lambda m: errs.append(name + ' console: ' + m.text[:200]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
    await P.goto(f'http://127.0.0.1:{port}/?room={room}{query}', timeout=90000)
    await P.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000); await P.wait_for_timeout(1200)
    if await P.evaluate("()=>!!(window.__ui && window.__ui.version)"):
        await P.evaluate("()=>window.__ui.go('play')"); await P.wait_for_selector('#name', state='visible', timeout=30000)
    await P.fill('#name', name); await P.click('#enter')
    for _ in range(150):
        if await P.evaluate("()=>!!(window.__api && __api.started() && !document.getElementById('hud').hidden)"): break
        await P.wait_for_timeout(100)
    for _ in range(100):
        if await P.evaluate("()=>!!(window.__net && window.__net.on !== false)"): break
        await P.wait_for_timeout(100)
    if auth: await P.evaluate("p=>{window.__net && __net.testAuth && __net.testAuth(p)}", PASS)
    for _ in range(100):
        if await P.evaluate("()=>__api.fall()<0"): break
        await P.wait_for_timeout(100)
    await P.wait_for_timeout(800)
    return P


def place(port, room, places=(), god=(), clear=False, out=None):
    """the server moves each (id, x, y) there (admin BRING from a quiet connection); god-mode ids; monsters removed"""
    a = ['node', os.path.join(HERE, 'ws_place.js'), '--port', str(port), '--room', room, '--pass', PASS]
    if clear: a += ['--clear', '1']
    if god: a += ['--god', ','.join(str(i) for i in god)]
    if places: a += ['--place', ','.join(f'{i}:{int(x)}:{int(y)}' for i, x, y in places)]
    if out: a += ['--out', out]
    return subprocess.run(a, capture_output=True, text=True, timeout=30).returncode


def watch(port, room, secs, out):
    return subprocess.Popen(['node', os.path.join(HERE, 'ws_watch.js'), '--port', str(port), '--room', room, '--pass', PASS, '--secs', str(secs), '--out', out],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


POS = "()=>({t:+(Date.now()/1000).toFixed(3), x:+__api.H.x.toFixed(1), y:+__api.H.y.toFixed(1), id:__api.H.id})"
