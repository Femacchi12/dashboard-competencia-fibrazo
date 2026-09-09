(function territoryModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,escapeHtml,toNum,formatCOP,formatNum,formatPct,rowOperator}=FZ.u;
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

  function miniStrataHtml(metric){
    const data=estratoBreakdown(metric);
    const total=data[0]?.total||0;
    if(!total) return '<span class="trunk-strata-cell empty"><span>Sin dato</span></span>';
    const segments=data.filter(x=>x.value>0).map(x=>
      '<i class="strata-segment '+x.className+'" style="width:'+Math.max(.5,x.pct*100)+'%" title="'+escapeHtml(x.label)+': '+formatNum(x.value)+' · '+(x.pct*100).toFixed(1).replace(".",",")+'%"></i>'
    ).join("");
    const dominant=[...data].sort((a,b)=>b.value-a.value)[0];
    return '<span class="trunk-strata-cell">'+
      '<span class="trunk-strata-mini">'+segments+'</span>'+
      '<small>'+escapeHtml(dominant.label)+' · '+(dominant.pct*100).toFixed(1).replace(".",",")+'%</small>'+
    '</span>';
  }

  function strataDetailHtml(metric){
    const data=estratoBreakdown(metric);
    const total=data[0]?.total||0;
    if(!total){
      return '<section class="trunk-strata-section"><div class="trunk-subhead"><div><span>DISTRIBUCIÓN HHPP</span><h4>HHPP por estrato</h4></div></div><div class="detail-empty">Sin distribución de estratos disponible para esta troncal.</div></section>';
    }

    const operational=toNum(metric?.HHPP);
    const criterion=clean(metric?.Criterio_Total_HHPP);
    const different=operational!=null&&Math.abs(operational-total)>=1;
    const note=different
      ?'<div class="trunk-strata-note '+(criterion.includes("MANTIENE")?"warn":"")+'">HHPP operativo: <b>'+formatNum(operational)+'</b> · Total usado para distribución por estrato: <b>'+formatNum(total)+'</b> · '+escapeHtml(criterion||"Criterio de conciliación aplicado")+'</div>'
      :"";

    return '<section class="trunk-strata-section">'+
      '<div class="trunk-subhead"><div><span>DISTRIBUCIÓN HHPP</span><h4>HHPP por estrato</h4></div><small>'+formatNum(total)+' HHPP clasificados</small></div>'+
      '<div class="trunk-strata-overview">'+
        '<div class="trunk-strata-stack">'+data.filter(x=>x.value>0).map(x=>
          '<i class="strata-segment '+x.className+'" style="width:'+Math.max(.5,x.pct*100)+'%" title="'+escapeHtml(x.label)+': '+formatNum(x.value)+'"></i>'
        ).join("")+'</div>'+
      '</div>'+
      '<div class="trunk-strata-grid">'+data.map(x=>
        '<article class="trunk-strata-card '+x.className+'">'+
          '<div><span>'+escapeHtml(x.label)+'</span><strong>'+formatNum(x.value)+'</strong></div>'+
          '<b>'+(x.pct==null?"—":(x.pct*100).toFixed(1).replace(".",",")+'%')+'</b>'+
          '<div class="trunk-strata-track"><i style="width:'+(x.pct==null?0:Math.max(x.value>0?2:0,x.pct*100))+'%"></i></div>'+
        '</article>'
      ).join("")+'</div>'+
      note+
    '</section>';
  }

  function renderTrunkDetail(city,trunk){
    const slot=$("fibrazo-trunk-detail");
    if(!slot) return;
    state.openTrunkKey=city+"|"+trunk;
    const metric=metricForTrunk(city,trunk);
    const competitors=competitorSummaries(city,trunk);
    const status=metric?clean(metric.Estado_Dato):"Sin métrica";
    const hhpp=metric?.HHPP;
    const active=metric?.Clientes_Activos;
    const pen=metric?.Penetracion;

    slot.classList.add("open");
    slot.innerHTML=
      '<article class="panel trunk-detail-card">'+
        '<div class="trunk-detail-head">'+
          '<div><span>TRONCAL FIBRAZO</span><h3>'+escapeHtml(trunk)+'</h3><p>'+escapeHtml(city)+' · corte operativo '+escapeHtml(metric?.Periodo_Corte||"sin dato")+'</p></div>'+
          '<button type="button" class="operator-detail-close trunk-detail-close" aria-label="Cerrar">×</button>'+
        '</div>'+
        '<div class="trunk-detail-kpis">'+
          '<div><span>HHPP</span><b>'+(hhpp==null?"—":formatNum(hhpp))+'</b></div>'+
          '<div><span>Clientes activos</span><b>'+(active==null?"—":formatNum(active))+'</b></div>'+
          '<div><span>Penetración</span><b>'+(pen==null?"—":formatPct(pen*100).replace("+",""))+'</b></div>'+
          '<div><span>Competidores relevados</span><b>'+formatNum(competitors.length)+'</b></div>'+
        '</div>'+
        '<div class="trunk-detail-status"><span>'+escapeHtml(status||"—")+'</span></div>'+
        strataDetailHtml(metric)+
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
      '</article>';

    slot.querySelector(".trunk-detail-close")?.addEventListener("click",()=>{
      slot.classList.remove("open");
      slot.innerHTML="";
      state.openTrunkKey="";
    });
    slot.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function renderFibrazo(){
    const rows=metricRows();
    const summary=$("fibrazo-network-kpis");
    const root=$("fibrazo-city-groups");
    if(!summary||!root) return;

    const total=aggregateMetrics(rows);
    summary.innerHTML=
      '<article class="panel network-kpi"><span>Troncales</span><strong>'+formatNum(total.trunks)+'</strong><small>'+formatNum(total.withData)+' con dato junio</small></article>'+
      '<article class="panel network-kpi"><span>HHPP</span><strong>'+formatNum(total.hppp)+'</strong><small>Casas posibles de conectar</small></article>'+
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
      cityRows.sort((a,b)=>clean(a.Troncal_FIBRAZO).localeCompare(clean(b.Troncal_FIBRAZO),"es",{numeric:true}));
      const m=aggregateMetrics(cityRows);
      const section=document.createElement("article");
      section.className="panel network-city-card";
      section.innerHTML=
        '<div class="network-city-head">'+
          '<div><span>CIUDAD</span><h3>'+escapeHtml(city)+'</h3></div>'+
          '<div class="network-city-summary">'+
            '<b>'+formatNum(m.trunks)+' troncales</b>'+
            '<span>'+formatNum(m.hppp)+' HHPP</span>'+
            '<span>'+formatNum(m.active)+' activos</span>'+
            '<strong>'+(m.penetration==null?"—":formatPct(m.penetration*100).replace("+",""))+'</strong>'+
          '</div>'+
        '</div>'+
        '<div class="network-trunk-table"><div class="network-trunk-header"><span>Troncal</span><span>HHPP</span><span>Activos</span><span>Penetración</span><span>Estratos</span><span>Estado</span></div>'+
        cityRows.map(r=>
          '<button type="button" class="network-trunk-row" data-city="'+escapeHtml(city)+'" data-trunk="'+escapeHtml(clean(r.Troncal_FIBRAZO))+'">'+
            '<b>'+escapeHtml(clean(r.Troncal_FIBRAZO)||"—")+'</b>'+
            '<span>'+(r.HHPP==null?"—":formatNum(r.HHPP))+'</span>'+
            '<span>'+(r.Clientes_Activos==null?"—":formatNum(r.Clientes_Activos))+'</span>'+
            '<strong>'+(r.Penetracion==null?"—":formatPct(r.Penetracion*100).replace("+",""))+'</strong>'+
            miniStrataHtml(r)+
            '<em class="'+(clean(r.Estado_Dato)==="OK"||clean(r.Estado_Dato)==="Consolidado duplicados"?"ok":"warn")+'">'+escapeHtml(clean(r.Estado_Dato)||"—")+'</em>'+
          '</button>'
        ).join("")+'</div>';
      root.appendChild(section);
    });

    root.querySelectorAll(".network-trunk-row").forEach(btn=>btn.addEventListener("click",()=>renderTrunkDetail(btn.dataset.city,btn.dataset.trunk)));
    if(!rows.length) root.innerHTML='<article class="panel compare-empty">Sin métricas FIBRAZO compatibles con las ciudades seleccionadas.</article>';
  }

  FZ.territory={renderCoverage,metricRows,metricForTrunk,trunkCompetitionRows,competitorSummaries,aggregateMetrics,renderFibrazo,renderTrunkDetail};
})();
