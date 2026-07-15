/* ══════════════════════════════════════════════════════════════
   3D 덮기 뷰 — 캔버스 입체 도면.
   정규화된 계단형 단면을 길이 방향으로 압출해 3D로 그리고, 보온재가
   두 전용 메뉴에서 외피 run 또는 양끝 단면만 따로 보여줍니다.
   01-core / 02-calc / 03-render(bandCompareLabel)가 먼저 로드돼야 하며,
   04-visual.js 의 draw()가 shell3d/ends3d일 때 draw3D()를 부릅니다.
   ══════════════════════════════════════════════════════════════ */

const V3D={
  x:null, model:null,
  yaw:2.18, pitch:0.42, zoom:1, presetId:"iso",
  step:0, playing:false, playT:0, lastTs:0, playStep:1, uiKey:"",
  scope:"shell", endLayout:"mixed",
  runOrientation:{high:"vertical",drape:"vertical"},
  bandMode:{high:"auto",drape:"auto"},
  raf:0, canvas:null, ctx:null, ro:null,
  lastPX:0, lastPY:0, hoverInfo:null, hotspots:[]
};
const V3D_SPEED=2000;   /* 재생 속도: 초당 전개 mm */
const V3D_GAP=0.6;      /* 재생 시 단계 사이 멈춤(초) */
const V3D_STEPS=["구조만","높은벽만","지붕→낮은 벽만","전체 덮음"];
const V3D_FONT="'Segoe UI','Noto Sans KR',Arial,sans-serif";
const V3D_END_LAYOUTS=[
  {id:"mixed", label:"가로+세로 혼합"},
  {id:"horizontal", label:"가로"},
  {id:"vertical", label:"세로"}
];

function v3dEndPlan(m,id=V3D.endLayout){
  const x=m.x;
  if(id==="horizontal") return {...x.endHorizontal,id,label:"가로 연속 격자",short:"가로"};
  if(id==="vertical") return {...x.endVertical,id,label:"세로 연속 격자",short:"세로"};
  if(x.endCountSource!=="manual"){
    const fallback=x.endHorizontal.perFace<=x.endVertical.perFace?x.endHorizontal:x.endVertical;
    return {...fallback,id:"mixed",renderId:fallback.id,
      label:`검토값 없음 · ${fallback.id==="horizontal"?"가로":"세로"} 자동`,
      short:`자동 ${fallback.id==="horizontal"?"가로":"세로"}`,manual:false,fallback:true};
  }
  return {
    id:"mixed", label:"가로+세로 혼합 재단", short:"혼합",
    perFace:x.endPerFace, sheets:x.endSheets,
    actualPerFace:x.endAreaOne,
    panelPerFace:panelArea(x.endPerFace),
    wastePerFace:panelArea(x.endPerFace)-x.endAreaOne,
    manual:true
  };
}

function v3dBaseRun(m,key){ return key==="high"?m.hr:m.dr; }

function v3dRunPlan(m,key,orientation=V3D.runOrientation[key],bandMode=V3D.bandMode[key]){
  return runScenarioPlan(v3dBaseRun(m,key),m.d,orientation,bandMode);
}

function v3dRunPlans(m){ return {high:v3dRunPlan(m,"high"),drape:v3dRunPlan(m,"drape")}; }

function v3dScenarioTotal(m){
  if(V3D.scope==="ends") return v3dEndPlan(m).sheets;
  const p=v3dRunPlans(m);
  return p.high.sheets+p.drape.sheets;
}

function v3dMm(n,digits){
  const d=digits===undefined?(Math.abs(n-Math.round(n))>0.0001?1:0):digits;
  return fmt(n,d);
}

function v3dOrientationName(p){ return p.orientation==="horizontal"?"가로 본판":"세로 본판"; }
function v3dBandName(b){
  if(b.resolved==="horizontal") return "가로 밴드";
  if(b.resolved==="strip") return "세로 스트립";
  return "잔여 없음";
}

function v3dPresets(){
  const s=(V3D.model&&V3D.model.d.shape.startSide==="right")?-1:1; /* 설정한 시작 외벽 쪽을 화면에 반영 */
  const compact=typeof window!=="undefined"&&window.innerWidth<=600;
  return {
    iso:{name:"비스듬히", yaw:s*(compact?1.88:2.18), pitch:compact?0.36:0.42},
    front:{name:"정면 단면", yaw:s*Math.PI/2, pitch:0.10},
    top:{name:"위에서", yaw:s*2.18, pitch:1.30}
  };
}

/* ═══════════════ 모델: 공통 단면 surface를 길이 방향으로 압출 ═══════════════ */
function v3dModel(x){
  const d=x.d;
  const shape=d.shape, L=d.L, W=shape.totalW, hh=shape.maxHeight;
  const hr=x.shell.highRun, dr=x.shell.roofLowRun;
  const faces=shape.surfaces.map(s=>({
    key:s.key,kind:s.kind,name:`${s.label} ${fmt(s.length,1)}`,
    O:[0,s.y0,s.z0],U:[1,0,0],V:[0,s.dy/s.length,s.dz/s.length],
    uLen:L,vLen:s.length,n:s.normal,run:s.runKey,runStart:s.runStart,
    startEdge:s.startEdge,foldEdge:s.foldEdge,surface:s
  }));
  const endPoly=shape.endPolygon;
  const ends=[
    {key:"end0", x:0, n:[-1,0,0], poly:endPoly},
    {key:"end1", x:L, n:[1,0,0],  poly:endPoly}
  ];
  return {x,d,shape,L,W,hh,minHeight:shape.minHeight,hr,dr,faces,ends,
    startFace:faces.find(f=>f.kind==="startWall"),
    profileFaces:faces.filter(f=>f.run==="drape"),
    firstRoof:faces.find(f=>f.kind==="roof"),
    stepFaces:faces.filter(f=>f.kind==="step"),
    runWHigh:hr.width, runWDrape:dr.width};
}

function v3dFacePoint(f,u,v){
  return [f.O[0]+f.U[0]*u+f.V[0]*v, f.O[1]+f.U[1]*u+f.V[1]*v, f.O[2]+f.U[2]*u+f.V[2]*v];
}

/* 전개 좌표(모서리에서부터의 거리) → 해당 면과 면 안의 위치 */
function v3dRunLocate(m,runKey,sPos){
  const fs=m.faces.filter(f=>f.run===runKey);
  for(const f of fs){ if(sPos<=f.runStart+f.vLen+1e-6) return {f, v:Math.max(0,sPos-f.runStart)}; }
  const f=fs[fs.length-1];
  return {f, v:f.vLen};
}

/* ═══════════════ 단계/재생 → 덮인 범위(mm) ═══════════════ */
function v3dPlayState(m){
  const cov={high:0, drape:0, ends:0};
  const plans=v3dRunPlans(m), hp=plans.high, dp=plans.drape;
  let t=V3D.playT;
  const phases=[
    {step:1, dur:Math.max(.25,hp.mainCovered/V3D_SPEED), set:f=>{cov.high=hp.mainCovered*f;}},
    {step:2, dur:Math.max(.25,dp.mainCovered/V3D_SPEED), set:f=>{cov.drape=dp.mainCovered*f;}},
    {step:3, dur:2.0, set:f=>{cov.high=hp.mainCovered+(hp.width-hp.mainCovered)*f; cov.drape=dp.mainCovered+(dp.width-dp.mainCovered)*f;}}
  ];
  for(const p of phases){
    if(t>=p.dur+V3D_GAP){ p.set(1); t-=p.dur+V3D_GAP; }
    else { p.set(Math.min(1,t/p.dur)); return {cov, step:p.step, done:false}; }
  }
  return {cov, step:3, done:t>0.4};
}

function v3dCoverage(m){
  if(V3D.scope==="ends") return {high:0,drape:0,ends:1};
  if(V3D.playing) return v3dPlayState(m).cov;
  const s=V3D.step;
  const p=v3dRunPlans(m);
  return {
    high:  s===1||s>=3 ? p.high.width  : 0,
    drape: s===2||s>=3 ? p.drape.width : 0,
    ends: 0
  };
}

function v3dEffStep(){ return V3D.playing ? V3D.playStep : V3D.step; }

/* ═══════════════ 진입점 (04-visual draw()에서 호출) ═══════════════ */
function draw3D(x,scope="shell"){
  const nextScope=scope==="ends"?"ends":"shell";
  const scopeChanged=V3D.scope!==nextScope;
  V3D.scope=nextScope;
  V3D.x=x;
  V3D.model=v3dModel(x);
  const fresh=v3dEnsureDom();
  if(scopeChanged){
    v3dStop();
    V3D.step=nextScope==="ends"?1:0;
    V3D.zoom=1;
    V3D.uiKey="";
    v3dApplyPreset("iso");
  }else if(V3D.presetId) v3dApplyPreset(V3D.presetId);
  v3dSyncScopeDom();
  V3D.uiKey="";
  const enterShell=nextScope==="shell"&&(fresh||scopeChanged);
  if(enterShell){ V3D.step=0; v3dPlay(); return; }
  if(V3D.playing) v3dStop();
  v3dSyncUI();
  v3dRepaint();
}

