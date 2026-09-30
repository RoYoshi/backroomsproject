"""Part 1A objective QA: entity visibility vs lighting.   python3 light_test.py [outdir]   (needs playwright; writes light_report.json + 3 screenshots)
   Pins a real (frozen) hound / smiler at chosen spots through the live client and records every frame: view alpha, tint, light sample."""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9310')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'light_qa'); os.makedirs(OUT,exist_ok=True)

SPOTS="""()=>{ const A=__api, L=A.lamps, free=(x,y)=>A.sl(x,y,26);
  const near=(x,y)=>Math.min(...L.map(l=>Math.hypot(l.x-x,l.y-y)));
  let bright=null, partial=null, dark=null;
  for(const l of L){ if(bright) break; for(const [dx,dy] of [[0,0],[30,0],[-30,0],[0,30],[0,-30]]){ const x=l.x+dx,y=l.y+dy; if(free(x,y)&&free(x+150,y)){ bright={x,y,lamp:l}; break; } } }
  // partial: 230-290 px from the bright lamp, in its line of sight, on the floor
  for(let a=0;a<6.28&&!partial;a+=.2){ const r=260,x=bright.x+Math.cos(a)*r,y=bright.y+Math.sin(a)*r; if(free(x,y)&&A.Uc(bright.lamp.x,bright.lamp.y,a,r+2)>=r-1&&near(x,y)>200) partial={x,y}; }
  for(let y=300;y<6600&&!dark;y+=48) for(let x=300;x<9000;x+=48){ if(free(x,y)&&free(x+150,y)&&near(x,y)>900&&A.Uc(x,y,0,200)>=190){ dark={x,y}; break; } }
  return {bright,partial,dark};
}"""
PIN="""([kind,x,y])=>{ // pin the first client-side object of this kind: writes from the network are swallowed, reads give our position
  const A=__api; const src=kind==='hound'?(window.__hounds||[]).find(Boolean):A.q.find(o=>o&&!o.off);
  if(!src) return false; window.__pinT={x,y};
  if(!src.__pinned){ Object.defineProperty(src,'x',{get:()=>window.__pinT.x,set:()=>{},configurable:true}); Object.defineProperty(src,'y',{get:()=>window.__pinT.y,set:()=>{},configurable:true}); src.__pinned=1; }
  window.__pinSrc=src; return true }"""
PROBE="""(kind)=>{ const v=__api.layer().children.find(c=>(kind==='hound'?c.__hound:c.__smiler)&&c.visible&&Math.hypot(c.x-window.__pinT.x,c.y-window.__pinT.y)<2);
  if(!v) return null; const s=__light.sample(v.x,v.y,__api.lightOn()); return {a:v.alpha,t:v.tint,tot:s.total,lamp:s.lamp,dir:[s.dirX,s.dirY],x:v.x,y:v.y} }"""
REC="""([kind,ms])=>new Promise(res=>{ const out=[]; const t0=performance.now(); const f=()=>{ const v=__api.layer().children.find(c=>(kind==='hound'?c.__hound:c.__smiler)&&c.visible);
  if(v){ const s=__light.sample(v.x,v.y,__api.lightOn()); out.push([v.alpha,v.tint,s.total,v.x,v.y]); } if(performance.now()-t0<ms) requestAnimationFrame(f); else res(out) }; requestAnimationFrame(f) })"""

