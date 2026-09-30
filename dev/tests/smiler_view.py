"""Smiler exposure QA (spec 44): put one smiler in view in the dark, freeze the halls so it stays, and photograph it as the stare gets longer.
   python3 smiler_view.py [outdir]     (needs playwright + Pillow)"""
import os, tempfile, sys, asyncio, subprocess, time
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
from PIL import Image
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','8987')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'sview'); os.makedirs(OUT,exist_ok=True)
DARK="""()=>{ const A=__api; for(let y=300;y<6600;y+=48) for(let x=300;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((A.lamps||[]).some(l=>Math.hypot(l.x-x,l.y-y)<900)) continue; if(A.Uc(x,y,0,700)<650) continue; return [x,y]; } return null }"""
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS); c=await b.new_context(viewport={'width':760,'height':520}); A=await c.new_page(); errs=[]
            A.on('pageerror',lambda e:errs.append(str(e)[:300]))
            await A.goto(f'http://localhost:{PORT}/?room=sview'); await A.wait_for_timeout(2200)
            await A.fill('#name','Alice'); await A.evaluate("document.getElementById('enter').click(); window.__net && __net.testAuth && __net.testAuth('smoor')"); await A.wait_for_timeout(5500)
            click=lambda sel: A.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1400)
            await click('[data-a=tab][data-t=monsters]')
            for i in range(4): await click('[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(100)
            for i in range(6): await click('[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(100)
            spot=await A.evaluate(DARK); print('spot',spot)
            await A.evaluate("([x,y])=>{__api.tp(x,y); __api.H.angle=0}",spot); await A.wait_for_timeout(2500)
            await click('[data-c=freeze][data-on="1"]'); await A.wait_for_timeout(500)
            await click('[data-c=near][data-k=smiler]'); await A.wait_for_timeout(1200)
            info=await A.evaluate("()=>{const q=__api.q.filter(o=>o&&!o.off); const o=q[0]; if(!o) return null; const H=__api.H; H.angle=Math.atan2(o.y-H.y,o.x-H.x); const D=Number(window.__sd||230); window.__pin=setInterval(()=>{o.x=H.x+Math.cos(H.angle)*D;o.y=H.y+Math.sin(H.angle)*D;o.face=1;o.state='WATCHING';o.act='watch'},16); return [o.x,o.y,Math.hypot(o.x-H.x,o.y-H.y)]}")
            print('smiler',info)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            shots=[]
            for i in range(12):
                fn=os.path.join(OUT,f's_{i:02d}.jpg'); await A.screenshot(path=fn,type='jpeg',quality=70); shots.append(fn); await A.wait_for_timeout(2500)
            W,H=760,520; sheet=Image.new('RGB',(380*4,260*3))
            for i,fn in enumerate(shots): sheet.paste(Image.open(fn).resize((380,260)),((i%4)*380,(i//4)*260))
            sheet.save(os.path.join(OUT,'sheet_exposure.jpg'),quality=75); print('errors:',errs[:4]); await b.close()
    finally: srv.terminate()
asyncio.run(main())
