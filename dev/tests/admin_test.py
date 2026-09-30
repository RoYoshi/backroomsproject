"""Admin panel v2 + death preview + pause fix, in two real browser pages against the real server.  python3 admin_test.py [frames]
   (needs: pip install playwright; playwright install chromium; and Pillow for the optional contact sheets)"""
import os
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
import asyncio, subprocess, time, sys, json, tempfile
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=8981
OUT=os.environ.get('ADMIN_TEST_OUT') or tempfile.mkdtemp(prefix='admin_test_')
FRAMES = len(sys.argv)>1 and sys.argv[1]=='frames'
results=[]
def check(name, ok, note=''):
    results.append((name,bool(ok),note)); print(('PASS ' if ok else 'FAIL ')+name+(('  - '+note) if note else ''), flush=True)

async def enter(b,name,room):
    c=await b.new_context(viewport={'width':720,'height':460}); pg=await c.new_page(); pg.errs=[]
    pg.on('pageerror',lambda e:pg.errs.append(str(e)[:200]))
    pg.on('console',lambda m:pg.errs.append('console.error: '+m.text[:160]) if m.type=='error' and 'favicon' not in m.text else None)
    pg.on('dialog',lambda d:asyncio.ensure_future(d.accept()))
    await pg.goto(f'http://localhost:{PORT}/?room={room}'); await pg.wait_for_timeout(2200)
    await pg.fill('#name',name); await pg.evaluate("document.getElementById('enter').click()"); await pg.wait_for_timeout(1500)
    await pg.evaluate("""()=>{ Object.defineProperty(window,'__kill',{configurable:true,get(){return this.__kv||null},set(v){this.__kv=v; if(v) window.__killLog=(window.__killLog||[]).concat([{v:v.v,k:v.k,w:v.w?1:0}])}}) }""")   # the game consumes the record when the death starts: keep a copy
    return pg

async def until(pg, js, timeout=15, step=.25):
    t0=time.time()
    while time.time()-t0<timeout:
        v=await pg.evaluate(js)
        if v: return v
        await pg.wait_for_timeout(int(step*1000))
    return None

WALL_SPOT="""()=>{ const A=__api; for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((window.__glitches||[]).some(g=>Math.hypot(g.x-x,g.y-y)<260)) continue;
  for(let i=0;i<8;i++){ const a=i/8*Math.PI*2, d=A.Uc(x,y,a,240); if(d>72&&d<108&&A.Uc(x,y,a+.5,240)>60&&A.Uc(x,y,a-.5,240)>60&&A.Uc(x,y,a+Math.PI,240)>150) return [x,y,a+Math.PI]; } } return null }"""
STATE="""()=>{ const A=__api, d=A.death?A.death():null; return {caught:!!A.G.caught, fin:!!(d&&d.finished), paused:A.paused(), x:Math.round(A.H.x), y:Math.round(A.H.y), fall:A.fall(), v:((window.__killLog||[]).slice(-1)[0]||{}).v||null, k:((window.__killLog||[]).slice(-1)[0]||{}).k||null, wall:((window.__killLog||[]).slice(-1)[0]||{}).w||0, n:(window.__killLog||[]).length} }"""

