/* ══════════════════════════════════════════════════════════════
   화면(DOM) 렌더링.
   케이스 카드 · 요약(히어로) · 시공순서 5단계 · 구역 카드/계획표 · 비교표 · 검산.
   01-core.js, 02-calc.js 필요.
   ══════════════════════════════════════════════════════════════ */

/* ═══════════════ 케이스 카드 ═══════════════ */
function caseThumbSVG(c){
  const d=base(c);
  const sc=Math.min(130/d.totalW,74/d.highH);
  const tw=d.totalW*sc, hh=d.highH*sc;
  const ox=(150-tw)/2, oy=90-hh;
  const g=endFaceGeo(d,ox,oy,sc);
  const hLabX=g.highX+g.hw/2, lLabX=g.lowX+g.lw/2;
  return `<svg viewBox="0 0 150 98" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <line x1="6" y1="90" x2="144" y2="90" stroke="#cbd5e1" stroke-width="1.5"/>
    <path d="${g.path}" fill="#e3edfb" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round"/>
    <text x="${hLabX}" y="${oy+13}" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">높</text>
    <text x="${lLabX}" y="${oy+g.st+13}" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">낮</text>
  </svg>`;
}

/* 상단 요약에서 고른 케이스 1개만 카드로 표시 */
function buildCaseCards(){
  const c=currentCase();
  const d=base(c);
  setHTML("caseGrid",`
    <div class="case-card active">
      <span class="check">✓</span>
      <div class="case-head">
        <span class="case-letter">${c.name.slice(-1)}</span>
        <span><b>${c.name}</b><small>${c.subtitle}</small></span>
      </div>
      <div class="case-thumb">${caseThumbSVG(c)}</div>
      <div class="case-stats">
        <span>높은 벽 ${fmt(c.highH)}</span>
        <span>낮은 벽 ${fmt(c.lowH)}</span>
        <span>단차 ${fmt(d.stepH)}</span>
        <span>전개폭 ${fmt(d.drapeW,1)}</span>
      </div>
      <div class="case-total" id="caseTotal-${c.id}">-</div>
    </div>`);
}

function selectCase(id){
  selectedCaseId=id;
  buildCaseCards();
  render();
}

/* ═══════════════ 세 케이스 전체 요약(상단) ═══════════════ */
function renderAllCases(){
  setText("acBuffer",buffer+"%");
  let sumTotal=0, sumOrder=0;
  const cells=CASES.map(c=>{
    const r=calc(c);
    const order=orderSheets(r.totalSheets);
    sumTotal+=r.totalSheets; sumOrder+=order;
    return `<button type="button" class="ac-cell${c.id===selectedCaseId?" active":""}" data-case="${c.id}" title="${esc(c.name)}로 전환">
      <span class="ac-k">${esc(c.name.slice(-1))}</span>
      <span class="ac-tot">${fmt(r.totalSheets)}<small>장</small></span>
      <span class="ac-order">발주 <b>${fmt(order)}</b></span>
    </button>`;
  }).join("");
  const sumCell=`<div class="ac-cell sum">
    <span class="ac-k">합계</span>
    <span class="ac-tot">${fmt(sumTotal)}<small>장</small></span>
    <span class="ac-order">발주 <b>${fmt(sumOrder)}</b></span>
  </div>`;
  const wrap=byId("allCasesSummary");
  wrap.innerHTML=cells+sumCell;
  wrap.querySelectorAll(".ac-cell[data-case]").forEach(b=>b.addEventListener("click",()=>selectCase(b.dataset.case)));
}

/* ═══════════════ 요약(히어로) ═══════════════ */
function zoneSegments(x){
  return [
    {...ZONES.shell, n:x.shellSheets},
    {...ZONES.ends, n:x.endSheets}
  ];
}

