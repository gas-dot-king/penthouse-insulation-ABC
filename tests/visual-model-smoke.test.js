"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const context=vm.createContext({console});
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
  V3D.model=m; V3D.x=x; V3D.endLayout="mixed";
  const svg=[];
  drawShellBand(svg,x,{x0:0,y0:20,w:1000,h:700,gap:40});
  drawEndBrief(svg,x,{x0:0,y0:0,w:600,h:400});
  const dim=v3dDimensionsHTML(m),info=v3dInfoHTML(m,2),end=v3dEndPlan(m);
  return {
    faceCount:m.faces.length,profileFaces:m.profileFaces.length,stepFaces:m.stepFaces.length,
    endPoints:m.ends[0].poly.length,uniqueKeys:new Set(m.faces.map(f=>f.key)).size,
    finiteFaces:m.faces.every(f=>f.vLen>0&&[...f.O,...f.V].every(Number.isFinite)),
    endId:end.id,endRender:end.renderId,endFallback:end.fallback,scenario:v3dScenarioTotal(m),total:x.totalSheets,
    dimHasSections:["A 구간","B 구간","C 구간","D 구간"].every(v=>dim.includes(v)),
    infoHasProfile:info.includes("A 지붕→D 외벽"),
    visualClean:!/(NaN|undefined)/.test(svg.join("")),visualHasRise:svg.join("").includes("C 지붕")
  };
})()`,context);

assert.deepEqual(JSON.parse(JSON.stringify(result)),{
  faceCount:9,profileFaces:8,stepFaces:3,endPoints:10,uniqueKeys:9,finiteFaces:true,
  endId:"mixed",endRender:"horizontal",endFallback:true,scenario:156,total:156,
  dimHasSections:true,infoHasProfile:true,visualClean:true,visualHasRise:true
});

console.log("visual model smoke: 4단 2D/3D 모델·치수·fallback 통과");
