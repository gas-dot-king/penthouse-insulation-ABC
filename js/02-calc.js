/* ══════════════════════════════════════════════════════════════
   수량 계산 엔진.
   base → runPlan/bandPlan → calc, 방향 비교 시나리오, 계단형 끝면 지오메트리.
   01-core.js와 01-geometry.js가 먼저 로드돼 있어야 합니다.
   ══════════════════════════════════════════════════════════════ */

/* ═══════════════ 공통 형상 계산 엔진 ═══════════════ */
function lengthMetrics(L, tile){
  const cols = ceil(L/tile);
  const last = L - tile*(cols-1);
  return {cols, last, trim:Math.max(0,tile-last)};
}

function base(c){
  const shape=normalizeCaseShape(c);
  const L=shapeNumber(c.L,"L",c.name||c.id||"case");
  const first=shape.sections[0], last=shape.sections[shape.sections.length-1];
  /* 아래 high/low alias는 이전 2단 전용 화면의 이행 호환용이다. 새 코드는 d.shape를 사용한다. */
  const highW=first.width, lowW=shape.totalW-first.width;
  const highH=first.height, lowH=last.height;
  const stepH=Math.abs(highH-lowH), drapeW=shape.roofPathLength;
  const len600 = lengthMetrics(L,TILE_S);
  const len1800 = lengthMetrics(L,TILE_L);
  const roofRows = ceil(drapeW/TILE_L);
  const fold = roofRows*TILE_L - drapeW;
  const reviewed=c.reviewedEnd;
  const reviewValid=!!reviewed&&reviewed.geometrySignature===shape.geometrySignature;
  const legacyReview=!c.shape&&Number.isFinite(Number(c.endMinPerFace));
  if(reviewValid&&!Number.isFinite(Number(reviewed.minPerFace)))
    throw new Error(`${c.name||c.id}: reviewedEnd.minPerFace가 필요합니다.`);
  const reviewedMin=reviewValid?Number(reviewed.minPerFace):(legacyReview?Number(c.endMinPerFace):undefined);
  const reviewedPractical=reviewValid?Number(reviewed.practicalPerFace??reviewed.minPerFace):(legacyReview?Number(c.endPracticalPerFace??c.endMinPerFace):undefined);
  return {
    ...c,L,shape,
    totalW:shape.totalW,maxHeight:shape.maxHeight,minHeight:shape.minHeight,
    highW,lowW,highH,lowH,stepH,drapeW,highSide:shape.startSide,
    profileSections:shape.sections,
    endMinPerFace:reviewedMin,
    endPracticalPerFace:reviewedPractical,
    endReviewValid:reviewValid||legacyReview,
    endReviewStale:!!reviewed&&!reviewValid,
    endNote:reviewValid?String(reviewed.note||"형상 서명과 일치하는 수동 검토값입니다."):(legacyReview?c.endNote:
      (reviewed?"형상 치수가 검토 서명과 달라 기존 혼합 수량을 비활성화했습니다. 가로/세로 고정 격자 중 적은 값을 사용합니다.":
      "수동 혼합 재단값이 없어 가로/세로 고정 격자 중 적은 값을 사용합니다.")),
    lenCols600:len600.cols, lenCols1800:len1800.cols,
    last600:len600.last, last1800:len1800.last,
    trim600:len600.trim, trim1800:len1800.trim,
    roofRows, fold
  };
}

function bandPlan(rem,d){
  if(rem <= 0.0001) return {rem:0, chosenSheets:0, stripSheets:0, horizontalSheets:0, chosen:"none", stripsPerSheet:0, horizontalRows:0};
  const stripsPerSheet = Math.max(1, floor(TILE_L/rem));
  const stripSheets = ceil(d.lenCols600 / stripsPerSheet);
  const horizontalRows = ceil(rem/TILE_S);
  const horizontalSheets = horizontalRows * d.lenCols1800;
  let chosen = "strip";
  let chosenSheets = stripSheets;
  if(horizontalSheets < stripSheets){chosen = "horizontal"; chosenSheets = horizontalSheets;}
  if(horizontalSheets === stripSheets){chosen = "horizontal-same"; chosenSheets = horizontalSheets;}
  return {rem, stripsPerSheet, stripSheets, horizontalRows, horizontalSheets, chosen, chosenSheets};
}

