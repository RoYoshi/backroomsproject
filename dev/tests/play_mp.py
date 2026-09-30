"""Audit remediation, in a real browser: an ordinary (non-admin) player who joins, spawns and moves around with the keyboard - walking, sprinting
   until winded, crouching, sliding, turning at walls - is never corrected by the server's movement check, and the server keeps its position
   in step with the client.  Also: the page loads with no errors.
   python3 play_mp.py [outdir]   -> prints JSON, exit code 1 on failure"""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9356')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'play_mp'); os.makedirs(OUT,exist_ok=True)
# counts the server's corrections ('tp') this page receives, and records its own position every frame
HOOK="""()=>{ window.__tpN=0; const W=window.WebSocket; window.WebSocket=function(u,p){ const ws=new W(u,p); ws.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t==='tp') window.__tpN++; if(m.t==='s') window.__lastS=m; }catch{} }); return ws; }; window.WebSocket.prototype=W.prototype; Object.assign(window.WebSocket, W); }"""
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    R={}
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            async def page(name, auth):
                c=await b.new_context(viewport={'width':480,'height':320}); P=await c.new_page(); errs=[]
                P.on('pageerror',lambda e:errs.append(str(e)[:300])); P.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'favicon' not in m.text else None)
                await P.add_init_script('('+HOOK+')()')
                await P.goto(f'http://localhost:{PORT}/?room=play'); await P.wait_for_timeout(2200); await P.fill('#name',name)
                await P.evaluate("document.getElementById('enter').click()" + ("; __net.testAuth('smoor')" if auth else "")); await P.wait_for_timeout(4500); return P,errs
            O,eo=await page('Observer', True)
            P,ep=await page('Player', False)                                      # an ordinary player: no admin, no debug teleports
            await P.evaluate("()=>{__api.H.god=true}"); await P.bring_to_front(); await P.mouse.click(380,300)
            spawn=await P.evaluate("()=>[Math.round(__api.H.x),Math.round(__api.H.y)]")
            await P.wait_for_timeout(800)
            gaps=[]; samples=[]
            async def sample():
                me=await P.evaluate("()=>({x:__api.H.x,y:__api.H.y,id:__api.H.id})")
                s=await O.evaluate("(id)=>{const m=window.__lastS; const q=m&&m.p&&m.p.find(o=>o.id===id); return q?[q.x,q.y]:null}", me['id'])
                if s: gaps.append(((me['x']-s[0])**2+(me['y']-s[1])**2)**.5)
                samples.append([round(me['x']),round(me['y'])])
            # steer like a player: keep going while there is room ahead, turn toward the most open direction at walls; sprint, walk, crouch, slide
            DIRS=[('KeyD',),('KeyD','KeyS'),('KeyS',),('KeyS','KeyA'),('KeyA',),('KeyA','KeyW'),('KeyW',),('KeyW','KeyD')]
            held=set(); cur=0; t0=time.time(); phase_log=[]
            async def hold(keys):
                for k in list(held):
                    if k not in keys: await P.keyboard.up(k); held.discard(k)
                for k in keys:
                    if k not in held: await P.keyboard.down(k); held.add(k)
            while time.time()-t0<22:
                el=time.time()-t0
                mode='run' if el<9 or 14<el<18 else 'walk' if el<12 else 'crouch' if el<14 else 'walk'
                room=await P.evaluate("()=>{const A=__api,H=A.H;return [0,1,2,3,4,5,6,7].map(i=>A.Uc(H.x,H.y,i*Math.PI/4,420))}")
                if room[cur]<160: cur=max(range(8),key=lambda i:room[i]+(60 if abs(i-cur) in (1,7) else 0))
                keys=list(DIRS[cur])+(['ShiftLeft'] if mode=='run' else [])
                await hold(keys)
                if mode=='crouch' and 'crouched' not in phase_log: await P.keyboard.press('KeyC'); phase_log.append('crouched')
                if mode=='walk' and el>=14 and 'crouched' in phase_log and 'stood' not in phase_log: await P.keyboard.press('KeyC'); phase_log.append('stood')
                if 16<el<16.4 and 'slid' not in phase_log: await P.keyboard.press('KeyC'); phase_log.append('slid')
                await P.wait_for_timeout(250); await sample()
            await hold([])
            fps=await P.evaluate("()=>new Promise(r=>{let n=0;const t=performance.now();const f=()=>{n++; if(performance.now()-t<2000) requestAnimationFrame(f); else r(n/2)}; requestAnimationFrame(f)})")
            st=await P.evaluate("()=>({st:__api.H.stamina,ex:__api.H.exhausted,mv:window.__mv&&window.__mv.s})")
            await P.wait_for_timeout(600); await sample()
            tp=await P.evaluate("()=>window.__tpN")
            moved=sum(((samples[i][0]-samples[i-1][0])**2+(samples[i][1]-samples[i-1][1])**2)**.5 for i in range(1,len(samples)))
            R={'spawn':spawn,'end':st,'fps':fps,'moved_px':round(moved),'corrections':tp,'server_vs_client_gap_px':{'median':round(sorted(gaps)[len(gaps)//2]) if gaps else None,'max':round(max(gaps)) if gaps else None,'n':len(gaps)},'errors':eo+ep}
            R['ok']= tp==0 and moved>300 and gaps and sorted(gaps)[len(gaps)//2]<80 and not (eo+ep)
            await O.screenshot(path=os.path.join(OUT,'observer.jpg'),type='jpeg',quality=60)
            await b.close()
    finally: srv.terminate()
    print(json.dumps(R)); sys.exit(0 if R.get('ok') else 1)
asyncio.run(main())
