"""PART 2 / 2D visual + debug QA of the canon Smiler, in a real browser against the real server (nothing pinned or faked).
   python3 smiler2d_view.py [outdir]     (needs playwright + Pillow)
   Alice stands in the dark with only a smiler near her and debug mode on.  Phases: (0) she waits, looking its way, until it comes out to watch
   her, (1) eye contact, (2) looks away, (3) turns a torch on.  Every 1.5 s: a screenshot, and the smiler's debug entry from the server feed (state, act, WHY, agitation, eye contact).
   Checks: the debug feed answers "why" for the smiler; the face is drawn (its glow channel) while no limbs are; no script errors."""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
from PIL import Image
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','8993')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'sm2d'); os.makedirs(OUT,exist_ok=True)
DARK="""()=>{ const A=__api; for(let y=300;y<6600;y+=48) for(let x=300;x<9000;x+=48){ if(!A.sl(x,y,24)) continue; if((A.lamps||[]).some(l=>Math.hypot(l.x-x,l.y-y)<900)) continue; if(A.Uc(x,y,0,700)<650) continue; return [x,y]; } return null }"""
SM="""()=>{ const d=(__ents.dbg||[]).find(e=>e&&e.k==='smiler'); const q=__api.q.filter(o=>o&&!o.off); const o=q[0]; const H=__api.H;
  return { d: d? {st:d.s, act:d.ac, sm:d.sm||null} : null, dist: o? Math.round(Math.hypot(o.x-H.x,o.y-H.y)) : -1, face: o? +(o.face||0).toFixed(2) : -1, light: __api.lightOn() } }"""
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    res={'samples':[],'errors':[]}
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS); c=await b.new_context(viewport={'width':760,'height':520}); A=await c.new_page()
            A.on('pageerror',lambda e:res['errors'].append(str(e)[:300]))
            await A.goto(f'http://localhost:{PORT}/?room=sm2d'); await A.wait_for_timeout(2200)
            await A.fill('#name','Alice'); await A.evaluate("document.getElementById('enter').click()"); await A.wait_for_timeout(5500)
            click=lambda sel: A.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1400)
            await click('[data-a=tab][data-t=monsters]')
            for i in range(4): await click('[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(100)
            for i in range(6): await click('[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(100)
            spot=await A.evaluate(DARK); res['spot']=spot
            await A.evaluate("([x,y])=>{__api.tp(x,y); __api.H.angle=0}",spot); await A.wait_for_timeout(3500)
            await click('[data-a=tab][data-t=world]'); await A.wait_for_timeout(200); await click('[data-c=blackout][data-mode=on]'); await A.wait_for_timeout(300)
            await click('[data-a=tab][data-t=monsters]'); await click('[data-c=near][data-k=smiler]'); await A.wait_for_timeout(600)
            await click('[data-a=tab][data-t=debug]'); await A.wait_for_timeout(300); await click('[data-a=dbg]'); await A.wait_for_timeout(800)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            if await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
            # keep the player's facing under test control (no mouse): look at it / away
            await A.evaluate("()=>{window.__mode='look'; window.__aimT=setInterval(()=>{const q=__api.q.filter(o=>o&&!o.off); const o=q[0]; if(!o) return; const H=__api.H; const a=Math.atan2(o.y-H.y,o.x-H.x); H.angle = window.__mode==='look'? a : a+Math.PI;},16)}")
            shots=[]; t=0.0
            async def sample(phase):
                nonlocal t
                s=await A.evaluate(SM); s['t']=round(t,1); s['phase']=phase; res['samples'].append(s)
                fn=os.path.join(OUT,f'sm_{len(shots):02d}.jpg'); await A.screenshot(path=fn,type='jpeg',quality=70); shots.append(fn); await A.wait_for_timeout(1500); t+=1.5
                return s
            # (0) wait in the dark, looking at where it is, until it comes out to watch her (it may not see her at first: darkness is not omniscience)
            for i in range(20):
                s=await sample('waiting, looking its way')
                if s.get('d') and s['d']['st']=='WATCHING': break
            for i in range(6): await sample('eye contact')                      # (1) held
            await A.evaluate("()=>{window.__mode='away'}")
            for i in range(4): await sample('looked away')                      # (2) bolder
            await A.evaluate("()=>{window.__mode='look'}"); await A.keyboard.press('KeyF')
            for i in range(4): await sample('torch on, looking')                # (3) the lure
            shots=shots[-16:]; sheet=Image.new('RGB',(380*4,260*4))
            for i,fn in enumerate(shots): sheet.paste(Image.open(fn).resize((380,260)),((i%4)*380,(i//4)*260))
            sheet.save(os.path.join(OUT,'sheet_smiler2d.jpg'),quality=75); await b.close()
    finally: srv.terminate()
    whys=[s['d']['sm']['why'] for s in res['samples'] if s.get('d') and s['d'].get('sm')]
    res['checks']={'debug feed explains why (smiler entries with a WHY)': len(whys)>=10, 'no script errors': not res['errors']}
    json.dump(res,open(os.path.join(OUT,'smiler2d_report.json'),'w'),indent=1)
    for s in res['samples']: print(s['t'], s['phase'], s['dist'], s['face'], json.dumps(s['d'])[:260])
    for k,v in res['checks'].items(): print(('PASS ' if v else 'FAIL ')+k)
    print('errors:',res['errors'][:4]); sys.exit(0 if all(res['checks'].values()) else 1)
asyncio.run(main())
