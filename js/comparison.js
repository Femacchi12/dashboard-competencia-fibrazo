(function comparisonModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,escapeHtml,toNum,formatCOP,formatNum,formatPct,pctVs,normalizeTV,rowOperator}=FZ.u;
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

  function comparisonBaseCoverage(){
    return state.coverage.filter(r=>{
      if(state.filters.period.size&&!state.filters.period.has(clean(r.Periodo_Label))) return false;
      if(state.filters.technology.size&&!state.filters.technology.has(clean(r.Tecnologia)||"No informado")) return false;
      return true;
    });
  }

  function comparisonBasePlans(){
    return state.plans.filter(r=>{
      if(state.filters.period.size&&!state.filters.period.has(clean(r.Periodo_Label))) return false;
      if(state.filters.technology.size&&!state.filters.technology.has(clean(r.Tecnologia)||"No informado")) return false;
      return true;
    });
  }

  function comparisonScopeOptions(){
    const level=state.comparison.level;
    const citySet=new Set(FZ.filters.comparatorCities());
    const map=new Map();
    const add=(city,value)=>{
      city=clean(city);value=clean(value);
      if(!city||!value||!citySet.has(city)) return;
      const key=level+"|"+city+"|"+value;
      if(!map.has(key)) map.set(key,{key,level,city,value,label:level==="city"?city:city+" · "+value});
    };

    if(level==="city"){
      FZ.filters.comparatorCities().forEach(city=>add(city,city));
    }else if(level==="trunk"){
      state.metrics.forEach(r=>add(r.Ciudad,r.Troncal_FIBRAZO));
      comparisonBaseCoverage().forEach(r=>add(r.Ciudad,r.Troncal_FIBRAZO));
    }else{
      const field=level==="zone"?"Zona_FIBRAZO":"Barrio";
      comparisonBaseCoverage().forEach(r=>add(r.Ciudad,clean(r[field])||(level==="barrio"?clean(r.Localidad_Comuna_UPZ):"")));
    }
    return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true}));
  }

  function scopeCoverageRows(scope){
    const rows=comparisonBaseCoverage().filter(r=>clean(r.Ciudad)===scope.city);
    if(scope.level==="city") return rows;
    const field=scope.level==="zone"?"Zona_FIBRAZO":scope.level==="trunk"?"Troncal_FIBRAZO":"Barrio";
    return rows.filter(r=>(clean(r[field])||(scope.level==="barrio"?clean(r.Localidad_Comuna_UPZ):""))===scope.value);
  }

  function scopePlanRows(scope,coverageRows){
    let rows=comparisonBasePlans().filter(r=>clean(r.Ciudad)===scope.city);
    if(scope.level==="city") return rows;
    const ops=new Set(coverageRows.map(rowOperator).filter(Boolean));
    return rows.filter(r=>ops.has(rowOperator(r)));
  }

  function median(values){
    const a=values.filter(n=>Number.isFinite(n)).sort((x,y)=>x-y);
    if(!a.length) return null;
    const mid=Math.floor(a.length/2);
    return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
  }

  function comparisonMetrics(scope){
    const coverageRows=scopeCoverageRows(scope);
    const plans=scopePlanRows(scope,coverageRows);
    const ops=new Set();
    coverageRows.forEach(r=>{const op=rowOperator(r);if(op)ops.add(op);});
    plans.forEach(r=>{const op=rowOperator(r);if(op)ops.add(op);});

    const byOp=new Map();
    plans.forEach(r=>{
      const op=rowOperator(r);
      if(!op) return;
      if(!byOp.has(op)) byOp.set(op,{prices:[],speeds:[]});
      const p=toNum(r.Precio_Usado_COP),s=toNum(r.Velocidad_Bajada_Mbps);
      if(p>0) byOp.get(op).prices.push(p);
      if(s>0) byOp.get(op).speeds.push(s);
    });

    const bestPrices=[...byOp.values()].map(x=>x.prices.length?Math.min(...x.prices):null).filter(n=>n!=null);
    const maxSpeeds=[...byOp.values()].map(x=>x.speeds.length?Math.max(...x.speeds):null).filter(n=>n!=null);
    const priceMedian=median(bestPrices),speedMedian=median(maxSpeeds);
    const fz=fibrazoOfferForCity(scope.city);
    const cheaper=fz?bestPrices.filter(p=>p<fz.Precio_COP).length:0;
    const faster=fz?maxSpeeds.filter(s=>s>fz.Velocidad_Mbps).length:0;
    const pros=[],cons=[];

    if(fz){
      const priceGap=priceMedian==null?null:pctVs(fz.Precio_COP,priceMedian);
      const speedGap=speedMedian==null?null:pctVs(fz.Velocidad_Mbps,speedMedian);
      if(priceMedian!=null&&fz.Precio_COP<=priceMedian) pros.push("Precio FIBRAZO "+(Math.abs(priceGap)<.05?"igual a":Math.abs(priceGap).toFixed(1).replace(".",",")+"% por debajo de")+" la mediana");
      if(speedMedian!=null&&fz.Velocidad_Mbps>=speedMedian) pros.push("Velocidad FIBRAZO "+(Math.abs(speedGap)<.05?"igual a":Math.abs(speedGap).toFixed(1).replace(".",",")+"% por encima de")+" la mediana");
      if(bestPrices.length&&cheaper===0) pros.push("Sin competidores más baratos (0,0%)");
      if(cheaper>0) cons.push(cheaper+" competidor"+(cheaper===1?"":"es")+" con precio menor ("+(cheaper/bestPrices.length*100).toFixed(1).replace(".",",")+"%)");
      if(faster>0) cons.push(faster+" competidor"+(faster===1?"":"es")+" con mayor velocidad ("+(faster/maxSpeeds.length*100).toFixed(1).replace(".",",")+"%)");
    }else cons.push("Sin oferta FIBRAZO normalizada para esta ciudad");

    if(!plans.length) cons.push("Oferta competitiva aún incompleta");
    if(!pros.length) pros.push("Benchmark disponible para seguimiento");
    if(!cons.length) cons.push("Sin desventaja evidente en la base actual");

    const trunkMetric=scope.level==="trunk"?FZ.territory?.metricForTrunk(scope.city,scope.value):null;
    const competitors=scope.level==="trunk"?(FZ.territory?.competitorSummaries(scope.city,scope.value)||[]):[];

    return {
      coverageRows,plans,ops,
      minPrice:bestPrices.length?Math.min(...bestPrices):null,
      medianPrice:priceMedian,
      medianSpeed:speedMedian,
      maxSpeed:maxSpeeds.length?Math.max(...maxSpeeds):null,
      fz,pros,cons,trunkMetric,competitors
    };
  }

  function renderComparator(){
    const levelEl=$("compare-level"),optionsRoot=$("compare-scope-options"),cards=$("compare-cards"),summary=$("compare-summary"),benchmark=$("compare-benchmark"),hint=$("compare-scope-hint");
    if(!levelEl||!optionsRoot||!cards) return;
    levelEl.value=state.comparison.level;

    const cities=FZ.filters.comparatorCities();
    const options=comparisonScopeOptions();
    const valid=new Set(options.map(o=>o.key));
    state.comparison.items=new Set([...state.comparison.items].filter(k=>valid.has(k)));
    let selected=[];

    if(state.comparison.level==="city"){
      state.comparison.items=new Set(options.map(o=>o.key));
      state.comparison.initialized=true;
      selected=options;
      if(hint) hint.textContent="Las ciudades se toman directamente del selector general.";
      optionsRoot.innerHTML='<div class="compare-context-card"><div><strong>Ciudades definidas por el filtro general</strong><span>'+(cities.length?cities.map(escapeHtml).join(" · "):"Sin ciudades seleccionadas")+'</span></div><small>No necesitas seleccionarlas nuevamente aquí.</small></div>';
    }else{
      if(hint) hint.textContent=state.comparison.level==="trunk"?"Selecciona dos o más troncales dentro de las ciudades activas.":"Las opciones dependen de las ciudades seleccionadas.";
      if(!state.comparison.initialized){
        options.slice(0,2).forEach(o=>state.comparison.items.add(o.key));
        state.comparison.initialized=true;
      }
      optionsRoot.innerHTML='<div class="compare-context-inline"><span>Ciudades activas:</span><b>'+(cities.length?cities.map(escapeHtml).join(" · "):"Ninguna")+'</b></div>'+
        options.map(o=>'<label class="compare-scope-option"><input type="checkbox" data-key="'+escapeHtml(o.key)+'" '+(state.comparison.items.has(o.key)?"checked":"")+'><span>'+escapeHtml(o.label)+'</span></label>').join("");
      if(!options.length) optionsRoot.innerHTML+='<span class="filter-empty">Todavía no hay ámbitos cargados para las ciudades seleccionadas.</span>';
      optionsRoot.querySelectorAll("input[data-key]").forEach(input=>input.addEventListener("change",e=>{
        const key=e.target.dataset.key;
        if(e.target.checked) state.comparison.items.add(key); else state.comparison.items.delete(key);
        renderComparator();
      }));
      selected=options.filter(o=>state.comparison.items.has(o.key));
    }

    if(summary){
      summary.textContent=selected.length>=2
        ?selected.length+(state.comparison.level==="trunk"?" troncales":" ámbitos")+" seleccionados · FIBRAZO incluido como benchmark"
        :"Selecciona al menos 2 ámbitos para comparar";
    }
    if(benchmark) benchmark.innerHTML='<strong>FIBRAZO siempre incluido</strong><span>El comparador consolida operación FIBRAZO y competencia; los porcentajes se calculan contra el benchmark correspondiente.</span>';

    if(selected.length<2){
      cards.innerHTML='<article class="panel compare-empty">Selecciona dos o más ámbitos para construir el comparativo.</article>';
      return;
    }

    cards.innerHTML=selected.map(scope=>{
      const m=comparisonMetrics(scope),fz=m.fz,tm=m.trunkMetric;
      const competitorNames=m.competitors.map(c=>c.operator);
      const operational=scope.level==="trunk"
        ?'<div class="compare-operational-grid">'+
            '<div><span>HHPP</span><b>'+(tm?.HHPP==null?"—":formatNum(tm.HHPP))+'</b></div>'+
            '<div><span>Clientes activos</span><b>'+(tm?.Clientes_Activos==null?"—":formatNum(tm.Clientes_Activos))+'</b></div>'+
            '<div><span>Penetración</span><b>'+(tm?.Penetracion==null?"—":formatPct(tm.Penetracion*100).replace("+",""))+'</b></div>'+
            '<div><span>Estado dato</span><b>'+escapeHtml(clean(tm?.Estado_Dato)||"Sin dato")+'</b></div>'+
          '</div>'
        :"";

      return '<article class="panel compare-scope-card">'+
        '<div class="compare-scope-head"><div><span>'+escapeHtml(scope.level.toUpperCase())+'</span><h3>'+escapeHtml(scope.label)+'</h3></div><strong>'+formatNum(m.ops.size)+' competidores</strong></div>'+
        operational+
        '<div class="compare-scope-kpis">'+
          '<div><span>Precio mín.</span><b>'+formatCOP(m.minPrice)+'</b></div>'+
          '<div><span>Mediana mín.</span><b>'+formatCOP(m.medianPrice)+'</b></div>'+
          '<div><span>Velocidad máx.</span><b>'+(m.maxSpeed==null?"—":formatNum(m.maxSpeed)+" Mbps")+'</b></div>'+
        '</div>'+
        (scope.level==="trunk"?'<div class="compare-competitor-strip"><span>Competidores</span><b>'+escapeHtml(competitorNames.join(" · ")||"Sin relevamientos")+'</b></div>':"")+
        '<div class="fibrazo-benchmark-row"><span>FIBRAZO</span><b>'+(fz?formatCOP(fz.Precio_COP)+" · "+formatNum(fz.Velocidad_Mbps)+" Mbps"+(m.medianPrice!=null?" · Precio vs mediana "+formatPct(pctVs(fz.Precio_COP,m.medianPrice)):"")+(m.medianSpeed!=null?" · Velocidad vs mediana "+formatPct(pctVs(fz.Velocidad_Mbps,m.medianSpeed)):""):"Sin oferta compatible")+'</b></div>'+
        '<div class="compare-procon"><div class="pro"><b>Pros FIBRAZO</b><span>'+m.pros.map(escapeHtml).join(" · ")+'</span></div><div class="con"><b>Alertas</b><span>'+m.cons.map(escapeHtml).join(" · ")+'</span></div></div>'+
      '</article>';
    }).join("");
  }

  FZ.comparison={offerLabel,compatibleOffers,fibrazoOfferForCity,renderFibrazoComparison,comparisonScopeOptions,comparisonMetrics,renderComparator};
})();