function renderHero(x){
  const d=x.d, tot=x.totalSheets;
  setText("heroLabel",`${d.name} · 총 필요 수량`);
  setText("heroTotal",fmt(tot));

  const segs=zoneSegments(x);
  setHTML("breakBar",segs.map(s=>
    `<div class="break-seg" style="flex:${s.n} 1 0;background:${s.color};color:${s.ink}" title="${s.name} ${s.n}장">${s.n/tot>=0.12?fmt(s.n):""}</div>`
  ).join(""));
  setHTML("breakLegend",segs.map(s=>
    `<span class="lchip"><i class="dot" style="background:${s.color}"></i>${s.name} <b>${fmt(s.n)}장</b><span class="muted">(${fmt(s.n/tot*100,0)}%)</span></span>`
  ).join(""));

  const order=orderSheets(tot);
  setText("orderBig",fmt(order));
  setText("orderSub",`총 ${fmt(tot)}장 × ${(1+buffer/100).toFixed(2)} 올림 (${buffer}% 여유)`);
  QUICK_BUFFER_OPTIONS.forEach(p=>setText("b"+p,`${fmt(orderSheets(tot,p))}장`));

  setText("statPanel",fmt(x.totalPanel,1)+"㎡");
  setText("statPanelSub",`${fmt(tot)}장 × 1.08㎡`);
  setText("statActual",fmt(x.totalActual,1)+"㎡");
  setText("statLoss",fmt(x.lossRate,1)+"%");
  setText("statLossSub",`손실 ${fmt(x.loss,1)}㎡ (자투리·절단분)`);
  setText("statFold","양방향");
  setText("statFoldSub",runMainLabel(x.shell)+" · 각 바닥 잔여 처리");

  setHTML("caseDims",
    `길이 <b>${fmt(d.L,1)}mm</b> · 전체 폭 <b>${fmt(d.totalW,1)}mm</b><br>`+
    `높은 구간 폭 ${fmt(d.highW,1)} · 낮은 구간 폭 ${fmt(d.lowW,1)} (높은 쪽: ${highSideName(d.highSide)})<br>`+
    `높은 벽 ${fmt(d.highH,1)} · 낮은 벽 ${fmt(d.lowH,1)} · 단차 ${fmt(d.stepH,1)}<br>`+
    `기준선 <b>높은 벽 위 모서리</b> · 높은 벽 직하강 <b>${fmt(x.shell.highRun.width,1)}mm</b> + 지붕·낮은 벽 하강 <b>${fmt(x.shell.roofLowRun.width,1)}mm</b><br>`+
    `외피 본판 <b>${runMainLabel(x.shell)}</b> · ${runBandLabel(x.shell)} · 길이 600폭 ${d.lenCols600}열<br>`+
    `길이 마지막 열 사용 ${fmt(d.last600,1)}mm · 절단 자투리 ${fmt(d.trim600,1)}mm`
  );

  CASES.forEach(cc=>{
    const r=calc(cc);
    const el=byId("caseTotal-"+cc.id);
    if(el) el.innerHTML=`총 <b>${fmt(r.totalSheets)}장</b> · 발주 ${fmt(orderSheets(r.totalSheets))}장 <span class="small">(${buffer}%)</span>`;
  });
}

/* ═══════════════ 시공 순서 5단계 ═══════════════ */
const STEP_ICONS={
  drape:`<svg viewBox="0 0 48 44"><path d="M9,16 H24 V26 H41 V39 H9 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/><path d="M6,12 H27 V22 H44" fill="none" stroke="#2a78d6" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  fold:`<svg viewBox="0 0 48 44"><path d="M6,14 H32 Q38,14 38,20 V34" fill="none" stroke="#2a78d6" stroke-width="4.5" stroke-linecap="round"/><path d="M38,22 V34" stroke="#16a34a" stroke-width="4.5" stroke-linecap="round"/><path d="M33,29 L38,37 L43,29" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  wall:`<svg viewBox="0 0 48 44"><line x1="5" y1="40" x2="43" y2="40" stroke="#cbd5e1" stroke-width="2"/><rect x="8" y="12" width="9" height="26" rx="1.5" fill="#dbeafe" stroke="#2563eb" stroke-width="1.6"/><rect x="19.5" y="12" width="9" height="26" rx="1.5" fill="#dbeafe" stroke="#2563eb" stroke-width="1.6"/><rect x="31" y="12" width="9" height="26" rx="1.5" fill="#dbeafe" stroke="#2563eb" stroke-width="1.6"/></svg>`,
  band:`<svg viewBox="0 0 48 44"><line x1="5" y1="40" x2="43" y2="40" stroke="#cbd5e1" stroke-width="2"/><rect x="8" y="8" width="9" height="23" rx="1.5" fill="#dbeafe" stroke="#2563eb" stroke-width="1.6"/><rect x="19.5" y="8" width="9" height="23" rx="1.5" fill="#dbeafe" stroke="#2563eb" stroke-width="1.6"/><rect x="31" y="8" width="9" height="23" rx="1.5" fill="#dbeafe" stroke="#2563eb" stroke-width="1.6"/><rect x="8" y="32" width="32" height="7" rx="1.5" fill="#ffedd5" stroke="#f97316" stroke-width="1.6"/></svg>`,
  ends:`<svg viewBox="0 0 48 44"><path d="M11,7 H26 V18 H38 V38 H11 Z" fill="#ede9fe" stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/><line x1="19" y1="7" x2="19" y2="38" stroke="#7c3aed" stroke-width="1" opacity=".5"/><line x1="11" y1="24" x2="38" y2="24" stroke="#7c3aed" stroke-width="1" opacity=".5"/></svg>`
};

