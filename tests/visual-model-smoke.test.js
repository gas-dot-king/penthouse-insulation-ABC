"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const page=fs.readFileSync(path.join(root,"penthouse_insulation_ABC_case_optimizer.html"),"utf8");
const visual3dSource=fs.readFileSync(path.join(root,"js/05-visual3d.js"),"utf8");
assert.match(page,/data-view="shell3d"/);
assert.match(page,/data-view="ends3d"/);
assert.match(page,/<div class="view-group-label">2D<\/div>/);
assert.match(page,/<div class="view-group-label">3D<\/div>/);
assert.doesNotMatch(page,/data-view="summary"/);
assert.doesNotMatch(page,/긴 외피 전용 3D/);
assert.match(visual3dSource,/const V3D_STEPS=\["구조만","높은벽만","지붕→낮은 벽만","전체 덮음"\]/);
assert.doesNotMatch(visual3dSource,/id="v3dPlay"/);
assert.doesNotMatch(visual3dSource,/순서대로 재생/);
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
  const aHighFit=aModel.x.endHorizontal.sectionHeightFits.find(v=>v.sectionId==="high");
  const aHighCutCopy=endSectionCutAlertText(aHighFit).includes("6.950장")&&
    endSectionCutAlertText(aHighFit).includes("570.0mm")&&endSectionCutAlertText(aHighFit).includes("30.0mm");
  const a2d=[];
  drawEndFixedOption(a2d,aModel.x,{x0:0,y0:0,w:360,h:580},aModel.x.endHorizontal,.05);
  const a2dCutAlert=a2d.join("").includes("30.0mm 자투리")&&a2d.join("").includes("구간별 절단 자투리");
  const canvasPoints=[];
  const fakeCtx={
    setTransform(){},clearRect(){},beginPath(){},moveTo(x,y){canvasPoints.push([x,y])},lineTo(x,y){canvasPoints.push([x,y])},closePath(){},fill(){},stroke(){},
    setLineDash(){},fillRect(){},strokeRect(){},save(){},clip(){},restore(){},fillText(){},strokeText(){},
    measureText(text){return {width:String(text).length*7};}
  };
  V3D.canvas={clientWidth:1000,clientHeight:640,width:0,height:0,isConnected:true};
  V3D.ctx=new Proxy(fakeCtx,{get(target,key){
    if(key in target) return target[key];
    return ()=>{};
  }});
  V3D.yaw=2.18; V3D.pitch=.42;
  v3dRepaint();
  const endCanvasPainted=V3D.canvas.width===1000&&V3D.canvas.height===640;
  const projection=()=>JSON.stringify(canvasPoints.slice(0,20).map(p=>p.map(v=>Number(v.toFixed(2)))));
  const firstEndProjection=projection();
  canvasPoints.length=0;
  V3D.yaw=1.35; V3D.pitch=.42;
  v3dRepaint();
  const yawProjection=projection();
  canvasPoints.length=0;
  V3D.yaw=2.18; V3D.pitch=.90;
  v3dRepaint();
  const pitchProjection=projection();
  const endRotates=firstEndProjection!==yawProjection&&firstEndProjection!==pitchProjection;
  const endHover=v3dWasteHoverText(V3D.hoverInfo);
  V3D.model=aModel; V3D.x=aModel.x; V3D.endLayout="mixed"; V3D.scope="ends";
  V3D.yaw=2.18; V3D.pitch=.42;
  v3dRepaint();
  const aMixed3dCutAlert=V3D.hotspots.some(v=>v.text.includes("높은 구간")&&v.text.includes("30.0mm"));
  V3D.endLayout="horizontal";
  v3dRepaint();
  const a3dCutAlert=V3D.hotspots.some(v=>v.text.includes("높은 구간")&&v.text.includes("30.0mm"));
  V3D.model=m; V3D.x=x; V3D.endLayout="mixed";
  V3D.scope="shell"; V3D.playing=false;
  V3D.step=1; const highOnly=v3dCoverage(m);
  V3D.step=2; const drapeOnly=v3dCoverage(m);
  V3D.step=3; const allCovered=v3dCoverage(m);
  const staticModesCorrect=highOnly.high>0&&highOnly.drape===0&&
    drapeOnly.high===0&&drapeOnly.drape>0&&allCovered.high>0&&allCovered.drape>0;
  v3dRepaint();
  const shellHover=v3dWasteHoverText(V3D.hoverInfo);
  return {
    faceCount:m.faces.length,profileFaces:m.profileFaces.length,stepFaces:m.stepFaces.length,
    endPoints:m.ends[0].poly.length,uniqueKeys:new Set(m.faces.map(f=>f.key)).size,
    finiteFaces:m.faces.every(f=>f.vLen>0&&[...f.O,...f.V].every(Number.isFinite)),
    endId:end.id,endRender:end.renderId,endFallback:end.fallback,shellScenario,endScenario,total:x.totalSheets,
    dimHasSections:["A 구간","B 구간","C 구간","D 구간"].every(v=>dim.includes(v)),
    infoHasProfile:info.includes("A 지붕→D 외벽"),
    endDimHasExactFit:endDim.includes("2.000장")&&endDim.includes("마지막 1,800mm 사용")&&endDim.includes("절단 자투리"),
    endInfoHasScope:endInfo.includes("양끝 계단 단면")&&endInfo.includes("한 줄의 폭 방향 수량"),
    aEndCopy,aHighCutCopy,a2dCutAlert,aMixed3dCutAlert,a3dCutAlert,staticModesCorrect,
    endCanvasPainted,
    endRotates,
    endHoverHasWaste:endHover.includes("보온재 남는 면적")&&endHover.includes("끝단 절단폭"),
    shellHoverHasWaste:shellHover.includes("보온재 남는 면적")&&shellHover.includes("천장 전개"),
    shellCanvasPainted:V3D.canvas.width===1000&&V3D.canvas.height===640,
    visualClean:!/(NaN|undefined)/.test(svg.join("")),visualHasRise:svg.join("").includes("C 지붕")
  };
})()`,context);

assert.deepEqual(JSON.parse(JSON.stringify(result)),{
  faceCount:9,profileFaces:8,stepFaces:3,endPoints:10,uniqueKeys:9,finiteFaces:true,
  endId:"mixed",endRender:"horizontal",endFallback:true,shellScenario:130,endScenario:26,total:156,
  dimHasSections:true,infoHasProfile:true,endDimHasExactFit:true,endInfoHasScope:true,aEndCopy:true,aHighCutCopy:true,a2dCutAlert:true,aMixed3dCutAlert:true,a3dCutAlert:true,staticModesCorrect:true,endCanvasPainted:true,endRotates:true,endHoverHasWaste:true,shellHoverHasWaste:true,shellCanvasPainted:true,visualClean:true,visualHasRise:true
});

console.log("visual model smoke: 2D/3D 분류·회전 양끝면·남는 면적 hover 통과");
