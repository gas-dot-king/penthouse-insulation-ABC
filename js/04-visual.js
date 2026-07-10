/* ══════════════════════════════════════════════════════════════
   SVG 도면 그리기.
   전체 3면도 · 지붕 · 벽체 · 양끝면 · 막대 비교 탭.
   01-core.js, 02-calc.js 필요.
   ══════════════════════════════════════════════════════════════ */

/* ═══════════════ SVG 시각화 ═══════════════ */
function svgStart(title,sub,W,H){
return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
<marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#475467"/></marker>
<style>
.outer{fill:#fff;stroke:#111;stroke-width:2}.tile{fill:#dbeafe;stroke:#2563eb;stroke-width:1}
.fold{fill:#dcfce7;stroke:#16a34a;stroke-width:1.2}.band{fill:#ffedd5;stroke:#f97316;stroke-width:1.2}
.trim{fill:#fee2e2;stroke:#dc2626;stroke-width:1}.violet{fill:#ede9fe;stroke:#7c3aed;stroke-width:1.2}
.dash{stroke:#111;stroke-width:1.2;stroke-dasharray:7 6}
.viewcard{fill:#f8fafc;stroke:#d9dee8;stroke-width:1.4}.outline{fill:none;stroke:#111;stroke-width:2}.gridline{stroke:#2563eb;stroke-width:.8;opacity:.58}
.dim{stroke:#475467;stroke-width:1;marker-start:url(#arrow);marker-end:url(#arrow)}
.badge{fill:#111827}.badgeTxt{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;fill:#fff;font-size:12px;font-weight:800}
.txt{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;fill:#111;font-size:13px}
.mut{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;fill:#666;font-size:11px}
.big{font-size:16px;font-weight:800}
</style></defs>
<text class="txt big" x="36" y="30">${esc(title)}</text>
<text class="mut" x="36" y="50">${esc(sub)}</text>`;
}

function draw(x){
  if(view==="summary") return drawSummary(x);
  if(view==="roof") return drawRoof(x);
  if(view==="walls") return draw3D(x);   /* 3D 덮기 탭 — 05-visual3d.js */
  if(view==="ends") return drawEnds(x);
  return drawSummary(x);
}

function setVisualHead(t,s){
  setText("visualSub",s);
}

function setSvg(parts){
  setHTML("svgWrap",parts.join(""));
}

function drawSummary(x){
  const d=x.d, f=x.chosenFold;
  setVisualHead("전체","윗면·정면·옆면을 분리하고, 각 칸이 1800×600 보온재 1장의 어느 방향인지 표시했습니다.");
  const W=1180,H=940;
  let s=[svgStart(`${d.name} 전체 기준 배치`, `총 ${x.totalSheets}장 = 지붕 ${x.roofSheets} + 벽체 ${f.wallSheets} + 양끝 ${x.endSheets} · ${f.label}`, W,H)];

  /* ① 윗면 · 지붕 전개 */
  const tx=35,ty=75,tw=1110,th=330, gx=70,gy=135,gw=1035,gh=210;
  s.push(`<rect class="viewcard" x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="14"/>`);
  s.push(`<text class="txt big" x="55" y="107">① 윗면 · 지붕 전개도</text>`);
  s.push(`<text class="mut" x="240" y="106">위에서 보되 단차까지 펼쳐 표시</text>`);
  s.push(`<rect class="badge" x="1000" y="88" width="118" height="28" rx="14"/><text class="badgeTxt" x="1059" y="107" text-anchor="middle">지붕 ${x.roofSheets}장</text>`);
  for(let r=0;r<d.roofRows;r++){
    for(let c=0;c<d.lenCols600;c++){
      const cls=c===d.lenCols600-1?"trim":"tile";
      s.push(`<rect class="${cls}" x="${gx+gw*c/d.lenCols600}" y="${gy+gh*r/d.roofRows}" width="${gw/d.lenCols600}" height="${gh/d.roofRows}"/>`);
    }
  }
  const foldH=gh*d.fold/(d.roofRows*TILE_L);
  const foldY=f.target==="low"?gy+gh-foldH:gy;
  s.push(`<rect class="fold" x="${gx}" y="${foldY}" width="${gw}" height="${Math.max(4,foldH)}" opacity=".9"/>`);
  s.push(`<line class="dash" x1="${gx}" y1="${f.target==="low"?foldY:foldY+foldH}" x2="${gx+gw}" y2="${f.target==="low"?foldY:foldY+foldH}"/>`);
  const usableTop=f.target==="high"?gy+foldH:gy;
  const usableH=gh-foldH;
  const yHigh=usableTop+usableH*d.highW/d.drapeW;
  const yStep=yHigh+usableH*d.stepH/d.drapeW;
  s.push(`<line x1="${gx}" y1="${yHigh}" x2="${gx+gw}" y2="${yHigh}" stroke="#111827" stroke-width="2"/>`);
  s.push(`<line x1="${gx}" y1="${yStep}" x2="${gx+gw}" y2="${yStep}" stroke="#111827" stroke-width="2"/>`);
  s.push(`<text class="txt" x="${gx+12}" y="${usableTop+22}" font-weight="700">높은 지붕 ${fmt(d.highW,1)}</text>`);
  s.push(`<text class="txt" x="${gx+12}" y="${yHigh+20}" font-weight="700">단차 ${fmt(d.stepH,1)}</text>`);
  s.push(`<text class="txt" x="${gx+12}" y="${yStep+20}" font-weight="700">낮은 지붕 ${fmt(d.lowW,1)}</text>`);
  s.push(`<text class="txt" x="${gx+gw-10}" y="${foldY+(f.target==="low"?-7:foldH+17)}" text-anchor="end" font-weight="700">접힘 ${fmt(d.fold,1)} → ${f.target==="low"?"낮은 벽":"높은 벽"}</text>`);
  s.push(`<line class="dim" x1="${gx}" y1="375" x2="${gx+gw}" y2="375"/><text class="mut" x="${gx+gw/2}" y="394" text-anchor="middle">길이 ${fmt(d.L,1)}mm = 600폭 ${d.lenCols600}열 · 마지막 사용 ${fmt(d.last600,1)}mm / 자투리 ${fmt(d.trim600,1)}mm</text>`);
  s.push(`<line class="dim" x1="1122" y1="${usableTop}" x2="1122" y2="${usableTop+usableH}"/><text class="mut" x="1138" y="${usableTop+usableH/2}" text-anchor="middle" transform="rotate(-90 1138 ${usableTop+usableH/2})">전개폭 ${fmt(d.drapeW,1)}mm</text>`);
  const cellLabelY = f.target==="low" ? gy+28 : gy+gh-12; /* 접힘 라벨 반대편에 배치 */
  s.push(`<text class="txt" x="${gx+gw-8}" y="${cellLabelY}" text-anchor="end" font-weight="800">1칸 = 600(길이) × 1800(전개) · 장변 ↕</text>`);

  /* ② 정면 · 벽체 */
  const fx=35,fy=425,fw=700,fh=465, wx=60,ww=650;
  s.push(`<rect class="viewcard" x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="14"/>`);
  s.push(`<text class="txt big" x="55" y="458">② 정면 · 긴 벽체</text>`);
  s.push(`<text class="mut" x="205" y="457">지붕이 접혀 내려온 부분(초록)이 맨 위, 그 아래부터 세로 본판, 남는 띠(주황)는 바닥쪽</text>`);
  s.push(`<rect class="badge" x="590" y="439" width="118" height="28" rx="14"/><text class="badgeTxt" x="649" y="458" text-anchor="middle">벽체 ${f.wallSheets}장</text>`);
  function summaryWall(wall,label,y,h,foldAmount){
    const totalH=wall.height+foldAmount;
    const foldPx=totalH>0?h*foldAmount/totalH:0;
    const bodyPx=h-foldPx;                                   /* 벽 패널이 차지하는 높이(=처리높이) */
    const mainRatio=wall.height?wall.fullRows*TILE_L/wall.height:0;
    const mainH=bodyPx*mainRatio, bandH=bodyPx-mainH, my=y+foldPx, by=y+foldPx+mainH; /* 위: 지붕 접힘 → 본판 → 아래: 남는 띠 */
    s.push(`<text class="txt" x="${wx}" y="${y-9}" font-weight="800">${esc(label)} · ${fmt(totalH,1)}mm · ${wall.sheets}장</text>`);
    if(foldPx>0){
      s.push(`<rect class="fold" x="${wx}" y="${y}" width="${ww}" height="${foldPx}"/>`);
      s.push(`<line class="dash" x1="${wx}" y1="${my}" x2="${wx+ww}" y2="${my}" opacity=".85"/>`);
      s.push(`<text class="txt" x="${wx+8}" y="${y+Math.max(13,foldPx/2+4)}" font-weight="700">지붕이 ㄴ자로 접혀 내려온 ${fmt(foldAmount,1)}mm ↓ (벽은 이 아래부터)</text>`);
    }
    if(mainH>0){
      s.push(`<rect class="tile" x="${wx}" y="${my}" width="${ww}" height="${mainH}"/>`);
      for(let r=1;r<wall.fullRows;r++) s.push(`<line class="gridline" x1="${wx}" y1="${my+mainH*r/wall.fullRows}" x2="${wx+ww}" y2="${my+mainH*r/wall.fullRows}"/>`);
      for(let c=1;c<d.lenCols600;c++) s.push(`<line class="gridline" x1="${wx+ww*c/d.lenCols600}" y1="${my}" x2="${wx+ww*c/d.lenCols600}" y2="${my+mainH}"/>`);
      s.push(`<text class="txt" x="${wx+ww-8}" y="${my+22}" text-anchor="end" font-weight="800">세로 600×1800 · ${d.lenCols600}열 × ${wall.fullRows}단 = ${wall.mainSheets}장</text>`);
    }
    if(bandH>0){
      const horiz=isHorizontalBand(wall.band);
      const bandCols=horiz?d.lenCols1800:d.lenCols600;
      s.push(`<rect class="band" x="${wx}" y="${by}" width="${ww}" height="${bandH}"/>`);
      s.push(`<line class="dash" x1="${wx}" y1="${by}" x2="${wx+ww}" y2="${by}" opacity=".8"/>`);
      for(let c=1;c<bandCols;c++){
        const panelEdge=!horiz&&wall.band.stripsPerSheet>1&&c%wall.band.stripsPerSheet===0; /* 굵은 선 = 보온재 1장 단위 */
        s.push(`<line x1="${wx+ww*c/bandCols}" y1="${by}" x2="${wx+ww*c/bandCols}" y2="${by+bandH}" stroke="#f97316" stroke-width="${panelEdge?1.8:1}" opacity="${panelEdge?.95:.4}"/>`);
      }
    }
    /* 밴드 라벨은 본판보다 나중에 그려 얇은 밴드에서도 가려지지 않게 함 */
    if(bandH>0){
      const b=wall.band, horiz=isHorizontalBand(b);
      const what=horiz?"가로로 눕혀 1800×600":`600폭 스트립(1장→${b.stripsPerSheet}줄)`;
      const cmp=b.chosen==="horizontal-same"?`스트립도 ${b.stripSheets}장 → 이음매 적은 가로 선택`
        :horiz?`스트립이면 ${b.stripSheets}장 → ${b.stripSheets-b.horizontalSheets}장 절약`
        :`가로면 ${b.horizontalSheets}장 → ${b.horizontalSheets-b.stripSheets}장 절약`;
      s.push(`<text class="txt" x="${wx+8}" y="${by+Math.max(15,bandH/2+4)}" font-weight="700">아래 잔여 ${fmt(wall.rem,1)}mm → ${what} ${b.chosenSheets}장 (${cmp})</text>`);
    }
    s.push(`<rect class="outline" x="${wx}" y="${y}" width="${ww}" height="${h}"/>`);
    s.push(`<line class="dim" x1="722" y1="${y}" x2="722" y2="${y+h}"/><text class="mut" x="730" y="${y+h/2}" text-anchor="middle" transform="rotate(-90 730 ${y+h/2})">${fmt(totalH,1)}mm</text>`);
  }
  summaryWall(f.highWall,`높은 벽`,505,145,f.foldToHigh);
  summaryWall(f.lowWall,`낮은 벽`,715,120,f.foldToLow);
  s.push(`<line class="dim" x1="60" y1="855" x2="710" y2="855"/><text class="mut" x="385" y="874" text-anchor="middle">벽체 길이 ${fmt(d.L,1)}mm</text>`);

  /* ③ 옆면 · 양끝 L자면 (높은 쪽 좌/우 도면대로) */
  const sx=755,sy=425,sw=390,sh=465;
  s.push(`<rect class="viewcard" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="14"/>`);
  s.push(`<text class="txt big" x="775" y="458">③ 옆면 · 양끝 L자면</text>`);
  s.push(`<rect class="badge" x="1000" y="439" width="118" height="28" rx="14"/><text class="badgeTxt" x="1059" y="458" text-anchor="middle">양끝 ${x.endSheets}장</text>`);
  const sc2=Math.min(300/d.totalW,250/d.highH);
  const tw2=d.totalW*sc2, hh2=d.highH*sc2;
  const ex=sx+(sw-tw2)/2, ey=510;
  const g=endFaceGeo(d,ex,ey,sc2);
  s.push(`<clipPath id="endClipS"><path d="${g.path}"/></clipPath>`);
  s.push(`<path d="${g.path}" fill="#ede9fe" stroke="#111" stroke-width="2"/>`);
  s.push(`<g clip-path="url(#endClipS)">`);
  for(let xx=600;xx<d.totalW;xx+=600) s.push(`<line x1="${ex+xx*sc2}" y1="${ey}" x2="${ex+xx*sc2}" y2="${ey+hh2}" stroke="#7c3aed" opacity=".55"/>`);
  /* 위에서부터 세로판, 자투리는 아래(바닥)쪽 — 구간별로 바닥 정렬 */
  const floorYS=ey+hh2;
  [[g.highX,g.hw,d.highH,"#7c3aed"],[g.lowX,g.lw,d.lowH,"#16a34a"]].forEach(seg=>{
    const [x0,w,hm,st]=seg, topY=floorYS-hm*sc2, rows=floor(hm/1800);
    for(let k=1;k<=rows;k++) s.push(`<line x1="${x0}" y1="${topY+k*1800*sc2}" x2="${x0+w}" y2="${topY+k*1800*sc2}" stroke="${st}" opacity=".55"/>`);
    const rem=hm-rows*1800;
    if(rem>1){const ty=topY+rows*1800*sc2;s.push(`<rect class="trim" x="${x0}" y="${ty}" width="${w}" height="${floorYS-ty}" opacity=".4"/>`);s.push(`<line class="dash" x1="${x0}" y1="${ty}" x2="${x0+w}" y2="${ty}" opacity=".8"/>`);}
  });
  s.push(`</g><path d="${g.path}" fill="none" stroke="#111" stroke-width="2"/>`);
  s.push(`<line x1="${g.boundaryX}" y1="${ey+g.st}" x2="${g.boundaryX}" y2="${ey+hh2}" stroke="#111" stroke-width="1.3" opacity=".65"/>`);
  const hAnchor=g.right?["end",ex+tw2-2]:["start",ex+2];
  const lAnchor=g.right?["start",ex+2]:["end",ex+tw2-2];
  s.push(`<text class="txt" x="${hAnchor[1]}" y="${ey-8}" text-anchor="${hAnchor[0]}" font-weight="800">높은 ${fmt(d.highW,1)}×${fmt(d.highH,0)}</text>`);
  s.push(`<text class="txt" x="${lAnchor[1]}" y="${ey+g.st-7}" text-anchor="${lAnchor[0]}" font-weight="800">낮은 ${fmt(d.lowW,1)}×${fmt(d.lowH,0)}</text>`);
  s.push(`<line class="dim" x1="${ex}" y1="${ey+hh2+18}" x2="${ex+tw2}" y2="${ey+hh2+18}"/><text class="mut" x="${ex+tw2/2}" y="${ey+hh2+34}" text-anchor="middle">전체 폭 ${fmt(d.totalW,1)}mm</text>`);
  s.push(`<text class="mut" x="775" y="${ey+hh2+56}">위에서부터 세로 600×1800 · 자투리(빨강)는 아래 바닥쪽 재단</text>`);
  s.push(`<text class="txt big" x="775" y="${ey+hh2+78}">${x.endPerFace}장/면 × 2면 = ${x.endSheets}장</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

function drawRoof(x){
  const d=x.d, f=x.chosenFold;
  setVisualHead("지붕",`1장은 길이방향 600mm, 지붕 전개방향 1800mm로 놓습니다. 남는 ${fmt(d.fold,1)}mm는 ${f.target==="low"?"낮은 벽":"높은 벽"}으로 접습니다.`);
  const W=1180,H=680, x0=90,y0=105,w=950,h=360;
  let s=[svgStart("윗면 · 지붕+단차 전개 배치", `${d.lenCols600}열(600폭) × ${d.roofRows}단(1800길이) = ${x.roofSheets}장`, W,H)];
  s.push(`<rect class="outer" x="${x0}" y="${y0}" width="${w}" height="${h}"/>`);
  for(let r=0;r<d.roofRows;r++){
    for(let c=0;c<d.lenCols600;c++){
      const cls=(c===d.lenCols600-1)?"trim":"tile";
      s.push(`<rect class="${cls}" x="${x0+w*c/d.lenCols600}" y="${y0+h*r/d.roofRows}" width="${w/d.lenCols600}" height="${h/d.roofRows}"/>`);
    }
  }
  const foldH=h*d.fold/(d.roofRows*TILE_L);
  const fy = f.target==="low" ? y0+h-foldH : y0;
  s.push(`<rect class="fold" x="${x0}" y="${fy}" width="${w}" height="${foldH}"/>`);
  s.push(`<line class="dash" x1="${x0}" y1="${f.target==="low"?fy:fy+foldH}" x2="${x0+w}" y2="${f.target==="low"?fy:fy+foldH}"/>`);
  s.push(`<text class="txt" x="${x0+10}" y="${fy+Math.max(24,foldH/2)}" font-weight="700">접힘 ${fmt(d.fold,1)}mm → ${f.target==="low"?"낮은 벽":"높은 벽"}</text>`);
  const actualTop=f.target==="high"?y0+foldH:y0, actualH=h-foldH;
  const highLine=actualTop+actualH*d.highW/d.drapeW;
  const stepLine=highLine+actualH*d.stepH/d.drapeW;
  s.push(`<line x1="${x0}" y1="${highLine}" x2="${x0+w}" y2="${highLine}" stroke="#111827" stroke-width="2"/>`);
  s.push(`<line x1="${x0}" y1="${stepLine}" x2="${x0+w}" y2="${stepLine}" stroke="#111827" stroke-width="2"/>`);
  s.push(`<text class="txt" x="${x0+12}" y="${actualTop+22}" font-weight="800">높은 지붕 ${fmt(d.highW,1)}mm</text>`);
  s.push(`<text class="txt" x="${x0+12}" y="${highLine+20}" font-weight="800">단차 수직면 ${fmt(d.stepH,1)}mm</text>`);
  s.push(`<text class="txt" x="${x0+12}" y="${stepLine+20}" font-weight="800">낮은 지붕 ${fmt(d.lowW,1)}mm</text>`);
  s.push(`<line class="dim" x1="${x0}" y1="${y0+h+24}" x2="${x0+w}" y2="${y0+h+24}"/><text class="mut" x="${x0+w/2}" y="${y0+h+41}" text-anchor="middle">전체 길이 ${fmt(d.L,1)}mm</text>`);
  s.push(`<line class="dim" x1="${x0+w+22}" y1="${actualTop}" x2="${x0+w+22}" y2="${actualTop+actualH}"/><text class="mut" x="${x0+w+39}" y="${actualTop+actualH/2}" text-anchor="middle" transform="rotate(-90 ${x0+w+39} ${actualTop+actualH/2})">지붕 전개폭 ${fmt(d.drapeW,1)}mm</text>`);
  s.push(`<text class="txt big" x="${x0}" y="${y0+h+58}">전개폭 ${fmt(d.drapeW,1)} → 1800×${d.roofRows} = ${fmt(d.roofRows*TILE_L,1)}mm</text>`);
  s.push(`<text class="mut" x="${x0}" y="${y0+h+88}">길이 ${fmt(d.L,1)} ÷ 600 = ${fmt(d.L/600,2)} → ${d.lenCols600}열, 마지막 사용 ${fmt(d.last600,1)}mm / 절단 자투리 ${fmt(d.trim600,1)}mm</text>`);
  s.push(`<rect class="tile" x="${x0}" y="${y0+h+112}" width="72" height="24"/><text class="txt" x="${x0+86}" y="${y0+h+129}" font-weight="800">파란 칸 1개 = 600(길이방향) × 1800(전개방향) = 보온재 1장</text>`);
  s.push(`<text class="mut" x="${x0+86}" y="${y0+h+149}">패널 장변 1800은 화면의 위↕아래 방향, 단변 600은 화면의 좌↔우 방향입니다.</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

function drawWalls(x){
  const d=x.d, f=x.chosenFold;
  setVisualHead("벽체","벽 패널은 위에서부터 세로 600×1800으로 붙이고, 남는 띠(주황)는 아래(바닥)쪽에 둡니다. 지붕이 ㄴ자로 접혀 내려오는 벽(초록 띠)은 그 접힘 아래 지점부터 벽 패널을 시작합니다. 남는 띠는 가로 눕힘 vs 스트립 재단 중 적은 쪽 자동 선택.");
  const W=1180,H=760;
  let s=[svgStart("정면 · 높은 벽 / 낮은 벽", `지붕 접힘(초록) → 세로 본판 → 아래 잔여 밴드 · 벽체 합계 ${f.wallSheets}장`, W,H)];
  function wallBlock(wall,label,y,foldAmount){
    const x0=90, width=950, height=180;
    const totalH=wall.height+foldAmount;
    const foldPx=totalH>0?height*foldAmount/totalH:0;
    const bodyPx=height-foldPx;                                 /* 벽 패널이 차지하는 높이(=처리높이) */
    const mainRatio=wall.height>0 ? (wall.fullRows*TILE_L)/wall.height : 0;
    const mainH=bodyPx*mainRatio, bandH=bodyPx-mainH, mainY=y+foldPx, bandY=y+foldPx+mainH; /* 위: 지붕 접힘 → 본판 → 아래: 남는 띠 */
    s.push(`<text class="txt" x="${x0}" y="${y-18}" font-weight="700">${esc(label)}${foldAmount?` · 전체 ${fmt(totalH,1)}mm (지붕 접힘 ${fmt(foldAmount,1)} + 벽 ${fmt(wall.height,1)})`:` · 높이 ${fmt(wall.height,1)}mm`} · ${wall.sheets}장</text>`);
    if(foldPx>0){
      s.push(`<rect class="fold" x="${x0}" y="${y}" width="${width}" height="${foldPx}"/>`);
      s.push(`<line class="dash" x1="${x0}" y1="${mainY}" x2="${x0+width}" y2="${mainY}" opacity=".85"/>`);
      s.push(`<text class="txt" x="${x0+10}" y="${y+Math.max(16,foldPx/2+4)}" font-weight="700">지붕이 ㄴ자로 접혀 내려온 ${fmt(foldAmount,1)}mm — 벽 패널은 이 아래부터 시작</text>`);
    }
    if(mainH>0){
      s.push(`<rect class="tile" x="${x0}" y="${mainY}" width="${width}" height="${mainH}"/>`);
      for(let r=1;r<wall.fullRows;r++){s.push(`<line class="gridline" x1="${x0}" y1="${mainY+mainH*r/wall.fullRows}" x2="${x0+width}" y2="${mainY+mainH*r/wall.fullRows}"/>`)}
      for(let c=1;c<d.lenCols600;c++){s.push(`<line class="gridline" x1="${x0+width*c/d.lenCols600}" y1="${mainY}" x2="${x0+width*c/d.lenCols600}" y2="${mainY+mainH}"/>`)}
      s.push(`<text class="txt" x="${x0+width-10}" y="${mainY+28}" text-anchor="end" font-weight="700">세로 600×1800 · ${d.lenCols600}열 × ${wall.fullRows}단 = ${wall.mainSheets}장</text>`);
    }
    if(bandH>0){
      const horiz=isHorizontalBand(wall.band);
      const bandCols=horiz?d.lenCols1800:d.lenCols600;
      s.push(`<rect class="band" x="${x0}" y="${bandY}" width="${width}" height="${bandH}"/>`);
      s.push(`<line class="dash" x1="${x0}" y1="${bandY}" x2="${x0+width}" y2="${bandY}" opacity=".8"/>`);
      for(let c=1;c<bandCols;c++){
        const panelEdge=!horiz&&wall.band.stripsPerSheet>1&&c%wall.band.stripsPerSheet===0; /* 굵은 선 = 보온재 1장 단위 */
        s.push(`<line x1="${x0+width*c/bandCols}" y1="${bandY}" x2="${x0+width*c/bandCols}" y2="${bandY+bandH}" stroke="#f97316" stroke-width="${panelEdge?2:1}" opacity="${panelEdge?.95:.4}"/>`);
      }
      if(horiz) for(let r=1;r<wall.band.horizontalRows;r++) s.push(`<line x1="${x0}" y1="${bandY+bandH*r/wall.band.horizontalRows}" x2="${x0+width}" y2="${bandY+bandH*r/wall.band.horizontalRows}" stroke="#f97316" opacity=".55"/>`);
    }
    /* 밴드 라벨은 본판보다 나중에 그려 얇은 밴드에서도 항상 보이게 함 */
    if(bandH>0){
      const bandLabel=isHorizontalBand(wall.band)
        ? `가로로 눕혀 1800×600 · ${d.lenCols1800}열 × ${wall.band.horizontalRows}단 = ${wall.band.chosenSheets}장`
        : `600폭 스트립 · 1장을 ${fmt(wall.rem,1)}mm 높이 ${wall.band.stripsPerSheet}줄로 재단 → ${d.lenCols600}줄 ÷ ${wall.band.stripsPerSheet} = ${wall.band.chosenSheets}장`;
      s.push(`<text class="txt" x="${x0+10}" y="${bandY+Math.max(18,bandH/2+5)}" font-weight="700">아래 잔여 ${fmt(wall.rem,1)}mm · ${bandLabel}</text>`);
    }
    s.push(`<rect class="outline" x="${x0}" y="${y}" width="${width}" height="${height}"/>`);
    s.push(`<line class="dim" x1="${x0}" y1="${y+height+12}" x2="${x0+width}" y2="${y+height+12}"/><text class="mut" x="${x0+width/2}" y="${y+height+29}" text-anchor="middle">벽체 길이 ${fmt(d.L,1)}mm</text>`);
    s.push(`<line class="dim" x1="${x0+width+22}" y1="${y}" x2="${x0+width+22}" y2="${y+height}"/><text class="mut" x="${x0+width+39}" y="${y+height/2}" text-anchor="middle" transform="rotate(-90 ${x0+width+39} ${y+height/2})">${foldAmount?`전체 ${fmt(totalH,1)}mm`:`높이 ${fmt(wall.height,1)}mm`}</text>`);
    s.push(`<text class="mut" x="${x0}" y="${y+height+48}">${foldAmount?`맨 위 초록 = 지붕에서 접혀 내려온 부분 · `:''}잔여 밴드 가로/세로 비교 — ${bandCompareLabel(wall.band)}</text>`);
  }
  wallBlock(f.highWall, `높은 벽`, 120, f.foldToHigh);
  wallBlock(f.lowWall, `낮은 벽`, 420, f.foldToLow);
  s.push(`<rect class="tile" x="90" y="680" width="30" height="60"/><text class="txt" x="128" y="700" font-weight="800">세로 배치 1장</text><text class="mut" x="128" y="718">폭 600 × 높이 1800</text>`);
  s.push(`<rect class="band" x="290" y="694" width="52" height="26"/><text class="txt" x="352" y="702" font-weight="800">가로 배치 1장</text><text class="mut" x="352" y="720">폭 1800 × 높이 600</text>`);
  s.push(`<rect class="fold" x="520" y="694" width="52" height="26"/><text class="txt" x="582" y="702" font-weight="800">지붕에서 접혀 내려온 부분</text><text class="mut" x="582" y="720">벽 패널은 이 아래부터 시작</text>`);
  s.push(`<rect class="band" x="820" y="694" width="70" height="26"/>`);
  for(const lx of [837.5,855,872.5]) s.push(`<line x1="${lx}" y1="694" x2="${lx}" y2="720" stroke="#f97316" stroke-width="${lx===855?2:1}" opacity="${lx===855?.95:.4}"/>`);
  s.push(`<text class="txt" x="900" y="702" font-weight="800">스트립 굵은 선</text><text class="mut" x="900" y="720">= 1장에서 자른 묶음 경계</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

function drawEnds(x){
  const d=x.d;
  setVisualHead("양끝면",`패널은 위(지붕선)에서부터 세로 600×1800으로 붙이고, 딱 안 떨어지는 자투리는 아래(바닥)쪽에 남겨 바닥선에서 재단합니다. 가로 배치·절단 잔재를 섞는 ${endMode==="min"?"최소 재단":"실무 여유"}안이며, 도면과 같은 방향(높은 쪽 ${d.highSide==="left"?"왼쪽":"오른쪽"})으로 표시합니다.`);
  const W=1180,H=700;
  let s=[svgStart("옆면 · 양끝 L자면", `혼합 재단 ${x.endPerFace}장/면 × 2면 = ${x.endSheets}장`, W,H)];
  const scale=Math.min(780/d.totalW,330/d.highH);
  const tw=d.totalW*scale, hh=d.highH*scale;
  const ex=(W-tw)/2, ey=110;
  const g=endFaceGeo(d,ex,ey,scale);
  const lowY=ey+g.st, lh=hh-g.st;

  s.push(`<clipPath id="endClipF"><path d="${g.path}"/></clipPath>`);
  s.push(`<rect class="violet" x="${g.highX}" y="${ey}" width="${g.hw}" height="${hh}" opacity=".55"/>`);
  s.push(`<rect class="fold" x="${g.lowX}" y="${lowY}" width="${g.lw}" height="${lh}" opacity=".55"/>`);
  s.push(`<g clip-path="url(#endClipF)">`);
  for(let xx=600;xx<d.totalW;xx+=600){
    s.push(`<line x1="${ex+xx*scale}" y1="${ey}" x2="${ex+xx*scale}" y2="${ey+hh}" stroke="#7c3aed" opacity=".5"/>`);
  }
  /* 위(지붕선)에서부터 1800 세로판을 놓고, 자투리(재단분)는 아래(바닥)쪽에 남긴다 */
  const floorY=ey+hh;
  function endColumn(x0,w,heightMM,stroke){
    const topY=floorY-heightMM*scale, rows=floor(heightMM/1800);
    for(let k=1;k<=rows;k++){const py=topY+k*1800*scale;s.push(`<line x1="${x0}" y1="${py}" x2="${x0+w}" y2="${py}" stroke="${stroke}" opacity=".5"/>`);}
    const rem=heightMM-rows*1800;
    if(rem>1){
      const ty=topY+rows*1800*scale;
      s.push(`<rect class="trim" x="${x0}" y="${ty}" width="${w}" height="${floorY-ty}" opacity=".4"/>`);
      s.push(`<line class="dash" x1="${x0}" y1="${ty}" x2="${x0+w}" y2="${ty}" opacity=".85"/>`);
      s.push(`<text class="mut" x="${x0+w/2}" y="${(ty+floorY)/2+4}" text-anchor="middle" fill="#b42318">자투리 ${fmt(rem,0)}mm</text>`);
    }
  }
  endColumn(g.highX,g.hw,d.highH,"#7c3aed");
  endColumn(g.lowX,g.lw,d.lowH,"#16a34a");
  s.push(`</g>`);
  s.push(`<path d="${g.path}" fill="none" stroke="#111" stroke-width="2"/>`);
  s.push(`<line x1="${g.boundaryX}" y1="${lowY}" x2="${g.boundaryX}" y2="${ey+hh}" stroke="#111" stroke-width="1.3" opacity=".65"/>`);

  const hAnchor=g.right?["end",ex+tw-2]:["start",ex+2];
  const lAnchor=g.right?["start",ex+2]:["end",ex+tw-2];
  s.push(`<text class="txt" x="${hAnchor[1]}" y="${ey-10}" text-anchor="${hAnchor[0]}" font-weight="800">높은 구간 ${fmt(d.highW,1)} × ${fmt(d.highH,0)}</text>`);
  s.push(`<text class="txt" x="${lAnchor[1]}" y="${lowY-8}" text-anchor="${lAnchor[0]}" font-weight="800">낮은 구간 ${fmt(d.lowW,1)} × ${fmt(d.lowH,0)}</text>`);

  s.push(`<line class="dim" x1="${ex}" y1="${ey+hh+20}" x2="${ex+tw}" y2="${ey+hh+20}"/><text class="mut" x="${ex+tw/2}" y="${ey+hh+37}" text-anchor="middle">전체 폭 ${fmt(d.totalW,1)}mm</text>`);
  const hDimX=g.right?ex+tw+20:ex-20, hTxtX=g.right?ex+tw+36:ex-36;
  const lDimX=g.right?ex-20:ex+tw+20, lTxtX=g.right?ex-36:ex+tw+36;
  s.push(`<line class="dim" x1="${hDimX}" y1="${ey}" x2="${hDimX}" y2="${ey+hh}"/><text class="mut" x="${hTxtX}" y="${ey+hh/2}" text-anchor="middle" transform="rotate(-90 ${hTxtX} ${ey+hh/2})">높은 벽 ${fmt(d.highH,1)}mm</text>`);
  s.push(`<line class="dim" x1="${lDimX}" y1="${lowY}" x2="${lDimX}" y2="${ey+hh}"/><text class="mut" x="${lTxtX}" y="${lowY+lh/2}" text-anchor="middle" transform="rotate(-90 ${lTxtX} ${lowY+lh/2})">낮은 벽 ${fmt(d.lowH,1)}mm</text>`);

  let capY=ey+hh+64;
  s.push(`<text class="txt big" x="90" y="${capY}">1면 면적 ${fmt(x.endAreaOne,2)}㎡ / 면적 하한 ${ceil(x.endAreaOne/TILE_AREA)}장 / 적용 ${x.endPerFace}장</text>`);
  capY+=24;
  s.push(`<rect class="violet" x="90" y="${capY}" width="24" height="56"/><text class="txt" x="126" y="${capY+18}" font-weight="800">세로 기본 격자</text><text class="mut" x="126" y="${capY+36}">600폭 × 1800높이</text>`);
  s.push(`<rect class="band" x="330" y="${capY+16}" width="56" height="24"/><text class="txt" x="398" y="${capY+18}" font-weight="800">가로·절단 잔재 혼합</text><text class="mut" x="398" y="${capY+36}">형상 끝부분을 채워 장수 절감</text>`);
  s.push(`<rect class="trim" x="670" y="${capY+16}" width="56" height="24" opacity=".7"/><text class="txt" x="738" y="${capY+18}" font-weight="800">하단 자투리(바닥 재단)</text><text class="mut" x="738" y="${capY+36}">위에서부터 붙이고 아래에서 잘림</text>`);
  capY+=80;
  wrapLines(d.endNote,66,3).forEach((ln,i)=>s.push(`<text class="mut" x="90" y="${capY+i*18}">${esc(ln)}</text>`));
  s.push(`</svg>`);
  setSvg(s);
}

function drawCompareVisual(x){
  const d=x.d, f=x.chosenFold;
  setVisualHead("비교","접힘 양안과 가로 고정·세로 고정·혼합 배치의 장수를 같은 축에서 비교합니다.");
  const W=1180,H=780;
  let s=[svgStart("접힘 방향 + 패널 방향 비교", `선택안: ${x.chosenFold.label} · 벽체 ${f.wallSheets}장`, W,H)];

  s.push(`<rect class="viewcard" x="45" y="78" width="1090" height="205" rx="14"/>`);
  s.push(`<text class="txt big" x="70" y="112">① 지붕 접힘 방향 비교</text>`);
  const foldMax=Math.max(x.lowFold.wallSheets,x.highFold.wallSheets),barX=265,barW=700;
  [["낮은 벽으로 접기",x.lowFold.wallSheets,"fold",x.chosenFold.target==="low"],["높은 벽으로 접기",x.highFold.wallSheets,"band",x.chosenFold.target==="high"]].forEach((it,i)=>{
    const yy=142+i*58,ww=barW*it[1]/foldMax;
    s.push(`<text class="txt" x="70" y="${yy+21}" font-weight="700">${it[0]}</text>`);
    s.push(`<rect class="${it[2]}" x="${barX}" y="${yy}" width="${ww}" height="32" rx="5"/>`);
    s.push(`<text class="txt" x="${barX+ww+10}" y="${yy+22}" font-weight="800">${it[1]}장${it[3]?" · 선택":""}</text>`);
  });
  const foldDiff=Math.abs(x.lowFold.wallSheets-x.highFold.wallSheets);
  s.push(`<text class="mut" x="70" y="265">${foldDiff?`${foldDiff}장 적은 안을 자동 선택합니다.`:"두 안이 동률이므로 수량상 우열이 없습니다. 화면은 낮은 벽 접기를 기준안으로 표시합니다."}</text>`);

  s.push(`<rect class="viewcard" x="45" y="305" width="1090" height="425" rx="14"/>`);
  s.push(`<text class="txt big" x="70" y="340">② 가로 고정 vs 세로 고정 vs 혼합</text>`);
  s.push(`<rect class="band" x="650" y="323" width="22" height="12"/><text class="mut" x="680" y="334">가로 고정</text>`);
  s.push(`<rect class="tile" x="770" y="323" width="22" height="12"/><text class="mut" x="800" y="334">세로 고정</text>`);
  s.push(`<rect class="fold" x="890" y="323" width="22" height="12"/><text class="mut" x="920" y="334">혼합/선택</text>`);
  const rows=[
    ["지붕",rectLayout(d.L,d.drapeW,"H").sheets,x.roofSheets,x.roofSheets],
    ["낮은 벽",rectLayout(d.L,f.lowWall.height,"H").sheets,rectLayout(d.L,f.lowWall.height,"V").sheets,f.lowWall.sheets],
    ["높은 벽",rectLayout(d.L,f.highWall.height,"H").sheets,rectLayout(d.L,f.highWall.height,"V").sheets,f.highWall.sheets]
  ];
  const maxSheets=Math.max(...rows.flatMap(r=>r.slice(1))),ox=185,ow=820;
  rows.forEach((r,i)=>{
    const y=378+i*105;
    s.push(`<text class="txt" x="70" y="${y+43}" font-weight="800">${r[0]}</text>`);
    [[r[1],"band","가로"],[r[2],"tile","세로"],[r[3],"fold","혼합"]].forEach((b,j)=>{
      const yy=y+j*27,w=ow*b[0]/maxSheets;
      s.push(`<rect class="${b[1]}" x="${ox}" y="${yy}" width="${w}" height="19" rx="3"/>`);
      s.push(`<text class="mut" x="${ox+w+7}" y="${yy+14}">${b[2]} ${b[0]}장</text>`);
    });
  });
  s.push(`<text class="txt" x="70" y="704" font-weight="800">혼합 배치는 본판을 세로 600×1800으로 세우고, 남은 높이만 스트립 또는 가로 밴드로 처리해 빈 폭을 줄입니다.</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

/* ═══════════════ 새 계산 기준: 긴 외피 전개 브리핑 ═══════════════ */
function shellSegmentsWithPos(sh){
  let at=0;
  return sh.segments.map(seg=>{
    const out={...seg, start:at, end:at+seg.size};
    at=out.end;
    return out;
  });
}

function drawShellBand(s,x,box){
  const d=x.d, sh=x.shell, {x0,y0,w,h}=box;
  const gap=box.gap ?? 34, runChrome=52, footer=58;
  const availableH=Math.max(80,h-gap-runChrome*2-footer);
  const scale=Math.min(w/d.L,availableH/(sh.highRun.width+sh.roofLowRun.width));
  const highBoxH=sh.highRun.width*scale+54;
  const lowBoxH=sh.roofLowRun.width*scale+54;
  drawRunBand(s,d,sh.highRun,{x0,y0,w,h:highBoxH},scale);
  drawRunBand(s,d,sh.roofLowRun,{x0,y0:y0+highBoxH+gap,w,h:lowBoxH},scale);
  s.push(`<text class="mut" x="${x0+w/2}" y="${y0+h-30}" text-anchor="middle">두 방향 모두 길이 ${fmt(d.L,1)}mm · 600폭 ${d.lenCols600}열 반복</text>`);
  s.push(`<text class="mut" x="${x0+w/2}" y="${y0+h-12}" text-anchor="middle">이 도면은 x/y 동일 스케일입니다. 본판 1칸은 실제 비율 600×1800(1:3)으로 표시됩니다.</text>`);
}

function drawRunBand(s,d,run,box,scale){
  const {x0,y0,w,h}=box;
  const drawW=d.L*scale;
  const drawH=run.width*scale;
  const sx=x0+(w-drawW)/2;
  const sy=y0;
  const mainH=run.fullRows*TILE_L*scale;
  const bandH=run.rem*scale;
  s.push(`<text class="txt" x="${x0}" y="${y0-10}" font-weight="800">${run.name} · ${fmt(run.width,1)}mm · ${run.sheets}장</text>`);
  s.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fff" stroke="#e5e7eb" stroke-width="1"/>`);
  s.push(`<rect class="outer" x="${sx}" y="${sy}" width="${drawW}" height="${drawH}"/>`);
  s.push(`<rect class="tile" x="${sx}" y="${sy}" width="${drawW}" height="${mainH}"/>`);
  for(let r=1;r<run.fullRows;r++){
    const yy=sy+r*TILE_L*scale;
    s.push(`<line class="gridline" x1="${sx}" y1="${yy}" x2="${sx+drawW}" y2="${yy}"/>`);
  }
  for(let c=1;c<d.lenCols600;c++){
    const xx=sx+c*TILE_S*scale;
    s.push(`<line class="gridline" x1="${xx}" y1="${sy}" x2="${xx}" y2="${sy+mainH}"/>`);
  }
  if(bandH>1){
    const bandY=sy+mainH, horiz=isHorizontalBand(run.band);
    const bandCols=horiz?d.lenCols1800:d.lenCols600;
    s.push(`<rect class="band" x="${sx}" y="${bandY}" width="${drawW}" height="${bandH}"/>`);
    s.push(`<line class="dash" x1="${sx}" y1="${bandY}" x2="${sx+drawW}" y2="${bandY}"/>`);
    for(let c=1;c<bandCols;c++){
      const panelEdge=!horiz&&run.band.stripsPerSheet>1&&c%run.band.stripsPerSheet===0;
      const xx=sx+c*(horiz?TILE_L:TILE_S)*scale;
      s.push(`<line x1="${xx}" y1="${bandY}" x2="${xx}" y2="${sy+drawH}" stroke="#f97316" stroke-width="${panelEdge?1.8:1}" opacity="${panelEdge?.95:.45}"/>`);
    }
    if(horiz){
      for(let r=1;r<run.band.horizontalRows;r++){
        const yy=bandY+r*TILE_S*scale;
        s.push(`<line x1="${sx}" y1="${yy}" x2="${sx+drawW}" y2="${yy}" stroke="#f97316" opacity=".55"/>`);
      }
    }
    s.push(`<text class="txt" x="${sx+8}" y="${bandY+Math.max(16,bandH/2+4)}" font-weight="800">잔여 ${fmt(run.rem,1)}mm · ${bandChoiceLabel(run.band)} ${run.band.chosenSheets}장</text>`);
  }
  shellSegmentsWithPos(run).forEach(seg=>{
    const yy=sy+seg.end*scale;
    if(seg.end<run.width) s.push(`<line x1="${sx}" y1="${yy}" x2="${sx+drawW}" y2="${yy}" stroke="#111827" stroke-width="2"/>`);
    const cy=sy+(seg.start+seg.size/2)*scale;
    s.push(`<text class="txt" x="${sx+drawW-8}" y="${cy+4}" text-anchor="end" font-weight="800">${seg.label}</text>`);
  });
  const sampleX=sx+10, sampleY=sy+drawH+18;
  s.push(`<rect class="tile" x="${sampleX}" y="${sampleY}" width="${TILE_S*scale}" height="${TILE_L*scale}"/>`);
  s.push(`<text class="mut" x="${sampleX+TILE_S*scale+8}" y="${sampleY+Math.min(18,TILE_L*scale/2)}">1칸 600×1800</text>`);
}

function drawEndBrief(s,x,box){
  const d=x.d, {x0,y0,w,h}=box;
  const sc=Math.min((w-60)/d.totalW,(h-80)/d.highH);
  const tw=d.totalW*sc, hh=d.highH*sc;
  const ex=x0+(w-tw)/2, ey=y0+22;
  const g=endFaceGeo(d,ex,ey,sc);
  s.push(`<path d="${g.path}" fill="#ede9fe" stroke="#111" stroke-width="2"/>`);
  s.push(`<line x1="${g.boundaryX}" y1="${ey+g.st}" x2="${g.boundaryX}" y2="${ey+hh}" stroke="#111" stroke-width="1.4" opacity=".7"/>`);
  for(let xx=600;xx<d.totalW;xx+=600) s.push(`<line x1="${ex+xx*sc}" y1="${ey}" x2="${ex+xx*sc}" y2="${ey+hh}" stroke="#7c3aed" opacity=".35"/>`);
  const floorY=ey+hh;
  [[g.highX,g.hw,d.highH],[g.lowX,g.lw,d.lowH]].forEach(seg=>{
    const [sx,sw,hm]=seg, topY=floorY-hm*sc, rows=floor(hm/TILE_L);
    for(let r=1;r<=rows;r++){
      const yy=topY+r*TILE_L*sc;
      s.push(`<line x1="${sx}" y1="${yy}" x2="${sx+sw}" y2="${yy}" stroke="#7c3aed" opacity=".35"/>`);
    }
  });
  s.push(`<text class="txt big" x="${x0+20}" y="${y0+h-42}">ㄴ자 1면 ${fmt(x.endAreaOne,2)}㎡ · 하한 ${ceil(x.endAreaOne/TILE_AREA)}장 · 적용 ${x.endPerFace}장</text>`);
  s.push(`<text class="mut" x="${x0+20}" y="${y0+h-20}">앞면/뒷면 2면 = ${x.endSheets}장 · ${endMode==="min"?"최소 재단":"실무 여유"} 기준</text>`);
}

function drawSummary(x){
  const d=x.d, sh=x.shell;
  setVisualHead("전체",`높은 벽 위 모서리에서 양방향으로 내려갑니다. 높은 벽 직하강 ${fmt(sh.highRun.width,1)}mm, 지붕·낮은 벽 하강 ${fmt(sh.roofLowRun.width,1)}mm.`);
  const W=1180,H=1280;
  let s=[svgStart(`${d.name} 보온재 덮기 브리핑`, `총 ${x.totalSheets}장 = 긴 외피 ${x.shellSheets} + 양끝 ${x.endSheets}`, W,H)];
  s.push(`<rect class="viewcard" x="35" y="75" width="1110" height="930" rx="14"/>`);
  s.push(`<text class="txt big" x="60" y="108">① 천장 전개도</text>`);
  s.push(`<text class="mut" x="245" y="107">높은 벽 위 기준: 한쪽은 높은 벽 바닥, 반대쪽은 지붕·단차·낮은 벽 바닥</text>`);
  s.push(`<rect class="badge" x="980" y="90" width="130" height="28" rx="14"/><text class="badgeTxt" x="1045" y="109" text-anchor="middle">외피 ${x.shellSheets}장</text>`);
  drawShellBand(s,x,{x0:60,y0:145,w:1060,h:800,gap:96});
  s.push(`<text class="txt" x="60" y="980" font-weight="800">본판 ${sh.mainSheets}장 · 잔여띠 ${sh.sheets-sh.mainSheets}장 · 외피 합계 ${sh.sheets}장</text>`);
  s.push(`<rect class="viewcard" x="35" y="1035" width="1110" height="190" rx="14"/>`);
  s.push(`<text class="txt big" x="60" y="1068">② 양끝 ㄴ자면 · 앞면/뒷면</text>`);
  drawEndBrief(s,x,{x0:650,y0:1054,w:450,h:140});
  s.push(`<text class="txt" x="60" y="1104" font-weight="800">이미지의 front view는 양끝 ㄴ자면입니다.</text>`);
  s.push(`<text class="mut" x="60" y="1130">앞면과 뒷면 2개 면을 더하며, 가로/세로 배치 대안은 ‘양끝 L자면’ 탭에서 비교합니다.</text>`);
  s.push(`<text class="txt big" x="60" y="1174">${x.endPerFace}장/면 × 2면 = ${x.endSheets}장</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

function drawRoof(x){
  const d=x.d, sh=x.shell;
  setVisualHead("천장 전개",`높은 벽 위에서 양방향으로 나눠 전개하고, 각 방향의 바닥 잔여띠를 따로 계산합니다.`);
  const W=1180,H=920;
  let s=[svgStart("천장 전개 배치", `${fmt(sh.width,1)}mm = ${sh.segments.map(v=>v.label).join(" + ")}`, W,H)];
  drawShellBand(s,x,{x0:60,y0:105,w:1060,h:650});
  s.push(`<rect class="tile" x="70" y="815" width="96" height="32"/><text class="txt" x="182" y="837" font-weight="800">본판 1칸 = 600(길이) × 1800(전개)</text>`);
  s.push(`<rect class="band" x="520" y="815" width="96" height="32"/><text class="txt" x="632" y="837" font-weight="800">바닥 잔여띠 = 각 방향별 최적 선택</text>`);
  s.push(`<text class="mut" x="70" y="882">바닥 쪽 트리밍/잔여 구간을 별도 밴드로 계산해, 가로 배치가 유리한 케이스는 가로로 길게 표현합니다.</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

function drawWalls(x){
  const d=x.d;
  setVisualHead("정면 ㄴ자",`앞면과 뒷면은 도면의 ㄴ자 그대로 채웁니다. 적용 수량은 ${x.endPerFace}장/면입니다.`);
  const W=1180,H=650;
  let s=[svgStart("정면 ㄴ자 면 채움", `${d.name} · 높은 쪽 ${d.highSide==="left"?"왼쪽":"오른쪽"} · ${x.endPerFace}장/면`, W,H)];
  drawEndBrief(s,x,{x0:100,y0:95,w:980,h:440});
  s.push(`<text class="txt" x="120" y="585" font-weight="800">최소 재단은 면적 하한에 가까운 빡빡한 패킹입니다. 실무 여유 기준은 상단 토글에서 확인합니다.</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

function drawCompareVisual(x){
  const d=x.d, legacy=x.legacyLongSheets+x.endSheets;
  setVisualHead("비교",`새 기준은 긴 외피 전개식입니다. 이전 지붕/벽 분리식은 참고용으로 함께 표시합니다.`);
  const W=1180,H=560;
  let s=[svgStart("계산 기준 비교", `현재 ${x.totalSheets}장 · 이전 분리식 ${legacy}장`, W,H)];
  const rows=[
    ["긴 외피 전개식",x.totalSheets,"fold",`외피 ${x.shellSheets} + 양끝 ${x.endSheets}`],
    ["이전 지붕/벽 분리식",legacy,"tile",`지붕 ${x.roofSheets} + 벽 ${x.chosenFold.wallSheets} + 양끝 ${x.endSheets}`],
    ["양끝 제외 외피만",x.shellSheets,"band",`본판 ${x.shell.mainSheets} + 잔여띠 ${x.shell.sheets-x.shell.mainSheets}`]
  ];
  const max=Math.max(...rows.map(r=>r[1]));
  rows.forEach((r,i)=>{
    const y=130+i*95, w=780*r[1]/max;
    s.push(`<text class="txt" x="85" y="${y+23}" font-weight="800">${r[0]}</text>`);
    s.push(`<rect class="${r[2]}" x="320" y="${y}" width="${w}" height="34" rx="5"/>`);
    s.push(`<text class="txt" x="${330+w}" y="${y+23}" font-weight="800">${r[1]}장</text>`);
    s.push(`<text class="mut" x="320" y="${y+58}">${r[3]}</text>`);
  });
  s.push(`<text class="txt" x="85" y="465" font-weight="800">정면 ㄴ자면은 현재 ${x.endPerFace}장/면, 2면 ${x.endSheets}장을 더합니다.</text>`);
  s.push(`</svg>`);
  setSvg(s);
}

/* (기존의 사선 투영 3D 보조도는 05-visual3d.js 의 캔버스 입체 뷰로 대체됨) */

function drawEndHorizontalOption(s,x,box,scale){
  const d=x.d, bridge=x.endHorizontal, {x0,y0,w,h}=box;
  const tw=d.totalW*scale, hh=d.highH*scale;
  const ex=x0+(w-tw)/2, ey=y0+86;
  const g=endFaceGeo(d,ex,ey,scale);
  const clipId=`endH${d.id}`;
  const floorY=ey+hh, lowTop=floorY-d.lowH*scale;
  s.push(`<text class="txt big" x="${x0+18}" y="${y0+30}">가로로 쭉 잇기</text>`);
  s.push(`<text class="mut" x="${x0+18}" y="${y0+52}">낮은 높이까지 전체 폭을 가로 밴드로 지나가고, 높은 쪽 상부만 추가</text>`);
  s.push(`<clipPath id="${clipId}"><path d="${g.path}"/></clipPath>`);
  s.push(`<path d="${g.path}" fill="#fff" stroke="#111827" stroke-width="2"/>`);
  s.push(`<g clip-path="url(#${clipId})">`);
  for(let r=0;r<bridge.fullWidthRows;r++){
    const yy=floorY-(r+1)*TILE_S*scale;
    s.push(`<rect class="band" x="${ex}" y="${yy}" width="${tw}" height="${TILE_S*scale}" opacity=".74"/>`);
  }
  for(let c=1;c<bridge.fullWidthCols;c++){
    const xx=ex+c*TILE_L*scale;
    s.push(`<line x1="${xx}" y1="${lowTop}" x2="${xx}" y2="${floorY}" stroke="#f97316" opacity=".72"/>`);
  }
  for(let r=0;r<bridge.highOnlyRows;r++){
    const yy=lowTop-(r+1)*TILE_S*scale;
    s.push(`<rect class="tile" x="${g.highX}" y="${yy}" width="${g.hw}" height="${TILE_S*scale}" opacity=".70"/>`);
  }
  for(let c=1;c<bridge.highOnlyCols;c++){
    const xx=g.highX+c*TILE_L*scale;
    s.push(`<line x1="${xx}" y1="${ey}" x2="${xx}" y2="${lowTop}" stroke="#2563eb" opacity=".66"/>`);
  }
  s.push(`</g><path d="${g.path}" fill="none" stroke="#111827" stroke-width="2"/>`);
  s.push(`<line x1="${g.boundaryX}" y1="${ey+g.st}" x2="${g.boundaryX}" y2="${ey+hh}" stroke="#111827" stroke-width="1.4" opacity=".7"/>`);
  s.push(`<line class="dim" x1="${ex}" y1="${ey+hh+22}" x2="${ex+tw}" y2="${ey+hh+22}"/><text class="mut" x="${ex+tw/2}" y="${ey+hh+40}" text-anchor="middle">전체 폭 ${fmt(d.totalW,1)}mm</text>`);
  s.push(`<text class="txt" x="${x0+18}" y="${y0+h-78}" font-weight="800">${bridge.perFace}장/면 · 2면 ${bridge.sheets}장</text>`);
  s.push(`<text class="mut" x="${x0+18}" y="${y0+h-54}">하부 전체폭 ${bridge.fullWidthRows}단 × ${bridge.fullWidthCols}열 = ${bridge.fullWidthSheets}장/면</text>`);
  s.push(`<text class="mut" x="${x0+18}" y="${y0+h-34}">높은 쪽 상부 ${bridge.highOnlyRows}단 × ${bridge.highOnlyCols}열 = ${bridge.highOnlySheets}장/면</text>`);
}

function drawEndVerticalOption(s,x,box,scale){
  const d=x.d, plan=x.endVertical, {x0,y0,w,h}=box;
  const tw=d.totalW*scale, hh=d.highH*scale;
  const ex=x0+(w-tw)/2, ey=y0+86;
  const g=endFaceGeo(d,ex,ey,scale);
  const clipId=`endV${d.id}`;
  const floorY=ey+hh;
  s.push(`<text class="txt big" x="${x0+18}" y="${y0+30}">세로로 나눠 붙이기</text>`);
  s.push(`<text class="mut" x="${x0+18}" y="${y0+52}">높은 직사각형과 낮은 직사각형을 각각 600×1800 세로판으로 채움</text>`);
  s.push(`<clipPath id="${clipId}"><path d="${g.path}"/></clipPath>`);
  s.push(`<path d="${g.path}" fill="#fff" stroke="#111827" stroke-width="2"/>`);
  s.push(`<g clip-path="url(#${clipId})">`);
  const segments=[
    {x:g.highX,w:g.hw,h:d.highH,cols:plan.high.cols,rows:plan.high.rows,stroke:"#2563eb",fill:"tile"},
    {x:g.lowX,w:g.lw,h:d.lowH,cols:plan.low.cols,rows:plan.low.rows,stroke:"#f97316",fill:"band"}
  ];
  segments.forEach(seg=>{
    const top=floorY-seg.h*scale;
    s.push(`<rect class="${seg.fill}" x="${seg.x}" y="${top}" width="${seg.w}" height="${seg.h*scale}" opacity=".68"/>`);
    for(let c=1;c<seg.cols;c++){
      const xx=seg.x+c*TILE_S*scale;
      s.push(`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${floorY}" stroke="${seg.stroke}" opacity=".70"/>`);
    }
    for(let r=1;r<seg.rows;r++){
      const yy=top+r*TILE_L*scale;
      s.push(`<line x1="${seg.x}" y1="${yy}" x2="${seg.x+seg.w}" y2="${yy}" stroke="${seg.stroke}" opacity=".70"/>`);
    }
  });
  s.push(`</g><path d="${g.path}" fill="none" stroke="#111827" stroke-width="2"/>`);
  s.push(`<line x1="${g.boundaryX}" y1="${ey+g.st}" x2="${g.boundaryX}" y2="${ey+hh}" stroke="#111827" stroke-width="1.4" opacity=".7"/>`);
  s.push(`<line class="dim" x1="${ex}" y1="${ey+hh+22}" x2="${ex+tw}" y2="${ey+hh+22}"/><text class="mut" x="${ex+tw/2}" y="${ey+hh+40}" text-anchor="middle">전체 폭 ${fmt(d.totalW,1)}mm</text>`);
  s.push(`<text class="txt" x="${x0+18}" y="${y0+h-78}" font-weight="800">${plan.perFace}장/면 · 2면 ${plan.sheets}장</text>`);
  s.push(`<text class="mut" x="${x0+18}" y="${y0+h-54}">높은 구간 ${plan.high.cols}열 × ${plan.high.rows}단 = ${plan.high.sheets}장/면</text>`);
  s.push(`<text class="mut" x="${x0+18}" y="${y0+h-34}">낮은 구간 ${plan.low.cols}열 × ${plan.low.rows}단 = ${plan.low.sheets}장/면</text>`);
}

function drawEnds(x){
  const d=x.d, h=x.endHorizontal, v=x.endVertical;
  setVisualHead("양끝 L자면",`이미지의 front view에 해당하는 끝 단면입니다. 가로 브리지와 세로 분할을 같은 스케일로 비교합니다.`);
  const W=1180,H=760;
  let s=[svgStart("양끝 L자면 · 가로/세로 배치 비교", `현재 적용 ${x.endPerFace}장/면 · 가로 ${h.perFace}장/면 · 세로 ${v.perFace}장/면`, W,H)];
  s.push(`<rect class="viewcard" x="35" y="75" width="535" height="590" rx="14"/>`);
  s.push(`<rect class="viewcard" x="610" y="75" width="535" height="590" rx="14"/>`);
  const scale=Math.min(410/d.totalW,300/d.highH);
  drawEndHorizontalOption(s,x,{x0:55,y0:92,w:495,h:545},scale);
  drawEndVerticalOption(s,x,{x0:630,y0:92,w:495,h:545},scale);
  const best=Math.min(h.perFace,v.perFace,x.endPerFace);
  s.push(`<rect class="badge" x="55" y="690" width="1070" height="34" rx="17"/>`);
  s.push(`<text class="badgeTxt" x="590" y="712" text-anchor="middle">현재 하드코딩 적용 ${x.endPerFace}장/면 · 가로 ${h.perFace}장/면 · 세로 ${v.perFace}장/면 · 수량 최소 ${best}장/면</text>`);
  s.push(`</svg>`);
  setSvg(s);
}
