"""Part 1B browser check: launch, the navigation debug overlay / commands, and how evenly a remote client draws a moving hound.
   python3 nav_mp.py [outdir]    -> prints JSON; writes nav_overlay.jpg
   Alice (admin) summons a hound from across the level; Bob, a second client, records where he draws it every animation frame.
   Evenness = how much the drawn speed varies frame to frame while the hound runs (lower is smoother; server-side speed is nearly constant)."""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9350')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'nav_mp'); os.makedirs(OUT,exist_ok=True)
REC="""(ms)=>new Promise(res=>{ const out=[]; const t0=performance.now(); const f=()=>{ const v=__api.layer().children.filter(c=>c.__hound&&c.visible&&c.g); if(v.length) out.push([performance.now(), v[0].x, v[0].y, v[0].rotation]); if(performance.now()-t0<ms) requestAnimationFrame(f); else res(out) }; requestAnimationFrame(f) })"""
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    R={}
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            async def join(name):
                c=await b.new_context(viewport={'width':760,'height':520}); P=await c.new_page(); errs=[]
                P.on('pageerror',lambda e:errs.append(str(e)[:300])); P.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'favicon' not in m.text else None)
                await P.goto(f'http://localhost:{PORT}/?room=nav'); await P.wait_for_timeout(2200); await P.fill('#name',name); await P.evaluate("document.getElementById('enter').click(); window.__net && __net.testAuth && __net.testAuth('smoor')"); await P.wait_for_timeout(5000); return P,errs
            A,ea=await join('Alice'); B,eb=await join('Bob')
            click=lambda P,sel: P.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1200)
            await click(A,'[data-a=tab][data-t=monsters]')
            for i in range(4): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(80)
            for i in range(6): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(80)
            await A.evaluate("()=>{__api.H.god=true}"); await B.evaluate("()=>{__api.H.god=true}")
            await click(A,'[data-c=near][data-k=hound]'); await A.wait_for_timeout(1500)
            me=await A.evaluate("()=>[__api.H.x,__api.H.y]")
            # Bob stands beside Alice; the hound is summoned toward Alice from where it is -> it runs to her
            await B.evaluate("([x,y])=>{__api.tp(x+60,y+40)}",me); await B.wait_for_timeout(1500)
            await A.evaluate("()=>{ const L=__api.lamps; }")
            # take Alice (and Bob) far away first, then summon: a long run to record
            far=await A.evaluate("""()=>{ const A=__api, H=A.H; for(let R=900;R<2600;R+=100) for(let k=0;k<24;k++){ const a=k/24*6.283, x=H.x+Math.cos(a)*R, y=H.y+Math.sin(a)*R; if(A.sl(x,y,30)) return [x,y]; } return null }""")
            await A.evaluate("([x,y])=>{__api.tp(x,y)}",far); await B.evaluate("([x,y])=>{__api.tp(x+60,y+40)}",far); await A.wait_for_timeout(1500)
            ok=await click(A,'[data-c=summon]')
            recB=asyncio.ensure_future(B.evaluate(REC,6000)); recA=asyncio.ensure_future(A.evaluate(REC,6000))
            rb=await recB; ra=await recA
            def evenness(rec):
                sp=[]
                for i in range(1,len(rec)):
                    dt=(rec[i][0]-rec[i-1][0])/1000
                    if dt<=0: continue
                    sp.append(((rec[i][1]-rec[i-1][1])**2+(rec[i][2]-rec[i-1][2])**2)**.5/dt)
                run=[v for v in sp if v>80]                                    # frames where it is actually running
                if len(run)<10: return {'frames':len(sp),'running':len(run)}
                m=sum(run)/len(run); var=(sum((v-m)**2 for v in run)/len(run))**.5
                jerk=sum(abs(run[i]-run[i-1]) for i in range(1,len(run)))/(len(run)-1)
                return {'frames':len(sp),'running':len(run),'meanSpeed':round(m),'cv':round(var/m,3),'meanFrameToFrameChange':round(jerk),'maxFrameStep':round(max(sp)/60,1)}
            R['summon']=ok; R['bob']=evenness(rb); R['alice']=evenness(ra)
            # navigation overlay + commands (DEBUG tab)
            if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
            await click(A,'[data-a=tab][data-t=debug]'); await A.wait_for_timeout(300)
            await click(A,'[data-a=dbg]'); await A.wait_for_timeout(1500)
            for l in ('nav','col','grid','links'): await click(A,f'[data-a=lay][data-l={l}]'); await A.wait_for_timeout(120)
            await click(A,'[data-a=navsel][data-v=near]'); await A.wait_for_timeout(300)
            sel=await A.evaluate("()=>window.__ents&&__ents.navSel")
            await click(A,'[data-c=nav][data-cmd=follow]'); await A.wait_for_timeout(1500)
            st=await A.evaluate("()=>document.getElementById('admStatus').textContent")
            nv=await A.evaluate("()=>{ const d=(__ents.dbg||[]).find(q=>q.i===__ents.navSel); return d&&d.nv }")
            await click(A,'[data-c=nav][data-cmd=repath]'); await A.wait_for_timeout(900)
            st2=await A.evaluate("()=>document.getElementById('admStatus').textContent")
            nv2=await A.evaluate("()=>{ const d=(__ents.dbg||[]).find(q=>q.i===__ents.navSel); return d&&d.nv&&d.nv.why }")
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}"); await A.wait_for_timeout(400)
            await A.screenshot(path=os.path.join(OUT,'nav_overlay.jpg'),type='jpeg',quality=72)
            R['overlay']={'selected':sel,'status':st,'nv':nv and {k:nv[k] for k in ('sp','dir','why','caps','rc','r','go')},'afterRepath':st2,'why':nv2}
            R['errors']=ea+eb
            await b.close()
    finally: srv.terminate()
    print(json.dumps(R))
asyncio.run(main())