/* ═══════════════ DOM 구성 + 이벤트 ═══════════════ */
function v3dScenarioCardHTML(key,title,sub){
  return `<section class="v3d-scenario-card" data-run-card="${key}" aria-labelledby="v3dTitle-${key}">
    <div class="v3d-card-head">
      <div class="v3d-card-title" id="v3dTitle-${key}">${title}<small>${sub}</small></div>
      <strong class="v3d-card-count" id="v3dRunCount-${key}">-장</strong>
    </div>
    <div class="v3d-choice-row">
      <span class="v3d-choice-label">본판 방향</span>
      <div class="seg" id="v3dOri-${key}" aria-label="${title} 본판 방향">
        <button type="button" data-run-orientation="vertical" data-run-key="${key}">세로</button>
        <button type="button" data-run-orientation="horizontal" data-run-key="${key}">가로</button>
      </div>
    </div>
    <div class="v3d-choice-row">
      <span class="v3d-choice-label">잔여 폭 처리</span>
      <div class="seg" id="v3dBand-${key}" aria-label="${title} 잔여 폭 처리">
        <button type="button" data-band-mode="auto" data-run-key="${key}">자동</button>
        <button type="button" data-band-mode="horizontal" data-run-key="${key}">가로 밴드</button>
        <button type="button" data-band-mode="strip" data-run-key="${key}">세로 스트립</button>
      </div>
    </div>
    <output class="v3d-scenario-status" id="v3dRunStatus-${key}" aria-live="polite"></output>
  </section>`;
}