function wallPlan(height,d){
  const fullRows = floor(height/TILE_L);
  const rem = height - fullRows*TILE_L;
  const mainSheets = fullRows * d.lenCols600;
  const band = bandPlan(rem,d);
  const sheets = mainSheets + band.chosenSheets;
  return {height, fullRows, rem, mainSheets, band, sheets, actual:sqm(d.L*height), panel:panelArea(sheets)};
}

function runPlan(width,d,segments,name){
  const fullRows = floor(width/TILE_L);
  const rem = width - fullRows*TILE_L;
  const mainSheets = fullRows * d.lenCols600;
  const band = bandPlan(rem,d);
  const sheets = mainSheets + band.chosenSheets;
  return {
    name, width, fullRows, rem, mainSheets, band, sheets, segments,
    actual:sqm(d.L*width),
    panel:panelArea(sheets)
  };
}

/* 3D 비교용 긴 외피 시나리오.
   orientation="vertical" : 길이 600 × 전개 1800 본판 + 잔여띠 선택
   orientation="horizontal": 길이 1800 × 전개 600 가로 본판 + 독립 잔여띠 선택 */
function bandPlanByMode(rem,d,mode="auto"){
  const requestedMode=["auto","strip","horizontal"].includes(mode)?mode:"auto";
  const base=bandPlan(rem,d);
  if(base.chosen==="none") return {
    ...base,
    mode:requestedMode,
    resolved:"none",
    chosen:"none",
    chosenSheets:0,
    installedHeight:0,
    coveredDepth:0,
    lastBandDepth:0,
    heightTrim:0,
    runTrim:0,
    finalShortfall:0,
    sourceTrim:0,
    stripSourceTrim:0,
    lengthTrim:0,
    requiredStrips:0,
    producedStrips:0,
    unusedStrips:0
  };

  const autoResolved=isHorizontalBand(base)?"horizontal":"strip";
  const resolved=requestedMode==="auto"?autoResolved:requestedMode;
  const horizontal=resolved==="horizontal";
  const chosenSheets=horizontal?base.horizontalSheets:base.stripSheets;
  const coveredDepth=horizontal?base.horizontalRows*TILE_S:rem;
  const lastBandDepth=horizontal
    ? rem-(base.horizontalRows-1)*TILE_S
    : rem;
  const runTrim=Math.max(0,coveredDepth-rem);
  const stripSourceTrim=Math.max(0,TILE_L-base.stripsPerSheet*rem);
  const requiredStrips=d.lenCols600;
  const producedStrips=horizontal?0:chosenSheets*base.stripsPerSheet;
  return {
    ...base,
    mode:requestedMode,
    resolved,
    chosen:resolved,
    chosenSheets,
    installedHeight:coveredDepth,
    coveredDepth,
    lastBandDepth,
    heightTrim:runTrim,
    runTrim,
    finalShortfall:0,
    /* sourceTrim은 기존 표시 호환용, stripSourceTrim은 스트립 원판의 1800방향 잔재 */
    sourceTrim:horizontal?d.trim1800:stripSourceTrim,
    stripSourceTrim,
    lengthTrim:horizontal?d.trim1800:d.trim600,
    requiredStrips,
    producedStrips,
    unusedStrips:horizontal?0:Math.max(0,producedStrips-requiredStrips)
  };
}

