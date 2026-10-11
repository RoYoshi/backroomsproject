"""Stage 3D - shared helpers for the browser harnesses (development only).

Every server these tools start runs with a SYNTHETIC admin passcode (ADMIN_PASSCODE=PASS below), so no real secret is used or recorded.
The game folder is an argument: the working tree, or an export of the accepted parent (git archive 06949a8) for before / after runs."""
import os, subprocess, time, socket, json

PASS = 'd3-synthetic-admin'
ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def start_server(game, port, log):
    env = dict(os.environ, ADMIN_PASSCODE=PASS); env.pop('BODY_TTL', None); env.pop('PORT', None)
    p = subprocess.Popen(['node', 'server.js', str(port)], cwd=game, env=env, stdout=open(log, 'w'), stderr=subprocess.STDOUT)
    t0 = time.time()
    while time.time() - t0 < 10:
        try:
            socket.create_connection(('127.0.0.1', port), .2).close(); return p
        except OSError: time.sleep(.1)
    return p


def stop_server(p):
    if p.poll() is None:
        p.terminate()
        try: p.wait(5)
        except subprocess.TimeoutExpired: p.kill()


# where to stand: an open room, a spot 72-108 px in front of a wall (the hound's wall slam), a corner, a corridor (the game's own rays)
SPOTS = r"""(kind)=>{ const A=__api, gl=window.__glitches||[], lamps=A.lamps||[], T=Math.PI*2;
  const ok=(x,y)=>A.sl(x,y,24)&&!gl.some(g=>Math.hypot(g.x-x,g.y-y)<260)&&!lamps.some(l=>Math.hypot(l.x-x,l.y-y)<230);
  const ray=(x,y,a)=>A.Uc(x,y,a,260);
  for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48){ if(!ok(x,y)) continue;
    if(kind==='open'){ let g=true; for(let k=0;k<8;k++) if(ray(x,y,k/8*T)<210){g=false;break} if(g) return [x,y,Math.PI]; }
    else if(kind==='wall'){ for(let k=0;k<8;k++){ const a=k/8*T, d=ray(x,y,a); if(d>72&&d<108&&ray(x,y,a+.5)>60&&ray(x,y,a-.5)>60&&ray(x,y,a+Math.PI)>150) return [x,y,a+Math.PI]; } }
    else if(kind==='corner'){ for(let k=0;k<16;k++){ const a=k/16*T, d1=ray(x,y,a), d2=ray(x,y,a+Math.PI/2); if(d1>60&&d1<115&&d2>60&&d2<115&&ray(x,y,a+Math.PI)>150&&ray(x,y,a+Math.PI*1.5)>150) return [x,y,a+Math.PI*1.25]; } }
    else if(kind==='corridor'){ for(const [ax,px] of [[0,Math.PI/2],[Math.PI/2,0]]){ const w=ray(x,y,px)+ray(x,y,px+Math.PI); if(w>90&&w<150&&ray(x,y,ax)>250&&ray(x,y,ax+Math.PI)>250) return [x,y,ax]; } }
  } return null }"""


# where a spectator stands to watch a death at [x, y]: about 150 px away, on a clear spot with a clear line to the victim, facing it, light up
WATCH_FROM = r"""([x,y])=>{ const A=__api; let best=null;
  for(const d of [150,130,170,110]) { for(let k=0;k<16;k++){ const a=k/16*Math.PI*2, bx=x+Math.cos(a)*d, by=y+Math.sin(a)*d;
    if(!A.sl(bx,by,26)) continue; const back=Math.atan2(y-by,x-bx); if(A.Uc(bx,by,back,d+5)<d-20) continue; best=[bx,by,back]; break } if(best) break }
  if(!best) best=[x+150,y+40,Math.PI]; A.tp(best[0],best[1]); A.H.angle=best[2]; return best }"""


async def aim(P, ang, w, h):
    """the game aims where the pointer is: put the pointer 220 px from the screen centre in that direction (and the angle with it)"""
    import math
    await P.mouse.move(w / 2 + math.cos(ang) * 220, h / 2 + math.sin(ang) * 220)
    await P.evaluate("a=>{__api.H.angle=a}", ang)


async def join(ctx, port, room, name, errs):
    P = await ctx.new_page()
    P.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    P.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
    await P.goto(f'http://127.0.0.1:{port}/?room={room}', timeout=90000)
    await P.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000); await P.wait_for_timeout(1200)
    if await P.evaluate("()=>!!(window.__ui && window.__ui.version)"):              # Stage 3C's menu: PLAY, then the name field
        await P.evaluate("()=>window.__ui.go('play')"); await P.wait_for_selector('#name', state='visible', timeout=30000)
    await P.fill('#name', name); await P.click('#enter')
    for _ in range(150):
        if await P.evaluate("()=>!!(window.__api && __api.started() && !document.getElementById('hud').hidden)"): break
        await P.wait_for_timeout(100)
    for _ in range(100):
        if await P.evaluate("()=>!!(window.__net && window.__net.on !== false)"): break
        await P.wait_for_timeout(100)
    await P.evaluate("p=>{window.__net && __net.testAuth && __net.testAuth(p)}", PASS)
    await P.wait_for_timeout(2500)
    return P


async def click(P, sel):
    return await P.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}", sel)


async def admin_open(P):
    """the admin panel, unlocked with the synthetic passcode; the monsters are removed so that only the death under test plays"""
    if await P.evaluate("()=>document.getElementById('adminPanel').hidden"): await P.keyboard.press('Backquote')
    await P.wait_for_timeout(300)
    if await P.evaluate("()=>!!document.getElementById('admPass') && document.getElementById('admPass').offsetParent!==null"):
        await P.fill('#admPass', PASS); await P.keyboard.press('Enter'); await P.wait_for_timeout(1400)
    await click(P, '[data-a=tab][data-t=monsters]')
    for _ in range(6): await click(P, '[data-c=hounds][data-mode=remove]'); await P.wait_for_timeout(90)
    for _ in range(8): await click(P, '[data-c=smilers][data-mode=remove]'); await P.wait_for_timeout(90)
    await click(P, '[data-a=tab][data-t=deaths]'); await P.wait_for_timeout(400)


async def admin_cmd(P, data):
    """one admin command through the panel's own click handler (a temporary button carrying the data-* fields)"""
    return await P.evaluate("""d=>{ const p=document.getElementById('adminPanel'); const b=document.createElement('button'); for(const k in d) b.dataset[k]=String(d[k]);
      b.style.display='none'; p.appendChild(b); b.click(); b.remove(); return true }""", data)


async def until_alive(P, limit=40):
    t0 = time.time()
    while time.time() - t0 < limit:
        if await P.evaluate("()=>!__api.G.caught && __api.fall()<0"): return True
        await P.wait_for_timeout(250)
    return False


async def ensure_alive(P):
    """dead or held (a monster got there before the harness removed them): respawn through the client's own path and wait"""
    if await P.evaluate("()=>!__api.G.caught && __api.fall()<0"): return True
    if not await until_alive(P, 6):
        await P.evaluate("()=>window.__net && __net.respawn && __net.respawn()")
        return await until_alive(P, 20)
    return True


def last_preview(log):
    """the server's answer to the last admin death preview (its log line), for a refused preview"""
    try: lines = [l.strip() for l in open(log) if 'preview death' in l]
    except OSError: return ''
    return lines[-1] if lines else ''


def dump(path, obj):
    with open(path, 'w') as f: json.dump(obj, f, indent=1); f.write('\n')
