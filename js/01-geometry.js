/* ══════════════════════════════════════════════════════════════
   수정 가능한 단면 형상 모델.

   지원 범위: 길이 방향으로 동일하게 압출되는 직교 계단형 단면.
   CASES[].shape.sections 에 시작 외벽 쪽부터 {width,height} 구간을
   나열하면, 끝면 polygon·외피 surface·두 전개 run·치수 정보를
   모두 이 파일에서 파생합니다. 계산/2D/3D는 이 파생 모델만 읽습니다.
   ══════════════════════════════════════════════════════════════ */

const SHAPE_SCHEMA_VERSION=1;

function shapeNumber(value,label,caseName){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0) throw new Error(`${caseName}: ${label}은 0보다 큰 숫자여야 합니다.`);
  return n;
}

function shapeId(value,fallback){
  const id=String(value||fallback).trim().replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"");
  return id||fallback;
}

function legacyShapeConfig(c){
  const totalW=shapeNumber(c.totalW,"totalW",c.name||c.id||"case");
  const highW=shapeNumber(c.highW,"highW",c.name||c.id||"case");
  const lowW=totalW-highW;
  if(lowW<=0) throw new Error(`${c.name||c.id}: totalW는 highW보다 커야 합니다.`);
  return {
    type:"stepped-profile",
    startSide:c.highSide||"left",
    startRunLabel:"높은 벽 직하강",
    profileRunLabel:"지붕→낮은 벽",
    sections:[
      {id:"high",label:"높은 구간",roofLabel:"높은 지붕",wallLabel:"높은 벽",width:highW,height:c.highH},
      {id:"low",label:"낮은 구간",roofLabel:"낮은 지붕",wallLabel:"낮은 벽",width:lowW,height:c.lowH}
    ]
  };
}

function normalizeCaseShape(c){
  const caseName=c.name||c.id||"case";
  const raw=c.shape&&Array.isArray(c.shape.sections)?c.shape:legacyShapeConfig(c);
  if(raw.schemaVersion!==undefined&&Number(raw.schemaVersion)!==SHAPE_SCHEMA_VERSION)
    throw new Error(`${caseName}: 지원하지 않는 shape.schemaVersion '${raw.schemaVersion}'입니다.`);
  if(raw.type&&raw.type!=="stepped-profile") throw new Error(`${caseName}: 지원하지 않는 shape.type '${raw.type}'입니다.`);
  if(!raw.sections.length) throw new Error(`${caseName}: shape.sections가 1개 이상 필요합니다.`);
  const startSide=raw.startSide||c.highSide||"left";
  if(startSide!=="left"&&startSide!=="right") throw new Error(`${caseName}: shape.startSide는 left 또는 right여야 합니다.`);

  let z=0;
  const ids=new Set();
  const sections=raw.sections.map((src,index)=>{
    const id=shapeId(src.id,`section-${index+1}`);
    if(ids.has(id)) throw new Error(`${caseName}: shape.sections id '${id}'가 중복됩니다.`);
    ids.add(id);
    const width=shapeNumber(src.width,`sections[${index}].width`,caseName);
    const height=shapeNumber(src.height,`sections[${index}].height`,caseName);
    const start=z, end=z+width; z=end;
    const label=String(src.label||`구간 ${index+1}`);
    return {
      id,index,label,width,height,start,end,
      roofLabel:String(src.roofLabel||`${label} 지붕`),
      wallLabel:String(src.wallLabel||`${label} 외벽`)
    };
  });

  const totalW=z;
  const heights=sections.map(s=>s.height);
  const maxHeight=Math.max(...heights), minHeight=Math.min(...heights);
  const startHeight=sections[0].height, endHeight=sections[sections.length-1].height;
  const endAreaMm2=sections.reduce((sum,s)=>sum+s.width*s.height,0);
  const surfaces=[];
  const makeSurface=(src)=>{
    const dz=src.z1-src.z0, dy=src.y1-src.y0, length=Math.hypot(dz,dy);
    return {...src,length,dz,dy};
  };

  const startSurface=makeSurface({
    key:`wall-start-${sections[0].id}`,kind:"startWall",label:sections[0].wallLabel,
    z0:0,y0:startHeight,z1:0,y1:0,normal:[0,0,-1],
    runKey:"high",runStart:0,startEdge:true,foldEdge:false,sectionId:sections[0].id
  });
  surfaces.push(startSurface);

  let profileAt=0;
  const profileSurfaces=[];
  const roofSurfaces=[];
  const stepSurfaces=[];
  sections.forEach((section,index)=>{
    const previous=sections[index-1];
    const roof=makeSurface({
      key:`roof-${section.id}`,kind:"roof",label:section.roofLabel,
      z0:section.start,y0:section.height,z1:section.end,y1:section.height,normal:[0,1,0],
      runKey:"drape",runStart:profileAt,startEdge:index===0,
      foldEdge:!!previous&&Math.abs(previous.height-section.height)>0.0001,sectionId:section.id
    });
    profileAt+=roof.length; profileSurfaces.push(roof); roofSurfaces.push(roof); surfaces.push(roof);
    const next=sections[index+1];
    if(next&&Math.abs(next.height-section.height)>0.0001){
      const dropping=next.height<section.height;
      const step=makeSurface({
        key:`step-${section.id}-${next.id}`,kind:"step",
        label:`${section.label}→${next.label} 단차`,
        z0:section.end,y0:section.height,z1:section.end,y1:next.height,
        normal:[0,0,dropping?1:-1],runKey:"drape",runStart:profileAt,
        startEdge:false,foldEdge:true,fromId:section.id,toId:next.id
      });
      profileAt+=step.length; profileSurfaces.push(step); stepSurfaces.push(step); surfaces.push(step);
    }
  });
  const endSurface=makeSurface({
    key:`wall-end-${sections[sections.length-1].id}`,kind:"endWall",
    label:sections[sections.length-1].wallLabel,
    z0:totalW,y0:endHeight,z1:totalW,y1:0,normal:[0,0,1],
    runKey:"drape",runStart:profileAt,startEdge:false,foldEdge:true,
    sectionId:sections[sections.length-1].id
  });
  profileAt+=endSurface.length; profileSurfaces.push(endSurface); surfaces.push(endSurface);

  const endPolygon=[[0,0],[0,startHeight]];
  profileSurfaces.forEach(s=>endPolygon.push([s.z1,s.y1]));
  const roofPathLength=roofSurfaces.reduce((sum,s)=>sum+s.length,0)+stepSurfaces.reduce((sum,s)=>sum+s.length,0);
  const startRunLabel=String(raw.startRunLabel||`${sections[0].wallLabel} 직하강`);
  const profileRunLabel=String(raw.profileRunLabel||`지붕→${sections[sections.length-1].wallLabel}`);
  const runs=[
    {
      key:"high",role:"start",name:startRunLabel,shortName:sections[0].wallLabel,
      width:startSurface.length,
      segments:[{key:startSurface.key,surfaceKey:startSurface.key,kind:startSurface.kind,label:startSurface.label,size:startSurface.length}]
    },
    {
      key:"drape",role:"profile",name:profileRunLabel,shortName:"반대 방향 외피",
      width:profileAt,
      segments:profileSurfaces.map(s=>({key:s.key,surfaceKey:s.key,kind:s.kind,label:s.label,size:s.length}))
    }
  ];

  const geometrySignature=sections.map(s=>`${s.width}x${s.height}`).join("|");
  return {
    schemaVersion:SHAPE_SCHEMA_VERSION,type:"stepped-profile",startSide,geometrySignature,
    sections,totalW,maxHeight,minHeight,startHeight,endHeight,endAreaMm2,endPolygon,
    surfaces,startSurface,profileSurfaces,roofSurfaces,stepSurfaces,endSurface,
    roofPathLength,profileRunWidth:profileAt,shellWidth:startSurface.length+profileAt,runs,
    startRunLabel,profileRunLabel,
    isLegacyLShape:sections.length===2,
    summary:sections.map(s=>`${s.label} ${fmt(s.width,1)}×${fmt(s.height,1)}`).join(" · ")
  };
}

