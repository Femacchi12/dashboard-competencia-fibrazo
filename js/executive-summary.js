(function executiveSummaryModule(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;
  const state=FZ.state;
  const {$,clean,fold,escapeHtml,toNum,formatCOP,formatNum,formatPct,normalizeTV,rowOperator}=FZ.u;
  const VERSION="20260916-02";

  function ensureStyles(){
    if(document.getElementById("executive-summary-css")) return;
    const link=document.createElement("link");
    link.id="executive-summary-css";
    link.rel="stylesheet";
    link.href="executive-summary.css?v="+VERSION;
    document.head.appendChild(link);
  }

  function ensureState(){
    state.executiveSummary=state.executiveSummary||{generalOpen:false,fibrazoOpen:false,compareOpen:false};
    if(!state.comparison) state.comparison={};
    if(typeof state.comparison.includeFibrazo!=="boolean") state.comparison.includeFibrazo=false;
  }

  function isSubsidized(row){
    if(row?._benchmarkExcluded==="subsidy") return true;
    return fold([row?.Modalidad,row?.Tipo_Servicio,row?.Nombre_Plan,row?.Observaciones,row?.Estado_Presencia].filter(Boolean).join(" ")).includes("subsid");
  }

  function isCurrentCommercial(row){
    if(isSubsidized(row)) return false;
    const price=toNum(row?.Precio_Usado_COP);
    if(!(price>0)) return false;
    const status=fold(row?.Estado_Vigencia);
    return !status.includes("vencid")&&!status.includes("historic")&&!status.includes("inactiv");
  }

  function planHasTv(row){return normalizeTV(row?.TV_Incluida)==="Sí"||fold(row?.Tipo_Servicio).includes("tv");}
  function planIsInternetOnly(row){
    const service=fold(row?.Tipo_Servicio);
    return normalizeTV(row?.TV_Incluida)!=="Sí"&&(service==="internet"||service.startsWith("internet solo"));
  }
  function offerHasTv(offer){return normalizeTV(offer?.TV)==="Sí"||fold(offer?.Servicio).includes("tv");}
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
    const candidates=state.offers.filter(o=>clean(o.Ciudad)===clean(city)&&toNum(o.Precio_COP)>0&&(wantsTv?offerHasTv(o):offerIsInternetOnly(o)));
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

  function selectedCity(){return FZ.filters?.selectedSingleCity?.()||"";}
  function validTrunk(value,city){
    const trunk=clean(value),f=fold(value);
    return !!trunk&&f!=="sin troncal validada"&&f!=="sin dato"&&f!==fold(city);
  }
  function naturalSort(a,b){return clean(a).localeCompare(clean(b),"es",{numeric:true,sensitivity:"base"});}

  function traditionalLabels(operators){
    const labels=[];
    const names=[...operators].map(fold);
    if(names.some(n=>n.includes("tigo"))) labels.push("Tigo");
    if(names.some(n=>n.includes("claro"))) labels.push("Claro");
    if(names.some(n=>n.includes("movistar"))) labels.push("Movistar");
    return labels;
  }

  function topPresence(rows,city){
    const map=new Map();
    rows.forEach(r=>{
      const op=rowOperator(r),trunk=clean(r.Troncal_FIBRAZO);
      if(!op||!validTrunk(trunk,city)) return;
      if(!map.has(op)) map.set(op,new Set());
      map.get(op).add(trunk);
    });
    return [...map.entries()].map(([operator,trunks])=>({operator,count:trunks.size,trunks:[...trunks].sort(naturalSort)}))
      .filter(x=>x.count>0).sort((a,b)=>b.count-a.count||naturalSort(a.operator,b.operator)).slice(0,2);
  }

  function cheapestCommercial(rows){
    const commercial=rows.filter(isCurrentCommercial);
    if(!commercial.length) return null;
    return [...commercial].sort((a,b)=>(toNum(a.Precio_Usado_COP)||Infinity)-(toNum(b.Precio_Usado_COP)||Infinity)||naturalSort(rowOperator(a),rowOperator(b)))[0];
  }

  function uniqueCheaperOperators(rows,benchmark,kind){
    const price=toNum(benchmark?.Precio_COP);
    if(!(price>0)) return [];
    const byOp=new Map();
    rows.filter(isCurrentCommercial).forEach(r=>{
      const valid=kind==="tv"?planHasTv(r):planIsInternetOnly(r);
      const p=toNum(r.Precio_Usado_COP),op=rowOperator(r);
      if(!valid||!op||!(p>0)) return;
      if(!byOp.has(op)||p<byOp.get(op)) byOp.set(op,p);
    });
    return [...byOp.entries()].filter(([,p])=>p<price).sort((a,b)=>a[1]-b[1]||naturalSort(a[0],b[0]));
  }

  function subsidyOperators(rows){return [...new Set(rows.filter(isSubsidized).map(rowOperator).filter(Boolean))].sort(naturalSort);}

  function filterScopeLabel(){
    const parts=[];
    const period=[...state.filters.period][0];
    if(period) parts.push(period);
    if(state.filters.operator.size) parts.push("Operador: "+[...state.filters.operator].join(", "));
    if(state.filters.technology.size) parts.push("Tecnología: "+[...state.filters.technology].join(", "));
    if(state.filters.trunk.size) parts.push("Troncal: "+[...state.filters.trunk].join(", "));
    return parts.join(" · ");
  }

  function operationalTrunks(city,coverage){
    const selectedTrunks=state.filters.trunk instanceof Set?state.filters.trunk:new Set();
    const grouped=new Map();
    state.metrics.filter(r=>clean(r.Ciudad)===clean(city)&&validTrunk(r.Troncal_FIBRAZO,city)&&toNum(r.HHPP)>0&&(!selectedTrunks.size||selectedTrunks.has(clean(r.Troncal_FIBRAZO))))
      .forEach(r=>{
        const trunk=clean(r.Troncal_FIBRAZO);
        if(!grouped.has(trunk)) grouped.set(trunk,{trunk,hhpp:0,active:0});
        const item=grouped.get(trunk);
        item.hhpp+=toNum(r.HHPP)||0;
        item.active+=toNum(r.Clientes_Activos)||0;
      });

    const coverageByTrunk=new Map();
    coverage.forEach(r=>{
      const trunk=clean(r.Troncal_FIBRAZO),op=rowOperator(r);
      if(!op||!validTrunk(trunk,city)||(!selectedTrunks.size||selectedTrunks.has(trunk))===false) return;
      if(!coverageByTrunk.has(trunk)) coverageByTrunk.set(trunk,new Set());
      coverageByTrunk.get(trunk).add(op);
    });

    const rows=[...grouped.values()].sort((a,b)=>naturalSort(a.trunk,b.trunk)).map(item=>{
      const operators=coverageByTrunk.get(item.trunk)||new Set();
      const traditional=traditionalLabels(operators);
      return {...item,penetration:item.hhpp>0?item.active/item.hhpp:null,operators:[...operators].sort(naturalSort),traditional};
    });

    const totalHhpp=rows.reduce((s,r)=>s+r.hhpp,0);
    const totalActive=rows.reduce((s,r)=>s+r.active,0);
    const traditionalRows=rows.filter(r=>r.traditional.length);
    const hhppTraditional=traditionalRows.reduce((s,r)=>s+r.hhpp,0);
    const activeTraditional=traditionalRows.reduce((s,r)=>s+r.active,0);
    return {
      rows,totalHhpp,totalActive,
      penetration:totalHhpp>0?totalActive/totalHhpp:null,
      competitionTrunks:rows.filter(r=>r.operators.length).length,
      traditionalTrunks:traditionalRows.length,
      hhppTraditional,
      hhppNoTraditional:Math.max(0,totalHhpp-hhppTraditional),
      activeTraditional,
      activeNoTraditional:Math.max(0,totalActive-activeTraditional)
    };
  }

  function marketSummary(city){
    const rows=state.filtered||[],coverage=state.filteredCoverage||[];
    const leaders=topPresence(coverage,city),cheapest=cheapestCommercial(rows),subsidies=subsidyOperators(rows);
    const fzInternet=benchmarkOffer(city,false),fzTv=benchmarkOffer(city,true);
    const cheaperInternet=uniqueCheaperOperators(rows,fzInternet,"internet"),cheaperTv=uniqueCheaperOperators(rows,fzTv,"tv");
    const presentOps=new Set(),pricedOps=new Set(rows.filter(isCurrentCommercial).map(rowOperator).filter(Boolean));
    coverage.forEach(r=>{const op=rowOperator(r);if(op)presentOps.add(op);});
    rows.forEach(r=>{const op=rowOperator(r);if(op)presentOps.add(op);});
    return {city,scope:filterScopeLabel(),leaders,cheapest,subsidies,fzInternet,fzTv,cheaperInternet,cheaperTv,presentOperators:presentOps.size,pricedOperators:pricedOps.size,territory:operationalTrunks(city,coverage)};
  }

  function pct(part,total){return total>0?part/total*100:null;}
  function plainPct(value){return value==null?"—":new Intl.NumberFormat("es-CO",{maximumFractionDigits:1,minimumFractionDigits:1}).format(value)+"%";}

  function sentenceSummary(summary){
    const t=summary.territory,totalTrunks=t.rows.length;
    const p=[];
    if(totalTrunks){
      p.push("El alcance comprende "+formatNum(totalTrunks)+" troncal"+(totalTrunks===1?"":"es")+" FIBRAZO, "+formatNum(t.totalHhpp)+" HHPP y "+formatNum(t.totalActive)+" clientes activos, con una penetración agregada de "+plainPct(t.penetration==null?null:t.penetration*100)+".");
      p.push("Hay competencia territorial validada en "+formatNum(t.competitionTrunks)+" de "+formatNum(totalTrunks)+" troncales.");
      p.push("Tigo, Claro o Movistar tienen presencia registrada en "+formatNum(t.traditionalTrunks)+" troncales, que concentran "+formatNum(t.hhppTraditional)+" HHPP ("+plainPct(pct(t.hhppTraditional,t.totalHhpp))+"); "+formatNum(t.hhppNoTraditional)+" HHPP ("+plainPct(pct(t.hhppNoTraditional,t.totalHhpp))+") están en troncales sin presencia tradicional registrada.");
    }else p.push("No hay métricas operativas por troncal disponibles para el alcance seleccionado.");
    if(summary.leaders.length) p.push("Los operadores con mayor presencia territorial registrada son "+summary.leaders.map(x=>x.operator+" ("+formatNum(x.count)+" troncales)").join(" y ")+".");
    if(summary.cheapest) p.push("La menor tarifa comercial comparable es "+formatCOP(toNum(summary.cheapest.Precio_Usado_COP))+" de "+rowOperator(summary.cheapest)+" ("+formatNum(toNum(summary.cheapest.Velocidad_Bajada_Mbps))+" Mbps).");
    p.push(summary.subsidies.length?"Existe oferta subsidiada registrada: "+summary.subsidies.join(", ")+"; se mantiene fuera del benchmark comercial.":"No hay oferta subsidiada registrada en el filtro actual.");
    if(summary.fzInternet) p.push(formatNum(summary.cheaperInternet.length)+" operador"+(summary.cheaperInternet.length===1?"":"es")+" tiene"+(summary.cheaperInternet.length===1?"":"n")+" Internet solo por debajo de la referencia FIBRAZO de "+formatCOP(toNum(summary.fzInternet.Precio_COP))+".");
    if(summary.fzTv) p.push(formatNum(summary.cheaperTv.length)+" operador"+(summary.cheaperTv.length===1?"":"es")+" tiene"+(summary.cheaperTv.length===1?"":"n")+" Internet + TV por debajo de la referencia FIBRAZO de "+formatCOP(toNum(summary.fzTv.Precio_COP))+".");
    return p.join(" ");
  }

  function trunkNarrativeRows(summary){
    if(!summary.territory.rows.length) return '<div class="executive-summary-empty">Sin métricas por troncal para este alcance.</div>';
    return '<div class="executive-trunk-list">'+summary.territory.rows.map(r=>{
      const comp=r.operators.length?r.operators.join(", "):"Sin competencia territorial validada";
      const trad=r.traditional.length?r.traditional.join(", "):"Sin operador tradicional registrado";
      return '<div class="executive-trunk-row"><div class="executive-trunk-name"><strong>'+escapeHtml(r.trunk)+'</strong><span>'+formatNum(r.hhpp)+' HHPP · '+formatNum(r.active)+' activos · '+plainPct(r.penetration==null?null:r.penetration*100)+'</span></div><div class="executive-trunk-detail"><span><b>Competencia:</b> '+escapeHtml(comp)+'</span><span><b>Tradicionales:</b> '+escapeHtml(trad)+'</span></div></div>';
    }).join("")+'</div>';
  }

  function marketSummaryBody(summary,mode){
    const selected=mode==="fibrazo"?selectedFibrazoOffer(summary.city):null;
    const selectedText=selected?'<p class="executive-fibrazo-line"><strong>Referencia FIBRAZO seleccionada:</strong> '+escapeHtml(formatCOP(toNum(selected.Precio_COP))+" · "+formatNum(toNum(selected.Velocidad_Mbps))+" Mbps · "+clean(selected.Servicio)+(normalizeTV(selected.TV)==="Sí"?" · con TV":""))+'</p>':"";
    return '<div class="executive-narrative"><div class="executive-narrative-section"><span class="executive-narrative-label">LECTURA GERENCIAL</span><p>'+escapeHtml(sentenceSummary(summary))+'</p>'+selectedText+'</div><div class="executive-narrative-section"><div class="executive-narrative-title"><span class="executive-narrative-label">LECTURA POR TRONCAL</span><small>HHPP y activos: corte operativo 2026-06 · competencia: filtro/corte competitivo actual</small></div>'+trunkNarrativeRows(summary)+'</div></div>';
  }

  function ensureMarketShell(mode){
    const id=mode==="general"?"general-executive-summary":"fibrazo-city-executive-summary";
    let shell=$(id);
    if(shell) return shell;
    shell=document.createElement("section");shell.id=id;shell.className="panel executive-summary-shell view-block";shell.dataset.view=mode==="general"?"general":"fibrazo";
    const anchor=mode==="general"?document.querySelector('.kpi-grid[data-view="general"]'):document.querySelector("#fibrazo-section .comparison-toolbar");
    anchor?.insertAdjacentElement("afterend",shell);
    return shell;
  }

  function renderMarketSummary(mode){
    ensureState();
    const shell=ensureMarketShell(mode),city=selectedCity();
    if(!shell) return;
    if(!city){shell.classList.add("hidden");shell.innerHTML="";return;}
    const key=mode==="general"?"generalOpen":"fibrazoOpen",open=!!state.executiveSummary[key],summary=marketSummary(city);
    shell.classList.remove("hidden");
    shell.innerHTML='<div class="executive-summary-head"><div><span>RESUMEN EJECUTIVO</span><h3>'+escapeHtml(city)+'</h3><small>'+escapeHtml(summary.scope||"Filtro actual de ciudad")+'</small></div><button type="button" class="btn small executive-summary-toggle" aria-expanded="'+(open?"true":"false")+'">'+(open?"Ocultar resumen":"Ver resumen")+'</button></div><div class="executive-summary-content '+(open?"":"hidden")+'">'+marketSummaryBody(summary,mode)+'</div>';
    shell.querySelector(".executive-summary-toggle")?.addEventListener("click",()=>{state.executiveSummary[key]=!state.executiveSummary[key];renderMarketSummary(mode);});
  }

  function selectedComparisonScopes(){
    const items=state.comparison?.items instanceof Set?[...state.comparison.items]:[];
    return items.map(key=>{
      const parts=String(key).split("|");
      if(parts.length<3) return null;
      const level=parts.shift(),city=parts.shift(),value=parts.join("|");
      if(!city||!value) return null;
      return {key,level:level==="trunk"?"trunk":"city",city,value,label:level==="trunk"?city+" · "+value:city};
    }).filter(Boolean);
  }

  function selectedComparisonPeriods(){
    const periods=state.comparison?.periods instanceof Set?[...state.comparison.periods]:[];
    return periods.sort((a,b)=>FZ.u.periodSortValue(b)-FZ.u.periodSortValue(a));
  }

  function comparisonResultItems(){
    const out=[];
    selectedComparisonScopes().forEach(scope=>selectedComparisonPeriods().forEach(period=>{const metrics=FZ.comparison?.comparisonMetrics?.(scope,period);if(metrics) out.push({scope,period,metrics});}));
    return out;
  }

  function comparisonPeriodLabel(value){if(value==="2025-06") return "Junio 2025";if(value==="2026-09") return "Septiembre 2026";return clean(value)||"Sin corte";}
  function cheapestOperatorInMetrics(m){const rows=(m?.operatorSummaries||[]).filter(x=>x.minPrice!=null);return rows.length?[...rows].sort((a,b)=>a.minPrice-b.minPrice||naturalSort(a.operator,b.operator))[0]:null;}

  function comparatorSummary(items){
    if(!items.length) return null;
    const competition=[...items].sort((a,b)=>(b.metrics?.ops?.size||0)-(a.metrics?.ops?.size||0)||naturalSort(a.scope.label,b.scope.label))[0];
    const cheapest=[...items].map(item=>({item,operator:cheapestOperatorInMetrics(item.metrics)})).filter(x=>x.operator?.minPrice!=null).sort((a,b)=>a.operator.minPrice-b.operator.minPrice)[0]||null;
    const penetrationItems=items.filter(x=>Number.isFinite(x.metrics?.operational?.penetration));
    const highestPen=penetrationItems.length?[...penetrationItems].sort((a,b)=>b.metrics.operational.penetration-a.metrics.operational.penetration)[0]:null;
    const lowestPen=penetrationItems.length?[...penetrationItems].sort((a,b)=>a.metrics.operational.penetration-b.metrics.operational.penetration)[0]:null;
    const pressure=[...items].sort((a,b)=>(b.metrics?.cheaper||0)-(a.metrics?.cheaper||0))[0];
    const parts=[];
    if(competition) parts.push(competition.scope.label+" registra la mayor cantidad de competidores ("+formatNum(competition.metrics.ops.size)+") en "+comparisonPeriodLabel(competition.period)+".");
    if(cheapest) parts.push("La tarifa mínima es "+formatCOP(cheapest.operator.minPrice)+" de "+cheapest.operator.operator+" en "+cheapest.item.scope.label+".");
    if(highestPen&&lowestPen) parts.push(highestPen.scope.key===lowestPen.scope.key?"La penetración FIBRAZO del ámbito seleccionado es "+plainPct(highestPen.metrics.operational.penetration*100)+".":"La penetración FIBRAZO va de "+plainPct(lowestPen.metrics.operational.penetration*100)+" en "+lowestPen.scope.label+" a "+plainPct(highestPen.metrics.operational.penetration*100)+" en "+highestPen.scope.label+".");
    if(state.comparison.includeFibrazo&&pressure) parts.push(pressure.scope.label+" registra "+formatNum(pressure.metrics.cheaper)+" competidor"+(pressure.metrics.cheaper===1?"":"es")+" con precio inferior a la referencia FIBRAZO.");
    return {text:parts.join(" ")};
  }

  function ensureComparatorToggle(){
    const row=document.querySelector("#compare-section .compare-step-title-row");
    if(!row) return null;
    let btn=$("compare-fibrazo-toggle");
    if(!btn){
      btn=document.createElement("button");btn.id="compare-fibrazo-toggle";btn.type="button";btn.className="btn outline small executive-fibrazo-toggle";btn.title="Incluir o quitar FIBRAZO de la comparación";
      const clear=$("compare-clear-selection");if(clear) clear.insertAdjacentElement("beforebegin",btn);else row.appendChild(btn);
      btn.addEventListener("click",()=>{ensureState();state.comparison.includeFibrazo=!state.comparison.includeFibrazo;renderComparatorEnhancements();});
    }
    btn.textContent="FIBRAZO";btn.classList.toggle("active",!!state.comparison.includeFibrazo);btn.setAttribute("aria-pressed",state.comparison.includeFibrazo?"true":"false");return btn;
  }

  function ensureCompareSummaryShell(){
    let shell=$("compare-executive-summary");if(shell) return shell;
    const anchor=$("compare-benchmark");if(!anchor) return null;
    shell=document.createElement("section");shell.id="compare-executive-summary";shell.className="panel executive-summary-shell compare-executive-summary";anchor.insertAdjacentElement("afterend",shell);return shell;
  }

  function patchComparatorFibrazoVisibility(){
    const section=$("compare-section");if(!section) return;
    section.classList.toggle("include-fibrazo",!!state.comparison.includeFibrazo);
    const p=$("compare-benchmark")?.querySelector("p");
    if(p){const base=p.textContent.replace(/\s*·\s*FIBRAZO como benchmark actual\s*$/i,"").replace(/\s*·\s*FIBRAZO incluido\s*$/i,"");p.textContent=base+(state.comparison.includeFibrazo?" · FIBRAZO incluido":"");}
  }

  function comparatorScopeRows(items){
    return '<div class="executive-compare-list">'+items.map(item=>{
      const m=item.metrics,op=m.operational,min=cheapestOperatorInMetrics(m);
      const signals=[formatNum(m.ops.size)+" competidores",min?"mín. "+formatCOP(min.minPrice)+" · "+min.operator:"sin tarifa comparable"];
      if(state.comparison.includeFibrazo) signals.push(formatNum(m.cheaper)+" más baratos que FIBRAZO");
      return '<div class="executive-compare-row"><strong>'+escapeHtml(item.scope.label)+'</strong><span>'+escapeHtml(comparisonPeriodLabel(item.period))+'</span><p>'+escapeHtml(formatNum(op.hhpp)+" HHPP · "+formatNum(op.active)+" activos · "+plainPct(op.penetration==null?null:op.penetration*100)+" penetración · "+signals.join(" · "))+'</p></div>';
    }).join("")+'</div>';
  }

  function renderComparatorSummary(){
    ensureState();const shell=ensureCompareSummaryShell();if(!shell) return;
    const items=comparisonResultItems();if(!items.length){shell.classList.add("hidden");shell.innerHTML="";return;}
    shell.classList.remove("hidden");const open=!!state.executiveSummary.compareOpen,summary=comparatorSummary(items);
    shell.innerHTML='<div class="executive-summary-head"><div><span>RESUMEN DE LA COMPARACIÓN</span><h3>Lectura gerencial</h3><small>'+formatNum(items.length)+' resultado'+(items.length===1?"":"s")+' ámbito/corte</small></div><button type="button" class="btn small executive-summary-toggle" aria-expanded="'+(open?"true":"false")+'">'+(open?"Ocultar resumen":"Ver resumen")+'</button></div><div class="executive-summary-content '+(open?"":"hidden")+'"><div class="executive-narrative"><div class="executive-narrative-section"><span class="executive-narrative-label">LECTURA GERENCIAL</span><p>'+escapeHtml(summary?.text||"Sin información suficiente para generar una lectura ejecutiva.")+'</p></div><div class="executive-narrative-section"><div class="executive-narrative-title"><span class="executive-narrative-label">ÁMBITOS COMPARADOS</span><small>Operación FIBRAZO + competencia del corte seleccionado</small></div>'+comparatorScopeRows(items)+'</div></div></div>';
    shell.querySelector(".executive-summary-toggle")?.addEventListener("click",()=>{state.executiveSummary.compareOpen=!state.executiveSummary.compareOpen;renderComparatorSummary();});
  }

  function renderComparatorEnhancements(){ensureState();ensureComparatorToggle();patchComparatorFibrazoVisibility();renderComparatorSummary();}

  function wrapFunctions(){
    if(FZ.app&&!FZ.app.__executiveSummaryWrapped){
      const original=FZ.app.renderAll;
      FZ.app.renderAll=function(...args){const result=original.apply(this,args);renderMarketSummary("general");if(state.analysisView==="fibrazo")renderMarketSummary("fibrazo");if(state.analysisView==="compare")renderComparatorEnhancements();return result;};
      FZ.app.__executiveSummaryWrapped=true;
    }
    if(FZ.comparison&&!FZ.comparison.__executiveSummaryWrapped){
      const originalFibrazo=FZ.comparison.renderFibrazoComparison,originalComparator=FZ.comparison.renderComparator;
      FZ.comparison.renderFibrazoComparison=function(...args){const result=originalFibrazo.apply(this,args);renderMarketSummary("fibrazo");return result;};
      FZ.comparison.renderComparator=function(...args){const result=originalComparator.apply(this,args);renderComparatorEnhancements();return result;};
      FZ.comparison.__executiveSummaryWrapped=true;
    }
  }

  function refresh(){ensureState();wrapFunctions();renderMarketSummary("general");if(state.analysisView==="fibrazo")renderMarketSummary("fibrazo");if(state.analysisView==="compare")renderComparatorEnhancements();}
  ensureStyles();ensureState();wrapFunctions();refresh();
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",refresh,{once:true});
})();