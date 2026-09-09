(function territoryModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,formatPct,rowOperator,trunkCompetitiveSummaryHtml}=FZ.u;
  const $=FZ.u.$;

  function renderCoverage(){
    const rows=state.filteredCoverage;
    if($("coverage-visible")) $("coverage-visible").textContent=formatNum(rows.length);

    const grouped=new Map();
    rows.forEach(r=>{
      const city=clean(r.Ciudad)||"No informado";
      const op=rowOperator(r)||"No informado";
      if(!grouped.has(city)) grouped.set(city,new Set());
      grouped.get(city).add(op);
    });
    const data=[...grouped.entries()].map(([city,set])=>[city,set.size]).sort((a,b)=>b[1]-a[1]);
    const totalPairs=data.reduce((s,[,n])=>s+n,0)||1;
    const root=$("coverage-ranking");
    if(root){
      root.innerHTML="";
      data.slice(0,12).forEach(([city,count])=>{
        const pct=count/totalPairs*100;
        const row=document.createElement("div");
        row.className="coverage-rank-row";
        row.innerHTML='<div class="coverage-rank-name">'+escapeHtml(city)+'</div><div class="coverage-rank-track"><span style="width:'+Math.max(3,pct)+'%"></span></div><strong>'+formatNum(count)+'</strong><b>'+pct.toFixed(1).replace(".",",")+'%</b>';
        root.appendChild(row);
      });
      if(!data.length) root.innerHTML='<span class="subtitle">Sin presencia observada compatible con los filtros.</span>';
    }

    const territoryGroups=new Map();
    rows.forEach(r=>{
      const city=clean(r.Ciudad)||"—";
      const zone=clean(r.Zona_FIBRAZO),trunk=clean(r.Troncal_FIBRAZO);
      const barrio=clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ);
      const place=[city,barrio||zone||trunk||"Nivel ciudad"].filter(Boolean).join(" · ");
      const extra=[zone?"Zona: "+zone:"",trunk?"Troncal: "+trunk:""].filter(Boolean).join(" · ");
      const key=place+"|"+extra;
      if(!territoryGroups.has(key)) territoryGroups.set(key,{place,extra,ops:new Set()});
      territoryGroups.get(key).ops.add(rowOperator(r)||"No informado");
    });

    const list=$("coverage-list");
    if(list){
      list.innerHTML="";
      [...territoryGroups.values()].sort((a,b)=>a.place.localeCompare(b.place,"es")).slice(0,80).forEach(g=>{
        const el=document.createElement("div");
        el.className="territory-group";
        el.innerHTML='<div><strong>'+escapeHtml(g.place)+'</strong>'+(g.extra?'<small>'+escapeHtml(g.extra)+'</small>':"")+'</div><p>'+[...g.ops].sort((a,b)=>a.localeCompare(b,"es")).map(escapeHtml).join(" · ")+'</p>';
        list.appendChild(el);
      });
      if(!rows.length) list.innerHTML='<span class="subtitle">Sin presencia observada compatible con los filtros.</span>';
    }
  }

  function metricRows(){
    return state.metrics.filter(r=>FZ.filters.cityScopeAllows(r.Ciudad));
  }

  function metricForTrunk(city,trunk){
    return state.indexes?.metricByCityTrunk?.get(clean(city)+"|"+clean(trunk))||null;
  }

  function selectedCoveragePeriodLabels(){
    return state.filters.period.size?new Set(state.filters.period):new Set();
  }

  function trunkCompetitionRows(city,trunk){
    const periods=selectedCoveragePeriodLabels();
    return (state.indexes?.coverageByCityTrunk?.get(clean(city)+"|"+clean(trunk))||[]).filter(r=>{
      if(periods.size&&!periods.has(clean(r.Periodo_Label))) return false;
      if(state.filters.technology.size&&!state.filters.technology.has(clean(r.Tecnologia)||"No informado")) return false;
      return true;
    });
  }

  function plansForOperator(city,operator){
    let rows=state.indexes?.plansByCityOperator?.get(clean(city)+"|"+operator)||[];
    if(state.filters.period.size){
      const exact=rows.filter(r=>state.filters.period.has(clean(r.Periodo_Label)));
      if(exact.length) rows=exact;
    }
    if(state.filters.technology.size){
      rows=rows.filter(r=>state.filters.technology.has(clean(r.Tecnologia)||"No informado"));
    }
    return rows;
  }

  function competitorSummaries(city,trunk){
    const coverage=trunkCompetitionRows(city,trunk);
    const map=new Map();
    coverage.forEach(r=>{
      const op=rowOperator(r)||"No informado";
      if(!map.has(op)) map.set(op,{operator:op,tech:new Set(),zones:new Set(),barrios:new Set(),observations:0});
      const g=map.get(op);
      if(clean(r.Tecnologia)) g.tech.add(clean(r.Tecnologia));
      if(clean(r.Zona_FIBRAZO)) g.zones.add(clean(r.Zona_FIBRAZO));
      const barrio=clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ);
      if(barrio) g.barrios.add(barrio);
      g.observations++;
    });
    return [...map.values()].map(g=>{
      const plans=plansForOperator(city,g.operator);
      const prices=plans.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
      const speeds=plans.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
      return {
        ...g,
        minPrice:prices.length?Math.min(...prices):null,
        maxSpeed:speeds.length?Math.max(...speeds):null,
        plans:plans.length
      };
    }).sort((a,b)=>a.operator.localeCompare(b.operator,"es"));
  }

  function aggregateMetrics(rows){
    const valid=rows.filter(r=>Number.isFinite(r.HHPP)&&r.HHPP>0);
    const hhpp=valid.reduce((s,r)=>s+r.HHPP,0);
    const activeForPenetration=valid.reduce((s,r)=>s+(r.Clientes_Activos||0),0);
    const active=rows.reduce((s,r)=>s+(Number.isFinite(r.Clientes_Activos)?r.Clientes_Activos:0),0);
    return {
      trunks:rows.length,
      hhpp,
      active,
      activeForPenetration,
      penetration:hhpp?activeForPenetration/hhpp:null,
      withData:rows.filter(r=>r.Filas_Fuente_Consolidadas>0).length
    };
  }

  const strataDefs=[
    ["Estrato 0","HHPP_Estrato_0","s0"],
    ["Estrato 1","HHPP_Estrato_1","s1"],
    ["Estrato 2","HHPP_Estrato_2","s2"],
    ["Estrato 3","HHPP_Estrato_3","s3"],
    ["Estrato 4","HHPP_Estrato_4","s4"],
    ["Estrato 5","HHPP_Estrato_5","s5"],
    ["Estrato 6","HHPP_Estrato_6","s6"],
    ["Sin estrato","HHPP_Sin_Estrato","sn"]
  ];

  function estratoBreakdown(metric){
    if(!metric) return [];
    const values=strataDefs.map(([label,key,className])=>({
      label,key,className,value:toNum(metric[key])??0
    }));
    const reported=toNum(metric.Total_HHPP_Estratos);
    const sum=values.reduce((s,x)=>s+x.value,0);
    const total=reported!=null&&reported>0?reported:sum;
    return values.map(x=>({...x,pct:total>0?x.value/total:null,total}));
  }

  function strataPct(metric,key){
    const row=estratoBreakdown(metric).find(x=>x.key===key);
    return row?.pct??null;
  }

  function pctLabel(value){
    return value==null?"—":(value*100).toFixed(1).replace(".",",")+"%";
  }

  function miniStrataHtml(metric){
    const data=estratoBreakdown(metric);
    const total=data[0]?.total||0;
    if(!total) return '<span class="trunk-strata-cell empty"><span>Sin dato de estratos</span></span>';
    const segments=data.filter(x=>x.value>0).map(x=>
      '<i class="strata-segment '+x.className+'" style="width:'+Math.max(.5,x.pct*100)+'%" title="'+escapeHtml(x.label)+': '+formatNum(x.value)+' · '+pctLabel(x.pct)+'"></i>'
    ).join("");
    const e1=data.find(x=>x.key==="HHPP_Estrato_1");
    const e2=data.find(x=>x.key==="HHPP_Estrato_2");
    const e3=data.find(x=>x.key==="HHPP_Estrato_3");
    return '<span class="trunk-strata-cell">'+
      '<span class="trunk-strata-mini">'+segments+'</span>'+
      '<small class="trunk-strata-summary">'+
        '<span class="e1">E1 <b>'+pctLabel(e1?.pct)+'</b></span>'+
        '<span class="e2">E2 <b>'+pctLabel(e2?.pct)+'</b></span>'+
        '<span class="e3">E3 <b>'+pctLabel(e3?.pct)+'</b></span>'+
      '</small>'+
    '</span>';
  }

  function strataDetailHtml(metric){
    const data=estratoBreakdown(metric);
    const total=data[0]?.total||0;
    if(!total){
      return '<section class="trunk-strata-section"><div class="trunk-subhead"><div><span>DISTRIBUCIÓN HHPP</span><h4>HHPP por estrato</h4></div></div><div class="detail-empty">Sin distribución de estratos disponible para esta troncal.</div></section>';
    }

    return '<section class="trunk-strata-section">'+
      '<div class="trunk-subhead"><div><span>DISTRIBUCIÓN HHPP</span><h4>HHPP por estrato</h4></div><small>'+formatNum(total)+' HHPP clasificados</small></div>'+
      '<div class="trunk-strata-overview">'+
        '<div class="trunk-strata-stack">'+data.filter(x=>x.value>0).map(x=>
          '<i class="strata-segment '+x.className+'" style="width:'+Math.max(.5,x.pct*100)+'%" title="'+escapeHtml(x.label)+': '+formatNum(x.value)+' · '+pctLabel(x.pct)+'"></i>'
        ).join("")+'</div>'+
      '</div>'+
      '<div class="trunk-strata-grid">'+data.map(x=>
        '<article class="trunk-strata-card '+x.className+'">'+
          '<div><span>'+escapeHtml(x.label)+'</span><strong>'+formatNum(x.value)+'</strong></div>'+
          '<b>'+pctLabel(x.pct)+'</b>'+
          '<div class="trunk-strata-track"><i style="width:'+(x.pct==null?0:Math.max(x.value>0?2:0,x.pct*100))+'%"></i></div>'+
        '</article>'
      ).join("")+'</div>'+
    '</section>';
  }

  function trunkDetailHtml(city,trunk){
    const metric=metricForTrunk(city,trunk);
    const competitors=competitorSummaries(city,trunk);
    const hhpp=metric?.HHPP;
    const active=metric?.Clientes_Activos;
    const pen=metric?.Penetracion;

    return '<div class="network-trunk-inline-detail">'+
      '<article class="trunk-detail-card">'+
        '<div class="trunk-detail-head">'+
          '<div><span>TRONCAL FIBRAZO</span><h3>'+escapeHtml(trunk)+'</h3><p>'+escapeHtml(city)+' · corte operativo '+escapeHtml(metric?.Periodo_Corte||"sin dato")+'</p></div>'+
        '</div>'+
        '<div class="trunk-detail-kpis three">'+
          '<div><span>HHPP</span><b>'+(hhpp==null?"—":formatNum(hhpp))+'</b></div>'+
          '<div><span>Clientes activos</span><b>'+(active==null?"—":formatNum(active))+'</b></div>'+
          '<div><span>Penetración</span><b>'+(pen==null?"—":formatPct(pen*100).replace("+",""))+'</b></div>'+
        '</div>'+
        trunkCompetitiveSummaryHtml(competitors.map(c=>c.operator),competitors.length)+
        strataDetailHtml(metric)+
        '<div class="detail-table-tools"><input type="search" class="detail-table-search trunk-detail-search" placeholder="Buscar en la tabla…" autocomplete="off"></div>'+
        '<div class="trunk-competitors-wrap">'+
          '<table class="trunk-competitors-table"><thead><tr><th>Operador</th><th>Tecnología</th><th>Zonas</th><th>Barrios</th><th>Precio mín.</th><th>Velocidad máx.</th></tr></thead>'+
          '<tbody>'+(
            competitors.length?competitors.map(c=>
              '<tr><td><strong>'+escapeHtml(c.operator)+'</strong></td>'+
              '<td>'+escapeHtml([...c.tech].join(" · ")||"—")+'</td>'+
              '<td>'+escapeHtml([...c.zones].join(" · ")||"—")+'</td>'+
              '<td>'+escapeHtml([...c.barrios].join(" · ")||"—")+'</td>'+
              '<td>'+formatCOP(c.minPrice)+'</td>'+
              '<td>'+(c.maxSpeed==null?"—":formatNum(c.maxSpeed)+" Mbps")+'</td></tr>'
            ).join(""):'<tr><td colspan="6" class="detail-empty">Sin competidores relevados para esta troncal con los filtros actuales.</td></tr>'
          )+'</tbody></table>'+
        '</div>'+
      '</article>'+
    '</div>';
  }

  function networkSearchPass(r){
    const q=fold(state.networkSearch);
    if(!q) return true;
    const values=[
      r.Ciudad,r.Troncal_FIBRAZO,r.HHPP,r.Clientes_Activos,
      r.Penetracion==null?"":(r.Penetracion*100).toFixed(1)+"%",
      pctLabel(strataPct(r,"HHPP_Estrato_1")),
      pctLabel(strataPct(r,"HHPP_Estrato_2")),
      pctLabel(strataPct(r,"HHPP_Estrato_3"))
    ];
    return values.some(v=>fold(v).includes(q));
  }

  function networkSortValue(r,key){
    if(key==="Estrato_1_Pct") return strataPct(r,"HHPP_Estrato_1");
    if(["HHPP","Clientes_Activos","Penetracion"].includes(key)) return toNum(r[key]);
    return clean(r[key]);
  }

  function sortNetworkRows(rows){
    const {key,dir}=state.networkSort||{key:"Troncal_FIBRAZO",dir:1};
    return [...rows].sort((a,b)=>{
      const av=networkSortValue(a,key),bv=networkSortValue(b,key);
      if(typeof av==="number"||typeof bv==="number"){
        const an=Number.isFinite(av)?av:(dir===1?Infinity:-Infinity);
        const bn=Number.isFinite(bv)?bv:(dir===1?Infinity:-Infinity);
        return (an-bn)*dir;
      }
      return clean(av).localeCompare(clean(bv),"es",{numeric:true,sensitivity:"base"})*dir;
    });
  }

  function networkSortMark(key){
    if(state.networkSort?.key!==key) return '<span class="network-sort-mark">↕</span>';
    return '<span class="network-sort-mark active">'+(state.networkSort.dir===1?"▲":"▼")+'</span>';
  }

  function headerButton(key,label,title=""){
    return '<button type="button" class="network-sort-btn" data-network-sort="'+escapeHtml(key)+'" '+(title?'title="'+escapeHtml(title)+'"':"")+'>'+escapeHtml(label)+networkSortMark(key)+'</button>';
  }

  function bindNetworkControls(){
    const search=$("network-search");
    if(search&&search.dataset.boundNetworkSearch!=="1"){
      search.dataset.boundNetworkSearch="1";
      search.value=state.networkSearch||"";
      search.addEventListener("input",()=>{
        state.networkSearch=search.value;
        if(state.openTrunkKey){
          const visible=metricRows().filter(networkSearchPass).some(r=>clean(r.Ciudad)+"|"+clean(r.Troncal_FIBRAZO)===state.openTrunkKey);
          if(!visible) state.openTrunkKey="";
        }
        renderFibrazo();
      });
    }
  }

  function renderTrunkDetail(city,trunk){
    const key=clean(city)+"|"+clean(trunk);
    state.openTrunkKey=state.openTrunkKey===key?"":key;
    renderFibrazo();
    requestAnimationFrame(()=>{
      const row=document.querySelector('.network-trunk-row[data-key="'+CSS.escape(key)+'"]');
      row?.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
  }

  function renderFibrazo(){
    bindNetworkControls();
    const sourceRows=metricRows();
    const rows=sourceRows.filter(networkSearchPass);
    const summary=$("fibrazo-network-kpis");
    const root=$("fibrazo-city-groups");
    if(!summary||!root) return;

    const total=aggregateMetrics(rows);
    summary.innerHTML=
      '<article class="panel network-kpi"><span>Troncales</span><strong>'+formatNum(total.trunks)+'</strong><small>'+formatNum(total.withData)+' con dato junio</small></article>'+
      '<article class="panel network-kpi"><span>HHPP</span><strong>'+formatNum(total.hhpp)+'</strong><small>Total según filtros activos</small></article>'+
      '<article class="panel network-kpi"><span>Clientes activos</span><strong>'+formatNum(total.active)+'</strong><small>Total reportado en el corte operativo</small></article>'+
      '<article class="panel network-kpi primary"><span>Penetración</span><strong>'+(total.penetration==null?"—":formatPct(total.penetration*100).replace("+",""))+'</strong><small>Ponderada por HHPP</small></article>';

    const byCity=new Map();
    rows.forEach(r=>{
      const city=clean(r.Ciudad)||"Sin ciudad";
      if(!byCity.has(city)) byCity.set(city,[]);
      byCity.get(city).push(r);
    });

    root.innerHTML="";
    [...byCity.entries()].sort((a,b)=>a[0].localeCompare(b[0],"es")).forEach(([city,cityRows])=>{
      const sortedRows=sortNetworkRows(cityRows);
      const m=aggregateMetrics(sortedRows);
      const section=document.createElement("article");
      section.className="panel network-city-card";
      section.innerHTML=
        '<div class="network-city-head">'+
          '<div><span>CIUDAD</span><h3>'+escapeHtml(city)+'</h3></div>'+
          '<div class="network-city-summary">'+
            '<b>'+formatNum(m.trunks)+' troncales</b>'+
            '<span>'+formatNum(m.hhpp)+' HHPP</span>'+
            '<span>'+formatNum(m.active)+' activos</span>'+
            '<strong>'+(m.penetration==null?"—":formatPct(m.penetration*100).replace("+",""))+'</strong>'+
          '</div>'+
        '</div>'+
        '<div class="network-trunk-table">'+
          '<div class="network-trunk-header">'+
            headerButton("Troncal_FIBRAZO","Troncal")+
            headerButton("HHPP","HHPP")+
            headerButton("Clientes_Activos","Activos")+
            headerButton("Penetracion","Penetración")+
            headerButton("Estrato_1_Pct","Estratos","Ordena por porcentaje de Estrato 1")+
          '</div>'+
          sortedRows.map(r=>{
            const trunk=clean(r.Troncal_FIBRAZO);
            const key=city+"|"+trunk;
            const open=state.openTrunkKey===key;
            return '<div class="network-trunk-item '+(open?"open":"")+'">'+
              '<button type="button" class="network-trunk-row '+(open?"expanded":"")+'" data-key="'+escapeHtml(key)+'" data-city="'+escapeHtml(city)+'" data-trunk="'+escapeHtml(trunk)+'" aria-expanded="'+(open?"true":"false")+'">'+
                '<b class="network-trunk-name"><span class="network-trunk-arrow">▸</span><span>'+escapeHtml(trunk||"—")+'</span></b>'+
                '<span>'+(r.HHPP==null?"—":formatNum(r.HHPP))+'</span>'+
                '<span>'+(r.Clientes_Activos==null?"—":formatNum(r.Clientes_Activos))+'</span>'+
                '<strong>'+(r.Penetracion==null?"—":formatPct(r.Penetracion*100).replace("+",""))+'</strong>'+
                miniStrataHtml(r)+
              '</button>'+
              (open?trunkDetailHtml(city,trunk):"")+
            '</div>';
          }).join("")+
        '</div>';
      root.appendChild(section);
    });

    root.querySelectorAll(".network-sort-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.networkSort;
      if(state.networkSort?.key===key) state.networkSort.dir*=-1;
      else state.networkSort={key,dir:key==="Troncal_FIBRAZO"?1:-1};
      renderFibrazo();
    }));

    root.querySelectorAll(".network-trunk-row").forEach(btn=>btn.addEventListener("click",()=>{
      renderTrunkDetail(btn.dataset.city,btn.dataset.trunk);
    }));
    root.querySelectorAll(".trunk-detail-search").forEach(input=>input.addEventListener("input",event=>{
      const q=(event.target.value||"").trim().toLowerCase();
      const detail=event.target.closest(".network-trunk-inline-detail");
      detail?.querySelectorAll(".trunk-competitors-table tbody tr").forEach(tr=>{
        tr.style.display=!q||tr.textContent.toLowerCase().includes(q)?"":"none";
      });
    }));

    if(!rows.length){
      root.innerHTML='<article class="panel compare-empty">Sin troncales compatibles con los filtros y la búsqueda actual.</article>';
    }
  }

  FZ.territory={renderCoverage,metricRows,metricForTrunk,trunkCompetitionRows,competitorSummaries,aggregateMetrics,renderFibrazo,renderTrunkDetail};
})();
