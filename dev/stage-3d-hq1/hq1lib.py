"""Stage 3D HQ1 - shared helpers for the browser harnesses of the wall-blood and dying-light corrections (development only).

Builds on dev/stage-3d/lib3d.py (server start with a SYNTHETIC admin passcode, joining, the admin panel).  Adds:
  FACE_SPOT   a place to die in front of a papered wall face of a given side (S, N, E, W), lit by a ceiling lamp, with room for the
              hound in front of the victim and the wall 1-2 body lengths behind (the Death Lab's Hound C needs exactly that)
  VIEW_SPOT   where a spectator stands to see that face: in front of it, off to one side, with a clear line of sight to it
  FACES       the remaster's papered wall faces (window.__l0v.surfaces.list), read only
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'stage-3d'))
import lib3d  # noqa: E402
from lib3d import PASS, ARGS, free_port, start_server, stop_server, join, admin_open, admin_cmd, click, aim, until_alive, ensure_alive, dump  # noqa: F401,E402

REPO = lib3d.REPO

# a papered wall face of side `side` with a lamp lighting it; the victim stands `d` px in front of it, facing away from it (outward)
FACE_SPOT = r"""([side, d, skip])=>{ const A=__api, L=window.__l0v; if(!L||!L.surfaces) return null;
  const lamps=A.lamps||[], gl=window.__glitches||[], out=[];
  const faces=L.surfaces.list().filter(f=>f.kind==='wall' && f.side===side && f.length>=192);
  for(const f of faces){ const ox=-f.up[0], oy=-f.up[1], ang=Math.atan2(oy,ox);
    for(let u=72; u<=f.length-72; u+=48){ const wx=f.origin[0]+f.u[0]*u, wy=f.origin[1]+f.u[1]*u, x=wx+ox*d, y=wy+oy*d;
      if(!A.sl(x,y,26) || gl.some(g=>Math.hypot(g.x-x,g.y-y)<260)) continue;
      const back=A.Uc(x,y,ang+Math.PI,220); if(Math.abs(back-d)>3) continue;                 // the wall right behind, at d
      if(A.Uc(x,y,ang,260)<170 || A.Uc(x,y,ang+.5,200)<90 || A.Uc(x,y,ang-.5,200)<90) continue;   // room for the hound and the spectator
      if(A.Uc(x,y,ang+Math.PI/2,200)<110 || A.Uc(x,y,ang-Math.PI/2,200)<110) continue;            // not in a corner
      let lit=null; for(const l of lamps){ const r=Math.hypot(l.x-wx-ox*6,l.y-wy-oy*6); if(r<60||r>260) continue; const a2=Math.atan2(wy+oy*6-l.y,wx+ox*6-l.x); if(A.Uc(l.x,l.y,a2,r+2)>=r-2){ lit={x:l.x,y:l.y,r:Math.round(r)}; break; } }
      if(!lit) continue;
      out.push({face:f.id, side, x:Math.round(x), y:Math.round(y), a:+ang.toFixed(4), wx:Math.round(wx), wy:Math.round(wy), ox, oy, lamp:lit});
    } }
  out.sort((p,q)=>p.lamp.r-q.lamp.r || p.x-q.x || p.y-q.y);                                  // the best lit first
  return out[Math.min(out.length-1, skip||0)] || null }"""

# a spectator for spot S: in front of the face, off to one side, clear, with a line of sight to the victim and to the face
VIEW_SPOT = r"""(S)=>{ const A=__api, tx=-S.oy, ty=S.ox;
  for(const [k,s] of [[230,140],[230,-140],[200,170],[200,-170],[260,90],[260,-90],[180,0],[260,0]]){ const x=S.wx+S.ox*k+tx*s, y=S.wy+S.oy*k+ty*s;
    if(!A.sl(x,y,26)) continue; const dv=Math.hypot(S.x-x,S.y-y), av=Math.atan2(S.y-y,S.x-x); if(A.Uc(x,y,av,dv+2)<dv-4) continue;
    const dw=Math.hypot(S.wx+S.ox*3-x,S.wy+S.oy*3-y), aw=Math.atan2(S.wy+S.oy*3-y,S.wx+S.ox*3-x); if(A.Uc(x,y,aw,dw+2)<dw-6) continue;
    return [Math.round(x),Math.round(y),+av.toFixed(4)] }
  return null }"""

FACES = r"""()=>window.__l0v&&window.__l0v.surfaces?window.__l0v.surfaces.list().filter(f=>f.kind==='wall'):null"""

# the death on this page: its clock and state (the victim's own death class)
DSTATE = "()=>{ const d=__api.death(); return d ? { t:+d.elapsed.toFixed(4), active:d.active, fin:d.finished, dur:d.duration, x:d.body.x, y:d.body.y, corpse:d.corpseId, torch:d.torch?{x:+d.torch.x.toFixed(1),y:+d.torch.y.toFixed(1),a:+(d.torch.angle||0).toFixed(3)}:null } : null }"
# the replays on this page (a spectator)
SPEC = "()=>(window.__fxs||[]).filter(f=>f.jl).map(f=>({ id:f.id, de:f.de, t:+f.jl.elapsed.toFixed(3), fin:f.jl.finished, lo:f.lo }))"
# the corpses on this page
BODIES = "()=>(__api.bodyList?__api.bodyList():[]).filter(b=>b.cause!=='Vanish').map(b=>({ id:String(b.id), owner:String(b.ownerId), remote:!!b.remote, de:b.de, x:Math.round(b.x), y:Math.round(b.y), lo:b.lo, lf:b.lf||null, marks:(b.blood||[]).filter(q=>q.seed>=512&&q.seed<544).map(q=>[Math.round(q.x),Math.round(q.y),q.seed]) }))"
# the light sources this page hands to its lighting (window.__peerLights), rounded
PEERS = "()=>(window.__peerLights||[]).map(p=>({ x:Math.round(p.x), y:Math.round(p.y), kind:p.kind, on:!!p.on, dead:!!p.dead, pw:p.pw==null?null:+(+p.pw).toFixed(4) }))"


async def lab(P, on=True, paused=False, speed=1):
    """the Death Lab clock on this page (presentation only)"""
    await P.evaluate("([on,paused,speed])=>{window.__dlab=Object.assign(window.__dlab||{},{on,paused,speed,step:0,xray:false,viz:false})}", [on, paused, speed])


async def preview(P, kind, var, timeout=20):
    """play one Death Lab death on this (admin) page; returns when the victim's death has started (or False)"""
    import time
    if await P.evaluate("()=>document.getElementById('adminPanel').hidden"): await P.keyboard.press('Backquote'); await P.wait_for_timeout(300)
    await click(P, '[data-a=tab][data-t=deaths]'); await P.wait_for_timeout(250)
    s0 = await P.evaluate("()=>__api.death().startAt")
    await click(P, f'[data-c=preview][data-k={kind}][data-var={var}]')
    t0 = time.time()
    while time.time() - t0 < timeout:
        if await P.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s", s0):
            await P.evaluate("()=>{document.getElementById('adminPanel').hidden=true}"); return True
        await P.wait_for_timeout(50)
    await P.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
    return False


