/* ══════════════════════════════════════════════════════════════
   렌더 파이프라인 + 이벤트 바인딩 + 초기 실행.
   앞의 다섯 파일(01~05)이 모두 로드된 뒤 마지막에 로드됩니다.
   ══════════════════════════════════════════════════════════════ */

/* ═══════════════ 렌더 파이프라인 ═══════════════ */
function render(){
  const x=calc(currentCase());
  renderAllCases();
  renderHero(x);
  renderSteps(x);
  renderZones(x);
  renderOrientationComparison(x);
  renderScenarioTable();
  renderAudit(x);
  draw(x);
}

/* ═══════════════ 이벤트 바인딩 ═══════════════ */
function setActiveButtons(selector,predicate){
  qsa(selector).forEach(b=>b.classList.toggle("active",predicate(b)));
}

function buildBufferSeg(){
  const seg=byId("bufferSeg");
  seg.innerHTML="";
  BUFFER_OPTIONS.forEach(p=>{
    const b=document.createElement("button");
    b.textContent=p+"%";
    b.dataset.b=p;
    b.className=p===buffer?"active":"";
    b.addEventListener("click",()=>{
      buffer=p;
      setActiveButtons("#bufferSeg button",x=>Number(x.dataset.b)===buffer);
      render();
    });
    seg.appendChild(b);
  });
}

qsa("#viewTabs .tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    view=btn.dataset.view;
    setActiveButtons("#viewTabs .tab",b=>b.dataset.view===view);
    draw(calc(currentCase()));
  });
});

/* 스크롤 스파이 */
const spy=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      qsa("#jumpNav a").forEach(a=>
        a.classList.toggle("active",a.getAttribute("href")==="#"+e.target.id));
    }
  });
},{rootMargin:"-120px 0px -55% 0px",threshold:0});
qsa("main section[id]").forEach(sec=>spy.observe(sec));

/* ═══════════════ 초기화 ═══════════════ */
buildCaseCards();
buildBufferSeg();
render();
