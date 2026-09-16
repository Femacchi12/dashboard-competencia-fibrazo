(function executiveSummaryModule(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;
  const state=FZ.state;
  const {$,clean,fold,escapeHtml,toNum,formatCOP,formatNum,formatPct,normalizeTV,rowOperator}=FZ.u;

  const VERSION="20260916-01";

  function ensureStyles(){
    if(document.getElementById("executive-summary-css")) return;
    const link=document.createElement("link");
    link.id="executive-summary-css";
    link.rel="stylesheet";
    link.href="executive-summary.css?v="+VERSION;
    document.head.appendChild(link);
  }

  function ensureState(){
    state.executiveSummary=state.executiveSummary||{
      generalOpen:false,
      fibrazoOpen:false,
      compareOpen:false
    };
    if(!state.comparison) state.comparison={};
    if(typeof state.comparison.includeFibrazo!=="boolean") state.comparison.includeFibrazo=false;
  }

  function isSubsidized(row){
    if(row?._benchmarkExcluded==="subsidy") return true;
    return fold([
      row?.Modalidad,row?.Tipo_Servicio,row?.Nombre_Plan,row?.Observaciones,row?.Estado_Presencia
    ].filter(Boolean).join(" ")).includes("subsid");
  }

  function isCurrentCommercial(row){
    if(isSubsidized(row)) return false;
    const price=toNum(row?.Precio_Usado_COP);
    if(!(price>0)) return false;
    const status=fold(row?.Estado_Vigencia);
    if(status.includes("vencid")||status.includes("historic")||status.includes("inactiv")) return false;
    return true;
  }

  function planHasTv(row){
    const tv=normalizeTV(row?.TV_Incluida);
    const service=fold(row?.Tipo_Servicio);
    return tv==="Sí"||service.includes("tv");
  }

  function planIsInternetOnly(row){
    const service=fold(row?.Tipo_Servicio);
    const tv=normalizeTV(row?.TV_Incluida);
    if(tv==="Sí") return false;
    return service==="internet"||service.startsWith("internet solo");
  }

  function offerHasTv(offer){
    return normalizeTV(offer?.TV)==="Sí"||fold(offer?.Servicio).includes("tv");
  }

  function offerIsInternetOnly(offer){
    const service=fold(offer?.Servicio);
    return !offerHasTv(offer)&&(service==="internet"||service.startsWith("internet solo"));
  }

  function stageRank(offer){
    const stage=fold(offer?.Etapa_Vigencia);
    if(stage.includes("precio normal")) return 0;
    if(stage.includes("normal")) return 1;
    if(stage.includes("vigente")) return 2;
    if(stage.includes("promo")) return 3;
    return 4;
  }

  function benchmarkOffer(city,wantsTv){
    const candidates=state.offers.filter(o=>{
      if(clean(o.Ciudad)!==clean(city)||!(toNum(o.Precio_COP)>0)) return false;
      return wantsTv?offerHasTv(o):offerIsInternetOnly(o);
    });
    if(!candidates.length) return null;
    return [...candidates].sort((a,b)=>{
      const rank=stageRank(a)-stageRank(b);
      if(rank) return rank;
      const ad=Math.abs((toNum(a.Velocidad_Mbps)||0)-400);
      const bd=Math.abs((toNum(b.Velocidad_Mbps)||0)-400);
      if(ad!==bd) return ad-bd;
      return (toNum(a.Precio_COP)||Infinity)-(toNum(b.Precio_COP)||Infinity);
    })[0];
  }

  function selectedFibrazoOffer(city){
    const exact=state.offers.find(o=>o.ID_Oferta===state.selectedOfferKey&&clean(o.Ciudad)===clean(city));
    return exact||benchmarkOffer(city,false)||state.offers.find(o=>clean(o.Ciudad)===clean(city))||null;
  }

  function selectedCity(){
    return FZ.filters?.selectedSingleCity?.()||"";
  }

  function validTrunk(value,city){
    const trunk=clean(value);
    if(!trunk) return false;
    const f=fold(trunk);
    if(f==="sin troncal validada"||f==="sin dato"||f===fold(city)) return false;
    return true;
  }

  function topPresence(rows,city){
    const map=new Map();
    rows.forEach(r=>{
      const op=rowOperator(r);
      const trunk=clean(r.Troncal_FIBRAZO);
      if(!op||!validTrunk(trunk,city)) return;
      if(!map.has(op)) map.set(op,new Set());
      map.get(op).add(trunk);
    });
    return [...map.entries()]
      .map(([operator,trunks])=>({operator,count:trunks.size,trunks:[...trunks].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))}))
      .filter(x=>x.count>0)
      .sort((a,b)=>b.count-a.count||a.operator.localeCompare(b.operator,"es",{numeric:true,sensitivity:"base"}))
      .slice(0,2);
  }

  function cheapestCommercial(rows){
    const commercial=rows.filter(isCurrentCommercial);
    if(!commercial.length) return null;
    return [...commercial].sort((a,b)=>{
      const p=(toNum(a.Precio_Usado_COP)||Infinity)-(toNum(b.Precio_Usado_COP)||Infinity);
      if(p) return p;
      return rowOperator(a).localeCompare(rowOperator(b),"es",{numeric:true,sensitivity:"base"});
    })[0];
  }

  function uniqueCheaperOperators(rows,benchmark,kind){
    const price=toNum(benchmark?.Precio_COP);
    if(!(price>0)) return [];
    const byOp=new Map();
    rows.filter(isCurrentCommercial).forEach(r=>{
      const valid=kind==="tv"?planHasTv(r):planIsInternetOnly(r);
      if(!valid) return;
      const p=toNum(r.Precio_Usado_COP);
      const op=rowOperator(r);
      if(!op||!(p>0)) return;
      const current=byOp.get(op);
      if(current==null||p<current) byOp.set(op,p);
    });
    return [...byOp.entries()]
      .filter(([,p])=>p<price)
      .sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0],"es",{numeric:true,sensitivity:"base"}));
  }

  function subsidyOperators(rows){
    return [...new Set(rows.filter(isSubsidized).map(rowOperator).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
  }

  function filterScopeLabel(){
    const parts=[];
    const period=[...state.filters.period][0];
    if(period) parts.push(period);
    if(state.filters.operator.size) parts.push("Operador: "+[...state.filters.operator].join(", "));
    if(state.filters.technology.size) parts.push("Tecnología: "+[...state.filters.technology].join(", "));
    if(state.filters.trunk.size) parts.push("Troncal: "+[...state.filters.trunk].join(", "));
    return parts.join(" · ");
  }

  function formatPresenceLeaders(leaders){
    if(!leaders.length) return {
      value:"Sin dato",
      detail:"No hay presencia por troncal validada en el alcance actual."
    };
    return {
      value:leaders.map(x=>x.operator+" · "+formatNum(x.count)).join(" / "),
      detail:leaders.map(x=>x.operator+": "+x.trunks.join(", ")).join(" · ")
    };
  }

  function marketSummary(city){
    const rows=state.filtered||[];
    const coverage=state.filteredCoverage||[];
    const leaders=topPresence(coverage,city);
    const cheapest=cheapestCommercial(rows);
    const subsidies=subsidyOperators(rows);
    const fzInternet=benchmarkOffer(city,false);
    const fzTv=benchmarkOffer(city,true);
    const cheaperInternet=uniqueCheaperOperators(rows,fzInternet,"internet");
    const cheaperTv=uniqueCheaperOperators(rows,fzTv,"tv");
    const presentOps=new Set();
    coverage.forEach(r=>{const op=rowOperator(r);if(op)presentOps.add(op);});
    rows.forEach(r=>{const op=rowOperator(r);if(op)presentOps.add(op);});
    const pricedOps=new Set(rows.filter(isCurrentCommercial).map(rowOperator).filter(Boolean));
    const presence=formatPresenceLeaders(leaders);

    const cheapestDetail=cheapest
      ?[
        rowOperator(cheapest),
        formatNum(toNum(cheapest.Velocidad_Bajada_Mbps))+" Mbps",
        clean(cheapest.Tipo_Servicio)||"Servicio no informado"
      ].filter(Boolean).join(" · ")
      :"Sin tarifa comercial vigente comparable.";

    const internetRef=fzInternet
      ?formatCOP(toNum(fzInternet.Precio_COP))+" · "+formatNum(toNum(fzInternet.Velocidad_Mbps))+" Mbps"
      :"Sin referencia FIBRAZO";
    const tvRef=fzTv
      ?formatCOP(toNum(fzTv.Precio_COP))+" · "+formatNum(toNum(fzTv.Velocidad_Mbps))+" Mbps"
      :"Sin referencia FIBRAZO";

    const conclusion=[];
    if(leaders.length){
      conclusion.push("La mayor presencia territorial registrada corresponde a "+leaders.map(x=>x.operator+" ("+formatNum(x.count)+" troncales)").join(" y ")+".");
    }
    if(cheapest){
      conclusion.push("La menor tarifa comercial comparable es "+formatCOP(toNum(cheapest.Precio_Usado_COP))+" de "+rowOperator(cheapest)+".");
    }
    conclusion.push(subsidies.length
      ?"Hay oferta subsidiada registrada: "+subsidies.join(", ")+"."
      :"No hay oferta subsidiada registrada en el filtro actual.");
    if(fzInternet){
      conclusion.push(formatNum(cheaperInternet.length)+" operador"+(cheaperInternet.length===1?"":"es")+" tiene"+(cheaperInternet.length===1?"":"n")+" Internet solo por debajo de la referencia FIBRAZO.");
    }
    if(fzTv){
      conclusion.push(formatNum(cheaperTv.length)+" operador"+(cheaperTv.length===1?"":"es")+" tiene"+(cheaperTv.length===1?"":"n")+" Internet + TV por debajo de la referencia FIBRAZO.");
    }

    return {
      city,
      scope:filterScopeLabel(),
      presentOperators:presentOps.size,
      pricedOperators:pricedOps.size,
      presence,
      cheapestPrice:cheapest?formatCOP(toNum(cheapest.Precio_Usado_COP)):"—",
      cheapestDetail,
      subsidies,
      fzInternet,
      fzTv,
      cheaperInternet,
      cheaperTv,
      internetRef,
      tvRef,
      conclusion:conclusion.join(" ")
    };
  }

  function metricCard(label,value,detail,extraClass=""){
    return '<article class="executive-summary-metric '+escapeHtml(extraClass)+'">'+
      '<span>'+escapeHtml(label)+'</span>'+
      '<strong>'+escapeHtml(value)+'</strong>'+
      '<small>'+escapeHtml(detail||"")+'</small>'+
    '</article>';
  }

  function marketSummaryBody(summary,mode){
    const subsidyValue=summary.subsidies.length?"Sí · "+summary.subsidies.join(", "):"No";
    const selected=mode==="fibrazo"?selectedFibrazoOffer(summary.city):null;
    const selectedCard=selected
      ?metricCard(
        "Oferta FIBRAZO seleccionada",
        formatCOP(toNum(selected.Precio_COP)),
        [formatNum(toNum(selected.Velocidad_Mbps))+" Mbps",clean(selected.Servicio),normalizeTV(selected.TV)==="Sí"?"Con TV":"Sin TV"].filter(Boolean).join(" · "),
        "fibrazo-reference"
      )
      :"";

    return '<div class="executive-summary-grid">'+
      metricCard("Operadores en alcance",formatNum(summary.presentOperators),formatNum(summary.pricedOperators)+" con tarifa comercial comparable")+
      metricCard("Mayor presencia en troncales",summary.presence.value,summary.presence.detail,"wide")+
      metricCard("Precio comercial más bajo",summary.cheapestPrice,summary.cheapestDetail)+
      metricCard("Servicio subsidiado",subsidyValue,summary.subsidies.length?"Se mantiene fuera del benchmark comercial.":"Sin registro subsidiado en el filtro.")+
      metricCard("Más baratos que FIBRAZO · Internet",formatNum(summary.cheaperInternet.length),summary.internetRef+" · "+(summary.cheaperInternet.length?summary.cheaperInternet.map(x=>x[0]).join(", "):"Ninguno"))+
      metricCard("Más baratos que FIBRAZO · Internet + TV",formatNum(summary.cheaperTv.length),summary.tvRef+" · "+(summary.cheaperTv.length?summary.cheaperTv.map(x=>x[0]).join(", "):"Ninguno"))+
      selectedCard+
    '</div>'+
    '<div class="executive-summary-conclusion"><strong>Lectura rápida</strong><p>'+escapeHtml(summary.conclusion)+'</p></div>';
  }

  function ensureMarketShell(mode){
    const id=mode==="general"?"general-executive-summary":"fibrazo-city-executive-summary";
    let shell=$(id);
    if(shell) return shell;

    shell=document.createElement("section");
    shell.id=id;
    shell.className="panel executive-summary-shell view-block";
    shell.dataset.view=mode==="general"?"general":"fibrazo";

    if(mode==="general"){
      const anchor=document.querySelector('.kpi-grid[data-view="general"]');
      if(anchor) anchor.insertAdjacentElement("afterend",shell);
    }else{
      const toolbar=document.querySelector("#fibrazo-section .comparison-toolbar");
      if(toolbar) toolbar.insertAdjacentElement("afterend",shell);
    }
    return shell;
  }

  function renderMarketSummary(mode){
    ensureState();
    const shell=ensureMarketShell(mode);
    if(!shell) return;
    const city=selectedCity();
    if(!city){
      shell.classList.add("hidden");
      shell.innerHTML="";
      return;
    }
    const key=mode==="general"?"generalOpen":"fibrazoOpen";
    const open=!!state.executiveSummary[key];
    const summary=marketSummary(city);
    shell.classList.remove("hidden");
    shell.innerHTML=
      '<div class="executive-summary-head">'+
        '<div><span>RESUMEN EJECUTIVO</span><h3>'+escapeHtml(city)+'</h3><small>'+escapeHtml(summary.scope||"Filtro actual de ciudad")+'</small></div>'+
        '<button type="button" class="btn outline small executive-summary-toggle" aria-expanded="'+(open?"true":"false")+'">'+(open?"Ocultar resumen":"Ver resumen")+'</button>'+
      '</div>'+
      '<div class="executive-summary-content '+(open?"":"hidden")+'">'+marketSummaryBody(summary,mode)+'</div>';

    shell.querySelector(".executive-summary-toggle")?.addEventListener("click",()=>{
      state.executiveSummary[key]=!state.executiveSummary[key];
      renderMarketSummary(mode);
    });
  }

  function selectedComparisonScopes(){
    const items=state.comparison?.items instanceof Set?[...state.comparison.items]:[];
    return items.map(key=>{
      const parts=String(key).split("|");
      if(parts.length<3) return null;
      const level=parts.shift();
      const city=parts.shift();
      const value=parts.join("|");
      if(!city||!value) return null;
      return {
        key,
        level:level==="trunk"?"trunk":"city",
        city,
        value,
        label:level==="trunk"?city+" · "+value:city
      };
    }).filter(Boolean);
  }

  function selectedComparisonPeriods(){
    const periods=state.comparison?.periods instanceof Set?[...state.comparison.periods]:[];
    return periods.sort((a,b)=>FZ.u.periodSortValue(b)-FZ.u.periodSortValue(a));
  }

  function comparisonResultItems(){
    const scopes=selectedComparisonScopes();
    const periods=selectedComparisonPeriods();
    const out=[];
    scopes.forEach(scope=>periods.forEach(period=>{
      const metrics=FZ.comparison?.comparisonMetrics?.(scope,period);
      if(metrics) out.push({scope,period,metrics});
    }));
    return out;
  }

  function cheapestOperatorInMetrics(m){
    const rows=(m?.operatorSummaries||[]).filter(x=>x.minPrice!=null);
    if(!rows.length) return null;
    return [...rows].sort((a,b)=>a.minPrice-b.minPrice||a.operator.localeCompare(b.operator,"es",{numeric:true,sensitivity:"base"}))[0];
  }

  function comparisonPeriodLabel(value){
    if(value==="2025-06") return "Junio 2025";
    if(value==="2026-09") return "Septiembre 2026";
    return clean(value)||"Sin corte";
  }

  function comparatorSummary(items){
    if(!items.length) return null;

    const competition=[...items].sort((a,b)=>
      (b.metrics?.ops?.size||0)-(a.metrics?.ops?.size||0)
      ||a.scope.label.localeCompare(b.scope.label,"es",{numeric:true,sensitivity:"base"})
    )[0];

    const cheapestCandidates=items.map(item=>({
      item,
      operator:cheapestOperatorInMetrics(item.metrics)
    })).filter(x=>x.operator&&x.operator.minPrice!=null)
      .sort((a,b)=>a.operator.minPrice-b.operator.minPrice);

    const penetrationItems=items.filter(x=>Number.isFinite(x.metrics?.operational?.penetration));
    const highestPen=penetrationItems.length?[...penetrationItems].sort((a,b)=>b.metrics.operational.penetration-a.metrics.operational.penetration)[0]:null;
    const lowestPen=penetrationItems.length?[...penetrationItems].sort((a,b)=>a.metrics.operational.penetration-b.metrics.operational.penetration)[0]:null;
    const pressure=[...items].sort((a,b)=>(b.metrics?.cheaper||0)-(a.metrics?.cheaper||0))[0];

    const paragraphs=[];
    if(competition){
      paragraphs.push(competition.scope.label+" concentra "+formatNum(competition.metrics.ops.size)+" competidores en "+comparisonPeriodLabel(competition.period)+".");
    }
    if(cheapestCandidates.length){
      const c=cheapestCandidates[0];
      paragraphs.push("La tarifa mínima de la selección es "+formatCOP(c.operator.minPrice)+" de "+c.operator.operator+" en "+c.item.scope.label+".");
    }
    if(highestPen&&lowestPen){
      if(highestPen.scope.key===lowestPen.scope.key){
        paragraphs.push("La penetración FIBRAZO del ámbito seleccionado es "+formatPct(highestPen.metrics.operational.penetration*100).replace("+","")+".");
      }else{
        paragraphs.push("La penetración FIBRAZO va de "+formatPct(lowestPen.metrics.operational.penetration*100).replace("+","")+" en "+lowestPen.scope.label+" a "+formatPct(highestPen.metrics.operational.penetration*100).replace("+","")+" en "+highestPen.scope.label+".");
      }
    }
    if(state.comparison.includeFibrazo&&pressure){
      paragraphs.push(pressure.scope.label+" registra "+formatNum(pressure.metrics.cheaper)+" competidor"+(pressure.metrics.cheaper===1?"":"es")+" con precio inferior a la referencia FIBRAZO.");
    }

    return {
      competition,
      cheapest:cheapestCandidates[0]||null,
      highestPen,
      lowestPen,
      pressure,
      conclusion:paragraphs.join(" ")
    };
  }

  function ensureComparatorToggle(){
    const row=document.querySelector("#compare-section .compare-step-title-row");
    if(!row) return null;
    let btn=$("compare-fibrazo-toggle");
    if(!btn){
      btn=document.createElement("button");
      btn.id="compare-fibrazo-toggle";
      btn.type="button";
      btn.className="btn outline small executive-fibrazo-toggle";
      btn.title="Incluir o quitar FIBRAZO de la comparación";
      const clear=$("compare-clear-selection");
      if(clear) clear.insertAdjacentElement("beforebegin",btn); else row.appendChild(btn);
      btn.addEventListener("click",()=>{
        ensureState();
        state.comparison.includeFibrazo=!state.comparison.includeFibrazo;
        renderComparatorEnhancements();
      });
    }
    btn.textContent="FIBRAZO";
    btn.classList.toggle("active",!!state.comparison.includeFibrazo);
    btn.setAttribute("aria-pressed",state.comparison.includeFibrazo?"true":"false");
    return btn;
  }

  function ensureCompareSummaryShell(){
    let shell=$("compare-executive-summary");
    if(shell) return shell;
    const anchor=$("compare-benchmark");
    if(!anchor) return null;
    shell=document.createElement("section");
    shell.id="compare-executive-summary";
    shell.className="panel executive-summary-shell compare-executive-summary";
    anchor.insertAdjacentElement("afterend",shell);
    return shell;
  }

  function patchComparatorFibrazoVisibility(){
    const section=$("compare-section");
    if(!section) return;
    section.classList.toggle("include-fibrazo",!!state.comparison.includeFibrazo);

    const benchmark=$("compare-benchmark");
    if(benchmark){
      const p=benchmark.querySelector("p");
      if(p){
        const base=p.textContent
          .replace(/\s*·\s*FIBRAZO como benchmark actual\s*$/i,"")
          .replace(/\s*·\s*FIBRAZO incluido\s*$/i,"");
        p.textContent=base+(state.comparison.includeFibrazo?" · FIBRAZO incluido":"");
      }
    }
  }

  function renderComparatorSummary(){
    ensureState();
    const shell=ensureCompareSummaryShell();
    if(!shell) return;
    const items=comparisonResultItems();
    if(!items.length){
      shell.classList.add("hidden");
      shell.innerHTML="";
      return;
    }
    shell.classList.remove("hidden");
    const open=!!state.executiveSummary.compareOpen;
    const summary=comparatorSummary(items);
    const competition=summary?.competition;
    const cheapest=summary?.cheapest;
    const highest=summary?.highestPen;
    const lowest=summary?.lowestPen;
    const pressure=summary?.pressure;

    const penetrationValue=highest
      ?(lowest&&lowest.scope.key!==highest.scope.key
        ?formatPct(lowest.metrics.operational.penetration*100).replace("+","")+" → "+formatPct(highest.metrics.operational.penetration*100).replace("+","")
        :formatPct(highest.metrics.operational.penetration*100).replace("+",""))
      :"—";
    const penetrationDetail=highest
      ?(lowest&&lowest.scope.key!==highest.scope.key
        ?lowest.scope.label+" → "+highest.scope.label
        :highest.scope.label)
      :"Sin dato operativo comparable";

    const fzDetail=state.comparison.includeFibrazo
      ?(pressure?pressure.scope.label+" · "+comparisonPeriodLabel(pressure.period):"Sin base comparable")
      :"Activa FIBRAZO para sumar la referencia comercial.";

    shell.innerHTML=
      '<div class="executive-summary-head">'+
        '<div><span>RESUMEN DE LA COMPARACIÓN</span><h3>Lectura gerencial</h3><small>'+formatNum(items.length)+' resultado'+(items.length===1?"":"s")+' ámbito/corte</small></div>'+
        '<button type="button" class="btn outline small executive-summary-toggle" aria-expanded="'+(open?"true":"false")+'">'+(open?"Ocultar resumen":"Ver resumen")+'</button>'+
      '</div>'+
      '<div class="executive-summary-content '+(open?"":"hidden")+'">'+
        '<div class="executive-summary-grid">'+
          metricCard("Mayor cantidad de competidores",competition?formatNum(competition.metrics.ops.size):"—",competition?competition.scope.label+" · "+comparisonPeriodLabel(competition.period):"Sin dato")+
          metricCard("Tarifa mínima de la selección",cheapest?formatCOP(cheapest.operator.minPrice):"—",cheapest?cheapest.operator.operator+" · "+cheapest.item.scope.label:"Sin tarifa comparable")+
          metricCard("Penetración FIBRAZO",penetrationValue,penetrationDetail)+
          metricCard("Más baratos que FIBRAZO",state.comparison.includeFibrazo&&pressure?formatNum(pressure.metrics.cheaper):"—",fzDetail,"fibrazo-reference")+
        '</div>'+
        '<div class="executive-summary-conclusion"><strong>Lectura rápida</strong><p>'+escapeHtml(summary?.conclusion||"Sin información suficiente para generar una lectura ejecutiva.")+'</p></div>'+
      '</div>';

    shell.querySelector(".executive-summary-toggle")?.addEventListener("click",()=>{
      state.executiveSummary.compareOpen=!state.executiveSummary.compareOpen;
      renderComparatorSummary();
    });
  }

  function renderComparatorEnhancements(){
    ensureState();
    ensureComparatorToggle();
    patchComparatorFibrazoVisibility();
    renderComparatorSummary();
  }

  function wrapFunctions(){
    if(FZ.app&&!FZ.app.__executiveSummaryWrapped){
      const original=FZ.app.renderAll;
      FZ.app.renderAll=function(...args){
        const result=original.apply(this,args);
        renderMarketSummary("general");
        if(state.analysisView==="fibrazo") renderMarketSummary("fibrazo");
        if(state.analysisView==="compare") renderComparatorEnhancements();
        return result;
      };
      FZ.app.__executiveSummaryWrapped=true;
    }

    if(FZ.comparison&&!FZ.comparison.__executiveSummaryWrapped){
      const originalFibrazo=FZ.comparison.renderFibrazoComparison;
      const originalComparator=FZ.comparison.renderComparator;

      FZ.comparison.renderFibrazoComparison=function(...args){
        const result=originalFibrazo.apply(this,args);
        renderMarketSummary("fibrazo");
        return result;
      };

      FZ.comparison.renderComparator=function(...args){
        const result=originalComparator.apply(this,args);
        renderComparatorEnhancements();
        return result;
      };
      FZ.comparison.__executiveSummaryWrapped=true;
    }
  }

  function refresh(){
    ensureState();
    wrapFunctions();
    renderMarketSummary("general");
    if(state.analysisView==="fibrazo") renderMarketSummary("fibrazo");
    if(state.analysisView==="compare") renderComparatorEnhancements();
  }

  ensureStyles();
  ensureState();
  wrapFunctions();
  refresh();

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",refresh,{once:true});
  }
})();