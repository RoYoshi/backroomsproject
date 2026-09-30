"""Kill commitment, live: Alice is killed by a hound (death lab preview, real kill path) while Bob stands close by and watches.
   Records, every 200 ms for 9 s: where Bob sees the real hound (its view, when visible), the death-replay attacker, and the server's hound.
   python3 commit_mp.py [outdir]"""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9330')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'commit_mp'); os.makedirs(OUT,exist_ok=True)
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            async def join(name):
                c=await b.new_context(viewport={'width':640,'height':440}); P=await c.new_page(); errs=[]; P.on('pageerror',lambda e:errs.append(str(e)[:300]))
                await P.goto(f'http://localhost:{PORT}/?room=commit'); await P.wait_for_timeout(2200); await P.fill('#name',name); await P.evaluate("document.getElementById('enter').click(); window.__net && __net.testAuth && __net.testAuth('smoor')"); await P.wait_for_timeout(5000); return P,errs
            A,ea=await join('Alice'); B,eb=await join('Bob')
            click=lambda P,sel: P.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1200)
            await click(A,'[data-a=tab][data-t=monsters]')
            for i in range(4): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(80)
            for i in range(6): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(80)
            await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
            await click(A,'[data-a=place][data-w=open]'); await A.wait_for_timeout(2500)
            me=await A.evaluate("()=>[__api.H.x,__api.H.y]"); await B.evaluate("([x,y])=>{__api.tp(x+170,y+60); __api.H.god=true}",me); await B.wait_for_timeout(2500)
            await click(A,'[data-c=preview][data-k=hound][data-var=D]')
            REC="""()=>{ window.__rec=[]; const t0=performance.now(); window.__ri=setInterval(()=>{ const vs=__api.layer().children.filter(c=>c.__hound&&c.g&&c.visible&&c.alpha>.05).map(c=>[Math.round(c.x),Math.round(c.y)]);
                 const hs=(window.__hounds||[]).filter(Boolean).map(o=>[Math.round(o.x),Math.round(o.y)]); const d=__api.death(), f=window.__fxKill&&window.__fxKill.size>0;
                 window.__rec.push({t:+((performance.now()-t0)/1e3).toFixed(2),vs,hs,act:d.active,fx:f,at:[Math.round(d.attacker.x),Math.round(d.attacker.y)]}) },100) }"""
            await B.evaluate(REC); await A.evaluate(REC)
            await click(A,'[data-c=preview][data-k=hound][data-var=D]')
            await B.wait_for_timeout(12000)
            rb=await B.evaluate("()=>{clearInterval(window.__ri); return window.__rec}"); ra=await A.evaluate("()=>{clearInterval(window.__ri); return window.__rec}")
            rec={'bob':rb,'alice':ra}
            json.dump(rec,open(os.path.join(OUT,'track.json'),'w'))
            da=[r for r in ra if r['act']]; endat=da[-1]['at'] if da else None; tA0=da[0]['t'] if da else 0; tA1=da[-1]['t'] if da else 0
            fxb=[r for r in rb if r['fx']]; fx0=fxb[0]['t'] if fxb else None; fx1=fxb[-1]['t'] if fxb else None
            start=next((r['hs'][0] for r in rb if fx0 is not None and r['t']>=fx0 and r['hs']),None)
            d=lambda a,b: ((a[0]-b[0])**2+(a[1]-b[1])**2)**.5
            moved=max((d(r['hs'][0],start) for r in fxb if r['hs'] and start),default=0)
            seen=[r for r in fxb if r['vs']]
            after=[r for r in rb if fx1 is not None and r['t']>fx1 and r['vs']]
            gap=d(after[0]['vs'][0],endat) if after and endat else None
            print(json.dumps({'aliceDeathSamples':len(da),'bobFxSamples':len(fxb),'fxLen':round((fx1 or 0)-(fx0 or 0),2),'serverHoundMaxMoveDuringFx':round(moved,1),'bobSawRealHoundDuringFx':len(seen),'animEnd':endat,'bobFirstRealViewAfter':after[0]['vs'] if after else None,'gap':gap,'errors':ea+eb}))
            await b.close()
    finally: srv.terminate()
asyncio.run(main())