function renderSteps(x){
  const d=x.d, sh=x.shell;
  const bandName=b=>b.chosen==="none"?"없음":(isHorizontalBand(b)?"가로 밴드":"스트립 재단");
  const steps=[
    {icon:"drape", t:"높은 벽 위에서 양방향 전개",
     num:`높은 벽 ${fmt(sh.highRun.width,1)}mm · 반대방향 ${fmt(sh.roofLowRun.width,1)}mm`,
     p:`기준선은 높은 벽 위 모서리입니다. 여기서 한쪽은 높은 벽을 바닥까지 직선으로 내려가고, 다른 한쪽은 높은 지붕→단차→낮은 지붕→낮은 벽 바닥까지 접혀 내려갑니다.`},
    {icon:"fold", t:"모서리는 접어서 넘기기",
     num:"높은 벽 위 기준 · 양방향",
     p:`정면 ㄴ자 모서리와 지붕 단차는 절단선이 아니라 접힘선입니다. 두 방향을 따로 계산해야 양쪽 바닥 트리밍 위치가 실제와 맞습니다.`},
    {icon:"wall", t:"1800 전개띠 본판",
     num:`${sh.fullRows}띠 × ${d.lenCols600}열 = ${fmt(sh.mainSheets)}장`,
     p:`${runMainLabel(sh)}를 길이 방향 ${d.lenCols600}열로 덮습니다. 큰 면은 이 단계에서 최대한 절단 없이 채웁니다.`},
    {icon:"band", t:"바닥 잔여띠 최적 선택",
     num:runBandLabel(sh),
     p:`각 방향의 바닥 쪽 잔여는 ①가로 1800×600 밴드 ②1800폭에서 자른 스트립을 따로 비교합니다. ${runBandCompareLabel(sh)}.`},
    {icon:"ends", t:"양끝 ㄴ자 앞면·뒷면",
     num:`${x.endPerFace}장/면 × 2 = ${fmt(x.endSheets)}장`,
     p:`정면에서 보이는 ㄴ자 면은 면적 하한, 직사각형 분할, 절단 잔재 활용을 같이 검토한 케이스별 재단 수량을 적용합니다. 최소안은 현장 재단성 확인이 필요합니다.`}
  ];
  setHTML("stepsGrid",steps.map((s,i)=>
    `<div class="step"><span class="n">${i+1}</span><div class="icon">${STEP_ICONS[s.icon]}</div><b class="t">${s.t}</b><span class="num">${s.num}</span><p>${s.p}</p></div>`
  ).join(""));
}

/* ═══════════════ 구역 카드 + 계획표 ═══════════════ */
function bandChoiceLabel(b){
  if(b.chosen==="none") return "밴드 없음";
  if(b.chosen==="horizontal-same") return "가로 밴드(동일 장수·이음매 감소)";
  if(b.chosen==="horizontal") return "가로 1800×600 밴드";
  return "600폭 절단 스트립";
}

/* 잔여 밴드: 가로로 눕히기 vs 스트립 재단 비교 문구 (그림·표 공용) */
function bandCompareLabel(b){
  if(b.chosen==="none") return "잔여 높이 없음 — 밴드 불필요";
  if(b.chosen==="horizontal-same") return `가로 눕힘 ${b.horizontalSheets}장 = 스트립 ${b.stripSheets}장 동률 → 이음매 적은 가로 선택`;
  if(b.chosen==="horizontal") return `가로 눕힘 ${b.horizontalSheets}장 < 스트립 ${b.stripSheets}장 → 가로가 ${b.stripSheets-b.horizontalSheets}장 적어 선택`;
  return `스트립 ${b.stripSheets}장 < 가로 눕힘 ${b.horizontalSheets}장 → 스트립이 ${b.horizontalSheets-b.stripSheets}장 적어 선택`;
}

function runSheetsLabel(sh){
  return sh.runs.map(r=>`${r.name} ${fmt(r.sheets)}장`).join(" · ");
}

function runMainLabel(sh){
  return sh.runs.map(r=>`${r.name} ${r.fullRows}띠`).join(" · ");
}

function runBandLabel(sh){
  return sh.runs.map(r=>`${r.name} 잔여 ${fmt(r.rem,1)}mm ${bandChoiceLabel(r.band)} ${r.band.chosenSheets}장`).join(" / ");
}

function runBandCompareLabel(sh){
  return sh.runs.map(r=>`${r.name}: ${bandCompareLabel(r.band)}`).join(" / ");
}

