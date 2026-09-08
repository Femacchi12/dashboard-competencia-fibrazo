(function chartsModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,toNum,formatCOP,formatNum,formatPeriod,rowOperator}=FZ.u;
  const $=FZ.u.$;

  function renderKPIs(){
    const d=state.filtered;
    const operators=new Set([...d.map(r=>clean(r.Grupo_Operador)),...state.filteredCoverage.map(r=>clean(r.Grupo_Operador))].filter(Boolean));
    const cities=new Set([...d.map(r=>clean(r.Ciudad)),...state.filteredCoverage.map(r=>clean(r.Ciudad))].filter(Boolean));
    const prices=d.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=d.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    if($("kpi-operators")) $("kpi-operators").textContent=formatNum(operators.size);
    if($("kpi-cities-note")) $("kpi-cities-note").textContent=formatNum(cities.size)+" ciudades con datos";
    if($("kpi-plans")) $("kpi-plans").textContent=formatNum(d.length);
    if($("kpi-min-price")) $("kpi-min-price").textContent=prices.length?formatCOP(Math.min(...prices)):"—";
    if($("kpi-max-price")) $("kpi-max-price").textContent=prices.length?formatCOP(Math.max(...prices)):"—";
    if($("kpi-min-speed")) $("kpi-min-speed").textContent=speeds.length?formatNum(Math.min(...speeds)):"—";
    if($("kpi-max-speed")) $("kpi-max-speed").textContent=speeds.length?formatNum(Math.max(...speeds)):"—";
  }

  function shortNames(items){
    const a=[...items].filter(Boolean);
    if(!a.length) return "Sin cambios";
    return a.length<=3?a.join(", "):a.slice(0,3).join(", ")+" +"+(a.length-3);
  }

  function rangeByOperator(rows,key){
    const m=new Map();
    rows.forEach(r=>{
      const op=rowOperator(r),value=toNum(r[key]);
      if(!op||!(value>0)) return;
      if(!m.has(op))m.set(op,[]);
      m.get(op).push(value);
    });
    return new Map([...m.entries()].map(([op,arr])=>[op,{min:Math.min(...arr),max:Math.max(...arr),count:arr.length}]));
  }

  function chartDefaults(){
    Chart.defaults.color="#8FA9A0";
    Chart.defaults.font.family="Inter";
    Chart.defaults.font.size=10;
    return {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},
        tooltip:{backgroundColor:"#07100c",borderColor:"#1B3028",borderWidth:1,titleColor:"#F4FFF9",bodyColor:"#dce9e4"}
      },
      scales:{
        x:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}},
        y:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}}
      }
    };
  }

  function destroyChart(key){
    if(state.charts[key]){
      state.charts[key].destroy();
      delete state.charts[key];
    }
  }

  function setAdaptiveChartHeight(canvasId,itemCount,{min=320,row=34,max=760}={}){
    const canvas=$(canvasId);
    if(!canvas) return;
    const panel=canvas.closest(".chart-panel");
    const height=Math.max(min,Math.min(max,120+itemCount*row));
    if(panel){
      panel.style.height=height+"px";
      panel.style.minHeight=height+"px";
      panel.style.maxHeight=height+"px";
    }
  }

  function renderEvolution(){
    destroyChart("evoCompetitors");
    destroyChart("evoPrice");
    if(state.filters.period.size!==2) return;

    const selected=[...state.filters.period].map(label=>{
      const row=state.plans.find(r=>r.Periodo_Label===label);
      return row?.Periodo_Corte||"";
    }).filter(Boolean).sort((a,b)=>FZ.u.periodSortValue(a)-FZ.u.periodSortValue(b));
    if(selected.length!==2) return;

    const previous=selected[0],current=selected[1];
    if($("evolution-current")) $("evolution-current").textContent=formatPeriod(current);
    if($("evolution-compare")) $("evolution-compare").textContent="vs. "+formatPeriod(previous);

    const filteredHistory=state.plans.filter(FZ.filters.evolutionPasses);
    const rowsFor=p=>filteredHistory.filter(r=>r.Periodo_Corte===p);
    const coverageFor=p=>state.coverage.filter(r=>r.Periodo_Corte===p&&FZ.filters.coveragePassesFilters(r,null,false));
    const presenceFor=p=>{
      const set=new Set(rowsFor(p).map(rowOperator).filter(Boolean));
      if(!FZ.filters.hasPlanSpecificFilters()){
        coverageFor(p).forEach(r=>{const op=rowOperator(r);if(op)set.add(op);});
      }
      return set;
    };

    const currentRows=rowsFor(current),previousRows=rowsFor(previous);
    const currentOps=presenceFor(current),previousOps=presenceFor(previous);
    const added=[...currentOps].filter(x=>!previousOps.has(x));
    const lost=[...previousOps].filter(x=>!currentOps.has(x));
    if($("evo-new")) $("evo-new").textContent=formatNum(added.length);
    if($("evo-lost")) $("evo-lost").textContent=formatNum(lost.length);
    if($("evo-new-note")) $("evo-new-note").textContent=shortNames(added);
    if($("evo-lost-note")) $("evo-lost-note").textContent=shortNames(lost);

    const curPrice=rangeByOperator(currentRows,"Precio_Usado_COP");
    const prevPrice=rangeByOperator(previousRows,"Precio_Usado_COP");
    const changed=[...curPrice.keys()].filter(op=>prevPrice.has(op)&&(Math.abs(curPrice.get(op).min-prevPrice.get(op).min)>=1||Math.abs(curPrice.get(op).max-prevPrice.get(op).max)>=1));
    if($("evo-price-change")) $("evo-price-change").textContent=formatNum(changed.length);
    if($("evo-price-note")) $("evo-price-note").textContent=shortNames(changed);

    if($("competitors-evolution-chart")){
      let opt=chartDefaults();
      state.charts.evoCompetitors=new Chart($("competitors-evolution-chart"),{
        type:"line",
        data:{labels:selected.map(formatPeriod),datasets:[{label:"Competidores",data:selected.map(p=>presenceFor(p).size),borderColor:"#00F29A",backgroundColor:"rgba(0,242,154,.10)",pointBackgroundColor:"#00F29A",pointRadius:4,tension:.2,fill:true}]},
        options:{...opt,plugins:{...opt.plugins,legend:{display:false}},scales:{x:{...opt.scales.x},y:{...opt.scales.y,beginAtZero:true,ticks:{precision:0}}}}
      });
    }

    if($("price-evolution-chart")){
      const opt=chartDefaults();
      const ranges=selected.map(p=>rowsFor(p).map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0));
      state.charts.evoPrice=new Chart($("price-evolution-chart"),{
        type:"line",
        data:{labels:selected.map(formatPeriod),datasets:[
          {label:"Mínimo",data:ranges.map(a=>a.length?Math.min(...a):null),borderColor:"#00F29A",pointBackgroundColor:"#00F29A",pointRadius:4,tension:.2},
          {label:"Máximo",data:ranges.map(a=>a.length?Math.max(...a):null),borderColor:"#F5D547",pointBackgroundColor:"#F5D547",pointRadius:4,tension:.2}
        ]},
        options:{...opt,plugins:{...opt.plugins,legend:{display:true,position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>c.dataset.label+": "+formatCOP(c.raw)}}},scales:{x:{...opt.scales.x},y:{...opt.scales.y,ticks:{callback:v=>"$"+Math.round(v/1000)+"k"}}}}
      });
    }
  }

  const palette=["#00F29A","#4D96FF","#FF5C70","#F5D547","#A66A3F","#FF9F43","#45D7E8","#A56EFF"];
  function hexToRgba(hex,alpha){
    const value=hex.replace("#","");
    const n=parseInt(value,16);
    return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+alpha+")";
  }

  function renderCharts(){
    const rows=state.filtered;

    destroyChart("scatter");
    if($("scatter-chart")){
      const points=rows.map(r=>({
        x:toNum(r.Velocidad_Bajada_Mbps),
        y:toNum(r.Precio_Usado_COP),
        operator:rowOperator(r),
        city:clean(r.Ciudad),
        planId:clean(r.ID_Plan_Registro),
        period:clean(r.Periodo_Corte)
      })).filter(p=>p.x>0&&p.y>0);
      let opt=chartDefaults();
      state.charts.scatter=new Chart($("scatter-chart"),{
        type:"scatter",
        data:{datasets:[{label:"Planes",data:points,pointRadius:4,pointHoverRadius:6,backgroundColor:"rgba(0,242,154,.72)"}]},
        options:{
          ...opt,
          onClick:(event,elements,chart)=>{
            if(!elements?.length) return;
            const hit=chart.data.datasets[elements[0].datasetIndex].data[elements[0].index];
            const unique=new Map();
            points.filter(p=>p.x===hit.x&&p.y===hit.y).forEach(p=>unique.set(p.operator+"|"+p.city,p));
            window.dispatchEvent(new CustomEvent("fibrazo:scatter-select",{detail:{candidates:[...unique.values()]}}));
          },
          plugins:{...opt.plugins,tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>c.raw.operator+" · "+c.raw.city+": "+formatNum(c.raw.x)+" Mbps · "+formatCOP(c.raw.y)}}},
          scales:{x:{...opt.scales.x,title:{display:true,text:"Mbps"}},y:{...opt.scales.y,title:{display:true,text:"COP"},ticks:{callback:v=>"$"+Math.round(v/1000)+"k"}}}
        }
      });
    }

    if(FZ.filters.isSingleOperatorSingleCity()){
      destroyChart("operators");
      destroyChart("speeds");
      return;
    }

    const priceRanges=[...rangeByOperator(rows,"Precio_Usado_COP").entries()].sort((a,b)=>a[1].min-b[1].min).slice(0,14);
    if($("operators-chart")){
      const colors=priceRanges.map((_,i)=>palette[i%palette.length]);
      setAdaptiveChartHeight("operators-chart",priceRanges.length,{min:320,row:36,max:760});
      destroyChart("operators");
      let opt=chartDefaults();
      state.charts.operators=new Chart($("operators-chart"),{
        type:"bar",
        data:{labels:priceRanges.map(x=>x[0]),datasets:[
          {label:"Mínimo",data:priceRanges.map(x=>x[1].min),backgroundColor:colors.map(c=>hexToRgba(c,.52)),borderColor:colors,borderWidth:1,borderRadius:5},
          {label:"Máximo",data:priceRanges.map(x=>x[1].max),backgroundColor:colors.map(c=>hexToRgba(c,.92)),borderColor:colors,borderWidth:1,borderRadius:5}
        ]},
        options:{...opt,indexAxis:"y",layout:{padding:{left:8,right:10}},plugins:{...opt.plugins,legend:{position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>c.dataset.label+": "+formatCOP(c.raw)}}},scales:{x:{...opt.scales.x,ticks:{callback:v=>"$"+Math.round(v/1000)+"k"}},y:{...opt.scales.y,ticks:{autoSkip:false,padding:8,font:{size:10}}}}}
      });
    }

    const speedRanges=[...rangeByOperator(rows,"Velocidad_Bajada_Mbps").entries()].sort((a,b)=>b[1].max-a[1].max).slice(0,14);
    if($("speeds-chart")){
      const colors=speedRanges.map((_,i)=>palette[i%palette.length]);
      setAdaptiveChartHeight("speeds-chart",speedRanges.length,{min:320,row:36,max:760});
      destroyChart("speeds");
      let opt=chartDefaults();
      state.charts.speeds=new Chart($("speeds-chart"),{
        type:"bar",
        data:{labels:speedRanges.map(x=>x[0]),datasets:[
          {label:"Mínimo",data:speedRanges.map(x=>x[1].min),backgroundColor:colors.map(c=>hexToRgba(c,.52)),borderColor:colors,borderWidth:1,borderRadius:5},
          {label:"Máximo",data:speedRanges.map(x=>x[1].max),backgroundColor:colors.map(c=>hexToRgba(c,.92)),borderColor:colors,borderWidth:1,borderRadius:5}
        ]},
        options:{...opt,indexAxis:"y",layout:{padding:{left:8,right:10}},plugins:{...opt.plugins,legend:{position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>c.dataset.label+": "+formatNum(c.raw)+" Mbps"}}},scales:{x:{...opt.scales.x,title:{display:true,text:"Mbps"}},y:{...opt.scales.y,ticks:{autoSkip:false,padding:8,font:{size:10}}}}}
      });
    }
  }

  FZ.charts={renderKPIs,renderEvolution,renderCharts,rangeByOperator,chartDefaults,destroyChart};
})();
