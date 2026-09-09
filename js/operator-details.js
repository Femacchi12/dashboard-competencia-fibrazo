(function detailsModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,safeUrl,rowOperator,normalizeTV}=FZ.u;

  function exactPeriodRows(rows,period){
    if(!period) return rows;
    const exact=rows.filter(r=>clean(r.Periodo_Corte)===period);
    return exact.length?exact:rows;
  }

  function detailData(operator,city,planId){
    const reference=state.plans.find(r=>clean(r.ID_Plan_Registro)===clean(planId))||null;
    const period=clean(reference?.Periodo_Corte)||FZ.filters.selectedPeriodValue();
    let plans=state.indexes?.plansByCityOperator?.get(city+"|"+operator)||[];
    plans=exactPeriodRows(plans,period).sort((a,b)=>(toNum(a.Precio_Usado_COP)??Infinity)-(toNum(b.Precio_Usado_COP)??Infinity));
    const opId=clean(reference?.ID_Operador)||clean(plans[0]?.ID_Operador);
    let coverage=state.indexes?.coverageByCityOperator?.get(city+"|"+(opId||operator))||[];
    coverage=exactPeriodRows(coverage,period);

    const meta=state.operators.find(o=>opId&&clean(o.ID_Operador)===opId)
      ||state.operators.find(o=>fold(clean(o.Operador_Normalizado)||clean(o.Marca_Comercial))===fold(operator))
      ||{};
    return {reference,period,plans,coverage,meta};
  }

  function uniq(values){
    return [...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  }

  function clear(){
    document.querySelectorAll(".operator-detail-row").forEach(el=>el.remove());
    const slot=document.getElementById("chart-operator-detail-slot");
    if(slot){slot.innerHTML="";slot.classList.remove("open");}
  }

  function planRowsHtml(plans){
    if(!plans.length) return '<tr><td colspan="9" class="detail-empty">Sin planes normalizados para este corte.</td></tr>';
    return plans.map(r=>{
      const used=toNum(r.Precio_Usado_COP),regular=toNum(r.Precio_Regular_COP),promo=toNum(r.Precio_Promocional_COP);
      return "<tr>"+
        "<td>"+escapeHtml(clean(r.Nombre_Plan)||clean(r.Tipo_Servicio)||"Plan")+"</td>"+
        "<td>"+escapeHtml(clean(r.Tipo_Servicio)||"—")+"</td>"+
        "<td>"+escapeHtml(toNum(r.Velocidad_Bajada_Mbps)==null?"—":formatNum(toNum(r.Velocidad_Bajada_Mbps))+" Mbps")+"</td>"+
        "<td><strong>"+escapeHtml(formatCOP(used))+"</strong></td>"+
        "<td>"+escapeHtml(formatCOP(regular))+"</td>"+
        "<td>"+escapeHtml(formatCOP(promo))+"</td>"+
        "<td>"+escapeHtml(clean(r.Modalidad)||"—")+"</td>"+
        "<td>"+escapeHtml(normalizeTV(r.TV_Incluida))+"</td>"+
        "<td>"+escapeHtml(clean(r.Permanencia_Meses)||"—")+"</td>"+
      "</tr>";
    }).join("");
  }

  function panelHtml(operator,city,planId){
    const d=detailData(operator,city,planId);
    const prices=d.plans.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=d.plans.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    const trunks=uniq(d.coverage.map(r=>r.Troncal_FIBRAZO));
    const zones=uniq(d.coverage.map(r=>r.Zona_FIBRAZO));
    const barrios=uniq(d.coverage.map(r=>clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ)));
    const services=uniq(d.plans.map(r=>r.Tipo_Servicio));
    const technologies=uniq(d.plans.map(r=>r.Tecnologia));
    const outside=d.coverage.filter(r=>!clean(r.Troncal_FIBRAZO)).length;
    const periodLabel=clean(d.reference?.Periodo_Label)||clean(d.period)||"Corte actual";
    const phones=uniq([d.meta.Telefono_1,d.meta.Telefono_2,d.meta.Telefono_3,d.meta.Telefono_4,d.meta.Telefono_5]);
    const web=safeUrl(d.meta.Sitio_Web,"Sitio_Web");

    let html='<article class="operator-detail-card panel">';
    html+='<div class="operator-detail-head"><div><span>DETALLE DEL OPERADOR</span><h3>'+escapeHtml(operator)+'</h3><p>'+escapeHtml(city)+' · '+escapeHtml(periodLabel)+'</p></div><button type="button" class="operator-detail-close" aria-label="Cerrar detalle">×</button></div>';
    html+='<div class="operator-detail-kpis">';
    html+='<div><span>Planes</span><b>'+formatNum(d.plans.length)+'</b></div>';
    html+='<div><span>Precio</span><b>'+(prices.length?escapeHtml(formatCOP(Math.min(...prices))+" – "+formatCOP(Math.max(...prices))):"—")+'</b></div>';
    html+='<div><span>Velocidad</span><b>'+(speeds.length?escapeHtml(formatNum(Math.min(...speeds))+" – "+formatNum(Math.max(...speeds))+" Mbps"):"—")+'</b></div>';
    html+='<div><span>Troncales</span><b>'+(trunks.length?escapeHtml(trunks.join(" · ")):"Fuera de troncal / sin dato")+'</b></div>';
    html+='</div>';
    html+='<div class="operator-detail-tags">';
    html+='<span><b>Servicio:</b> '+escapeHtml(services.join(" · ")||"—")+'</span>';
    html+='<span><b>Tecnología:</b> '+escapeHtml(technologies.join(" · ")||"—")+'</span>';
    html+='<span><b>Barrios:</b> '+escapeHtml(barrios.join(" · ")||"—")+'</span>';
    html+='<span><b>Zonas:</b> '+escapeHtml(zones.join(" · ")||"—")+'</span>';
    if(outside) html+='<span class="detail-warning"><b>Fuera de troncal:</b> '+formatNum(outside)+' registros territoriales</span>';
    html+='</div>';
    html+='<div class="operator-detail-table-wrap"><table class="operator-detail-table"><thead><tr><th>Plan</th><th>Servicio</th><th>Velocidad</th><th>Precio usado</th><th>Regular</th><th>Promo</th><th>Modalidad</th><th>TV</th><th>Permanencia</th></tr></thead><tbody>'+planRowsHtml(d.plans)+'</tbody></table></div>';
    html+='<div class="operator-detail-footer"><div class="operator-detail-contact">';
    if(phones.length) html+='<span>Tel. '+phones.map(escapeHtml).join(" · ")+'</span>';
    if(web) html+='<a href="'+escapeHtml(web)+'" target="_blank" rel="noopener noreferrer">Web ↗</a>';
    html+='</div><button type="button" class="btn primary detail-compare-btn">Comparar con FIBRAZO →</button></div>';
    html+='</article>';
    return html;
  }

  function bindPanel(root,operator,city){
    root.querySelector(".operator-detail-close")?.addEventListener("click",clear);
    root.querySelector(".detail-compare-btn")?.addEventListener("click",()=>{
      clear();
      FZ.app?.compareWithFibrazo?.(operator,city);
    });
  }

  function open({operator,city,planId="",mode="chart",row=null}){
    if(!operator||!city) return;
    clear();
    const html=panelHtml(operator,city,planId);
    if(mode==="table"&&row){
      const detailRow=document.createElement("tr");
      detailRow.className="operator-detail-row";
      const td=document.createElement("td");
      td.colSpan=document.querySelectorAll("#table-head th").length||24;
      td.innerHTML=html;
      detailRow.appendChild(td);
      row.after(detailRow);
      bindPanel(detailRow,operator,city);
      detailRow.scrollIntoView({behavior:"smooth",block:"nearest"});
      return;
    }
    const slot=document.getElementById("chart-operator-detail-slot");
    if(!slot) return;
    slot.innerHTML=html;
    slot.classList.add("open");
    bindPanel(slot,operator,city);
    slot.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function chooser(candidates){
    clear();
    const slot=document.getElementById("chart-operator-detail-slot");
    if(!slot) return;
    let html='<article class="operator-detail-card panel operator-chooser"><div class="operator-detail-head"><div><span>PUNTO COMPARTIDO</span><h3>Selecciona el operador</h3><p>Hay varios operadores con la misma combinación de precio y velocidad.</p></div><button type="button" class="operator-detail-close">×</button></div><div class="operator-choice-list">';
    candidates.forEach((p,i)=>{html+='<button type="button" data-choice="'+i+'"><b>'+escapeHtml(p.operator)+'</b><span>'+escapeHtml(p.city)+'</span></button>';});
    html+='</div></article>';
    slot.innerHTML=html;
    slot.classList.add("open");
    slot.querySelector(".operator-detail-close")?.addEventListener("click",clear);
    slot.querySelectorAll("[data-choice]").forEach(btn=>btn.addEventListener("click",()=>{
      const p=candidates[Number(btn.dataset.choice)];
      open({operator:p.operator,city:p.city,planId:p.planId,mode:"chart"});
    }));
    slot.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function init(){
    if(document.documentElement.dataset.operatorDetailsBound==="1") return;
    document.documentElement.dataset.operatorDetailsBound="1";

    document.addEventListener("click",event=>{
      const trigger=event.target.closest?.(".operator-detail-trigger");
      if(!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      const plan=state.plans.find(r=>clean(r.ID_Plan_Registro)===clean(trigger.dataset.planId));
      if(!plan) return;
      open({operator:rowOperator(plan),city:clean(plan.Ciudad),planId:clean(plan.ID_Plan_Registro),mode:"table",row:trigger.closest("tr")});
    });

    window.addEventListener("fibrazo:scatter-select",event=>{
      const candidates=event.detail?.candidates||[];
      if(!candidates.length) return;
      if(candidates.length===1){
        const p=candidates[0];
        open({operator:p.operator,city:p.city,planId:p.planId,mode:"chart"});
      }else chooser(candidates);
    });
  }

  FZ.details={init,open,clear,chooser};
})();
