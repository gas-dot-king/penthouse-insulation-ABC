/* ══════════════════════════════════════════════════════════════
   상수 · 케이스 데이터 · 화면 상태 · 공통 유틸.
   가장 먼저 로드됩니다. 케이스 치수·단면 구간·양끝면 장수는 이 파일의 CASES 배열에서 수정하세요.
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
    L:26327.3,
    shape:{
      schemaVersion:1, type:"stepped-profile", startSide:"left",
      startRunLabel:"높은 벽 직하강", profileRunLabel:"지붕→낮은 벽",
      sections:[
        {id:"high",label:"높은 구간",roofLabel:"높은 지붕",wallLabel:"높은 벽",width:5078.6,height:4170},
        {id:"low",label:"낮은 구간",roofLabel:"낮은 지붕",wallLabel:"낮은 벽",width:1974.4,height:2766}
      ]
    },
    reviewedEnd:{geometrySignature:"5078.6x4170|1974.4x2766",minPerFace:26,practicalPerFace:26,
      note:"기존 검토안 기준 26장/면을 최소 실무안으로 둡니다."}
  },
  {
    id:"caseB",
    name:"케이스 B",
    L:26370.4,
    shape:{
      schemaVersion:1, type:"stepped-profile", startSide:"right",
      startRunLabel:"높은 벽 직하강", profileRunLabel:"지붕→낮은 벽",
      sections:[
        {id:"high",label:"높은 구간",roofLabel:"높은 지붕",wallLabel:"높은 벽",width:1836,height:5749},
        {id:"low",label:"낮은 구간",roofLabel:"낮은 지붕",wallLabel:"낮은 벽",width:2736,height:3820}
      ]
    },
    reviewedEnd:{geometrySignature:"1836x5749|2736x3820",minPerFace:20,practicalPerFace:21,
      note:"면적 하한은 20장/면이며, 하부 17장 + 상부 주면 3장 + 잔여 활용으로 가능한 빡빡한 재단안입니다. 실무 여유는 21장/면입니다."}
  },
  {
    id:"caseC",
    name:"케이스 C",
    L:26316.8,
    shape:{
      schemaVersion:1, type:"stepped-profile", startSide:"right",
      startRunLabel:"높은 벽 직하강", profileRunLabel:"지붕→낮은 벽",
      sections:[
        {id:"high",label:"높은 구간",roofLabel:"높은 지붕",wallLabel:"높은 벽",width:1660,height:5749},
        {id:"low",label:"낮은 구간",roofLabel:"낮은 지붕",wallLabel:"낮은 벽",width:1614.2,height:2020}
      ]
    },
    reviewedEnd:{geometrySignature:"1660x5749|1614.2x2020",minPerFace:12,practicalPerFace:13,
      note:"면적 하한은 12장/면입니다. 높은 구간 1660×5749에서 460폭 절단 후 남는 140폭 스트립과 낮은 구간의 185.8폭 잔재를 밴드에 활용하는 빡빡한 재단안입니다. 실무 여유는 13장/면입니다."}
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

let selectedCaseId = CASES[0]?.id || "";
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
function currentCase(){return CASES.find(c=>c.id===selectedCaseId)||CASES[0];}
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
