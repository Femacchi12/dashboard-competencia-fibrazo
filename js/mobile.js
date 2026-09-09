(function mobileModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum}=FZ.u;
  const $=FZ.u.$;

  const columns=[
    ["Periodo_Corte","Corte"],
    ["Operador","Operador"],
    ["Modalidad","Modalidad"],
    ["Plan_Referencia","Plan"],
    ["Precio_COP","Precio"],
    ["GB","GB"],
    ["Vigencia_Dias","Vigencia"],
    ["Datos_Ilimitados","Ilimitados"]
  ];

  function periodLabel(value){
    if(value==="2025-06") return "Junio 2025";
    if(value==="2026-09") return "Septiembre 2026";
    return clean(value)||"Sin corte";
  }

  function unique(rows,key){
    return [...new Set(rows.map(r=>clean(r[key])).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
  }

  function ensureDefaults(){
    const periods=unique(state.mobile,"Periodo_Corte").sort().reverse();
    if(!periods.length) return;
    if(!periods.includes(state.mobileView.period)) state.mobileView.period=periods[0];
  }

  function rowsForPeriod(){
    ensureDefaults();
    return state.mobile.filter(r=>!state.mobileView.period||clean(r.Periodo_Corte)===state.mobileView.period);
  }

  function filteredRows(){
    const v=state.mobileView;
    const q=fold(v.search);
    return state.mobile.filter(r=>{
      if(v.period&&clean(r.Periodo_Corte)!==v.period) return false;
      if(v.operator!=="all"&&clean(r.Operador)!==v.operator) return false;
      if(v.modality!=="all"&&clean(r.Modalidad)!==v.modality) return false;
      if(v.status!=="all"&&clean(r.Estado_Dato)!==v.status) return false;
      if(q&&!Object.values(r).some(value=>fold(value).includes(q))) return false;
      return true;
    });
  }

  function sortRows(rows){
    const {key,dir}=state.mobileView.sort;
    return [...rows].sort((a,b)=>{
      if(["Precio_COP","GB","Vigencia_Dias"].includes(key)){
        const an=toNum(a[key]),bn=toNum(b[key]);
        const av=an==null?(dir===1?Infinity:-Infinity):an;
        const bv=bn==null?(dir===1?Infinity:-Infinity):bn;
        return (av-bv)*dir;
      }
      return clean(a[key]).localeCompare(clean(b[key]),"es",{numeric:true,sensitivity:"base"})*dir;
    });
  }

  function optionHtml(value,label,current){
    return '<option value="'+escapeHtml(value)+'" '+(value===current?"selected":"")+'>'+escapeHtml(label)+'</option>';
  }

  function renderFilters(){
    const base=rowsForPeriod();
    const period=$("mobile-period-filter");
    const operator=$("mobile-operator-filter");
    const modality=$("mobile-modality-filter");
    const status=$("mobile-status-filter");
    const search=$("mobile-search");
    if(!period||!operator||!modality||!status||!search) return;

    const periods=unique(state.mobile,"Periodo_Corte").sort().reverse();
    period.innerHTML=periods.map(p=>optionHtml(p,periodLabel(p),state.mobileView.period)).join("");

    const ops=unique(base,"Operador");
    if(state.mobileView.operator!=="all"&&!ops.includes(state.mobileView.operator)) state.mobileView.operator="all";
    operator.innerHTML=optionHtml("all","Todos los operadores",state.mobileView.operator)+ops.map(x=>optionHtml(x,x,state.mobileView.operator)).join("");

    const mods=unique(base,"Modalidad");
    if(state.mobileView.modality!=="all"&&!mods.includes(state.mobileView.modality)) state.mobileView.modality="all";
    modality.innerHTML=optionHtml("all","Todas las modalidades",state.mobileView.modality)+mods.map(x=>optionHtml(x,x,state.mobileView.modality)).join("");

    const statuses=unique(base,"Estado_Dato");
    if(state.mobileView.status!=="all"&&!statuses.includes(state.mobileView.status)) state.mobileView.status="all";
    status.innerHTML=optionHtml("all","Todos los estados",state.mobileView.status)+statuses.map(x=>optionHtml(x,x,state.mobileView.status)).join("");

    if(document.activeElement!==search) search.value=state.mobileView.search||"";

    if(period.dataset.bound!=="1"){
      period.dataset.bound="1";
      period.addEventListener("change",()=>{
        state.mobileView.period=period.value;
        state.mobileView.operator="all";
        state.mobileView.modality="all";
        state.mobileView.status="all";
        state.mobileView.search="";
        state.mobileView.openKey="";
        render();
      });
    }
    if(operator.dataset.bound!=="1"){
      operator.dataset.bound="1";
      operator.addEventListener("change",()=>{state.mobileView.operator=operator.value;state.mobileView.openKey="";render();});
    }
    if(modality.dataset.bound!=="1"){
      modality.dataset.bound="1";
      modality.addEventListener("change",()=>{state.mobileView.modality=modality.value;state.mobileView.openKey="";render();});
    }
    if(status.dataset.bound!=="1"){
      status.dataset.bound="1";
      status.addEventListener("change",()=>{state.mobileView.status=status.value;state.mobileView.openKey="";render();});
    }
    if(search.dataset.bound!=="1"){
      search.dataset.bound="1";
      search.addEventListener("input",()=>{
        state.mobileView.search=search.value;
        state.mobileView.openKey="";
        render();
        requestAnimationFrame(()=>$("mobile-search")?.focus());
      });
    }
  }

  function statusClass(value){
    const s=clean(value).toUpperCase();
    if(/CONFIRMADO|OK|VIGENTE/.test(s)&&!/REVISAR|PENDIENTE|CONDICIONAL/.test(s)) return "ok";
    if(/VENCID|NO_USAR/.test(s)) return "bad";
    if(/REVISAR|PENDIENTE|CONDICIONAL|DINAMICO/.test(s)) return "warn";
    return "neutral";
  }

  function cellHtml(key,row){
    const value=row[key];
    if(key==="Operador"){
      const open=state.mobileView.openKey===row._key;
      return '<button type="button" class="mobile-row-trigger" data-mobile-key="'+escapeHtml(row._key)+'" aria-expanded="'+(open?"true":"false")+'"><span class="mobile-row-arrow">▸</span><b>'+escapeHtml(clean(value)||"—")+'</b></button>';
    }
    if(key==="Periodo_Corte") return escapeHtml(periodLabel(value));
    if(key==="Precio_COP") return formatCOP(toNum(value));
    if(key==="GB") return toNum(value)==null?"—":formatNum(toNum(value))+" GB";
    if(key==="Vigencia_Dias") return toNum(value)==null?"—":formatNum(toNum(value))+" días";
    if(key==="Estado_Dato") return '<span class="mobile-status '+statusClass(value)+'">'+escapeHtml(clean(value)||"—")+'</span>';
    return escapeHtml(clean(value)||"—");
  }

  function detailHtml(row){
    const items=[
      ["Fuente del corte",clean(row.Fuente_Corte)],
      ["Fecha fuente original",clean(row.Fecha_Fuente_Original)],
      ["Minutos",clean(row.Minutos)],
      ["SMS",clean(row.SMS)],
      ["Apps / beneficios",clean(row.Apps_Beneficios)],
      ["LDI / roaming",clean(row.LDI_Roaming)],
      ["Promoción / condiciones",clean(row.Promocion_Condiciones)],
      ["Fuente",clean(row.Fuente)],
      ["Fecha de consulta",clean(row.Fecha_Consulta)],
      ["Observaciones",clean(row.Observaciones)]
    ].filter(([,v])=>v);

    return '<tr class="mobile-detail-row"><td colspan="'+columns.length+'">'+
      '<div class="mobile-inline-detail">'+
        '<div class="mobile-detail-head"><div><span>DETALLE DE LA OFERTA</span><h4>'+escapeHtml(clean(row.Plan_Referencia)||"Plan móvil")+'</h4></div><b>'+escapeHtml(periodLabel(row.Periodo_Corte))+'</b></div>'+
        '<div class="mobile-detail-grid">'+items.map(([label,value])=>
          '<div class="'+(label==="Observaciones"||label==="Promoción / condiciones"?"wide":"")+'"><span>'+escapeHtml(label)+'</span><p>'+escapeHtml(value)+'</p></div>'
        ).join("")+'</div>'+
      '</div>'+
    '</td></tr>';
  }

  function renderKPIs(rows){
    const root=$("mobile-kpis");
    if(!root) return;
    const operators=new Set(rows.map(r=>clean(r.Operador)).filter(Boolean));
    const prices=rows.map(r=>toNum(r.Precio_COP)).filter(n=>n>0);
    const gb=rows.map(r=>toNum(r.GB)).filter(n=>n>0);
    const review=rows.filter(r=>/REVISAR|PENDIENTE|VENCID|CONDICIONAL/i.test(clean(r.Estado_Dato))).length;

    root.innerHTML=
      '<article class="panel mobile-kpi primary"><span>Operadores</span><strong>'+formatNum(operators.size)+'</strong><small>'+escapeHtml(periodLabel(state.mobileView.period))+'</small></article>'+
      '<article class="panel mobile-kpi"><span>Precio mínimo</span><strong>'+(prices.length?formatCOP(Math.min(...prices)):"—")+'</strong><small>Oferta con precio registrado</small></article>'+
      '<article class="panel mobile-kpi"><span>Precio máximo</span><strong>'+(prices.length?formatCOP(Math.max(...prices)):"—")+'</strong><small>Oferta con precio registrado</small></article>'+
      '<article class="panel mobile-kpi"><span>Mayor bolsa</span><strong>'+(gb.length?formatNum(Math.max(...gb))+" GB":"—")+'</strong><small>Sin contar planes ilimitados</small></article>'+
      '<article class="panel mobile-kpi warn"><span>Por revisar</span><strong>'+formatNum(review)+'</strong><small>Registros con alerta o validación pendiente</small></article>';
  }

  function renderTable(rows){
    const head=$("mobile-table-head"),body=$("mobile-table-body"),count=$("mobile-result-count");
    if(!head||!body) return;
    const sorted=sortRows(rows);
    head.innerHTML='<tr>'+columns.map(([key,label])=>
      '<th><button type="button" class="mobile-sort-btn" data-mobile-sort="'+escapeHtml(key)+'">'+escapeHtml(label)+'<span>'+(state.mobileView.sort.key===key?(state.mobileView.sort.dir===1?"▲":"▼"):"↕")+'</span></button></th>'
    ).join("")+'</tr>';

    body.innerHTML=sorted.map(row=>{
      const open=state.mobileView.openKey===row._key;
      return '<tr class="mobile-data-row '+(open?"expanded":"")+'" data-mobile-row="'+escapeHtml(row._key)+'">'+
        columns.map(([key])=>'<td>'+cellHtml(key,row)+'</td>').join("")+
      '</tr>'+(open?detailHtml(row):"");
    }).join("");

    if(!sorted.length) body.innerHTML='<tr><td colspan="'+columns.length+'" class="detail-empty">Sin ofertas compatibles con los filtros actuales.</td></tr>';
    if(count) count.textContent=formatNum(sorted.length)+" registros";

    head.querySelectorAll("[data-mobile-sort]").forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.mobileSort;
      if(state.mobileView.sort.key===key) state.mobileView.sort.dir*=-1;
      else state.mobileView.sort={key,dir:["Precio_COP","GB","Vigencia_Dias"].includes(key)?-1:1};
      render();
    }));
    body.querySelectorAll(".mobile-row-trigger").forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.mobileKey;
      state.mobileView.openKey=state.mobileView.openKey===key?"":key;
      render();
      requestAnimationFrame(()=>document.querySelector('[data-mobile-row="'+CSS.escape(key)+'"]')?.scrollIntoView({behavior:"smooth",block:"nearest"}));
    }));
  }

  function clearTransient(){
    state.mobileView.openKey="";
  }

  function render(){
    ensureDefaults();
    renderFilters();
    const rows=filteredRows();
    renderKPIs(rows);
    renderTable(rows);
  }

  FZ.mobile={render,filteredRows,clearTransient};
})();