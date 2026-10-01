"""PART 2 / STAGE 2C-IR in a real browser: the camcorder's infrared illuminator is a physical, directional, finite light that only a
   night-vision sensor sees.  Measured on the darkness layer itself (the #light canvas: how much of the dark each world point lets through).
     R1  HIGH lights down its own axis and fades to nothing by its range (~560 px); LOW reaches less far (~340 px)
     R2  it is a beam, not a disc: off to the side and behind the player stays dark (the old NV lit a 640 px circle all round)
     R3  sensor only (emitter OFF) and NV off: no infrared on screen at all
     R4  walls stop it: aimed at a wall, nothing is lit beyond it; readability of a point behind the wall is unchanged
     R5  heat comes from the emitter: HIGH heats ~2.5x faster than LOW, OFF not at all; an overheated emitter shuts down, the sensor stays on
     R6  overexposure: HIGH against a wall at the lens floods the sensor (bloom), the open corridor does not
     R7  other players: another camcorder's infrared is visible only through this player's own night-vision sensor
     R8  nothing breaks: no page errors on either client
     R9  a concealing creature's legibility under NV follows the infrared: along the beam, not to the side, not past its range, not with NV off
   python3 ir_test.py [outdir]   -> prints JSON, exit code 1 on failure"""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9372')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'ir_test'); os.makedirs(OUT,exist_ok=True)
LY=3504
# how much darkness the overlay keeps at a world point (0 = fully open, 255 = black), averaged over a 5x5 patch
DARK="""([x,y])=>{ const cv=document.getElementById('light'), L=__api.layer().parent, sc=L.scale.x, sx=Math.round(L.position.x+x*sc), sy=Math.round(L.position.y+y*sc);
  if(sx<3||sy<3||sx>cv.width-3||sy>cv.height-3) return null; const d=cv.getContext('2d').getImageData(sx-2,sy-2,5,5).data; let a=0; for(let i=3;i<d.length;i+=4) a+=d[i]; return Math.round(a/25) }"""
