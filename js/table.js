(function tableModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,rowOperator,normalizeTV}=FZ.u;
  const $=FZ.u.$;

  function matchingCoverageForPlan(r){
    const city=clean(r?.Ciudad),op=rowOperator(r),opId=clean(r?.ID_Operador),tech=clean(r?.Tecnologia),period=clean(r?.Periodo_Corte);
    const key=city+"|"+(opId||op);
    let rows=state.indexes?.coverageByCityOperator?.get(key)||[];
    if(tech) rows=rows.filter(c=>!clean(c.Tecnologia)||fold(c.Tecnologia)===fold(tech));
    if(period){
      const exact=rows.filter(c=>clean(c.Periodo_Corte)===period);
      if(exact.length) rows=exact;
    }
    return rows;
  }

  function trunksForPlan(r){
    return [...new Set(matchingCoverageForPlan(r).map(c=>clean(c.Troncal_FIBRAZO)).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
      .join(" · ");
  }

  function uniq(values){
    return [...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  }

  function buildSummaryRows(){
    const groups=new Map();
    state.filtered.forEach(r=>{
      const operator=rowOperator(r);
      const city=clean(r.Ciudad);
      const technology=clean(r.Tecnologia)||"No informado";
      const period=clean(r.Periodo_Label)||"Sin corte";
      if(!operator||!city) return;
      const key=[period,operator,city,technology].join("||");
      if(!groups.has(key)) groups.set(key,{key,plans:[]});
      groups.get(key).plans.push(r);
    });

    return [...groups.values()].map(group=>{
      const plans=group.plans;
      const first=plans[0]||{};
      const prices=plans.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
      const speeds=plans.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
      const coverage=plans.flatMap(matchingCoverageForPlan);
      const services=uniq(plans.map(r=>r.Tipo_Servicio));
      const tv=uniq(plans.map(r=>normalizeTV(r.TV_Incluida)));
      return {
        _groupKey:group.key,
        _plans:plans,
        ID_Plan_Registro:clean(first.ID_Plan_Registro),
        Periodo_Label:clean(first.Periodo_Label)||"Sin corte",
        Periodo_Corte:clean(first.Periodo_Corte),
        Grupo_Operador:rowOperator(first),
        Ciudad:clean(first.Ciudad),
        Departamento:uniq(plans.map(r=>r.Departamento)).join(" · ")||"—",
        Tecnologia:clean(first.Tecnologia)||"No informado",
        Precio_Min_COP:prices.length?Math.min(...prices):null,
        Precio_Max_COP:prices.length?Math.max(...prices):null,
        Velocidad_Min_Mbps:speeds.length?Math.min(...speeds):null,
        Velocidad_Max_Mbps:speeds.length?Math.max(...speeds):null,
        Tipo_Servicio:services.join(" · ")||"—",
        TV_Incluida:tv.join(" · ")||"—",
        Troncales_Ciudad:uniq(coverage.map(r=>r.Troncal_FIBRAZO)).join(" · ")||"—"
      };
    });
  }

  function summaryMatchesSearch(r,q){
    if(!q) return true;
    if(FZ.columns.some(([k])=>fold(r[k]).includes(q))) return true;
    return r._plans.some(plan=>Object.values(plan).some(value=>fold(value).includes(q)));
  }

  function tableRows(){
    const q=fold(state.tableSearch);
    const rows=buildSummaryRows().filter(r=>summaryMatchesSearch(r,q));
    const {key,dir}=state.sort;
    return [...rows].sort((a,b)=>{
      if(key==="Periodo_Label") return (FZ.u.periodSortValue(a.Periodo_Corte)-FZ.u.periodSortValue(b.Periodo_Corte))*dir;
      const an=toNum(a[key]),bn=toNum(b[key]);
      if(an!=null&&bn!=null) return (an-bn)*dir;
      return clean(a[key]).localeCompare(clean(b[key]),"es",{numeric:true})*dir;
    });
  }

  function diverseInitialRows(rows,limit=10){
    const picked=[],seen=new Set(),used=new Set();
    for(const r of rows){
      const key=clean(r.Ciudad)+"|"+clean(r.Grupo_Operador);
      if(!seen.has(key)){
        picked.push(r);seen.add(key);used.add(r._groupKey);
        if(picked.length>=limit) return picked;
      }
    }
    for(const r of rows){
      if(!used.has(r._groupKey)){
        picked.push(r);used.add(r._groupKey);
        if(picked.length>=limit) break;
      }
    }
    return picked;
  }

  function formatCell(key,value,row){
    if(key==="Grupo_Operador"){
      const op=clean(row.Grupo_Operador)||"—";
      return '<button type="button" class="operator-detail-trigger" data-operator="'+escapeHtml(op)+'" data-city="'+escapeHtml(clean(row.Ciudad))+'" data-plan-id="'+escapeHtml(clean(row.ID_Plan_Registro))+'" aria-expanded="false"><span class="operator-toggle-arrow" aria-hidden="true">▸</span><span>'+escapeHtml(op)+'</span></button>';
    }
    if(["Precio_Min_COP","Precio_Max_COP"].includes(key)) return escapeHtml(formatCOP(toNum(value)));
    if(["Velocidad_Min_Mbps","Velocidad_Max_Mbps"].includes(key)){
      const n=toNum(value);
      return n==null?"—":escapeHtml(formatNum(n)+" Mbps");
    }
    return escapeHtml(clean(value)||"—");
  }

  function render(){
    const head=$("table-head"),body=$("table-body");
    if(!head||!body) return;
    FZ.details?.pruneTableEntries?.();
    const rows=tableRows(),cols=FZ.columns.filter(([k])=>!state.hiddenColumns.has(k));

    head.innerHTML="<tr>"+cols.map(([k,l])=>'<th data-key="'+escapeHtml(k)+'">'+escapeHtml(l)+(state.sort.key===k?'<span class="sort-mark">'+(state.sort.dir===1?"▲":"▼")+"</span>":"")+"</th>").join("")+"</tr>";
    head.querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{
      const k=th.dataset.key;
      if(state.sort.key===k) state.sort.dir*=-1; else state.sort={key:k,dir:1};
      render();
    }));

    const shown=state.expanded?rows:diverseInitialRows(rows,10);
    body.innerHTML=shown.map(r=>'<tr data-summary-key="'+escapeHtml(r._groupKey)+'">'+cols.map(([k])=>"<td>"+formatCell(k,r[k],r)+"</td>").join("")+"</tr>").join("");

    if($("table-count")){
      $("table-count").textContent=state.expanded
        ?formatNum(rows.length)+" de "+formatNum(rows.length)+" combinaciones operador × tecnología"
        :formatNum(shown.length)+" de "+formatNum(rows.length)+" combinaciones · muestra inicial por ciudades";
    }
    if($("more-btn")){
      $("more-btn").textContent=state.expanded?"Ver menos":"Ver más";
      $("more-btn").style.display=rows.length>10?"inline-flex":"none";
    }
    window.dispatchEvent(new CustomEvent("fibrazo:table-rendered"));
  }

  function renderColumns(){
    const menu=$("columns-menu");
    if(!menu) return;
    menu.innerHTML=FZ.columns.map(([k,l])=>
      '<label class="column-item"><input type="checkbox" data-key="'+escapeHtml(k)+'" '+(state.hiddenColumns.has(k)?"":"checked")+'><span>'+escapeHtml(l)+"</span></label>"
    ).join("");
    menu.querySelectorAll("input").forEach(i=>i.addEventListener("change",()=>{
      if(i.checked) state.hiddenColumns.delete(i.dataset.key); else state.hiddenColumns.add(i.dataset.key);
      render();
    }));
    window.dispatchEvent(new CustomEvent("fibrazo:columns-rendered"));
  }

  FZ.table={matchingCoverageForPlan,trunksForPlan,buildSummaryRows,tableRows,render,renderColumns};
})();