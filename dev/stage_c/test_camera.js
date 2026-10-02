'use strict';
const assert=require('assert'),p=require('../../camera_policy'),fs=require('fs'),path=require('path');
assert.equal(p.REF_SCALE,1.25);const results=[];let cases=0;
for(const [w,h] of [[1920,1080],[3840,2160],[3440,1440],[1080,1920],[390,844]]){
 const expected=p.visibleWorld(w,h);
 for(const dpr of [1,2,3])for(const fps of [15,30,60,120,144,240,360])for(const z of [-96,0,180]){
  // Extra context arguments are intentionally ignored by the pure policy API.
  cases++;const actual=p.visibleWorld(w,h,{dpr,fps,z});assert.deepStrictEqual(actual,expected);assert(actual.width<=1920/1.25+1e-7&&actual.height<=1080/1.25+1e-7);
 }
 results.push({width:w,height:h,...expected});
}
assert.deepStrictEqual(p.visibleWorld(1920,1080).width,p.visibleWorld(3840,2160).width);
assert(fs.readFileSync(path.resolve(__dirname,'../../assets/index-DKbV5Nv9.js'),'utf8').includes('__cameraPolicy.baseScale(innerWidth,innerHeight)'));
console.log(JSON.stringify({status:'PASS',cases,old:1.18,candidate:p.REF_SCALE,views:results,scope:'Pure policy; actual served app resize binding is separately tested. Browser feel is unverified.'},null,2));