function v3dDimensionsHTML(m){
  const d=m.d;
  const endsOnly=V3D.scope==="ends";
  const hFit=m.x.endHorizontal.widthFit;
  const vFit=m.x.endVertical.widthFit;
  const fitLine=fit=>`${v3dMm(fit.span)}mm ÷ ${v3dMm(fit.panelSpan)}mm = ${fmt(fit.exact,3)}장 → ${fit.cols}열 · 마지막 ${v3dMm(fit.lastUsed)}mm 사용 / ${v3dMm(fit.offcut)}mm 절단 자투리`;
  const chips=[
    ["길이 L",d.L],["전체 폭 W",d.shape.totalW],
    ...d.shape.sections.flatMap(s=>[[`${s.label} 폭`,s.width],[`${s.label} 높이`,s.height]]),
    ...d.shape.stepSurfaces.map(s=>[s.label,s.length]),
    ["지붕·단차 전개",d.shape.roofPathLength],[`${d.shape.profileRunLabel} 전체 run`,m.dr.width]
  ].map(v=>`<div class="v3d-dim-chip"><span>${esc(v[0])}</span><b>${v3dMm(v[1])} mm</b></div>`).join("");
  const rows=CASES.map(c=>{
    const q=base(c), active=c.id===d.id;
    const steps=q.shape.stepSurfaces.length?q.shape.stepSurfaces.map(s=>`${s.label} ${fmt(s.length,1)}`).join(" · "):"없음";
    return `<tr${active?' class="active"':''}>
      <th scope="row">${esc(c.name)}</th>
      <td>${fmt(q.L,1)}</td><td>${fmt(q.totalW,1)}</td>
      <td>${esc(q.shape.summary)}</td><td>${esc(steps)}</td>
      <td>${fmt(q.shape.roofPathLength,1)}</td><td>${fmt(q.shape.profileRunWidth,1)}</td>
      <td>${q.shape.startSide==="left"?"왼쪽":"오른쪽"}</td>
    </tr>`;
  }).join("");
  const fitAudit=endsOnly
    ?`<section class="v3d-fit-audit" aria-label="끝면 폭별 보온재 정확 수량">
        <b>폭 방향 실제 끝판 계산 <small>면당 총 장수와는 별개인 ‘한 줄의 폭’ 계산입니다.</small></b>
        <p><strong>가로 1,800mm 기준</strong> ${fitLine(hFit)}</p>
        <p><strong>세로 600mm 기준</strong> ${fitLine(vFit)}</p>
        <small>예: 가로 1,800mm 기준의 열 수는 폭을 덮는 열 개수입니다. 계단 형상 전체의 적용 수량은 아래 배치안의 ${v3dEndPlan(m).perFace}장/면을 따릅니다.</small>
      </section>`
    :`<section class="v3d-fit-audit v3d-fit-audit-shell" aria-label="외피와 양끝면 범위 안내">
        <b>이 메뉴의 범위</b>
        <p>높은 벽 → 지붕·단차 → 낮은 벽까지의 긴 외피만 포함합니다. 양끝 계단 단면 ${v3dEndPlan(m).sheets}장은 별도 ‘3D 양끝면’ 메뉴에서 배치와 절단 여유를 검토합니다.</p>
      </section>`;
  return `<div class="v3d-dim-head"><b>${esc(d.name)} 구조 치수</b><span>단위 mm · 모든 치수선과 설명은 구조물 바깥에만 배치</span></div>
    <div class="v3d-dim-grid">${chips}</div>
    ${fitAudit}
    <div class="v3d-case-table-wrap">
      <table class="v3d-case-table">
        <caption class="sr-only">구조물 전체 단면 치수 비교</caption>
        <thead><tr><th>구조</th><th>길이 L</th><th>전체 폭 W</th><th>단면 구간(폭×높이)</th><th>단차</th><th>지붕·단차 전개</th><th>반대 run</th><th>시작 외벽 쪽</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function v3dEnsureDom(){
  if(byId("v3dCanvas")) return false;
  byId("svgWrap").innerHTML=`
  <div class="v3d" id="v3dRoot" data-scope="shell">
    <div class="v3d-bar v3d-shell-only">
      <div class="seg" id="v3dSteps">${V3D_STEPS.map((t,i)=>`<button data-step="${i}">${t}</button>`).join("")}</div>
      <div class="seg" id="v3dViews">${Object.entries(v3dPresets()).map(([id,p])=>`<button data-pv="${id}">${p.name}</button>`).join("")}</div>
    </div>
    <div class="v3d-endbar v3d-ends-only">
      <b>양끝면 배치 방향</b>
      <div class="seg" id="v3dEndLayouts">${V3D_END_LAYOUTS.map(p=>`<button data-end-layout="${p.id}">${p.label}</button>`).join("")}</div>
      <span id="v3dEndStatus">앞·뒤 끝면을 같은 계단 단면으로 검토</span>
    </div>
    <output class="v3d-totalbar" id="v3dScenarioTotal" aria-live="polite"></output>
    <div class="v3d-stage" id="v3dStage">
      <canvas id="v3dCanvas"></canvas>
      <div class="v3d-hint" id="v3dHint">드래그 회전 · 휠 확대/축소 · 더블클릭 시점 초기화</div>
      <div class="v3d-hover-tip" id="v3dHoverTip" role="tooltip" hidden></div>
    </div>
    <div class="v3d-scenario-grid v3d-shell-only">
      ${v3dScenarioCardHTML("high","① 시작 외벽","시작 모서리 → 바닥")}
      ${v3dScenarioCardHTML("drape","② 반대 방향 외피","지붕·단차를 접어 반대 외벽 바닥까지")}
    </div>
    <section class="v3d-dim-panel" id="v3dDimensions" aria-label="구조 치수"></section>
    <div class="v3d-info" id="v3dInfo"></div>
  </div>`;
  const cv=byId("v3dCanvas");
  V3D.canvas=cv; V3D.ctx=cv.getContext("2d");

  qsa("#v3dSteps button").forEach(b=>b.addEventListener("click",()=>{ v3dStop(); v3dSetStep(Number(b.dataset.step)); }));
  qsa("#v3dViews button").forEach(b=>b.addEventListener("click",()=>{
    V3D.zoom=1; v3dApplyPreset(b.dataset.pv); v3dSyncUI(); v3dRepaint();
  }));
  qsa("[data-run-orientation]").forEach(b=>b.addEventListener("click",()=>{
    const key=b.dataset.runKey;
    v3dStop();
    V3D.runOrientation[key]=b.dataset.runOrientation;
    V3D.step=Math.max(V3D.step,key==="high"?1:2);
    V3D.uiKey="";
    v3dSyncUI(); v3dRepaint();
  }));
  qsa("[data-band-mode]").forEach(b=>b.addEventListener("click",()=>{
    const key=b.dataset.runKey;
    v3dStop();
    V3D.bandMode[key]=b.dataset.bandMode;
    V3D.step=Math.max(V3D.step,3);
    V3D.uiKey="";
    v3dSyncUI(); v3dRepaint();
  }));
  qsa("#v3dEndLayouts button").forEach(b=>b.addEventListener("click",()=>{
    V3D.endLayout=b.dataset.endLayout;
    V3D.uiKey="";
    v3dSyncUI();
    if(!V3D.playing) v3dRepaint();
  }));

  let pid=null;
  cv.addEventListener("pointerdown",e=>{ v3dHideWasteHover(); pid=e.pointerId; cv.setPointerCapture(pid); V3D.lastPX=e.clientX; V3D.lastPY=e.clientY; });
  cv.addEventListener("pointermove",e=>{
    if(pid===null){ v3dShowWasteHover(e); return; }
    const dx=e.clientX-V3D.lastPX, dy=e.clientY-V3D.lastPY;
    V3D.lastPX=e.clientX; V3D.lastPY=e.clientY;
    V3D.yaw+=dx*0.0075;
    V3D.pitch=Math.min(1.45,Math.max(-0.12,V3D.pitch+dy*0.006));
    V3D.presetId=null;
    v3dActivePresetBtns();
    if(!V3D.playing) v3dRepaint();
  });
  const up=()=>{ pid=null; };
  cv.addEventListener("pointerup",up);
  cv.addEventListener("pointercancel",up);
  cv.addEventListener("pointerleave",v3dHideWasteHover);
  cv.addEventListener("wheel",e=>{
    e.preventDefault();
    const minZoom=V3D.scope==="ends"?.75:.35;
    const maxZoom=V3D.scope==="ends"?1.18:4;
    V3D.zoom=Math.min(maxZoom,Math.max(minZoom,V3D.zoom*Math.exp(-e.deltaY*0.0012)));
    if(!V3D.playing) v3dRepaint();
  },{passive:false});
  cv.addEventListener("dblclick",()=>{ V3D.zoom=1; v3dApplyPreset("iso"); v3dSyncUI(); if(!V3D.playing) v3dRepaint(); });

  if(V3D.ro) V3D.ro.disconnect();
  V3D.ro=new ResizeObserver(()=>{ if(byId("v3dCanvas")===cv) v3dRepaint(); });
  V3D.ro.observe(byId("v3dStage"));
  return true;
}

function v3dWasteHoverText(info){
  if(!info) return "";
  if(info.text) return String(info.text);
  const panel=Number(info.panel)||0, actual=Number(info.actual)||0;
  const waste=Math.max(0,panel-actual);
  return [
    "보온재 남는 면적",
    info.title||"현재 3D 배치",
    `${fmt(waste,2)}㎡`,
    `투입 ${fmt(panel,2)}㎡ − 실제 피복 ${fmt(actual,2)}㎡`,
    info.note||"재사용 가능 여부는 포함하지 않습니다."
  ].join("\n");
}

function v3dEndSectionCutAlertText(fit){
  if(typeof endSectionCutAlertText==="function") return endSectionCutAlertText(fit,"가로 배치");
  return [
    "구간별 절단 자투리",
    `${fit.label} · 가로 배치`,
    `${v3dMm(fit.height)}mm ÷ ${v3dMm(fit.panelSpan)}mm = ${fmt(fit.exact,3)}장 → ${fit.cols}행`,
    `마지막 장 사용폭 ${v3dMm(fit.lastUsed)}mm`,
    `마지막 보온재에서 ${v3dMm(fit.offcut)}mm가 남습니다.`
  ].join("\n");
}

function v3dSetWasteHover(info){
  V3D.hoverInfo=info||null;
  V3D.hotspots=[];
  v3dHideWasteHover();
}

function v3dHideWasteHover(){
  if(typeof document==="undefined") return;
  const tip=byId("v3dHoverTip");
  if(tip) tip.hidden=true;
  if(V3D.canvas) V3D.canvas.style.cursor="";
}

function v3dShowWasteHover(e){
  if(typeof document==="undefined") return;
  const tip=byId("v3dHoverTip"), stage=byId("v3dStage");
  const cv=V3D.canvas;
  let hot=null;
  if(cv&&V3D.hotspots.length){
    const canvasRect=cv.getBoundingClientRect();
    const px=e.clientX-canvasRect.left, py=e.clientY-canvasRect.top;
    hot=V3D.hotspots
      .map(v=>({...v,distance:Math.hypot(px-v.x,py-v.y)}))
      .filter(v=>v.distance<=(v.radius||14))
      .sort((a,b)=>a.distance-b.distance)[0]||null;
  }
  const copy=v3dWasteHoverText(hot?{text:hot.text}:V3D.hoverInfo);
  if(cv) cv.style.cursor=hot?"help":"";
  if(!tip||!stage||!copy) return;
  const rect=stage.getBoundingClientRect();
  tip.textContent=copy;
  tip.hidden=false;
  tip.style.left=`${Math.max(8,Math.min(rect.width-270,e.clientX-rect.left+14))}px`;
  tip.style.top=`${Math.max(8,Math.min(rect.height-126,e.clientY-rect.top+14))}px`;
}

function v3dSyncScopeDom(){
  const root=byId("v3dRoot");
  if(!root) return;
  const endsOnly=V3D.scope==="ends";
  root.dataset.scope=endsOnly?"ends":"shell";
  qsa(".v3d-shell-only",root).forEach(el=>{ el.hidden=endsOnly; });
  qsa(".v3d-ends-only",root).forEach(el=>{ el.hidden=!endsOnly; });
  if(byId("v3dHint")) setText("v3dHint",endsOnly
    ?"드래그 회전 · 휠 확대/축소 · 치수는 외곽 표기"
    :"드래그 회전 · 휠 확대/축소 · 더블클릭 시점 초기화");
}

function v3dApplyPreset(id){
  const p=v3dPresets()[id];
  if(!p) return;
  V3D.presetId=id; V3D.yaw=p.yaw; V3D.pitch=p.pitch;
}

function v3dActivePresetBtns(){
  if(byId("v3dViews")) qsa("#v3dViews button").forEach(b=>{
    const on=b.dataset.pv===V3D.presetId;
    b.classList.toggle("active",on); b.setAttribute("aria-pressed",String(on));
  });
}

function v3dSetStep(i){ V3D.step=i; v3dSyncUI(); v3dRepaint(); }

/* ═══════════════ 재생 ═══════════════ */
function v3dPlay(){
  V3D.playing=true; V3D.playT=0; V3D.lastTs=0; V3D.playStep=1;
  cancelAnimationFrame(V3D.raf);
  V3D.raf=requestAnimationFrame(v3dTick);
}

function v3dStop(){
  if(!V3D.playing) return;
  V3D.playing=false;
  cancelAnimationFrame(V3D.raf);
}

function v3dTick(ts){
  if(!V3D.playing) return;
  if(!V3D.lastTs) V3D.lastTs=ts;
  V3D.playT+=(ts-V3D.lastTs)/1000; V3D.lastTs=ts;
  const st=v3dPlayState(V3D.model);
  V3D.playStep=st.step;
  if(st.done){ v3dStop(); V3D.step=3; }
  v3dSyncUI();
  v3dRepaint();
  if(V3D.playing) V3D.raf=requestAnimationFrame(v3dTick);
}

/* ═══════════════ 단계 정보 패널 ═══════════════ */
function v3dCumSheets(m,step){
  if(V3D.scope==="ends") return v3dEndPlan(m).sheets;
  const p=v3dRunPlans(m);
  let n=0;
  if(step>=1) n+=p.high.mainSheets;
  if(step>=2) n+=p.drape.mainSheets;
  if(step>=3) n+=p.high.bandSheets+p.drape.bandSheets;
  return n;
}

function v3dShownSheets(m,step){
  if(V3D.scope==="ends") return v3dEndPlan(m).sheets;
  const p=v3dRunPlans(m);
  if(step===1) return p.high.sheets;
  if(step===2) return p.drape.sheets;
  if(step>=3) return p.high.sheets+p.drape.sheets;
  return 0;
}

function v3dRunStatusHTML(m,key,plan=v3dRunPlan(m,key)){
  const b=plan.band;
  const main=`${v3dMm(plan.width)}mm = ${fmt(plan.runSpan)} × ${plan.fullRows} + ${v3dMm(plan.rem)}mm`;
  const length=`길이 ${v3dMm(m.L)}mm: ${fmt(plan.lengthSpan)}폭 ${plan.lengthCols}열, 마지막 ${v3dMm(plan.lengthLast)}mm 사용 / ${v3dMm(plan.lengthTrim)}mm 절단`;
  let finish="잔여 폭 없음 · 본판만으로 딱 맞음";
  if(b.resolved==="horizontal"){
    finish=`가로 밴드 ${b.horizontalRows}행 × ${m.d.lenCols1800}열 = ${b.chosenSheets}장 · 마지막 행 폭 ${v3dMm(b.lastBandDepth)}mm 사용 / ${v3dMm(b.runTrim)}mm 절단`;
  }else if(b.resolved==="strip"){
    const lastUsed=Math.max(0,b.requiredStrips-b.stripsPerSheet*(b.chosenSheets-1));
    const lastSourceRemain=Math.max(0,TILE_L-lastUsed*plan.rem);
    const regular=b.chosenSheets>1?`앞 원판마다 1800축 ${v3dMm(b.stripSourceTrim)}mm 잔여 · `:"";
    finish=`세로 스트립 ${v3dMm(plan.rem)}×600mm · 원판 1장→${b.stripsPerSheet}줄, 총 ${b.chosenSheets}장 · ${regular}마지막 원판 ${lastUsed}줄 사용 후 ${v3dMm(lastSourceRemain)}mm 잔여`;
  }
  const auto=plan.bandMode==="auto"&&b.resolved!=="none"?`자동 최소 → ${v3dBandName(b)} · `:"";
  return `<strong>${v3dOrientationName(plan)} ${plan.mainSheets}장 + 잔여 ${b.chosenSheets}장 = ${plan.sheets}장</strong><br>
    ${main}: 본판만으로 딱 맞지 않음 · <b>${v3dMm(plan.rem)}mm 미덮임</b><br>
    ${auto}${finish}<br>${length} · <b>적용 후 부족 ${v3dMm(plan.finalShortfall)}mm</b>`;
}

function v3dInfoHTML(m,step){
  if(V3D.scope==="ends") return v3dEndInfoHTML(m);
  const d=m.d, plans=v3dRunPlans(m), hr=plans.high, dr=plans.drape;
  const runDefs=Object.fromEntries(d.shape.runs.map(r=>[r.key,r]));
  const startDef=runDefs.high, profileDef=runDefs.drape;
  const scenarioTotal=v3dScenarioTotal(m);
  const sectionText=d.shape.sections
    .map(s=>`${s.label} ${fmt(s.width,1)}×${fmt(s.height,1)}mm`)
    .join(" · ");
  const profileText=profileDef.segments.map(s=>`${s.label} ${fmt(s.size,1)}`).join(" → ");
  const items=[
    {t:`${d.name} — 덮기 전 구조`,
     p:`길이 L ${fmt(d.L,1)} × 전체 폭 W ${fmt(d.totalW,1)}mm. ${sectionText}. 지붕·단차 경로 ${fmt(d.shape.roofPathLength,1)}mm, 마지막 외벽까지 포함한 반대 방향 run은 ${fmt(dr.width,1)}mm입니다.`},
    {t:`높은벽만 · ${v3dOrientationName(hr)} — ${fmt(hr.sheets)}장`,
     p:`${startDef.segments.map(s=>s.label).join(" → ")} 방향만 끝까지 덮어 표시합니다. 본판 뒤 ${fmt(hr.rem,1)}mm는 ${v3dBandName(hr.band)}로 마감한 상태입니다.`},
    {t:`지붕→낮은 벽만 · ${v3dOrientationName(dr)} — ${fmt(dr.sheets)}장`,
     p:`${profileDef.name} 경로(${profileText})만 모서리에서 접어 끝까지 덮어 표시합니다. 본판 뒤 ${fmt(dr.rem,1)}mm는 ${v3dBandName(dr.band)}로 마감한 상태입니다.`},
    {t:`전체 덮음 — ${fmt(scenarioTotal)}장`,
     p:`높은 벽과 지붕→낮은 벽을 모두 끝까지 덮은 상태입니다. 위 카드에서 본판 방향과 잔여 폭 처리 방식을 바꾸면 장수와 절단 잔여가 즉시 바뀝니다. 양끝면은 별도 3D 메뉴에서 검토합니다.`}
  ];
  const it=items[Math.min(Math.max(step,0),3)];
  const shown=V3D.playing?v3dCumSheets(m,step):v3dShownSheets(m,step);
  const sum=step>0
    ?`<div class="sum">표시 수량 ${fmt(shown)}장 / 이 배치 합계 ${fmt(scenarioTotal)}장${V3D.playing?" · 재생 중":""}</div>`
    :`<div class="sum">천장 전개를 열면 덮는 애니메이션을 먼저 보여준 뒤, 원하는 상태를 선택할 수 있습니다.</div>`;
  return `<b class="t">${it.t}</b><p>${it.p}</p>${sum}`;
}

function v3dEndInfoHTML(m){
  const ep=v3dEndPlan(m), h=m.x.endHorizontal.widthFit, v=m.x.endVertical.widthFit;
  const layout=ep.renderId||ep.id;
  const layoutName=layout==="horizontal"?"가로 1,800×600 격자":layout==="vertical"?"세로 600×1,800 격자":"가로·세로 혼합 개념";
  const hText=`전체 W ${v3dMm(h.span)}mm ÷ ${v3dMm(h.panelSpan)}mm = ${fmt(h.exact,3)}장 → ${h.cols}열 · 마지막 열 ${v3dMm(h.lastUsed)}mm 사용 / ${v3dMm(h.offcut)}mm 절단 자투리`;
  const vText=`세로 600mm 기준은 ${fmt(v.exact,3)}장 → ${v.cols}열 · 마지막 열 ${v3dMm(v.lastUsed)}mm 사용 / ${v3dMm(v.offcut)}mm 절단 자투리`;
  const source=ep.manual
    ?"현재 적용안은 형상 서명과 일치하는 혼합 재단 검토값입니다. 그림은 방향 개념도이며 개별 절단 조각의 1:1 재단도는 아닙니다."
    :"수동 검토값이 없거나 형상이 달라져 가로·세로 고정 격자 중 적은 안을 자동 적용합니다.";
  return `<b class="t">양끝 계단 단면 · ${layoutName}</b>
    <p>앞·뒤는 같은 계단 단면입니다. ${ep.perFace}장/면 × 2면 = <strong>${ep.sheets}장</strong>입니다. <strong>가로 폭 기준:</strong> ${hText}. ${vText}. 이 ‘${h.cols}열’은 한 줄의 폭 방향 수량이며, 면당 ${ep.perFace}장이라는 전체 수량과 구분해 판단합니다. ${source}</p>
    <div class="sum">가로 고정 ${m.x.endHorizontal.perFace}장/면 · 세로 고정 ${m.x.endVertical.perFace}장/면 · 현재 ${ep.short} ${ep.perFace}장/면</div>`;
}

function v3dSyncUI(){
  if(!byId("v3dSteps")||!V3D.model) return;
  if(V3D.scope==="ends"){ v3dSyncEndUI(); return; }
  const eff=v3dEffStep();
  const runDefs=Object.fromEntries(V3D.model.d.shape.runs.map(r=>[r.key,r]));
  qsa("#v3dSteps button").forEach(b=>{
    const i=Number(b.dataset.step);
    b.textContent=V3D_STEPS[i];
    const on=i===eff;
    b.classList.toggle("active",on); b.setAttribute("aria-pressed",String(on));
  });
  v3dActivePresetBtns();
  const plans=v3dRunPlans(V3D.model);
  ["high","drape"].forEach(key=>{
    const selected=plans[key];
    const def=runDefs[key];
    const order=key==="high"?"①":"②";
    setHTML(`v3dTitle-${key}`,`${order} ${esc(def.name)}<small>${esc(def.segments.map(s=>s.label).join(" → "))}</small>`);
    ["vertical","horizontal"].forEach(ori=>{
      const p=v3dRunPlan(V3D.model,key,ori,V3D.bandMode[key]);
      const b=document.querySelector(`[data-run-orientation="${ori}"][data-run-key="${key}"]`);
      if(!b) return;
      b.textContent=`${ori==="vertical"?"세로":"가로"} ${p.sheets}장`;
      b.title=`${ori==="vertical"?"길이 600 · 전개 1800":"길이 1800 · 전개 600"}mm · 잔여 포함 ${p.sheets}장`;
      const on=ori===V3D.runOrientation[key];
      b.classList.toggle("active",on); b.setAttribute("aria-pressed",String(on));
    });
    const bandPlans={
      auto:v3dRunPlan(V3D.model,key,V3D.runOrientation[key],"auto"),
      horizontal:v3dRunPlan(V3D.model,key,V3D.runOrientation[key],"horizontal"),
      strip:v3dRunPlan(V3D.model,key,V3D.runOrientation[key],"strip")
    };
    qsa(`#v3dBand-${key} button`).forEach(b=>{
      const mode=b.dataset.bandMode, p=bandPlans[mode];
      const label=mode==="auto"?`자동(${p.band.resolved==="horizontal"?"가로":"세로"})`:mode==="horizontal"?"가로 밴드":"세로 스트립";
      b.textContent=`${label} ${p.bandSheets}장`;
      b.title=`본판 뒤 ${v3dMm(p.rem)}mm 미덮임 · ${label} ${p.bandSheets}장 · 적용 후 부족 ${v3dMm(p.finalShortfall)}mm`;
      const on=mode===V3D.bandMode[key];
      b.classList.toggle("active",on); b.setAttribute("aria-pressed",String(on));
    });
    setText(`v3dRunCount-${key}`,`${selected.sheets}장`);
    setHTML(`v3dRunStatus-${key}`,v3dRunStatusHTML(V3D.model,key,selected));
  });
  const shellSheets=plans.high.sheets+plans.drape.sheets;
  setHTML("v3dScenarioTotal",`<small>선택 외피 ${shellSheets}장 (${plans.high.sheets} + ${plans.drape.sheets}) · 양끝면은 별도 3D 메뉴에서 검토</small><strong>긴 외피 ${shellSheets}장</strong>`);
  const key="shell|"+V3D.model.d.id+"|"+eff+"|"+V3D.model.d.shape.geometrySignature+"|"+
    V3D.runOrientation.high+"|"+V3D.runOrientation.drape+"|"+
    V3D.bandMode.high+"|"+V3D.bandMode.drape+"|"+V3D.playing;
  if(key!==V3D.uiKey){
    V3D.uiKey=key;
    setHTML("v3dInfo",v3dInfoHTML(V3D.model,eff));
    setHTML("v3dDimensions",v3dDimensionsHTML(V3D.model));
  }
}

