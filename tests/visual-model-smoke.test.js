"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const page=fs.readFileSync(path.join(root,"penthouse_insulation_ABC_case_optimizer.html"),"utf8");
assert.match(page,/data-view="shell3d"/);
assert.match(page,/data-view="ends3d"/);
const context=vm.createContext({console,window:{devicePixelRatio:1}});
for(const file of [
  "js/01-core.js","js/01-geometry.js","js/02-calc.js",
  "js/03-render.js","js/04-visual.js","js/05-visual3d.js"
]) vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});

const result=vm.runInContext(`(()=>{
  const c={id:"visual-4",name:"4단 시각 검증",L:10000,shape:{
    schemaVersion:1,type:"stepped-profile",startSide:"right",
    startRunLabel:"A 외벽 하강",profileRunLabel:"A 지붕→D 외벽",
    sections:[
      {id:"a",label:"A 구간",roofLabel:"A 지붕",wallLabel:"A 외벽",width:1000,height:4000},
      {id:"b",label:"B 구간",roofLabel:"B 지붕",wallLabel:"B 외벽",width:800,height:2500},
      {id:"c",label:"C 구간",roofLabel:"C 지붕",wallLabel:"C 외벽",width:1200,height:3500},
      {id:"d",label:"D 구간",roofLabel:"D 지붕",wallLabel:"D 외벽",width:600,height:1800}
    ]
  }};
  const x=calc(c),m=v3dModel(x);
  V3D.model=m; V3D.x=x; V3D.endLayout="mixed"; V3D.scope="shell";
  const svg=[];
  drawShellBand(svg,x,{x0:0,y0:20,w:1000,h:700,gap:40});
  drawEndBrief(svg,x,{x0:0,y0:0,w:600,h:400});
  const dim=v3dDimensionsHTML(m),info=v3dInfoHTML(m,2),end=v3dEndPlan(m),shellScenario=v3dScenarioTotal(m);
  V3D.scope="ends";
  const endDim=v3dDimensionsHTML(m),endInfo=v3dInfoHTML(m,0),endScenario=v3dScenarioTotal(m);
  const aModel=v3dModel(calc(CASES[0]));
  const aEndCopy=v3dEndInfoHTML(aModel).includes("3.918장")&&
    v3dEndInfoHTML(aModel).includes("1,653mm")&&v3dEndInfoHTML(aModel).includes("147mm");
  const calls=[];
  const fakeCtx={
    setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},
    setLineDash(){},fillRect(){},strokeRect(){},save(){},clip(){},restore(){},fillText(){},strokeText(){},
    measureText(text){return {width:String(text).length*7};}
  };
  V3D.canvas={clientWidth:1000,clientHeight:640,width:0,height:0,isConnected:true};
  V3D.ctx=new Proxy(fakeCtx,{get(target,key){
    if(key in target) return target[key];
    return (...args)=>calls.push([String(key),args.length]);
  }});
  v3dRepaint();
  const endCanvasPainted=V3D.canvas.width===1000&&V3D.canvas.height===640;
  V3D.scope="shell"; V3D.step=3;
  v3dRepaint();
  return {
    faceCount:m.faces.length,profileFaces:m.profileFaces.length,stepFaces:m.stepFaces.length,
    endPoints:m.ends[0].poly.length,uniqueKeys:new Set(m.faces.map(f=>f.key)).size,
    finiteFaces:m.faces.every(f=>f.vLen>0&&[...f.O,...f.V].every(Number.isFinite)),
    endId:end.id,endRender:end.renderId,endFallback:end.fallback,shellScenario,endScenario,total:x.totalSheets,
    dimHasSections:["A 구간","B 구간","C 구간","D 구간"].every(v=>dim.includes(v)),
    infoHasProfile:info.includes("A 지붕→D 외벽"),
    endDimHasExactFit:endDim.includes("2.000장")&&endDim.includes("마지막 1,800mm 사용")&&endDim.includes("절단 자투리"),
    endInfoHasScope:endInfo.includes("양끝 계단 단면")&&endInfo.includes("한 줄의 폭 방향 수량"),
    aEndCopy,
    endCanvasPainted,
    shellCanvasPainted:V3D.canvas.width===1000&&V3D.canvas.height===640,
    visualClean:!/(NaN|undefined)/.test(svg.join("")),visualHasRise:svg.join("").includes("C 지붕")
  };
})()`,context);

assert.deepEqual(JSON.parse(JSON.stringify(result)),{
  faceCount:9,profileFaces:8,stepFaces:3,endPoints:10,uniqueKeys:9,finiteFaces:true,
  endId:"mixed",endRender:"horizontal",endFallback:true,shellScenario:130,endScenario:26,total:156,
  dimHasSections:true,infoHasProfile:true,endDimHasExactFit:true,endInfoHasScope:true,aEndCopy:true,endCanvasPainted:true,shellCanvasPainted:true,visualClean:true,visualHasRise:true
});

console.log("visual model smoke: 4단 2D/분리 3D 모델·외곽 치수·fallback 통과");
