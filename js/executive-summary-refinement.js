(function executiveSummaryRefinement(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,normalizeTV,rowOperator}=FZ.u;
  const VERSION="20260916-03";
  let processing=false;
  let scheduled=false;

  function naturalSort(a,b){return clean(a).localeCompare(clean(b),"es",{numeric:true,sensitivity:"base"});}
  function selectedCity(){return FZ.filters?.selectedSingleCity?.()||"";}
  function validTrunk(value,city){
    const trunk=clean(value),f=fold(value);
    return !!trunk&&f!=="sin troncal validada"&&f!=="sin dato"&&f!==fold(city);
  }
  function plainPct(value){
    return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("es-CO",{maximumFractionDigits:1,minimumFractionDigits:1}).format(value)+"%";
  }
  function pct(part,total){return total>0?part/total*100:null;}

  function traditionalLabels(operators){
    const labels=[];
    const names=[...operators].map(fold);
    if(names.some(n=>n.includes("tigo"))) labels.push("Tigo");
    if(names.some(n=>n.includes("claro"))) labels.push("Claro");
    if(names.some(n=>n.includes("movistar"))) labels.push("Movistar");
    return labels;
  }

  function isSubsidized(row){
    if(row?._benchmarkExcluded==="subsidy") return true;
    return fold([row?.Modalidad,row?.Tipo_Servicio,row?.Nombre_Plan,row?.Observaciones,row?.Estado_Presencia].filter(Boolean).join(" ")).includes("subsid");
  }
  function isCurrentCommercial(row){
    if(isSubsidized(row)) return false;
    const p=toNum(row?.Precio_Usado_COP);
    if(!(p>0)) return false;
    const s=fold(row?.Estado_Vigencia);
    return !s.includes("vencid")&&!s.includes("historic")&&!s.includes("inactiv");
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
      const ad=Math.abs((toNum(a.Velocidad_Mbps)||0)-400),bd=Math.abs((toNum(b.Velocidad_Mbps)||0)-400);
      if(ad!==bd) return ad-bd;
      return (toNum(a.Precio_COP)||Infinity)-(toNum(b.Precio_COP)||Infinity);
    })[0];
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
  function cheapestCommercial(rows){
    const commercial=rows.filter(isCurrentCommercial);
    return commercial.length?[...commercial].sort((a,b)=>(toNum(a.Precio_Usado_COP)||Infinity)-(toNum(b.Precio_Usado_COP)||Infinity)||naturalSort(rowOperator(a),rowOperator(b)))[0]:null;
  }
  function subsidyOperators(rows){return [...new Set(rows.filter(isSubsidized).map(rowOperator).filter(Boolean))].sort(naturalSort);}

  function operationalTrunks(city){
    const coverage=state.filteredCoverage||[];
    const selectedTrunks=state.filters?.trunk instanceof Set?state.filters.trunk:new Set();
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
    const totalHhpp=rows.reduce((s,r)=>s+r.hhpp,0),totalActive=rows.reduce((s,r)=>s+r.active,0);
    const traditionalRows=rows.filter(r=>r.traditional.length);
    const hhppTraditional=traditionalRows.reduce((s,r)=>s+r.hhpp,0);
    return {
      rows,totalHhpp,totalActive,
      penetration:totalHhpp>0?totalActive/totalHhpp:null,
      competitionTrunks:rows.filter(r=>r.operators.length).length,
      traditionalTrunks:traditionalRows.length,
      hhppTraditional,
      hhppNoTraditional:Math.max(0,totalHhpp-hhppTraditional)
    };
  }

  function trunkExtremes(t){
    const rows=t.rows.filter(r=>Number.isFinite(r.penetration));
    const highestPen=rows.length?[...rows].sort((a,b)=>b.penetration-a.penetration||b.active-a.active)[0]:null;
    const lowestPen=rows.length?[...rows].sort((a,b)=>a.penetration-b.penetration||a.active-b.active)[0]:null;
    const mostActive=t.rows.length?[...t.rows].sort((a,b)=>b.active-a.active||b.hhpp-a.hhpp)[0]:null;
    const leastActive=t.rows.length?[...t.rows].sort((a,b)=>a.active-b.active||a.hhpp-b.hhpp)[0]:null;
    return {highestPen,lowestPen,mostActive,leastActive};
  }

  function topPresence(city){
    const map=new Map();
    (state.filteredCoverage||[]).forEach(r=>{
      const op=rowOperator(r),trunk=clean(r.Troncal_FIBRAZO);
      if(!op||!validTrunk(trunk,city)) return;
      if(!map.has(op)) map.set(op,new Set());
      map.get(op).add(trunk);
    });
    return [...map.entries()].map(([operator,trunks])=>({operator,count:trunks.size})).filter(x=>x.count>0)
      .sort((a,b)=>b.count-a.count||naturalSort(a.operator,b.operator)).slice(0,2);
  }

  function insight(label,value,detail="",tone=""){
    return '<div class="executive-insight-line '+escapeHtml(tone)+'"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong>'+(detail?'<small>'+escapeHtml(detail)+'</small>':"")+'</div>';
  }

  function managerialHtml(city){
    const rows=state.filtered||[],t=operationalTrunks(city),leaders=topPresence(city),cheapest=cheapestCommercial(rows),subsidies=subsidyOperators(rows);
    const fzInternet=benchmarkOffer(city,false),fzTv=benchmarkOffer(city,true);
    const cheaperInternet=uniqueCheaperOperators(rows,fzInternet,"internet"),cheaperTv=uniqueCheaperOperators(rows,fzTv,"tv");
    const traditionalPct=pct(t.hhppTraditional,t.totalHhpp),noTraditionalPct=pct(t.hhppNoTraditional,t.totalHhpp);
    const leaderText=leaders.length?leaders.map(x=>x.operator+" · "+formatNum(x.count)+" troncales").join(" / "):"Sin presencia territorial suficiente";
    const cheapestText=cheapest?formatCOP(toNum(cheapest.Precio_Usado_COP))+" · "+rowOperator(cheapest):"Sin tarifa comparable";
    const subsidyText=subsidies.length?"Sí · "+subsidies.join(", "):"No";
    const scopeDetail=formatNum(t.totalHhpp)+" HHPP · "+formatNum(t.totalActive)+" activos · "+plainPct(t.penetration==null?null:t.penetration*100)+" penetración";
    const traditionalDetail=formatNum(t.hhppTraditional)+" HHPP ("+plainPct(traditionalPct)+") con presencia tradicional registrada · "+formatNum(t.hhppNoTraditional)+" HHPP ("+plainPct(noTraditionalPct)+") sin presencia tradicional registrada";
    const priceDetail=cheapest?(formatNum(toNum(cheapest.Velocidad_Bajada_Mbps))+" Mbps · "+(clean(cheapest.Tipo_Servicio)||"servicio no informado")):"";
    const fzDetail=(fzInternet?formatNum(cheaperInternet.length)+" más baratos en Internet":"Sin referencia Internet")+" · "+(fzTv?formatNum(cheaperTv.length)+" más baratos en Internet + TV":"Sin referencia Internet + TV");

    return '<div class="executive-managerial-scan">'+
      insight("Escala FIBRAZO",formatNum(t.rows.length)+" troncales",scopeDetail,"primary")+
      insight("Presión territorial",formatNum(t.competitionTrunks)+" troncales con competencia",formatNum(t.traditionalTrunks)+" con Tigo, Claro o Movistar · "+traditionalDetail,"territory")+
      insight("Mayor presencia competitiva",leaderText,"Presencia registrada por troncal")+
      insight("Precio comercial más bajo",cheapestText,priceDetail,"price")+
      insight("Oferta subsidiada",subsidyText,subsidies.length?"Se mantiene fuera del benchmark comercial":"Sin subsidio registrado en el filtro")+
      insight("Frente a FIBRAZO",fzDetail,(fzInternet?"Internet ref. "+formatCOP(toNum(fzInternet.Precio_COP)):"")+(fzTv?" · TV ref. "+formatCOP(toNum(fzTv.Precio_COP)):""),"fibrazo")+
    '</div>';
  }

  function trunkHighlightsHtml(city){
    const t=operationalTrunks(city),x=trunkExtremes(t);
    const withTrad=t.rows.filter(r=>r.traditional.length),withoutTrad=t.rows.filter(r=>!r.traditional.length);
    const tradNames=withTrad.map(r=>r.trunk).join(", ")||"Ninguna";
    const noTradNames=withoutTrad.map(r=>r.trunk).join(", ")||"Ninguna";
    const summaryLine=(label,row,value)=>row?'<div><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(row.trunk)+'</strong><small>'+escapeHtml(value(row))+'</small></div>':'';
    return '<div class="executive-trunk-highlights">'+
      summaryLine("Mayor penetración",x.highestPen,r=>plainPct(r.penetration*100)+" · "+formatNum(r.active)+" activos")+
      summaryLine("Menor penetración",x.lowestPen,r=>plainPct(r.penetration*100)+" · "+formatNum(r.active)+" activos")+
      summaryLine("Más clientes activos",x.mostActive,r=>formatNum(r.active)+" activos · "+plainPct(r.penetration==null?null:r.penetration*100))+
      summaryLine("Menos clientes activos",x.leastActive,r=>formatNum(r.active)+" activos · "+plainPct(r.penetration==null?null:r.penetration*100))+
      '<div class="wide"><span>Con operadores tradicionales</span><strong>'+formatNum(withTrad.length)+' troncales</strong><small>'+escapeHtml(tradNames)+'</small></div>'+
      '<div class="wide"><span>Sin operadores tradicionales registrados</span><strong>'+formatNum(withoutTrad.length)+' troncales</strong><small>'+escapeHtml(noTradNames)+'</small></div>'+
    '</div>';
  }

  function trunkRowsHtml(city){
    const t=operationalTrunks(city);
    if(!t.rows.length) return '<div class="executive-summary-empty">Sin métricas por troncal para este alcance.</div>';
    return '<div class="executive-trunk-list">'+t.rows.map(r=>{
      const comp=r.operators.length?r.operators.join(", "):"Sin competencia territorial validada";
      const trad=r.traditional.length?r.traditional.join(", "):"Sin operador tradicional registrado";
      return '<div class="executive-trunk-row"><div class="executive-trunk-name"><strong>'+escapeHtml(r.trunk)+'</strong><span>'+formatNum(r.hhpp)+' HHPP · '+formatNum(r.active)+' activos · '+plainPct(r.penetration==null?null:r.penetration*100)+'</span></div><div class="executive-trunk-detail"><span><b>Competencia:</b> '+escapeHtml(comp)+'</span><span><b>Tradicionales:</b> '+escapeHtml(trad)+'</span></div></div>';
    }).join("")+'</div>';
  }

  function refineMarketShell(shell){
    if(!shell||shell.classList.contains("hidden")) return;
    const content=shell.querySelector(".executive-summary-content");
    if(!content||content.classList.contains("hidden")||content.dataset.refinementVersion===VERSION) return;
    const city=selectedCity();
    if(!city) return;
    const selected=shell.id==="fibrazo-city-executive-summary"?state.offers.find(o=>o.ID_Oferta===state.selectedOfferKey&&clean(o.Ciudad)===clean(city)):null;
    const selectedText=selected?'<p class="executive-fibrazo-line"><strong>Referencia FIBRAZO seleccionada:</strong> '+escapeHtml(formatCOP(toNum(selected.Precio_COP))+" · "+formatNum(toNum(selected.Velocidad_Mbps))+" Mbps · "+clean(selected.Servicio)+(normalizeTV(selected.TV)==="Sí"?" · con TV":""))+'</p>':"";

    content.innerHTML='<div class="executive-narrative refined">'+
      '<section class="executive-narrative-section executive-managerial-section"><div class="executive-section-heading"><div><span class="executive-narrative-label">LECTURA GERENCIAL</span><small>Lectura rápida del alcance seleccionado</small></div></div>'+managerialHtml(city)+selectedText+'</section>'+
      '<section class="executive-narrative-section executive-trunk-summary-section"><div class="executive-section-heading"><div><span class="executive-narrative-label">RESUMEN POR TRONCAL</span><small>Extremos operativos y presencia de operadores tradicionales</small></div></div>'+trunkHighlightsHtml(city)+'</section>'+
      '<details class="executive-trunk-disclosure"><summary><div><span class="executive-narrative-label">LECTURA POR TRONCAL</span><small>HHPP y activos: corte operativo 2026-06 · competencia: filtro/corte competitivo actual</small></div><span class="executive-disclosure-action"><b class="when-closed">Desplegar detalle</b><b class="when-open">Contraer detalle</b><i>⌄</i></span></summary><div class="executive-trunk-disclosure-body">'+trunkRowsHtml(city)+'</div></details>'+
    '</div>';
    content.dataset.refinementVersion=VERSION;
  }

  function renameDetailedBase(){
    const title=document.querySelector('.records-head h2');
    if(title&&title.textContent.trim()!=="Competencia consolidada") title.textContent="Competencia consolidada";
  }

  function refine(){
    if(processing) return;
    processing=true;
    try{
      renameDetailedBase();
      refineMarketShell(document.getElementById("general-executive-summary"));
      refineMarketShell(document.getElementById("fibrazo-city-executive-summary"));
    }finally{
      processing=false;
    }
  }

  function scheduleRefine(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;refine();});
  }

  function install(){
    const root=document.getElementById("app")||document.body;
    if(root.dataset.executiveSummaryRefinement!==VERSION){
      root.dataset.executiveSummaryRefinement=VERSION;
      new MutationObserver(()=>scheduleRefine()).observe(root,{childList:true,subtree:true});
    }
    refine();
  }

  install();
})();
