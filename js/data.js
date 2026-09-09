(function dataModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const {clean,fold,toNum,formatYearMonth,periodValue,formatPeriod,rowOperator}=FZ.u;
  const state=FZ.state;

  function csvUrl(source){
    const params=new URLSearchParams({
      tqx:"out:csv",
      gid:source.gid,
      headers:"1",
      cb:String(Date.now())
    });
    if(source.range) params.set("range",source.range);
    return "https://docs.google.com/spreadsheets/d/"+FZ.BASE_SHEET_ID+"/gviz/tq?"+params.toString();
  }

  function normalizeThousands(text){
    return text.replace(/\$?-?\d{1,3}(?:\.\d{3})+(?:,\d+)?/g,value=>value.replace(/\./g,""));
  }

  function parseCSV(text){
    const rows=[]; let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i],next=text[i+1];
      if(c==='"'){
        if(quoted&&next==='"'){field+='"';i++;} else quoted=!quoted;
      }else if(c===","&&!quoted){
        row.push(field); field="";
      }else if((c==="\n"||c==="\r")&&!quoted){
        if(c==="\r"&&next==="\n")i++;
        row.push(field);
        if(row.some(v=>v!=="")) rows.push(row);
        row=[]; field="";
      }else field+=c;
    }
    if(field.length||row.length){row.push(field);rows.push(row);}
    if(!rows.length) return [];
    const headers=rows[0].map(clean);
    return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,clean(r[i]??"")])));
  }

  async function fetchCsv(source){
    const res=await fetch(csvUrl(source),{cache:"no-store"});
    if(!res.ok) throw new Error(source.label+": HTTP "+res.status);
    let text=await res.text();
    if(/<!doctype html>|<html/i.test(text)) throw new Error(source.label+": la hoja no es accesible como CSV desde el navegador.");
    if(source.gid==="1372196091") text=normalizeThousands(text);
    return parseCSV(text);
  }

  function buildPlans(rawPlans,operators){
    const byId=new Map(),byName=new Map();
    operators.forEach(op=>{
      if(clean(op.ID_Operador)) byId.set(clean(op.ID_Operador),op);
      if(clean(op.Operador_Normalizado)) byName.set(fold(op.Operador_Normalizado),op);
    });
    return rawPlans
      .filter(r=>clean(r.ID_Plan_Registro)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado))
      .map(r=>{
        const op=byId.get(clean(r.ID_Operador))||byName.get(fold(r.Operador_Normalizado))||{};
        const regular=toNum(r.Precio_Regular_COP),promo=toNum(r.Precio_Promocional_COP);
        const used=promo!=null&&promo>0?promo:(regular!=null&&regular>0?regular:null);
        return {
          ...r,
          Fecha_Mes:formatYearMonth(r.Fecha_Relevamiento),
          Periodo_Corte:periodValue(r.Periodo_Corte),
          Periodo_Label:formatPeriod(r.Periodo_Corte),
          Grupo_Operador:clean(op.Grupo_Operador)||clean(op.Marca_Comercial)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
          Barrio:clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ),
          Precio_Usado_COP:used==null?"":String(used),
          Sitio_Web:clean(op.Sitio_Web),
          Telefono_1:clean(op.Telefono_1),Telefono_2:clean(op.Telefono_2),Telefono_3:clean(op.Telefono_3),
          Telefono_4:clean(op.Telefono_4),Telefono_5:clean(op.Telefono_5),
          Instagram:clean(op.Instagram),Facebook:clean(op.Facebook),TikTok:clean(op.TikTok),
          Imagenes_Folletos:clean(op.Imagenes_Folletos)
        };
      });
  }

  function buildCoverage(rawCoverage,operators){
    const byId=new Map(),byName=new Map();
    operators.forEach(op=>{
      if(clean(op.ID_Operador)) byId.set(clean(op.ID_Operador),op);
      if(clean(op.Operador_Normalizado)) byName.set(fold(op.Operador_Normalizado),op);
    });
    return rawCoverage
      .filter(r=>clean(r.ID_Cobertura)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado))
      .map(r=>{
        const op=byId.get(clean(r.ID_Operador))||byName.get(fold(r.Operador_Normalizado))||{};
        return {
          ...r,
          Periodo_Corte:periodValue(r.Periodo_Corte),
          Periodo_Label:formatPeriod(r.Periodo_Corte),
          Grupo_Operador:clean(op.Grupo_Operador)||clean(op.Marca_Comercial)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)
        };
      });
  }

  function buildOffers(raw){
    return raw.filter(r=>clean(r.ID_Oferta)).map(r=>({
      ...r,
      Velocidad_Mbps:toNum(r.Velocidad_Mbps),
      Precio_COP:toNum(r.Precio_COP),
      Dias:toNum(r.Dias)
    }));
  }

  function buildMarkets(raw){
    return raw
      .filter(r=>clean(r.Ciudad))
      .map(r=>({...r,Orden_Dashboard:toNum(r.Orden_Dashboard)||999}))
      .sort((a,b)=>a.Orden_Dashboard-b.Orden_Dashboard||clean(a.Ciudad).localeCompare(clean(b.Ciudad),"es"));
  }

  function buildMetrics(raw){
    return raw.filter(r=>clean(r.ID_Metrica)).map(r=>{
      const hhpp=toNum(r.HHPP);
      const active=toNum(r.Clientes_Activos);
      return {
        ...r,
        HHPP:hhpp,
        Clientes_Activos:active,
        Penetracion:hhpp!=null&&hhpp>0&&active!=null?active/hhpp:null,
        Filas_Fuente_Consolidadas:toNum(r.Filas_Fuente_Consolidadas)||0,
        HHPP_Estrato_0:toNum(r.HHPP_Estrato_0),
        HHPP_Estrato_1:toNum(r.HHPP_Estrato_1),
        HHPP_Estrato_2:toNum(r.HHPP_Estrato_2),
        HHPP_Estrato_3:toNum(r.HHPP_Estrato_3),
        HHPP_Estrato_4:toNum(r.HHPP_Estrato_4),
        HHPP_Estrato_5:toNum(r.HHPP_Estrato_5),
        HHPP_Estrato_6:toNum(r.HHPP_Estrato_6),
        HHPP_Sin_Estrato:toNum(r.HHPP_Sin_Estrato),
        Total_HHPP_Estratos:toNum(r.Total_HHPP_Estratos)
      };
    });
  }
  function buildMobile(raw){
    return raw.filter(r=>clean(r.Periodo_Corte)&&clean(r.Operador)).map((r,index)=>({
      ...r,
      _key:[clean(r.Periodo_Corte),clean(r.Operador),clean(r.Plan_Referencia),index].join("|"),
      Periodo_Corte:periodValue(r.Periodo_Corte),
      Periodo_Label:formatPeriod(r.Periodo_Corte),
      Precio_COP:toNum(r.Precio_COP),
      GB:toNum(r.GB),
      Vigencia_Dias:toNum(r.Vigencia_Dias)
    }));
  }


  function indexRows(rows,keyFn){
    const map=new Map();
    rows.forEach(r=>{
      const key=keyFn(r);
      if(!key) return;
      if(!map.has(key)) map.set(key,[]);
      map.get(key).push(r);
    });
    return map;
  }

  function buildIndexes(){
    const confirmedOperatorCityPeriod=new Set();

    state.plans.forEach(r=>{
      const period=clean(r.Periodo_Corte),city=clean(r.Ciudad),op=rowOperator(r);
      if(period&&city&&op) confirmedOperatorCityPeriod.add(period+"|"+city+"|"+op);
    });

    state.coverage.forEach(r=>{
      if(FZ.u.isInheritedCoverageRow(r)) return;
      const period=clean(r.Periodo_Corte),city=clean(r.Ciudad),op=rowOperator(r);
      if(period&&city&&op) confirmedOperatorCityPeriod.add(period+"|"+city+"|"+op);
    });

    state.indexes={
      coverageByCityOperator:indexRows(state.coverage,r=>clean(r.Ciudad)+"|"+(clean(r.ID_Operador)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado))),
      coverageByCityTrunk:indexRows(state.coverage,r=>clean(r.Ciudad)+"|"+clean(r.Troncal_FIBRAZO)),
      plansByCityOperator:indexRows(state.plans,r=>clean(r.Ciudad)+"|"+(clean(r.Grupo_Operador)||clean(r.Operador_Normalizado))),
      metricByCityTrunk:new Map(state.metrics.map(r=>[clean(r.Ciudad)+"|"+clean(r.Troncal_FIBRAZO),r])),
      confirmedOperatorCityPeriod
    };
  }

  function healthEntry(source,result){
    return {
      label:source.label,
      ok:result.status==="fulfilled",
      error:result.status==="rejected"?clean(result.reason?.message||result.reason||"Error de carga"):""
    };
  }

  async function load(){
    const S=FZ.SOURCES;
    const entries=[
      ["plans",S.plans],
      ["operators",S.operators],
      ["coverage",S.coverage],
      ["markets",S.markets],
      ["territories",S.territories],
      ["offers",S.offers],
      ["fibrazoMetrics",S.fibrazoMetrics],
      ["mobile",S.mobile]
    ];
    const results=await Promise.allSettled(entries.map(([,source])=>fetchCsv(source)));
    const resultByKey=Object.fromEntries(entries.map(([key],i)=>[key,results[i]]));
    state.sourceHealth=Object.fromEntries(entries.map(([key,source],i)=>[key,healthEntry(source,results[i])]));

    const firstLoad=!state.plans.length&&!state.operators.length&&!state.markets.length;
    const critical=["plans","operators","markets"];
    const failedCritical=critical.filter(key=>resultByKey[key].status!=="fulfilled");
    if(firstLoad&&failedCritical.length){
      const key=failedCritical[0];
      throw new Error(S[key].label+": "+state.sourceHealth[key].error);
    }

    if(resultByKey.operators.status==="fulfilled") state.operators=resultByKey.operators.value;
    const operators=state.operators;

    if(resultByKey.plans.status==="fulfilled") state.plans=buildPlans(resultByKey.plans.value,operators);
    if(resultByKey.coverage.status==="fulfilled") state.coverage=buildCoverage(resultByKey.coverage.value,operators);
    if(resultByKey.markets.status==="fulfilled") state.markets=buildMarkets(resultByKey.markets.value);
    if(resultByKey.territories.status==="fulfilled"){
      state.territories=resultByKey.territories.value.filter(r=>/^TERR_[ZT]_/.test(clean(r.ID_Territorio)));
    }
    if(resultByKey.offers.status==="fulfilled") state.offers=buildOffers(resultByKey.offers.value);
    if(resultByKey.fibrazoMetrics.status==="fulfilled") state.metrics=buildMetrics(resultByKey.fibrazoMetrics.value);
    if(resultByKey.mobile.status==="fulfilled") state.mobile=buildMobile(resultByKey.mobile.value);

    buildIndexes();

    const sourcesOk=Object.values(state.sourceHealth).filter(x=>x.ok).length;
    return {
      mode:firstLoad?"full":"refresh",
      plans:state.plans.length,
      coverage:state.coverage.length,
      metrics:state.metrics.length,
      mobile:state.mobile.length,
      sourcesOk,
      sourcesTotal:entries.length,
      health:state.sourceHealth
    };
  }

  FZ.data={csvUrl,parseCSV,fetchCsv,buildPlans,buildCoverage,buildOffers,buildMarkets,buildMetrics,buildMobile,buildIndexes,load};
})();