function v3dSyncEndUI(){
  const m=V3D.model, ep=v3dEndPlan(m);
  qsa("#v3dEndLayouts button").forEach(b=>{
    const p=v3dEndPlan(m,b.dataset.endLayout);
    const meta=V3D_END_LAYOUTS.find(v=>v.id===p.id);
    b.textContent=`${p.fallback?p.short:(meta?meta.label:p.short)} ${p.perFace}장/면`;
    b.classList.toggle("active",p.id===V3D.endLayout);
    b.setAttribute("aria-pressed",String(p.id===V3D.endLayout));
  });
  const h=m.x.endHorizontal.widthFit;
  setText("v3dEndStatus",`${ep.manual?"검토된 혼합 적용안":"고정 격자 비교안"} · W ${v3dMm(h.span)} ÷ 1,800 = ${fmt(h.exact,3)}장 → ${h.cols}열 · 마지막 ${v3dMm(h.lastUsed)}mm / 자투리 ${v3dMm(h.offcut)}mm`);
  setHTML("v3dScenarioTotal",`<small>앞·뒤 동일 계단 단면 · ${ep.perFace}장/면 × 2면 · 가로 고정 ${m.x.endHorizontal.perFace}장/면 · 세로 고정 ${m.x.endVertical.perFace}장/면</small><strong>양끝 ${ep.sheets}장</strong>`);
  const key="ends|"+m.d.id+"|"+m.d.shape.geometrySignature+"|"+V3D.endLayout;
  if(key!==V3D.uiKey){
    V3D.uiKey=key;
    setHTML("v3dInfo",v3dEndInfoHTML(m));
    setHTML("v3dDimensions",v3dDimensionsHTML(m));
  }
}