function renderZones(x){
  const d=x.d, sh=x.shell;
  const cards=[
    {z:ZONES.shell, count:x.shellSheets, view:"roof",
     m:`외피 본판 ${fmt(sh.mainSheets)} + 잔여띠 ${fmt(sh.sheets-sh.mainSheets)}`,
     t:`높은 벽 위에서 양방향 전개. ${runSheetsLabel(sh)}. 길이 방향은 600폭 ${d.lenCols600}열.`},
    {z:ZONES.ends, count:x.endSheets, view:"ends",
     m:`${endMode==="min"?"최소 재단":"실무 여유"} · ${x.endPerFace}장/면 × 2면`,
     t:d.endNote}
  ];
  const grid=byId("zoneGrid");
  grid.innerHTML=cards.map(c=>
    `<div class="zone-card" style="--zc:${c.z.color}">
      <div class="zn"><i class="dot" style="background:${c.z.color}"></i>${c.z.name}</div>
      <div class="zc">${fmt(c.count)}<small> 장</small></div>
      <div class="zm">${c.m}</div>
      <div class="zt">${c.t}</div>
      <button type="button" data-goview="${c.view}">배치 보기 →</button>
    </div>`
  ).join("");
  grid.querySelectorAll("button[data-goview]").forEach(b=>
    b.addEventListener("click",()=>gotoView(b.dataset.goview))
  );

  const rows=[
    {key:"roof", zone:"긴 방향 외피", method:"높은 벽 위 기준 양방향 전개",
     sheets:sh.sheets, actual:sh.actual, panel:sh.panel,
     note:`${runSheetsLabel(sh)} · ${runBandCompareLabel(sh)}`},
    {key:"ends", zone:"옆면 · 양끝 L자면", method:"세로 기본 + 가로·절단 혼합",
     sheets:x.endSheets, actual:x.endActual, panel:x.endPanel,
     note:`${x.endPerFace}장/면 × 2면 · ${d.endNote}`}
  ];
  const tbody=byId("planTable").querySelector("tbody");
  tbody.innerHTML="";
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    tr.className="clickable";
    tr.innerHTML=`<td><b>${r.zone}</b></td><td><span class="tag mix">${r.method}</span></td>
      <td class="num"><b>${fmt(r.sheets)}</b>장</td><td class="num">${fmt(r.actual,2)}</td><td class="num">${fmt(r.panel,2)}</td>
      <td>${r.note}</td>`;
    tr.addEventListener("click",()=>gotoView(r.key));
    tbody.appendChild(tr);
  });
}

function gotoView(v){
  view=v;
  setActiveButtons("#viewTabs .tab",b=>b.dataset.view===view);
  draw(calc(currentCase()));
  byId("sec-visual").scrollIntoView({behavior:"smooth"});
}

/* ═══════════════ 비교 표 ═══════════════ */
function trimText(p,hAxis="길이",vAxis="높이"){
  return `${hAxis} 끝 ${fmt(p.trimW,1)}mm / ${vAxis} 끝 ${fmt(p.trimH,1)}mm / 초과 ${fmt(p.waste,2)}㎡`;
}

function renderOrientationComparison(x){
  const d=x.d,f=x.chosenFold;
  const roofV=roofPlanByOrientation(d,"V"),roofH=roofPlanByOrientation(d,"H");
  const lowV=rectLayout(d.L,f.lowWall.height,"V"),lowH=rectLayout(d.L,f.lowWall.height,"H");
  const highV=rectLayout(d.L,f.highWall.height,"V"),highH=rectLayout(d.L,f.highWall.height,"H");
  const endV=endPlanByOrientation(d,"V"),endH=endPlanByOrientation(d,"H");
  const roofTrim=p=>`길이 끝 ${fmt(p.trimW,1)}mm × ${p.rows}장 / 전개 끝 ${fmt(p.fold,1)}mm는 벽 접힘 / 순자투리 ${fmt(p.trimAfterFold,2)}㎡`;
  const endTrim=p=>`높은 구간: ${trimText(p.high,"폭","높이")}<br>낮은 구간: ${trimText(p.low,"폭","높이")}<br>1면 초과 ${fmt(p.wastePerFace,2)}㎡`;
  const rows=[
    ["윗면 · 지붕 전개",`${fmt(roofV.sheets)}장<span class="cell-sub">600(길이)×1800(전개) · 접힘 ${fmt(roofV.fold,1)}</span>`,roofTrim(roofV),`${fmt(roofH.sheets)}장<span class="cell-sub">1800(길이)×600(전개) · 접힘 ${fmt(roofH.fold,1)}</span>`,roofTrim(roofH),`${fmt(Math.min(roofV.sheets,roofH.sheets))}장<span class="cell-sub">지붕 단독 최소</span>`],
    ["정면 · 낮은 벽",`${fmt(lowV.sheets)}장<span class="cell-sub">600×1800 세로 고정</span>`,trimText(lowV),`${fmt(lowH.sheets)}장<span class="cell-sub">1800×600 가로 고정</span>`,trimText(lowH),`${fmt(f.lowWall.sheets)}장<span class="cell-sub">세로 본판+${bandChoiceLabel(f.lowWall.band)}</span>`],
    ["정면 · 높은 벽",`${fmt(highV.sheets)}장<span class="cell-sub">600×1800 세로 고정</span>`,trimText(highV),`${fmt(highH.sheets)}장<span class="cell-sub">1800×600 가로 고정</span>`,trimText(highH),`${fmt(f.highWall.sheets)}장<span class="cell-sub">세로 본판+${bandChoiceLabel(f.highWall.band)}</span>`],
    ["옆면 · 양끝 L자면",`${fmt(endV.sheets)}장<span class="cell-sub">${endV.perFace}장/면 × 2</span>`,endTrim(endV),`${fmt(endH.sheets)}장<span class="cell-sub">${endH.perFace}장/면 × 2</span>`,endTrim(endH),`${fmt(x.endSheets)}장<span class="cell-sub">혼합 재단 ${x.endPerFace}장/면 × 2</span>`]
  ];
  byId("orientationTable").querySelector("tbody").innerHTML=rows.map(r=>
    `<tr><td><b>${r[0]}</b></td><td class="num">${r[1]}</td><td>${r[2]}</td><td class="num">${r[3]}</td><td>${r[4]}</td><td class="num"><span class="tag best">${r[5]}</span></td></tr>`
  ).join("");
  setHTML("orientationNote",`지붕 세로안 ${fmt(roofV.sheets)}장(접힘 ${fmt(roofV.fold,1)}mm) vs 가로안 ${fmt(roofH.sheets)}장(접힘 ${fmt(roofH.fold,1)}mm). <b>지붕 장수만 비교하지 말고, 달라진 접힘 폭으로 벽까지 재계산한 최종 합계</b>는 아래 A/B/C 표를 보세요.`);
}

