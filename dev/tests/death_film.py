"""Death animation lab, headless: plays every death frame by frame (the death lab's paused clock) and writes contact sheets.
   python3 death_film.py [outdir] [only]   e.g. python3 death_film.py /tmp/film hound-B     (needs playwright + Pillow)"""
import os, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
from PIL import Image
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','8983')); OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/film'; ONLY=sys.argv[2] if len(sys.argv)>2 else ''
STEP=int(os.environ.get('STEP','6')); os.makedirs(OUT,exist_ok=True)
WALL_SPOT="""()=>{ const A=__api; for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((window.__glitches||[]).some(g=>Math.hypot(g.x-x,g.y-y)<260)||(A.lamps||[]).some(l=>Math.hypot(l.x-x,l.y-y)<230)) continue;
  for(let i=0;i<8;i++){ const a=i/8*Math.PI*2, d=A.Uc(x,y,a,240); if(d>72&&d<108&&A.Uc(x,y,a+.5,240)>60&&A.Uc(x,y,a-.5,240)>60&&A.Uc(x,y,a+Math.PI,240)>150) return [x,y,a+Math.PI]; } } return null }"""
OPEN_SPOT="""()=>{ const A=__api; for(let y=200;y<6700;y+=48) for(let x=200;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((window.__glitches||[]).some(g=>Math.hypot(g.x-x,g.y-y)<260)||(A.lamps||[]).some(l=>Math.hypot(l.x-x,l.y-y)<230)) continue; let ok=true; for(let i=0;i<8;i++){ if(A.Uc(x,y,i/8*Math.PI*2,240)<210){ok=false;break} } if(ok) return [x,y]; } return null }"""
async def main():
    pass
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS); c=await b.new_context(viewport={'width':760,'height':520}); A=await c.new_page(); errs=[]
            A.on('pageerror',lambda e:errs.append(str(e)[:300])); A.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'favicon' not in m.text else None)
            await A.goto(f'http://localhost:{PORT}/?room=film'); await A.wait_for_timeout(2200)
            await A.fill('#name','Alice'); await A.evaluate("document.getElementById('enter').click()"); await A.wait_for_timeout(5500)
            click=lambda sel: A.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1400)
            await click('[data-a=tab][data-t=monsters]')
            for i in range(4): await click('[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(100)
            for i in range(6): await click('[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(100)
            await click('[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(500)
            if os.environ.get('XRAY'): await A.evaluate("()=>{window.__xray=true}")
            wall=await A.evaluate(WALL_SPOT); openp=await A.evaluate(OPEN_SPOT); print('spots',wall,openp)
            for kind,v in [(k,v) for k in ('hound','smiler') for v in 'ABCD']:
                if ONLY and ONLY!=f'{kind}-{v}': continue
                spot=wall if (kind=='hound' and v=='C') else openp
                await A.evaluate("()=>{window.__dlab={on:false,paused:false,speed:1,step:0}}")
                if spot: await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a==null?Math.PI:a}",spot)
                await A.wait_for_timeout(3800)
                if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                await click('[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
                await A.evaluate("()=>{window.__dlab={on:true,paused:true,speed:1,step:0,xray:!!window.__xray}; window.__killLog=[]}")
                s0=await A.evaluate("()=>__api.death().startAt")
                await click(f'[data-c=preview][data-k={kind}][data-var={v}]')
                t0=time.time()
                while time.time()-t0<12 and not await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s",s0): await A.wait_for_timeout(100)
                await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
                frames=[]; n=0; fin=False
                while n<130:
                    await A.evaluate("s=>{window.__dlab.step=s}",STEP); await A.wait_for_timeout(230)
                    st=await A.evaluate("()=>{const d=__api.death(); return {t:d.elapsed, fin:d.finished, x:d.body.x, y:d.body.y}}")
                    if os.environ.get('DBG') and n in (2,10): print(n, await A.evaluate("()=>{const d=__api.death(); const S=d.ph; return JSON.stringify({t:d.elapsed, body:[d.body.x,d.body.y,d.body.angle,d.body.scaleX,d.body.scaleY,d.body.alpha].map(v=>+v.toFixed(1)), att:[d.attacker.x,d.attacker.y].map(v=>+v.toFixed(1)), sb:S&&[S.b.x,S.b.y].map(v=>+v.toFixed(1)), sat:S&&[S.at.x,S.at.y].map(v=>+v.toFixed(1)), src:d.source, vic:d.victim, kind:d.kind, variant:d.variant})}"))
                    fn=os.path.join(OUT,f'{kind}{v}_{n:03d}.jpg'); await A.screenshot(path=fn,type='jpeg',quality=62)
                    frames.append((fn,st)); n+=1
                    if st['fin']: break
                # contact sheet: crop the middle of each frame (the camera follows the body)
                W,H=760,520; cw,ch=330,270; cols=6; rows=(len(frames)+cols-1)//cols; sheet=Image.new('RGB',(cw*cols,ch*rows))
                for i,(fn,st) in enumerate(frames):
                    im=Image.open(fn).crop((W//2-cw//2,H//2-ch//2,W//2+cw//2,H//2+ch//2)); sheet.paste(im,((i%cols)*cw,(i//cols)*ch))
                sheet.save(os.path.join(OUT,f'sheet_{kind}{v}.jpg'),quality=72)
                print(kind,v,len(frames),'frames, ends at',frames[-1][1]['t'] if frames else None, flush=True)
                if not os.environ.get('KEEP'):
                    for fn,_ in frames: os.remove(fn)
                await A.evaluate("()=>{window.__dlab={on:false,paused:false,speed:1,step:0}}")
                await until_alive(A)
            print('errors:',errs[:5])
            await b.close()
    finally: srv.terminate()
async def until_alive(A):
    t0=time.time()
    while time.time()-t0<40:
        if await A.evaluate("()=>!__api.G.caught && __api.fall()<0"): return
        await A.wait_for_timeout(250)
asyncio.run(main())
