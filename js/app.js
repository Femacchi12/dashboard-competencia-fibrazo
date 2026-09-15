(function appModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const $=FZ.u.$;
  const {clean,fold,toNum,formatCOP,formatNum,rowOperator,escapeHtml}=FZ.u;

  function isSubsidizedPlan(row){
    const text=fold([
      row?.Modalidad,row?.Tipo_Servicio,row?.Nombre_Plan,row?.Observaciones,row?.Estado_Presencia
    ].filter(Boolean).join(" "));
    return text.includes("subsid");
  }

  function prepareMarketSemantics(){
    state.plans.forEach(row=>{
      if(!isSubsidizedPlan(row)||row._benchmarkExcluded==="subsidy") return;
      row._benchmarkExcluded="subsidy";
      row._Original_Precio_Usado_COP=row.Precio_Usado_COP;
      row._Original_Velocidad_Bajada_Mbps=row.Velocidad_Bajada_Mbps;
      row.Precio_Usado_COP="";
      row.Velocidad_Bajada_Mbps="";
    });
  }

  function subsidyRows(rows=state.plans){
    return rows.filter(r=>r?._benchmarkExcluded==="subsidy"||isSubsidizedPlan(r));
  }

  function presenceStatus(rows){
    const texts=rows.map(r=>fold([
      r?.Estado_Confirmacion,r?.Estado_Presencia,r?.Tipo_Cobertura,r?.Fuente_Confirmacion
    ].filter(Boolean).join(" ")));
    if(texts.some(t=>t.includes("observado")||t.includes("confirmad"))) return "Confirmado";
    if(texts.some(t=>t.includes("declarado"))) return "Declarado";
    if(texts.some(t=>t.includes("por validar"))) return "Por validar";
    return "Registrado";
  }

  function presenceTone(status){
    if(status==="Confirmado") return "confirmed";
    if(status==="Declarado") return "declared";
    if(status==="Por validar") return "pending";
    return "registered";
  }

  function ensureMarketSemanticsStyles(){
    if(document.getElementById("market-semantics-styles")) return;
    const style=document.createElement("style");
    style.id="market-semantics-styles";
    style.textContent=`
      .market-scope-summary{margin-top:14px;padding:18px 20px;display:grid;gap:15px;}
      .market-scope-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;}
      .market-scope-head span{font-size:11px;letter-spacing:.12em;color:#00F29A;font-weight:800;}
      .market-scope-head h3{margin:4px 0 0;font-size:17px;color:#F4FFF9;}
      .market-scope-head small{max-width:560px;text-align:right;color:#8FA9A0;font-size:11px;line-height:1.45;}
      .market-scope-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
      .market-scope-metric{border:1px solid #1B3028;border-radius:12px;background:#09100d;padding:12px 14px;min-height:78px;}
      .market-scope-metric span{display:block;color:#8FA9A0;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
      .market-scope-metric b{display:block;margin-top:7px;color:#F4FFF9;font-size:25px;line-height:1;}
      .market-scope-metric small{display:block;margin-top:6px;color:#738d83;font-size:10px;}
      .market-scope-detail{display:grid;gap:9px;padding-top:2px;}
      .market-scope-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .market-scope-detail-head span{font-size:11px;font-weight:800;color:#dce9e4;}
      .market-scope-detail-head small{font-size:10px;color:#738d83;}
      .market-scope-chips{display:flex;flex-wrap:wrap;gap:7px;}
      .market-scope-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #1B3028;border-radius:999px;padding:6px 9px;background:#07100c;color:#dce9e4;font-size:10px;}
      .market-scope-chip i{width:7px;height:7px;border-radius:50%;display:block;background:#60756d;}
      .market-scope-chip.confirmed i{background:#00F29A;}
      .market-scope-chip.declared i{background:#45D7E8;}
      .market-scope-chip.pending i{background:#F5D547;}
      .market-scope-subsidy{border-top:1px solid #1B3028;padding-top:10px;color:#8FA9A0;font-size:10px;line-height:1.5;}
      .market-scope-subsidy b{color:#F5D547;}
      .fz-subsidy-badge{display:inline-flex;margin-top:5px;border:1px solid rgba(245,213,71,.42);border-radius:999px;padding:2px 6px;color:#F5D547;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;}
      .subsidized-plan-row{background:rgba(245,213,71,.035);}
      .subsidized-plan-row td:first-child{box-shadow:inset 2px 0 0 rgba(245,213,71,.7);}
      .subsidized-price-note{display:block;margin-top:3px;color:#F5D547;font-size:9px;font-weight:700;}
      @media (max-width:900px){
        .market-scope-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
        .market-scope-head{align-items:flex-start;flex-direction:column;}
        .market-scope-head small{text-align:left;}
      }
      @media (max-width:560px){.market-scope-grid{grid-template-columns:1fr 1fr;}}
    `;
    document.head.appendChild(style);
  }

  function renderMarketScopeSummary(){
    ensureMarketSemanticsStyles();
    const kpis=document.querySelector('.kpi-grid[data-view="general"]');
    if(!kpis) return;
    let panel=$("market-scope-summary");
    if(!panel){
      panel=document.createElement("section");
      panel.id="market-scope-summary";
      panel.className="panel market-scope-summary view-block";
      panel.dataset.view="general";
      kpis.insertAdjacentElement("afterend",panel);
    }

    const planRows=state.filtered||[];
    const coverageRows=state.filteredCoverage||[];
    const allOperators=new Map();
    const commercialOperators=new Set();
    const pricedCommercialOperators=new Set();
    const subsidizedOperators=new Set();
    const coverageByOperator=new Map();

    planRows.forEach(r=>{
      const op=rowOperator(r),city=clean(r.Ciudad);
      if(!op) return;
      const key=city+"|"+op;
      allOperators.set(key,{op,city});
      if(r._benchmarkExcluded==="subsidy"||isSubsidizedPlan(r)){
        subsidizedOperators.add(key);
        return;
      }
      commercialOperators.add(key);
      if(toNum(r.Precio_Usado_COP)>0) pricedCommercialOperators.add(key);
    });

    coverageRows.forEach(r=>{
      const op=rowOperator(r),city=clean(r.Ciudad);
      if(!op) return;
      const key=city+"|"+op;
      allOperators.set(key,{op,city});
      if(!coverageByOperator.has(key)) coverageByOperator.set(key,[]);
      coverageByOperator.get(key).push(r);
    });

    const withoutCommercial=[...allOperators.keys()].filter(key=>!commercialOperators.has(key));
    const withoutPrice=[...allOperators.keys()].filter(key=>!pricedCommercialOperators.has(key));
    const subsidyInScope=[...subsidizedOperators];

    const chips=withoutCommercial.slice(0,18).map(key=>{
      const item=allOperators.get(key);
      const status=presenceStatus(coverageByOperator.get(key)||[]);
      const satellite=(coverageByOperator.get(key)||[]).some(r=>fold(r.Tecnologia).includes("satelit"));
      const label=item.city?item.op+" · "+item.city:item.op;
      return '<span class="market-scope-chip '+presenceTone(status)+'"><i></i><b>'+escapeHtml(label)+'</b><span>'+escapeHtml(satellite?"Satelital":status)+'</span></span>';
    }).join("");
    const more=withoutCommercial.length>18?'<span class="market-scope-chip registered"><i></i><b>+'+(withoutCommercial.length-18)+'</b><span>más</span></span>':"";

    const subsidyPlans=subsidyRows(planRows);
    const subsidyExamples=[...new Map(subsidyPlans.map(r=>{
      const op=rowOperator(r),city=clean(r.Ciudad);
      const price=toNum(r._Original_Precio_Usado_COP??r.Precio_Regular_COP);
      const speed=toNum(r._Original_Velocidad_Bajada_Mbps??r.Velocidad_Bajada_Mbps);
      const key=city+"|"+op;
      const label=[op,city,speed?formatNum(speed)+" Mbps":"",price?formatCOP(price):""].filter(Boolean).join(" · ");
      return [key,label];
    })).values()].slice(0,4);

    panel.innerHTML=
      '<div class="market-scope-head"><div><span>LECTURA DE MERCADO</span><h3>Presencia vs. oferta comercial</h3></div><small>La presencia territorial y la oferta con precio son universos distintos. Las tarifas subsidiadas permanecen visibles en el detalle, pero quedan fuera de los benchmarks comerciales.</small></div>'+
      '<div class="market-scope-grid">'+
        '<article class="market-scope-metric"><span>Operadores presentes</span><b>'+formatNum(allOperators.size)+'</b><small>Planes + presencia registrada</small></article>'+
        '<article class="market-scope-metric"><span>Con oferta comercial</span><b>'+formatNum(commercialOperators.size)+'</b><small>Plan no subsidiado relevado</small></article>'+
        '<article class="market-scope-metric"><span>Sin tarifa estructurada</span><b>'+formatNum(withoutPrice.length)+'</b><small>Presencia u oferta sin precio comparable</small></article>'+
        '<article class="market-scope-metric"><span>Oferta subsidiada</span><b>'+formatNum(subsidyInScope.length)+'</b><small>Separada del benchmark</small></article>'+
      '</div>'+
      (withoutCommercial.length?'<div class="market-scope-detail"><div class="market-scope-detail-head"><span>Presencia sin oferta comercial estructurada</span><small>'+formatNum(withoutCommercial.length)+' operador-ciudad</small></div><div class="market-scope-chips">'+chips+more+'</div></div>':"")+
      (subsidyExamples.length?'<div class="market-scope-subsidy"><b>Subsidios excluidos del benchmark:</b> '+escapeHtml(subsidyExamples.join(" · "))+'</div>':"");
  }

  function restoreSubsidizedDetailRows(root=document){
    const allSubsidies=subsidyRows();
    root.querySelectorAll(".operator-detail-card").forEach(card=>{
      const operator=clean(card.querySelector(".operator-detail-head h3")?.textContent);
      if(!operator) return;
      const candidates=allSubsidies.filter(r=>fold(rowOperator(r))===fold(operator));
      if(!candidates.length) return;
      const subsidizedRows=[...card.querySelectorAll(".operator-detail-table tbody tr")].filter(tr=>fold(tr.textContent).includes("subsid"));
      subsidizedRows.forEach((tr,index)=>{
        const plan=candidates[index]||candidates[0];
        const cells=tr.children;
        const speed=toNum(plan?._Original_Velocidad_Bajada_Mbps);
        const price=toNum(plan?._Original_Precio_Usado_COP??plan?.Precio_Regular_COP);
        if(cells[3]&&speed>0) cells[3].textContent=formatNum(speed)+" Mbps";
        if(cells[4]&&price>0) cells[4].innerHTML='<strong>'+escapeHtml(formatCOP(price))+'</strong><small class="subsidized-price-note">Tarifa subsidiada · fuera del benchmark</small>';
        tr.classList.add("subsidized-plan-row");
      });
      if(subsidizedRows.length&&!card.querySelector(".fz-subsidy-badge")){
        card.querySelector(".operator-detail-head > div")?.insertAdjacentHTML("beforeend",'<span class="fz-subsidy-badge">Incluye oferta subsidiada</span>');
      }
      const commercialForOperator=state.plans.filter(r=>fold(rowOperator(r))===fold(operator)&&r._benchmarkExcluded!=="subsidy"&&!isSubsidizedPlan(r));
      if(!commercialForOperator.length&&candidates.length){
        const priceValues=candidates.map(r=>toNum(r._Original_Precio_Usado_COP??r.Precio_Regular_COP)).filter(n=>n>0);
        const speedValues=candidates.map(r=>toNum(r._Original_Velocidad_Bajada_Mbps)).filter(n=>n>0);
        const kpis=card.querySelectorAll(".operator-detail-kpis > div b");
        if(kpis[1]&&priceValues.length) kpis[1].textContent="Subsidio · "+formatCOP(Math.min(...priceValues));
        if(kpis[2]&&speedValues.length) kpis[2].textContent=formatNum(Math.max(...speedValues))+" Mbps · subsidio";
      }
    });
  }

  function decorateFibrazoSubsidies(){
    const subsidyKeys=new Set(subsidyRows(state.filtered).map(r=>clean(r.Ciudad)+"|"+fold(rowOperator(r))));
    document.querySelectorAll("#fibrazo-compare-body .fz-compare-data-row").forEach(tr=>{
      const trigger=tr.querySelector("[data-operator][data-city]");
      if(!trigger) return;
      const key=clean(trigger.dataset.city)+"|"+fold(trigger.dataset.operator);
      if(!subsidyKeys.has(key)||tr.querySelector(".fz-subsidy-badge")) return;
      trigger.insertAdjacentHTML("afterend",'<small class="fz-subsidy-badge">Subsidio separado</small>');
    });
  }

  function installSemanticObserver(){
    if(document.documentElement.dataset.marketSemanticObserver==="1") return;
    document.documentElement.dataset.marketSemanticObserver="1";
    const observer=new MutationObserver(mutations=>{
      if(!mutations.some(m=>m.addedNodes?.length)) return;
      restoreSubsidizedDetailRows(document);
      decorateFibrazoSubsidies();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function removeErrorBox(){
    const el=$("source-error");
    if(el) el.remove();
  }

  function showError(message){
    removeErrorBox();
    document.querySelector("main")?.insertAdjacentHTML("afterbegin",'<div id="source-error" class="error-box"><strong>No fue posible cargar Base General.</strong><br>'+FZ.u.escapeHtml(message)+'</div>');
  }

  function renderSourceHealth(result){
    const el=$("source-health");
    if(!el) return;
    const total=result?.sourcesTotal||Object.keys(state.sourceHealth||{}).length;
    const ok=result?.sourcesOk??Object.values(state.sourceHealth||{}).filter(x=>x?.ok).length;
    if(!total){
      el.textContent="Fuentes: —";
      el.classList.remove("warn");
      return;
    }
    el.textContent="Fuentes "+ok+"/"+total;
    el.classList.toggle("warn",ok<total);
    if(ok<total){
      const failed=Object.values(state.sourceHealth||{}).filter(x=>!x?.ok).map(x=>x.label).filter(Boolean);
      el.title=failed.length?"Pendientes: "+failed.join(", "):"Hay fuentes que no respondieron en la última consulta.";
    }else{
      el.title="Todas las fuentes del dashboard cargaron correctamente.";
    }
  }

  function updateSectionVisibility(){
    const inGeneral=state.analysisView==="general";
    const hideRankings=FZ.filters.isSingleOperatorSingleCity();
    ["operator-price-panel","operator-speed-panel"].forEach(id=>$(id)?.classList.toggle("hidden",!inGeneral||hideRankings));
    document.querySelector(".filters")?.classList.toggle("hidden",state.analysisView==="compare"||state.analysisView==="mobile");
  }

  function renderAll(){
    updateSectionVisibility();
    if(state.analysisView==="general"){
      FZ.charts?.renderKPIs?.();
      FZ.charts?.renderCharts?.();
      FZ.table?.render?.();
      renderMarketScopeSummary();
      restoreSubsidizedDetailRows(document);
      return;
    }
    if(state.analysisView==="network"){FZ.territory?.renderFibrazo?.();return;}
    if(state.analysisView==="fibrazo"){
      FZ.comparison?.renderFibrazoComparison?.();
      decorateFibrazoSubsidies();
      return;
    }
    if(state.analysisView==="compare"){
      FZ.comparison?.renderComparator?.();
      restoreSubsidizedDetailRows(document);
      return;
    }
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
      renderMarketScopeSummary();
    }
    if(view==="network") FZ.territory?.renderFibrazo?.();
    if(view==="fibrazo"){
      FZ.comparison?.renderFibrazoComparison?.();
      decorateFibrazoSubsidies();
    }
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
      const result=await FZ.data.load();
      prepareMarketSemantics();
      FZ.filters.ensurePeriodSelection();
      renderSourceHealth(result);
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
    state.mobileView={period:"2026-09",operator:"all",modality:"all",search:"",sort:{key:"Operador",dir:1},openKey:""};
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
      decorateFibrazoSubsidies();
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
    ensureMarketSemanticsStyles();
    installSemanticObserver();
    FZ.details?.init?.();
    bindEvents();
    setAnalysisView("general");
    load();
  }

  FZ.app={renderAll,setAnalysisView,load,compareWithFibrazo,updateSectionVisibility,renderCityQuickbar:FZ.filters.renderCityQuickbar,init};
  init();
})();
