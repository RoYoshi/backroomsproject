'use strict';
const path=require('path'),fs=require('fs'),assert=require('assert'),{serve,launch}=require('./browser_support');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..')),out=path.resolve(process.argv[3]||path.join(__dirname,'evidence'));fs.mkdirSync(out,{recursive:true});
(async()=>{const server=await serve(root);let browser;const errors=[],fairness=[];try{
 browser=await launch();
 for(const [width,height,dpr]of [[1920,1080,1],[1920,1080,2],[3840,2160,1],[3440,1440,1],[1080,1920,1]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(server.url+'/stage_d.html?manual=1');await page.waitForFunction(()=>window.stageD?.ready);await page.locator('#controls').evaluate(e=>e.style.visibility='hidden');
  const result=await page.evaluate(()=>{const d=stageD,V=TFB_VIEW,world=d.worldHash(),snap=d.snapshotHash(),rows=[];
   for(const quality of [1,.5]){d.setScene('lower',{quality});const a=d.digest(d.pixels());d.draw({quality,exclude:['upper-same-xy'],overlays:['upper-same-xy']});const b=d.digest(d.pixels());const p=d.views[0].pass,scope=p.last.scope;
    if(a.hash!==b.hash)throw Error('Quality-dependent cross-floor/overlay leak');
    const camera={x:850,y:450,z:0},cap=V.footprint(innerWidth,innerHeight,camera),eye={x:880,y:cap.maxY-20,z:250};
    const outside={id:'scope-probe',x:880,y:cap.maxY+30,z:200,art:1},inside={...outside,y:cap.maxY-35};
    const render=actors=>{p.render({camera,eye,actors,overlays:[],view:null});return d.digest(p.pixels());};
    const empty=render([]),excluded=render([outside]),shown=render([inside]);
    if(empty.hash!==excluded.hash||empty.hash===shown.hash)throw Error('Elevated XY candidate cap failed');
    if(scope.width>1536.000001||scope.height>864.000001)throw Error('Camera awareness expansion');
    const projected=V.project({...outside,z:outside.z+30},camera,cap.scale);
    if(Math.abs(projected.y)>=innerHeight/2)throw Error('Scope probe must actually project inside viewport');
    rows.push({quality,scope,target:p.last.target,newResourceBytes:p.last.newResourceBytes,hiddenActorPixelEquality:a.hash===b.hash,elevatedOutsideProbe:{anchor:outside,projected,physicalVisible:V.visible(d.model,eye,{...outside,z:outside.z+30}),excludedPixelEquality:empty.hash===excluded.hash,insideControlChangesPixels:empty.hash!==shown.hash},glError:p.gl.getError()});
   }
   d.setScene('stairs',{quality:1});return {pass:rows.every(r=>r.glError===0&&r.elevatedOutsideProbe.physicalVisible)&&d.worldHash()===world&&d.snapshotHash()===snap,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},rows,worldHash:world,snapshotHash:snap};});
  assert(result.pass,JSON.stringify(result));fairness.push(result);await page.screenshot({path:path.join(out,`viewport-${width}x${height}-dpr${dpr}.png`)});console.log('PASS browser viewport '+width+'x'+height+' DPR '+dpr);await context.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));await page.goto(server.url+'/stage_d.html?manual=1');await page.waitForFunction(()=>window.stageD?.ready);
 const fades=await page.evaluate(()=>{const d=stageD,V=TFB_VIEW,records=[];d.setScene('lower',{cutaway:false});for(let step=0;step<=20;step++){d.draw({dt:.01,cutaway:true});const fade=d.views[0].view.snapshot().groups[0].fade,a=d.digest(d.pixels());d.draw({cutaway:true,exclude:['upper-same-xy'],overlays:['upper-same-xy']});const b=d.digest(d.pixels());if(a.hash!==b.hash)throw Error('Transient fade overlay leak');records.push({seconds:(step+1)*.01,fade,hash:a.hash,leakPixels:0});}
  const state=new V.LocalView(d.model),h=[];state.update({x:100,y:560,z:0},.15);for(let i=0;i<120;i++){const focus={x:100,y:570+(i%2?1:-1),z:0};state.update(focus,1/120);d.views[0].pass.render({...d.configuration(),view:state,actors:d.snapshot.actors});h.push({target:state.snapshot().groups[0].target,fade:state.snapshot().groups[0].fade,hash:d.digest(d.pixels()).hash});}
  return {pass:records.every((r,i)=>i===0||r.fade>=records[i-1].fade)&&records.at(-1).fade===1&&h.every(r=>r.target&&r.fade===1)&&new Set(h.map(r=>r.hash)).size===1,enter:records,boundaryFrames:h.length,boundaryDistinctHashes:new Set(h.map(r=>r.hash)).size};});assert(fades.pass);
 assert.deepEqual(errors,[]);const result={status:'PASS',runtime:process.version,browser:browser.version(),fairness,fades,performanceFile:'browser-performance.json',errors,scope:'Actual browser WebGL output. Completed-frame measurement is separate in browser-performance.json. SwiftShader software GPU; this is not a claim that unavailable hardware meets 16.7 ms. Quality changes target sampling only; physical solids/rays and logical footprint are identical.'};fs.writeFileSync(path.join(out,'browser-extended.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS extended browser checks');
 }finally{if(browser)await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