function renderScenarioTable(){
  const all=CASES.map(scenarioCalc);
  const defs=[
    ["baseline","기준안","min","지붕 세로 드레이프 + 벽 혼합 + 양끝 최소 재단"],
    ["practical","기준안 + 양끝 실무 여유","practical","지붕 세로 드레이프 + 벽 혼합 + 양끝 실무 여유"],
    ["roofHorizontal","지붕 가로 대안",null,"지붕 가로 + 달라진 접힘으로 벽 재계산 + 양끝 최소"],
    ["automatic","수량 자동 최소",null,"지붕 가로 시공이 허용될 때, 세로 기준안과 가로 대안 중 적은 쪽"],
    ["fixedH","전체 가로 고정",null,"지붕·벽·양끝 모두 1800 가로 방향 고정"],
    ["fixedV","전체 세로 고정",null,"지붕·벽·양끝 모두 1800 세로 방향 고정"]
  ];
  setHTML("scenarioHead",`<tr><th>선택 기준</th>${CASES.map(c=>`<th class="num ${c.id===selectedCaseId?"cur":""}">${c.name}</th>`).join("")}<th>계산 방법</th></tr>`);
  const cell=o=>`<b>${fmt(o.total)}장</b><span class="cell-sub">지붕 ${fmt(o.roof)} + 벽 ${fmt(o.walls)} + 끝 ${fmt(o.ends)}<br>접힘 ${fmt(o.fold,1)}mm → ${foldTargetName(o.target)} · 5% 발주 ${fmt(orderSheets(o.total,5))}장</span>`;
  setHTML("scenarioBody",defs.map(([key,label,modeMatch,note])=>{
    const isCurrent=modeMatch===endMode;
    const cls=key==="automatic"?"scenario-best":(isCurrent?"scenario-current":"");
    const badge=key==="automatic"?`<span class="row-badge top">최소</span>`:(isCurrent?`<span class="row-badge now">현재 화면</span>`:"");
    return `<tr class="${cls}"><td><b>${label}</b>${badge}</td>${all.map((s,i)=>`<td class="num ${CASES[i].id===selectedCaseId?"cur":""}">${cell(s[key])}</td>`).join("")}<td>${note}</td></tr>`;
  }).join(""));
}