async def auto_revive(P, want):
    """the Death Lab's AUTO-REVIVE toggle (its own button) to `want`"""
    if await P.evaluate("()=>document.getElementById('adminPanel').hidden"): await P.keyboard.press('Backquote'); await P.wait_for_timeout(300)
    await click(P, '[data-a=tab][data-t=deaths]'); await P.wait_for_timeout(250)
    on = await P.evaluate("()=>{const b=document.querySelector('#adminPanel [data-a=opt][data-o=auto]'); return b?b.classList.contains('on')||b.getAttribute('aria-pressed')==='true':null}")
    if on is not None and bool(on) != bool(want): await click(P, '[data-a=opt][data-o=auto]'); await P.wait_for_timeout(200)
    await P.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
    return on


async def place(P, x, y, a, w, h, tries=4):
    """teleport this page's player (its own client; the server follows its reports) and aim; checked, and repeated if something
    (the fall into the level, the server's spawn) moved it again"""
    for _ in range(tries):
        await P.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", [x, y, a]); await aim(P, a, w, h)
        await P.wait_for_timeout(600)
        if await P.evaluate("([x,y])=>Math.hypot(__api.H.x-x,__api.H.y-y)<30", [x, y]): return True
        await P.wait_for_timeout(900)
    return False


async def prejoin(ctx, port, room, name, errs, query=''):
    """a page loaded and at the name prompt (PLAY chosen, name typed), not yet in the room: enter() puts it in at a chosen moment"""
    P = await ctx.new_page()
    P.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    P.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
    await P.goto(f'http://127.0.0.1:{port}/?room={room}{query}', timeout=90000)
    await P.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000); await P.wait_for_timeout(1200)
    if await P.evaluate("()=>!!(window.__ui && window.__ui.version)"):
        await P.evaluate("()=>window.__ui.go('play')"); await P.wait_for_selector('#name', state='visible', timeout=30000)
    await P.fill('#name', name)
    return P


async def enter(P):
    """press ENTER on a prejoin()ed page; returns once it is in the room and connected"""
    await P.click('#enter')
    for _ in range(150):
        if await P.evaluate("()=>!!(window.__api && __api.started() && !document.getElementById('hud').hidden)"): break
        await P.wait_for_timeout(100)
    for _ in range(100):
        if await P.evaluate("()=>!!(window.__net && window.__net.on !== false)"): break
        await P.wait_for_timeout(100)
    await P.evaluate("p=>{window.__net && __net.testAuth && __net.testAuth(p)}", PASS)   # (as lib3d.join: the test's teleports are an admin's, else the server's movement checks undo them)
    for _ in range(100):                                                   # the fall into the level is over (a teleport during it does not stick)
        if await P.evaluate("()=>__api.fall()<0"): break
        await P.wait_for_timeout(100)
    return P


async def step_to(P, getter, T):
    """with the Death Lab paused on this page, step its death (or replay) clock to T seconds (presentation only)"""
    st = await P.evaluate(getter)
    if isinstance(st, list): st = st[0] if st else None
    if st:
        n = max(0, round((T - st['t']) * 60))
        if n: await P.evaluate("n=>{window.__dlab.step=n}", n); await P.wait_for_timeout(250)
    return st