function runScenarioPlan(run,d,orientation="vertical",bandMode="auto"){
  const resolvedOrientation=(orientation==="horizontal"||orientation==="H")
    ? "horizontal"
    : "vertical";
  const requestedBandMode=["auto","strip","horizontal"].includes(bandMode)
    ? bandMode
    : "auto";
  const horizontalMain=resolvedOrientation==="horizontal";
  const runSpan=horizontalMain?TILE_S:TILE_L;
  const lengthSpan=horizontalMain?TILE_L:TILE_S;
  const lengthCols=horizontalMain?d.lenCols1800:d.lenCols600;
  const lengthLast=horizontalMain?d.last1800:d.last600;
  const lengthTrim=horizontalMain?d.trim1800:d.trim600;
  const fullRows=floor(run.width/runSpan);
  const mainCovered=fullRows*runSpan;
  const rem=Math.max(0,run.width-mainCovered);
  const mainSheets=fullRows*lengthCols;
  /* 잔여 폭의 방향은 본판 방향과 독립적이다. */
  const band=bandPlanByMode(rem,d,requestedBandMode);
  const bandSheets=band.chosenSheets;
  const sheets=mainSheets+bandSheets;
  const coveredWidth=mainCovered+band.installedHeight;
  const finalShortfall=Math.max(0,run.width-coveredWidth);
  return {
    ...run,
    orientation:resolvedOrientation,
    bandMode:requestedBandMode,
    runSpan,
    lengthSpan,
    lengthCols,
    lengthLast,
    lengthTrim,
    length:{span:lengthSpan,cols:lengthCols,last:lengthLast,trim:lengthTrim},
    fullRows,
    mainCoverage:mainCovered,
    mainCovered,
    rem,
    mainSheets,
    band,
    bandSheets,
    sheets,
    panel:panelArea(sheets),
    coveredWidth,
    fittedWidth:mainCovered+rem,
    lastBandDepth:band.lastBandDepth,
    runTrim:band.runTrim,
    sourceTrim:band.sourceTrim,
    stripSourceTrim:band.stripSourceTrim,
    unusedStrips:band.unusedStrips,
    finalShortfall,
    exactFit:finalShortfall<=0.0001
  };
}

function shellPlan(d){
  const runs=d.shape.runs.map(def=>({
    ...runPlan(def.width,d,def.segments,def.name),
    key:def.key,role:def.role,shortName:def.shortName
  }));
  const highRun=runs.find(r=>r.key==="high")||runs[0];
  const roofLowRun=runs.find(r=>r.key==="drape")||runs[1];
  const width=runs.reduce((sum,r)=>sum+r.width,0);
  const segments=runs.map(r=>({key:r.key,label:r.name,size:r.width}));
  return {
    width,
    runs,
    highRun,
    roofLowRun,
    fullRows:runs.reduce((sum,r)=>sum+r.fullRows,0),
    rem:runs.reduce((sum,r)=>sum+r.rem,0),
    mainSheets:runs.reduce((sum,r)=>sum+r.mainSheets,0),
    sheets:runs.reduce((sum,r)=>sum+r.sheets,0),
    segments,
    actual:runs.reduce((sum,r)=>sum+r.actual,0),
    panel:runs.reduce((sum,r)=>sum+r.panel,0)
  };
}

function makeFoldOption(d,target){
  const foldToLow = target==="low" ? d.fold : 0;
  const foldToHigh = target==="high" ? d.fold : 0;
  const option = {
    target,
    label:foldTargetName(target)+"으로 접기",
    foldToLow,
    foldToHigh,
    lowWall:wallPlan(Math.max(0,d.lowH-foldToLow),d),
    highWall:wallPlan(Math.max(0,d.highH-foldToHigh),d)
  };
  option.wallSheets = option.lowWall.sheets + option.highWall.sheets;
  return option;
}

function chooseFold(lowFold,highFold){
  return lowFold.wallSheets <= highFold.wallSheets ? lowFold : highFold;
}

function endMetrics(d){
  const gridMin=Math.min(endHorizontalPlan(d).perFace,endVerticalPlan(d).perFace);
  const minPerFace=Number.isFinite(Number(d.endMinPerFace))?Number(d.endMinPerFace):gridMin;
  const practicalPerFace=Number.isFinite(Number(d.endPracticalPerFace))?Number(d.endPracticalPerFace):minPerFace;
  if(!Number.isInteger(minPerFace)||minPerFace<=0) throw new Error(`${d.name}: endMinPerFace는 1 이상의 정수여야 합니다.`);
  if(!Number.isInteger(practicalPerFace)||practicalPerFace<=0) throw new Error(`${d.name}: endPracticalPerFace는 1 이상의 정수여야 합니다.`);
  if(minPerFace<ceil(sqm(d.shape.endAreaMm2)/TILE_AREA)) throw new Error(`${d.name}: endMinPerFace가 끝면 면적 하한보다 작습니다.`);
  if(practicalPerFace<minPerFace) throw new Error(`${d.name}: endPracticalPerFace는 endMinPerFace 이상이어야 합니다.`);
  const perFace = endMode === "min" ? minPerFace : practicalPerFace;
  const sheets = perFace * 2;
  const areaOne = sqm(d.shape.endAreaMm2);
  return {
    perFace,minPerFace,practicalPerFace,source:Number.isFinite(Number(d.endMinPerFace))?"manual":"grid-fallback",
    sheets,
    areaOne,
    actual:areaOne*2,
    panel:panelArea(sheets)
  };
}

