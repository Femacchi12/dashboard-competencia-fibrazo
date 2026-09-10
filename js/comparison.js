(function comparisonModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,fold,escapeHtml,toNum,formatCOP,formatNum,formatPct,pctVs,normalizeTV,rowOperator,compareOperatorsTraditionalFirst}=FZ.u;
  const $=FZ.u.$;

  function offerLabel(o){
    const trunk=clean(o.Troncal_FIBRAZO)?" · "+clean(o.Troncal_FIBRAZO):"";
    return clean(o.Ciudad)+trunk+" · "+clean(o.Servicio)+" · "+formatNum(o.Velocidad_Mbps)+" Mbps · "+formatCOP(o.Precio_COP)+" · "+clean(o.Etapa_Vigencia);
  }

  function offerSignature(o){
    return [clean(o?.Servicio),toNum(o?.Velocidad_Mbps),normalizeTV(o?.TV),clean(o?.Modalidad),toNum(o?.Dias),clean(o?.Etapa_Vigencia),clean(o?.Troncal_FIBRAZO)].join("|");
  }

  function compatibleOffers(){
    const cities=state.filters.city.size?state.filters.city:FZ.filters.fibrazoCitySet();
    const rows=state.offers.filter(o=>!cities.size||cities.has(clean(o.Ciudad)));
    const multiCity=cities.size!==1;
    const seen=new Set();
    return rows.filter(o=>{
      const k=multiCity?offerSignature(o):[clean(o.Ciudad),offerSignature(o),toNum(o.Precio_COP)].join("|");
      if(seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function offerFamilyLabel(o){
    const tv=normalizeTV(o.TV);
    const tvLabel=tv&&tv!=="No informado"?" · TV "+tv:"";
    return clean(o.Servicio)+" · "+formatNum(o.Velocidad_Mbps)+" Mbps"+tvLabel+" · "+clean(o.Etapa_Vigencia);
  }

  function benchmarkOfferForCity(city,selected){
    const local=state.offers.filter(o=>clean(o.Ciudad)===clean(city));
    if(!local.length) return null;
    if(selected){
      const signature=offerSignature(selected);
      const exact=local.find(o=>offerSignature(o)===signature);
      if(exact) return exact;
      const sameServiceSpeed=local.find(o=>
        clean(o.Servicio)===clean(selected.Servicio)&&
        toNum(o.Velocidad_Mbps)===toNum(selected.Velocidad_Mbps)&&
        normalizeTV(o.TV)===normalizeTV(selected.TV)&&
        clean(o.Etapa_Vigencia)===clean(selected.Etapa_Vigencia)
      );
      if(sameServiceSpeed) return sameServiceSpeed;
    }
    return fibrazoOfferForCity(city);
  }

  function fibrazoOfferForCity(city){
    const offers=state.offers.filter(o=>clean(o.Ciudad)===clean(city));
    if(!offers.length) return null;
    const selected=offers.find(o=>o.ID_Oferta===state.selectedOfferKey);
    if(selected) return selected;
    return offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400&&clean(o.Etapa_Vigencia)==="Precio normal")
      ||offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400)
      ||[...offers].sort((a,b)=>(a.Precio_COP||Infinity)-(b.Precio_COP||Infinity))[0];
  }

  function renderFibrazoComparison(){
    const select=$("fibrazo-offer-select");
    if(!select) return;

    const setCardTone=(id,tone)=>{
      const card=$(id);
      if(!card) return;
      card.classList.remove("good","alert","neutral");
      card.classList.add(tone||"neutral");
    };
    const median=values=>{
      const nums=values.filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);
      if(!nums.length) return null;
      const mid=Math.floor(nums.length/2);
      return nums.length%2?nums[mid]:(nums[mid-1]+nums[mid])/2;
    };
    const pctText=value=>{
      if(value==null||!Number.isFinite(value)) return "—";
      const abs=Math.abs(value);
      if(abs<1) return "En línea";
      return abs.toFixed(1).replace(".",",")+"% "+(value<0?"por debajo":"por encima");
    };
    const speedText=value=>{
      if(value==null||!Number.isFinite(value)) return "—";
      if(Math.abs(value)<1) return "En línea";
      return (value>0?"+":"")+formatNum(value)+" Mbps";
    };

    const offers=compatibleOffers();
    if(!offers.length){
      select.innerHTML="<option>Sin oferta compatible</option>";
      if($("fibrazo-compare-body")) $("fibrazo-compare-body").innerHTML="";
      if($("fz-executive-insight")) $("fz-executive-insight").textContent="No hay una oferta FIBRAZO compatible con el alcance actual.";
      return;
    }

    if(!state.selectedOfferKey||!offers.some(o=>o.ID_Oferta===state.selectedOfferKey)){
      const preferred=offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400&&clean(o.Etapa_Vigencia)==="Precio normal")||offers[0];
      state.selectedOfferKey=preferred.ID_Oferta;
    }

    const activeCities=state.filters.city.size?[...state.filters.city]:[...FZ.filters.fibrazoCitySet()];
    select.innerHTML=offers.map(o=>'<option value="'+escapeHtml(o.ID_Oferta)+'" '+(o.ID_Oferta===state.selectedOfferKey?"selected":"")+'>'+escapeHtml(activeCities.length>1?offerFamilyLabel(o):offerLabel(o))+"</option>").join("");
    const fz=offers.find(o=>o.ID_Oferta===state.selectedOfferKey)||offers[0];

    if($("fibrazo-benchmark-note")){
      $("fibrazo-benchmark-note").innerHTML=activeCities.length>1
        ?'Se compara la misma familia comercial contra la oferta local equivalente de FIBRAZO en cada ciudad.'
        :'Benchmark normalizado desde <b>Precios y Propuesta Comercial Fibrazo</b>.';
    }

    const period=FZ.filters.selectedPeriodValue();
    const best=new Map();
    state.filtered.forEach(r=>{
      const op=rowOperator(r),city=clean(r.Ciudad);
      if(!op||!city) return;
      const key=city+"|"+op;
      const cur=best.get(key);
      const price=toNum(r.Precio_Usado_COP),curPrice=toNum(cur?.Precio_Usado_COP);
      if(!cur||(price>0&&(curPrice==null||price<curPrice))) best.set(key,r);
    });
    state.filteredCoverage.forEach(r=>{
      const op=rowOperator(r),city=clean(r.Ciudad);
      if(!op||!city) return;
      const key=city+"|"+op;
      if(best.has(key)) return;
      best.set(key,{
        Ciudad:city,
        ID_Operador:clean(r.ID_Operador),
        Grupo_Operador:op,
        Operador_Normalizado:clean(r.Operador_Normalizado),
        Tecnologia:clean(r.Tecnologia)||"No informado",
        TV_Incluida:"No informado",
        Periodo_Corte:period
      });
    });

    const rows=[...best.values()].sort((a,b)=>{
      const cityOrder=clean(a.Ciudad).localeCompare(clean(b.Ciudad),"es",{numeric:true,sensitivity:"base"});
      if(cityOrder) return cityOrder;
      const ap=toNum(a.Precio_Usado_COP),bp=toNum(b.Precio_Usado_COP);
      if(ap!=null&&bp!=null) return ap-bp;
      if(ap!=null) return -1;
      if(bp!=null) return 1;
      return rowOperator(a).localeCompare(rowOperator(b),"es",{numeric:true,sensitivity:"base"});
    });

    const benchmarkFor=r=>benchmarkOfferForCity(r.Ciudad,fz);
    const pricedRows=rows.filter(r=>toNum(r.Precio_Usado_COP)>0&&toNum(benchmarkFor(r)?.Precio_COP)>0);
    const speedRows=rows.filter(r=>toNum(r.Velocidad_Bajada_Mbps)!=null&&toNum(benchmarkFor(r)?.Velocidad_Mbps)>0);

    const marketMedianPrice=median(pricedRows.map(r=>toNum(r.Precio_Usado_COP)));
    const fibrazoMedianPrice=median(pricedRows.map(r=>toNum(benchmarkFor(r)?.Precio_COP)));
    const pricePosition=marketMedianPrice&&fibrazoMedianPrice?pctVs(fibrazoMedianPrice,marketMedianPrice):null;

    const marketMedianSpeed=median(speedRows.map(r=>toNum(r.Velocidad_Bajada_Mbps)));
    const fibrazoMedianSpeed=median(speedRows.map(r=>toNum(benchmarkFor(r)?.Velocidad_Mbps)));
    const speedGap=marketMedianSpeed!=null&&fibrazoMedianSpeed!=null?fibrazoMedianSpeed-marketMedianSpeed:null;

    const directThreats=rows.filter(r=>{
      const p=toNum(r.Precio_Usado_COP),s=toNum(r.Velocidad_Bajada_Mbps),benchmark=benchmarkFor(r);
      const bp=toNum(benchmark?.Precio_COP),bs=toNum(benchmark?.Velocidad_Mbps);
      return p>0&&s!=null&&bp>0&&bs>0&&p<bp&&s>=bs;
    });

    const tvComparable=rows.filter(r=>["Sí","No"].includes(normalizeTV(r.TV_Incluida)));
    const tvYes=tvComparable.filter(r=>normalizeTV(r.TV_Incluida)==="Sí").length;
    const tvPct=tvComparable.length?tvYes/tvComparable.length*100:null;
    const fzTv=normalizeTV(fz.TV);

    if($("fz-executive-title")) $("fz-executive-title").textContent=offerFamilyLabel(fz);
    if($("fz-executive-scope")) $("fz-executive-scope").textContent=
      formatNum(activeCities.length)+" ciudad"+(activeCities.length===1?"":"es")+" · "+
      formatNum(rows.length)+" comparaciones operador-ciudad · "+comparisonPeriodLabel(period);

    if($("fz-price-position")) $("fz-price-position").textContent=pctText(pricePosition);
    if($("fz-price-context")) $("fz-price-context").textContent=marketMedianPrice==null
      ?"Sin base comparable"
      :"Mediana mercado "+formatCOP(marketMedianPrice)+" · FIBRAZO "+formatCOP(fibrazoMedianPrice);
    setCardTone("fz-price-position-card",pricePosition==null?"neutral":pricePosition<=0?"good":"alert");

    if($("fz-speed-position")) $("fz-speed-position").textContent=speedText(speedGap);
    if($("fz-speed-context")) $("fz-speed-context").textContent=marketMedianSpeed==null
      ?"Sin base comparable"
      :"Mediana mercado "+formatNum(marketMedianSpeed)+" Mbps · FIBRAZO "+formatNum(fibrazoMedianSpeed)+" Mbps";
    setCardTone("fz-speed-position-card",speedGap==null?"neutral":speedGap>=0?"good":"alert");

    if($("fz-direct-threats")) $("fz-direct-threats").textContent=formatNum(directThreats.length);
    if($("fz-threat-context")) $("fz-threat-context").textContent=directThreats.length
      ?directThreats.slice(0,3).map(r=>rowOperator(r)).join(" · ")+(directThreats.length>3?" · +"+(directThreats.length-3):"")
      :"Ningún competidor combina menor precio con velocidad igual o superior";
    setCardTone("fz-threat-card",directThreats.length?"alert":"good");

    if($("fz-tv-market")) $("fz-tv-market").textContent=tvPct==null?"—":tvPct.toFixed(1).replace(".",",")+"%";
    if($("fz-tv-context")) $("fz-tv-context").textContent=tvComparable.length
      ?formatNum(tvYes)+" de "+formatNum(tvComparable.length)+" comparaciones incluyen TV · FIBRAZO: "+fzTv
      :"Sin base comparable de TV";
    setCardTone("fz-tv-card","neutral");

    if($("fz-executive-insight")){
      const priceSentence=pricePosition==null
        ?"No hay suficiente información para ubicar el precio de FIBRAZO frente a la mediana del mercado."
        :pricePosition<=-1
          ?"FIBRAZO se ubica "+Math.abs(pricePosition).toFixed(1).replace(".",",")+"% por debajo de la mediana de precio."
          :pricePosition>=1
            ?"FIBRAZO se ubica "+pricePosition.toFixed(1).replace(".",",")+"% por encima de la mediana de precio."
            :"FIBRAZO está prácticamente alineado con la mediana de precio.";
      const speedSentence=speedGap==null
        ?"No hay suficiente información para comparar velocidad."
        :speedGap>0
          ?"En velocidad ofrece "+formatNum(speedGap)+" Mbps más que la mediana competitiva."
          :speedGap<0
            ?"En velocidad queda "+formatNum(Math.abs(speedGap))+" Mbps por debajo de la mediana competitiva."
            :"Su velocidad coincide con la mediana competitiva.";
      const threatSentence=directThreats.length
        ?"Se detectan "+formatNum(directThreats.length)+" amenaza"+(directThreats.length===1?"":"s")+" directa"+(directThreats.length===1?"":"s")+" que combina"+(directThreats.length===1?"":"n")+" menor precio con velocidad igual o superior."
        :"No se detectan amenazas directas con menor precio y velocidad igual o superior.";
      const tvSentence=tvPct==null
        ?"La información de TV todavía no es suficiente para una lectura ejecutiva."
        :"El "+tvPct.toFixed(1).replace(".",",")+"% de las comparaciones con dato incluyen TV.";
      $("fz-executive-insight").innerHTML='<strong>Conclusión</strong><p>'+escapeHtml(priceSentence+" "+speedSentence+" "+threatSentence+" "+tvSentence)+'</p>';
    }

    const trunksFor=(city,operator)=>[...new Set(
      state.filteredCoverage.filter(r=>
        clean(r.Ciudad)===clean(city)&&
        fold(rowOperator(r))===fold(operator)&&
        clean(r.Troncal_FIBRAZO)
      ).map(r=>clean(r.Troncal_FIBRAZO))
    )].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));

    const body=$("fibrazo-compare-body");
    if(body){
      body.innerHTML=rows.length?rows.map(r=>{
        const p=toNum(r.Precio_Usado_COP),s=toNum(r.Velocidad_Bajada_Mbps);
        const benchmark=benchmarkFor(r);
        const benchmarkPrice=toNum(benchmark?.Precio_COP),benchmarkSpeed=toNum(benchmark?.Velocidad_Mbps);
        const dp=p==null||benchmarkPrice==null?null:p-benchmarkPrice,ds=s==null||benchmarkSpeed==null?null:s-benchmarkSpeed;
        const pricePct=p==null||benchmarkPrice==null?null:pctVs(p,benchmarkPrice),speedPct=s==null||benchmarkSpeed==null?null:pctVs(s,benchmarkSpeed);
        const dpLabel=dp==null?"—":(dp===0?"=":(dp>0?"+":"")+formatCOP(dp).replace("COP","").trim());
        const dsLabel=ds==null?"—":(ds>0?"+":"")+formatNum(ds);
        const op=rowOperator(r),city=clean(r.Ciudad),trunks=trunksFor(city,op);
        const isThreat=p>0&&s!=null&&benchmarkPrice>0&&benchmarkSpeed>0&&p<benchmarkPrice&&s>=benchmarkSpeed;
        return '<tr class="fz-compare-data-row '+(isThreat?"direct-threat":"")+'">'+
          '<td>'+escapeHtml(city)+'</td>'+
          '<td><button type="button" class="operator-detail-trigger fz-operator-detail-trigger" data-operator="'+escapeHtml(op)+'" data-city="'+escapeHtml(city)+'" data-plan-id="'+escapeHtml(clean(r.ID_Plan_Registro))+'" data-period="'+escapeHtml(period)+'" aria-expanded="false"><span class="operator-toggle-arrow" aria-hidden="true">▸</span><span>'+escapeHtml(op)+'</span></button>'+(isThreat?'<small class="fz-threat-badge">Amenaza directa</small>':"")+'</td>'+
          '<td>'+formatCOP(p)+'</td>'+
          '<td>'+(s==null?"—":formatNum(s)+" Mbps")+'</td>'+
          '<td class="'+(dp==null?"":dp<=0?"negative":"positive")+'">'+dpLabel+(pricePct==null?"":' <small>'+formatPct(pricePct)+'</small>')+'</td>'+
          '<td class="'+(ds==null?"":ds>=0?"positive":"negative")+'">'+dsLabel+(speedPct==null?"":' <small>'+formatPct(speedPct)+'</small>')+'</td>'+
          '<td><span class="fz-trunk-count">'+(trunks.length?formatNum(trunks.length)+" troncal"+(trunks.length===1?"":"es"):"—")+'</span></td>'+
          '<td>'+escapeHtml(clean(r.Tecnologia)||"—")+'</td>'+
          '<td>'+escapeHtml(normalizeTV(r.TV_Incluida))+'</td>'+
        '</tr>';
      }).join(""):'<tr><td colspan="9" class="detail-empty">Sin competidores compatibles con los filtros actuales.</td></tr>';
    }

    const search=$("fz-table-search");
    const applySearch=()=>{
      if(!body||!search) return;
      const q=fold(search.value);
      body.querySelectorAll(".fz-compare-data-row").forEach(tr=>{
        tr.style.display=!q||fold(tr.textContent).includes(q)?"":"none";
      });
    };
    if(search){
      if(search.dataset.boundFzTableSearch!=="1"){
        search.dataset.boundFzTableSearch="1";
        search.addEventListener("input",()=>{
          FZ.details?.clear?.();
          applySearch();
        });
      }
      applySearch();
    }
  }

  function comparisonPeriodLabel(value){
    if(value==="2025-06") return "Junio 2025";
    if(value==="2026-09") return "Septiembre 2026";
    return clean(value)||"Sin corte";
  }

  function comparisonPeriods(){
    const periods=new Set();
    state.plans.forEach(r=>{if(clean(r.Periodo_Corte)) periods.add(clean(r.Periodo_Corte));});
    state.coverage.forEach(r=>{if(clean(r.Periodo_Corte)) periods.add(clean(r.Periodo_Corte));});
    const ordered=[...periods].sort((a,b)=>FZ.u.periodSortValue(b)-FZ.u.periodSortValue(a));

    if(!(state.comparison.periods instanceof Set)) state.comparison.periods=new Set();
    [...state.comparison.periods].forEach(p=>{if(!ordered.includes(p)) state.comparison.periods.delete(p);});
    if(ordered.length&&!state.comparison.periods.size) state.comparison.periods.add(ordered[0]);
    return ordered;
  }

  function selectedComparisonPeriods(){
    const ordered=comparisonPeriods();
    return ordered.filter(p=>state.comparison.periods.has(p));
  }

  function periodRowsForCity(rows,city,period){
    return rows.filter(r=>
      clean(r.Ciudad)===clean(city)&&
      (!period||clean(r.Periodo_Corte)===clean(period))
    );
  }

  function comparatorCities(){
    const set=new Set();
    state.metrics.forEach(r=>{
      if(toNum(r.HHPP)>0&&clean(r.Ciudad)) set.add(clean(r.Ciudad));
    });
    return [...set].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
  }

  function allScopeOptions(level=state.comparison.level){
    if(level==="city"){
      return comparatorCities().map(city=>({
        key:"city|"+city+"|"+city,level:"city",city,value:city,label:city
      }));
    }
    const unique=new Map();
    state.metrics.forEach(r=>{
      const city=clean(r.Ciudad),trunk=clean(r.Troncal_FIBRAZO),hhpp=toNum(r.HHPP);
      if(!city||!trunk||!(hhpp>0)) return;
      const key="trunk|"+city+"|"+trunk;
      unique.set(key,{key,level:"trunk",city,value:trunk,label:city+" · "+trunk,hhpp});
    });
    return [...unique.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  }

  function selectedScopes(){
    const selected=state.comparison.items;
    return allScopeOptions().filter(o=>selected.has(o.key));
  }

  function comparisonScopeOptions(){
    const level=state.comparison.level==="trunk"?"trunk":"city";
    const query=fold(state.comparison.search);
    return allScopeOptions(level).filter(o=>{
      if(level==="trunk"&&state.comparison.cityFilter!=="all"&&o.city!==state.comparison.cityFilter) return false;
      if(query&&!fold(o.label).includes(query)) return false;
      return true;
    });
  }

  function scopeCoverageRows(scope,period){
    const rows=periodRowsForCity(state.coverage,scope.city,period).filter(FZ.u.competitiveCoverageAllowed);
    if(scope.level==="city") return rows;
    return rows.filter(r=>clean(r.Troncal_FIBRAZO)===scope.value);
  }

  function scopePlanRows(scope,coverageRows,period){
    let rows=periodRowsForCity(state.plans,scope.city,period);
    if(scope.level==="city") return rows;
    const ops=new Set(coverageRows.map(rowOperator).filter(Boolean));
    if(!ops.size) return [];
    return rows.filter(r=>ops.has(rowOperator(r)));
  }

  function operationalMetrics(scope){
    if(scope.level==="trunk"){
      const tm=FZ.territory?.metricForTrunk(scope.city,scope.value);
      return {
        hhpp:toNum(tm?.HHPP),
        active:toNum(tm?.Clientes_Activos),
        penetration:toNum(tm?.Penetracion)
      };
    }

    const rows=state.metrics.filter(r=>clean(r.Ciudad)===scope.city&&toNum(r.HHPP)>0);
    const hhpp=rows.reduce((s,r)=>s+(toNum(r.HHPP)||0),0);
    const active=rows.reduce((s,r)=>s+(toNum(r.Clientes_Activos)||0),0);
    return {hhpp,active,penetration:hhpp>0?active/hhpp:null};
  }

  function comparisonMetrics(scope,period){
    const coverageRows=scopeCoverageRows(scope,period);
    const plans=scopePlanRows(scope,coverageRows,period);
    const ops=new Set();
    coverageRows.forEach(r=>{const op=rowOperator(r);if(op)ops.add(op);});
    plans.forEach(r=>{const op=rowOperator(r);if(op)ops.add(op);});

    const prices=plans.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=plans.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    const byOp=new Map();

    [...ops].forEach(op=>byOp.set(op,{prices:[],speeds:[],tech:new Set(),plans:[],trunks:new Set()}));
    coverageRows.forEach(r=>{
      const op=rowOperator(r);
      if(!op) return;
      if(!byOp.has(op)) byOp.set(op,{prices:[],speeds:[],tech:new Set(),plans:[],trunks:new Set()});
      const item=byOp.get(op);
      const trunk=clean(r.Troncal_FIBRAZO);
      if(trunk) item.trunks.add(trunk);
      if(clean(r.Tecnologia)) item.tech.add(clean(r.Tecnologia));
    });
    plans.forEach(r=>{
      const op=rowOperator(r);
      if(!op) return;
      if(!byOp.has(op)) byOp.set(op,{prices:[],speeds:[],tech:new Set(),plans:[],trunks:new Set()});
      const item=byOp.get(op);
      const p=toNum(r.Precio_Usado_COP),s=toNum(r.Velocidad_Bajada_Mbps);
      if(p>0) item.prices.push(p);
      if(s>0) item.speeds.push(s);
      if(clean(r.Tecnologia)) item.tech.add(clean(r.Tecnologia));
      item.plans.push(r);
    });

    const operatorSummaries=[...byOp.entries()].map(([operator,item])=>({
      operator,
      minPrice:item.prices.length?Math.min(...item.prices):null,
      maxPrice:item.prices.length?Math.max(...item.prices):null,
      minSpeed:item.speeds.length?Math.min(...item.speeds):null,
      maxSpeed:item.speeds.length?Math.max(...item.speeds):null,
      technologies:[...item.tech].sort((a,b)=>a.localeCompare(b,"es",{numeric:true})),
      trunks:[...item.trunks].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"})),
      planId:clean(item.plans[0]?.ID_Plan_Registro)
    })).sort(compareOperatorsTraditionalFirst);

    const fz=fibrazoOfferForCity(scope.city);
    const operatorBestPrices=operatorSummaries.map(x=>x.minPrice).filter(n=>n!=null);
    const operatorMaxSpeeds=operatorSummaries.map(x=>x.maxSpeed).filter(n=>n!=null);
    const cheaper=fz?operatorBestPrices.filter(p=>p<fz.Precio_COP).length:0;
    const faster=fz?operatorMaxSpeeds.filter(s=>s>fz.Velocidad_Mbps).length:0;
    const operational=operationalMetrics(scope);

    return {
      coverageRows,plans,ops,fz,operational,operatorSummaries,
      minPrice:prices.length?Math.min(...prices):null,
      maxPrice:prices.length?Math.max(...prices):null,
      minSpeed:speeds.length?Math.min(...speeds):null,
      maxSpeed:speeds.length?Math.max(...speeds):null,
      cheaper,
      faster,
      pricedOperators:operatorBestPrices.length,
      speedOperators:operatorMaxSpeeds.length
    };
  }

  function percentPart(part,total){
    return total>0?Math.round(part/total*1000)/10:null;
  }

  function renderSelectedStrip(){
    const strip=$("compare-selected-strip");
    if(!strip) return;
    const selected=selectedScopes();
    strip.classList.toggle("hidden",!selected.length);
    if(!selected.length){
      strip.innerHTML="";
      return;
    }
    strip.innerHTML='<span>SELECCIONADOS</span><div>'+selected.map(o=>
      '<button type="button" class="compare-selected-chip" data-remove-scope="'+escapeHtml(o.key)+'">'+
        '<b>'+escapeHtml(o.label)+'</b><i>×</i>'+
      '</button>'
    ).join("")+'</div>';
    strip.querySelectorAll("[data-remove-scope]").forEach(btn=>btn.addEventListener("click",()=>{
      state.comparison.items.delete(btn.dataset.removeScope);
      FZ.details?.clear?.();
      renderComparator();
    }));
  }

  function renderSelectionControls(options){
    const optionsRoot=$("compare-scope-options");
    const hint=$("compare-scope-hint");
    const cityFilter=$("compare-city-filter");
    const search=$("compare-search");
    const periodFilter=$("compare-period-filter");
    if(!optionsRoot) return;

    const periods=comparisonPeriods();
    if(periodFilter){
      periodFilter.innerHTML=periods.map(p=>
        '<label class="compare-period-option '+(state.comparison.periods.has(p)?"active":"")+'">'+
          '<input type="checkbox" value="'+escapeHtml(p)+'" '+(state.comparison.periods.has(p)?"checked":"")+'>'+
          '<span>'+escapeHtml(comparisonPeriodLabel(p))+'</span>'+
        '</label>'
      ).join("");
      periodFilter.querySelectorAll("input").forEach(input=>input.addEventListener("change",e=>{
        const p=e.target.value;
        if(e.target.checked){
          state.comparison.periods.add(p);
        }else{
          if(state.comparison.periods.size<=1){e.target.checked=true;return;}
          state.comparison.periods.delete(p);
        }
        FZ.details?.clear?.();
        renderComparator();
      }));
    }

    document.querySelectorAll("[data-compare-level]").forEach(btn=>{
      const active=btn.dataset.compareLevel===state.comparison.level;
      btn.classList.toggle("active",active);
      btn.setAttribute("aria-selected",active?"true":"false");
      if(btn.dataset.boundCompareLevel!=="1"){
        btn.dataset.boundCompareLevel="1";
        btn.addEventListener("click",()=>{
          const next=btn.dataset.compareLevel==="trunk"?"trunk":"city";
          if(state.comparison.level===next) return;
          state.comparison.level=next;
          state.comparison.items.clear();
          state.comparison.search="";
          state.comparison.cityFilter="all";
          FZ.details?.clear?.();
          renderComparator();
        });
      }
    });

    if(search){
      search.placeholder=state.comparison.level==="trunk"?"Buscar troncal…":"Buscar ciudad…";
      if(document.activeElement!==search) search.value=state.comparison.search||"";
      if(search.dataset.boundCompareSearch!=="1"){
        search.dataset.boundCompareSearch="1";
        search.addEventListener("input",()=>{
          state.comparison.search=search.value;
          renderComparator();
          requestAnimationFrame(()=>{$("compare-search")?.focus();});
        });
      }
    }

    if(cityFilter){
      const cities=comparatorCities();
      cityFilter.classList.toggle("hidden",state.comparison.level!=="trunk");
      cityFilter.innerHTML='<option value="all">Todas las ciudades</option>'+cities.map(city=>'<option value="'+escapeHtml(city)+'">'+escapeHtml(city)+'</option>').join("");
      cityFilter.value=state.comparison.cityFilter||"all";
      if(cityFilter.dataset.boundCompareCity!=="1"){
        cityFilter.dataset.boundCompareCity="1";
        cityFilter.addEventListener("change",()=>{
          state.comparison.cityFilter=cityFilter.value||"all";
          state.comparison.search="";
          renderComparator();
        });
      }
    }

    if(hint){
      const cutCount=selectedComparisonPeriods().length;
      hint.textContent=state.comparison.level==="trunk"
        ?"Solo se muestran troncales con HHPP construidos. Puedes comparar uno o dos cortes competitivos."
        :"Selecciona una o más ciudades. Puedes comparar uno o dos cortes competitivos.";
      if(cutCount>1) hint.textContent+=" Los resultados se separan por corte.";
    }

    renderSelectedStrip();

    optionsRoot.innerHTML=options.map(o=>{
      const checked=state.comparison.items.has(o.key)?"checked":"";
      if(o.level==="trunk"){
        return '<label class="compare-scope-option compare-scope-option-clean compare-trunk-option">'+
          '<input type="checkbox" data-key="'+escapeHtml(o.key)+'" '+checked+'>'+
          '<span class="compare-trunk-option-content">'+
            '<small class="compare-trunk-city">'+escapeHtml(o.city)+'</small>'+
            '<span class="compare-trunk-main"><b>'+escapeHtml(o.value)+'</b><em>'+formatNum(o.hhpp)+' HHPP</em></span>'+
          '</span>'+
        '</label>';
      }
      return '<label class="compare-scope-option compare-scope-option-clean compare-city-option">'+
        '<input type="checkbox" data-key="'+escapeHtml(o.key)+'" '+checked+'>'+
        '<span><b>'+escapeHtml(o.label)+'</b></span>'+
      '</label>';
    }).join("");

    if(!options.length){
      optionsRoot.innerHTML='<div class="compare-filter-empty">No hay resultados para esta búsqueda.</div>';
    }

    optionsRoot.querySelectorAll("input[data-key]").forEach(input=>input.addEventListener("change",e=>{
      const key=e.target.dataset.key;
      if(e.target.checked) state.comparison.items.add(key); else state.comparison.items.delete(key);
      FZ.details?.clear?.();
      renderComparator();
    }));

    const clearBtn=$("compare-clear-selection");
    if(clearBtn&&clearBtn.dataset.boundCompareClear!=="1"){
      clearBtn.dataset.boundCompareClear="1";
      clearBtn.addEventListener("click",()=>{
        state.comparison.items.clear();
        FZ.details?.clear?.();
        renderComparator();
      });
    }
  }

  function comparisonItemKey(scope,period){
    return scope.key+"|"+period;
  }

  function detailSlotId(scope,period){
    const raw=(scope.key+"-"+period).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    return "compare-detail-"+raw.replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);
  }

  function operatorComparisonContexts(items){
    const contexts=new Map();
    items.forEach(item=>{
      item.m.operatorSummaries.forEach(operator=>{
        const comparableItems=items.filter(other=>
          other.key!==item.key&&
          clean(other.scope.city)===clean(item.scope.city)
        );
        if(!comparableItems.length) return;
        const peers=comparableItems.flatMap(other=>
          other.m.operatorSummaries.filter(x=>fold(x.operator)===fold(operator.operator))
        );
        const current=new Set(operator.trunks||[]);
        const other=new Set(peers.flatMap(x=>x.trunks||[]));
        const shared=[...current].filter(t=>other.has(t)).sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
        const only=[...current].filter(t=>!other.has(t)).sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
        const missing=[...other].filter(t=>!current.has(t)).sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
        contexts.set(item.key+"|"+fold(operator.operator),{shared,only,missing});
      });
    });
    return contexts;
  }

  function operatorListHtml(scope,m,period,itemKey,contexts){
    if(!m.operatorSummaries.length){
      return '<div class="compare-operators-block"><div class="compare-operators-head"><span>OPERADORES PRESENTES</span><b>0</b></div><div class="compare-operators-empty">Sin operadores identificados para este ámbito y corte.</div></div>';
    }
    const slotId=detailSlotId(scope,period);
    return '<div class="compare-operators-block">'+
      '<div class="compare-operators-head"><span>OPERADORES PRESENTES</span><b>'+formatNum(m.operatorSummaries.length)+'</b></div>'+
      '<div class="compare-operator-list">'+m.operatorSummaries.map(o=>{
        const detail=[
          o.minPrice!=null?formatCOP(o.minPrice):"",
          o.maxSpeed!=null?formatNum(o.maxSpeed)+" Mbps":"",
          o.technologies.length?o.technologies.join(" · "):""
        ].filter(Boolean).join(" · ")||"Sin plan estructurado";
        const ctx=contexts.get(itemKey+"|"+fold(o.operator));
        const trunkCount=o.trunks?.length||0;
        const territory=[
          trunkCount?("Presencia en "+formatNum(trunkCount)+" troncal"+(trunkCount===1?"":"es")):"Sin troncal identificada",
          ctx&&ctx.shared.length?formatNum(ctx.shared.length)+" compartida"+(ctx.shared.length===1?"":"s"):"",
          ctx&&ctx.only.length?formatNum(ctx.only.length)+" exclusiva"+(ctx.only.length===1?"":"s"):"",
          ctx&&ctx.missing.length?formatNum(ctx.missing.length)+" en otra comparación":""
        ].filter(Boolean).join(" · ");
        const shared=escapeHtml(JSON.stringify(ctx?.shared||[]));
        const only=escapeHtml(JSON.stringify(ctx?.only||[]));
        const missing=escapeHtml(JSON.stringify(ctx?.missing||[]));
        return '<button type="button" class="compare-operator-btn" data-compare-operator="'+escapeHtml(o.operator)+'" data-compare-city="'+escapeHtml(scope.city)+'" data-compare-plan="'+escapeHtml(o.planId||"")+'" data-compare-period="'+escapeHtml(period)+'" data-compare-slot="'+escapeHtml(slotId)+'" data-compare-trunk="'+escapeHtml(scope.level==="trunk"?scope.value:"")+'" data-compare-shared="'+shared+'" data-compare-only="'+only+'" data-compare-missing="'+missing+'">'+
          '<b>'+escapeHtml(o.operator)+'</b><small class="compare-operator-commercial">'+escapeHtml(detail)+'</small><small class="compare-operator-territory">'+escapeHtml(territory)+'</small><span>Ver detalle →</span>'+
        '</button>';
      }).join("")+'</div>'+
    '</div>';
  }

  function resultCard(scope,period,m,contexts){
    const op=m.operational,fz=m.fz;
    const cheaperPct=percentPart(m.cheaper,m.pricedOperators);
    const fasterPct=percentPart(m.faster,m.speedOperators);
    const scopeType=scope.level==="trunk"?"TRONCAL":"CIUDAD";
    const itemKey=comparisonItemKey(scope,period);
    const slotId=detailSlotId(scope,period);

    return '<article class="panel compare-scope-card compare-scope-card-managerial">'+
      '<div class="compare-scope-head">'+
        '<div><span>'+scopeType+' · '+escapeHtml(comparisonPeriodLabel(period))+'</span><h3>'+escapeHtml(scope.label)+'</h3></div>'+
      '</div>'+
      '<div class="compare-managerial-block">'+
        '<span class="compare-block-title">OPERACIÓN FIBRAZO ACTUAL</span>'+
        '<div class="compare-operational-grid">'+
          '<div><span>HHPP</span><b>'+(op.hhpp==null?"—":formatNum(op.hhpp))+'</b></div>'+
          '<div><span>Activos</span><b>'+(op.active==null?"—":formatNum(op.active))+'</b></div>'+
          '<div><span>Penetración</span><b>'+(op.penetration==null?"—":formatPct(op.penetration*100).replace("+",""))+'</b></div>'+
        '</div>'+
      '</div>'+
      '<div class="compare-managerial-block">'+
        '<span class="compare-block-title">MERCADO · '+escapeHtml(comparisonPeriodLabel(period))+'</span>'+
        '<div class="compare-market-grid">'+
          '<div class="metric-price"><span>Precio mín.</span><b>'+formatCOP(m.minPrice)+'</b></div>'+
          '<div class="metric-price"><span>Precio máx.</span><b>'+formatCOP(m.maxPrice)+'</b></div>'+
          '<div class="metric-speed"><span>Velocidad mín.</span><b>'+(m.minSpeed==null?"—":formatNum(m.minSpeed)+" Mbps")+'</b></div>'+
          '<div class="metric-speed"><span>Velocidad máx.</span><b>'+(m.maxSpeed==null?"—":formatNum(m.maxSpeed)+" Mbps")+'</b></div>'+
        '</div>'+
      '</div>'+
      operatorListHtml(scope,m,period,itemKey,contexts)+
      '<div id="'+escapeHtml(slotId)+'" class="operator-detail-slot compare-inline-operator-detail"></div>'+
      '<div class="fibrazo-benchmark-row managerial">'+
        '<div><span>BENCHMARK FIBRAZO ACTUAL</span><b>'+(fz?formatCOP(fz.Precio_COP)+' · '+formatNum(fz.Velocidad_Mbps)+' Mbps':"Sin oferta normalizada")+'</b></div>'+
      '</div>'+
      '<div class="compare-signal-grid">'+
        '<div class="'+(m.cheaper>0?"alert":"ok")+'"><span>Precio</span><b>'+formatNum(m.cheaper)+' competidor'+(m.cheaper===1?"":"es")+' más barato'+(m.cheaper===1?"":"s")+'</b><small>'+(cheaperPct==null?"Sin base comparable":cheaperPct.toFixed(1).replace(".",",")+"% de operadores con precio")+'</small></div>'+
        '<div class="'+(m.faster>0?"alert":"ok")+'"><span>Velocidad</span><b>'+formatNum(m.faster)+' competidor'+(m.faster===1?"":"es")+' más rápido'+(m.faster===1?"":"s")+'</b><small>'+(fasterPct==null?"Sin base comparable":fasterPct.toFixed(1).replace(".",",")+"% de operadores con velocidad")+'</small></div>'+
      '</div>'+
    '</article>';
  }

  function parseContextList(value){
    if(!value) return [];
    try{
      const parsed=JSON.parse(value);
      return Array.isArray(parsed)?parsed.map(clean).filter(Boolean):[];
    }catch(_error){
      return [];
    }
  }

  function bindComparatorOperators(){
    document.querySelectorAll(".compare-operator-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const operator=clean(btn.dataset.compareOperator);
      const city=clean(btn.dataset.compareCity);
      const planId=clean(btn.dataset.comparePlan);
      const period=clean(btn.dataset.comparePeriod);
      const slotId=clean(btn.dataset.compareSlot);
      const trunk=clean(btn.dataset.compareTrunk);
      if(!operator||!slotId) return;
      FZ.details?.clearSlot?.(slotId);
      FZ.details?.open?.({
        operator,city,planId,period,trunk,
        mode:"chart",
        slotId,
        instanceKey:slotId,
        trunkCompare:{
          shared:parseContextList(btn.dataset.compareShared),
          only:parseContextList(btn.dataset.compareOnly),
          missing:parseContextList(btn.dataset.compareMissing)
        }
      });
    }));
  }

  function renderComparator(){
    const availablePeriods=comparisonPeriods();
    const selectedPeriods=selectedComparisonPeriods();
    const allValid=new Set(allScopeOptions().map(o=>o.key));
    state.comparison.items=new Set([...state.comparison.items].filter(k=>allValid.has(k)));

    const options=comparisonScopeOptions();
    renderSelectionControls(options);

    const uniqueSelected=selectedScopes();
    const summary=$("compare-summary"),benchmark=$("compare-benchmark"),cards=$("compare-cards");
    if(summary){
      if(uniqueSelected.length){
        summary.textContent=formatNum(uniqueSelected.length)+" ámbito"+(uniqueSelected.length===1?"":"s")+
          " · "+formatNum(selectedPeriods.length)+" corte"+(selectedPeriods.length===1?"":"s");
      }else{
        summary.textContent="Sin selección";
      }
    }
    if(!cards) return;

    if(!uniqueSelected.length){
      benchmark?.classList.add("hidden");
      if(benchmark) benchmark.innerHTML="";
      cards.innerHTML='<article class="panel compare-empty compare-empty-guided"><strong>Selecciona una ciudad o troncal</strong><span>La primera selección se mostrará inmediatamente y podrás seguir buscando otra para comparar.</span></article>';
      return;
    }

    if(benchmark){
      benchmark.classList.remove("hidden");
      const cutsLabel=selectedPeriods.map(comparisonPeriodLabel).join(" · ");
      benchmark.innerHTML='<div><span>RESULTADO</span><h3>'+(uniqueSelected.length===1&&selectedPeriods.length===1?"Vista seleccionada":"Lectura comparativa")+'</h3></div><p>'+
        formatNum(uniqueSelected.length)+' '+(state.comparison.level==="trunk"?"troncal"+(uniqueSelected.length===1?"":"es"):"ciudad"+(uniqueSelected.length===1?"":"es"))+
        ' · '+escapeHtml(cutsLabel)+' · FIBRAZO como benchmark actual</p>';
    }

    const resultItems=[];
    uniqueSelected.forEach(scope=>selectedPeriods.forEach(period=>{
      resultItems.push({scope,period,key:comparisonItemKey(scope,period),m:comparisonMetrics(scope,period)});
    }));
    const contexts=operatorComparisonContexts(resultItems);
    cards.innerHTML=resultItems.map(x=>resultCard(x.scope,x.period,x.m,contexts)).join("");
    bindComparatorOperators();
  }

  FZ.comparison={offerLabel,compatibleOffers,fibrazoOfferForCity,renderFibrazoComparison,comparisonScopeOptions,comparisonMetrics,renderComparator};
})();
