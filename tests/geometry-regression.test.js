"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const context=vm.createContext({console});
for(const file of ["js/01-core.js","js/01-geometry.js","js/02-calc.js"]){
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
}
const evaluate=source=>vm.runInContext(source,context);

const golden=evaluate(`CASES.map(c=>{
  const x=calc(c);
  return {
    id:c.id,total:x.totalSheets,runs:x.shell.runs.map(r=>r.sheets),
    endH:x.endHorizontal.perFace,endV:x.endVertical.perFace,
    endApplied:x.endPerFace,endSource:x.endCountSource
  };
})`);
assert.deepEqual(JSON.parse(JSON.stringify(golden)),[
  {id:"caseA",total:430,runs:[103,275],endH:26,endV:33,endApplied:26,endSource:"manual"},
  {id:"caseB",total:445,runs:[141,264],endH:27,endV:28,endApplied:20,endSource:"manual"},
  {id:"caseC",total:386,runs:[141,221],endH:14,endV:18,endApplied:12,endSource:"manual"}
]);

const multi=evaluate(`(()=>{
  const c={id:"synthetic-4",name:"4단 상승·하강",L:10000,shape:{
    schemaVersion:1,type:"stepped-profile",startSide:"left",
    sections:[
      {id:"a",label:"A",width:1000,height:4000},
      {id:"b",label:"B",width:800,height:2500},
      {id:"c",label:"C",width:1200,height:3500},
      {id:"d",label:"D",width:600,height:1800}
    ]
  }};
  const x=calc(c),s=x.d.shape;
  return {
    sections:s.sections.length,surfaces:s.surfaces.length,steps:s.stepSurfaces.length,
    totalW:s.totalW,profile:s.profileRunWidth,endArea:s.endAreaMm2,
    polygonPoints:s.endPolygon.length,endH:x.endHorizontal.perFace,endV:x.endVertical.perFace,
    applied:x.endPerFace,source:x.endCountSource,total:x.totalSheets,
    finite:[x.shell.sheets,x.endSheets,x.totalSheets,x.totalActual].every(Number.isFinite)
  };
})()`);
assert.deepEqual(JSON.parse(JSON.stringify(multi)),{
  sections:4,surfaces:9,steps:3,totalW:3600,profile:9600,endArea:11280000,
  polygonPoints:10,endH:13,endV:13,applied:13,source:"grid-fallback",total:156,finite:true
});

const rectangle=evaluate(`(()=>{
  const c={id:"rectangle",name:"1단",L:9000,shape:{schemaVersion:1,type:"stepped-profile",
    startSide:"right",sections:[{id:"only",label:"단일",width:2000,height:1200}]}};
  const x=calc(c),s=x.d.shape;
  return {surfaces:s.surfaces.length,steps:s.stepSurfaces.length,profile:s.profileRunWidth,
    polygon:s.endPolygon.length,startSide:s.startSide,source:x.endCountSource};
})()`);
assert.deepEqual(JSON.parse(JSON.stringify(rectangle)),{
  surfaces:3,steps:0,profile:3200,polygon:4,startSide:"right",source:"grid-fallback"
});

const flatSplit=evaluate(`(()=>{
  const s=normalizeCaseShape({id:"flat",name:"같은 높이 분할",L:1000,shape:{
    schemaVersion:1,type:"stepped-profile",sections:[
      {id:"a",width:500,height:1000},{id:"b",width:700,height:1000}
    ]
  }});
  return {steps:s.stepSurfaces.length,secondRoofFold:s.roofSurfaces[1].foldEdge};
})()`);
assert.deepEqual(JSON.parse(JSON.stringify(flatSplit)),{steps:0,secondRoofFold:false});

const stale=evaluate(`(()=>{
  const changed=JSON.parse(JSON.stringify(CASES[0]));
  changed.shape.sections[0].width+=1;
  const x=calc(changed);
  return {valid:x.d.endReviewValid,stale:x.d.endReviewStale,source:x.endCountSource,
    applied:x.endPerFace,gridMin:Math.min(x.endHorizontal.perFace,x.endVertical.perFace)};
})()`);
assert.deepEqual(JSON.parse(JSON.stringify(stale)),{
  valid:false,stale:true,source:"grid-fallback",applied:26,gridMin:26
});

assert.throws(()=>evaluate(`normalizeCaseShape({name:"오류",shape:{schemaVersion:1,
  sections:[{id:"same",width:10,height:20},{id:"same",width:10,height:30}]}})`),/중복/);
assert.throws(()=>evaluate(`normalizeCaseShape({name:"오류",shape:{schemaVersion:2,
  sections:[{width:10,height:20}]}})`),/지원하지 않는/);
assert.throws(()=>evaluate(`normalizeCaseShape({name:"오류",shape:{schemaVersion:1,
  sections:[{width:-1,height:20}]}})`),/0보다 큰/);
assert.throws(()=>evaluate(`calc({id:"bad-review",name:"오류",L:1000,
  shape:{schemaVersion:1,sections:[{width:1000,height:1000}]},
  reviewedEnd:{geometrySignature:"1000x1000"}})`),/minPerFace/);

console.log("geometry regression: A/B/C + 1단 + 4단 + 검토 서명 fallback 통과");