async def main():
    subprocess.run(['fuser','-k',f'{PORT}/tcp'],stderr=subprocess.DEVNULL)
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            A=await enter(b,'Alice','adm'); B=await enter(b,'Bob','adm')
            await A.wait_for_timeout(4200)                                              # the fall-in
            click=lambda pg,sel: pg.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            status=lambda: A.evaluate("()=>document.getElementById('admStatus').textContent")
            async def said(word, timeout=6):
                t0=time.time()
                while time.time()-t0<timeout:
                    s_=await status()
                    if word in s_: return s_
                    await A.wait_for_timeout(150)
                return await status()
            cnt=lambda: A.evaluate("()=>document.querySelectorAll('.adm-ent').length")
            # ---------- 1. unlock, tabs
            check('N0 ordinary players have no admin data: Bob\'s panel stays locked', not await B.evaluate("()=>{const p=document.getElementById('adminPanel'); return p && !document.getElementById('admMain').hidden}"))
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1400)
            check('T1 the panel unlocks and shows five tabs', await A.evaluate("()=>[...document.querySelectorAll('.adm-tab')].map(e=>e.textContent).join(',')")=='PLAYERS,MONSTERS,DEATHS,WORLD,DEBUG')
            for tab in ['players','monsters','deaths','world','debug']:
                await click(A,f'[data-a=tab][data-t={tab}]'); await A.wait_for_timeout(500)
                n=await A.evaluate("()=>document.getElementById('admBody').children.length")
                check(f'T1 tab {tab.upper()} renders', n>=3, f'{n} blocks')
            await click(A,'[data-a=tab][data-t=players]'); await A.wait_for_timeout(700)
            names=await A.evaluate("()=>[...document.querySelectorAll('.adm-player b')].map(e=>e.textContent).sort().join(',')")
            live=await A.evaluate("()=>[...document.querySelectorAll('[data-live]')].map(e=>e.textContent)")
            check('T2 players tab lists both wanderers with a live state/position line', names=='Alice,Bob' and len(live)==2 and all(',' in t for t in live), f'{names} {live}')
            # live text is patched in place: the buttons are never rebuilt under the mouse
            tag=await A.evaluate("()=>{const b=document.querySelector('.adm-player button'); b.setAttribute('data-probe','1'); return 1}"); await A.evaluate("()=>__api.tp(4300,3504)"); await A.wait_for_timeout(900)
            check('T2 …and updates without rebuilding the buttons', await A.evaluate("()=>!!document.querySelector('.adm-player button[data-probe]')"))
            # ---------- 2. monsters tab + clear the halls so nothing interferes
            await click(A,'[data-a=tab][data-t=monsters]'); await A.wait_for_timeout(500)
            n0=await A.evaluate("()=>document.querySelectorAll('.adm-ent').length")
            check('T3 monsters tab lists the entities', n0>=3, f'{n0} entities')
            for i in range(4): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(100)
            for i in range(6): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(100)
            await A.wait_for_timeout(900)
            n1=await A.evaluate("()=>document.querySelectorAll('.adm-ent').length")
            check('T3 removing monsters works and the list follows', n1==0, f'{n0} -> {n1}; status "{await status()}"')
            await click(A,'[data-c=near][data-k=hound]'); m_=await said('PLACED')
            check('T3 the status line answers a command', 'HOUND PLACED' in m_, m_)
            await until(A,"()=>document.querySelectorAll('.adm-ent').length>=1"); c1=await cnt()
            await click(A,'[data-c=entdel]'); m2=await said('REMOVED'); await A.wait_for_timeout(800)
            check('T3 an entity can be removed from the list', c1>=1 and await cnt()==c1-1 and 'REMOVED' in m2, f'{c1} -> {await cnt()}; {m2}')
            # ---------- 3. capture style
            await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(400)
            await click(A,'[data-c=capmode][data-mode=play]'); m_=await said('PLAY'); await A.wait_for_timeout(600)
            on=await A.evaluate("()=>document.querySelector('[data-c=capmode].on').dataset.mode")
            check('T4 capture style: PLAY is applied and shown', on=='play' and 'PLAY' in m_, f'{on}; {m_}')
            await click(A,'[data-c=capmode][data-mode=auto]'); await said('AUTO'); await A.wait_for_timeout(600)
            check('T4 …and AUTO comes back', await A.evaluate("()=>document.querySelector('[data-c=capmode].on').dataset.mode")=='auto')
            # ---------- 4. every death, through the panel
            spot=await A.evaluate(WALL_SPOT)
            plan=[('hound','A'),('hound','B'),('hound','C'),('hound','D'),('smiler','A'),('smiler','B'),('smiler','C'),('smiler','D')]
            frames_for={'hound C','smiler B','smiler C','hound A'} if FRAMES else set()
            for kind,v in plan:
                if kind=='hound' and v=='C' and spot:
                    await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}",spot)
                else:
                    await A.evaluate("()=>{__api.tp(5200,3504); __api.H.angle=Math.PI}")
                await B.evaluate("()=>{__api.tp(5560,3504); __api.H.angle=Math.PI}") if not (kind=='hound' and v=='C') else await B.evaluate("([x,y])=>{__api.tp(x+300,y+0)}",spot or [5560,3504])
                await A.wait_for_timeout(3600)                                           # spawn protection (3 s) and settling; the preview does not need it, but we want a clean start
                await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
                if not await A.evaluate("()=>!document.getElementById('adminPanel').hidden"):
                    await A.keyboard.press('Backquote'); await A.wait_for_timeout(300); await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
                before=await A.evaluate(STATE)
                await B.evaluate("()=>{window.__seenFx=new Set(); clearInterval(window.__fxT); for(const f of (window.__fxs||[])) f.__old=1; window.__fxT=setInterval(()=>{for(const f of (window.__fxs||[])) if(f.jl&&!f.__old) window.__seenFx.add(f.jl.variant+'/'+f.cause)},100)}")
                await A.evaluate("()=>{window.__killLog=[]; window.__finSeen=false; clearInterval(window.__finT); window.__finT=setInterval(()=>{const d=__api.death&&__api.death(); if(__api.G.caught&&d&&d.finished) window.__finSeen=true},100)}")
                await click(A,f'[data-c=preview][data-k={kind}][data-var={v}]')
                t0=time.time(); st=None; shots=[]
                while time.time()-t0<9:
                    st=await A.evaluate(STATE)
                    if st['caught'] and st['v']:
                        break
                    await A.wait_for_timeout(120)
                started=bool(st and st['caught']); rec=st
                if started and f'{kind} {v}' in frames_for:
                    pass
                if started and f'{kind} {v}' in frames_for:
                    for i in range(6):
                        fn=os.path.join(OUT,f'd_{kind}{v}_{i}.jpg'); await A.screenshot(path=fn,type='jpeg',quality=55); shots.append(fn); await A.wait_for_timeout(250)
                fin=await until(A,"()=>window.__finSeen",timeout=35)
                st2=await A.evaluate(STATE); seen=await B.evaluate("()=>[...window.__seenFx]")
                panel_closed=await A.evaluate("()=>document.getElementById('adminPanel').hidden")
                check(f'T5 {kind} {v}: the death starts on the victim\'s screen with the variant asked for', started and rec['v']==v and rec['k']==kind.capitalize(), f'started={started} record={rec["v"]}/{rec["k"]} wall={rec["wall"]} panel closed={panel_closed}')
                check(f'T5 {kind} {v}: it plays out to the end', bool(fin))
                check(f'T5 {kind} {v}: the other player sees the same death replay', any(s.startswith(v+'/') for s in seen), str(seen))
                # auto-revive + back to the spot
                back=await until(A,"()=>!__api.G.caught && __api.fall()<0",timeout=40)
                await A.wait_for_timeout(1200); st3=await A.evaluate(STATE)
                px,py=(spot[0],spot[1]) if (kind=='hound' and v=='C' and spot) else (5200,3504)
                check(f'T5 {kind} {v}: auto-revive, then back to where it happened', bool(back) and abs(st3['x']-px)<40 and abs(st3['y']-py)<40, f'alive={bool(back)} at {st3["x"]},{st3["y"]} (wanted {px},{py})')
            # ---------- 5. refusal is explained (hound C in the open corridor)
            open_spot=await A.evaluate("""()=>{ const A=__api; for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((window.__glitches||[]).some(g=>Math.hypot(g.x-x,g.y-y)<260)) continue; let ok=true; for(let i=0;i<8;i++){ if(A.Uc(x,y,i/8*Math.PI*2,240)<200){ok=false;break} } if(ok) return [x,y]; } return null }""")
            await A.evaluate("([x,y])=>{__api.tp(x,y); __api.H.angle=0}",open_spot or [5200,3504]); await A.wait_for_timeout(3600)
            await A.keyboard.press('Backquote') if await A.evaluate("()=>document.getElementById('adminPanel').hidden") else None
            await A.wait_for_timeout(300); await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
            await click(A,'[data-c=preview][data-k=hound][data-var=C]'); await A.wait_for_timeout(900)
            msg=await status(); bad=await A.evaluate("()=>document.getElementById('admStatus').classList.contains('bad')")
            check('T6 a preview that cannot be done says why and changes nothing', bad and 'WALL' in msg and not (await A.evaluate(STATE))['caught'], msg)
            # ---------- 6. the pause fix
            await until(A,"()=>!__api.G.caught && __api.fall()<0",timeout=30)
            await click(A,'[data-a=tab][data-t=deaths]')
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=false}")
            await A.keyboard.press('Escape') if False else await A.evaluate("()=>document.getElementById('help').click()")            # the game's own pause button
            await A.wait_for_timeout(500)
            paused=await A.evaluate("()=>[__api.paused(), !document.getElementById('dialog').hidden]")
            await click(A,'[data-c=preview][data-k=hound][data-var=A]')                                                             # a kill arrives while the pause screen is up
            t0=time.time(); ok=False
            while time.time()-t0<6:
                s=await A.evaluate("()=>[__api.paused(), !document.getElementById('dialog').hidden, !!__api.G.caught]")
                if s[2]: ok=True; break
                await A.wait_for_timeout(100)
            check('T7 pause fix: a kill that lands while paused closes the pause screen and starts the death at once', paused==[True,True] and ok and s==[False,False,True], f'before {paused}, after {s}, after {time.time()-t0:.1f}s')
            await until(A,"()=>__api.G.caught && __api.death().finished",timeout=35); await until(A,"()=>!__api.G.caught && __api.fall()<0",timeout=40)
            # ---------- 7. debug mode
            await A.wait_for_timeout(3600)
            if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
            await click(A,'[data-c=near][data-k=hound]'); await click(A,'[data-c=near][data-k=smiler]'); await A.wait_for_timeout(500)
            await click(A,'[data-a=tab][data-t=debug]'); await A.wait_for_timeout(300); await click(A,'[data-a=dbg]'); await A.wait_for_timeout(3500)
            dbg=await A.evaluate("""()=>{const c=document.getElementById('aiDebug'); if(!c) return null; const x=c.getContext('2d'); const d=x.getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; const E=__ents; return {shown:c.style.display, painted:n, pf:!!E.dbgX.pf, ping:E.dbgX.ping, log:E.dbgX.lg.length, ents:(E.dbg||[]).length, fps:Math.round(E.fps)}}""")
            check('T8 debug mode: overlay on, entity data, server timings, event log and ping arrive', dbg and dbg['shown']=='block' and dbg['painted']>2000 and dbg['pf'] and dbg['ents']>=2 and dbg['log']>=1 and dbg['ping']>=0, json.dumps(dbg))
            await A.screenshot(path=os.path.join(OUT,'debug_on.png'))
            bobc=await B.evaluate("()=>{const c=document.getElementById('aiDebug'); return !c || c.style.display==='none'}")
            check('T8 …and only the admin gets it: Bob has no overlay', bobc)
            await click(A,'[data-a=lay][data-l=ai]'); await click(A,'[data-a=lay][data-l=srv]'); await click(A,'[data-a=lay][data-l=log]'); await click(A,'[data-a=lay][data-l=you]'); await A.wait_for_timeout(600)
            painted2=await A.evaluate("""()=>{const c=document.getElementById('aiDebug'); const x=c.getContext('2d'); const d=x.getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n}""")
            check('T8 layers switch off one by one (only the title bar is left)', painted2<dbg['painted']*.2, f'{dbg["painted"]} -> {painted2} px')
            for l in ['ai','srv','log','you']: await click(A,f'[data-a=lay][data-l={l}]')
            await click(A,'[data-a=copy]'); await A.wait_for_timeout(700)
            check('T8 COPY REPORT answers in the status line', 'REPORT' in await status() or 'CLIPBOARD' in await status(), await status())
            await click(A,'[data-a=dbg]'); await A.wait_for_timeout(1500)
            off=await A.evaluate("()=>{const c=document.getElementById('aiDebug'); return !c || c.style.display==='none'}")
            check('T8 debug mode off hides the overlay', off)
            # ---------- 8. dock + remembered tab
            await click(A,'[data-a=dock]'); await A.wait_for_timeout(300)
            check('T9 the panel can be docked to the other side', await A.evaluate("()=>document.getElementById('adminPanel').classList.contains('right')"))
            errs=A.errs+B.errs
            errs=[e for e in errs if 'ERR_TUNNEL' not in e]   # sandbox blocks outside hosts (fonts), not a game error
            check('T10 no script errors on either page', not errs, str(errs[:3]))
            await b.close()
    finally:
        srv.terminate()
    bad=[r for r in results if not r[1]]
    print(f'\n{len(results)-len(bad)}/{len(results)} checks passed'+(' - RESULT OK' if not bad else ' - FAILED: '+'; '.join(r[0] for r in bad)))
    print('output folder:',OUT)
    sys.exit(1 if bad else 0)
asyncio.run(main())
