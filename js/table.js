(function tableModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,linkCell,phoneCell,rowOperator}=FZ.u;
  const $=FZ.u.$;

  function matchingCoverageForPlan(r){
    const city=clean(r?.Ciudad),op=rowOperator(r),opId=clean(r?.ID_Operador),tech=clean(r?.Tecnologia),period=clean(r?.Periodo_Corte);
    let rows=state.coverage.filter(c=>{
      if(clean(c.Ciudad)!==city) return false;
      const sameOperator=opId?clean(c.ID_Operador)===opId:rowOperator(c)===op;
      if(!sameOperator) return false;
      if(tech&&clean(c.Tecnologia)&&fold(c.Tecnologia)!==fold(tech)) return false;
      return true;
    });
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

  function tableRows(){
    const q=fold(state.tableSearch);
    const valueFor=(r,k)=>k==="Troncales_Ciudad"?trunksForPlan(r):r[k];
    const rows=state.filtered.filter(r=>!q||FZ.columns.some(([k])=>fold(valueFor(r,k)).includes(q)));
    const {key,dir}=state.sort;
    return [...rows].sort((a,b)=>{
      if(key==="Periodo_Label") return (FZ.u.periodSortValue(a.Periodo_Corte)-FZ.u.periodSortValue(b.Periodo_Corte))*dir;
      if(key==="Troncales_Ciudad") return trunksForPlan(a).localeCompare(trunksForPlan(b),"es",{numeric:true})*dir;
      const an=toNum(a[key]),bn=toNum(b[key]);
      if(an!=null&&bn!=null) return (an-bn)*dir;
      return clean(a[key]).localeCompare(clean(b[key]),"es",{numeric:true})*dir;
    });
  }

  function diverseInitialRows(rows,limit=10){
    const picked=[],seenCities=new Set(),used=new Set();
    for(const r of rows){
      const city=clean(r.Ciudad)||"Sin ciudad";
      const id=clean(r.ID_Plan_Registro)||city+"|"+rowOperator(r)+"|"+picked.length;
      if(!seenCities.has(city)){
        picked.push(r);seenCities.add(city);used.add(id);
        if(picked.length>=limit) return picked;
      }
    }
    for(const r of rows){
      const id=clean(r.ID_Plan_Registro)||clean(r.Ciudad)+"|"+rowOperator(r)+"|"+picked.length;
      if(!used.has(id)){
        picked.push(r);used.add(id);
        if(picked.length>=limit) break;
      }
    }
    return picked;
  }

  function formatCell(key,value,row){
    if(key==="Troncales_Ciudad"){
      const trunks=trunksForPlan(row);
      return trunks?escapeHtml(trunks):'<span class="link-empty">—</span>';
    }
    if(key==="Grupo_Operador"){
      const op=rowOperator(row)||"—";
      return '<button type="button" class="operator-detail-trigger" data-plan-id="'+escapeHtml(clean(row?.ID_Plan_Registro))+'">'+escapeHtml(op)+'</button>';
    }
    if(FZ.linkFields.has(key)) return linkCell(value,key);
    if(FZ.phoneFields.has(key)) return phoneCell(value);
    const n=toNum(value);
    if(key==="Precio_Usado_COP") return escapeHtml(formatCOP(n));
    if(["Velocidad_Bajada_Mbps","Permanencia_Meses"].includes(key)) return n==null?escapeHtml(clean(value)||"—"):escapeHtml(formatNum(n));
    if(key==="Periodo_Label") return escapeHtml(clean(value)||"Sin corte");
    if(key==="Fecha_Mes") return escapeHtml(clean(value)||"Sin info");
    return escapeHtml(clean(value)||"—");
  }

  function render(){
    const head=$("table-head"),body=$("table-body");
    if(!head||!body) return;
    const rows=tableRows(),cols=FZ.columns.filter(([k])=>!state.hiddenColumns.has(k));

    head.innerHTML="<tr>"+cols.map(([k,l])=>'<th data-key="'+escapeHtml(k)+'">'+escapeHtml(l)+(state.sort.key===k?'<span class="sort-mark">'+(state.sort.dir===1?"▲":"▼")+"</span>":"")+"</th>").join("")+"</tr>";
    head.querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{
      const k=th.dataset.key;
      if(state.sort.key===k) state.sort.dir*=-1; else state.sort={key:k,dir:1};
      render();
    }));

    const shown=state.expanded?rows:diverseInitialRows(rows,10);
    body.innerHTML=shown.map(r=>'<tr data-plan-row="'+escapeHtml(clean(r.ID_Plan_Registro))+'">'+cols.map(([k])=>"<td>"+formatCell(k,r[k],r)+"</td>").join("")+"</tr>").join("");

    if($("table-count")){
      $("table-count").textContent=state.expanded
        ?formatNum(rows.length)+" de "+formatNum(rows.length)+" registros"
        :formatNum(shown.length)+" de "+formatNum(rows.length)+" registros · muestra inicial por ciudades";
    }
    if($("more-btn")){
      $("more-btn").textContent=state.expanded?"Ver menos":"Ver más";
      $("more-btn").style.display=rows.length>10?"inline-flex":"none";
    }
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
  }

  FZ.table={matchingCoverageForPlan,trunksForPlan,tableRows,render,renderColumns};
})();
