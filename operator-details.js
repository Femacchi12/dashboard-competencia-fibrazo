(() => {
  "use strict";

  const clean = v => String(v ?? "").trim();
  const fold = v => clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num = v => {
    if(v===null||v===undefined||v==="") return null;
    let s=clean(v).replace(/[^0-9,.-]/g,"");
    if(!s) return null;
    if(s.includes(",")&&s.includes(".")){
      if(s.lastIndexOf(",")>s.lastIndexOf(".")) s=s.replace(/\./g,"").replace(",",".");
      else s=s.replace(/,/g,"");
    }else if(s.includes(",")){
      const p=s.split(",");
      s=p.length===2&&p[1].length<=2?p[0].replace(/\./g,"")+"."+p[1]:s.replace(/,/g,"");
    }
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  };
  const fmtCOP = n => n==null?"—":new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
  const fmtNum = n => n==null?"—":new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(n);
  const operatorOf = r => clean(r?.Grupo_Operador)||clean(r?.Operador_Normalizado);
  const tvLabel = v => {
    const s=fold(v);
    if(["si","yes","1","true"].includes(s)) return "Sí";
    if(["no","0","false"].includes(s)) return "No";
    return clean(v)||"—";
  };

  function snapshot(){
    return window.FibrazoCompetencia?.getSnapshot?.() || {plans:[],coverage:[],operators:[],offers:[],selectedPeriod:""};
  }

  function exactPeriodRows(rows,period){
    if(!period) return rows;
    const exact=rows.filter(r=>clean(r.Periodo_Corte)===period);
    return exact.length?exact:rows;
  }

  function detailData(operator,city,planId){
    const data=snapshot();
    const reference=data.plans.find(r=>clean(r.ID_Plan_Registro)===clean(planId))||null;
    const period=clean(reference?.Periodo_Corte)||clean(data.selectedPeriod);
    let plans=data.plans.filter(r=>operatorOf(r)===operator&&clean(r.Ciudad)===city);
    plans=exactPeriodRows(plans,period).sort((a,b)=>(num(a.Precio_Usado_COP)??Infinity)-(num(b.Precio_Usado_COP)??Infinity));
    let coverage=data.coverage.filter(r=>operatorOf(r)===operator&&clean(r.Ciudad)===city);
    coverage=exactPeriodRows(coverage,period);
    const opId=clean(reference?.ID_Operador)||clean(plans[0]?.ID_Operador);
    const meta=data.operators.find(o=>opId&&clean(o.ID_Operador)===opId)
      || data.operators.find(o=>fold(clean(o.Operador_Normalizado)||clean(o.Marca_Comercial))===fold(operator))
      || {};
    return {data,reference,period,plans,coverage,meta};
  }

  function uniq(values){
    return [...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  }

  function clearDetail(){
    document.querySelectorAll(".operator-detail-row").forEach(el=>el.remove());
    const slot=document.getElementById("chart-operator-detail-slot");
    if(slot){slot.innerHTML="";slot.classList.remove("open");}
  }

  function planRowsHtml(plans){
    if(!plans.length) return '<tr><td colspan="9" class="detail-empty">Sin planes normalizados para este corte.</td></tr>';
    return plans.map(r=>{
      const used=num(r.Precio_Usado_COP), regular=num(r.Precio_Regular_COP), promo=num(r.Precio_Promocional_COP);
      return "<tr>"+
        "<td>"+esc(clean(r.Nombre_Plan)||clean(r.Tipo_Servicio)||"Plan")+"</td>"+
        "<td>"+esc(clean(r.Tipo_Servicio)||"—")+"</td>"+
        "<td>"+esc(num(r.Velocidad_Bajada_Mbps)==null?"—":fmtNum(num(r.Velocidad_Bajada_Mbps))+" Mbps")+"</td>"+
        "<td><strong>"+esc(fmtCOP(used))+"</strong></td>"+
        "<td>"+esc(fmtCOP(regular))+"</td>"+
        "<td>"+esc(fmtCOP(promo))+"</td>"+
        "<td>"+esc(clean(r.Modalidad)||"—")+"</td>"+
        "<td>"+esc(tvLabel(r.TV_Incluida))+"</td>"+
        "<td>"+esc(clean(r.Permanencia_Meses)||"—")+"</td>"+
      "</tr>";
    }).join("");
  }

  function panelHtml(operator,city,planId){
    const d=detailData(operator,city,planId);
    const prices=d.plans.map(r=>num(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=d.plans.map(r=>num(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    const trunks=uniq(d.coverage.map(r=>r.Troncal_FIBRAZO));
    const zones=uniq(d.coverage.map(r=>r.Zona_FIBRAZO));
    const barrios=uniq(d.coverage.map(r=>clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ)));
    const services=uniq(d.plans.map(r=>r.Tipo_Servicio));
    const technologies=uniq(d.plans.map(r=>r.Tecnologia));
    const outside=d.coverage.filter(r=>!clean(r.Troncal_FIBRAZO)).length;
    const periodLabel=clean(d.reference?.Periodo_Label)||clean(d.period)||"Corte actual";
    const phones=uniq([d.meta.Telefono_1,d.meta.Telefono_2,d.meta.Telefono_3,d.meta.Telefono_4,d.meta.Telefono_5]);
    const web=/^https?:\/\//i.test(clean(d.meta.Sitio_Web))?clean(d.meta.Sitio_Web):"";

    let html='<article class="operator-detail-card panel">';
    html+='<div class="operator-detail-head"><div><span>DETALLE DEL OPERADOR</span><h3>'+esc(operator)+'</h3><p>'+esc(city)+' · '+esc(periodLabel)+'</p></div><button type="button" class="operator-detail-close" aria-label="Cerrar detalle">×</button></div>';
    html+='<div class="operator-detail-kpis">';
    html+='<div><span>Planes</span><b>'+fmtNum(d.plans.length)+'</b></div>';
    html+='<div><span>Precio</span><b>'+(prices.length?esc(fmtCOP(Math.min(...prices))+" – "+fmtCOP(Math.max(...prices))):"—")+'</b></div>';
    html+='<div><span>Velocidad</span><b>'+(speeds.length?esc(fmtNum(Math.min(...speeds))+" – "+fmtNum(Math.max(...speeds))+" Mbps"):"—")+'</b></div>';
    html+='<div><span>Troncales</span><b>'+(trunks.length?esc(trunks.join(" · ")):"Fuera de troncal / sin dato")+'</b></div>';
    html+='</div>';

    html+='<div class="operator-detail-tags">';
    html+='<span><b>Servicio:</b> '+esc(services.join(" · ")||"—")+'</span>';
    html+='<span><b>Tecnología:</b> '+esc(technologies.join(" · ")||"—")+'</span>';
    html+='<span><b>Barrios:</b> '+esc(barrios.join(" · ")||"—")+'</span>';
    html+='<span><b>Zonas:</b> '+esc(zones.join(" · ")||"—")+'</span>';
    if(outside) html+='<span class="detail-warning"><b>Fuera de troncal:</b> '+fmtNum(outside)+' registros territoriales</span>';
    html+='</div>';

    html+='<div class="operator-detail-table-wrap"><table class="operator-detail-table"><thead><tr><th>Plan</th><th>Servicio</th><th>Velocidad</th><th>Precio usado</th><th>Regular</th><th>Promo</th><th>Modalidad</th><th>TV</th><th>Permanencia</th></tr></thead><tbody>'+planRowsHtml(d.plans)+'</tbody></table></div>';
    html+='<div class="operator-detail-footer"><div class="operator-detail-contact">';
    if(phones.length) html+='<span>Tel. '+phones.map(esc).join(" · ")+'</span>';
    if(web) html+='<a href="'+esc(web)+'" target="_blank" rel="noopener noreferrer">Web ↗</a>';
    html+='</div><button type="button" class="btn primary detail-compare-btn">Comparar con FIBRAZO →</button></div>';
    html+='</article>';
    return html;
  }

  function bindPanel(root,operator,city){
    root.querySelector(".operator-detail-close")?.addEventListener("click",clearDetail);
    root.querySelector(".detail-compare-btn")?.addEventListener("click",()=>{
      clearDetail();
      window.FibrazoCompetencia?.compareWithFibrazo?.(operator,city);
    });
  }

  function openDetail({operator,city,planId="",mode="chart",row=null}){
    if(!operator||!city) return;
    clearDetail();
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

  function openChooser(candidates){
    clearDetail();
    const slot=document.getElementById("chart-operator-detail-slot");
    if(!slot) return;
    let html='<article class="operator-detail-card panel operator-chooser"><div class="operator-detail-head"><div><span>PUNTO COMPARTIDO</span><h3>Selecciona el operador</h3><p>Hay varios operadores con la misma combinación de precio y velocidad.</p></div><button type="button" class="operator-detail-close">×</button></div><div class="operator-choice-list">';
    candidates.forEach((p,i)=>{
      html+='<button type="button" data-choice="'+i+'"><b>'+esc(p.operator)+'</b><span>'+esc(p.city)+'</span></button>';
    });
    html+='</div></article>';
    slot.innerHTML=html;
    slot.classList.add("open");
    slot.querySelector(".operator-detail-close")?.addEventListener("click",clearDetail);
    slot.querySelectorAll("[data-choice]").forEach(btn=>btn.addEventListener("click",()=>{
      const p=candidates[Number(btn.dataset.choice)];
      openDetail({operator:p.operator,city:p.city,planId:p.planId,mode:"chart"});
    }));
    slot.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  document.addEventListener("click",event=>{
    const trigger=event.target.closest?.(".operator-detail-trigger");
    if(!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    const data=snapshot();
    const plan=data.plans.find(r=>clean(r.ID_Plan_Registro)===clean(trigger.dataset.planId));
    if(!plan) return;
    openDetail({
      operator:operatorOf(plan),
      city:clean(plan.Ciudad),
      planId:clean(plan.ID_Plan_Registro),
      mode:"table",
      row:trigger.closest("tr")
    });
  });

  window.addEventListener("fibrazo:scatter-select",event=>{
    const candidates=event.detail?.candidates||[];
    if(!candidates.length) return;
    if(candidates.length===1){
      const p=candidates[0];
      openDetail({operator:p.operator,city:p.city,planId:p.planId,mode:"chart"});
    }else{
      openChooser(candidates);
    }
  });
})();