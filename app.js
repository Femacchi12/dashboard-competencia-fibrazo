(() => {
  "use strict";

  const BASE_SHEET_ID = "1v2sBVe_w-bTl438b8qWFmvw0gT66bj8TskcXbnY-gbU";
  const SOURCES = {
    plans: { gid: "1372196091", label: "02_PLANES_HISTORICO" },
    operators: { gid: "1091103584", label: "01_OPERADORES" },
    coverage: { gid: "718563813", label: "03_COBERTURA" }
  };
  const AUTO_REFRESH_MS = 120000;

  const state = {
    plans: [], operators: [], coverage: [], filtered: [], filteredCoverage: [],
    filters: { city:new Set(), operator:new Set(), technology:new Set(), tv:new Set(), price:new Set(), confidence:new Set() },
    tableSearch:"", expanded:false, sort:{ key:"Fecha_Mes", dir:-1 }, hiddenColumns:new Set(), charts:{},
    loading:false, lastLoadAt:0
  };

  const filterDefs = [
    ["city", "Ciudad / localidad", r => clean(r.Ciudad)],
    ["operator", "Operador", r => clean(r.Operador_Normalizado)],
    ["technology", "Tecnología", r => clean(r.Tecnologia) || "No informado"],
    ["tv", "TV incluida", r => normalizeTV(r.TV_Incluida)],
    ["price", "Rango de precio", r => priceBand(toNum(r.Precio_Usado_COP))],
    ["confidence", "Confiabilidad", r => clean(r.Nivel_Confiabilidad) || "No informado"]
  ];

  const columns = [
    ["Fecha_Mes","Fecha"],
    ["Operador_Normalizado","Operador"],
    ["Departamento","Departamento"],
    ["Ciudad","Ciudad"],
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
  const median = arr => { const a=arr.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
  const normalizeTV = v => { const s=fold(v); if(!s)return "No informado"; if(["si","yes","1","true"].includes(s))return "Sí"; if(["no","0","false"].includes(s))return "No"; return clean(v); };
  const priceBand = n => n == null ? "Sin precio" : n < 50000 ? "< $50k" : n <= 75000 ? "$50k–$75k" : n <= 100000 ? "$75k–$100k" : "> $100k";

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

  function csvUrl(gid){ return `https://docs.google.com/spreadsheets/d/${BASE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&cb=${Date.now()}`; }

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
    const res=await fetch(csvUrl(source.gid),{cache:"no-store"});
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
    return rawPlans.filter(r=>clean(r.ID_Plan_Registro)||clean(r.Operador_Normalizado)).map(r=>{
      const op=byId.get(clean(r.ID_Operador)) || byName.get(fold(r.Operador_Normalizado)) || {};
      const regular=toNum(r.Precio_Regular_COP), promo=toNum(r.Precio_Promocional_COP);
      const used=promo!=null && promo>0 ? promo : (regular!=null && regular>0 ? regular : null);
      return {
        ...r,
        Fecha_Mes:formatYearMonth(r.Fecha_Relevamiento),
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

  async function load({silent=false}={}){
    if(state.loading) return;
    state.loading=true;
    if(!silent && $("refresh-btn")){ $("refresh-btn").disabled=true; $("refresh-btn").textContent="Actualizando…"; }
    try{
      const [plansRes, operatorsRes, coverageRes]=await Promise.allSettled([
        fetchCsv(SOURCES.plans), fetchCsv(SOURCES.operators), fetchCsv(SOURCES.coverage)
      ]);
      if(plansRes.status!=="fulfilled") throw plansRes.reason;
      if(operatorsRes.status!=="fulfilled") throw operatorsRes.reason;
      state.operators=operatorsRes.value;
      state.plans=buildPlans(plansRes.value,operatorsRes.value);
      state.coverage=coverageRes.status==="fulfilled"?coverageRes.value:[];
      state.lastLoadAt=Date.now();
      $("last-load").textContent=new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short"}).format(new Date());
      removeErrorBox(); renderFilters(); applyFilters();
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

  function renderFilters(){
    const root=$("filters"); root.innerHTML="";
    filterDefs.forEach(([key,label,getter])=>{
      const options=[...new Set(state.plans.map(getter).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
      for(const selected of [...state.filters[key]]) if(!options.includes(selected)) state.filters[key].delete(selected);
      const wrap=document.createElement("div"); wrap.className="filter";
      wrap.innerHTML=`<label class="filter-label">${escapeHtml(label)}</label><button class="filter-btn" type="button"><span data-label>Todos</span><span>⌄</span></button><div class="filter-menu hidden"><input class="filter-search" placeholder="Buscar…"><div class="filter-options"></div></div>`;
      const btn=wrap.querySelector(".filter-btn"), menu=wrap.querySelector(".filter-menu"), box=wrap.querySelector(".filter-options"), search=wrap.querySelector(".filter-search");
      const paint=(query="")=>{
        box.innerHTML="";
        options.filter(o=>fold(o).includes(fold(query))).forEach(o=>{
          const row=document.createElement("label"); row.className="filter-option";
          row.innerHTML=`<input type="checkbox" ${state.filters[key].has(o)?"checked":""}><span>${escapeHtml(o)}</span>`;
          row.querySelector("input").addEventListener("change",e=>{
            e.target.checked?state.filters[key].add(o):state.filters[key].delete(o);
            updateFilterLabel(wrap,key); applyFilters();
          });
          box.appendChild(row);
        });
      };
      btn.addEventListener("click",e=>{
        e.stopPropagation();
        document.querySelectorAll(".filter-menu").forEach(m=>{if(m!==menu)m.classList.add("hidden")});
        menu.classList.toggle("hidden");
        if(!menu.classList.contains("hidden")){search.focus();paint(search.value);}
      });
      menu.addEventListener("click",e=>e.stopPropagation());
      search.addEventListener("input",()=>paint(search.value));
      root.appendChild(wrap); paint(); updateFilterLabel(wrap,key);
    });
  }
  function updateFilterLabel(wrap,key){ const n=state.filters[key].size; wrap.querySelector("[data-label]").textContent=n===0?"Todos":n===1?[...state.filters[key]][0]:`${n} seleccionados`; }

  function planPasses(r){
    const vals={city:clean(r.Ciudad),operator:clean(r.Operador_Normalizado),technology:clean(r.Tecnologia)||"No informado",tv:normalizeTV(r.TV_Incluida),price:priceBand(toNum(r.Precio_Usado_COP)),confidence:clean(r.Nivel_Confiabilidad)||"No informado"};
    return Object.entries(state.filters).every(([k,set])=>!set.size||set.has(vals[k]));
  }
  function coveragePasses(r){
    const city=clean(r.Ciudad),operator=clean(r.Operador_Normalizado),tech=clean(r.Tecnologia)||"No informado";
    return(!state.filters.city.size||state.filters.city.has(city))&&(!state.filters.operator.size||state.filters.operator.has(operator))&&(!state.filters.technology.size||state.filters.technology.has(tech));
  }
  function applyFilters(){
    state.filtered=state.plans.filter(planPasses); state.filteredCoverage=state.coverage.filter(coveragePasses);
    renderKPIs(); renderCharts(); renderCoverage(); renderTable();
  }

  function renderKPIs(){
    const d=state.filtered, operators=new Set(d.map(r=>clean(r.Operador_Normalizado)).filter(Boolean)), cities=new Set(d.map(r=>clean(r.Ciudad)).filter(Boolean));
    const prices=d.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n>0), speeds=d.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n>0);
    const knownTv=d.map(r=>normalizeTV(r.TV_Incluida)).filter(v=>v==="Sí"||v==="No"), yesTv=knownTv.filter(v=>v==="Sí").length;
    $("kpi-plans").textContent=formatNum(d.length); $("kpi-operators").textContent=formatNum(operators.size); $("kpi-cities-note").textContent=`${formatNum(cities.size)} ciudades/localidades`;
    $("kpi-price").textContent=formatCOP(median(prices)); $("kpi-speed").textContent=median(speeds)==null?"—":formatNum(median(speeds)); $("kpi-tv").textContent=knownTv.length?`${Math.round(yesTv/knownTv.length*100)}%`:"—";
  }

  function chartDefaults(){
    Chart.defaults.color="#8FA9A0"; Chart.defaults.font.family="Inter"; Chart.defaults.font.size=10;
    return {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{backgroundColor:"#07100c",borderColor:"#1B3028",borderWidth:1,titleColor:"#F4FFF9",bodyColor:"#dce9e4"}},scales:{x:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}},y:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}}}};
  }
  function destroyChart(key){if(state.charts[key]){state.charts[key].destroy();delete state.charts[key];}}
  function countBy(rows,key){const m=new Map();rows.forEach(r=>{const v=clean(r[key])||"No informado";m.set(v,(m.get(v)||0)+1)});return[...m.entries()].sort((a,b)=>b[1]-a[1]);}

  function renderCharts(){
    const rows=state.filtered;
    destroyChart("scatter");
    const points=rows.map(r=>({x:toNum(r.Velocidad_Bajada_Mbps),y:toNum(r.Precio_Usado_COP),operator:clean(r.Operador_Normalizado),city:clean(r.Ciudad)})).filter(p=>p.x>0&&p.y>0);
    let opt=chartDefaults();
    state.charts.scatter=new Chart($("scatter-chart"),{type:"scatter",data:{datasets:[{label:"Planes",data:points,pointRadius:4,pointHoverRadius:6,backgroundColor:"rgba(0,242,154,.65)"}]},options:{...opt,plugins:{...opt.plugins,tooltip:{...opt.plugins.tooltip,callbacks:{label:c=>`${c.raw.operator} · ${c.raw.city}: ${formatNum(c.raw.x)} Mbps · ${formatCOP(c.raw.y)}`}}},scales:{x:{...opt.scales.x,title:{display:true,text:"Mbps"}},y:{...opt.scales.y,title:{display:true,text:"COP"},ticks:{callback:v=>`$${Math.round(v/1000)}k`}}}}});
    const op=countBy(rows,"Operador_Normalizado").slice(0,12); destroyChart("operators"); opt=chartDefaults(); state.charts.operators=new Chart($("operators-chart"),{type:"bar",data:{labels:op.map(x=>x[0]),datasets:[{data:op.map(x=>x[1]),backgroundColor:"rgba(0,242,154,.68)",borderRadius:5}]},options:{...opt,indexAxis:"y",plugins:{...opt.plugins,legend:{display:false}}}});
    const city=countBy(rows,"Ciudad").slice(0,12); destroyChart("cities"); opt=chartDefaults(); state.charts.cities=new Chart($("cities-chart"),{type:"bar",data:{labels:city.map(x=>x[0]),datasets:[{data:city.map(x=>x[1]),backgroundColor:"rgba(0,199,125,.65)",borderRadius:5}]},options:{...opt,plugins:{...opt.plugins,legend:{display:false}}}});
    const tvMap=new Map([["Sí",0],["No",0],["No informado",0]]); rows.forEach(r=>{const v=normalizeTV(r.TV_Incluida);tvMap.set(v,(tvMap.get(v)||0)+1)}); destroyChart("tv"); opt=chartDefaults(); state.charts.tv=new Chart($("tv-chart"),{type:"doughnut",data:{labels:[...tvMap.keys()],datasets:[{data:[...tvMap.values()],backgroundColor:["#00F29A","#4d7869","#2a3732"],borderColor:"#0B110F",borderWidth:3}]},options:{...opt,cutout:"68%",plugins:{...opt.plugins,legend:{position:"bottom"}}}});
  }

  function renderCoverage(){
    const rows=state.filteredCoverage; $("coverage-visible").textContent=formatNum(rows.length);
    const grouped=new Map(); rows.forEach(r=>{const key=clean(r.Ciudad)||"No informado";grouped.set(key,(grouped.get(key)||0)+1)}); const top=[...grouped.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
    destroyChart("coverage"); const opt=chartDefaults(); state.charts.coverage=new Chart($("coverage-chart"),{type:"bar",data:{labels:top.map(x=>x[0]),datasets:[{data:top.map(x=>x[1]),backgroundColor:"rgba(0,242,154,.66)",borderRadius:5}]},options:{...opt,plugins:{...opt.plugins,legend:{display:false}}}});
    const list=$("coverage-list"); list.innerHTML="";
    rows.slice(0,80).forEach(r=>{const el=document.createElement("div");el.className="coverage-row";el.innerHTML=`<strong>${escapeHtml(clean(r.Ciudad)||"—")}</strong><span>${escapeHtml(clean(r.Operador_Normalizado)||"—")}</span><span>${escapeHtml(clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ)||"Ciudad")}</span>`;list.appendChild(el)});
    if(!rows.length) list.innerHTML='<span class="subtitle">Sin registros compatibles con los filtros.</span>';
  }

  function tableRows(){
    const q=fold(state.tableSearch);
    const rows=state.filtered.filter(r=>!q||columns.some(([k])=>fold(r[k]).includes(q)));
    const {key,dir}=state.sort;
    return [...rows].sort((a,b)=>{
      if(key==="Fecha_Mes") return (dateSortValue(a.Fecha_Relevamiento)-dateSortValue(b.Fecha_Relevamiento))*dir;
      const an=toNum(a[key]),bn=toNum(b[key]); if(an!=null&&bn!=null)return(an-bn)*dir;
      return clean(a[key]).localeCompare(clean(b[key]),"es",{numeric:true})*dir;
    });
  }

  function diverseInitialRows(rows, limit=10){
    const picked=[], seenCities=new Set(), used=new Set();
    for(const r of rows){
      const city=clean(r.Ciudad)||"Sin ciudad";
      const id=clean(r.ID_Plan_Registro)||`${city}|${clean(r.Operador_Normalizado)}|${picked.length}`;
      if(!seenCities.has(city)){
        picked.push(r); seenCities.add(city); used.add(id);
        if(picked.length>=limit) return picked;
      }
    }
    for(const r of rows){
      const id=clean(r.ID_Plan_Registro)||`${clean(r.Ciudad)}|${clean(r.Operador_Normalizado)}|${picked.length}`;
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

  $("refresh-btn").addEventListener("click",()=>load());
  $("reset-btn").addEventListener("click",()=>{Object.values(state.filters).forEach(s=>s.clear());state.tableSearch="";$("table-search").value="";state.expanded=false;state.sort={key:"Fecha_Mes",dir:-1};renderFilters();applyFilters()});
  $("clear-btn").addEventListener("click",()=>{Object.values(state.filters).forEach(s=>s.clear());renderFilters();applyFilters()});
  $("table-search").addEventListener("input",e=>{state.tableSearch=e.target.value;renderTable()});
  $("more-btn").addEventListener("click",()=>{state.expanded=!state.expanded;renderTable();if(!state.expanded)$("table-scroll").scrollTop=0});
  $("columns-btn").addEventListener("click",e=>{e.stopPropagation();renderColumns();$("columns-menu").classList.toggle("hidden")});
  $("columns-menu").addEventListener("click",e=>e.stopPropagation());
  document.addEventListener("click",()=>{document.querySelectorAll(".filter-menu").forEach(m=>m.classList.add("hidden"));$("columns-menu").classList.add("hidden")});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden && Date.now()-state.lastLoadAt>AUTO_REFRESH_MS)load({silent:true})});
  window.setInterval(()=>{if(!document.hidden)load({silent:true})},AUTO_REFRESH_MS);

  injectLinkStyles();
  load();
})();
