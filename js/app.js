(function appModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const $=FZ.u.$;

  function removeErrorBox(){
    const el=$("source-error");
    if(el) el.remove();
  }

  function showError(message){
    removeErrorBox();
    document.querySelector("main")?.insertAdjacentHTML("afterbegin",'<div id="source-error" class="error-box"><strong>No fue posible cargar Base General.</strong><br>'+FZ.u.escapeHtml(message)+'</div>');
  }

  function updateSectionVisibility(){
    const inGeneral=state.analysisView==="general";
    const compareCuts=state.filters.period.size===2;
    $("evolution-section")?.classList.toggle("hidden",!inGeneral||!compareCuts);

    const hideRankings=FZ.filters.isSingleOperatorSingleCity();
    ["operator-price-panel","operator-speed-panel"].forEach(id=>$(id)?.classList.toggle("hidden",!inGeneral||hideRankings));

    document.querySelector(".filters")?.classList.toggle("hidden",state.analysisView==="compare"||state.analysisView==="mobile");

    if(state.analysisView==="territory"){
      $("coverage-ranking-panel")?.classList.toggle("hidden",FZ.filters.effectiveCityCount()<=1);
    }
  }

  function renderAll(){
    updateSectionVisibility();
    if(state.analysisView==="general"){
      FZ.charts?.renderKPIs?.();
      FZ.charts?.renderEvolution?.();
      FZ.charts?.renderCharts?.();
      FZ.table?.render?.();
      return;
    }
    if(state.analysisView==="territory"){FZ.territory?.renderCoverage?.();return;}
    if(state.analysisView==="network"){FZ.territory?.renderFibrazo?.();return;}
    if(state.analysisView==="fibrazo"){FZ.comparison?.renderFibrazoComparison?.();return;}
    if(state.analysisView==="compare"){FZ.comparison?.renderComparator?.();return;}
    if(state.analysisView==="mobile"){FZ.mobile?.render?.();}
  }

  function clearTransientPanels(){
    FZ.details?.clear?.();
    state.openTrunkKey="";
    document.querySelectorAll(".scatter-interactive-tooltip").forEach(el=>el.remove());
    document.querySelectorAll(".operator-chooser-instance").forEach(el=>el.remove());
    FZ.mobile?.clearTransient?.();
  }

  function setAnalysisView(view){
    const changing=state.analysisView!==view;
    if(changing) clearTransientPanels();

    state.analysisView=view;
    document.querySelectorAll(".analysis-tab").forEach(b=>b.classList.toggle("active",b.dataset.analysisView===view));
    document.querySelectorAll(".view-block").forEach(el=>el.classList.toggle("hidden",el.dataset.view!==view));
    updateSectionVisibility();

    if(view==="general"){
      FZ.charts?.renderCharts?.();
      FZ.table?.render?.();
    }
    if(view==="territory") FZ.territory?.renderCoverage?.();
    if(view==="network") FZ.territory?.renderFibrazo?.();
    if(view==="fibrazo") FZ.comparison?.renderFibrazoComparison?.();
    if(view==="compare") FZ.comparison?.renderComparator?.();
    if(view==="mobile") FZ.mobile?.render?.();
  }

  async function load({silent=false}={}){
    if(state.loading) return;
    state.loading=true;
    if(!silent&&$("refresh-btn")){
      $("refresh-btn").disabled=true;
      $("refresh-btn").textContent="Actualizando…";
    }
    try{
      await FZ.data.load({mode:silent?"dynamic":"full"});
      FZ.filters.ensurePeriodSelection();
      state.lastLoadAt=Date.now();
      if($("last-load")) $("last-load").textContent=new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short"}).format(new Date());
      removeErrorBox();
      FZ.filters.renderCityQuickbar();
      FZ.filters.renderFilters();
      FZ.filters.apply();
    }catch(error){
      console.error(error);
      showError(error.message||String(error));
    }finally{
      state.loading=false;
      if($("refresh-btn")){
        $("refresh-btn").disabled=false;
        $("refresh-btn").textContent="Actualizar";
      }
    }
  }

  function compareWithFibrazo(operator,city){
    if(!operator||!city) return;
    state.cityScopeMode="custom";
    state.filters.city.clear();
    state.filters.city.add(city);
    state.filters.operator.clear();
    state.filters.operator.add(operator);
    state.filters.zone.clear();
    state.filters.trunk.clear();
    state.expanded=false;
    FZ.filters.renderCityQuickbar();
    FZ.filters.renderFilters();
    FZ.filters.apply();
    setAnalysisView("fibrazo");
    document.querySelector('[data-analysis-view="fibrazo"]')?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function resetAll(){
    FZ.details?.clear?.();
    Object.values(state.filters).forEach(s=>s.clear());
    state.cityScopeMode="fibrazo";
    FZ.filters.ensurePeriodSelection();
    state.tableSearch="";
    if($("table-search")) $("table-search").value="";
    state.expanded=false;
    state.sort={key:"Grupo_Operador",dir:1};
    state.comparison={level:"city",periods:new Set(["2026-09"]),items:new Set(),cityFilter:"all",search:""};
    state.mobileView={period:"2026-09",operator:"all",modality:"all",status:"all",search:"",sort:{key:"Operador",dir:1},openKey:""};
    FZ.filters.renderCityQuickbar();
    FZ.filters.renderFilters();
    FZ.filters.apply();
  }

  function clearFilters(){
    FZ.details?.clear?.();
    Object.entries(state.filters).forEach(([key,set])=>{if(key!=="period")set.clear();});
    state.cityScopeMode="fibrazo";
    state.expanded=false;
    FZ.filters.renderCityQuickbar();
    FZ.filters.renderFilters();
    FZ.filters.apply();
  }

  function bindEvents(){
    document.querySelectorAll(".analysis-tab").forEach(b=>b.addEventListener("click",()=>setAnalysisView(b.dataset.analysisView)));

    $("fibrazo-offer-select")?.addEventListener("change",e=>{
      state.selectedOfferKey=e.target.value;
      FZ.comparison.renderFibrazoComparison();
      FZ.comparison.renderComparator();
    });

    $("refresh-btn")?.addEventListener("click",()=>load());
    $("reset-btn")?.addEventListener("click",resetAll);
    $("clear-btn")?.addEventListener("click",clearFilters);

    $("table-search")?.addEventListener("input",e=>{
      state.tableSearch=e.target.value;
      FZ.table.render();
    });

    $("more-btn")?.addEventListener("click",()=>{
      state.expanded=!state.expanded;
      FZ.table.render();
      if(!state.expanded&&$("table-scroll")) $("table-scroll").scrollTop=0;
    });

    $("columns-btn")?.addEventListener("click",e=>{
      e.stopPropagation();
      FZ.table.renderColumns();
      $("columns-menu")?.classList.toggle("hidden");
    });

    $("columns-menu")?.addEventListener("click",e=>e.stopPropagation());

    document.addEventListener("click",()=>{
      document.querySelectorAll(".filter-menu,.city-more-menu").forEach(m=>m.classList.add("hidden"));
      $("columns-menu")?.classList.add("hidden");
    });

    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden&&Date.now()-state.lastLoadAt>FZ.AUTO_REFRESH_MS) load({silent:true});
    });
    window.setInterval(()=>{if(!document.hidden)load({silent:true});},FZ.AUTO_REFRESH_MS);
  }

  function init(){
    if(document.documentElement.dataset.fzAppBound==="1") return;
    document.documentElement.dataset.fzAppBound="1";
    FZ.details?.init?.();
    bindEvents();
    setAnalysisView("general");
    load();
  }

  FZ.app={renderAll,setAnalysisView,load,compareWithFibrazo,updateSectionVisibility,renderCityQuickbar:FZ.filters.renderCityQuickbar,init};
  init();
})();
