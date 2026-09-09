(function comparisonModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,formatPct,pctVs,normalizeTV,rowOperator}=FZ.u;
  const $=FZ.u.$;

  function offerLabel(o){
    const trunk=clean(o.Troncal_FIBRAZO)?" · "+clean(o.Troncal_FIBRAZO):"";
    return clean(o.Ciudad)+trunk+" · "+clean(o.Servicio)+" · "+formatNum(o.Velocidad_Mbps)+" Mbps · "+formatCOP(o.Precio_COP)+" · "+clean(o.Etapa_Vigencia);
  }

  function compatibleOffers(){
    const cities=state.filters.city.size?state.filters.city:FZ.filters.fibrazoCitySet();
    const rows=state.offers.filter(o=>!cities.size||cities.has(clean(o.Ciudad)));
    const seen=new Set();
    return rows.filter(o=>{
      const k=[o.Servicio,o.Velocidad_Mbps,o.TV,o.Precio_COP,o.Etapa_Vigencia,o.Troncal_FIBRAZO].join("|");
      if(seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function fibrazoOfferForCity(city){
    const offers=state.offers.filter(o=>clean(o.Ciudad)===clean(city));
    if(!offers.length) return null;
    const selected=offers.find(o=>o.ID_Oferta===state.selectedOfferKey);
    if(selected) return selected;
    return offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400&&clean(o.Etapa_Vigencia)==="Precio normal")
      ||offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400)
      ||[...offers].sort((a,b)=>(a.Precio_COP||Infinity)-(b.Precio_COP||Infinity))[0];
  }

  function renderFibrazoComparison(){
    const select=$("fibrazo-offer-select");
    if(!select) return;
    const offers=compatibleOffers();
    if(!offers.length){
      select.innerHTML="<option>Sin oferta compatible</option>";
      if($("fibrazo-compare-body")) $("fibrazo-compare-body").innerHTML="";
      return;
    }
    if(!state.selectedOfferKey||!offers.some(o=>o.ID_Oferta===state.selectedOfferKey)){
      const preferred=offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400&&clean(o.Etapa_Vigencia)==="Precio normal")||offers[0];
      state.selectedOfferKey=preferred.ID_Oferta;
    }
    select.innerHTML=offers.map(o=>'<option value="'+escapeHtml(o.ID_Oferta)+'" '+(o.ID_Oferta===state.selectedOfferKey?"selected":"")+'>'+escapeHtml(offerLabel(o))+"</option>").join("");
    const fz=offers.find(o=>o.ID_Oferta===state.selectedOfferKey)||offers[0];
    if($("fz-price")) $("fz-price").textContent=formatCOP(fz.Precio_COP);
    if($("fz-speed")) $("fz-speed").textContent=formatNum(fz.Velocidad_Mbps);
    if($("fz-offer-name")) $("fz-offer-name").textContent=clean(fz.Servicio)+" · "+clean(fz.Etapa_Vigencia);

    const best=new Map();
    state.filtered.forEach(r=>{
      const op=rowOperator(r),price=toNum(r.Precio_Usado_COP);
      if(!op||!(price>0)) return;
      const cur=best.get(op);
      if(!cur||price<toNum(cur.Precio_Usado_COP)) best.set(op,r);
    });
    const rows=[...best.values()].sort((a,b)=>toNum(a.Precio_Usado_COP)-toNum(b.Precio_Usado_COP));
    const cheaper=rows.filter(r=>toNum(r.Precio_Usado_COP)<fz.Precio_COP).length;
    const faster=rows.filter(r=>toNum(r.Velocidad_Bajada_Mbps)>fz.Velocidad_Mbps).length;
    if($("fz-better-price")) $("fz-better-price").textContent=rows.length?formatNum(cheaper)+" ("+formatPct(cheaper/rows.length*100).replace("+","")+")":"—";
    if($("fz-better-speed")) $("fz-better-speed").textContent=rows.length?formatNum(faster)+" ("+formatPct(faster/rows.length*100).replace("+","")+")":"—";

    const body=$("fibrazo-compare-body");
    if(body){
      body.innerHTML=rows.map(r=>{
        const p=toNum(r.Precio_Usado_COP),s=toNum(r.Velocidad_Bajada_Mbps);
        const dp=p-fz.Precio_COP,ds=(s??0)-fz.Velocidad_Mbps;
        const pricePct=pctVs(p,fz.Precio_COP),speedPct=s==null?null:pctVs(s,fz.Velocidad_Mbps);
        const dpLabel=dp===0?"=":(dp>0?"+":"")+formatCOP(dp).replace("COP","").trim();
        return '<tr><td><strong>'+escapeHtml(rowOperator(r))+'</strong></td><td>'+formatCOP(p)+'</td><td>'+(s==null?"—":formatNum(s)+" Mbps")+'</td>'+
          '<td class="'+(dp<=0?"negative":"positive")+'">'+dpLabel+' <small>'+formatPct(pricePct)+'</small></td>'+
          '<td class="'+(ds>=0?"positive":"negative")+'">'+(ds>0?"+":"")+formatNum(ds)+' <small>'+formatPct(speedPct)+'</small></td>'+
          '<td>'+escapeHtml(clean(r.Tecnologia)||"—")+'</td><td>'+escapeHtml(normalizeTV(r.TV_Incluida))+'</td></tr>';
      }).join("");
    }
  }

  function latestRowsForCity(rows,city){
    const cityRows=rows.filter(r=>clean(r.Ciudad)===clean(city));
    if(!cityRows.length) return [];
    const periods=cityRows.map(r=>clean(r.Periodo_Corte)).filter(Boolean);
    if(!periods.length) return cityRows;
    const latest=[...new Set(periods)].sort((a,b)=>FZ.u.periodSortValue(b)-FZ.u.periodSortValue(a))[0];
    const exact=cityRows.filter(r=>clean(r.Periodo_Corte)===latest);
    return exact.length?exact:cityRows;
  }

  function comparatorCities(){
    const set=new Set();
    state.metrics.forEach(r=>{
      if(toNum(r.HHPP)>0&&clean(r.Ciudad)) set.add(clean(r.Ciudad));
    });
    return [...set].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
  }

  function comparisonScopeOptions(){
    const level=state.comparison.level==="trunk"?"trunk":"city";
    const query=fold(state.comparison.search);
    const options=[];

    if(level==="city"){
      comparatorCities().forEach(city=>{
        if(query&&!fold(city).includes(query)) return;
        options.push({key:"city|"+city+"|"+city,level:"city",city,value:city,label:city});
      });
    }else{
      state.metrics.forEach(r=>{
        const city=clean(r.Ciudad),trunk=clean(r.Troncal_FIBRAZO),hhpp=toNum(r.HHPP);
        if(!city||!trunk||!(hhpp>0)) return;
        if(state.comparison.cityFilter!=="all"&&city!==state.comparison.cityFilter) return;
        const label=city+" · "+trunk;
        if(query&&!fold(label).includes(query)) return;
        options.push({key:"trunk|"+city+"|"+trunk,level:"trunk",city,value:trunk,label,hhpp});
      });
    }

    const unique=new Map();
    options.forEach(o=>unique.set(o.key,o));
    return [...unique.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  }

  function scopeCoverageRows(scope){
    const rows=latestRowsForCity(state.coverage,scope.city);
    if(scope.level==="city") return rows;
    return rows.filter(r=>clean(r.Troncal_FIBRAZO)===scope.value);
  }

  function scopePlanRows(scope,coverageRows){
    let rows=latestRowsForCity(state.plans,scope.city);
    if(scope.level==="city") return rows;
    const ops=new Set(coverageRows.map(rowOperator).filter(Boolean));
    if(!ops.size) return [];
    return rows.filter(r=>ops.has(rowOperator(r)));
  }

  function operationalMetrics(scope){
    if(scope.level==="trunk"){
      const tm=FZ.territory?.metricForTrunk(scope.city,scope.value);
      return {
        hhpp:toNum(tm?.HHPP),
        active:toNum(tm?.Clientes_Activos),
        penetration:toNum(tm?.Penetracion)
      };
    }

    const rows=state.metrics.filter(r=>clean(r.Ciudad)===scope.city&&toNum(r.HHPP)>0);
    const hhpp=rows.reduce((s,r)=>s+(toNum(r.HHPP)||0),0);
    const active=rows.reduce((s,r)=>s+(toNum(r.Clientes_Activos)||0),0);
    return {hhpp,active,penetration:hhpp>0?active/hhpp:null};
  }

  function comparisonMetrics(scope){
    const coverageRows=scopeCoverageRows(scope);
    const plans=scopePlanRows(scope,coverageRows);
    const ops=new Set();
    coverageRows.forEach(r=>{const op=rowOperator(r);if(op)ops.add(op);});
    plans.forEach(r=>{const op=rowOperator(r);if(op)ops.add(op);});

    const prices=plans.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=plans.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    const byOp=new Map();
    plans.forEach(r=>{
      const op=rowOperator(r);
      if(!op) return;
      if(!byOp.has(op)) byOp.set(op,{prices:[],speeds:[]});
      const p=toNum(r.Precio_Usado_COP),s=toNum(r.Velocidad_Bajada_Mbps);
      if(p>0) byOp.get(op).prices.push(p);
      if(s>0) byOp.get(op).speeds.push(s);
    });

    const fz=fibrazoOfferForCity(scope.city);
    const operatorBestPrices=[...byOp.values()].map(x=>x.prices.length?Math.min(...x.prices):null).filter(n=>n!=null);
    const operatorMaxSpeeds=[...byOp.values()].map(x=>x.speeds.length?Math.max(...x.speeds):null).filter(n=>n!=null);
    const cheaper=fz?operatorBestPrices.filter(p=>p<fz.Precio_COP).length:0;
    const faster=fz?operatorMaxSpeeds.filter(s=>s>fz.Velocidad_Mbps).length:0;
    const operational=operationalMetrics(scope);

    return {
      coverageRows,plans,ops,fz,operational,
      minPrice:prices.length?Math.min(...prices):null,
      maxPrice:prices.length?Math.max(...prices):null,
      minSpeed:speeds.length?Math.min(...speeds):null,
      maxSpeed:speeds.length?Math.max(...speeds):null,
      cheaper,
      faster,
      pricedOperators:operatorBestPrices.length,
      speedOperators:operatorMaxSpeeds.length
    };
  }

  function percentPart(part,total){
    return total>0?Math.round(part/total*1000)/10:null;
  }

  function renderSelectionControls(options){
    const optionsRoot=$("compare-scope-options");
    const hint=$("compare-scope-hint");
    const cityFilter=$("compare-city-filter");
    const search=$("compare-search");
    if(!optionsRoot) return;

    document.querySelectorAll("[data-compare-level]").forEach(btn=>{
      const active=btn.dataset.compareLevel===state.comparison.level;
      btn.classList.toggle("active",active);
      btn.setAttribute("aria-selected",active?"true":"false");
      if(btn.dataset.boundCompareLevel!=="1"){
        btn.dataset.boundCompareLevel="1";
        btn.addEventListener("click",()=>{
          const next=btn.dataset.compareLevel==="trunk"?"trunk":"city";
          if(state.comparison.level===next) return;
          state.comparison.level=next;
          state.comparison.items.clear();
          state.comparison.search="";
          state.comparison.cityFilter="all";
          renderComparator();
        });
      }
    });

    if(search){
      search.placeholder=state.comparison.level==="trunk"?"Buscar troncal…":"Buscar ciudad…";
      if(document.activeElement!==search) search.value=state.comparison.search||"";
      if(search.dataset.boundCompareSearch!=="1"){
        search.dataset.boundCompareSearch="1";
        search.addEventListener("input",()=>{
          state.comparison.search=search.value;
          renderComparator();
          requestAnimationFrame(()=>{$("compare-search")?.focus();});
        });
      }
    }

    if(cityFilter){
      const cities=comparatorCities();
      cityFilter.classList.toggle("hidden",state.comparison.level!=="trunk");
      cityFilter.innerHTML='<option value="all">Todas las ciudades</option>'+cities.map(city=>'<option value="'+escapeHtml(city)+'">'+escapeHtml(city)+'</option>').join("");
      cityFilter.value=state.comparison.cityFilter||"all";
      if(cityFilter.dataset.boundCompareCity!=="1"){
        cityFilter.dataset.boundCompareCity="1";
        cityFilter.addEventListener("change",()=>{
          state.comparison.cityFilter=cityFilter.value||"all";
          state.comparison.search="";
          renderComparator();
        });
      }
    }

    if(hint){
      hint.textContent=state.comparison.level==="trunk"
        ?"Solo se muestran troncales con HHPP construidos. Puedes filtrar por ciudad y luego elegir dos o más."
        :"Selecciona dos o más ciudades. El comparador usa el último corte disponible de cada mercado.";
    }

    optionsRoot.innerHTML=options.map(o=>
      '<label class="compare-scope-option compare-scope-option-clean">'+
        '<input type="checkbox" data-key="'+escapeHtml(o.key)+'" '+(state.comparison.items.has(o.key)?"checked":"")+'>'+
        '<span><b>'+escapeHtml(o.label)+'</b>'+(o.level==="trunk"?'<small>'+formatNum(o.hhpp)+' HHPP</small>':"")+'</span>'+
      '</label>'
    ).join("");

    if(!options.length){
      optionsRoot.innerHTML='<div class="compare-filter-empty">No hay resultados para esta búsqueda.</div>';
    }

    optionsRoot.querySelectorAll("input[data-key]").forEach(input=>input.addEventListener("change",e=>{
      const key=e.target.dataset.key;
      if(e.target.checked) state.comparison.items.add(key); else state.comparison.items.delete(key);
      renderComparator();
    }));

    const clearBtn=$("compare-clear-selection");
    if(clearBtn&&clearBtn.dataset.boundCompareClear!=="1"){
      clearBtn.dataset.boundCompareClear="1";
      clearBtn.addEventListener("click",()=>{
        state.comparison.items.clear();
        renderComparator();
      });
    }
  }

  function resultCard(scope){
    const m=comparisonMetrics(scope),op=m.operational,fz=m.fz;
    const cheaperPct=percentPart(m.cheaper,m.pricedOperators);
    const fasterPct=percentPart(m.faster,m.speedOperators);
    const scopeType=scope.level==="trunk"?"TRONCAL":"CIUDAD";

    return '<article class="panel compare-scope-card compare-scope-card-managerial">'+
      '<div class="compare-scope-head">'+
        '<div><span>'+scopeType+'</span><h3>'+escapeHtml(scope.label)+'</h3></div>'+
        '<strong>'+formatNum(m.ops.size)+' competidores</strong>'+
      '</div>'+
      '<div class="compare-managerial-block">'+
        '<span class="compare-block-title">OPERACIÓN FIBRAZO</span>'+
        '<div class="compare-operational-grid">'+
          '<div><span>HHPP</span><b>'+(op.hhpp==null?"—":formatNum(op.hhpp))+'</b></div>'+
          '<div><span>Activos</span><b>'+(op.active==null?"—":formatNum(op.active))+'</b></div>'+
          '<div><span>Penetración</span><b>'+(op.penetration==null?"—":formatPct(op.penetration*100).replace("+",""))+'</b></div>'+
        '</div>'+
      '</div>'+
      '<div class="compare-managerial-block">'+
        '<span class="compare-block-title">MERCADO</span>'+
        '<div class="compare-market-grid">'+
          '<div><span>Precio mín.</span><b>'+formatCOP(m.minPrice)+'</b></div>'+
          '<div><span>Precio máx.</span><b>'+formatCOP(m.maxPrice)+'</b></div>'+
          '<div><span>Velocidad mín.</span><b>'+(m.minSpeed==null?"—":formatNum(m.minSpeed)+" Mbps")+'</b></div>'+
          '<div><span>Velocidad máx.</span><b>'+(m.maxSpeed==null?"—":formatNum(m.maxSpeed)+" Mbps")+'</b></div>'+
        '</div>'+
      '</div>'+
      '<div class="fibrazo-benchmark-row managerial">'+
        '<div><span>BENCHMARK FIBRAZO</span><b>'+(fz?formatCOP(fz.Precio_COP)+' · '+formatNum(fz.Velocidad_Mbps)+' Mbps':"Sin oferta normalizada")+'</b></div>'+
      '</div>'+
      '<div class="compare-signal-grid">'+
        '<div class="'+(m.cheaper>0?"alert":"ok")+'"><span>Precio</span><b>'+formatNum(m.cheaper)+' competidor'+(m.cheaper===1?"":"es")+' más barato'+(m.cheaper===1?"":"s")+'</b><small>'+(cheaperPct==null?"Sin base comparable":cheaperPct.toFixed(1).replace(".",",")+"% de operadores con precio")+'</small></div>'+
        '<div class="'+(m.faster>0?"alert":"ok")+'"><span>Velocidad</span><b>'+formatNum(m.faster)+' competidor'+(m.faster===1?"":"es")+' más rápido'+(m.faster===1?"":"s")+'</b><small>'+(fasterPct==null?"Sin base comparable":fasterPct.toFixed(1).replace(".",",")+"% de operadores con velocidad")+'</small></div>'+
      '</div>'+
    '</article>';
  }

  function renderComparator(){
    const options=comparisonScopeOptions();
    const allValid=new Set([
      ...comparatorCities().map(city=>"city|"+city+"|"+city),
      ...state.metrics.filter(r=>toNum(r.HHPP)>0&&clean(r.Ciudad)&&clean(r.Troncal_FIBRAZO)).map(r=>"trunk|"+clean(r.Ciudad)+"|"+clean(r.Troncal_FIBRAZO))
    ]);
    state.comparison.items=new Set([...state.comparison.items].filter(k=>allValid.has(k)));

    renderSelectionControls(options);

    const selectedOptions=[];
    const currentLevel=state.comparison.level;
    const selectedKeys=[...state.comparison.items];
    if(currentLevel==="city"){
      comparatorCities().forEach(city=>{
        const key="city|"+city+"|"+city;
        if(selectedKeys.includes(key)) selectedOptions.push({key,level:"city",city,value:city,label:city});
      });
    }else{
      state.metrics.forEach(r=>{
        const city=clean(r.Ciudad),trunk=clean(r.Troncal_FIBRAZO),hhpp=toNum(r.HHPP);
        if(!(hhpp>0)||!city||!trunk) return;
        const key="trunk|"+city+"|"+trunk;
        if(selectedKeys.includes(key)) selectedOptions.push({key,level:"trunk",city,value:trunk,label:city+" · "+trunk,hhpp});
      });
    }
    const uniqueSelected=[...new Map(selectedOptions.map(o=>[o.key,o])).values()]
      .sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));

    const summary=$("compare-summary"),benchmark=$("compare-benchmark"),cards=$("compare-cards");
    if(summary){
      summary.textContent=uniqueSelected.length
        ?formatNum(uniqueSelected.length)+" seleccionado"+(uniqueSelected.length===1?"":"s")
        :"Sin selección";
    }
    if(!cards) return;

    if(uniqueSelected.length<2){
      benchmark?.classList.add("hidden");
      if(benchmark) benchmark.innerHTML="";
      cards.innerHTML='<article class="panel compare-empty compare-empty-guided"><strong>Selecciona al menos 2 '+(currentLevel==="trunk"?"troncales":"ciudades")+'</strong><span>Los resultados aparecerán aquí cuando completes la selección.</span></article>';
      return;
    }

    if(benchmark){
      benchmark.classList.remove("hidden");
      benchmark.innerHTML='<div><span>RESULTADO</span><h3>Lectura comparativa</h3></div><p>'+formatNum(uniqueSelected.length)+' '+(currentLevel==="trunk"?"troncales":"ciudades")+' · FIBRAZO incluido como benchmark · filtros independientes</p>';
    }

    cards.innerHTML=uniqueSelected.map(resultCard).join("");
  }

  FZ.comparison={offerLabel,compatibleOffers,fibrazoOfferForCity,renderFibrazoComparison,comparisonScopeOptions,comparisonMetrics,renderComparator};
})();