AIM="""([x,y,a])=>{ __api.tp(x,y); __api.H.angle=a; window.__aimA=a; if(!window.__aimHook){ window.__aimHook=true; const f=()=>{ if(window.__aimA!==undefined) __api.H.angle=window.__aimA; requestAnimationFrame(f) }; requestAnimationFrame(f) } }"""
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    R={}; errs=[]
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            async def page(name):
                c=await b.new_context(viewport={'width':1900,'height':900}); P=await c.new_page()
                P.on('pageerror',lambda e:errs.append(name+': '+str(e)[:300]))
                await P.goto(f'http://localhost:{PORT}/?room=irt'); await P.wait_for_timeout(2200); await P.fill('#name',name)
                await P.evaluate("document.getElementById('enter').click(); __net.testAuth('smoor')"); await P.wait_for_timeout(3500); return P
            A=await page('A')
            click=lambda P,s: P.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",s)
            # the stage: no monsters, blackout (no lamps), frozen halls
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(800)
            await click(A,'[data-a=tab][data-t=monsters]')
            for i in range(5): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(60)
            for i in range(7): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(60)
            await click(A,'[data-a=tab][data-t=world]'); await A.wait_for_timeout(200)
            await click(A,'[data-c=blackout][data-mode=on]'); await A.wait_for_timeout(200)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            # camcorder raised, NV on
            await A.evaluate("()=>{__api.gear.eq.kind='camcorder'}"); await A.wait_for_timeout(200)
            if await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF'); await A.wait_for_timeout(200)
            await A.keyboard.press('KeyF'); await A.wait_for_timeout(600)
            async def waitGame(P,secs):                      # the camcorder's own clock (a headless page can render slowly; heat and bloom run on game time)
                t0=await P.evaluate("()=>__cam.S.t"); end=time.time()+40
                while time.time()<end and (await P.evaluate("()=>__cam.S.t"))-t0<secs: await P.wait_for_timeout(100)
                return (await P.evaluate("()=>__cam.S.t"))-t0
            setir=lambda P,l: P.evaluate(f"()=>{{__cam.S.ir={l}; __cam.S.heat=0; __cam.S.locked=false}}")
            await A.evaluate(AIM,[4000,LY,0]); await A.wait_for_timeout(900)
            axis=[80,160,250,330,420,520,620,720]
            async def frames(P,n=5):                         # let the page actually draw a few frames (a headless page can be slow)
                await P.evaluate("(n)=>new Promise(r=>{let k=0;const f=()=>{ if(++k>=n) r(); else requestAnimationFrame(f) };requestAnimationFrame(f)})",n)
            async def profile(P):
                await P.wait_for_timeout(300); await frames(P)
                return {'axis':[await P.evaluate(DARK,[4000+d,LY]) for d in axis],'side':await P.evaluate(DARK,[4000,LY-150 if True else 0]),'back':await P.evaluate(DARK,[4000-220,LY])}
            await setir(A,2); hi=await profile(A)
            await setir(A,1); lo=await profile(A)
            await setir(A,0); off=await profile(A)
            await A.evaluate("()=>{__cam.S.nvOn=false}"); nvoff=await profile(A); await A.evaluate("()=>{__cam.S.nvOn=true}")
            R['profile']={'HIGH':hi,'LOW':lo,'sensor only':off,'NV off':nvoff,'axis px':axis}
            base=nvoff['axis']
            lit=lambda prof,i: prof['axis'][i] is not None and base[i] is not None and prof['axis'][i] < base[i]-25
            # readability (what decides how legible a concealing creature is under NV): along the beam vs. to the side, at the same distance
            await setir(A,2); await A.evaluate(AIM,[4000,LY,0]); await frames(A)
            rd=await A.evaluate("()=>({axis:__light.readability(4300,3504,__api.lightOn()), side:__light.readability(4000,3504-300,__api.lightOn()), far:__light.readability(4700,3504,__api.lightOn())})")
            await A.evaluate("()=>{__cam.S.nvOn=false}"); await frames(A); rd['axis NV off']=await A.evaluate("()=>__light.readability(4300,3504,__api.lightOn())"); await A.evaluate("()=>{__cam.S.nvOn=true}")
            R['readability']={k:round(v,3) for k,v in rd.items()}; R['R9']=rd['axis']>rd['side']+.2 and rd['axis']>rd['far'] and rd['axis']>rd['axis NV off']+.2
            R['R1']=lit(hi,2) and lit(hi,4) and not lit(hi,7) and lit(lo,1) and not lit(lo,5) and hi['axis'][2] <= hi['axis'][5]
            R['R2']=(hi['side'] is None or nvoff['side'] is None or hi['side'] > nvoff['side']-25) and (hi['back'] is None or hi['back'] > nvoff['back']-25)
            R['R3']=not any(lit(off,i) for i in range(1,8)) and off['axis'][5]>=base[5]-10
            # R4: aim at a wall close by - nothing beyond it gets lit, and readability behind it does not change
            wall=await A.evaluate("""()=>{ const A=__api; for(let y=1000;y<6400;y+=48) for(let x=1200;x<8400;x+=48){ if(!A.sl(x,y,26)) continue; for(let k=0;k<8;k++){ const a=k*Math.PI/4, d=A.Uc(x,y,a,400); if(d>90&&d<160){ const bx=x+Math.cos(a)*(d+90), by=y+Math.sin(a)*(d+90); return {x,y,a,d,bx,by} } } } return null }""")
            await setir(A,2); await A.evaluate(AIM,[wall['x'],wall['y'],wall['a']]); await A.wait_for_timeout(900)
            rd_on=await A.evaluate("([x,y])=>__light.readability(x,y,__api.lightOn())",[wall['bx'],wall['by']])
            ir_beyond=await A.evaluate("([x,y])=>__cam.irAt(x,y)",[wall['bx'],wall['by']]); ir_front=await A.evaluate("([x,y,a,d])=>__cam.irAt(x+Math.cos(a)*(d-30),y+Math.sin(a)*(d-30))",[wall['x'],wall['y'],wall['a'],wall['d']])
            await setir(A,0); await A.wait_for_timeout(400); rd_off=await A.evaluate("([x,y])=>__light.readability(x,y,__api.lightOn())",[wall['bx'],wall['by']])
            R['wall']={'dist':round(wall['d']),'ir in front':round(ir_front,3),'ir beyond':ir_beyond,'readability beyond (HIGH / OFF)':[round(rd_on,3),round(rd_off,3)]}
            R['R4']=ir_beyond==0 and ir_front>.2 and abs(rd_on-rd_off)<1e-6
            # R6 overexposure (still facing that wall: step in to ~45 px from it)
            await setir(A,2); await A.evaluate(AIM,[wall['x']+__import__('math').cos(wall['a'])*(wall['d']-45),wall['y']+__import__('math').sin(wall['a'])*(wall['d']-45),wall['a']]); await waitGame(A,1.5)
            bl_wall=await A.evaluate("()=>__cam.bloom")
            await A.screenshot(path=os.path.join(OUT,'ir_overexposed.png'))
            await A.evaluate(AIM,[4000,LY,0]); await waitGame(A,3); bl_open=await A.evaluate("()=>__cam.bloom")
            R['bloom']={'45 px from a wall':round(bl_wall,2),'open corridor':round(bl_open,2)}; R['R6']=bl_wall>.5 and bl_open<.05
            await A.screenshot(path=os.path.join(OUT,'ir_high_corridor.png'))
            # R5 heat (the game's own clock: run each setting 4 s)
            heat={}
            for name,l in (('HIGH',2),('LOW',1),('OFF',0)):
                await setir(A,l); h0=await A.evaluate("()=>__cam.S.heat"); g=await waitGame(A,4); h1=await A.evaluate("()=>__cam.S.heat"); heat[name]=round((h1-h0)/g,2)
            await A.evaluate("()=>{__cam.S.ir=2; __cam.S.heat=99.5; __cam.S.locked=false}"); await waitGame(A,.7)
            lock=await A.evaluate("()=>({locked:__cam.S.locked, ir:__cam.ir, nv:__cam.nv, hud:(document.getElementById('camNv')||{}).textContent})")
            R['heat per s']=heat; R['overheat']=lock
            R['R5']=heat['HIGH']>2.5 and 1.0<heat['LOW']<1.8 and heat['OFF']<=0 and heat['HIGH']/max(.01,heat['LOW'])>2 and lock['locked'] and lock['ir']==0 and lock['nv']
            await A.evaluate("()=>{__cam.S.heat=0; __cam.S.locked=false; __cam.S.ir=2}")
            # R7 peers: B stands behind A in the same corridor; A's HIGH beam goes east.  B: torch off -> no infrared; B camcorder NV (own emitter off) -> A's beam shows
            B=await page('B')
            await B.evaluate("()=>{__api.gear.eq.kind='flashlight'}"); await B.wait_for_timeout(200)
            if await B.evaluate("()=>__api.lightOn()"): await B.keyboard.press('KeyF')
            await A.evaluate("()=>{__cam.S.ir=2}"); await A.evaluate(AIM,[4000,LY,0]); await A.bring_to_front(); await A.wait_for_timeout(700)
            await B.bring_to_front(); await B.evaluate(AIM,[3950,LY+40,0]); await B.wait_for_timeout(1800)
            pts=[[4000+d,LY] for d in (200,300,400)]
            await frames(B); bNo=[await B.evaluate(DARK,q) for q in pts]
            await B.evaluate("()=>{__api.gear.eq.kind='camcorder'}"); await B.wait_for_timeout(200); await B.keyboard.press('KeyF'); await B.wait_for_timeout(500)
            await B.evaluate("()=>{__cam.S.ir=0; __cam.S.nvOn=true}"); await B.wait_for_timeout(1200)
            await frames(B); bNv=[await B.evaluate(DARK,q) for q in pts]
            await A.evaluate("()=>{__cam.S.ir=0}"); await A.bring_to_front(); await A.wait_for_timeout(700); await B.bring_to_front(); await B.wait_for_timeout(1200); await frames(B); bNvAoff=[await B.evaluate(DARK,q) for q in pts]
            R['peer']={'B no NV':bNo,'B NV (own emitter off), A HIGH':bNv,'B NV, A emitter off':bNvAoff}
            R['R7']=all(v is not None for v in bNo+bNv+bNvAoff) and all(bNv[i] < bNvAoff[i]-25 for i in range(3)) and all(abs(bNo[i]-255)<=8 or bNo[i] >= bNvAoff[i]-8 for i in range(3))
            await B.screenshot(path=os.path.join(OUT,'peer_ir_seen_through_nv.png'))
            R['R8']=not errs; R['errors']=errs
            await b.close()
    finally: srv.terminate()
    R['ok']=all(R.get(k) for k in ('R1','R2','R3','R4','R5','R6','R7','R8','R9'))
    print(json.dumps(R)); sys.exit(0 if R['ok'] else 1)
asyncio.run(main())
