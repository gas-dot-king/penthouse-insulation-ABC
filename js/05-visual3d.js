/* ══════════════════════════════════════════════════════════════
   3D 덮기 뷰 — 캔버스 입체 도면.
   ㄴ자 건물을 마우스로 돌려 보는 3D로 그리고, 보온재가 덮이는 순서
   (① 높은 벽 직하강 → ② 지붕·단차·낮은 벽 하강 → ③ 바닥 잔여띠 →
   ④ 양끝 ㄴ자면)를 단계 버튼과 재생 애니메이션으로 보여줍니다.
   01-core / 02-calc / 03-render(bandCompareLabel)가 먼저 로드돼야 하며,
   04-visual.js 의 draw()가 view==="walls"일 때 draw3D()를 부릅니다.
   ══════════════════════════════════════════════════════════════ */

const V3D={
  x:null, model:null,
  yaw:2.18, pitch:0.42, zoom:1, presetId:"iso",
  step:4, playing:false, playT:0, lastTs:0, playStep:1, uiKey:"",
  autoPlayed:false, raf:0, canvas:null, ctx:null, ro:null,
  lastPX:0, lastPY:0
};
const V3D_SPEED=2000;   /* 재생 속도: 초당 전개 mm */
const V3D_GAP=0.6;      /* 재생 시 단계 사이 멈춤(초) */
const V3D_STEPS=["구조만","① 높은 벽","② 지붕→낮은 벽","③ 잔여 밴드","④ 양끝면"];
const V3D_FONT="'Segoe UI','Noto Sans KR',Arial,sans-serif";

function v3dPresets(){
  const s=(V3D.model&&V3D.model.d.highSide==="right")?-1:1; /* 도면과 같은 쪽에 높은 벽 */
  return {
    iso:{name:"비스듬히", yaw:s*2.18, pitch:0.42},
    front:{name:"정면 ㄴ자", yaw:s*Math.PI/2, pitch:0.10},
    top:{name:"위에서", yaw:s*2.18, pitch:1.30}
  };
}

/* ═══════════════ 모델: ㄴ자 프리즘 면 + 두 전개 방향 ═══════════════
   좌표: x=길이(0..L), y=높이(0..highH), z=폭(0..totalW, 높은 구간이 z 0쪽).
   run="high"  : 높은 벽 직하강. run 좌표 0 = 높은 벽 위 모서리.
   run="drape" : 높은 지붕→단차→낮은 지붕→낮은 벽. 같은 모서리에서 시작. */
