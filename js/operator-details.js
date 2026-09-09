(function detailsModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,safeUrl,rowOperator,normalizeTV}=FZ.u;
  const openEntries=[];
  let sequence=0;

  function exactPeriodRows(rows,period){
    if(!period) return rows;
    const exact=rows.filter(r=>clean(r.Periodo_Corte)===period);
    return exact.length?exact:rows;
  }

  function uniq(values){
    return [...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  }

  function detailData(operator,city,planId){
    const reference=state.plans.find(r=>clean(r.ID_Plan_Registro)===clean(planId))||null;
    const selectedPeriod=FZ.filters.selectedPeriodValue();
    const period=clean(reference?.Periodo_Corte)||selectedPeriod;

    let plans=state.filtered.filter(r=>fold(rowOperator(r))===fold(operator)&&(!city||fold(r.Ciudad)===fold(city)));
    if(reference||state.filters.period.size<=1) plans=exactPeriodRows(plans,period);
    plans=[...plans].sort((a,b)=>(toNum(a.Precio_Usado_COP)??Infinity)-(toNum(b.Precio_Usado_COP)??Infinity));

    const opId=clean(reference?.ID_Operador)||clean(plans[0]?.ID_Operador);
    let coverage=state.filteredCoverage.filter(r=>{
      const op=clean(r.Grupo_Operador)||clean(r.Operador_Normalizado);
      return fold(op)===fold(operator)&&(!city||fold(r.Ciudad)===fold(city));
    });
    if(reference||state.filters.period.size<=1) coverage=exactPeriodRows(coverage,period);

    const meta=state.operators.find(o=>opId&&clean(o.ID_Operador)===opId)
      ||state.operators.find(o=>fold(clean(o.Operador_Normalizado)||clean(o.Marca_Comercial))===fold(operator))
      ||{};
    return {reference,period,plans,coverage,meta};
  }

  function removeEntry(entry){
    if(!entry) return;
    if(entry.trigger?.isConnected){
      entry.trigger.classList.remove("expanded");
      entry.trigger.setAttribute("aria-expanded","false");
    }
    entry.el?.remove();
    const index=openEntries.indexOf(entry);
    if(index>=0) openEntries.splice(index,1);
    const slot=document.getElementById("chart-operator-detail-slot");
    if(slot&&!slot.children.length) slot.classList.remove("open");
  }

  function clear(){
    [...openEntries].forEach(removeEntry);
    const slot=document.getElementById("chart-operator-detail-slot");
    if(slot){slot.innerHTML="";slot.classList.remove("open");}
  }

  function pruneTableEntries(){
    [...openEntries].filter(entry=>entry.mode==="table").forEach(removeEntry);
  }

  function detailKey(operator,city){
    return fold(operator)+"|"+fold(city||"*");
  }

  function isOpen({operator,city=""}={}){
    const key=detailKey(operator,city);
    return openEntries.some(entry=>entry.key===key);
  }

  function planRowsHtml(plans){
    if(!plans.length) return '<tr><td colspan="10" class="detail-empty">Sin planes normalizados para este corte y filtros.</td></tr>';
    return plans.map(r=>{
      const used=toNum(r.Precio_Usado_COP),regular=toNum(r.Precio_Regular_COP),promo=toNum(r.Precio_Promocional_COP);
      return "<tr>"+
        "<td>"+escapeHtml(clean(r.Nombre_Plan)||clean(r.Tipo_Servicio)||"Plan")+"</td>"+
        "<td>"+escapeHtml(clean(r.Tipo_Servicio)||"—")+"</td>"+
        "<td>"+escapeHtml(clean(r.Tecnologia)||"No informado")+"</td>"+
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
    const cities=uniq(d.plans.map(r=>r.Ciudad));
    const outside=d.coverage.filter(r=>!clean(r.Troncal_FIBRAZO)).length;
    const periodLabel=clean(d.reference?.Periodo_Label)||(state.filters.period.size===2?"Cortes seleccionados":clean(d.period)||"Corte actual");
    const locationLabel=city||(
      cities.length<=3?cities.join(" · "):
      cities.length+" ciudades del filtro"
    )||"Ámbito filtrado";
    const phones=uniq([d.meta.Telefono_1,d.meta.Telefono_2,d.meta.Telefono_3,d.meta.Telefono_4,d.meta.Telefono_5]);
    const web=safeUrl(d.meta.Sitio_Web,"Sitio_Web");

    let html='<article class="operator-detail-card panel">';
    html+='<div class="operator-detail-head"><div><span>DETALLE DEL OPERADOR</span><h3>'+escapeHtml(operator)+'</h3><p>'+escapeHtml(locationLabel)+' · '+escapeHtml(periodLabel)+'</p></div><button type="button" class="operator-detail-close" aria-label="Cerrar detalle">×</button></div>';
    html+='<div class="operator-detail-kpis">';
    html+='<div><span>Planes</span><b>'+formatNum(d.plans.length)+'</b></div>';
    html+='<div><span>Precio mín. – máx.</span><b>'+(prices.length?escapeHtml(formatCOP(Math.min(...prices))+" – "+formatCOP(Math.max(...prices))):"—")+'</b></div>';
    html+='<div><span>Velocidad mín. – máx.</span><b>'+(speeds.length?escapeHtml(formatNum(Math.min(...speeds))+" – "+formatNum(Math.max(...speeds))+" Mbps"):"—")+'</b></div>';
    html+='<div><span>Troncales</span><b>'+(trunks.length?escapeHtml(trunks.join(" · ")):"Fuera de troncal / sin dato")+'</b></div>';
    html+='</div>';
    html+='<div class="operator-detail-tags">';
    html+='<span><b>Servicio:</b> '+escapeHtml(services.join(" · ")||"—")+'</span>';
    html+='<span><b>Tecnología:</b> '+escapeHtml(technologies.join(" · ")||"No informado")+'</span>';
    html+='<span><b>Barrios:</b> '+escapeHtml(barrios.join(" · ")||"—")+'</span>';
    html+='<span><b>Zonas:</b> '+escapeHtml(zones.join(" · ")||"—")+'</span>';
    if(outside) html+='<span class="detail-warning"><b>Fuera de troncal:</b> '+formatNum(outside)+' registros territoriales</span>';
    html+='</div>';
    html+='<div class="detail-table-tools"><input type="search" class="detail-table-search" placeholder="Buscar en la tabla…" autocomplete="off"></div>';
    html+='<div class="operator-detail-table-wrap"><table class="operator-detail-table"><thead><tr><th>Plan</th><th>Servicio</th><th>Tecnología</th><th>Velocidad</th><th>Precio usado</th><th>Regular</th><th>Promo</th><th>Modalidad</th><th>TV</th><th>Permanencia</th></tr></thead><tbody>'+planRowsHtml(d.plans)+'</tbody></table></div>';
    html+='<div class="operator-detail-footer"><div class="operator-detail-contact">';
    if(phones.length) html+='<span>Tel. '+phones.map(escapeHtml).join(" · ")+'</span>';
    if(web) html+='<a href="'+escapeHtml(web)+'" target="_blank" rel="noopener noreferrer">Web ↗</a>';
    html+='</div><button type="button" class="btn primary detail-compare-btn">Comparar con FIBRAZO →</button></div>';
    html+='</article>';
    return html;
  }

  function bindPanel(root,operator,city,entry){
    root.querySelector(".operator-detail-close")?.addEventListener("click",()=>removeEntry(entry));
    root.querySelector(".detail-table-search")?.addEventListener("input",event=>{
      const q=(event.target.value||"").trim().toLowerCase();
      root.querySelectorAll(".operator-detail-table tbody tr").forEach(tr=>{
        tr.style.display=!q||tr.textContent.toLowerCase().includes(q)?"":"none";
      });
    });
    root.querySelector(".detail-compare-btn")?.addEventListener("click",()=>{
      clear();
      if(city) FZ.app?.compareWithFibrazo?.(operator,city);
    });
  }

  function enforceLimit(){
    while(openEntries.length>=2) removeEntry(openEntries[0]);
  }

  function open({operator,city="",planId="",mode="chart",row=null,trigger=null}){
    if(!operator) return;
    const key=detailKey(operator,city);
    const existing=openEntries.find(entry=>entry.key===key);
    if(existing){
      if(mode==="table"&&existing.mode==="table"){
        removeEntry(existing);
        return;
      }
      if(existing.mode===mode){
        existing.el?.scrollIntoView({behavior:"smooth",block:"nearest"});
        return;
      }
      removeEntry(existing);
    }

    enforceLimit();
    const html=panelHtml(operator,city,planId);
    let entry;

    if(mode==="table"&&row){
      const detailRow=document.createElement("tr");
      detailRow.className="operator-detail-row";
      detailRow.dataset.detailKey=key;
      const td=document.createElement("td");
      td.colSpan=document.querySelectorAll("#table-head th").length||12;
      td.innerHTML=html;
      detailRow.appendChild(td);
      row.after(detailRow);
      const tableTrigger=trigger||row.querySelector(".operator-detail-trigger");
      if(tableTrigger){
        tableTrigger.classList.add("expanded");
        tableTrigger.setAttribute("aria-expanded","true");
      }
      entry={id:++sequence,key,mode,operator,city,el:detailRow,trigger:tableTrigger};
      openEntries.push(entry);
      bindPanel(detailRow,operator,city,entry);
      detailRow.scrollIntoView({behavior:"smooth",block:"nearest"});
      return entry;
    }

    const slot=document.getElementById("chart-operator-detail-slot");
    if(!slot) return;
    const host=document.createElement("div");
    host.className="operator-detail-instance";
    host.dataset.detailKey=key;
    host.innerHTML=html;
    slot.appendChild(host);
    slot.classList.add("open");
    entry={id:++sequence,key,mode:"chart",operator,city,el:host,trigger:null};
    openEntries.push(entry);
    bindPanel(host,operator,city,entry);
    host.scrollIntoView({behavior:"smooth",block:"nearest"});
    return entry;
  }

  function chooser(candidates){
    if(!candidates?.length) return;
    if(candidates.length===1){
      const p=candidates[0];
      open({operator:p.operator,city:p.city,planId:p.planId,mode:"chart"});
      return;
    }
    const slot=document.getElementById("chart-operator-detail-slot");
    if(!slot) return;
    const chooser=document.createElement("div");
    chooser.className="operator-detail-instance operator-chooser-instance";
    let html='<article class="operator-detail-card panel operator-chooser"><div class="operator-detail-head"><div><span>PUNTO COMPARTIDO</span><h3>Selecciona el operador</h3><p>Hay varios operadores con la misma combinación de precio y velocidad.</p></div><button type="button" class="operator-detail-close">×</button></div><div class="operator-choice-list">';
    candidates.forEach((p,i)=>{html+='<button type="button" data-choice="'+i+'"><b>'+escapeHtml(p.operator)+'</b><span>'+escapeHtml(p.city)+'</span></button>';});
    html+='</div></article>';
    chooser.innerHTML=html;
    slot.appendChild(chooser);
    slot.classList.add("open");
    chooser.querySelector(".operator-detail-close")?.addEventListener("click",()=>chooser.remove());
    chooser.querySelectorAll("[data-choice]").forEach(btn=>btn.addEventListener("click",()=>{
      const p=candidates[Number(btn.dataset.choice)];
      chooser.remove();
      open({operator:p.operator,city:p.city,planId:p.planId,mode:"chart"});
    }));
    chooser.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function init(){
    if(document.documentElement.dataset.operatorDetailsBound==="1") return;
    document.documentElement.dataset.operatorDetailsBound="1";

    document.addEventListener("click",event=>{
      const trigger=event.target.closest?.(".operator-detail-trigger");
      if(!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      const row=trigger.closest("tr");
      open({
        operator:clean(trigger.dataset.operator),
        city:clean(trigger.dataset.city),
        planId:clean(trigger.dataset.planId),
        mode:"table",
        row,
        trigger
      });
    });

    window.addEventListener("fibrazo:operator-chart-select",event=>{
      const operator=clean(event.detail?.operator);
      const city=clean(event.detail?.city);
      if(operator) open({operator,city,mode:"chart"});
    });

    window.addEventListener("fibrazo:scatter-select",event=>{
      const candidates=event.detail?.candidates||[];
      chooser(candidates);
    });
  }

  FZ.details={init,open,clear,chooser,isOpen,pruneTableEntries};
})();