/* ═══════════════ 검산 ═══════════════ */
function renderAudit(x){
  const d=x.d, f=x.chosenFold;
  const wallCard=(label,wall,foldAmount)=>{
    const b=wall.band;
    const stripFormula=b.rem>0
      ? `floor(1800 ÷ ${fmt(b.rem,1)}) = ${b.stripsPerSheet}줄/장 → ceil(${d.lenCols600} ÷ ${b.stripsPerSheet}) = ${b.stripSheets}장`
      : "잔여 높이 없음";
    const horizontalFormula=b.rem>0
      ? `ceil(${fmt(b.rem,1)} ÷ 600) × ceil(${fmt(d.L,1)} ÷ 1800) = ${b.horizontalRows} × ${d.lenCols1800} = ${b.horizontalSheets}장`
      : "잔여 높이 없음";
    return `<div class="audit-card">
      <h4>${esc(label)}</h4>
      <p class="formula">처리 높이 = ${fmt(wall.height+foldAmount,1)}${foldAmount?` - 접힘 ${fmt(foldAmount,1)}`:""} = <strong>${fmt(wall.height,1)}mm</strong></p>
      <p class="formula">본판 단수 = floor(${fmt(wall.height,1)} ÷ 1800) = ${wall.fullRows}단<br>본판 = ${wall.fullRows}단 × ${d.lenCols600}열 = <strong>${wall.mainSheets}장</strong></p>
      <p class="formula">잔여 높이 = ${fmt(wall.height,1)} - (${wall.fullRows} × 1800) = <strong>${fmt(wall.rem,1)}mm</strong></p>
      <p class="formula">A. 스트립: ${stripFormula}<br>B. 가로 밴드: ${horizontalFormula}</p>
      <p class="formula">선택: <strong>${bandChoiceLabel(b)} · ${b.chosenSheets}장</strong></p>
      <div class="audit-result">${label} = ${wall.mainSheets} + ${b.chosenSheets} = ${wall.sheets}장</div>
    </div>`;
  };
  const foldDiff=Math.abs(x.lowFold.wallSheets-x.highFold.wallSheets);
  const foldVerdict=foldDiff===0
    ? `두 안 모두 ${x.lowFold.wallSheets}장으로 동률입니다. 수량상 우열이 없어 기준안인 ‘낮은 벽 접기’를 표시합니다.`
    : `${foldDiff}장 적은 ‘${f.label}’를 선택합니다.`;
  setHTML("auditCalc",`<div class="audit-grid">
    <div class="audit-card">
      <h4>① 기본 치수</h4>
      <p class="formula">낮은 폭 = ${fmt(d.totalW,1)} - ${fmt(d.highW,1)} = <strong>${fmt(d.lowW,1)}mm</strong></p>
      <p class="formula">단차 = ${fmt(d.highH,1)} - ${fmt(d.lowH,1)} = <strong>${fmt(d.stepH,1)}mm</strong></p>
      <p class="formula">지붕 전개폭 = ${fmt(d.highW,1)} + ${fmt(d.stepH,1)} + ${fmt(d.lowW,1)} = <strong>${fmt(d.drapeW,1)}mm</strong></p>
      <p class="formula">600열 = ceil(${fmt(d.L,1)} ÷ 600) = <strong>${d.lenCols600}열</strong><br>마지막 사용 폭 ${fmt(d.last600,1)}mm / 절단 자투리 ${fmt(d.trim600,1)}mm</p>
      <p class="formula">1800열 = ceil(${fmt(d.L,1)} ÷ 1800) = <strong>${d.lenCols1800}열</strong><br>마지막 사용 길이 ${fmt(d.last1800,1)}mm / 절단 자투리 ${fmt(d.trim1800,1)}mm</p>
    </div>
    <div class="audit-card">
      <h4>② 지붕 드레이프</h4>
      <p class="formula">단수 = ceil(${fmt(d.drapeW,1)} ÷ 1800) = <strong>${d.roofRows}단</strong></p>
      <p class="formula">확보 전개폭 = ${d.roofRows} × 1800 = ${fmt(d.roofRows*TILE_L,1)}mm</p>
      <p class="formula">접힘 폭 = ${fmt(d.roofRows*TILE_L,1)} - ${fmt(d.drapeW,1)} = <strong>${fmt(d.fold,1)}mm</strong></p>
      <p class="formula">지붕 = ${d.roofRows}단 × ${d.lenCols600}열 = <strong>${x.roofSheets}장</strong></p>
      <div class="audit-result">패널 방향: 길이 600 × 전개 1800</div>
    </div>
    ${wallCard("③ 낮은 벽",f.lowWall,f.foldToLow)}
    ${wallCard("④ 높은 벽",f.highWall,f.foldToHigh)}
    <div class="audit-card">
      <h4>⑤ 접힘 방향 자동 비교</h4>
      <p class="formula">낮은 벽 접기 = 낮은 벽 ${x.lowFold.lowWall.sheets} + 높은 벽 ${x.lowFold.highWall.sheets} = <strong>${x.lowFold.wallSheets}장</strong></p>
      <p class="formula">높은 벽 접기 = 낮은 벽 ${x.highFold.lowWall.sheets} + 높은 벽 ${x.highFold.highWall.sheets} = <strong>${x.highFold.wallSheets}장</strong></p>
      <div class="audit-result">${foldVerdict}</div>
    </div>
    <div class="audit-card">
      <h4>⑥ 양끝면 · 총합 · 발주</h4>
      <p class="formula">L자 1면 면적 = (${fmt(d.highW,1)}×${fmt(d.highH,1)} + ${fmt(d.lowW,1)}×${fmt(d.lowH,1)}) ÷ 1,000,000 = ${fmt(x.endAreaOne,2)}㎡</p>
      <p class="formula">면적 하한 = ceil(${fmt(x.endAreaOne,2)} ÷ 1.08) = ${ceil(x.endAreaOne/TILE_AREA)}장/면<br>적용값 = ${x.endPerFace}장/면 × 2면 = <strong>${x.endSheets}장</strong></p>
      <p class="formula">※ 양끝면 적용값은 케이스별 기존 재단 검토값입니다. 면적 하한만으로 절단 배치가 증명되지는 않으므로 최소안은 현장 재단성 확인이 필요합니다.</p>
      <p class="formula">총합 = 지붕 ${x.roofSheets} + 낮은 벽 ${f.lowWall.sheets} + 높은 벽 ${f.highWall.sheets} + 양끝 ${x.endSheets} = <strong>${x.totalSheets}장</strong></p>
      <div class="audit-result">${buffer}% 발주 = ceil(${x.totalSheets} × ${(1+buffer/100).toFixed(2)}) = ${orderSheets(x.totalSheets)}장</div>
    </div>
  </div>`);
}

