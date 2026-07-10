/* ══════════════════════════════════════════════════════════════
   상수 · 케이스 데이터 · 화면 상태 · 공통 유틸.
   가장 먼저 로드됩니다. 케이스 치수·양끝면 장수는 이 파일의 CASES 배열에서 수정하세요.
   ══════════════════════════════════════════════════════════════ */

/* ═══════════════ 고정값 · 케이스 데이터 ═══════════════ */
const TILE_L = 1800;
const TILE_S = 600;
const TILE_AREA = 1.08;
const BUFFER_OPTIONS = [0, 3, 5, 7, 10];
const QUICK_BUFFER_OPTIONS = [3, 5, 7, 10];

const CASES = [
  {
    id:"caseA",
    name:"케이스 A",
    subtitle:"폭 7,053 × 길이 26,327.3",
    L:26327.3, totalW:7053, highW:5078.6, highH:4170, lowH:2766,
    highSide:"left",
    endMinPerFace:26, endPracticalPerFace:26,
    endNote:"기존 검토안 기준 26장/면을 최소 실무안으로 둡니다."
  },
  {
    id:"caseB",
    name:"케이스 B",
    subtitle:"폭 4,572 × 길이 26,370.4",
    L:26370.4, totalW:4572, highW:1836, highH:5749, lowH:3820,
    highSide:"right",
    endMinPerFace:20, endPracticalPerFace:21,
    endNote:"면적 하한은 20장/면이며, 하부 17장 + 상부 주면 3장 + 잔여 활용으로 가능한 빡빡한 재단안입니다. 실무 여유는 21장/면입니다."
  },
  {
    id:"caseC",
    name:"케이스 C",
    subtitle:"폭 3,274.2 × 길이 26,316.8",
    L:26316.8, totalW:3274.2, highW:1660, highH:5749, lowH:2020,
    highSide:"right",
    endMinPerFace:12, endPracticalPerFace:13,
    endNote:"면적 하한은 12장/면입니다. 높은 구간 1660×5749에서 460폭 절단 후 남는 140폭 스트립과 낮은 구간의 185.8폭 잔재를 밴드에 활용하는 빡빡한 재단안입니다. 실무 여유는 13장/면입니다."
  }
];

/* 구역 색상 — 요약 막대·구역 카드 공용 (검증된 순서 고정) */
const ZONES = {
  shell:{name:"긴 외피", color:"var(--z-roof)", ink:"#fff"},
  roof:{name:"지붕",  color:"var(--z-roof)", ink:"#fff"},
  low:{name:"낮은 벽", color:"var(--z-low)",  ink:"#06281a"},
  high:{name:"높은 벽",color:"var(--z-high)", ink:"#3b2a00"},
  ends:{name:"양끝면", color:"var(--z-ends)", ink:"#fff"}
};

let selectedCaseId = "caseA";
let endMode = "min";
let view = "walls";   /* 기본 탭: 3D 덮기 */
let buffer = 5;

/* ═══════════════ 유틸 ═══════════════ */
function fmt(x,d=0){return Number(x).toLocaleString("ko-KR",{minimumFractionDigits:d,maximumFractionDigits:d});}
function ceil(x){return Math.ceil(x-1e-9)}
function floor(x){return Math.floor(x+1e-9)}
function esc(s){return String(s).replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));}
function byId(id){return document.getElementById(id);}
function setText(id,value){byId(id).textContent=value;}
function setHTML(id,value){byId(id).innerHTML=value;}
function qsa(selector,root=document){return [...root.querySelectorAll(selector)];}
function currentCase(){return CASES.find(c=>c.id===selectedCaseId);}
function sqm(mm2){return mm2/1e6;}
function panelArea(sheets){return sheets*TILE_AREA;}
function orderSheets(sheets,pct=buffer){return ceil(sheets*(1+pct/100));}
function foldTargetName(target){return target==="low"?"낮은 벽":"높은 벽";}
function highSideName(side){return side==="left"?"정면 왼쪽":"정면 오른쪽";}
function isHorizontalBand(b){return b.chosen.startsWith("horizontal");}
function wrapLines(t,n=64,max=3){
  const words=String(t).split(" ");const out=[];let cur="";
  for(const w of words){
    if((cur+" "+w).trim().length>n&&cur){out.push(cur);cur=w}else cur=(cur?cur+" ":"")+w;
  }
  if(cur)out.push(cur);
  if(out.length>max){out.length=max;out[max-1]=out[max-1].slice(0,n-1)+"…"}
  return out;
}