/* 양끝 계단형 단면 고정 방향안.
   구간별 직사각형을 따로 올림하지 않고 전체 단면에 원점 고정 격자를
   연속 적용한다. 단차를 가로지르는 부분행/부분열은 합집합으로 한 번만 센다. */
function endHorizontalPlan(d){
  const occ=shapeGridOccupancy(d.shape,TILE_L,TILE_S);
  const perFace=occ.perFace;
  const actualPerFace=sqm(d.shape.endAreaMm2);
  const panelPerFace=panelArea(perFace);
  return {
    id:"horizontal", ori:"H", name:"통합 가로",
    tw:TILE_L, th:TILE_S,
    allRows:occ.rows, allCols:occ.cols, occupiedCells:occ.cells, rowOccupancy:occ.byRow,
    summary:`점유 격자 ${occ.cols}열 × ${occ.rows}행 중 ${perFace}칸`,
    perFace, sheets:perFace*2,
    actualPerFace, panelPerFace,
    wastePerFace:panelPerFace-actualPerFace
  };
}

function endVerticalPlan(d){
  const occ=shapeGridOccupancy(d.shape,TILE_S,TILE_L);
  const perFace=occ.perFace;
  const actualPerFace=sqm(d.shape.endAreaMm2);
  const panelPerFace=panelArea(perFace);
  return {
    id:"vertical", ori:"V", name:"통합 세로",
    tw:TILE_S, th:TILE_L,
    allCols:occ.cols, allRows:occ.rows, occupiedCells:occ.cells, colOccupancy:occ.byCol,
    summary:`점유 격자 ${occ.cols}열 × ${occ.rows}단 중 ${perFace}칸`,
    perFace, sheets:perFace*2,
    actualPerFace, panelPerFace,
    wastePerFace:panelPerFace-actualPerFace
  };
}

function endPlanByOrientation(d,ori){
  return ori==="H" ? endHorizontalPlan(d) : endVerticalPlan(d);
}

/* 이전 이름은 다른 렌더러와의 호환을 위해 유지한다. */
function endBridgePlan(d){ return endHorizontalPlan(d); }

function calc(c){
  const d = base(c);
  const shell = shellPlan(d);
  const legacyComparisonSupported=d.shape.sections.length===2&&
    d.shape.sections[0].height>=d.shape.sections[1].height;
  const roofSheets = legacyComparisonSupported?d.roofRows*d.lenCols600:0;
  const roofPanel = panelArea(roofSheets);
  const roofActualWithoutFold = legacyComparisonSupported?sqm(d.L*d.drapeW):0;

  const lowFold = legacyComparisonSupported?makeFoldOption(d,"low"):null;
  const highFold = legacyComparisonSupported?makeFoldOption(d,"high"):null;
  const chosenFold = legacyComparisonSupported?chooseFold(lowFold,highFold):null;

  const ends = endMetrics(d);
  const endHorizontal = endBridgePlan(d);
  const endVertical = endPlanByOrientation(d,"V");

  const legacyLongSheets = legacyComparisonSupported?roofSheets+chosenFold.wallSheets:0;
  const totalSheets = shell.sheets + ends.sheets;
  const totalPanel = panelArea(totalSheets);
  const totalActual = shell.actual + ends.actual;
  const loss = totalPanel - totalActual;
  const lossRate = totalActual>0 ? loss/totalActual*100 : 0;

  return {
    d, shell, shellSheets:shell.sheets,
    roofSheets, roofPanel, roofActualWithoutFold,
    legacyComparisonSupported,lowFold, highFold, chosenFold,
    legacyLongSheets,
    endBridge:endHorizontal, endHorizontal, endVertical,
    endPerFace:ends.perFace, endSheets:ends.sheets,
    endMinPerFace:ends.minPerFace,endPracticalPerFace:ends.practicalPerFace,endCountSource:ends.source,
    endAreaOne:ends.areaOne, endActual:ends.actual, endPanel:ends.panel,
    totalSheets, totalPanel, totalActual, loss, lossRate
  };
}