function renderOrientationComparison(x){
  const sh=x.shell;
  const bridge=x.endBridge;
  const rows=[
    ["높은 벽 직하강",`${fmt(sh.highRun.sheets)}장`,`1800 전개띠 ${sh.highRun.fullRows}개 × 길이 600열 ${x.d.lenCols600}`,`잔여 ${fmt(sh.highRun.rem,1)}mm · ${bandCompareLabel(sh.highRun.band)}`],
    ["지붕·낮은 벽 하강",`${fmt(sh.roofLowRun.sheets)}장`,`1800 전개띠 ${sh.roofLowRun.fullRows}개 × 길이 600열 ${x.d.lenCols600}`,`잔여 ${fmt(sh.roofLowRun.rem,1)}mm · ${bandCompareLabel(sh.roofLowRun.band)}`],
    ["양끝 ㄴ자면 현재 적용",`${fmt(x.endSheets)}장`,`${x.endPerFace}장/면 × 2면`,`1면 면적 ${fmt(x.endAreaOne,2)}㎡ · 하한 ${ceil(x.endAreaOne/TILE_AREA)}장/면`],
    ["양끝 ㄴ자면 가로 브리지",`${fmt(bridge.sheets)}장`,`${bridge.perFace}장/면 × 2면`,`하부 전체폭 ${bridge.fullWidthSheets}장/면 + 높은쪽 상부 ${bridge.highOnlySheets}장/면`]
  ];
  byId("orientationTable").querySelector("tbody").innerHTML=rows.map(r=>
    `<tr><td><b>${r[0]}</b></td><td class="num">${r[1]}</td><td>${r[2]}</td><td class="num">-</td><td>${r[3]}</td><td class="num"><span class="tag best">${r[1]}</span></td></tr>`
  ).join("");
  setHTML("orientationNote",`현재 기준은 높은 벽 위 모서리에서 시작하는 양방향 전개식입니다. 높은 벽 직하강면과 지붕·낮은 벽 하강면을 각각 1800 본판과 바닥 잔여띠로 계산합니다.`);
}

function renderScenarioTable(){
  const makeRow=c=>{
    const r=calc(c);
    const practicalEnds=c.endPracticalPerFace*2;
    const practicalTotal=r.shellSheets+practicalEnds;
    return {r, practicalTotal, practicalEnds};
  };
  const all=CASES.map(makeRow);
  setHTML("scenarioHead",`<tr><th>구분</th>${CASES.map(c=>`<th class="num ${c.id===selectedCaseId?"cur":""}">${c.name}</th>`).join("")}<th>계산 방법</th></tr>`);
  const minCell=o=>`<b>${fmt(o.r.totalSheets)}장</b><span class="cell-sub">외피 ${fmt(o.r.shellSheets)} + 끝 ${fmt(o.r.endSheets)}<br>5% 발주 ${fmt(orderSheets(o.r.totalSheets,5))}장</span>`;
  const pracCell=o=>`<b>${fmt(o.practicalTotal)}장</b><span class="cell-sub">외피 ${fmt(o.r.shellSheets)} + 끝 ${fmt(o.practicalEnds)}<br>5% 발주 ${fmt(orderSheets(o.practicalTotal,5))}장</span>`;
  const legacyCell=o=>`<b>${fmt(o.r.legacyLongSheets+o.r.endSheets)}장</b><span class="cell-sub">지붕 ${fmt(o.r.roofSheets)} + 벽 ${fmt(o.r.chosenFold.wallSheets)} + 끝 ${fmt(o.r.endSheets)}</span>`;
  const rows=[
    ["현재 긴 외피 기준",minCell,`1800 전개띠 + 바닥 잔여띠 최적 선택 + 양끝 ${endMode==="min"?"최소":"실무"} 기준`,"scenario-current"],
    ["양끝 실무 여유",pracCell,"긴 외피는 동일하고 양끝면만 실무 여유 장수 적용",""],
    ["이전 분리식 참고",legacyCell,"지붕 드레이프와 벽체를 분리해 계산하던 이전 방식",""]
  ];
  setHTML("scenarioBody",rows.map(([label,cell,note,cls])=>
    `<tr class="${cls}"><td><b>${label}</b>${cls?`<span class="row-badge now">현재 화면</span>`:""}</td>${all.map((o,i)=>`<td class="num ${CASES[i].id===selectedCaseId?"cur":""}">${cell(o)}</td>`).join("")}<td>${note}</td></tr>`
  ).join(""));
}

