(function filtersModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,periodValue,periodSortValue,formatPeriod}=FZ.u;
  const $=FZ.u.$;

  function availablePeriods(){
    return [...new Set(state.plans.map(r=>periodValue(r.Periodo_Corte)).filter(Boolean))]
      .sort((a,b)=>periodSortValue(a)-periodSortValue(b));
  }

  function ensurePeriodSelection(){
    if(state.filters.period.size) return;
    const periods=availablePeriods();
    if(periods.length) state.filters.period.add(formatPeriod(periods[periods.length-1]));
  }

  function selectedPeriodValue(){
    const label=[...state.filters.period][0]||"";
    const row=state.plans.find(r=>r.Periodo_Label===label);
    return row?.Periodo_Corte||availablePeriods().at(-1)||"";
  }

  function marketAppliesToPeriod(m){
    const period=selectedPeriodValue();
    if(!period) return true;
    const start=periodValue(m.Activo_Desde),end=periodValue(m.Activo_Hasta);
    if(start&&periodSortValue(period)<periodSortValue(start)) return false;
    if(end&&periodSortValue(period)>periodSortValue(end)) return false;
    return true;
  }

  function fibrazoMarkets(){
    return state.markets.filter(m=>fold(m.Mercado_FIBRAZO)==="si"&&fold(m.Es_Default_Scope)==="si"&&marketAppliesToPeriod(m));
  }

  function quickMarkets(){
    return state.markets
      .filter(m=>fold(m.Mostrar_Acceso_Rapido)==="si"&&marketAppliesToPeriod(m))
      .sort((a,b)=>(Number(a.Orden_Dashboard)||999)-(Number(b.Orden_Dashboard)||999));
  }

  function marketForCity(city){
    const value=clean(city);
    return state.markets.find(m=>clean(m.Ciudad)===value&&marketAppliesToPeriod(m))||null;
  }

  function marketGroupKey(city){
    return clean(marketForCity(city)?.Grupo_Comparacion);
  }

  function marketGroupCities(city){
    const value=clean(city);
    if(!value) return [];
    const key=marketGroupKey(value);
    if(!key) return [value];
    return state.markets
      .filter(m=>clean(m.Grupo_Comparacion)===key&&marketAppliesToPeriod(m))
      .sort((a,b)=>(Number(a.Orden_Dashboard)||999)-(Number(b.Orden_Dashboard)||999)||clean(a.Ciudad).localeCompare(clean(b.Ciudad),"es",{numeric:true}))
      .map(m=>clean(m.Ciudad))
      .filter(Boolean);
  }

  function marketIdentity(city){
    return marketGroupKey(city)||clean(city);
  }

  function marketDisplayName(city){
    const cities=marketGroupCities(city);
    return cities.length>1?cities.join(" + "):clean(city);
  }

  function marketRepresentativeCity(city){
    return marketGroupCities(city)[0]||clean(city);
  }

  function expandMarketCities(cities=[]){
    const out=new Set();
    cities.filter(Boolean).forEach(city=>marketGroupCities(city).forEach(member=>out.add(member)));
    return [...out];
  }

  function isFibrazoCity(city){
    const market=marketForCity(city);
    return fold(market?.Mercado_FIBRAZO)==="si";
  }

  function territoryFieldForCity(city){
    return isFibrazoCity(city)?"Troncal_FIBRAZO":"Zona_FIBRAZO";
  }

  function territoryLabelForCity(city){
    return isFibrazoCity(city)?"Troncal FIBRAZO":"Zona";
  }

  function territoryValue(r){
    const field=territoryFieldForCity(clean(r?.Ciudad));
    return clean(r?.[field]);
  }

  function fibrazoCitySet(){
    return new Set(fibrazoMarkets().map(m=>clean(m.Ciudad)).filter(Boolean));
  }

  function allRelevantCities(){
    return [...new Set([
      ...state.markets.map(m=>clean(m.Ciudad)),
      ...state.plans.map(r=>clean(r.Ciudad)),
      ...state.coverage.map(r=>clean(r.Ciudad)),
      ...state.metrics.map(r=>clean(r.Ciudad))
    ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  }

  function cityScopeAllows(city){
    const value=clean(city);
    if(state.filters.city.size) return state.filters.city.has(value);
    if(state.cityScopeMode==="all") return true;
    if(state.cityScopeMode==="fibrazo"){
      const set=fibrazoCitySet();
      return !set.size||set.has(value);
    }
    return true;
  }

  function comparatorCities(){
    if(state.filters.city.size) return [...state.filters.city].filter(Boolean);
    if(state.cityScopeMode==="fibrazo") return [...fibrazoCitySet()].filter(Boolean);
    if(state.cityScopeMode==="all") return allRelevantCities();
    return [];
  }

  function selectedMarketCities(){
    const cities=comparatorCities();
    if(!cities.length) return [];
    const identities=new Set(cities.map(marketIdentity).filter(Boolean));
    if(identities.size!==1) return [];
    const expected=marketGroupCities(cities[0]);
    return expected.length?expected:cities;
  }

  function selectedSingleCity(){
    const cities=selectedMarketCities();
    return cities.length?marketRepresentativeCity(cities[0]):"";
  }

  function effectiveCityCount(){
    return new Set(comparatorCities().map(marketIdentity).filter(Boolean)).size;
  }

  function isSingleOperatorSingleCity(){
    return state.filters.operator.size===1&&effectiveCityCount()===1;
  }

  function normalizeTerritoryFilters(){
    if(selectedSingleCity()) return;
    state.filters.trunk.clear();
  }

  function rowPassesFilters(r,skipKey=null){
    if(skipKey!=="city"&&!cityScopeAllows(r.Ciudad)) return false;
    return FZ.filterDefs.every(def=>{
      if(def.key===skipKey) return true;
      const set=state.filters[def.key];
      return !set.size||set.has(def.getter(r));
    });
  }

  function coveragePassesFilters(r,skipKey=null,includePeriod=true){
    if(!FZ.u.competitiveCoverageAllowed(r)) return false;
    const checks={
      period:clean(r.Periodo_Label),
      city:clean(r.Ciudad),
      operator:clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
      technology:clean(r.Tecnologia)||"No informado",
      trunk:territoryValue(r)
    };
    if(skipKey!=="city"&&!cityScopeAllows(r.Ciudad)) return false;
    return ["period","city","operator","technology","trunk"].every(key=>{
      if(key===skipKey||(!includePeriod&&key==="period")) return true;
      const set=state.filters[key];
      return !set.size||set.has(checks[key]);
    });
  }

  function territoryCoverageBase(skipKey=null){
    const cities=selectedMarketCities();
    if(!cities.length) return [];
    const citySet=new Set(cities);
    return state.coverage.filter(r=>{
      if(!FZ.u.competitiveCoverageAllowed(r)||!citySet.has(clean(r.Ciudad))) return false;
      const checks={
        period:clean(r.Periodo_Label),
        operator:clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
        technology:clean(r.Tecnologia)||"No informado",
        trunk:territoryValue(r)
      };
      return ["period","operator","technology","trunk"].every(key=>{
        if(key===skipKey) return true;
        const set=state.filters[key];
        return !set.size||set.has(checks[key]);
      });
    });
  }

  function planMatchesTerritory(r){
    if(!state.filters.trunk.size) return true;
    const city=clean(r.Ciudad),op=clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),opId=clean(r.ID_Operador);
    const rows=state.indexes?.coverageByCityOperator?.get(city+"|"+(opId||op))||[];
    return rows.some(c=>{
      if(!FZ.u.competitiveCoverageAllowed(c)) return false;
      if(state.filters.period.size&&!state.filters.period.has(clean(c.Periodo_Label))) return false;
      if(state.filters.technology.size&&!state.filters.technology.has(clean(c.Tecnologia)||"No informado")) return false;
      if(state.filters.trunk.size&&!state.filters.trunk.has(territoryValue(c))) return false;
      return true;
    });
  }

  function planPasses(r){ return rowPassesFilters(r)&&planMatchesTerritory(r); }

  function refresh(){
    state.expanded=false;
    FZ.app?.renderCityQuickbar?.();
    renderFilters();
    apply();
  }

  function setCityScope(mode,cities=[]){
    state.cityScopeMode=mode;
    state.filters.city.clear();
    expandMarketCities(cities).forEach(c=>state.filters.city.add(c));
    refresh();
  }

  function toggleCitySelection(city){
    const members=marketGroupCities(city);
    if(!members.length) return;
    state.cityScopeMode="custom";
    const allSelected=members.every(member=>state.filters.city.has(member));
    members.forEach(member=>allSelected?state.filters.city.delete(member):state.filters.city.add(member));
    if(!state.filters.city.size) state.cityScopeMode="fibrazo";
    refresh();
  }

  function toggleAllFibrazoCities(){
    const quickNames=quickMarkets().filter(m=>fold(m.Mercado_FIBRAZO)==="si").map(m=>clean(m.Ciudad)).filter(Boolean);
    const allSelected=quickNames.length>0&&quickNames.every(c=>state.filters.city.has(c));
    state.cityScopeMode="custom";
    if(allSelected) quickNames.forEach(c=>state.filters.city.delete(c));
    else quickNames.forEach(c=>state.filters.city.add(c));
    if(!state.filters.city.size) state.cityScopeMode="fibrazo";
    refresh();
  }

  function renderCityQuickbar(){
    const root=$("city-quickbar");
    if(!root) return;
    root.innerHTML="";
    const seenQuick=new Set();
    const quick=quickMarkets().filter(m=>{
      const id=marketIdentity(m.Ciudad);
      if(!id||seenQuick.has(id)) return false;
      seenQuick.add(id);
      return true;
    });
    const quickIdentities=new Set(quick.map(m=>marketIdentity(m.Ciudad)));

    const makeButton=(label,active,onClick,extraClass="")=>{
      const b=document.createElement("button");
      b.type="button";
      b.className=("city-chip "+extraClass+" "+(active?"active":"")).trim();
      b.textContent=label;
      b.addEventListener("click",onClick);
      return b;
    };

    const quickFibrazo=quick.filter(m=>fold(m.Mercado_FIBRAZO)==="si");
    const allQuickSelected=quickFibrazo.length>0&&quickFibrazo.every(m=>state.filters.city.has(clean(m.Ciudad)));
    const allActive=(state.cityScopeMode==="fibrazo"&&!state.filters.city.size)||allQuickSelected;
    root.appendChild(makeButton("Todas FIBRAZO",allActive,()=>toggleAllFibrazoCities(),"scope-all"));

    quick.forEach(m=>{
      const city=clean(m.Ciudad);
      const members=marketGroupCities(city);
      const active=state.cityScopeMode==="custom"&&members.length>0&&members.every(member=>state.filters.city.has(member));
      const cls=fold(m.Prioridad_Visual)==="principal"?"principal":"";
      root.appendChild(makeButton(marketDisplayName(city),active,()=>toggleCitySelection(city),cls));
    });

    const wrap=document.createElement("div");
    wrap.className="city-more-wrap";
    const selectedOther=[...state.filters.city].filter(c=>!quickIdentities.has(marketIdentity(c)));
    const external=allRelevantCities().filter(c=>!quickIdentities.has(marketIdentity(c)));
    const allExternalSelected=external.length>0&&selectedOther.length===external.length;
    const moreLabel=allExternalSelected?"+ Más · Todas":selectedOther.length?"+ Más · "+selectedOther.length:"+ Más";
    const moreBtn=makeButton(moreLabel,selectedOther.length>0,e=>{
      e.stopPropagation();
      menu.classList.toggle("hidden");
      search.focus();
    },"more");
    if(selectedOther.length) moreBtn.classList.add("more-selected");
    wrap.appendChild(moreBtn);

    const menu=document.createElement("div");
    menu.className="city-more-menu hidden";
    menu.innerHTML=
      '<div class="city-more-actions">'+
        '<button class="city-all-relevant" type="button">Todos los mercados relevados</button>'+
        '<button class="city-more-clear" type="button">Limpiar</button>'+
      '</div><div class="city-more-divider"></div>'+
      '<span class="city-more-title">Otros mercados relevados</span>'+
      '<input class="city-more-search" type="search" placeholder="Buscar ciudad o mercado…">'+
      '<div class="city-more-options"></div>';
    menu.addEventListener("click",e=>e.stopPropagation());
    const search=menu.querySelector(".city-more-search");
    const box=menu.querySelector(".city-more-options");

    const updateMore=()=>{
      const selectedIds=new Set([...state.filters.city].map(marketIdentity).filter(id=>id&&!quickIdentities.has(id)));
      const allIds=new Set(allRelevantCities().map(marketIdentity).filter(id=>id&&!quickIdentities.has(id)));
      moreBtn.textContent=allIds.size&&selectedIds.size===allIds.size?"+ Más · Todas":selectedIds.size?"+ Más · "+selectedIds.size:"+ Más";
      moreBtn.classList.toggle("active",selectedIds.size>0);
      moreBtn.classList.toggle("more-selected",selectedIds.size>0);
    };

    const paint=(q="")=>{
      const seen=new Set();
      const others=allRelevantCities().filter(c=>{
        const id=marketIdentity(c);
        if(quickIdentities.has(id)||seen.has(id)||!fold(marketDisplayName(c)).includes(fold(q))) return false;
        seen.add(id);
        return true;
      });
      box.innerHTML="";
      others.forEach(city=>{
        const members=marketGroupCities(city);
        const checked=members.length>0&&members.every(member=>state.filters.city.has(member));
        const row=document.createElement("label");
        row.className="city-more-option";
        row.innerHTML='<input type="checkbox" '+(checked?"checked":"")+'><span>'+escapeHtml(marketDisplayName(city))+'</span>';
        row.querySelector("input").addEventListener("change",e=>{
          state.cityScopeMode="custom";
          members.forEach(member=>e.target.checked?state.filters.city.add(member):state.filters.city.delete(member));
          if(!state.filters.city.size) state.cityScopeMode="fibrazo";
          state.expanded=false;
          updateMore();
          renderCityQuickbar();
          renderFilters();
          apply();
        });
        box.appendChild(row);
      });
      if(!others.length) box.innerHTML='<span class="filter-empty">Sin ciudades compatibles</span>';
    };

    menu.querySelector(".city-all-relevant").addEventListener("click",()=>{
      allRelevantCities().filter(c=>!quickIdentities.has(marketIdentity(c))).forEach(c=>marketGroupCities(c).forEach(member=>state.filters.city.add(member)));
      state.cityScopeMode="custom";
      updateMore(); paint(search.value); renderFilters(); apply();
    });
    menu.querySelector(".city-more-clear").addEventListener("click",()=>{
      [...state.filters.city].filter(c=>!quickIdentities.has(marketIdentity(c))).forEach(c=>state.filters.city.delete(c));
      state.cityScopeMode=state.filters.city.size?"custom":"fibrazo";
      updateMore(); paint(search.value); renderFilters(); apply();
    });
    search.addEventListener("input",()=>paint(search.value));
    paint();
    wrap.appendChild(menu);
    root.appendChild(wrap);
  }

  function updateFilterLabel(wrap,def){
    const set=state.filters[def.key],n=set.size;
    const btn=wrap.querySelector(".filter-btn");
    const label=wrap.querySelector("[data-label]");
    if(label) label.textContent=n===0?(def.allLabel||"Todos"):n===1?[...set][0]:n+" seleccionados";
    btn?.classList.toggle("active",n>0);
  }

  function renderTerritoryFilter(root,key,label,field){
    const city=selectedSingleCity();
    const wrap=document.createElement("div");
    wrap.className="filter territory-filter"+(city?"":" disabled");

    if(!city){
      wrap.innerHTML='<label class="filter-label">'+escapeHtml(label)+'</label><button class="filter-btn territory-disabled" type="button" disabled><span>Solo con 1 mercado</span><span>ⓘ</span></button>';
      root.appendChild(wrap);
      return;
    }

    const options=[...new Set(territoryCoverageBase(key).map(r=>clean(r[field])).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
    for(const selected of [...state.filters[key]]) if(!options.includes(selected)) state.filters[key].delete(selected);

    wrap.innerHTML='<label class="filter-label">'+escapeHtml(label)+'</label>'+
      '<button class="filter-btn" type="button" '+(options.length?"":"disabled")+'><span data-label>'+(options.length?"Todos":"Sin datos cargados")+'</span><span>⌄</span></button>'+
      '<div class="filter-menu hidden"><input class="filter-search" placeholder="Buscar…"><div class="filter-options"></div></div>';

    const btn=wrap.querySelector(".filter-btn"),menu=wrap.querySelector(".filter-menu"),box=wrap.querySelector(".filter-options"),search=wrap.querySelector(".filter-search");

    const paint=(q="")=>{
      box.innerHTML="";
      options.filter(o=>fold(o).includes(fold(q))).forEach(o=>{
        const row=document.createElement("label");
        row.className="filter-option";
        row.innerHTML='<input type="checkbox" '+(state.filters[key].has(o)?"checked":"")+'><span>'+escapeHtml(o)+'</span>';
        row.querySelector("input").addEventListener("change",e=>{
          if(e.target.checked) state.filters[key].add(o); else state.filters[key].delete(o);
          state.expanded=false;
          renderFilters();
          apply();
        });
        box.appendChild(row);
      });
      if(!box.children.length) box.innerHTML='<span class="filter-empty">Sin opciones compatibles</span>';
    };

    btn.addEventListener("click",e=>{
      e.stopPropagation();
      document.querySelectorAll(".filter-menu").forEach(m=>{if(m!==menu)m.classList.add("hidden");});
      menu.classList.toggle("hidden");
      if(!menu.classList.contains("hidden")){search.focus();paint(search.value);}
    });
    menu.addEventListener("click",e=>e.stopPropagation());
    search.addEventListener("input",()=>paint(search.value));
    root.appendChild(wrap);
    paint();
    updateFilterLabel(wrap,{key,allLabel:"Todos"});
  }

  function renderMarketGroupNote(){
    const note=$("city-group-note");
    if(!note) return;
    const cities=selectedMarketCities();
    const grouped=cities.length>1;
    note.classList.toggle("hidden",!grouped);
    if(!grouped){
      note.innerHTML="";
      return;
    }
    const label=marketDisplayName(cities[0]);
    note.innerHTML='<strong>Mercado agrupado</strong><span>'+escapeHtml(label)+'. Todos los indicadores, gráficos, planes y competidores integran los tres municipios; la base conserva el municipio de origen para trazabilidad.</span>';
  }

  function renderFilters(){
    normalizeTerritoryFilters();
    const root=$("filters");
    if(!root) return;
    root.innerHTML="";

    FZ.filterDefs.forEach(def=>{
      if(def.key==="city") return;
      const key=def.key,getter=def.getter;
      const baseRows=key==="period"?state.plans:state.plans.filter(r=>rowPassesFilters(r,key));
      let options=[...new Set(baseRows.map(getter).filter(Boolean))];

      if(key==="operator"||key==="technology"){
        const coverageOptions=state.coverage
          .filter(r=>coveragePassesFilters(r,key))
          .map(r=>key==="operator"?(clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)):(clean(r.Tecnologia)||"No informado"))
          .filter(Boolean);
        options=[...new Set([...options,...coverageOptions])];
      }

      if(key==="period"){
        options.sort((a,b)=>{
          const ar=state.plans.find(r=>r.Periodo_Label===a)?.Periodo_Corte||"";
          const br=state.plans.find(r=>r.Periodo_Label===b)?.Periodo_Corte||"";
          return periodSortValue(br)-periodSortValue(ar);
        });
      }else options.sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));

      if(key!=="period"){
        for(const selected of [...state.filters[key]]) if(!options.includes(selected)) state.filters[key].delete(selected);
      }

      const wrap=document.createElement("div");
      wrap.className="filter";
      wrap.innerHTML='<label class="filter-label">'+escapeHtml(def.label)+'</label>'+
        '<button class="filter-btn" type="button"><span data-label>'+escapeHtml(def.allLabel||"Todos")+'</span><span>⌄</span></button>'+
        '<div class="filter-menu hidden"><input class="filter-search" placeholder="Buscar…"><div class="filter-options"></div></div>';

      const btn=wrap.querySelector(".filter-btn"),menu=wrap.querySelector(".filter-menu"),box=wrap.querySelector(".filter-options"),search=wrap.querySelector(".filter-search");

      const paint=(q="")=>{
        box.innerHTML="";
        options.filter(o=>fold(o).includes(fold(q))).forEach(o=>{
          const row=document.createElement("label");
          row.className="filter-option";
          row.innerHTML='<input type="checkbox" '+(state.filters[key].has(o)?"checked":"")+'><span>'+escapeHtml(o)+'</span>';
          row.querySelector("input").addEventListener("change",e=>{
            if(e.target.checked){
              if(key==="period"){
                state.filters.period.clear();
                state.filters.period.add(o);
              }else{
                if(def.maxSelections&&state.filters[key].size>=def.maxSelections){e.target.checked=false;return;}
                state.filters[key].add(o);
              }
            }else{
              state.filters[key].delete(o);
              if(key==="period"&&!state.filters.period.size) ensurePeriodSelection();
            }
            state.expanded=false;
            if(key==="period") renderCityQuickbar();
            renderFilters();
            apply();
          });
          box.appendChild(row);
        });
        if(!box.children.length) box.innerHTML='<span class="filter-empty">Sin opciones compatibles</span>';
      };

      btn.addEventListener("click",e=>{
        e.stopPropagation();
        document.querySelectorAll(".filter-menu").forEach(m=>{if(m!==menu)m.classList.add("hidden");});
        menu.classList.toggle("hidden");
        if(!menu.classList.contains("hidden")){search.focus();paint(search.value);}
      });
      menu.addEventListener("click",e=>e.stopPropagation());
      search.addEventListener("input",()=>paint(search.value));
      root.appendChild(wrap);
      paint();
      updateFilterLabel(wrap,def);
    });

    const city=selectedSingleCity();
    renderTerritoryFilter(
      root,
      "trunk",
      city?territoryLabelForCity(city):"Troncal / Zona",
      city?territoryFieldForCity(city):"Troncal_FIBRAZO"
    );
    renderMarketGroupNote();
  }

  function apply(){
    state.filtered=state.plans.filter(planPasses);
    state.filteredCoverage=state.coverage.filter(r=>coveragePassesFilters(r));
    FZ.app?.renderAll?.();
  }

  FZ.filters={
    availablePeriods,ensurePeriodSelection,selectedPeriodValue,marketAppliesToPeriod,fibrazoMarkets,quickMarkets,
    marketForCity,marketGroupKey,marketGroupCities,marketIdentity,marketDisplayName,marketRepresentativeCity,expandMarketCities,
    isFibrazoCity,territoryFieldForCity,territoryLabelForCity,territoryValue,
    fibrazoCitySet,allRelevantCities,cityScopeAllows,comparatorCities,selectedMarketCities,selectedSingleCity,effectiveCityCount,
    isSingleOperatorSingleCity,normalizeTerritoryFilters,rowPassesFilters,coveragePassesFilters,
    territoryCoverageBase,planMatchesTerritory,planPasses,setCityScope,toggleCitySelection,
    toggleAllFibrazoCities,renderCityQuickbar,renderFilters,apply
  };
})();