async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    R={'checks':{}}; ok=lambda k,v,note='': R['checks'].__setitem__(k,{'ok':bool(v),'note':note})
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            async def join(name):
                c=await b.new_context(viewport={'width':760,'height':520}); P=await c.new_page(); errs=[]
                P.on('pageerror',lambda e:errs.append(str(e)[:300])); P.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'favicon' not in m.text else None)
                await P.goto(f'http://localhost:{PORT}/?room=light'); await P.wait_for_timeout(2200)
                await P.fill('#name',name); await P.evaluate("document.getElementById('enter').click(); window.__net && __net.testAuth && __net.testAuth('smoor')"); await P.wait_for_timeout(5000); return P,errs
            A,ea=await join('Alice')
            click=lambda P,sel: P.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            ok('light module loaded', await A.evaluate("()=>!!window.__light&&typeof __light.sample==='function'"))
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1200)
            await click(A,'[data-a=tab][data-t=monsters]')
            for i in range(4): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(80)
            for i in range(6): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(80)
            S=await A.evaluate(SPOTS); R['spots']=S; print('spots',json.dumps(S)[:300])
            await click(A,'[data-c=freeze][data-on="1"]'); await A.wait_for_timeout(300)
            await click(A,'[data-c=near][data-k=hound]'); await A.wait_for_timeout(1500)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            await A.evaluate("()=>{__api.H.god=true}")
            res={}
            for name in ('bright','partial','dark'):
                sp=S[name]; px,py=sp['x']-170,sp['y']
                if name=='dark' and await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
                await A.evaluate("([x,y])=>__api.tp(x,y)",[sp['x']+150,sp['y']])
                pinned=await A.evaluate(PIN,['hound',sp['x'],sp['y']]); await A.wait_for_timeout(1500)
                pr=await A.evaluate(PROBE,'hound'); res[name]=pr; print(name,pinned,pr)
                await A.screenshot(path=os.path.join(OUT,f'hound_{name}.jpg'),type='jpeg',quality=70)
            R['hound']=res
            g=lambda n,k: (res.get(n) or {}).get(k)
            for n in ('bright','partial','dark'): ok(f'hound in {n} light is opaque', g(n,'a') is not None and g(n,'a')>=.999, f"alpha {g(n,'a')}  light total {g(n,'tot')}")
            sh=lambda n: ((g(n,'t') or 0)>>16)/255
            ok('hound brightness follows light (bright > partial > dark shade)', sh('bright')>=sh('partial')>=sh('dark') and sh('bright')>sh('dark'), f"shade bright {sh('bright'):.2f} partial {sh('partial'):.2f} dark {sh('dark'):.2f}")
            ok('darkness makes the hound dark, not invisible (silhouette kept: shade >= .58)', sh('dark')>=.579, f"dark shade {sh('dark'):.2f}")
            # crossing a light boundary: dark -> lamp in 3 s, sample every frame
            await A.evaluate("([x,y])=>__api.tp(x,y)",[S['bright']['x']+150,S['bright']['y']])
            await A.evaluate("([ax,ay,bx,by])=>{ const t0=performance.now(); window.__walk=setInterval(()=>{const u=Math.min(1,(performance.now()-t0)/3000); window.__pinT={x:ax+(bx-ax)*u,y:ay+(by-ay)*u}},16) }",[S['partial']['x'],S['partial']['y'],S['bright']['x'],S['bright']['y']])
            tr=await A.evaluate(REC,['hound',3200]); await A.evaluate("()=>clearInterval(window.__walk)")
            amin=min(x[0] for x in tr) if tr else None; tints=[(x[1]>>16)/255 for x in tr]; jump=max((abs(tints[i]-tints[i-1]) for i in range(1,len(tints))),default=0)
            tots=[x[2] for x in tr]
            ok('hound crossing a light boundary never fades (alpha stays 1 every frame)', tr and amin>=.999, f"{len(tr)} frames, min alpha {amin}, light went {min(tots):.2f} -> {max(tots):.2f}")
            ok('...and its shade changes smoothly (no per-frame pop)', tr and jump<.08, f"largest per-frame shade step {jump:.3f}")
            nan=any(not all(map(lambda v: isinstance(v,(int,float)) and v==v and abs(v)<1e12,x)) for x in tr)
            ok('no NaNs in alpha / tint / light samples', not nan and all(v is not None for v in [g('bright','a'),g('dark','a')]))
            # smiler: species concealment preserved (dim smudge in the dark, solid when readable)
            await A.keyboard.press('Backquote'); await A.wait_for_timeout(300); await click(A,'[data-a=tab][data-t=monsters]'); await A.wait_for_timeout(200)
            for i in range(4): await click(A,'[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(80)
            await A.evaluate("([x,y])=>__api.tp(x,y)",[S['dark']['x']+150,S['dark']['y']]); await A.wait_for_timeout(800)
            await click(A,'[data-c=near][data-k=smiler]'); await A.wait_for_timeout(1500); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            sm={}
            for name,torch in (('dark',False),('lit',True)):
                sp=S['dark'] if name=='dark' else S['bright']
                await A.evaluate("([x,y])=>__api.tp(x,y)",[sp['x']+150,sp['y']])
                on=await A.evaluate("()=>__api.lightOn()")
                if on!=torch: await A.keyboard.press('KeyF')
                await A.evaluate(PIN,['smiler',sp['x'],sp['y']]); await A.wait_for_timeout(1500)
                sm[name]=await A.evaluate(PROBE,'smiler'); print('smiler',name,sm[name])
                await A.screenshot(path=os.path.join(OUT,f'smiler_{name}.jpg'),type='jpeg',quality=70)
            R['smiler']=sm
            sa=lambda n:(sm.get(n) or {}).get('a')
            ok('smiler keeps its species concealment (thin in the dark, solid when readable)', sa('dark') is not None and sa('lit') is not None and sa('dark')<.6 and sa('lit')>.9, f"alpha dark {sa('dark')}  lit {sa('lit')}")
            ok('smiler concealment comes from its own species function', await A.evaluate("()=>typeof __ents.smilerPresence==='function'"))
            # multiplayer: a second client sees the same (opaque) hound
            await A.keyboard.press('Backquote'); await A.wait_for_timeout(300); await click(A,'[data-a=tab][data-t=monsters]')
            for i in range(6): await click(A,'[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(80)
            await A.evaluate("([x,y])=>__api.tp(x,y)",[S['partial']['x']+120,S['partial']['y']]); await A.wait_for_timeout(600)
            await click(A,'[data-c=near][data-k=hound]'); await A.wait_for_timeout(1200)
            B,eb=await join('Bob'); await B.evaluate("([x,y])=>{__api.tp(x,y)}",[S['partial']['x']+160,S['partial']['y']+30]); await B.wait_for_timeout(2500)
            mp=[]
            for P in (A,B): mp.append(await P.evaluate("()=>{const v=__api.layer().children.filter(c=>c.__hound&&c.visible); return v.map(c=>[+c.alpha.toFixed(3),Math.round(c.x),Math.round(c.y),(c.tint>>16)])}"))
            R['mp']=mp; print('mp',mp)
            ok('multiplayer: both clients show the hound opaque, at the same place', mp[0] and mp[1] and all(x[0]>=.999 for x in mp[0]+mp[1]) and abs(mp[0][0][1]-mp[1][0][1])<40 and abs(mp[0][0][2]-mp[1][0][2])<40, json.dumps(mp))
            # death animation still intact (lab clock unpaused, real kill path)
            await A.evaluate("()=>{ const s=window.__pinSrc; if(s&&s.__pinned){ const x=window.__pinT.x,y=window.__pinT.y; delete s.x; delete s.y; s.x=x; s.y=y; s.__pinned=0 } window.__dlab={on:false,paused:false,speed:1,step:0}; __api.H.god=false}")
            if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
            await click(A,'[data-a=tab][data-t=monsters]'); await A.wait_for_timeout(200); await click(A,'[data-c=freeze][data-on="0"]'); await A.wait_for_timeout(400)
            if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
            await click(A,'[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
            await click(A,'[data-a=place][data-w=open]'); await A.wait_for_timeout(2500)
            R['deathBtn']=await click(A,'[data-c=preview][data-k=hound][data-var=A]'); t0=time.time(); seen=False; fin=False
            await A.wait_for_timeout(1500); R['deathDbg']=await A.evaluate("()=>({hidden:document.getElementById('adminPanel').hidden, caught:!!__api.G.caught, active:__api.death().active, toast:(document.getElementById('admStatus')||{}).textContent||'-', god:__api.H.god, pv:!!__api.fall&&__api.fall(), tab:(document.querySelector('#adminPanel [data-a=tab].on')||{}).textContent||''})"); print('DEATHDBG',R['deathBtn'],R['deathDbg'])
            while time.time()-t0<25:
                st=await A.evaluate("()=>{const d=__api.death(); return {a:d.active,f:d.finished,t:d.elapsed,ok:Number.isFinite(d.body.x)&&Number.isFinite(d.body.y)}}")
                if st['a']: seen=True
                if seen and (st['f'] or not st['a']): fin=True; break
                if seen and not st['ok']: break
                await A.wait_for_timeout(250)
            ok('death animation plays through (hound A preview, real kill path)', seen and fin, f'started {seen}, finished {fin}')
            ok('no runtime errors (both clients)', not ea and not eb, json.dumps((ea+eb)[:4]))
            await b.close()
    finally: srv.terminate()
    # AI / server side is untouched by rendering: nothing in the server sim reads client presentation values
    srvsrc=open(os.path.join(ROOT,'ai.js')).read()+open(os.path.join(ROOT,'sim.js')).read()
    ok('AI never reads render visibility (no alpha / tint / __light in ai.js or sim.js)', '__light' not in srvsrc and '.alpha' not in srvsrc and '.tint' not in srvsrc)
    R['pass']=all(c['ok'] for c in R['checks'].values())
    json.dump(R,open(os.path.join(OUT,'light_report.json'),'w'),indent=1)
    for k,c in R['checks'].items(): print(('PASS ' if c['ok'] else 'FAIL ')+k+('   '+c['note'] if c['note'] else ''))
    print('ALL PASS' if R['pass'] else 'SOME FAILED')
asyncio.run(main())
