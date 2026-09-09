(function dataModule(){
  "use strict";
  const FZ=window.FZ;
  if(!FZ) throw new Error("FZ core not loaded");
  const {clean,fold,toNum,formatYearMonth,periodValue,formatPeriod}=FZ.u;
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
        Filas_Fuente_Consolidadas:toNum(r.Filas_Fuente_Consolidadas)||0
      };
    });
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
    state.indexes={
      coverageByCityOperator:indexRows(state.coverage,r=>clean(r.Ciudad)+"|"+(clean(r.ID_Operador)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado))),
      coverageByCityTrunk:indexRows(state.coverage,r=>clean(r.Ciudad)+"|"+clean(r.Troncal_FIBRAZO)),
      plansByCityOperator:indexRows(state.plans,r=>clean(r.Ciudad)+"|"+(clean(r.Grupo_Operador)||clean(r.Operador_Normalizado))),
      metricByCityTrunk:new Map(state.metrics.map(r=>[clean(r.Ciudad)+"|"+clean(r.Troncal_FIBRAZO),r]))
    };
  }

  async function load({mode="full"}={}){
    const S=FZ.SOURCES;
    const full=mode!=="dynamic"||!state.operators.length||!state.markets.length;
    if(full){
      const results=await Promise.allSettled([
        fetchCsv(S.plans),
        fetchCsv(S.operators),
        fetchCsv(S.coverage),
        fetchCsv(S.markets),
        fetchCsv(S.territories),
        fetchCsv(S.offers),
        fetchCsv(S.fibrazoMetrics)
      ]);
      if(results[0].status!=="fulfilled") throw results[0].reason;
      if(results[1].status!=="fulfilled") throw results[1].reason;
      if(results[3].status!=="fulfilled") throw results[3].reason;

      state.operators=results[1].value;
      state.plans=buildPlans(results[0].value,state.operators);
      state.coverage=results[2].status==="fulfilled"?buildCoverage(results[2].value,state.operators):[];
      state.markets=buildMarkets(results[3].value);
      state.territories=results[4].status==="fulfilled"?results[4].value.filter(r=>clean(r.ID_Territorio)):[];
      state.offers=results[5].status==="fulfilled"?buildOffers(results[5].value):[];
      state.metrics=results[6].status==="fulfilled"?buildMetrics(results[6].value):[];
    }else{
      const results=await Promise.allSettled([
        fetchCsv(S.plans),
        fetchCsv(S.coverage),
        fetchCsv(S.offers),
        fetchCsv(S.fibrazoMetrics)
      ]);
      if(results[0].status!=="fulfilled") throw results[0].reason;
      state.plans=buildPlans(results[0].value,state.operators);
      if(results[1].status==="fulfilled") state.coverage=buildCoverage(results[1].value,state.operators);
      if(results[2].status==="fulfilled") state.offers=buildOffers(results[2].value);
      if(results[3].status==="fulfilled") state.metrics=buildMetrics(results[3].value);
    }

    buildIndexes();

    return {
      mode:full?"full":"dynamic",
      plans:state.plans.length,
      coverage:state.coverage.length,
      metrics:state.metrics.length
    };
  }

  FZ.data={csvUrl,parseCSV,fetchCsv,buildPlans,buildCoverage,buildOffers,buildMarkets,buildMetrics,buildIndexes,load};
})();
