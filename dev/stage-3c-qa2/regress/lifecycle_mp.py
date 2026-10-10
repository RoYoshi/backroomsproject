# ADAPTED COPY of dev/tests/lifecycle_mp.py for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
#   - the game folder from the copy's location (or GAME)
#   - a helper that waits for the QA2 boot and passes its ready gate
#   - QA2: the menu (and the name field) is shown only once the boot has finished and the ready gate is passed
"""v22.2 follow-up, in a real browser: the game's own lifecycle buttons still work under the server's lifecycle rules, for an ordinary
   (non-admin) player: NEW RUN from the pause menu (vanish -> run menu -> play again), the start from the title, and - for a player who
   died (the admin DEATHS preview, on a test page with admin authority) - RETRY.  Nobody is corrected or refused along the way.
   python3 lifecycle_mp.py [outdir]   -> prints JSON, exit code 1 on failure"""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.environ.get('GAME') or os.path.join(_HERE,'..','..','..')
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9358')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'lifecycle_mp'); os.makedirs(OUT,exist_ok=True)
HOOK="""(()=>{ window.__tpN=0; const W=window.WebSocket; window.WebSocket=function(u,p){ const ws=new W(u,p); ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t==='tp') window.__tpN++; if(m.t==='s') window.__lastS=m; }catch{} }); return ws; }; window.WebSocket.prototype=W.prototype; })()"""
async def pass_boot(P):
    # QA2: wait for the boot; pass the ready gate with one key press where the browser wants a gesture (as a player would)
    for _ in range(1200):
        st=await P.evaluate("()=>window.__boot?[__boot.state(),!!(window.__ui&&__ui.boot&&__ui.boot().gate)]:'none'")
        if st=='none' or st[0] in ('menu','error','run','playing'): return st
        if st[0]=='ready' and st[1]: await P.keyboard.press('Space')
        await P.wait_for_timeout(100)
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    R={}
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            async def page(name, auth):
                c=await b.new_context(viewport={'width':480,'height':320}); P=await c.new_page(); errs=[]
                P.on('pageerror',lambda e:errs.append(str(e)[:300]))
                await P.add_init_script(HOOK)
                await P.goto(f'http://localhost:{PORT}/?room=life'); await pass_boot(P); await P.wait_for_timeout(2200); await P.fill('#name',name)
                await P.evaluate("document.getElementById('enter').click()" + ("; __net.testAuth('smoor')" if auth else "")); await P.wait_for_timeout(4500); return P,errs
            O,eo=await page('Observer',True)
            P,ep=await page('Player',False)
            me=await P.evaluate("()=>__api.H.id")
            seen=lambda: O.evaluate("(id)=>{const m=window.__lastS; const q=m&&m.p&&m.p.find(o=>o.id===id); return q?[q.x,q.y,q.d]:null}", me)
            local=lambda: P.evaluate("()=>[Math.round(__api.H.x),Math.round(__api.H.y)]")
            R['start']={'client':await local(),'server':await seen()}
            # NEW RUN from the pause menu: Escape -> reset -> the vanish (2.7 s) -> the run menu -> PLAY AGAIN
            await P.keyboard.press('Escape'); await P.wait_for_timeout(400)
            await P.evaluate("()=>document.getElementById('reset').click()"); await P.wait_for_timeout(3600)
            R['menuShown']=await P.evaluate("()=>!document.getElementById('runMenu').hidden")
            R['inWorldWhileInMenu']=await seen()
            await P.evaluate("()=>document.getElementById('playAgain').click()"); await P.wait_for_timeout(2500)
            R['newRun']={'client':await local(),'server':await seen()}
            R['playerCorrections']=await P.evaluate("()=>window.__tpN")
            # RETRY after a death (the observer page dies through the admin DEATHS preview, the real kill path)
            click=lambda sel: O.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await O.keyboard.press('Backquote'); await O.fill('#admPass','smoor'); await O.keyboard.press('Enter'); await O.wait_for_timeout(1000)
            await click('[data-a=tab][data-t=monsters]')
            for i in range(4): await click('[data-c=hounds][data-mode=remove]'); await O.wait_for_timeout(80)
            await click('[data-a=tab][data-t=deaths]'); await O.wait_for_timeout(300); await click('[data-a=place][data-w=open]'); await O.wait_for_timeout(800)
            t0=await O.evaluate("()=>window.__tpN")
            await click('[data-c=preview][data-k=hound][data-var=A]')
            for k in range(40):
                await O.wait_for_timeout(500)
                if await O.evaluate("()=>!document.getElementById('caught').hidden"): break
            R['deathScreen']=await O.evaluate("()=>!document.getElementById('caught').hidden")
            await O.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            await O.evaluate("()=>document.getElementById('retry').click()"); await O.wait_for_timeout(2000)
            oid=await O.evaluate("()=>__api.H.id")
            R['retry']={'client':await O.evaluate("()=>[Math.round(__api.H.x),Math.round(__api.H.y)]"),'server':await P.evaluate("(id)=>{const m=window.__lastS; const q=m&&m.p&&m.p.find(o=>o.id===id); return q?[q.x,q.y,q.d]:null}", oid),'refusals':await O.evaluate("()=>window.__tpN")-t0}
            R['errors']=eo+ep
            await b.close()
    finally: srv.terminate()
    nr=R['newRun']; st=R['start']
    ok=R['menuShown'] and R['inWorldWhileInMenu'] is None and nr['server'] and abs(nr['server'][0]-nr['client'][0])<40 and abs(nr['server'][1]-nr['client'][1])<40 and st['server'] and abs(st['server'][0]-st['client'][0])<40
    rt=R.get('retry') or {}
    ok=ok and R.get('playerCorrections')==0 and R.get('deathScreen') and rt.get('server') and rt['server'][2]==0 and abs(rt['server'][0]-rt['client'][0])<40 and rt.get('refusals')==0 and not R.get('errors')
    R['ok']=bool(ok); print(json.dumps(R)); sys.exit(0 if ok else 1)
asyncio.run(main())