/* 새 기준 검산: 긴 외피 전개 + 양끝 ㄴ자면 */
function renderAudit(x){
  const d=x.d, sh=x.shell;
  setHTML("auditCalc",`<div class="audit-grid">
    <div class="audit-card">
      <h4>① 기본 치수</h4>
      <p class="formula">낮은 폭 = ${fmt(d.totalW,1)} - ${fmt(d.highW,1)} = <strong>${fmt(d.lowW,1)}mm</strong></p>
      <p class="formula">단차 = ${fmt(d.highH,1)} - ${fmt(d.lowH,1)} = <strong>${fmt(d.stepH,1)}mm</strong></p>
      <p class="formula">길이 600열 = ceil(${fmt(d.L,1)} ÷ 600) = <strong>${d.lenCols600}열</strong> · 마지막 ${fmt(d.last600,1)}mm / 자투리 ${fmt(d.trim600,1)}mm</p>
      <p class="formula">길이 1800열 = ceil(${fmt(d.L,1)} ÷ 1800) = <strong>${d.lenCols1800}열</strong> · 마지막 ${fmt(d.last1800,1)}mm / 자투리 ${fmt(d.trim1800,1)}mm</p>
    </div>
    <div class="audit-card">
      <h4>② 높은 벽 위 기준 양방향</h4>
      <p class="formula">A. 높은 벽 직하강 = ${fmt(d.highH,1)}mm</p>
      <p class="formula">B. 지붕·낮은 벽 하강 = 높은 지붕 ${fmt(d.highW,1)} + 단차 ${fmt(d.stepH,1)} + 낮은 지붕 ${fmt(d.lowW,1)} + 낮은 벽 ${fmt(d.lowH,1)} = ${fmt(sh.roofLowRun.width,1)}mm</p>
      <div class="audit-result">총 외피 전개폭 합계 = ${fmt(sh.width,1)}mm</div>
    </div>
    <div class="audit-card">
      <h4>③ 1800 본판</h4>
      <p class="formula">높은 벽 직하강 = floor(${fmt(sh.highRun.width,1)} ÷ 1800) ${sh.highRun.fullRows}띠 × ${d.lenCols600}열 = ${sh.highRun.mainSheets}장, 잔여 ${fmt(sh.highRun.rem,1)}mm</p>
      <p class="formula">지붕·낮은 벽 하강 = floor(${fmt(sh.roofLowRun.width,1)} ÷ 1800) ${sh.roofLowRun.fullRows}띠 × ${d.lenCols600}열 = ${sh.roofLowRun.mainSheets}장, 잔여 ${fmt(sh.roofLowRun.rem,1)}mm</p>
      <div class="audit-result">본판 합계 = ${sh.mainSheets}장</div>
    </div>
    <div class="audit-card">
      <h4>④ 바닥 잔여띠</h4>
      <p class="formula">높은 벽 직하강: ${bandCompareLabel(sh.highRun.band)} → ${sh.highRun.band.chosenSheets}장</p>
      <p class="formula">지붕·낮은 벽 하강: ${bandCompareLabel(sh.roofLowRun.band)} → ${sh.roofLowRun.band.chosenSheets}장</p>
      <div class="audit-result">잔여띠 합계 = ${sh.sheets-sh.mainSheets}장</div>
    </div>
    <div class="audit-card">
      <h4>⑤ 양끝 ㄴ자면</h4>
      <p class="formula">L자 1면 면적 = (${fmt(d.highW,1)}×${fmt(d.highH,1)} + ${fmt(d.lowW,1)}×${fmt(d.lowH,1)}) ÷ 1,000,000 = ${fmt(x.endAreaOne,2)}㎡</p>
      <p class="formula">면적 하한 = ceil(${fmt(x.endAreaOne,2)} ÷ 1.08) = ${ceil(x.endAreaOne/TILE_AREA)}장/면</p>
      <div class="audit-result">적용값 = ${x.endPerFace}장/면 × 2면 = ${x.endSheets}장</div>
    </div>
    <div class="audit-card">
      <h4>⑥ 총합 · 발주 · 참고 비교</h4>
      <p class="formula">긴 외피 = 본판 ${sh.mainSheets} + 잔여띠 ${sh.sheets-sh.mainSheets} = <strong>${sh.sheets}장</strong></p>
      <p class="formula">총합 = 긴 외피 ${sh.sheets} + 양끝 ${x.endSheets} = <strong>${x.totalSheets}장</strong></p>
      <p class="formula">참고: 이전 지붕/벽 분리식 = 지붕 ${x.roofSheets} + 벽 ${x.chosenFold.wallSheets} + 양끝 ${x.endSheets} = ${x.legacyLongSheets+x.endSheets}장</p>
      <div class="audit-result">${buffer}% 발주 = ceil(${x.totalSheets} × ${(1+buffer/100).toFixed(2)}) = ${orderSheets(x.totalSheets)}장</div>
    </div>
  </div>`);
}