/* 끝면에 원점 고정 격자를 씌웠을 때 단면과 교차하는 panel cell의 합집합. */
function shapeGridOccupancy(shape,tileW,tileH){
  const cells=new Set();
  shape.sections.forEach(section=>{
    const c0=floor(section.start/tileW), c1=ceil(section.end/tileW)-1;
    const r1=ceil(section.height/tileH)-1;
    for(let c=c0;c<=c1;c++) for(let r=0;r<=r1;r++) cells.add(`${c}:${r}`);
  });
  const byRow=new Map(), byCol=new Map();
  cells.forEach(key=>{
    const [c,r]=key.split(":").map(Number);
    byRow.set(r,(byRow.get(r)||0)+1);
    byCol.set(c,(byCol.get(c)||0)+1);
  });
  return {
    cells,perFace:cells.size,
    cols:ceil(shape.totalW/tileW),rows:ceil(shape.maxHeight/tileH),
    byRow:[...byRow.entries()].sort((a,b)=>a[0]-b[0]),
    byCol:[...byCol.entries()].sort((a,b)=>a[0]-b[0])
  };
}

function validateCaseCatalog(cases){
  if(!Array.isArray(cases)||!cases.length) throw new Error("CASES에 케이스가 1개 이상 필요합니다.");
  const ids=new Set();
  cases.forEach((c,index)=>{
    if(!c||typeof c!=="object") throw new Error(`CASES[${index}]는 객체여야 합니다.`);
    const id=String(c.id||"");
    if(!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`CASES[${index}].id는 영문·숫자·_·-만 사용할 수 있습니다.`);
    if(ids.has(id)) throw new Error(`CASES id '${id}'가 중복됩니다.`);
    ids.add(id);
    shapeNumber(c.L,"L",c.name||id);
    normalizeCaseShape(c);
  });
  return true;
}

validateCaseCatalog(CASES);