function v3dModel(x){
  const d=x.d;
  const L=d.L, W=d.totalW, hw=d.highW, hh=d.highH, lh=d.lowH, st=d.stepH, lw=d.lowW;
  const hr=x.shell.highRun, dr=x.shell.roofLowRun;
  const faces=[
    {key:"highWall", name:`높은 벽 ${fmt(hh)}`,    O:[0,hh,0],  U:[1,0,0], V:[0,-1,0], uLen:L, vLen:hh, n:[0,0,-1], run:"high",  runStart:0,        startEdge:true},
    {key:"highRoof", name:`높은 지붕 ${fmt(hw,0)}`, O:[0,hh,0],  U:[1,0,0], V:[0,0,1],  uLen:L, vLen:hw, n:[0,1,0],  run:"drape", runStart:0,        startEdge:true},
    {key:"step",     name:`단차 ${fmt(st,0)}`,      O:[0,hh,hw], U:[1,0,0], V:[0,-1,0], uLen:L, vLen:st, n:[0,0,1],  run:"drape", runStart:hw,       foldEdge:true},
    {key:"lowRoof",  name:`낮은 지붕 ${fmt(lw,0)}`, O:[0,lh,hw], U:[1,0,0], V:[0,0,1],  uLen:L, vLen:lw, n:[0,1,0],  run:"drape", runStart:hw+st,    foldEdge:true},
    {key:"lowWall",  name:`낮은 벽 ${fmt(lh)}`,    O:[0,lh,W],  U:[1,0,0], V:[0,-1,0], uLen:L, vLen:lh, n:[0,0,1],  run:"drape", runStart:hw+st+lw, foldEdge:true}
  ];
  const endPoly=[[0,0],[0,hh],[hw,hh],[hw,lh],[W,lh],[W,0]]; /* (z,y) */
  const ends=[
    {key:"end0", x:0, n:[-1,0,0], poly:endPoly},
    {key:"end1", x:L, n:[1,0,0],  poly:endPoly}
  ];
  return {x, d, L, W, hw, hh, lh, st, lw, hr, dr, faces, ends,
    mainHigh:hr.fullRows*TILE_L, mainDrape:dr.fullRows*TILE_L,
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
  let t=V3D.playT;
  const phases=[
    {step:1, dur:Math.max(.25,m.mainHigh/V3D_SPEED),  set:f=>{cov.high=m.mainHigh*f;}},
    {step:2, dur:Math.max(.25,m.mainDrape/V3D_SPEED), set:f=>{cov.drape=m.mainDrape*f;}},
    {step:3, dur:2.0, set:f=>{cov.high=m.mainHigh+(m.runWHigh-m.mainHigh)*f; cov.drape=m.mainDrape+(m.runWDrape-m.mainDrape)*f;}},
    {step:4, dur:1.6, set:f=>{cov.ends=f;}}
  ];
  for(const p of phases){
    if(t>=p.dur+V3D_GAP){ p.set(1); t-=p.dur+V3D_GAP; }
    else { p.set(Math.min(1,t/p.dur)); return {cov, step:p.step, done:false}; }
  }
  return {cov, step:4, done:t>0.4};
}

function v3dCoverage(m){
  if(V3D.playing) return v3dPlayState(m).cov;
  const s=V3D.step;
  return {
    high:  s>=3 ? m.runWHigh  : (s>=1 ? m.mainHigh  : 0),
    drape: s>=3 ? m.runWDrape : (s>=2 ? m.mainDrape : 0),
    ends:  s>=4 ? 1 : 0
  };
}

function v3dEffStep(){ return V3D.playing ? V3D.playStep : V3D.step; }

/* ═══════════════ 진입점 (04-visual draw()에서 호출) ═══════════════ */
function draw3D(x){
  setVisualHead("3D 덮기","건물을 입체로 돌려 보며 덮는 순서를 확인합니다. 드래그 회전 · 휠 확대 · 단계 버튼 또는 ▶ 재생.");
  V3D.x=x;
  V3D.model=v3dModel(x);
  const fresh=v3dEnsureDom();
  if(V3D.presetId) v3dApplyPreset(V3D.presetId);
  V3D.uiKey="";
  if(fresh&&!V3D.autoPlayed){ V3D.autoPlayed=true; V3D.step=0; v3dPlay(); return; }
  if(V3D.playing) v3dStop();
  v3dSyncUI();
  v3dRepaint();
}

/* ═══════════════ DOM 구성 + 이벤트 ═══════════════ */
function v3dEnsureDom(){
  if(byId("v3dCanvas")) return false;
  byId("svgWrap").innerHTML=`
  <div class="v3d">
    <div class="v3d-bar">
      <div class="seg" id="v3dSteps">${V3D_STEPS.map((t,i)=>`<button data-step="${i}">${t}</button>`).join("")}</div>
      <button class="v3d-play" id="v3dPlay">▶ 순서대로 재생</button>
      <div class="seg" id="v3dViews">${Object.entries(v3dPresets()).map(([id,p])=>`<button data-pv="${id}">${p.name}</button>`).join("")}</div>
    </div>
    <div class="v3d-stage" id="v3dStage">
      <canvas id="v3dCanvas"></canvas>
      <div class="v3d-hint">드래그 회전 · 휠 확대/축소 · 더블클릭 시점 초기화</div>
    </div>
    <div class="v3d-info" id="v3dInfo"></div>
  </div>`;
  const cv=byId("v3dCanvas");
  V3D.canvas=cv; V3D.ctx=cv.getContext("2d");

  qsa("#v3dSteps button").forEach(b=>b.addEventListener("click",()=>{ v3dStop(); v3dSetStep(Number(b.dataset.step)); }));
  byId("v3dPlay").addEventListener("click",()=>{
    if(V3D.playing){ v3dStop(); V3D.step=V3D.playStep; v3dSyncUI(); v3dRepaint(); }
    else { V3D.step=0; v3dPlay(); }
  });
  qsa("#v3dViews button").forEach(b=>b.addEventListener("click",()=>{
    V3D.zoom=1; v3dApplyPreset(b.dataset.pv); v3dSyncUI(); v3dRepaint();
  }));

  let pid=null;
  cv.addEventListener("pointerdown",e=>{ pid=e.pointerId; cv.setPointerCapture(pid); V3D.lastPX=e.clientX; V3D.lastPY=e.clientY; });
  cv.addEventListener("pointermove",e=>{
    if(pid===null) return;
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
  cv.addEventListener("wheel",e=>{
    e.preventDefault();
    V3D.zoom=Math.min(4,Math.max(0.35,V3D.zoom*Math.exp(-e.deltaY*0.0012)));
    if(!V3D.playing) v3dRepaint();
  },{passive:false});
  cv.addEventListener("dblclick",()=>{ V3D.zoom=1; v3dApplyPreset("iso"); v3dSyncUI(); if(!V3D.playing) v3dRepaint(); });

  if(V3D.ro) V3D.ro.disconnect();
  V3D.ro=new ResizeObserver(()=>{ if(byId("v3dCanvas")===cv) v3dRepaint(); });
  V3D.ro.observe(byId("v3dStage"));
  return true;
}

function v3dApplyPreset(id){
  const p=v3dPresets()[id];
  if(!p) return;
  V3D.presetId=id; V3D.yaw=p.yaw; V3D.pitch=p.pitch;
}

function v3dActivePresetBtns(){
  if(byId("v3dViews")) setActiveButtons("#v3dViews button",b=>b.dataset.pv===V3D.presetId);
}

function v3dSetStep(i){ V3D.step=i; v3dSyncUI(); v3dRepaint(); }

/* ═══════════════ 재생 ═══════════════ */
function v3dPlay(){
  V3D.playing=true; V3D.playT=0; V3D.lastTs=0; V3D.playStep=1;
  const b=byId("v3dPlay"); if(b) b.textContent="⏸ 멈추기";
  cancelAnimationFrame(V3D.raf);
  V3D.raf=requestAnimationFrame(v3dTick);
}

function v3dStop(){
  if(!V3D.playing) return;
  V3D.playing=false;
  cancelAnimationFrame(V3D.raf);
  const b=byId("v3dPlay"); if(b) b.textContent="▶ 순서대로 재생";
}

function v3dTick(ts){
  if(!V3D.playing) return;
  if(!V3D.lastTs) V3D.lastTs=ts;
  V3D.playT+=(ts-V3D.lastTs)/1000; V3D.lastTs=ts;
  const st=v3dPlayState(V3D.model);
  V3D.playStep=st.step;
  if(st.done){ v3dStop(); V3D.step=4; }
  v3dSyncUI();
  v3dRepaint();
  if(V3D.playing) V3D.raf=requestAnimationFrame(v3dTick);
}

/* ═══════════════ 단계 정보 패널 ═══════════════ */
function v3dCumSheets(m,step){
  let n=0;
  if(step>=1) n+=m.hr.mainSheets;
  if(step>=2) n+=m.dr.mainSheets;
  if(step>=3) n+=m.hr.band.chosenSheets+m.dr.band.chosenSheets;
  if(step>=4) n+=m.x.endSheets;
  return n;
}

function v3dInfoHTML(m,step){
  const x=m.x, d=m.d, hr=m.hr, dr=m.dr;
  const items=[
    {t:`${d.name} — 덮기 전 구조`,
     p:`정면에서 보면 높은 벽(${fmt(d.highH)}mm)과 낮은 벽(${fmt(d.lowH)}mm) 사이에 ${fmt(d.stepH)}mm 단차가 있는 ㄴ자 건물입니다. 길이 ${fmt(d.L,1)} × 폭 ${fmt(d.totalW,1)}mm. 바닥은 덮지 않으며, 모든 덮기의 시작점은 높은 벽 위 모서리(검은 선)입니다.`},
    {t:`① 높은 벽 직하강 — ${fmt(hr.mainSheets)}장`,
     p:`높은 벽 위 모서리에서 바닥 쪽으로 보온재를 세로(긴 변 1800이 아래 방향)로 ${hr.fullRows}단 내려 붙입니다. 길이 방향은 600폭 ${d.lenCols600}열(마지막 열은 ${fmt(d.last600,1)}mm만 사용, ${fmt(d.trim600,1)}mm 절단). ${d.lenCols600}열 × ${hr.fullRows}단 = ${fmt(hr.mainSheets)}장. 바닥까지 ${fmt(hr.rem,1)}mm가 딱 안 떨어지고 남는데, 이 띠는 ③에서 처리합니다.`},
    {t:`② 지붕 넘어 낮은 벽까지 이어 덮기 — ${fmt(dr.mainSheets)}장`,
     p:`같은 모서리에서 반대쪽으로 높은 지붕 → 단차 → 낮은 지붕 → 낮은 벽 바닥까지 한 줄로 이어 덮습니다. 초록 점선은 자르는 곳이 아니라 접어 넘기는 곳입니다. 펼친 길이 ${fmt(dr.width,1)}mm에 1800씩 ${dr.fullRows}단 × ${d.lenCols600}열 = ${fmt(dr.mainSheets)}장. 남는 ${fmt(dr.rem,1)}mm는 ③에서.`},
    {t:`③ 바닥 잔여띠 — ${fmt(hr.band.chosenSheets+dr.band.chosenSheets)}장`,
     p:`두 방향 모두 바닥 쪽에 1800이 딱 안 떨어지는 띠가 남습니다. 띠마다 ‘가로로 눕히기’와 ‘1장을 여러 줄로 잘라 쓰기(스트립)’를 비교해 장수가 적은 쪽을 골랐습니다. 높은 벽 쪽: ${bandCompareLabel(hr.band)}. 낮은 벽 쪽: ${bandCompareLabel(dr.band)}.`},
    {t:`④ 양끝 ㄴ자면 — ${fmt(x.endSheets)}장, 여기서 완성`,
     p:`앞·뒤 끝의 ㄴ자 면은 케이스별 재단 검토값 ${x.endPerFace}장/면 × 2면을 적용합니다(현재 ${endMode==="min"?"최소 재단":"실무 여유"} 기준). 최종 합계: 높은 벽 ${fmt(hr.sheets)} + 지붕·낮은 벽 ${fmt(dr.sheets)} + 양끝 ${fmt(x.endSheets)} = 총 ${fmt(x.totalSheets)}장.`}
  ];
  const it=items[Math.min(Math.max(step,0),4)];
  const sum=step>0
    ?`<div class="sum">여기까지 ${fmt(v3dCumSheets(m,step))}장 / 총 ${fmt(x.totalSheets)}장${V3D.playing?" · 재생 중":""}</div>`
    :`<div class="sum">▶ 재생을 누르면 덮는 순서를 처음부터 보여줍니다.</div>`;
  return `<b class="t">${it.t}</b><p>${it.p}</p>${sum}`;
}

function v3dSyncUI(){
  if(!byId("v3dSteps")||!V3D.model) return;
  const eff=v3dEffStep();
  setActiveButtons("#v3dSteps button",b=>Number(b.dataset.step)===eff);
  v3dActivePresetBtns();
  const key=V3D.model.d.id+"|"+eff+"|"+endMode+"|"+V3D.playing;
  if(key!==V3D.uiKey){ V3D.uiKey=key; setHTML("v3dInfo",v3dInfoHTML(V3D.model,eff)); }
}

/* ═══════════════ 그리기 ═══════════════ */
function v3dRepaint(){
  const m=V3D.model, cv=V3D.canvas;
  if(!m||!cv) return;
  if(!cv.isConnected){ v3dStop(); return; }
  const ctx=V3D.ctx, dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth||10, h=cv.clientHeight||10;
  const bw=Math.round(w*dpr), bh=Math.round(h*dpr);
  if(cv.width!==bw||cv.height!==bh){ cv.width=bw; cv.height=bh; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);

  const X=m.x, d=m.d, hr=m.hr, dr=m.dr;
  const cov=v3dCoverage(m);
  const eff=v3dEffStep();

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
  const scale=Math.min((w-100)/Math.max(1,bx1-bx0),(h-150)/Math.max(1,by1-by0))*V3D.zoom;
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

  const mainLen=r=>r==="high"?m.mainHigh:m.mainDrape;
  const runWOf=r=>r==="high"?m.runWHigh:m.runWDrape;
  const bandOf=r=>r==="high"?hr.band:dr.band;
  const remOf=r=>r==="high"?hr.rem:dr.rem;

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
      poly([q(0,0),q(f.uLen,0),q(f.uLen,mv1),q(0,mv1)],shade("#c9def8",lf),null);
      for(let u=TILE_S;u<f.uLen-1;u+=TILE_S) seg(q(u,0),q(u,mv1),"rgba(37,99,235,.4)",0.7);
      for(let s=Math.ceil((a+1)/TILE_L)*TILE_L;s<a+mv1-1;s+=TILE_L)
        seg(q(0,s-a),q(f.uLen,s-a),shade("#2563eb",1),1.6);        /* 1800 장 경계 */
    }
    if(bv1>bv0+0.5){
      const b=bandOf(f.run), horiz=isHorizontalBand(b);
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
    if(f.startEdge&&eff>=1) seg(c00,c10,"#111827",3);              /* 시작 모서리 */
  }

  function drawEndFace(e){
    const pz=(z,y)=>P([e.x,y,z]);
    const pts=e.poly.map(pt=>pz(pt[0],pt[1]));
    if(rotN(e.n)<=0.02){ poly(pts,shade("#aeb7c4",0.8),"#7c8798",1); return; }
    const lf=lum(e.n);
    poly(pts,shade("#e9edf3",lf),null);
    seg(pz(m.hw,0),pz(m.hw,m.lh),"#111827",1);                     /* 높은/낮은 구간 경계 */
    if(cov.ends>0){
      ctx.save();
      ctx.globalAlpha=cov.ends;
      ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath();
      ctx.fillStyle=shade("#e6def9",lf); ctx.fill();
      ctx.clip();
      for(let z=TILE_S;z<m.W-1;z+=TILE_S) seg(pz(z,0),pz(z,m.hh),"rgba(124,58,237,.55)",0.9);
      /* 위에서부터 1800 세로판, 자투리는 바닥 쪽(빨강) */
      [[0,m.hw,m.hh],[m.hw,m.W,m.lh]].forEach(sec=>{
        const [za,zb,ht]=sec, rows=floor(ht/TILE_L), rem=ht-rows*TILE_L;
        for(let k=1;k<=rows;k++) seg(pz(za,ht-k*TILE_L),pz(zb,ht-k*TILE_L),"rgba(124,58,237,.75)",1.3);
        if(rem>1){
          poly([pz(za,rem),pz(zb,rem),pz(zb,0),pz(za,0)],"rgba(252,165,165,.5)",null);
          seg(pz(za,rem),pz(zb,rem),"#dc2626",1.1,[7,6]);
        }
      });
      ctx.restore();
    }
    poly(pts,null,"#111827",1.4);
  }

  /* 화가 알고리즘: 먼 면부터 */
  const items=[];
  m.faces.forEach(f=>{
    const c=rot(v3dFacePoint(f,f.uLen/2,f.vLen/2));
    items.push({z:c[2], draw:()=>drawRunFace(f)});
  });
  m.ends.forEach(e=>{
    const zAvg=e.poly.reduce((s,p)=>s+p[0],0)/e.poly.length;
    const yAvg=e.poly.reduce((s,p)=>s+p[1],0)/e.poly.length;
    items.push({z:rot([e.x,yAvg,zAvg])[2], draw:()=>drawEndFace(e)});
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
  if(eff>=1) drawArrowPath([[xm,m.hh+off,-off],[xm,150,-off]],"#2563eb");
  if(eff>=2) drawArrowPath([[xm,m.hh+off,-off],[xm,m.hh+off,m.hw+off],[xm,m.lh+off,m.hw+off],[xm,m.lh+off,m.W+off],[xm,150,m.W+off]],"#16a34a");

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
  const faceByKey=k=>m.faces.find(f=>f.key===k);
  function faceLabel(fkey,u,v,text,o){
    const f=faceByKey(fkey);
    if(rotN(f.n)<=0.05) return;
    drawLabel(v3dFacePoint(f,u,v),text,o);
  }

  /* 면 이름(흐리게) — 그 면이 덮이기 전까지만 표시해 수량 라벨과 겹치지 않게 함 */
  m.faces.forEach(f=>{
    if(rotN(f.n)<=0.05) return;
    if(f.run==="high"&&eff>=1) return;
    if(f.run==="drape"&&eff>=2) return;
    drawLabel(v3dFacePoint(f,f.uLen*0.13,f.vLen*0.5),f.name,{size:11.5,weight:600,color:"#5b6472",align:"center"});
  });

  if(eff>=1) drawLabel([xm,m.hh,0],"시작: 높은 벽 위 모서리",{dot:true,dx:16,dy:26,size:12,weight:800});
  if(eff>=1&&cov.high>=m.mainHigh*0.55)   /* 재생 중에는 어느 정도 덮인 뒤 표시(시작 라벨과 겹침 방지) */
    faceLabel("highWall",xm,Math.min(cov.high,m.mainHigh)/2,
      `① 세로 1800 × ${hr.fullRows}단 × ${d.lenCols600}열 = ${fmt(hr.mainSheets)}장`,
      {align:"center",color:"#1d4ed8",size:13,weight:800});
  if(eff>=2&&cov.drape>=m.hw*0.6)
    faceLabel("highRoof",xm,m.hw/2,
      `② 지붕→단차→낮은 벽 ${dr.fullRows}단 × ${d.lenCols600}열 = ${fmt(dr.mainSheets)}장`,
      {align:"center",color:"#1d4ed8",size:13,weight:800,dot:true,dy:-34});
  if(eff>=2)
    faceLabel("step",xm,m.st/2,"모서리는 자르지 않고 접어 넘김",{align:"center",size:11.5,weight:700,color:"#15803d"});

  function bandLabel(runKey){
    const b=bandOf(runKey);
    if(b.chosen==="none"||b.chosenSheets===0) return;
    const loc=v3dRunLocate(m,runKey,(mainLen(runKey)+runWOf(runKey))/2);
    if(rotN(loc.f.n)<=0.05) return;
    const horiz=isHorizontalBand(b);
    const what=horiz?`가로로 눕혀 ${fmt(b.chosenSheets)}장`:`1장을 ${b.stripsPerSheet}줄로 잘라 ${fmt(b.chosenSheets)}장`;
    const alt=b.chosen==="horizontal-same"?`(스트립도 ${fmt(b.stripSheets)}장 → 이음매 적은 가로 선택)`
      :horiz?`(스트립이면 ${fmt(b.stripSheets)}장 → ${fmt(b.stripSheets-b.horizontalSheets)}장 절약)`
      :`(가로면 ${fmt(b.horizontalSheets)}장 → ${fmt(b.horizontalSheets-b.stripSheets)}장 절약)`;
    drawLabel(v3dFacePoint(loc.f,xm,loc.v),
      `③ 잔여 ${fmt(remOf(runKey),0)}mm → ${what}\n${alt}`,
      {align:"center",dy:34,dot:true,color:"#c2410c",size:12.5,weight:800});
  }
  if(eff>=3){ bandLabel("high"); bandLabel("drape"); }

  if(cov.ends>0.55){
    const eSorted=m.ends.map(e=>({e,dep:rotN(e.n)})).sort((a,b)=>b.dep-a.dep)[0];
    if(eSorted.dep>0.05){
      const e=eSorted.e;
      const zAvg=e.poly.reduce((s,p)=>s+p[0],0)/e.poly.length;
      const yAvg=e.poly.reduce((s,p)=>s+p[1],0)/e.poly.length;
      drawLabel([e.x,yAvg,zAvg],`④ ㄴ자면 ${X.endPerFace}장/면 × 2 = ${fmt(X.endSheets)}장`,
        {align:"center",color:"#6d28d9",size:13,weight:800});
    }
  }

  drawLabel([xm,0,m.W+mg*0.45],"바닥은 덮지 않음 (바닥선에서 재단)",{align:"center",size:11.5,weight:600,color:"#8a93a3",lead:false});
  if(eff===0){
    drawLabel([xm,0,-mg*0.35],`길이 ${fmt(d.L,1)}mm`,{align:"center",size:11.5,weight:700,color:"#5b6472",lead:false});
    drawLabel([-mg*0.35,0,m.W/2],`폭 ${fmt(d.totalW,1)}mm`,{align:"center",size:11.5,weight:700,color:"#5b6472",lead:false});
  }

  /* 좌상단 캡션 */
  ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  ctx.font=`800 14px ${V3D_FONT}`;
  ctx.fillStyle="#111827";
  const cap=eff===0
    ?`${d.name} · 덮기 전 구조`
    :`${V3D_STEPS[eff]} — 여기까지 ${fmt(v3dCumSheets(m,eff))}장 / 총 ${fmt(X.totalSheets)}장${V3D.playing?" (재생 중)":""}`;
  ctx.fillText(cap,16,26);
  ctx.font=`600 11.5px ${V3D_FONT}`;
  ctx.fillStyle="#64748b";
  ctx.fillText(`${d.name} · 높은 쪽 ${d.highSide==="left"?"왼쪽":"오른쪽"} · 패널 1800×600 고정`,16,44);
}