/* ═══════════════ 양끝면 전용 3D 그리기 ═══════════════ */
function v3dRepaintEnds(){
  const m=V3D.model, cv=V3D.canvas;
  if(!m||!cv) return;
  const ctx=V3D.ctx, dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth||10, h=cv.clientHeight||10;
  const bw=Math.round(w*dpr), bh=Math.round(h*dpr);
  if(cv.width!==bw||cv.height!==bh){ cv.width=bw; cv.height=bh; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);

  const d=m.d, shape=d.shape, ep=v3dEndPlan(m), layoutId=ep.renderId||ep.id;
  const hFit=m.x.endHorizontal.widthFit;
  const widthFit=layoutId==="vertical"?m.x.endVertical.widthFit:hFit;
  const spanLabel=layoutId==="vertical"?"세로 600mm 기준":"가로 1,800mm 기준";
  v3dSetWasteHover({
    title:`양끝면 ${ep.short} 배치`,
    panel:ep.panelPerFace*2,
    actual:ep.actualPerFace*2,
    note:`1면 기준 ${spanLabel} ${fmt(widthFit.exact,3)}장 → ${widthFit.cols}열 · 마지막 ${v3dMm(widthFit.lastUsed)}mm 사용 / 끝단 절단폭 ${v3dMm(widthFit.offcut)}mm. 투입 대비 면적차이며 재사용 가능 여부는 포함하지 않습니다.`
  });

  /* 실제 길이 L은 너무 길어 끝면이 보이지 않으므로, 두 끝면 사이의 표시 깊이만 축소한다.
     회전 투영 자체는 긴 외피 3D와 같은 yaw/pitch 공식을 사용한다. */
  const depth=Math.max(900,Math.min(2600,shape.totalW*.36));
  const cyw=Math.cos(V3D.yaw), syw=Math.sin(V3D.yaw);
  const cp=Math.cos(V3D.pitch), sp=Math.sin(V3D.pitch);
  const ctr=[depth/2,shape.maxHeight/2,shape.totalW/2];
  const rot=p=>{
    const px=p[0]-ctr[0], py=p[1]-ctr[1], pz=p[2]-ctr[2];
    const x1=px*cyw+pz*syw, z1=-px*syw+pz*cyw;
    return [x1,z1*sp-py*cp,py*sp+z1*cp];
  };
  const rotN=n=>n[1]*sp+(-n[0]*syw+n[2]*cyw)*cp;
  const dimOff=Math.max(460,Math.min(880,shape.totalW*.13));
  /* 높은/낮은 구간의 높이 치수는 실제 단면의 서로 반대 외곽 레일에 둔다.
     화면 회전은 startSide에 따라 반전되므로, 첫(높은) 구간은 좌측·마지막
     (낮은) 구간은 우측 레일로 고정하면 각각 자기 구간 옆에 붙는다. */
  const sectionDimSide=index=>index===0?"left":"right";
  const sectionDimOutside=index=>{
    const side=sectionDimSide(index);
    const sameSideBefore=shape.sections.slice(0,index)
      .filter((_,i)=>sectionDimSide(i)===side).length;
    const gap=dimOff*(.72+sameSideBefore*.22);
    return side==="left"?-gap:shape.totalW+gap;
  };
  const bound=[];
  const add=p=>bound.push(rot(p));
  [0,depth].forEach(x=>{
    shape.endPolygon.forEach(pt=>add([x,pt[1],pt[0]]));
    add([x,-dimOff,0]); add([x,-dimOff,shape.totalW]);
    add([x,shape.maxHeight+dimOff,0]); add([x,shape.maxHeight+dimOff,shape.totalW]);
    shape.sections.forEach((section,index)=>{
      add([x,section.height+dimOff*(.42+index*.16),section.start]);
      add([x,section.height+dimOff*(.42+index*.16),section.end]);
      const outside=sectionDimOutside(index);
      add([x,0,outside]); add([x,section.height,outside]);
    });
  });
  let bx0=Infinity,bx1=-Infinity,by0=Infinity,by1=-Infinity;
  bound.forEach(p=>{ bx0=Math.min(bx0,p[0]); bx1=Math.max(bx1,p[0]); by0=Math.min(by0,p[1]); by1=Math.max(by1,p[1]); });
  const scale=Math.max(.01,Math.min((w-56)/Math.max(1,bx1-bx0),(h-124)/Math.max(1,by1-by0))*V3D.zoom);
  const ox=w/2-(bx0+bx1)/2*scale, oy=(h-18)/2-(by0+by1)/2*scale+22;
  const P=p=>{ const r=rot(p); return [ox+r[0]*scale,oy+r[1]*scale,r[2]]; };
  const Q=(x,z,y)=>P([x,y,z]);

  const line=(a,b,color="#64748b",width=1,dash=[])=>{
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]);
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  const path=pts=>{ ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); };
  const poly=(pts,fill,stroke,width=1)=>{
    path(pts);
    if(fill){ ctx.fillStyle=fill; ctx.fill(); }
    if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=width; ctx.stroke(); }
  };
  const shade=(hex,f)=>{
    const c=parseInt(hex.slice(1),16);
    return `rgb(${Math.round(((c>>16)&255)*f)},${Math.round(((c>>8)&255)*f)},${Math.round((c&255)*f)})`;
  };
  const label=(x,y,text,o={})=>{
    const size=o.size||(w<620?8.5:10.5), pad=4;
    ctx.font=`700 ${size}px ${V3D_FONT}`;
    const tw=ctx.measureText(text).width, ww=tw+pad*2, hh=size+pad*2;
    const lx=Math.max(3,Math.min(w-ww-3,x-ww/2)), ly=Math.max(54,Math.min(h-hh-5,y-hh/2));
    ctx.fillStyle="rgba(255,255,255,.94)"; ctx.fillRect(lx,ly,ww,hh);
    ctx.strokeStyle="rgba(100,116,139,.42)"; ctx.lineWidth=.8; ctx.strokeRect(lx,ly,ww,hh);
    ctx.fillStyle=o.color||"#334155"; ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText(text,lx+pad,ly+hh/2+.25);
  };
  const dim=(a3,b3,text,o={})=>{
    const a=P(a3), b=P(b3), dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
    if(len<16) return;
    const nx=-dy/len, ny=dx/len, color=o.color||"#475569", tick=4;
    if(o.extA) line(P(o.extA),a,"rgba(71,85,105,.48)",.85,[3,3]);
    if(o.extB) line(P(o.extB),b,"rgba(71,85,105,.48)",.85,[3,3]);
    line(a,b,color,1.05);
    line([a[0]-nx*tick,a[1]-ny*tick],[a[0]+nx*tick,a[1]+ny*tick],color,1.1);
    line([b[0]-nx*tick,b[1]-ny*tick],[b[0]+nx*tick,b[1]+ny*tick],color,1.1);
    label((a[0]+b[0])/2+nx*(o.offset||12),(a[1]+b[1])/2+ny*(o.offset||12),text,{size:o.size,color});
  };

  const faceColor=layoutId==="horizontal"?"#ffedd5":layoutId==="vertical"?"#dbeafe":"#ede9fe";
  function drawFace(x,normal){
    const pts=shape.endPolygon.map(pt=>Q(x,pt[0],pt[1]));
    const visible=rotN(normal)>0.02;
    poly(pts,shade(faceColor,visible?1:.84),null);
    ctx.save(); path(pts); ctx.clip();
    const grid=(z0,y0,z1,y1,color,width=1,dash=[])=>line(Q(x,z0,y0),Q(x,z1,y1),color,width,dash);
    if(layoutId==="horizontal"){
      for(let y=TILE_S;y<shape.maxHeight-1;y+=TILE_S) grid(0,y,shape.totalW,y,"rgba(194,65,12,.60)",1);
      for(let z=TILE_L;z<shape.totalW-1;z+=TILE_L) grid(z,0,z,shape.maxHeight,"rgba(194,65,12,.82)",1.2);
    }else if(layoutId==="vertical"){
      for(let z=TILE_S;z<shape.totalW-1;z+=TILE_S) grid(z,0,z,shape.maxHeight,"rgba(37,99,235,.60)",.95);
      for(let y=TILE_L;y<shape.maxHeight-1;y+=TILE_L) grid(0,y,shape.totalW,y,"rgba(29,78,216,.84)",1.2);
    }else{
      const bandH=Math.min(TILE_S,shape.minHeight);
      poly([Q(x,0,0),Q(x,shape.totalW,0),Q(x,shape.totalW,bandH),Q(x,0,bandH)],"rgba(255,223,181,.9)",null);
      for(let z=TILE_S;z<shape.totalW-1;z+=TILE_S) grid(z,bandH,z,shape.maxHeight,"rgba(124,58,237,.58)",.9);
      for(let y=bandH+TILE_L;y<shape.maxHeight-1;y+=TILE_L) grid(0,y,shape.totalW,y,"rgba(109,40,217,.78)",1.1);
      for(let z=TILE_L;z<shape.totalW-1;z+=TILE_L) grid(z,0,z,bandH,"rgba(194,65,12,.82)",1.15);
      grid(0,bandH,shape.totalW,bandH,"#c2410c",1.2,[6,4]);
    }
    const lastStart=Math.max(0,(hFit.cols-1)*TILE_L);
    poly([Q(x,lastStart,0),Q(x,shape.totalW,0),Q(x,shape.totalW,shape.maxHeight),Q(x,lastStart,shape.maxHeight)],"rgba(251,191,36,.16)",null);
    ctx.restore();
    poly(pts,null,"#111827",1.45);
  }

  const items=[];
  for(let i=0;i<shape.endPolygon.length;i++){
    const a=shape.endPolygon[i], b=shape.endPolygon[(i+1)%shape.endPolygon.length];
    const pts=[Q(0,a[0],a[1]),Q(0,b[0],b[1]),Q(depth,b[0],b[1]),Q(depth,a[0],a[1])];
    const dep=pts.reduce((sum,p)=>sum+p[2],0)/pts.length;
    items.push({dep,draw:()=>poly(pts,i%2?"#cbd5e1":"#e2e8f0","#94a3b8",.8)});
  }
  [{x:0,n:[-1,0,0]},{x:depth,n:[1,0,0]}].forEach(face=>{
    const dep=rot([face.x,shape.maxHeight/2,shape.totalW/2])[2];
    items.push({dep,draw:()=>drawFace(face.x,face.n)});
  });
  items.sort((a,b)=>a.dep-b.dep).forEach(item=>item.draw());

  /* 치수는 단면 밖 레일에만 표기한다. */
  const dimFace=[{x:0,n:[-1,0,0]},{x:depth,n:[1,0,0]}].sort((a,b)=>rotN(b.n)-rotN(a.n))[0];
  dim([dimFace.x,-dimOff,0],[dimFace.x,-dimOff,shape.totalW],`전체 W ${v3dMm(shape.totalW)}mm`,{offset:13});
  shape.sections.forEach((section,index)=>{
    const railY=section.height+dimOff*(.42+index*.16);
    dim([dimFace.x,railY,section.start],[dimFace.x,railY,section.end],`${section.label} W ${v3dMm(section.width)}mm`,{offset:index%2?11:-11,size:w<620?7.5:9});
    const side=sectionDimSide(index);
    const outside=sectionDimOutside(index);
    const edgeZ=side==="left"?section.start:section.end;
    dim([dimFace.x,0,outside],[dimFace.x,section.height,outside],`${section.label} H ${v3dMm(section.height)}mm`,{
      offset:index%2?12:-12,size:w<620?7.5:9,
      extA:[dimFace.x,0,edgeZ],extB:[dimFace.x,section.height,edgeZ]
    });
  });

  /* 가로 비교 배치에서 구간 높이마다 생기는 마지막 절단 자투리를 면적 여유와
     분리해 빨간 경고 표식으로 보여 준다. 혼합·세로 화면에서도 '가로'라고
     명시해 비교값임을 유지한다. 앞쪽 끝면 한 곳만 표기해도 양끝은 동일
     단면이므로 같은 절단폭이 반복된다. */
  {
    const fits=m.x.endHorizontal.sectionHeightFits||[];
    fits.forEach(fit=>{
      if(Number(fit.offcut)<=0.0001) return;
      const section=shape.sections.find(v=>v.id===fit.sectionId);
      if(!section) return;
      const anchor=Q(dimFace.x,(section.start+section.end)/2,section.height);
      const toLeft=anchor[0]<w/2;
      const badgeX=Math.max(17,Math.min(w-17,anchor[0]+(toLeft?-24:24)));
      const badgeY=Math.max(62,Math.min(h-68,anchor[1]+18));
      line(anchor,[badgeX,badgeY],"#dc2626",1.4,[3,2]);
      ctx.beginPath(); ctx.arc(badgeX,badgeY,10,0,Math.PI*2);
      ctx.fillStyle="#dc2626"; ctx.fill();
      ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
      ctx.font=`900 ${w<620?11:13}px ${V3D_FONT}`;
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#fff";
      ctx.fillText("!",badgeX,badgeY+.5);
      ctx.font=`800 ${w<620?8:10}px ${V3D_FONT}`;
      ctx.textAlign=toLeft?"end":"start"; ctx.fillStyle="#b91c1c";
      ctx.fillText(`가로 ${v3dMm(fit.offcut)}mm`,badgeX+(toLeft?-13:13),badgeY+.5);
      V3D.hotspots.push({x:badgeX,y:badgeY,radius:18,text:v3dEndSectionCutAlertText(fit)});
    });
    ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  }

  const exactLine=`${spanLabel}: W ${v3dMm(widthFit.span)} ÷ ${v3dMm(widthFit.panelSpan)} = ${fmt(widthFit.exact,3)}장 → ${widthFit.cols}열 · 마지막 ${v3dMm(widthFit.lastUsed)}mm / 절단폭 ${v3dMm(widthFit.offcut)}mm`;
  ctx.font=`800 ${w<620?8.5:10.5}px ${V3D_FONT}`;
  const noteW=Math.min(w-24,ctx.measureText(exactLine).width+24);
  ctx.fillStyle="rgba(255,251,235,.97)"; ctx.fillRect((w-noteW)/2,h-43,noteW,30);
  ctx.strokeStyle="#f59e0b"; ctx.lineWidth=1; ctx.strokeRect((w-noteW)/2,h-43,noteW,30);
  ctx.fillStyle="#92400e"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(exactLine,w/2,h-28);
  ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  ctx.font=`800 ${w<620?10:13}px ${V3D_FONT}`; ctx.fillStyle="#111827";
  ctx.fillText(`${d.name} · 양끝면 회전 3D`,16,25);
  ctx.font=`600 ${w<620?8:10.5}px ${V3D_FONT}`; ctx.fillStyle="#64748b";
  ctx.fillText(`앞·뒤 동일 단면 · 실제 사이 길이 L ${v3dMm(d.L)}mm · 선택 ${ep.short} ${ep.perFace}장/면 × 2 = ${ep.sheets}장`,16,43);
}

