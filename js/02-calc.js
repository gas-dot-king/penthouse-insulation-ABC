/* ══════════════════════════════════════════════════════════════
   수량 계산 엔진.
   base → wallPlan/bandPlan → calc, 방향 비교 시나리오, L자 옆면 지오메트리.
   01-core.js 의 상수·유틸이 먼저 로드돼 있어야 합니다.
   ══════════════════════════════════════════════════════════════ */

/* ═══════════════ 계산 엔진 (기존 로직 유지) ═══════════════ */
function lengthMetrics(L, tile){
  const cols = ceil(L/tile);
  const last = L - tile*(cols-1);
  return {cols, last, trim:Math.max(0,tile-last)};
}

function base(c){
  const lowW = c.totalW - c.highW;
  const stepH = c.highH - c.lowH;
  const drapeW = c.highW + stepH + lowW;
  const len600 = lengthMetrics(c.L,TILE_S);
  const len1800 = lengthMetrics(c.L,TILE_L);
  const roofRows = ceil(drapeW/TILE_L);
  const fold = roofRows*TILE_L - drapeW;
  return {
    ...c, lowW, stepH, drapeW,
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

function shellPlan(d){
  const highRun = runPlan(d.highH,d,[
    {key:"highWall", label:"높은 벽", size:d.highH}
  ],"높은 벽 직하강");
  const roofLowRun = runPlan(d.highW + d.stepH + d.lowW + d.lowH,d,[
    {key:"highRoof", label:"높은 지붕", size:d.highW},
    {key:"step", label:"단차", size:d.stepH},
    {key:"lowRoof", label:"낮은 지붕", size:d.lowW},
    {key:"lowWall", label:"낮은 벽", size:d.lowH}
  ],"지붕·낮은 벽 하강");
  const width = highRun.width + roofLowRun.width;
  const segments = [
    {key:"highWall", label:"높은 벽 직하강", size:highRun.width},
    {key:"roofLow", label:"지붕·낮은 벽 하강", size:roofLowRun.width}
  ];
  return {
    width,
    runs:[highRun,roofLowRun],
    highRun,
    roofLowRun,
    fullRows:highRun.fullRows + roofLowRun.fullRows,
    rem:highRun.rem + roofLowRun.rem,
    mainSheets:highRun.mainSheets + roofLowRun.mainSheets,
    sheets:highRun.sheets + roofLowRun.sheets,
    segments,
    actual:highRun.actual + roofLowRun.actual,
    panel:highRun.panel + roofLowRun.panel
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
  const perFace = endMode === "min" ? d.endMinPerFace : d.endPracticalPerFace;
  const sheets = perFace * 2;
  const areaOne = sqm(d.highW*d.highH + d.lowW*d.lowH);
  return {
    perFace,
    sheets,
    areaOne,
    actual:areaOne*2,
    panel:panelArea(sheets)
  };
}

function endBridgePlan(d){
  const fullWidthRows = ceil(d.lowH/TILE_S);
  const fullWidthCols = ceil(d.totalW/TILE_L);
  const fullWidthSheets = fullWidthRows * fullWidthCols;
  const highOnlyRows = ceil(d.stepH/TILE_S);
  const highOnlyCols = ceil(d.highW/TILE_L);
  const highOnlySheets = highOnlyRows * highOnlyCols;
  const perFace = fullWidthSheets + highOnlySheets;
  const actualPerFace = sqm(d.highW*d.highH + d.lowW*d.lowH);
  return {
    name:"가로 브리지",
    perFace,
    sheets:perFace*2,
    fullWidthRows,
    fullWidthCols,
    fullWidthSheets,
    highOnlyRows,
    highOnlyCols,
    highOnlySheets,
    actualPerFace,
    panelPerFace:panelArea(perFace),
    wastePerFace:panelArea(perFace)-actualPerFace
  };
}

function calc(c){
  const d = base(c);
  const shell = shellPlan(d);
  const roofSheets = d.roofRows * d.lenCols600;
  const roofPanel = panelArea(roofSheets);
  const roofActualWithoutFold = sqm(d.L*d.drapeW);

  const lowFold = makeFoldOption(d,"low");
  const highFold = makeFoldOption(d,"high");
  const chosenFold = chooseFold(lowFold,highFold);

  const ends = endMetrics(d);
  const endHorizontal = endBridgePlan(d);
  const endVertical = endPlanByOrientation(d,"V");

  const legacyLongSheets = roofSheets + chosenFold.wallSheets;
  const totalSheets = shell.sheets + ends.sheets;
  const totalPanel = panelArea(totalSheets);
  const totalActual = shell.actual + ends.actual;
  const loss = totalPanel - totalActual;
  const lossRate = totalActual>0 ? loss/totalActual*100 : 0;

  return {
    d, shell, shellSheets:shell.sheets,
    roofSheets, roofPanel, roofActualWithoutFold,
    lowFold, highFold, chosenFold,
    legacyLongSheets,
    endBridge:endHorizontal, endHorizontal, endVertical,
    endPerFace:ends.perFace, endSheets:ends.sheets,
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

function endPlanByOrientation(d,ori){
  const high=rectLayout(d.highW,d.highH,ori), low=rectLayout(d.lowW,d.lowH,ori);
  const perFace=high.sheets+low.sheets;
  const actualPerFace=sqm(d.highW*d.highH+d.lowW*d.lowH);
  const panelPerFace=panelArea(perFace);
  return {ori,high,low,perFace,sheets:perFace*2,actualPerFace,panelPerFace,wastePerFace:panelPerFace-actualPerFace};
}

function scenarioCalc(c){
  const d=base(c);
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
  const baseline=pack(verticalMixed,c.endMinPerFace*2);
  const practical=pack(verticalMixed,c.endPracticalPerFace*2);
  const roofHorizontal=pack(horizontalMixed,c.endMinPerFace*2);
  const fixedH=pack(allH,endH.sheets);
  const fixedV=pack(allV,endV.sheets);
  const automatic=baseline.total<=roofHorizontal.total?{...baseline,source:"baseline"}:{...roofHorizontal,source:"roofHorizontal"};
  return {d,baseline,practical,roofHorizontal,fixedH,fixedV,automatic,endH,endV};
}

/* ═══════════════ 도형 지오메트리 (정면 L자, 높은 쪽 좌/우 반영) ═══════════════ */
function endFaceGeo(d,ex,ey,sc){
  const hw=d.highW*sc, lw=d.lowW*sc, hh=d.highH*sc, st=d.stepH*sc, tw=(d.highW+d.lowW)*sc;
  const right=d.highSide==="right";
  const path = right
    ? `M${ex},${ey+st} H${ex+lw} V${ey} H${ex+tw} V${ey+hh} H${ex} Z`
    : `M${ex},${ey} H${ex+hw} V${ey+st} H${ex+tw} V${ey+hh} H${ex} Z`;
  const highX = right ? ex+lw : ex;
  const lowX  = right ? ex : ex+hw;
  const boundaryX = right ? ex+lw : ex+hw;
  return {hw,lw,hh,st,tw,right,path,highX,lowX,boundaryX};
}
