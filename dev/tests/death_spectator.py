"""Remote-spectator check: Alice is killed (admin death preview, real kill path); Bob, standing near, watches the replay of the same death.
   python3 death_spectator.py [outdir] [kind-variant e.g. hound-A]   -> sheet_spectator_<kind><V>.jpg (top: Alice's own view, bottom: Bob's)"""
import os, sys, asyncio, subprocess, time
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
from PIL import Image
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9150')); OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/spec'; WHICH=sys.argv[2] if len(sys.argv)>2 else 'hound-A'; os.makedirs(OUT,exist_ok=True)
kind,var=WHICH.split('-')
OPEN="""()=>{ const A=__api; for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((window.__glitches||[]).some(g=>Math.hypot(g.x-x,g.y-y)<260)||(A.lamps||[]).some(l=>Math.hypot(l.x-x,l.y-y)<700)) continue; let ok=true; for(let i=0;i<8;i++) if(A.Uc(x,y,i/8*6.283,300)<280){ok=false;break} if(ok) return [x,y]; } return null }"""
async def join(c,name):
    P=await c.new_page(); errs=[]; P.on('pageerror',lambda e:errs.append(str(e)[:300]))
    await P.goto(f'http://localhost:{PORT}/?room=spec'); await P.wait_for_timeout(2200)
    await P.fill('#name',name); await P.evaluate("document.getElementById('enter').click()"); await P.wait_for_timeout(5500); return P,errs
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS); c1=await b.new_context(viewport={'width':760,'height':520}); c2=await b.new_context(viewport={'width':760,'height':520})
            A,e1=await join(c1,'Alice'); B,e2=await join(c2,'Bob')
            click=lambda P,sel: P.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1400)
            await click(A,'[data-a=tab][data-t=monsters]')
            for i in range(4): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(100)
            for i in range(6): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(100)
            spot=await A.evaluate(OPEN); print('spot',spot)
            await A.evaluate("([x,y])=>{__api.tp(x,y); __api.H.angle=Math.PI}",spot); await B.evaluate("([x,y])=>{__api.tp(x+150,y+40); __api.H.angle=Math.PI}",spot); await A.wait_for_timeout(3500)
            await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(400)
            await A.evaluate("()=>{window.__dlab={on:true,paused:true,speed:1,step:0}}"); await B.evaluate("()=>{window.__dlab={on:true,paused:true,speed:1,step:0}}")
            s0=await A.evaluate("()=>__api.death().startAt"); await click(A,f'[data-c=preview][data-k={kind}][data-var={var}]')
            t0=time.time()
            while time.time()-t0<12 and not await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s",s0): await A.wait_for_timeout(100)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            fa=[];fb=[]
            for n in range(24):
                for P in (A,B): await P.evaluate("()=>{window.__dlab.step=12}")
                await A.wait_for_timeout(260)
                fa.append(os.path.join(OUT,f'a{n:02d}.jpg')); fb.append(os.path.join(OUT,f'b{n:02d}.jpg'))
                await A.screenshot(path=fa[-1],type='jpeg',quality=60); await B.screenshot(path=fb[-1],type='jpeg',quality=60)
            sh=Image.new('RGB',(190*12,130*4))
            for i,(x,y) in enumerate(zip(fa,fb)):
                sh.paste(Image.open(x).resize((190,130)),((i%12)*190,(i//12)*260)); sh.paste(Image.open(y).resize((190,130)),((i%12)*190,(i//12)*260+130))
            sh.save(os.path.join(OUT,f'sheet_spectator_{kind}{var}.jpg'),quality=75); print('errors',e1[:3],e2[:3]); await b.close()
    finally: srv.terminate()
asyncio.run(main())