/* ═══════════════ 천장 전개 3D 그리기 ═══════════════ */
function v3dRepaint(){
  const m=V3D.model, cv=V3D.canvas;
  if(!m||!cv) return;
  if(!cv.isConnected){ v3dStop(); return; }
  if(V3D.scope==="ends") return v3dRepaintEnds();
  const ctx=V3D.ctx, dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth||10, h=cv.clientHeight||10;
  const compact=w<560;
  const bw=Math.round(w*dpr), bh=Math.round(h*dpr);
  if(cv.width!==bw||cv.height!==bh){ cv.width=bw; cv.height=bh; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);

  const X=m.x, d=m.d, plans=v3dRunPlans(m), hr=plans.high, dr=plans.drape;
  const cov=v3dCoverage(m);
  const eff=v3dEffStep();
  v3dSetWasteHover({
    title:"천장 전개 · 선택 배치",
    panel:hr.panel+dr.panel,
    actual:m.x.shell.actual,
    note:`${v3dOrientationName(hr)} + ${v3dOrientationName(dr)} 기준입니다. 본판과 잔여띠를 모두 포함한 투입 대비 면적차이며, 재사용 가능 여부는 포함하지 않습니다.`
  });

  /* 회전(요·피치) + 화면 맞춤. 깊이는 클수록 화면 앞. */
  const cyw=Math.cos(V3D.yaw), syw=Math.sin(V3D.yaw);
  const cp=Math.cos(V3D.pitch), sp=Math.sin(V3D.pitch);
  const ctr=[m.L/2, m.hh/2, m.W/2];
  const rot=p=>{
    const px=p[0]-ctr[0], py=p[1]-ctr[1], pz=p[2]-ctr[2];
    const x1=px*cyw+pz*syw, z1=-px*syw+pz*cyw;
    return [x1, z1*sp-py*cp, py*sp+z1*cp];
  };
  const rotN=n=>n[1]*sp+(-n[0]*syw+n[2]*cyw)*cp;

  let bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;
  m.ends.forEach(e=>e.poly.forEach(pt=>{
    const r=rot([e.x,pt[1],pt[0]]);
    bx0=Math.min(bx0,r[0]); bx1=Math.max(bx1,r[0]);
    by0=Math.min(by0,r[1]); by1=Math.max(by1,r[1]);
  }));
  const dimOff=Math.max(520,Math.min(1100,Math.max(m.W,m.hh)*0.11));
  [0,m.L].forEach(x=>[
    [x,-dimOff,-dimOff],[x,m.hh+dimOff,-dimOff],
    [x,-dimOff,m.W+dimOff],[x,m.hh+dimOff,m.W+dimOff]
  ].forEach(p=>{
    const r=rot(p); bx0=Math.min(bx0,r[0]); bx1=Math.max(bx1,r[0]); by0=Math.min(by0,r[1]); by1=Math.max(by1,r[1]);
  }));
  const scale=Math.min((w-76)/Math.max(1,bx1-bx0),(h-110)/Math.max(1,by1-by0))*V3D.zoom;
  const ox=w/2-(bx0+bx1)/2*scale, oy=h/2-(by0+by1)/2*scale+8;
  const P=p=>{ const r=rot(p); return [ox+r[0]*scale, oy+r[1]*scale, r[2]]; };

  /* 조명(월드 고정) */
  const LD=[0.42,0.82,-0.40], LL=Math.hypot(LD[0],LD[1],LD[2]);
  const lum=n=>0.68+0.32*Math.max(0,(n[0]*LD[0]+n[1]*LD[1]+n[2]*LD[2])/LL);
  const shade=(hex,f)=>{
    const c=parseInt(hex.slice(1),16);
    return `rgb(${Math.round(((c>>16)&255)*f)},${Math.round(((c>>8)&255)*f)},${Math.round((c&255)*f)})`;
  };

  const poly=(pts,fill,stroke,lwd,dash)=>{
    ctx.beginPath();
    pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.closePath();
    if(fill){ ctx.fillStyle=fill; ctx.fill(); }
    if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lwd||1; ctx.setLineDash(dash||[]); ctx.stroke(); ctx.setLineDash([]); }
  };
  const seg=(a,b,stroke,lwd,dash)=>{
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]);
    ctx.strokeStyle=stroke; ctx.lineWidth=lwd||1; ctx.setLineDash(dash||[]); ctx.stroke(); ctx.setLineDash([]);
  };

  /* 바닥(대지) */
  const mg=Math.max(2000,m.W*0.4);
  poly([P([-mg,0,-mg]),P([m.L+mg,0,-mg]),P([m.L+mg,0,m.W+mg]),P([-mg,0,m.W+mg])],"#edf1f6",null);

  const planOf=r=>r==="high"?hr:dr;
  const mainLen=r=>planOf(r).mainCovered;
  const runWOf=r=>planOf(r).width;
  const bandOf=r=>planOf(r).band;
  const remOf=r=>planOf(r).rem;

  function drawRunFace(f){
    const q=(u,v)=>P(v3dFacePoint(f,u,v));
    const c00=q(0,0), c10=q(f.uLen,0), c11=q(f.uLen,f.vLen), c01=q(0,f.vLen);
    if(rotN(f.n)<=0.02){ poly([c00,c10,c11,c01],shade("#aeb7c4",0.85),"#7c8798",1); return; }
    const lf=lum(f.n);
    poly([c00,c10,c11,c01],shade("#e9edf3",lf),null);

    const t=cov[f.run]||0;
    const a=f.runStart, mL=mainLen(f.run), rW=runWOf(f.run);
    const mv1=Math.max(0,Math.min(Math.min(t,mL)-a,f.vLen));      /* 본판이 이 면에서 덮은 범위 */
    const bv0=Math.max(0,Math.min(mL-a,f.vLen));                  /* 밴드 시작 */
    const bv1=Math.max(0,Math.min(Math.min(t,rW)-a,f.vLen));      /* 밴드 끝 */

    if(mv1>0){
      const p=planOf(f.run), horizontal=p.orientation==="horizontal";
      const fill=horizontal?"#ffedd5":"#c9def8", grid=horizontal?"#c2410c":"#2563eb";
      poly([q(0,0),q(f.uLen,0),q(f.uLen,mv1),q(0,mv1)],shade(fill,lf),null);
      for(let u=p.lengthSpan;u<f.uLen-1;u+=p.lengthSpan)
        seg(q(u,0),q(u,mv1),horizontal?"rgba(194,65,12,.48)":"rgba(37,99,235,.4)",horizontal?1.25:0.75);
      for(let s=Math.ceil((a+1)/p.runSpan)*p.runSpan;s<a+mv1-1;s+=p.runSpan)
        seg(q(0,s-a),q(f.uLen,s-a),shade(grid,1),1.55);
    }
    if(bv1>bv0+0.5){
      const b=bandOf(f.run), horiz=b.resolved==="horizontal";
      poly([q(0,bv0),q(f.uLen,bv0),q(f.uLen,bv1),q(0,bv1)],shade("#ffe3c2",lf),null);
      seg(q(0,bv0),q(f.uLen,bv0),"#c2410c",1.3,[8,6]);
      const stepU=horiz?TILE_L:TILE_S;
      let k=1;
      for(let u=stepU;u<f.uLen-1;u+=stepU,k++){
        const bold=!horiz&&b.stripsPerSheet>1&&(k%b.stripsPerSheet===0); /* 굵은 선 = 보온재 1장 단위 */
        seg(q(u,bv0),q(u,bv1),"#f97316",bold?1.8:0.9);
      }
      if(horiz&&b.horizontalRows>1){
        for(let s=mL+TILE_S;s<Math.min(t,rW)-1;s+=TILE_S){
          const vv=s-a;
          if(vv>bv0&&vv<bv1) seg(q(0,vv),q(f.uLen,vv),"#f97316",1.2);
        }
      }
    }
    if(V3D.playing&&t>a&&t<a+f.vLen) seg(q(0,t-a),q(f.uLen,t-a),"#1d4ed8",2.2); /* 덮이는 앞선 */
    poly([c00,c10,c11,c01],null,"#111827",1.4);
    if(f.foldEdge&&t>a+1) seg(c00,c10,"#16a34a",2.4,[10,7]);       /* 접힘선(자르지 않음) */
    if(f.startEdge&&cov.high>0.0001) seg(c00,c10,"#111827",3);    /* 시작 모서리 */
  }

  function drawEndFace(e){
    const pz=(z,y)=>P([e.x,y,z]);
    const pts=e.poly.map(pt=>pz(pt[0],pt[1]));
    if(rotN(e.n)<=0.02){ poly(pts,shade("#aeb7c4",0.8),"#7c8798",1); return; }
    const lf=lum(e.n);
    poly(pts,shade("#e9edf3",lf),null);
    if(cov.ends>0){
      const ep=v3dEndPlan(m);
      const layoutId=ep.renderId||ep.id;
      ctx.save();
      ctx.globalAlpha=cov.ends;
      ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath();
      ctx.clip();
      if(layoutId==="horizontal"){
        poly(pts,shade("#ffdfb5",lf),null);
        for(let y=TILE_S;y<m.hh-1;y+=TILE_S)
          seg(pz(0,y),pz(m.W,y),"rgba(249,115,22,.78)",1.05);
        for(let z=TILE_L;z<m.W-1;z+=TILE_L)
          seg(pz(z,0),pz(z,m.hh),"rgba(194,65,12,.82)",1.25);
      }else if(layoutId==="vertical"){
        poly(pts,shade("#d6e8fb",lf),null);
        for(let z=TILE_S;z<m.W-1;z+=TILE_S)
          seg(pz(z,0),pz(z,m.hh),"rgba(37,99,235,.62)",0.95);
        for(let y=TILE_L;y<m.hh-1;y+=TILE_L)
          seg(pz(0,y),pz(m.W,y),"rgba(29,78,216,.82)",1.35);
      }else{
        const bandH=Math.min(TILE_S,m.minHeight);
        poly(pts,shade("#e6def9",lf),null);
        for(let z=TILE_S;z<m.W-1;z+=TILE_S)
          seg(pz(z,bandH),pz(z,m.hh),"rgba(124,58,237,.58)",0.9);
        for(let y=bandH+TILE_L;y<m.hh-1;y+=TILE_L)
          seg(pz(0,y),pz(m.W,y),"rgba(109,40,217,.76)",1.3);
        poly([pz(0,0),pz(m.W,0),pz(m.W,bandH),pz(0,bandH)],shade("#ffdfb5",lf),null);
        for(let z=TILE_L;z<m.W-1;z+=TILE_L)
          seg(pz(z,0),pz(z,bandH),"rgba(194,65,12,.82)",1.2);
        seg(pz(0,bandH),pz(m.W,bandH),"#c2410c",1.35,[7,5]);
      }
      ctx.restore();
    }
    poly(pts,null,"#111827",1.4);
  }

  /* 화가 알고리즘: 긴 외피만(양끝면은 별도 3D 메뉴에서 전용으로 그림). */
  const items=[];
  m.faces.forEach(f=>{
    const c=rot(v3dFacePoint(f,f.uLen/2,f.vLen/2));
    items.push({z:c[2], draw:()=>drawRunFace(f)});
  });
  items.sort((p,q)=>p.z-q.z).forEach(i=>i.draw());

  /* 진행 방향 화살표(주석용, 면 밖으로 띄움) */
  function drawArrowPath(pts3,color){
    const p2=pts3.map(P);
    ctx.beginPath();
    p2.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.strokeStyle=color; ctx.lineWidth=4.5; ctx.lineJoin="round"; ctx.lineCap="round";
    ctx.globalAlpha=0.85; ctx.stroke(); ctx.globalAlpha=1;
    const a=p2[p2.length-2], b=p2[p2.length-1];
    const ang=Math.atan2(b[1]-a[1],b[0]-a[0]), hd=12;
    ctx.beginPath();
    ctx.moveTo(b[0],b[1]);
    ctx.lineTo(b[0]-hd*Math.cos(ang-0.44),b[1]-hd*Math.sin(ang-0.44));
    ctx.lineTo(b[0]-hd*Math.cos(ang+0.44),b[1]-hd*Math.sin(ang+0.44));
    ctx.closePath(); ctx.fillStyle=color; ctx.globalAlpha=0.9; ctx.fill(); ctx.globalAlpha=1;
  }
  const off=Math.max(220,m.W*0.035), xm=m.L*0.5;
  function runArrowPoints(runKey){
    const fs=m.faces.filter(f=>f.run===runKey);
    if(!fs.length) return [];
    const pts=[[xm,fs[0].O[1],fs[0].O[2]]];
    fs.forEach(f=>pts.push(v3dFacePoint(f,xm,f.vLen)));
    return pts;
  }
  const highShown=cov.high>0.0001, drapeShown=cov.drape>0.0001;
  if(highShown) drawArrowPath(runArrowPoints("high"),"#2563eb");
  if(drapeShown) drawArrowPath(runArrowPoints("drape"),"#16a34a");

  /* 라벨 */
  function drawLabel(p3,text,o={}){
    const s=P(p3);
    const lx=s[0]+(o.dx||0), ly=s[1]+(o.dy||0);
    if(o.dot){ ctx.beginPath(); ctx.arc(s[0],s[1],3.2,0,7); ctx.fillStyle=o.color||"#111827"; ctx.fill(); }
    if((o.dx||o.dy)&&o.lead!==false) seg(s,[lx,ly],"rgba(71,84,103,.5)",1);
    const lines=String(text).split("\n");
    ctx.font=`${o.weight||700} ${o.size||12.5}px ${V3D_FONT}`;
    ctx.textAlign=o.align||"left"; ctx.textBaseline="middle";
    ctx.lineJoin="round";
    lines.forEach((ln,i)=>{
      const yy=ly+i*16-(lines.length-1)*8;
      ctx.strokeStyle="rgba(255,255,255,.92)"; ctx.lineWidth=4; ctx.strokeText(ln,lx,yy);
      ctx.fillStyle=o.color||"#111827"; ctx.fillText(ln,lx,yy);
    });
  }
  const dimLabelRects=[];
  function drawDimension(a3,b3,label,o={}){
    const a=P(a3), b=P(b3), dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
    if(len<(o.minLength||42)) return;
    const ux=dx/len, uy=dy/len, nx=-uy, ny=ux, color=o.color||"#334155";
    if(o.extA) seg(P(o.extA),a,"rgba(71,85,105,.48)",0.85,[3,3]);
    if(o.extB) seg(P(o.extB),b,"rgba(71,85,105,.48)",0.85,[3,3]);
    seg(a,b,color,1.15);
    const tick=5.5;
    seg([a[0]-nx*tick,a[1]-ny*tick],[a[0]+nx*tick,a[1]+ny*tick],color,1.35);
    seg([b[0]-nx*tick,b[1]-ny*tick],[b[0]+nx*tick,b[1]+ny*tick],color,1.35);
    const head=(p,dir)=>{
      ctx.beginPath(); ctx.moveTo(p[0],p[1]);
      ctx.lineTo(p[0]+dir[0]*8+nx*3.2,p[1]+dir[1]*8+ny*3.2);
      ctx.lineTo(p[0]+dir[0]*8-nx*3.2,p[1]+dir[1]*8-ny*3.2);
      ctx.closePath(); ctx.fillStyle=color; ctx.fill();
    };
    head(a,[ux,uy]); head(b,[-ux,-uy]);
    const fontSize=compact?9.5:11.5;
    ctx.font=`700 ${fontSize}px ${V3D_FONT}`;
    const tw=ctx.measureText(label).width, pw=tw+12, ph=fontSize+8;
    let lx=(a[0]+b[0])/2+nx*(o.labelOffset===undefined?12:o.labelOffset);
    let ly=(a[1]+b[1])/2+ny*(o.labelOffset===undefined?12:o.labelOffset);
    lx=Math.max(pw/2+4,Math.min(w-pw/2-4,lx));
    ly=Math.max(56+ph/2,Math.min(h-ph/2-6,ly));
    for(let tries=0;tries<6;tries++){
      const r={x:lx-pw/2,y:ly-ph/2,w:pw,h:ph};
      const hit=dimLabelRects.some(q=>r.x<q.x+q.w+3&&r.x+r.w+3>q.x&&r.y<q.y+q.h+3&&r.y+r.h+3>q.y);
      if(!hit){ dimLabelRects.push(r); break; }
      ly=Math.max(56+ph/2,Math.min(h-ph/2-6,ly+(ly<h/2?ph+4:-(ph+4))));
    }
    ctx.fillStyle="rgba(255,255,255,.94)"; ctx.fillRect(lx-pw/2,ly-ph/2,pw,ph);
    ctx.strokeStyle="rgba(100,116,139,.42)"; ctx.lineWidth=0.8; ctx.strokeRect(lx-pw/2,ly-ph/2,pw,ph);
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle=color; ctx.fillText(label,lx,ly+.25);
  }
  const faceByKey=k=>m.faces.find(f=>f.key===k);
  function faceLabel(fkey,u,v,text,o){
    const f=faceByKey(fkey);
    if(!f) return;
    if(rotN(f.n)<=0.05) return;
    drawLabel(v3dFacePoint(f,u,v),text,o);
  }

  /* 면 이름(흐리게) — 그 면이 덮이기 전까지만 표시해 수량 라벨과 겹치지 않게 함 */
  m.faces.forEach(f=>{
    if(rotN(f.n)<=0.05) return;
    if(f.run==="high"&&highShown) return;
    if(f.run==="drape"&&drapeShown) return;
    drawLabel(v3dFacePoint(f,f.uLen*0.13,f.vLen*0.5),f.name,{size:11.5,weight:600,color:"#5b6472",align:"center"});
  });

  const runDefs=Object.fromEntries(d.shape.runs.map(r=>[r.key,r]));
  if(highShown) drawLabel([xm,d.shape.startHeight,0],compact?"시작":`시작: ${d.shape.sections[0].wallLabel} 위 모서리`,{dot:true,dx:compact?7:16,dy:compact?13:26,size:compact?9.5:12,weight:800});
  if(highShown&&cov.high>=hr.mainCovered*0.55) /* 재생 중에는 어느 정도 덮인 뒤 표시(시작 라벨과 겹침 방지) */
    faceLabel(m.startFace.key,xm,Math.min(cov.high,hr.mainCovered)/2,
      compact?`① ${hr.orientation==="horizontal"?"가로":"세로"} ${fmt(hr.mainSheets)}장`:`① ${v3dOrientationName(hr)} · ${hr.runSpan}×${hr.lengthSpan}\n${hr.fullRows}단 × ${hr.lengthCols}열 = ${fmt(hr.mainSheets)}장`,
      {align:"center",color:hr.orientation==="horizontal"?"#c2410c":"#1d4ed8",size:compact?9.5:12.5,weight:800});
  if(drapeShown&&cov.drape>=Math.min(dr.mainCovered,Math.max(1,m.firstRoof.vLen*.6))){
    const loc=v3dRunLocate(m,"drape",Math.min(dr.mainCovered,dr.width)*0.45);
    if(loc&&loc.f&&rotN(loc.f.n)>0.05) drawLabel(v3dFacePoint(loc.f,xm,loc.v),
      compact?`② ${dr.orientation==="horizontal"?"가로":"세로"} ${fmt(dr.mainSheets)}장`:`② ${v3dOrientationName(dr)} · ${runDefs.drape.name}\n${dr.fullRows}단 × ${dr.lengthCols}열 = ${fmt(dr.mainSheets)}장`,
      {align:"center",color:dr.orientation==="horizontal"?"#c2410c":"#1d4ed8",size:compact?9.5:12.5,weight:800,dot:true,dy:compact?-14:-34});
  }
  if(drapeShown&&!compact) m.stepFaces.forEach(f=>
    faceLabel(f.key,xm,f.vLen/2,"모서리는 자르지 않고 접음",{align:"center",size:10.5,weight:700,color:"#15803d"}));

  function bandLabel(runKey){
    const b=bandOf(runKey);
    if(b.resolved==="none"||b.chosenSheets===0) return;
    const loc=v3dRunLocate(m,runKey,(mainLen(runKey)+runWOf(runKey))/2);
    if(rotN(loc.f.n)<=0.05) return;
    const horiz=b.resolved==="horizontal";
    const what=horiz?`가로 밴드 ${fmt(b.chosenSheets)}장`:`세로 스트립 · 1장→${b.stripsPerSheet}줄 · ${fmt(b.chosenSheets)}장`;
    const alt=`가로 ${fmt(b.horizontalSheets)}장 / 세로 ${fmt(b.stripSheets)}장 · 적용 후 부족 0mm`;
    drawLabel(v3dFacePoint(loc.f,xm,loc.v),
      compact?`③ ${fmt(remOf(runKey),1)}mm → ${horiz?"가로":"세로"} ${fmt(b.chosenSheets)}장 · 부족 0`:`③ 미덮임 ${fmt(remOf(runKey),1)}mm → ${what}\n${alt}`,
      {align:"center",dy:compact?15:34,dot:true,color:"#c2410c",size:compact?9.5:12.5,weight:800});
  }
  if(cov.high>=hr.width-.5) bandLabel("high");
  if(cov.drape>=dr.width-.5) bandLabel("drape");

  /* 실치수: 구조 안에는 치수선을 두지 않고, 외곽 레일과 아래 치수표에만 표시한다. */
  drawDimension([0,0,m.W+dimOff],[m.L,0,m.W+dimOff],compact?`L ${v3dMm(d.L)}`:`길이 L ${v3dMm(d.L)}mm`,{
    extA:[0,0,m.W],extB:[m.L,0,m.W],labelOffset:13,minLength:58
  });
  const frontEnd=m.ends.map(e=>({e,dep:rotN(e.n)})).sort((a,b)=>b.dep-a.dep)[0];
  if(frontEnd.dep>0.08){
    const ex=frontEnd.e.x;
    drawDimension([ex,-dimOff,0],[ex,-dimOff,m.W],compact?`W ${v3dMm(d.totalW)}`:`전체 W ${v3dMm(d.totalW)}mm`,{
      extA:[ex,0,0],extB:[ex,0,m.W],labelOffset:12
    });
    d.shape.sections.forEach((section,index)=>{
      const lift=dimOff*(0.58+(index%2)*0.16);
      drawDimension([ex,section.height+lift,section.start],[ex,section.height+lift,section.end],
        compact?`${index+1}W ${v3dMm(section.width)}`:`${section.label} W ${v3dMm(section.width)}mm`,{
          extA:[ex,section.height,section.start],extB:[ex,section.height,section.end],labelOffset:index%2?-11:11,minLength:18
        });
      const outsideZ=d.shape.startSide==="left"
        ?-dimOff*(.48+index*.2)
        :m.W+dimOff*(.48+index*.2);
      drawDimension([ex,0,outsideZ],[ex,section.height,outsideZ],
        compact?`${index+1}H ${v3dMm(section.height)}`:`${section.label} H ${v3dMm(section.height)}mm`,{
          extA:[ex,0,section.start],extB:[ex,section.height,section.start],labelOffset:index%2?-12:12,minLength:18
        });
    });
    d.shape.stepSurfaces.forEach((surface,index)=>{
      const lo=Math.min(surface.y0,surface.y1), hi=Math.max(surface.y0,surface.y1);
      const outsideZ=d.shape.startSide==="left"
        ?-dimOff*(.88+index*.16)
        :m.W+dimOff*(.88+index*.16);
      drawDimension([ex,lo,outsideZ],[ex,hi,outsideZ],
        compact?`Δ${index+1} ${v3dMm(surface.length)}`:`${surface.label} ${v3dMm(surface.length)}mm`,{
          extA:[ex,lo,surface.z0],extB:[ex,hi,surface.z0],labelOffset:index%2?12:-12,color:"#9a3412",minLength:12
        });
    });
  }

  /* 좌상단 캡션 */
  ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  ctx.font=`800 14px ${V3D_FONT}`;
  ctx.fillStyle="#111827";
  const cap=eff===0
    ?`${d.name} · 덮기 전 구조`
    :`${V3D_STEPS[eff]} — ${V3D.playing?"여기까지":"표시"} ${fmt(V3D.playing?v3dCumSheets(m,eff):v3dShownSheets(m,eff))}장 / 이 배치 ${fmt(v3dScenarioTotal(m))}장${V3D.playing?" (재생 중)":""}`;
  ctx.fillText(cap,16,26,w-32);
  ctx.font=`600 11.5px ${V3D_FONT}`;
  ctx.fillStyle="#64748b";
  ctx.fillText(`${d.name} · 단면 시작 ${d.shape.startSide==="left"?"왼쪽":"오른쪽"} · ${runDefs.high.shortName} ${v3dOrientationName(hr)} · ${runDefs.drape.shortName} ${v3dOrientationName(dr)} · 양끝면 제외`,16,44,w-32);
}
