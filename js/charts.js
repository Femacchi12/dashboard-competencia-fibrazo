(function chartsModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const state=FZ.state;
  const {clean,toNum,formatCOP,formatNum,rowOperator,escapeHtml,compareOperatorsTraditionalFirst}=FZ.u;
  const $=FZ.u.$;
  let scatterHideTimer=null;

  function renderKPIs(){
    const d=state.filtered;
    const operators=new Set([...d.map(r=>clean(r.Grupo_Operador)),...state.filteredCoverage.map(r=>clean(r.Grupo_Operador))].filter(Boolean));
    const cities=new Set([...d.map(r=>clean(r.Ciudad)),...state.filteredCoverage.map(r=>clean(r.Ciudad))].filter(Boolean));
    const prices=d.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=d.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    if($("kpi-operators")) $("kpi-operators").textContent=formatNum(operators.size);
    if($("kpi-cities-note")) $("kpi-cities-note").textContent=formatNum(cities.size)+(cities.size===1?" ciudad con datos":" ciudades con datos");
    if($("kpi-min-price")) $("kpi-min-price").textContent=prices.length?formatCOP(Math.min(...prices)):"—";
    if($("kpi-max-price")) $("kpi-max-price").textContent=prices.length?formatCOP(Math.max(...prices)):"—";
    if($("kpi-min-speed")) $("kpi-min-speed").textContent=speeds.length?formatNum(Math.min(...speeds)):"—";
    if($("kpi-max-speed")) $("kpi-max-speed").textContent=speeds.length?formatNum(Math.max(...speeds)):"—";
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
    Chart.defaults.font.size=11;
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

  const palette=["#00F29A","#4D96FF","#FF5C70","#F5D547","#A66A3F","#FF9F43","#45D7E8","#A56EFF"];
  function hexToRgba(hex,alpha){
    const value=hex.replace("#","");
    const n=parseInt(value,16);
    return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+alpha+")";
  }

  function scatterCandidates(points,raw){
    const unique=new Map();
    points.filter(p=>p.x===raw.x&&p.y===raw.y).forEach(p=>unique.set(p.operator+"|"+p.city,p));
    return [...unique.values()];
  }

  function scatterTooltipElement(chart){
    const panel=chart.canvas.closest(".chart-panel");
    if(!panel) return null;
    let el=panel.querySelector(".scatter-interactive-tooltip");
    if(el) return el;
    el=document.createElement("div");
    el.className="scatter-interactive-tooltip hidden";
    el.dataset.locked="0";
    panel.appendChild(el);
    el.addEventListener("mouseenter",()=>{if(scatterHideTimer)clearTimeout(scatterHideTimer);});
    el.addEventListener("mouseleave",()=>{
      if(el.dataset.locked==="1") return;
      scatterHideTimer=setTimeout(()=>el.classList.add("hidden"),160);
    });
    return el;
  }

  function hideScatterTooltip(chart,{force=false}={}){
    const el=chart?.canvas?.closest(".chart-panel")?.querySelector(".scatter-interactive-tooltip");
    if(!el) return;
    if(!force&&el.dataset.locked==="1") return;
    el.dataset.locked="0";
    el.classList.add("hidden");
  }

  function renderScatterTooltip(chart,points,raw,caretX,caretY,{locked=false}={}){
    const el=scatterTooltipElement(chart);
    if(!el||!raw) return;
    if(scatterHideTimer) clearTimeout(scatterHideTimer);
    const candidates=scatterCandidates(points,raw);
    el.dataset.locked=locked?"1":"0";

    let html='<div class="scatter-tooltip-head"><div><b>'+escapeHtml(formatNum(raw.x))+' Mbps</b><span>'+escapeHtml(formatCOP(raw.y))+'</span></div><button type="button" class="scatter-tooltip-close" aria-label="Cerrar">×</button></div>';
    html+='<div class="scatter-tooltip-list">';
    candidates.forEach((p,i)=>{
      html+='<button type="button" class="scatter-tooltip-choice" data-scatter-choice="'+i+'"><b>'+escapeHtml(p.operator)+'</b><span>'+escapeHtml(p.city)+'</span></button>';
    });
    html+='</div>';
    el.innerHTML=html;
    el.classList.remove("hidden");

    const panel=chart.canvas.closest(".chart-panel");
    const canvasRect=chart.canvas.getBoundingClientRect();
    const panelRect=panel.getBoundingClientRect();
    const popupWidth=Math.min(380,Math.max(250,panel.clientWidth-24));
    el.style.width=popupWidth+"px";
    let left=(canvasRect.left-panelRect.left)+caretX+12;
    let top=(canvasRect.top-panelRect.top)+caretY+10;
    left=Math.max(12,Math.min(left,panel.clientWidth-popupWidth-12));
    const estimatedHeight=Math.min(300,88+candidates.length*45);
    if(top+estimatedHeight>panel.clientHeight-8) top=Math.max(58,(canvasRect.top-panelRect.top)+caretY-estimatedHeight-12);
    el.style.left=left+"px";
    el.style.top=top+"px";

    el.querySelector(".scatter-tooltip-close")?.addEventListener("click",event=>{
      event.stopPropagation();
      hideScatterTooltip(chart,{force:true});
    });
    el.querySelectorAll("[data-scatter-choice]").forEach(btn=>btn.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      const p=candidates[Number(btn.dataset.scatterChoice)];
      hideScatterTooltip(chart,{force:true});
      window.dispatchEvent(new CustomEvent("fibrazo:operator-chart-select",{detail:{operator:p.operator,city:p.city}}));
    }));
  }

  function externalScatterTooltip(points){
    return context=>{
      const {chart,tooltip}=context;
      const el=scatterTooltipElement(chart);
      if(!el) return;
      if(tooltip.opacity===0){
        if(el.dataset.locked==="1"||el.matches(":hover")) return;
        if(scatterHideTimer) clearTimeout(scatterHideTimer);
        scatterHideTimer=setTimeout(()=>hideScatterTooltip(chart),220);
        return;
      }
      const raw=tooltip.dataPoints?.[0]?.raw;
      if(!raw) return;
      renderScatterTooltip(chart,points,raw,tooltip.caretX,tooltip.caretY,{locked:false});
    };
  }

  function operatorFromBarEvent(event,elements,chart){
    let index=elements?.[0]?.index;
    const scale=chart.scales?.y;
    if(index==null&&scale&&event.x<=chart.chartArea.left&&event.y>=scale.top&&event.y<=scale.bottom){
      const labels=chart.data.labels||[];
      let bestIndex=-1,bestDistance=Infinity;
      labels.forEach((_,i)=>{
        const y=scale.getPixelForTick(i);
        const distance=Math.abs(event.y-y);
        if(distance<bestDistance){bestDistance=distance;bestIndex=i;}
      });
      const rowHeight=labels.length?scale.height/labels.length:0;
      if(bestIndex>=0&&bestDistance<=Math.max(16,rowHeight*.55)) index=bestIndex;
    }
    if(index==null||index<0||index>=chart.data.labels.length) return "";
    return clean(chart.data.labels[index]);
  }

  function openBarOperator(operator){
    if(!operator) return;
    const city=FZ.filters.selectedSingleCity?.()||"";
    window.dispatchEvent(new CustomEvent("fibrazo:operator-chart-select",{detail:{operator,city}}));
  }

  function barHoverCursor(event,elements,chart){
    const operator=operatorFromBarEvent(event,elements,chart);
    chart.canvas.style.cursor=operator?"pointer":"default";
  }
  function labelIndexFromNativeEvent(nativeEvent,chart){
    const rect=chart.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height) return -1;
    const x=(nativeEvent.clientX-rect.left)*(chart.width/rect.width);
    const y=(nativeEvent.clientY-rect.top)*(chart.height/rect.height);
    const scale=chart.scales?.y;
    const labels=chart.data.labels||[];
    if(!scale||!labels.length) return -1;
    if(x<0||x>chart.chartArea.left||y<scale.top||y>scale.bottom) return -1;

    let bestIndex=-1,bestDistance=Infinity;
    labels.forEach((_,i)=>{
      const tickY=scale.getPixelForTick(i);
      const distance=Math.abs(y-tickY);
      if(distance<bestDistance){bestDistance=distance;bestIndex=i;}
    });
    const rowHeight=scale.height/labels.length;
    return bestIndex>=0&&bestDistance<=Math.max(18,rowHeight*.58)?bestIndex:-1;
  }

  function bindBarLabelInteraction(chart){
    const canvas=chart.canvas;
    if(canvas._fibrazoLabelClickHandler) canvas.removeEventListener("click",canvas._fibrazoLabelClickHandler);
    if(canvas._fibrazoLabelMoveHandler) canvas.removeEventListener("mousemove",canvas._fibrazoLabelMoveHandler);

    canvas._fibrazoLabelClickHandler=event=>{
      const index=labelIndexFromNativeEvent(event,chart);
      if(index<0) return;
      event.preventDefault();
      event.stopPropagation();
      openBarOperator(clean(chart.data.labels[index]));
    };

    canvas._fibrazoLabelMoveHandler=event=>{
      const index=labelIndexFromNativeEvent(event,chart);
      if(index>=0) canvas.style.cursor="pointer";
    };

    canvas.addEventListener("click",canvas._fibrazoLabelClickHandler);
    canvas.addEventListener("mousemove",canvas._fibrazoLabelMoveHandler);
  }

  function renderCharts(){
    const rows=state.filtered;
    if(scatterHideTimer) clearTimeout(scatterHideTimer);
    document.querySelectorAll(".scatter-interactive-tooltip").forEach(el=>el.remove());

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
          interaction:{mode:"nearest",intersect:true},
          onClick:(event,elements,chart)=>{
            if(!elements?.length){
              hideScatterTooltip(chart,{force:true});
              return;
            }
            const hit=chart.data.datasets[elements[0].datasetIndex].data[elements[0].index];
            renderScatterTooltip(chart,points,hit,event.x,event.y,{locked:true});
          },
          plugins:{
            ...opt.plugins,
            tooltip:{enabled:false,external:externalScatterTooltip(points)}
          },
          scales:{x:{...opt.scales.x,title:{display:true,text:"Mbps"}},y:{...opt.scales.y,title:{display:true,text:"COP"},ticks:{callback:v=>"$"+Math.round(v/1000)+"k"}}}
        }
      });
    }

    if(FZ.filters.isSingleOperatorSingleCity()){
      destroyChart("operators");
      destroyChart("speeds");
      return;
    }

    const priceMap=rangeByOperator(rows,"Precio_Usado_COP");
    const speedMap=rangeByOperator(rows,"Velocidad_Bajada_Mbps");
    const operatorOrder=[...new Set([...priceMap.keys(),...speedMap.keys()])]
      .sort(compareOperatorsTraditionalFirst);
    const sharedColors=operatorOrder.map((_,i)=>palette[i%palette.length]);
    const priceRanges=operatorOrder.map(op=>[op,priceMap.get(op)||{min:null,max:null,count:0}]);

    if($("operators-chart")){
      const colors=sharedColors;
      setAdaptiveChartHeight("operators-chart",operatorOrder.length,{min:320,row:36,max:1400});
      destroyChart("operators");
      let opt=chartDefaults();
      state.charts.operators=new Chart($("operators-chart"),{
        type:"bar",
        data:{labels:operatorOrder,datasets:[
          {label:"Mínimo",data:priceRanges.map(x=>x[1].min),backgroundColor:colors.map(c=>hexToRgba(c,.52)),borderColor:colors,borderWidth:1,borderRadius:5},
          {label:"Máximo",data:priceRanges.map(x=>x[1].max),backgroundColor:colors.map(c=>hexToRgba(c,.92)),borderColor:colors,borderWidth:1,borderRadius:5}
        ]},
        options:{
          ...opt,indexAxis:"y",layout:{padding:{left:8,right:10}},
          onClick:(event,elements,chart)=>openBarOperator(operatorFromBarEvent(event,elements,chart)),
          onHover:barHoverCursor,
          plugins:{...opt.plugins,legend:{position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>c.dataset.label+": "+formatCOP(c.raw)}}},
          scales:{x:{...opt.scales.x,ticks:{callback:v=>"$"+Math.round(v/1000)+"k"}},y:{...opt.scales.y,ticks:{autoSkip:false,padding:8,font:{size:10}}}}
        }
      });
      bindBarLabelInteraction(state.charts.operators);
    }

    const speedRanges=operatorOrder.map(op=>[op,speedMap.get(op)||{min:null,max:null,count:0}]);
    if($("speeds-chart")){
      const colors=sharedColors;
      setAdaptiveChartHeight("speeds-chart",operatorOrder.length,{min:320,row:36,max:1400});
      destroyChart("speeds");
      let opt=chartDefaults();
      state.charts.speeds=new Chart($("speeds-chart"),{
        type:"bar",
        data:{labels:operatorOrder,datasets:[
          {label:"Mínimo",data:speedRanges.map(x=>x[1].min),backgroundColor:colors.map(c=>hexToRgba(c,.52)),borderColor:colors,borderWidth:1,borderRadius:5},
          {label:"Máximo",data:speedRanges.map(x=>x[1].max),backgroundColor:colors.map(c=>hexToRgba(c,.92)),borderColor:colors,borderWidth:1,borderRadius:5}
        ]},
        options:{
          ...opt,indexAxis:"y",layout:{padding:{left:8,right:10}},
          onClick:(event,elements,chart)=>openBarOperator(operatorFromBarEvent(event,elements,chart)),
          onHover:barHoverCursor,
          plugins:{...opt.plugins,legend:{position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>c.dataset.label+": "+formatNum(c.raw)+" Mbps"}}},
          scales:{x:{...opt.scales.x,title:{display:true,text:"Mbps"}},y:{...opt.scales.y,ticks:{autoSkip:false,padding:8,font:{size:10}}}}
        }
      });
      bindBarLabelInteraction(state.charts.speeds);
    }
  }

  FZ.charts={renderKPIs,renderCharts,rangeByOperator,chartDefaults,destroyChart};
})();