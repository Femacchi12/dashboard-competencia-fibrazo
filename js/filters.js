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
    return state.markets.filter(m=>fold(m.Mostrar_Acceso_Rapido)==="si"&&marketAppliesToPeriod(m));
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

  function selectedSingleCity(){
    const cities=comparatorCities();
    return cities.length===1?cities[0]:"";
  }

  function effectiveCityCount(){
    return comparatorCities().length;
  }

  function isSingleOperatorSingleCity(){
    return state.filters.operator.size===1&&effectiveCityCount()===1;
  }

  function normalizeTerritoryFilters(){
    if(selectedSingleCity()) return;
    state.filters.zone.clear();
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
    const checks={
      period:clean(r.Periodo_Label),
      city:clean(r.Ciudad),
      operator:clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
      technology:clean(r.Tecnologia)||"No informado",
      zone:clean(r.Zona_FIBRAZO),
      trunk:clean(r.Troncal_FIBRAZO)
    };
    if(skipKey!=="city"&&!cityScopeAllows(r.Ciudad)) return false;
    return ["period","city","operator","technology","zone","trunk"].every(key=>{
      if(key===skipKey||(!includePeriod&&key==="period")) return true;
      const set=state.filters[key];
      return !set.size||set.has(checks[key]);
    });
  }

  function hasPlanSpecificFilters(){
    return state.filters.modality.size>0||state.filters.price.size>0;
  }

  function territoryCoverageBase(skipKey=null){
    const city=selectedSingleCity();
    if(!city) return [];
    return state.coverage.filter(r=>{
      if(clean(r.Ciudad)!==city) return false;
      const checks={
        period:clean(r.Periodo_Label),
        operator:clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
        technology:clean(r.Tecnologia)||"No informado",
        zone:clean(r.Zona_FIBRAZO),
        trunk:clean(r.Troncal_FIBRAZO)
      };
      return ["period","operator","technology","zone","trunk"].every(key=>{
        if(key===skipKey) return true;
        const set=state.filters[key];
        return !set.size||set.has(checks[key]);
      });
    });
  }

  function planMatchesTerritory(r){
    if(!state.filters.zone.size&&!state.filters.trunk.size) return true;
    const city=clean(r.Ciudad),op=clean(r.Grupo_Operador)||clean(r.Operador_Normalizado);
    return state.coverage.some(c=>{
      const cop=clean(c.Grupo_Operador)||clean(c.Operador_Normalizado);
      if(clean(c.Ciudad)!==city||cop!==op) return false;
      if(state.filters.period.size&&!state.filters.period.has(clean(c.Periodo_Label))) return false;
      if(state.filters.technology.size&&!state.filters.technology.has(clean(c.Tecnologia)||"No informado")) return false;
      if(state.filters.zone.size&&!state.filters.zone.has(clean(c.Zona_FIBRAZO))) return false;
      if(state.filters.trunk.size&&!state.filters.trunk.has(clean(c.Troncal_FIBRAZO))) return false;
      return true;
    });
  }

  function planPasses(r){ return rowPassesFilters(r)&&planMatchesTerritory(r); }
  function evolutionPasses(r){ return rowPassesFilters(r,"period")&&planMatchesTerritory(r); }

  function refresh(){
    state.expanded=false;
    FZ.app?.renderCityQuickbar?.();
    renderFilters();
    apply();
  }

  function setCityScope(mode,cities=[]){
    state.cityScopeMode=mode;
    state.filters.city.clear();
    cities.filter(Boolean).forEach(c=>state.filters.city.add(c));
    refresh();
  }

  function toggleCitySelection(city){
    const value=clean(city);
    if(!value) return;
    state.cityScopeMode="custom";
    if(state.filters.city.has(value)) state.filters.city.delete(value);
    else state.filters.city.add(value);
    if(!state.filters.city.size) state.cityScopeMode="fibrazo";
    refresh();
  }

  function toggleAllFibrazoCities(){
    const quickNames=quickMarkets().map(m=>clean(m.Ciudad)).filter(Boolean);
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
    const quick=quickMarkets();
    const quickNames=new Set(quick.map(m=>clean(m.Ciudad)));

    const makeButton=(label,active,onClick,extraClass="")=>{
      const b=document.createElement("button");
      b.type="button";
      b.className=("city-chip "+extraClass+" "+(active?"active":"")).trim();
      b.textContent=label;
      b.addEventListener("click",onClick);
      return b;
    };

    const allQuickSelected=quick.length>0&&quick.every(m=>state.filters.city.has(clean(m.Ciudad)));
    const allActive=(state.cityScopeMode==="fibrazo"&&!state.filters.city.size)||allQuickSelected;
    root.appendChild(makeButton("Todas FIBRAZO",allActive,()=>toggleAllFibrazoCities(),"scope-all"));

    quick.forEach(m=>{
      const city=clean(m.Ciudad);
      const active=state.cityScopeMode==="custom"&&state.filters.city.has(city);
      const cls=fold(m.Prioridad_Visual)==="principal"?"principal":"";
      root.appendChild(makeButton(city,active,()=>toggleCitySelection(city),cls));
    });

    const wrap=document.createElement("div");
    wrap.className="city-more-wrap";
    const selectedOther=[...state.filters.city].filter(c=>!quickNames.has(c));
    const external=allRelevantCities().filter(c=>!quickNames.has(c));
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
        '<button class="city-all-relevant" type="button">Todas las ciudades relevadas</button>'+
        '<button class="city-more-clear" type="button">Limpiar</button>'+
      '</div><div class="city-more-divider"></div>'+
      '<span class="city-more-title">Otras ciudades relevadas</span>'+
      '<input class="city-more-search" type="search" placeholder="Buscar ciudad…">'+
      '<div class="city-more-options"></div>';
    menu.addEventListener("click",e=>e.stopPropagation());
    const search=menu.querySelector(".city-more-search");
    const box=menu.querySelector(".city-more-options");

    const updateMore=()=>{
      const selected=[...state.filters.city].filter(c=>!quickNames.has(c));
      const all=allRelevantCities().filter(c=>!quickNames.has(c));
      moreBtn.textContent=all.length&&selected.length===all.length?"+ Más · Todas":selected.length?"+ Más · "+selected.length:"+ Más";
      moreBtn.classList.toggle("active",selected.length>0);
      moreBtn.classList.toggle("more-selected",selected.length>0);
    };

    const paint=(q="")=>{
      const others=allRelevantCities().filter(c=>!quickNames.has(c)&&fold(c).includes(fold(q)));
      box.innerHTML="";
      others.forEach(city=>{
        const row=document.createElement("label");
        row.className="city-more-option";
        row.innerHTML='<input type="checkbox" '+(state.filters.city.has(city)?"checked":"")+'><span>'+escapeHtml(city)+'</span>';
        row.querySelector("input").addEventListener("change",e=>{
          state.cityScopeMode="custom";
          if(e.target.checked) state.filters.city.add(city); else state.filters.city.delete(city);
          if(!state.filters.city.size) state.cityScopeMode="fibrazo";
          state.expanded=false;
          updateMore();
          renderFilters();
          apply();
        });
        box.appendChild(row);
      });
      if(!others.length) box.innerHTML='<span class="filter-empty">Sin ciudades compatibles</span>';
    };

    menu.querySelector(".city-all-relevant").addEventListener("click",()=>{
      allRelevantCities().filter(c=>!quickNames.has(c)).forEach(c=>state.filters.city.add(c));
      state.cityScopeMode="custom";
      updateMore(); paint(search.value); renderFilters(); apply();
    });
    menu.querySelector(".city-more-clear").addEventListener("click",()=>{
      [...state.filters.city].filter(c=>!quickNames.has(c)).forEach(c=>state.filters.city.delete(c));
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
      wrap.innerHTML='<label class="filter-label">'+escapeHtml(label)+'</label><button class="filter-btn territory-disabled" type="button" disabled><span>Solo con 1 ciudad</span><span>ⓘ</span></button>';
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

      if(!hasPlanSpecificFilters()&&(key==="operator"||key==="technology")){
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
              if(def.maxSelections&&state.filters[key].size>=def.maxSelections){e.target.checked=false;return;}
              state.filters[key].add(o);
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

    renderTerritoryFilter(root,"zone","Zona FIBRAZO","Zona_FIBRAZO");
    renderTerritoryFilter(root,"trunk","Troncal FIBRAZO","Troncal_FIBRAZO");
  }

  function apply(){
    state.filtered=state.plans.filter(planPasses);
    if(hasPlanSpecificFilters()){
      const allowed=new Set(state.filtered.map(r=>[r.Periodo_Label,clean(r.Ciudad),clean(r.Grupo_Operador)].join("|")));
      state.filteredCoverage=state.coverage.filter(r=>allowed.has([r.Periodo_Label,clean(r.Ciudad),clean(r.Grupo_Operador)].join("|"))&&coveragePassesFilters(r));
    }else{
      state.filteredCoverage=state.coverage.filter(r=>coveragePassesFilters(r));
    }
    FZ.app?.renderAll?.();
  }

  FZ.filters={
    availablePeriods,ensurePeriodSelection,selectedPeriodValue,marketAppliesToPeriod,fibrazoMarkets,quickMarkets,
    fibrazoCitySet,allRelevantCities,cityScopeAllows,comparatorCities,selectedSingleCity,effectiveCityCount,
    isSingleOperatorSingleCity,normalizeTerritoryFilters,rowPassesFilters,coveragePassesFilters,hasPlanSpecificFilters,
    territoryCoverageBase,planMatchesTerritory,planPasses,evolutionPasses,setCityScope,toggleCitySelection,
    toggleAllFibrazoCities,renderCityQuickbar,renderFilters,apply
  };
})();