/* 방향 시나리오 (비교표용) */
function rectLayout(w,h,ori){
  const tw=ori==="H"?TILE_L:TILE_S, th=ori==="H"?TILE_S:TILE_L;
  const cols=ceil(w/tw), rows=ceil(h/th);
  const lastW=w-tw*(cols-1), lastH=h-th*(rows-1);
  const trimW=Math.max(0,tw-lastW), trimH=Math.max(0,th-lastH);
  const sheets=cols*rows, actual=sqm(w*h), panel=panelArea(sheets);
  return {w,h,ori,tw,th,cols,rows,sheets,lastW,lastH,trimW,trimH,actual,panel,waste:panel-actual};
}

function roofPlanByOrientation(d,ori){
  const p=rectLayout(d.L,d.drapeW,ori);
  const fold=p.rows*p.th-d.drapeW;
  const usefulArea=sqm(d.L*(d.drapeW+fold));
  return {...p,fold,usefulArea,trimAfterFold:p.panel-usefulArea};
}

function foldPlanByOrientation(d,roofOri,wallMode){
  const roof=roofPlanByOrientation(d,roofOri);
  const wallCalc=h=>wallMode==="mixed"?wallPlan(h,d):rectLayout(d.L,h,wallMode);
  const make=target=>{
    const lowH=Math.max(0,d.lowH-(target==="low"?roof.fold:0));
    const highH=Math.max(0,d.highH-(target==="high"?roof.fold:0));
    const lowWall=wallCalc(lowH), highWall=wallCalc(highH);
    return {target,lowH,highH,lowWall,highWall,wallSheets:lowWall.sheets+highWall.sheets};
  };
  const low=make("low"), high=make("high");
  return {roof,low,high,chosen:low.wallSheets<=high.wallSheets?low:high};
}

function scenarioCalc(c){
  const d=base(c);
  if(!(d.shape.sections.length===2&&d.shape.sections[0].height>=d.shape.sections[1].height))
    throw new Error(`${d.name}: 이전 분리식 시나리오는 하강하는 2구간 형상에만 사용할 수 있습니다.`);
  const verticalMixed=foldPlanByOrientation(d,"V","mixed");
  const horizontalMixed=foldPlanByOrientation(d,"H","mixed");
  const allH=foldPlanByOrientation(d,"H","H");
  const allV=foldPlanByOrientation(d,"V","V");
  const endH=endPlanByOrientation(d,"H"), endV=endPlanByOrientation(d,"V");
  const pack=(plan,endSheets)=>({
    total:plan.roof.sheets+plan.chosen.wallSheets+endSheets,
    roof:plan.roof.sheets,walls:plan.chosen.wallSheets,ends:endSheets,
    fold:plan.roof.fold,target:plan.chosen.target
  });
  const ends=endMetrics(d);
  const baseline=pack(verticalMixed,ends.minPerFace*2);
  const practical=pack(verticalMixed,ends.practicalPerFace*2);
  const roofHorizontal=pack(horizontalMixed,ends.minPerFace*2);
  const fixedH=pack(allH,endH.sheets);
  const fixedV=pack(allV,endV.sheets);
  const automatic=baseline.total<=roofHorizontal.total?{...baseline,source:"baseline"}:{...roofHorizontal,source:"roofHorizontal"};
  return {d,baseline,practical,roofHorizontal,fixedH,fixedV,automatic,endH,endV};
}

/* ═══════════════ 도형 지오메트리 (정규화된 계단형 단면 공용) ═══════════════ */
function endFaceGeo(d,ex,ey,sc){
  const shape=d.shape, tw=shape.totalW*sc, hh=shape.maxHeight*sc;
  const right=shape.startSide==="right";
  const sx=z=>right?ex+(shape.totalW-z)*sc:ex+z*sc;
  const sy=y=>ey+(shape.maxHeight-y)*sc;
  const points=shape.endPolygon.map(([z,y])=>[sx(z),sy(y)]);
  const path=points.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" ")+" Z";
  const first=shape.sections[0], last=shape.sections[shape.sections.length-1];
  const highX=Math.min(sx(first.start),sx(first.end));
  const lowX=Math.min(sx(last.start),sx(last.end));
  const boundaryX=sx(first.end);
  return {
    hw:first.width*sc,lw:last.width*sc,hh,st:Math.abs(first.height-last.height)*sc,
    tw,right,path,points,sx,sy,highX,lowX,boundaryX
  };
}
