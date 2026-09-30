"""Part 1C browser check: launch with no errors, the SEARCH + MEMORY and CRAWLSPACES debug layers, a hunt that loses the player.
   python3 chase_mp.py [outdir]   -> prints JSON; writes crawl_overlay.jpg (crawlspaces + the selected hound's search/memory layer) and chase_overlay.jpg"""
import os, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9352')); OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/chase_mp'; os.makedirs(OUT,exist_ok=True)
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    R={}
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            c=await b.new_context(viewport={'width':900,'height':600}); A=await c.new_page(); errs=[]
            A.on('pageerror',lambda e:errs.append(str(e)[:300])); A.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'favicon' not in m.text else None)
            await A.goto(f'http://localhost:{PORT}/?room=chase'); await A.wait_for_timeout(2200); await A.fill('#name','Alice'); await A.evaluate("document.getElementById('enter').click()"); await A.wait_for_timeout(5000)
            click=lambda sel: A.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1200)
            await click('[data-a=tab][data-t=monsters]')
            for i in range(4): await click('[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(80)
            for i in range(6): await click('[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(80)
            await A.evaluate("()=>{__api.H.god=true}")
            await click('[data-a=tab][data-t=debug]'); await A.wait_for_timeout(300)
            await click('[data-a=dbg]'); await A.wait_for_timeout(600)
            R['crawlBtn']=await click('[data-a=place][data-w=crawl]'); await A.wait_for_timeout(300)
            R['placed']=await A.evaluate("()=>document.getElementById('admStatus').textContent")
            for l in ('search','crawl'): R['lay_'+l]=await click(f'[data-a=lay][data-l={l}]'); await A.wait_for_timeout(120)
            await click('[data-a=tab][data-t=monsters]'); await A.wait_for_timeout(200)
            await click('[data-c=near][data-k=hound]'); await A.wait_for_timeout(1200)
            await click('[data-a=tab][data-t=debug]'); await A.wait_for_timeout(200)
            await click('[data-a=navsel][data-v=near]'); await A.wait_for_timeout(300)
            await click('[data-c=nav][data-cmd=hunt]'); await A.wait_for_timeout(1500)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}"); await A.wait_for_timeout(300)
            await A.screenshot(path=os.path.join(OUT,'crawl_overlay.jpg'),type='jpeg',quality=72)
            hx=await A.evaluate("()=>{ const d=(__ents.dbg||[]).find(q=>q.i===__ents.navSel); return d&&[d.x,d.y] }")
            if hx: await A.evaluate("([x,y])=>{__api.tp(x+420,y)}",hx); await A.wait_for_timeout(700)
            await A.screenshot(path=os.path.join(OUT,'chase_overlay.jpg'),type='jpeg',quality=72)
            R['errors']=errs
            await b.close()
    finally: srv.terminate()
    print(json.dumps(R))
asyncio.run(main())
