(() => {
  "use strict";

  const BASE_SHEET_ID = "1v2sBVe_w-bTl438b8qWFmvw0gT66bj8TskcXbnY-gbU";
  const SOURCES = {
    plans: { gid: "1372196091", label: "02_PLANES_HISTORICO", range:"A1:AF1000" },
    operators: { gid: "1091103584", label: "01_OPERADORES", range:"A1:AA300" },
    coverage: { gid: "718563813", label: "03_PRESENCIA", range:"A1:Y2500" },
    relevamientos: { gid: "1909486382", label: "04_RELEVAMIENTOS", range:"A1:AD1000" },
    markets: { gid: "1320750580", label: "07_CONFIG · Mercados", range:"X2:AI300" },
    territories: { gid: "1320750580", label: "07_CONFIG · Territorio", range:"AK2:AQ400" },
    offers: { gid: "1320750580", label: "07_CONFIG · Oferta FIBRAZO", range:"AS2:BC300" }
  };
  const AUTO_REFRESH_MS = 120000;

  const state = {
    plans: [], operators: [], coverage: [], markets: [], territories: [], offers: [], relevamientos: [],
    filtered: [], filteredCoverage: [], filteredFFVV: [],
    filters: { period:new Set(), city:new Set(), operator:new Set(), technology:new Set(), modality:new Set(), price:new Set() },
    cityScopeMode:"fibrazo", analysisView:"general", selectedOfferKey:"",
    tableSearch:"", expanded:false, sort:{ key:"Grupo_Operador", dir:1 }, hiddenColumns:new Set(["Operador_Normalizado"]), charts:{},
    loading:false, lastLoadAt:0
  };

  const filterDefs = [
    {key:"period", label:"Corte", getter:r=>clean(r.Periodo_Label), allLabel:"Último corte", maxSelections:2},
    {key:"city", label:"Ciudad / localidad", getter:r=>clean(r.Ciudad), allLabel:"Todas"},
    {key:"operator", label:"Operador", getter:r=>clean(r.Grupo_Operador)||clean(r.Operador_Normalizado), allLabel:"Todos"},
    {key:"technology", label:"Tecnología", getter:r=>clean(r.Tecnologia)||"No informado", allLabel:"Todos"},
    {key:"modality", label:"Modalidad", getter:r=>clean(r.Modalidad)||"No informado", allLabel:"Todos"},
    {key:"price", label:"Rango de precio", getter:r=>priceBand(toNum(r.Precio_Usado_COP)), allLabel:"Todos"}
  ];

  const columns = [
    ["Periodo_Label","Corte"],
    ["Grupo_Operador","Operador"],
    ["Ciudad","Ciudad"],
    ["Departamento","Departamento"],
    ["Operador_Normalizado","Detalle operador"],
    ["Barrio","Barrio"],
    ["Tipo_Servicio","Servicio"],
    ["TV_Incluida","TV"],
    ["Tecnologia","Tecnología"],
    ["Velocidad_Bajada_Mbps","Velocidad"],
    ["Precio_Usado_COP","Precio"],
    ["Modalidad","Modalidad"],
    ["Permanencia_Meses","Permanencia"],
    ["Telefono_1","Teléfono 1"],
    ["Telefono_2","Teléfono 2"],
    ["Telefono_3","Teléfono 3"],
    ["Telefono_4","Teléfono 4"],
    ["Telefono_5","Teléfono 5"],
    ["Sitio_Web","Web"],
    ["Instagram","Instagram"],
    ["Facebook","Facebook"],
    ["TikTok","TikTok"],
    ["Imagenes_Folletos","Imágenes / folletos"]
  ];

  const phoneFields = new Set(["Telefono_1","Telefono_2","Telefono_3","Telefono_4","Telefono_5"]);
  const linkFields = new Set(["Sitio_Web","Instagram","Facebook","TikTok","Imagenes_Folletos"]);
  const linkLabels = {
    Sitio_Web:"Web ↗",
    Instagram:"Instagram ↗",
    Facebook:"Facebook ↗",
    TikTok:"TikTok ↗",
    Imagenes_Folletos:"Ver carpeta ↗"
  };
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  const $ = id => document.getElementById(id);
  const clean = v => String(v ?? "").trim();
  const fold = v => clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toNum = v => {
    if(v === null || v === undefined || v === "") return null;
    let s = clean(v).replace(/[^0-9,.-]/g, "");
    if(!s) return null;
    if(s.includes(",") && s.includes(".")) {
      if(s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if(s.includes(",")) {
      const parts=s.split(",");
      s = parts.length===2 && parts[1].length<=2 ? parts[0].replace(/\./g,"")+"."+parts[1] : s.replace(/,/g,"");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const formatCOP = n => n == null ? "—" : new Intl.NumberFormat("es-CO", {style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
  const formatNum = n => n == null ? "—" : new Intl.NumberFormat("es-CO", {maximumFractionDigits:1}).format(n);
  const normalizeTV = v => { const s=fold(v); if(!s)return "No informado"; if(["si","yes","1","true"].includes(s))return "Sí"; if(["no","0","false"].includes(s))return "No"; return clean(v); };
  const priceBand = n => n == null ? "Sin precio" : n < 50000 ? "< $50k" : n <= 75000 ? "$50k–$75k" : n <= 100000 ? "$75k–$100k" : "> $100k";
  const periodValue = value => clean(value).match(/^\d{4}-\d{2}$/) ? clean(value) : "";
  const formatPeriod = value => {
    const s=periodValue(value);
    if(!s) return "Sin corte";
    const [year,month]=s.split("-").map(Number);
    return month>=1&&month<=12 ? `${year}-${months[month-1]}` : s;
  };
  const periodSortValue = value => {
    const s=periodValue(value);
    if(!s) return 0;
    const [year,month]=s.split("-").map(Number);
    return year*100+month;
  };

  function formatYearMonth(value){
    const s=clean(value);
    if(!s || fold(s)==="sin fecha" || fold(s)==="sin info") return "Sin info";
    let m=s.match(/^(\d{4})[-\/]([01]?\d)(?:[-\/]\d{1,2})?$/);
    if(m){ const month=Number(m[2]); return month>=1&&month<=12 ? `${m[1]}-${months[month-1]}` : "Sin info"; }
    m=s.match(/^(\d{1,2})[\/]([01]?\d)[\/](\d{4})$/);
    if(m){ const month=Number(m[2]); return month>=1&&month<=12 ? `${m[3]}-${months[month-1]}` : "Sin info"; }
    const d=new Date(s);
    if(!Number.isNaN(d.getTime()) && /\d{4}/.test(s)) return `${d.getFullYear()}-${months[d.getMonth()]}`;
    return "Sin info";
  }

  function dateSortValue(value){
    const s=clean(value);
    let m=s.match(/^(\d{4})[-\/]([01]?\d)(?:[-\/]([0-3]?\d))?$/);
    if(m) return Number(m[1])*10000 + Number(m[2])*100 + Number(m[3]||1);
    m=s.match(/^(\d{1,2})[\/]([01]?\d)[\/](\d{4})$/);
    if(m) return Number(m[3])*10000 + Number(m[2])*100 + Number(m[1]);
    return 0;
  }

  function safeUrl(value, field){
    const s=clean(value);
    if(!s || !/^https?:\/\//i.test(s)) return "";
    if(field==="Sitio_Web" && /(?:docs\.google\.com|drive\.google\.com|facebook\.com|instagram\.com|tiktok\.com)/i.test(s)) return "";
    return s;
  }

  function linkCell(value, field){
    const url=safeUrl(value, field);
    if(!url) return '<span class="link-empty">—</span>';
    return `<a class="detail-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabels[field]||"Abrir ↗")}</a>`;
  }

  function phoneCell(value){
    const label=clean(value);
    if(!label) return '<span class="link-empty">—</span>';
    const dial=label.replace(/[^0-9+*#]/g,"");
    if(!dial) return escapeHtml(label);
    return `<a class="phone-link" href="tel:${escapeHtml(dial)}">${escapeHtml(label)}</a>`;
  }

  function csvUrl(source){
    const params=new URLSearchParams({tqx:"out:csv",gid:source.gid,cb:String(Date.now())});
    if(source.range) params.set("range",source.range);
    return `https://docs.google.com/spreadsheets/d/${BASE_SHEET_ID}/gviz/tq?${params.toString()}`;
  }

  function parseCSV(text){
    const rows=[]; let row=[], field="", quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], next=text[i+1];
      if(c==='"') { if(quoted && next==='"'){field+='"';i++;} else quoted=!quoted; }
      else if(c===',' && !quoted){ row.push(field); field=""; }
      else if((c==='\n'||c==='\r') && !quoted){ if(c==='\r'&&next==='\n')i++; row.push(field); if(row.some(v=>v!==""))rows.push(row); row=[]; field=""; }
      else field+=c;
    }
    if(field.length||row.length){row.push(field);rows.push(row);}
    if(!rows.length)return[];
    const headers=rows[0].map(clean);
    return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,clean(r[i]??"")])));
  }

  async function fetchCsv(source){
    const res=await fetch(csvUrl(source),{cache:"no-store"});
    if(!res.ok) throw new Error(`${source.label}: HTTP ${res.status}`);
    const text=await res.text();
    if(/<!doctype html>|<html/i.test(text)) throw new Error(`${source.label}: la hoja no es accesible como CSV desde el navegador.`);
    return parseCSV(text);
  }

  function buildPlans(rawPlans, operators){
    const byId=new Map(), byName=new Map();
    operators.forEach(op=>{
      if(clean(op.ID_Operador)) byId.set(clean(op.ID_Operador),op);
      if(clean(op.Operador_Normalizado)) byName.set(fold(op.Operador_Normalizado),op);
    });
    return rawPlans.filter(r=>clean(r.ID_Plan_Registro)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)).map(r=>{
      const op=byId.get(clean(r.ID_Operador)) || byName.get(fold(r.Operador_Normalizado)) || {};
      const regular=toNum(r.Precio_Regular_COP), promo=toNum(r.Precio_Promocional_COP);
      const used=promo!=null && promo>0 ? promo : (regular!=null && regular>0 ? regular : null);
      return {
        ...r,
        Fecha_Mes:formatYearMonth(r.Fecha_Relevamiento),
        Periodo_Corte:periodValue(r.Periodo_Corte),
        Periodo_Label:formatPeriod(r.Periodo_Corte),
        Grupo_Operador:clean(op.Grupo_Operador)||clean(op.Marca_Comercial)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
        Barrio:clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ),
        Precio_Usado_COP:used==null?"":String(used),
        Sitio_Web:clean(op.Sitio_Web),
        Telefono_1:clean(op.Telefono_1), Telefono_2:clean(op.Telefono_2), Telefono_3:clean(op.Telefono_3),
        Telefono_4:clean(op.Telefono_4), Telefono_5:clean(op.Telefono_5),
        Instagram:clean(op.Instagram), Facebook:clean(op.Facebook), TikTok:clean(op.TikTok),
        Imagenes_Folletos:clean(op.Imagenes_Folletos)
      };
    });
  }

  function buildCoverage(rawCoverage, operators){
    const byId=new Map(), byName=new Map();
    operators.forEach(op=>{
      if(clean(op.ID_Operador)) byId.set(clean(op.ID_Operador),op);
      if(clean(op.Operador_Normalizado)) byName.set(fold(op.Operador_Normalizado),op);
    });
    return rawCoverage.filter(r=>clean(r.ID_Cobertura)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)).map(r=>{
      const op=byId.get(clean(r.ID_Operador)) || byName.get(fold(r.Operador_Normalizado)) || {};
      return {
        ...r,
        Periodo_Corte:periodValue(r.Periodo_Corte),
        Periodo_Label:formatPeriod(r.Periodo_Corte),
        Grupo_Operador:clean(op.Grupo_Operador)||clean(op.Marca_Comercial)||clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)
      };
    });
  }

  function buildRelevamientos(raw,operators){
    const byId=new Map(operators.map(o=>[clean(o.ID_Operador),o]));
    return raw.filter(r=>fold(r.Tipo_Registro)==="observacion ffvv").map(r=>{
      const op=byId.get(clean(r.ID_Operador))||{};
      return {...r,Grupo_Operador:clean(op.Grupo_Operador)||clean(op.Operador_Normalizado)||clean(r.Operador_Original),Periodo_Label:formatPeriod(r.Periodo_Corte)};
    });
  }

  function buildOffers(raw){
    return raw.filter(r=>clean(r.ID_Oferta)).map(r=>({...r,Velocidad_Mbps:toNum(r.Velocidad_Mbps),Precio_COP:toNum(r.Precio_COP),Dias:toNum(r.Dias)}));
  }

  function availablePeriods(){
    return [...new Set(state.plans.map(r=>periodValue(r.Periodo_Corte)).filter(Boolean))].sort((a,b)=>periodSortValue(a)-periodSortValue(b));
  }
  function ensurePeriodSelection(){
    if(state.filters.period.size) return;
    const periods=availablePeriods();
    if(periods.length) state.filters.period.add(formatPeriod(periods[periods.length-1]));
  }

  function buildMarkets(raw){
    return raw.filter(r=>clean(r.Ciudad)).map(r=>({...r,Orden_Dashboard:toNum(r.Orden_Dashboard)||999})).sort((a,b)=>a.Orden_Dashboard-b.Orden_Dashboard||clean(a.Ciudad).localeCompare(clean(b.Ciudad),"es"));
  }

  function selectedPeriodValue(){
    const label=[...state.filters.period][0]||"";
    const row=state.plans.find(r=>r.Periodo_Label===label);
    return row?.Periodo_Corte||availablePeriods().at(-1)||"";
  }

  function marketAppliesToPeriod(m){
    const period=selectedPeriodValue();
    if(!period) return true;
    const start=periodValue(m.Activo_Desde), end=periodValue(m.Activo_Hasta);
    if(start && periodSortValue(period)<periodSortValue(start)) return false;
    if(end && periodSortValue(period)>periodSortValue(end)) return false;
    return true;
  }

  function fibrazoMarkets(){
    return state.markets.filter(m=>fold(m.Mercado_FIBRAZO)==="si" && fold(m.Es_Default_Scope)==="si" && marketAppliesToPeriod(m));
  }

  function quickMarkets(){
    return state.markets.filter(m=>fold(m.Mostrar_Acceso_Rapido)==="si" && marketAppliesToPeriod(m));
  }

  function fibrazoCitySet(){ return new Set(fibrazoMarkets().map(m=>clean(m.Ciudad)).filter(Boolean)); }

  function cityScopeAllows(city){
    const value=clean(city);
    if(state.filters.city.size) return state.filters.city.has(value);
    if(state.cityScopeMode==="all") return true;
    if(state.cityScopeMode==="fibrazo"){
      const set=fibrazoCitySet();
      return !set.size || set.has(value);
    }
    return true;
  }

  function allRelevantCities(){
    return [...new Set([
      ...state.markets.map(m=>clean(m.Ciudad)),
      ...state.plans.map(r=>clean(r.Ciudad)),
      ...state.coverage.map(r=>clean(r.Ciudad))
    ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  }

  function setCityScope(mode,cities=[]){
    state.cityScopeMode=mode;
    state.filters.city.clear();
    cities.filter(Boolean).forEach(c=>state.filters.city.add(c));
    state.expanded=false;
    renderCityQuickbar();
    renderFilters();
    applyFilters();
  }

  function toggleCitySelection(city){
    const value=clean(city);
    if(!value) return;
    state.cityScopeMode="custom";
    if(state.filters.city.has(value)) state.filters.city.delete(value);
    else state.filters.city.add(value);
    if(!state.filters.city.size) state.cityScopeMode="fibrazo";
    state.expanded=false;
    renderCityQuickbar();
    renderFilters();
    applyFilters();
  }

  function selectedCitiesCount(){ return state.filters.city.size; }

  function renderCityQuickbar(){
    const root=$("city-quickbar"); if(!root)return;
    root.innerHTML="";
    const quick=quickMarkets();
    const quickNames=new Set(quick.map(m=>clean(m.Ciudad)));

    const makeButton=(label,active,onClick,extraClass="")=>{
      const b=document.createElement("button");
      b.type="button"; b.className=`city-chip ${extraClass} ${active?"active":""}`.trim(); b.textContent=label;
      b.addEventListener("click",onClick); return b;
    };

    root.appendChild(makeButton("Todas FIBRAZO",state.cityScopeMode==="fibrazo"&&!state.filters.city.size,()=>setCityScope("fibrazo"),"scope-all"));

    quick.forEach(m=>{
      const city=clean(m.Ciudad);
      const active=state.cityScopeMode==="custom"&&state.filters.city.has(city);
      const cls=fold(m.Prioridad_Visual)==="principal"?"principal":"";
      root.appendChild(makeButton(city,active,()=>toggleCitySelection(city),cls));
    });

    const wrap=document.createElement("div"); wrap.className="city-more-wrap";
    const selectedOther=[...state.filters.city].filter(c=>!quickNames.has(c));
    const totalSelected=selectedCitiesCount();
    const moreActive=state.cityScopeMode==="all"||selectedOther.length>0;
    const moreLabel=totalSelected>0?`+ Más · ${totalSelected}`:"+ Más";
    const moreBtn=makeButton(moreLabel,moreActive,e=>{
      e.stopPropagation();
      wrap.querySelector(".city-more-menu").classList.toggle("hidden");
      wrap.querySelector(".city-more-search")?.focus();
    },"more");
    wrap.appendChild(moreBtn);

    const menu=document.createElement("div"); menu.className="city-more-menu hidden";
    menu.innerHTML=`<button class="city-all-relevant" type="button">Todas las ciudades relevadas</button><div class="city-more-divider"></div><span class="city-more-title">Otras ciudades relevadas</span><input class="city-more-search" type="search" placeholder="Buscar ciudad…"><div class="city-more-options"></div>`;
    menu.addEventListener("click",e=>e.stopPropagation());
    menu.querySelector(".city-all-relevant").addEventListener("click",()=>setCityScope("all"));
    const search=menu.querySelector(".city-more-search"), optionsBox=menu.querySelector(".city-more-options");

    const paint=(q="")=>{
      const others=allRelevantCities().filter(c=>!quickNames.has(c)&&fold(c).includes(fold(q)));
      optionsBox.innerHTML="";
      others.forEach(city=>{
        const row=document.createElement("label"); row.className="city-more-option";
        row.innerHTML=`<input type="checkbox" ${state.filters.city.has(city)?"checked":""}><span>${escapeHtml(city)}</span>`;
        row.querySelector("input").addEventListener("change",e=>{
          state.cityScopeMode="custom";
          if(e.target.checked) state.filters.city.add(city); else state.filters.city.delete(city);
          if(!state.filters.city.size) state.cityScopeMode="fibrazo";
          state.expanded=false;
          renderCityQuickbar();
          renderFilters();
          applyFilters();
        });
        optionsBox.appendChild(row);
      });
      if(!others.length) optionsBox.innerHTML='<span class="filter-empty">Sin ciudades compatibles</span>';
    };
    search.addEventListener("input",()=>paint(search.value)); paint();
    wrap.appendChild(menu); root.appendChild(wrap);
  }

  async function load({silent=false}={}){
    if(state.loading) return;
    state.loading=true;
    if(!silent && $("refresh-btn")){ $("refresh-btn").disabled=true; $("refresh-btn").textContent="Actualizando…"; }
    try{
      const [plansRes, operatorsRes, coverageRes, marketsRes, territoriesRes, offersRes, relevamientosRes]=await Promise.allSettled([
        fetchCsv(SOURCES.plans), fetchCsv(SOURCES.operators), fetchCsv(SOURCES.coverage), fetchCsv(SOURCES.markets),
        fetchCsv(SOURCES.territories), fetchCsv(SOURCES.offers), fetchCsv(SOURCES.relevamientos)
      ]);
      if(plansRes.status!=="fulfilled") throw plansRes.reason;
      if(operatorsRes.status!=="fulfilled") throw operatorsRes.reason;
      if(marketsRes.status!=="fulfilled") throw marketsRes.reason;
      state.operators=operatorsRes.value;
      state.plans=buildPlans(plansRes.value,operatorsRes.value);
      state.coverage=coverageRes.status==="fulfilled"?buildCoverage(coverageRes.value,operatorsRes.value):[];
      state.markets=buildMarkets(marketsRes.value);
      state.territories=territoriesRes.status==="fulfilled"?territoriesRes.value.filter(r=>clean(r.ID_Territorio)):[];
      state.offers=offersRes.status==="fulfilled"?buildOffers(offersRes.value):[];
      state.relevamientos=relevamientosRes.status==="fulfilled"?buildRelevamientos(relevamientosRes.value,operatorsRes.value):[];
      ensurePeriodSelection();
      state.lastLoadAt=Date.now();
      $("last-load").textContent=new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short"}).format(new Date());
      removeErrorBox(); renderCityQuickbar(); renderFilters(); applyFilters();
    }catch(error){
      console.error(error); showError(error.message||String(error));
    }finally{
      state.loading=false;
      if($("refresh-btn")){ $("refresh-btn").disabled=false; $("refresh-btn").textContent="Actualizar"; }
    }
  }

  function showError(message){
    removeErrorBox();
    document.querySelector("main").insertAdjacentHTML("afterbegin",`<div id="source-error" class="error-box"><strong>No fue posible cargar Base General.</strong><br>${escapeHtml(message)}</div>`);
  }
  function removeErrorBox(){ const el=$("source-error"); if(el)el.remove(); }

  function filterDef(key){ return filterDefs.find(d=>d.key===key); }
  function rowPassesFilters(r, skipKey=null){
    if(skipKey!=="city" && !cityScopeAllows(r.Ciudad)) return false;
    return filterDefs.every(def=>{
      if(def.key===skipKey) return true;
      const set=state.filters[def.key];
      return !set.size || set.has(def.getter(r));
    });
  }
  function coveragePassesFilters(r, skipKey=null, includePeriod=true){
    const checks={
      period:clean(r.Periodo_Label),
      city:clean(r.Ciudad),
      operator:clean(r.Grupo_Operador)||clean(r.Operador_Normalizado),
      technology:clean(r.Tecnologia)||"No informado"
    };
    if(skipKey!=="city" && !cityScopeAllows(r.Ciudad)) return false;
    return ["period","city","operator","technology"].every(key=>{
      if(key===skipKey || (!includePeriod&&key==="period")) return true;
      const set=state.filters[key];
      return !set.size || set.has(checks[key]);
    });
  }
  function hasPlanSpecificFilters(){ return state.filters.modality.size>0 || state.filters.price.size>0; }

  function renderFilters(){
    const root=$("filters"); root.innerHTML="";
    filterDefs.forEach(def=>{
      if(def.key==="city") return;
      const {key,label,getter}=def;
      const baseRows=key==="period" ? state.plans : state.plans.filter(r=>rowPassesFilters(r,key));
      let options=[...new Set(baseRows.map(getter).filter(Boolean))];
      if(!hasPlanSpecificFilters() && (key==="operator" || key==="city")){
        const coverageOptions=state.coverage.filter(r=>coveragePassesFilters(r,key)).map(r=>key==="operator"?(clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)):clean(r.Ciudad)).filter(Boolean);
        options=[...new Set([...options,...coverageOptions])];
      }
      if(key==="period"){
        options.sort((a,b)=>{
          const ar=state.plans.find(r=>r.Periodo_Label===a)?.Periodo_Corte||"";
          const br=state.plans.find(r=>r.Periodo_Label===b)?.Periodo_Corte||"";
          return periodSortValue(br)-periodSortValue(ar);
        });
      }else options.sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));

      if(key!=="period"){
        for(const selected of [...state.filters[key]]) if(!options.includes(selected)) state.filters[key].delete(selected);
      }

      const wrap=document.createElement("div"); wrap.className="filter";
      wrap.innerHTML=`<label class="filter-label">${escapeHtml(label)}</label><button class="filter-btn" type="button"><span data-label>${escapeHtml(def.allLabel||"Todos")}</span><span>⌄</span></button><div class="filter-menu hidden"><input class="filter-search" placeholder="Buscar…"><div class="filter-options"></div></div>`;
      const btn=wrap.querySelector(".filter-btn"), menu=wrap.querySelector(".filter-menu"), box=wrap.querySelector(".filter-options"), search=wrap.querySelector(".filter-search");
      const paint=(query="")=>{
        box.innerHTML="";
        options.filter(o=>fold(o).includes(fold(query))).forEach(o=>{
          const row=document.createElement("label"); row.className="filter-option";
          const type="checkbox";
          row.innerHTML=`<input type="${type}" ${state.filters[key].has(o)?"checked":""}><span>${escapeHtml(o)}</span>`;
          row.querySelector("input").addEventListener("change",e=>{
            if(e.target.checked){
              if(def.maxSelections && state.filters[key].size>=def.maxSelections){
                e.target.checked=false;
                return;
              }
              state.filters[key].add(o);
            }else{
              state.filters[key].delete(o);
              if(key==="period" && !state.filters.period.size) ensurePeriodSelection();
            }
            state.expanded=false;
            if(key==="period") renderCityQuickbar();
            renderFilters();
            applyFilters();
          });
          box.appendChild(row);
        });
        if(!box.children.length) box.innerHTML='<span class="filter-empty">Sin opciones compatibles</span>';
      };
      btn.addEventListener("click",e=>{
        e.stopPropagation();
        document.querySelectorAll(".filter-menu").forEach(m=>{if(m!==menu)m.classList.add("hidden")});
        menu.classList.toggle("hidden");
        if(!menu.classList.contains("hidden")){search.focus();paint(search.value);}
      });
      menu.addEventListener("click",e=>e.stopPropagation());
      search.addEventListener("input",()=>paint(search.value));
      root.appendChild(wrap); paint(); updateFilterLabel(wrap,def);
    });
  }
  function updateFilterLabel(wrap,def){
    const set=state.filters[def.key], n=set.size;
    const btn=wrap.querySelector(".filter-btn");
    wrap.querySelector("[data-label]").textContent=n===0?(def.allLabel||"Todos"):n===1?[...set][0]:`${n} seleccionados`;
    btn?.classList.toggle("active",n>0);
  }

  function planPasses(r){ return rowPassesFilters(r); }
  function evolutionPasses(r){ return rowPassesFilters(r,"period"); }

  function effectiveCityCount(){
    if(state.filters.city.size) return state.filters.city.size;
    if(state.cityScopeMode==="fibrazo") return fibrazoCitySet().size;
    if(state.cityScopeMode==="all") return allRelevantCities().length;
    return 0;
  }

  function isSingleOperatorSingleCity(){
    return state.filters.operator.size===1 && effectiveCityCount()===1;
  }

  function updateSectionVisibility(){
    const inGeneral=state.analysisView==="general";
    const compareCuts=state.filters.period.size===2;
    $("evolution-section")?.classList.toggle("hidden",!inGeneral||!compareCuts);

    const hideOperatorRankings=isSingleOperatorSingleCity();
    ["operator-price-panel","operator-speed-panel"].forEach(id=>$(id)?.classList.toggle("hidden",!inGeneral||hideOperatorRankings));

    if(state.analysisView==="territory") $("coverage-ranking-panel")?.classList.toggle("hidden",effectiveCityCount()<=1);
  }

  function applyFilters(){
    state.filtered=state.plans.filter(planPasses);
    if(hasPlanSpecificFilters()){
      const allowed=new Set(state.filtered.map(r=>[`${r.Periodo_Label}`,clean(r.Ciudad),clean(r.Grupo_Operador)].join("|")));
      state.filteredCoverage=state.coverage.filter(r=>allowed.has([`${r.Periodo_Label}`,clean(r.Ciudad),clean(r.Grupo_Operador)].join("|")) && coveragePassesFilters(r));
    }else{
      state.filteredCoverage=state.coverage.filter(r=>coveragePassesFilters(r));
    }
    const selectedPeriods=new Set([...state.filters.period]);
    state.filteredFFVV=state.relevamientos.filter(r=>{
      if(selectedPeriods.size && !selectedPeriods.has(clean(r.Periodo_Label))) return false;
      if(!cityScopeAllows(r.Ciudad)) return false;
      if(state.filters.operator.size && !state.filters.operator.has(clean(r.Grupo_Operador))) return false;
      return true;
    });
    updateSectionVisibility();
    renderKPIs(); renderEvolution(); renderCharts(); renderCoverage(); renderTable(); renderFibrazoComparison(); renderFFVV();
  }

  function renderKPIs(){
    const d=state.filtered;
    const operators=new Set([...d.map(r=>clean(r.Grupo_Operador)),...state.filteredCoverage.map(r=>clean(r.Grupo_Operador))].filter(Boolean));
    const cities=new Set([...d.map(r=>clean(r.Ciudad)),...state.filteredCoverage.map(r=>clean(r.Ciudad))].filter(Boolean));
    const prices=d.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0);
    const speeds=d.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    $("kpi-operators").textContent=formatNum(operators.size);
    $("kpi-cities-note").textContent=`${formatNum(cities.size)} ciudades con datos`;
    $("kpi-plans").textContent=formatNum(d.length);
    $("kpi-min-price").textContent=prices.length?formatCOP(Math.min(...prices)):"—";
    $("kpi-max-price").textContent=prices.length?formatCOP(Math.max(...prices)):"—";
    $("kpi-min-speed").textContent=speeds.length?formatNum(Math.min(...speeds)):"—";
    $("kpi-max-speed").textContent=speeds.length?formatNum(Math.max(...speeds)):"—";
  }

  function shortNames(items){
    const a=[...items].filter(Boolean);
    if(!a.length) return "Sin cambios";
    return a.length<=3?a.join(", "):`${a.slice(0,3).join(", ")} +${a.length-3}`;
  }

  function rangeByOperator(rows,key){
    const m=new Map();
    rows.forEach(r=>{
      const op=clean(r.Grupo_Operador), value=toNum(r[key]);
      if(!op||!(value>0)) return;
      if(!m.has(op))m.set(op,[]);
      m.get(op).push(value);
    });
    return new Map([...m.entries()].map(([op,arr])=>[op,{min:Math.min(...arr),max:Math.max(...arr),count:arr.length}]));
  }

  function renderEvolution(){
    destroyChart("evoCompetitors");
    destroyChart("evoPrice");
    if(state.filters.period.size!==2) return;

    const selected=[...state.filters.period].map(label=>{
      const row=state.plans.find(r=>r.Periodo_Label===label);
      return row?.Periodo_Corte||"";
    }).filter(Boolean).sort((a,b)=>periodSortValue(a)-periodSortValue(b));
    if(selected.length!==2) return;
    const [previous,current]=selected;
    $("evolution-current").textContent=formatPeriod(current);
    $("evolution-compare").textContent=`vs. ${formatPeriod(previous)}`;

    const filteredHistory=state.plans.filter(evolutionPasses);
    const rowsFor=p=>filteredHistory.filter(r=>r.Periodo_Corte===p);
    const coverageFor=p=>state.coverage.filter(r=>r.Periodo_Corte===p && coveragePassesFilters(r,null,false));
    const presenceFor=p=>{
      const set=new Set(rowsFor(p).map(r=>clean(r.Grupo_Operador)).filter(Boolean));
      if(!hasPlanSpecificFilters()) coverageFor(p).forEach(r=>{const op=clean(r.Grupo_Operador)||clean(r.Operador_Normalizado);if(op)set.add(op)});
      return set;
    };

    const currentRows=rowsFor(current), previousRows=rowsFor(previous);
    const currentOps=presenceFor(current), previousOps=presenceFor(previous);
    const added=[...currentOps].filter(x=>!previousOps.has(x));
    const lost=[...previousOps].filter(x=>!currentOps.has(x));
    $("evo-new").textContent=formatNum(added.length);
    $("evo-lost").textContent=formatNum(lost.length);
    $("evo-new-note").textContent=shortNames(added);
    $("evo-lost-note").textContent=shortNames(lost);

    const curPrice=rangeByOperator(currentRows,"Precio_Usado_COP");
    const prevPrice=rangeByOperator(previousRows,"Precio_Usado_COP");
    const changed=[...curPrice.keys()].filter(op=>prevPrice.has(op)&&(Math.abs(curPrice.get(op).min-prevPrice.get(op).min)>=1||Math.abs(curPrice.get(op).max-prevPrice.get(op).max)>=1));
    $("evo-price-change").textContent=formatNum(changed.length);
    $("evo-price-note").textContent=shortNames(changed);

    let opt=chartDefaults();
    state.charts.evoCompetitors=new Chart($("competitors-evolution-chart"),{type:"line",data:{labels:selected.map(formatPeriod),datasets:[{label:"Competidores",data:selected.map(p=>presenceFor(p).size),borderColor:"#00F29A",backgroundColor:"rgba(0,242,154,.10)",pointBackgroundColor:"#00F29A",pointRadius:4,tension:.2,fill:true}]},options:{...opt,plugins:{...opt.plugins,legend:{display:false}},scales:{x:{...opt.scales.x},y:{...opt.scales.y,beginAtZero:true,ticks:{precision:0}}}}});

    opt=chartDefaults();
    const ranges=selected.map(p=>rowsFor(p).map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0));
    state.charts.evoPrice=new Chart($("price-evolution-chart"),{type:"line",data:{labels:selected.map(formatPeriod),datasets:[
      {label:"Mínimo",data:ranges.map(a=>a.length?Math.min(...a):null),borderColor:"#00F29A",pointBackgroundColor:"#00F29A",pointRadius:4,tension:.2},
      {label:"Máximo",data:ranges.map(a=>a.length?Math.max(...a):null),borderColor:"#F5D547",pointBackgroundColor:"#F5D547",pointRadius:4,tension:.2}
    ]},options:{...opt,plugins:{...opt.plugins,legend:{display:true,position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>`${c.dataset.label}: ${formatCOP(c.raw)}`}}},scales:{x:{...opt.scales.x},y:{...opt.scales.y,ticks:{callback:v=>`$${Math.round(v/1000)}k`}}}}});
  }

  function chartDefaults(){
    Chart.defaults.color="#8FA9A0"; Chart.defaults.font.family="Inter"; Chart.defaults.font.size=10;
    return {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{backgroundColor:"#07100c",borderColor:"#1B3028",borderWidth:1,titleColor:"#F4FFF9",bodyColor:"#dce9e4"}},scales:{x:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}},y:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}}}};
  }
  function destroyChart(key){if(state.charts[key]){state.charts[key].destroy();delete state.charts[key];}}
  function countBy(rows,key){const m=new Map();rows.forEach(r=>{const v=clean(r[key])||"No informado";m.set(v,(m.get(v)||0)+1)});return[...m.entries()].sort((a,b)=>b[1]-a[1]);}

  const operatorPalette=["#00F29A","#4D96FF","#FF5C70","#F5D547","#A66A3F","#FF9F43","#45D7E8","#A56EFF"];
  const hexToRgba=(hex,alpha)=>{
    const value=hex.replace("#","");
    const n=parseInt(value,16);
    const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return `rgba(${r},${g},${b},${alpha})`;
  };

  function setAdaptiveChartHeight(canvasId, itemCount, {min=320,row=34,max=760}={}){
    const canvas=$(canvasId);
    if(!canvas) return;
    const panel=canvas.closest(".chart-panel");
    const height=Math.max(min,Math.min(max,120+itemCount*row));
    if(panel){
      panel.style.height=`${height}px`;
      panel.style.minHeight=`${height}px`;
      panel.style.maxHeight=`${height}px`;
    }
    canvas.style.height="";
    canvas.style.maxHeight="";
  }

  function renderCharts(){
    const rows=state.filtered;

    destroyChart("scatter");
    const points=rows.map(r=>({x:toNum(r.Velocidad_Bajada_Mbps),y:toNum(r.Precio_Usado_COP),operator:clean(r.Grupo_Operador),city:clean(r.Ciudad)})).filter(p=>p.x>0&&p.y>0);
    let opt=chartDefaults();
    state.charts.scatter=new Chart($("scatter-chart"),{type:"scatter",data:{datasets:[{label:"Planes",data:points,pointRadius:4,pointHoverRadius:6,backgroundColor:"rgba(0,242,154,.72)"}]},options:{...opt,plugins:{...opt.plugins,tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>`${c.raw.operator} · ${c.raw.city}: ${formatNum(c.raw.x)} Mbps · ${formatCOP(c.raw.y)}`}}},scales:{x:{...opt.scales.x,title:{display:true,text:"Mbps"}},y:{...opt.scales.y,title:{display:true,text:"COP"},ticks:{callback:v=>`$${Math.round(v/1000)}k`}}}}});

    if(isSingleOperatorSingleCity()){
      destroyChart("operators");
      destroyChart("speeds");
      return;
    }

    const priceRanges=[...rangeByOperator(rows,"Precio_Usado_COP").entries()].sort((a,b)=>a[1].min-b[1].min).slice(0,14);
    const priceColors=priceRanges.map((_,i)=>operatorPalette[i%operatorPalette.length]);
    setAdaptiveChartHeight("operators-chart",priceRanges.length,{min:320,row:36,max:760});
    destroyChart("operators"); opt=chartDefaults();
    state.charts.operators=new Chart($("operators-chart"),{
      type:"bar",
      data:{
        labels:priceRanges.map(x=>x[0]),
        datasets:[
          {label:"Mínimo",data:priceRanges.map(x=>x[1].min),backgroundColor:priceColors.map(c=>hexToRgba(c,.52)),borderColor:priceColors,borderWidth:1,borderRadius:5},
          {label:"Máximo",data:priceRanges.map(x=>x[1].max),backgroundColor:priceColors.map(c=>hexToRgba(c,.92)),borderColor:priceColors,borderWidth:1,borderRadius:5}
        ]
      },
      options:{
        ...opt,indexAxis:"y",
        layout:{padding:{left:8,right:10}},
        plugins:{...opt.plugins,legend:{position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>`${c.dataset.label}: ${formatCOP(c.raw)}`}}},
        scales:{
          x:{...opt.scales.x,ticks:{callback:v=>`$${Math.round(v/1000)}k`}},
          y:{...opt.scales.y,ticks:{autoSkip:false,padding:8,font:{size:10}}}
        }
      }
    });

    const speedRanges=[...rangeByOperator(rows,"Velocidad_Bajada_Mbps").entries()].sort((a,b)=>b[1].max-a[1].max).slice(0,14);
    const speedColors=speedRanges.map((_,i)=>operatorPalette[i%operatorPalette.length]);
    setAdaptiveChartHeight("speeds-chart",speedRanges.length,{min:320,row:36,max:760});
    destroyChart("speeds"); opt=chartDefaults();
    state.charts.speeds=new Chart($("speeds-chart"),{
      type:"bar",
      data:{
        labels:speedRanges.map(x=>x[0]),
        datasets:[
          {label:"Mínimo",data:speedRanges.map(x=>x[1].min),backgroundColor:speedColors.map(c=>hexToRgba(c,.52)),borderColor:speedColors,borderWidth:1,borderRadius:5},
          {label:"Máximo",data:speedRanges.map(x=>x[1].max),backgroundColor:speedColors.map(c=>hexToRgba(c,.92)),borderColor:speedColors,borderWidth:1,borderRadius:5}
        ]
      },
      options:{
        ...opt,indexAxis:"y",
        layout:{padding:{left:8,right:10}},
        plugins:{...opt.plugins,legend:{position:"bottom"},tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>`${c.dataset.label}: ${formatNum(c.raw)} Mbps`}}},
        scales:{
          x:{...opt.scales.x,title:{display:true,text:"Mbps"}},
          y:{...opt.scales.y,ticks:{autoSkip:false,padding:8,font:{size:10}}}
        }
      }
    });
  }

  function renderCoverage(){
    const rows=state.filteredCoverage;
    $("coverage-visible").textContent=formatNum(rows.length);
    const grouped=new Map();
    rows.forEach(r=>{
      const city=clean(r.Ciudad)||"No informado";
      const op=clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)||"No informado";
      if(!grouped.has(city))grouped.set(city,new Set());
      grouped.get(city).add(op);
    });
    const data=[...grouped.entries()].map(([city,set])=>[city,set.size]).sort((a,b)=>b[1]-a[1]);
    const totalPairs=data.reduce((s,[,n])=>s+n,0)||1;
    const root=$("coverage-ranking"); root.innerHTML="";
    data.slice(0,12).forEach(([city,count])=>{
      const pct=count/totalPairs*100;
      const row=document.createElement("div"); row.className="coverage-rank-row";
      row.innerHTML=`<div class="coverage-rank-name">${escapeHtml(city)}</div><div class="coverage-rank-track"><span style="width:${Math.max(3,pct)}%"></span></div><strong>${formatNum(count)}</strong><b>${pct.toFixed(1).replace(".",",")}%</b>`;
      root.appendChild(row);
    });
    if(!data.length)root.innerHTML='<span class="subtitle">Sin presencia observada compatible con los filtros.</span>';

    const territoryGroups=new Map();
    rows.forEach(r=>{
      const city=clean(r.Ciudad)||"—";
      const zone=clean(r.Zona_FIBRAZO), trunk=clean(r.Troncal_FIBRAZO);
      const barrio=clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ);
      const place=[city,barrio||zone||trunk||"Nivel ciudad"].filter(Boolean).join(" · ");
      const extra=[zone?`Zona: ${zone}`:"",trunk?`Troncal: ${trunk}`:""].filter(Boolean).join(" · ");
      const key=place+"|"+extra;
      if(!territoryGroups.has(key))territoryGroups.set(key,{place,extra,ops:new Set()});
      territoryGroups.get(key).ops.add(clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)||"No informado");
    });
    const list=$("coverage-list"); list.innerHTML="";
    [...territoryGroups.values()].sort((a,b)=>a.place.localeCompare(b.place,"es")).slice(0,80).forEach(g=>{
      const el=document.createElement("div"); el.className="territory-group";
      el.innerHTML=`<div><strong>${escapeHtml(g.place)}</strong>${g.extra?`<small>${escapeHtml(g.extra)}</small>`:""}</div><p>${[...g.ops].sort((a,b)=>a.localeCompare(b,"es")).map(escapeHtml).join(" · ")}</p>`;
      list.appendChild(el);
    });
    if(!rows.length)list.innerHTML='<span class="subtitle">Sin presencia observada compatible con los filtros.</span>';
  }

  function offerLabel(o){
    const trunk=clean(o.Troncal_FIBRAZO)?` · ${clean(o.Troncal_FIBRAZO)}`:"";
    return `${clean(o.Ciudad)}${trunk} · ${clean(o.Servicio)} · ${formatNum(o.Velocidad_Mbps)} Mbps · ${formatCOP(o.Precio_COP)} · ${clean(o.Etapa_Vigencia)}`;
  }

  function compatibleOffers(){
    const cities=state.filters.city.size?state.filters.city:fibrazoCitySet();
    const rows=state.offers.filter(o=>!cities.size||cities.has(clean(o.Ciudad)));
    const seen=new Set();
    return rows.filter(o=>{
      const k=[o.Servicio,o.Velocidad_Mbps,o.TV,o.Precio_COP,o.Etapa_Vigencia,o.Troncal_FIBRAZO].join("|");
      if(seen.has(k))return false;
      seen.add(k); return true;
    });
  }

  function renderFibrazoComparison(){
    const select=$("fibrazo-offer-select"); if(!select)return;
    const offers=compatibleOffers();
    if(!offers.length){select.innerHTML="<option>Sin oferta compatible</option>"; $("fibrazo-compare-body").innerHTML=""; return;}
    if(!state.selectedOfferKey || !offers.some(o=>o.ID_Oferta===state.selectedOfferKey)){
      const preferred=offers.find(o=>clean(o.Servicio)==="Internet"&&o.Velocidad_Mbps===400&&clean(o.Etapa_Vigencia)==="Precio normal")||offers[0];
      state.selectedOfferKey=preferred.ID_Oferta;
    }
    select.innerHTML=offers.map(o=>`<option value="${escapeHtml(o.ID_Oferta)}" ${o.ID_Oferta===state.selectedOfferKey?"selected":""}>${escapeHtml(offerLabel(o))}</option>`).join("");
    const fz=offers.find(o=>o.ID_Oferta===state.selectedOfferKey)||offers[0];
    $("fz-price").textContent=formatCOP(fz.Precio_COP);
    $("fz-speed").textContent=formatNum(fz.Velocidad_Mbps);
    $("fz-offer-name").textContent=`${fz.Servicio} · ${fz.Etapa_Vigencia}`;
    const best=new Map();
    state.filtered.forEach(r=>{
      const op=clean(r.Grupo_Operador), price=toNum(r.Precio_Usado_COP);
      if(!op||!(price>0))return;
      const cur=best.get(op); if(!cur||price<toNum(cur.Precio_Usado_COP))best.set(op,r);
    });
    const rows=[...best.values()].sort((a,b)=>toNum(a.Precio_Usado_COP)-toNum(b.Precio_Usado_COP));
    $("fz-better-price").textContent=formatNum(rows.filter(r=>toNum(r.Precio_Usado_COP)<fz.Precio_COP).length);
    $("fz-better-speed").textContent=formatNum(rows.filter(r=>toNum(r.Velocidad_Bajada_Mbps)>fz.Velocidad_Mbps).length);
    $("fibrazo-compare-body").innerHTML=rows.map(r=>{
      const p=toNum(r.Precio_Usado_COP), s=toNum(r.Velocidad_Bajada_Mbps), dp=p-fz.Precio_COP, ds=(s??0)-fz.Velocidad_Mbps;
      const dpLabel=dp===0?"=":`${dp>0?"+":""}${formatCOP(dp).replace("COP","").trim()}`;
      return `<tr><td><strong>${escapeHtml(r.Grupo_Operador)}</strong></td><td>${formatCOP(p)}</td><td>${s==null?"—":formatNum(s)+" Mbps"}</td><td class="${dp<=0?"negative":"positive"}">${dpLabel}</td><td class="${ds>=0?"positive":"negative"}">${ds>0?"+":""}${formatNum(ds)}</td><td>${escapeHtml(clean(r.Tecnologia)||"—")}</td><td>${escapeHtml(normalizeTV(r.TV_Incluida))}</td></tr>`;
    }).join("");
  }

  function renderFFVV(){
    const rows=state.filteredFFVV;
    $("ffvv-count").textContent=formatNum(rows.length);
    $("ffvv-operators").textContent=formatNum(new Set(rows.map(r=>clean(r.Grupo_Operador)).filter(Boolean)).size);
    $("ffvv-clause-yes").textContent=formatNum(rows.filter(r=>["si","sí"].includes(fold(r.Clausula))).length);
    $("ffvv-clause-no").textContent=formatNum(rows.filter(r=>fold(r.Clausula)==="no").length);
    $("ffvv-notes").textContent=formatNum(rows.filter(r=>clean(r.Observacion_Campo)).length);
    const m=new Map();
    rows.forEach(r=>{
      const op=clean(r.Grupo_Operador)||clean(r.Operador_Original)||"No identificado";
      if(!m.has(op))m.set(op,{n:0,p:[],s:[],t:new Set(),svc:[]});
      const x=m.get(op); x.n++;
      const p=toNum(r.Precio_COP), s=toNum(r.Velocidad_Mbps), svc=toNum(r.Servicio_1_5);
      if(p>0)x.p.push(p); if(s>0)x.s.push(s); if(svc>0)x.svc.push(svc);
      if(clean(r.Tecnologia_Declarada))x.t.add(clean(r.Tecnologia_Declarada));
    });
    $("ffvv-summary-body").innerHTML=[...m.entries()].sort((a,b)=>b[1].n-a[1].n).map(([op,x])=>{
      const pr=x.p.length?`${formatCOP(Math.min(...x.p))} – ${formatCOP(Math.max(...x.p))}`:"—";
      const sp=x.s.length?`${formatNum(Math.min(...x.s))} – ${formatNum(Math.max(...x.s))} Mbps`:"—";
      const svc=x.svc.length?`${formatNum(Math.min(...x.svc))} – ${formatNum(Math.max(...x.svc))}`:"—";
      return `<tr><td><strong>${escapeHtml(op)}</strong></td><td>${formatNum(x.n)}</td><td>${pr}</td><td>${sp}</td><td>${escapeHtml([...x.t].join(" / ")||"—")}</td><td>${svc}</td></tr>`;
    }).join("");
  }

  function tableRows(){
    const q=fold(state.tableSearch);
    const rows=state.filtered.filter(r=>!q||columns.some(([k])=>fold(r[k]).includes(q)));
    const {key,dir}=state.sort;
    return [...rows].sort((a,b)=>{
      if(key==="Periodo_Label") return (periodSortValue(a.Periodo_Corte)-periodSortValue(b.Periodo_Corte))*dir;
      const an=toNum(a[key]),bn=toNum(b[key]);
      if(an!=null&&bn!=null) return (an-bn)*dir;
      return clean(a[key]).localeCompare(clean(b[key]),"es",{numeric:true})*dir;
    });
  }

  function diverseInitialRows(rows, limit=10){
    const picked=[], seenCities=new Set(), used=new Set();
    for(const r of rows){
      const city=clean(r.Ciudad)||"Sin ciudad";
      const id=clean(r.ID_Plan_Registro)||`${city}|${clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)}|${picked.length}`;
      if(!seenCities.has(city)){
        picked.push(r); seenCities.add(city); used.add(id);
        if(picked.length>=limit) return picked;
      }
    }
    for(const r of rows){
      const id=clean(r.ID_Plan_Registro)||`${clean(r.Ciudad)}|${clean(r.Grupo_Operador)||clean(r.Operador_Normalizado)}|${picked.length}`;
      if(!used.has(id)){
        picked.push(r); used.add(id);
        if(picked.length>=limit) break;
      }
    }
    return picked;
  }

  function formatCell(key,value){
    if(linkFields.has(key)) return linkCell(value,key);
    if(phoneFields.has(key)) return phoneCell(value);
    const n=toNum(value);
    if(key==="Precio_Usado_COP") return escapeHtml(formatCOP(n));
    if(["Velocidad_Bajada_Mbps","Permanencia_Meses"].includes(key)) return n==null?escapeHtml(clean(value)||"—"):escapeHtml(formatNum(n));
    if(key==="Periodo_Label") return escapeHtml(clean(value)||"Sin corte");
    if(key==="Fecha_Mes") return escapeHtml(clean(value)||"Sin info");
    return escapeHtml(clean(value)||"—");
  }

  function renderTable(){
    const rows=tableRows(), cols=columns.filter(([k])=>!state.hiddenColumns.has(k));
    $("table-head").innerHTML=`<tr>${cols.map(([k,l])=>`<th data-key="${escapeHtml(k)}">${escapeHtml(l)}${state.sort.key===k?`<span class="sort-mark">${state.sort.dir===1?"▲":"▼"}</span>`:""}</th>`).join("")}</tr>`;
    $("table-head").querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{const k=th.dataset.key;if(state.sort.key===k)state.sort.dir*=-1;else state.sort={key:k,dir:1};renderTable()}));
    const shown=state.expanded?rows:diverseInitialRows(rows,10);
    $("table-body").innerHTML=shown.map(r=>`<tr>${cols.map(([k])=>`<td>${formatCell(k,r[k])}</td>`).join("")}</tr>`).join("");
    $("table-count").textContent=state.expanded?`${formatNum(rows.length)} de ${formatNum(rows.length)} registros`:`${formatNum(shown.length)} de ${formatNum(rows.length)} registros · muestra inicial por ciudades`;
    $("more-btn").textContent=state.expanded?"Ver menos":"Ver más";
    $("more-btn").style.display=rows.length>10?"inline-flex":"none";
  }

  function renderColumns(){
    const menu=$("columns-menu");
    menu.innerHTML=columns.map(([k,l])=>`<label class="column-item"><input type="checkbox" data-key="${escapeHtml(k)}" ${state.hiddenColumns.has(k)?"":"checked"}><span>${escapeHtml(l)}</span></label>`).join("");
    menu.querySelectorAll("input").forEach(i=>i.addEventListener("change",()=>{i.checked?state.hiddenColumns.delete(i.dataset.key):state.hiddenColumns.add(i.dataset.key);renderTable()}));
  }

  function injectLinkStyles(){
    if($("dynamic-link-styles"))return;
    const style=document.createElement("style"); style.id="dynamic-link-styles";
    style.textContent=`.detail-link{display:inline-flex;align-items:center;min-height:24px;padding:4px 8px;border:1px solid #1B3028;border-radius:8px;background:#0F1714;color:#00F29A!important;text-decoration:none;font-size:10px;font-weight:650;white-space:nowrap}.detail-link:hover{border-color:#00C77D;background:#102019}.phone-link{color:#F4FFF9!important;text-decoration:none;white-space:nowrap;font-variant-numeric:tabular-nums}.phone-link:hover{color:#00F29A!important;text-decoration:underline}.link-empty{color:#50665e}.table-scroll td:has(.detail-link){overflow:visible;max-width:none}`;
    document.head.appendChild(style);
  }

  function setAnalysisView(view){
    state.analysisView=view;
    document.querySelectorAll(".analysis-tab").forEach(b=>b.classList.toggle("active",b.dataset.analysisView===view));
    document.querySelectorAll(".view-block").forEach(el=>el.classList.toggle("hidden",el.dataset.view!==view));
    if(view==="general") updateSectionVisibility();
    if(view==="territory") $("coverage-ranking-panel")?.classList.toggle("hidden",effectiveCityCount()<=1);
  }

  document.querySelectorAll(".analysis-tab").forEach(b=>b.addEventListener("click",()=>setAnalysisView(b.dataset.analysisView)));
  $("fibrazo-offer-select")?.addEventListener("change",e=>{state.selectedOfferKey=e.target.value;renderFibrazoComparison();});

  $("refresh-btn").addEventListener("click",()=>load());
  $("reset-btn").addEventListener("click",()=>{Object.values(state.filters).forEach(s=>s.clear());state.cityScopeMode="fibrazo";ensurePeriodSelection();state.tableSearch="";$("table-search").value="";state.expanded=false;state.sort={key:"Grupo_Operador",dir:1};renderCityQuickbar();renderFilters();applyFilters()});
  $("clear-btn").addEventListener("click",()=>{Object.entries(state.filters).forEach(([key,set])=>{if(key!=="period")set.clear()});state.cityScopeMode="fibrazo";state.expanded=false;renderCityQuickbar();renderFilters();applyFilters()});
  $("table-search").addEventListener("input",e=>{state.tableSearch=e.target.value;renderTable()});
  $("more-btn").addEventListener("click",()=>{state.expanded=!state.expanded;renderTable();if(!state.expanded)$("table-scroll").scrollTop=0});
  $("columns-btn").addEventListener("click",e=>{e.stopPropagation();renderColumns();$("columns-menu").classList.toggle("hidden")});
  $("columns-menu").addEventListener("click",e=>e.stopPropagation());
  document.addEventListener("click",()=>{document.querySelectorAll(".filter-menu,.city-more-menu").forEach(m=>m.classList.add("hidden"));$("columns-menu").classList.add("hidden")});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden && Date.now()-state.lastLoadAt>AUTO_REFRESH_MS)load({silent:true})});
  window.setInterval(()=>{if(!document.hidden)load({silent:true})},AUTO_REFRESH_MS);

  injectLinkStyles();
  setAnalysisView("general");
  load();
})();
