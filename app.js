(() => {
  "use strict";

  const BASE_SHEET_ID = "1v2sBVe_w-bTl438b8qWFmvw0gT66bj8TskcXbnY-gbU";
  const SOURCES = {
    plans: { gid: "790372285", label: "10_DASH_PLANES" },
    coverage: { gid: "2010490009", label: "11_DASH_COBERTURA" },
    summary: { gid: "970350613", label: "12_DASH_COMPETENCIA" }
  };

  const state = {
    rawPlans: [], plans: [], coverage: [], summary: [], filtered: [], filteredCoverage: [],
    filters: { city: new Set(), operator: new Set(), technology: new Set(), tv: new Set(), price: new Set(), confidence: new Set() },
    tableSearch: "", limit: 10, expanded: false, sort: { key: "Fecha_Relevamiento", dir: -1 },
    hiddenColumns: new Set(), charts: {}
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
    ["Fecha_Relevamiento","Fecha"],["Departamento","Departamento"],["Ciudad","Ciudad"],["Barrio","Barrio"],
    ["Operador_Normalizado","Operador"],["Segmento","Segmento"],["Tipo_Servicio","Servicio"],["Tecnologia","Tecnología"],
    ["Velocidad_Bajada_Mbps","Bajada Mbps"],["Velocidad_Subida_Mbps","Subida Mbps"],["Precio_Usado_COP","Precio usado"],
    ["Precio_por_Mbps","Precio/Mbps"],["TV_Incluida","TV"],["Permanencia_Meses","Permanencia"],
    ["Estado_Vigencia","Vigencia"],["Nivel_Confiabilidad","Confiabilidad"]
  ];

  const $ = id => document.getElementById(id);
  const clean = v => String(v ?? "").trim();
  const toNum = v => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/[^0-9,.-]/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : null;
  };
  const formatCOP = n => n == null ? "—" : new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(n);
  const formatNum = n => n == null ? "—" : new Intl.NumberFormat("es-CO", { maximumFractionDigits:1 }).format(n);
  const median = arr => { const a = arr.filter(Number.isFinite).sort((x,y)=>x-y); if (!a.length) return null; const m=Math.floor(a.length/2); return a.length%2 ? a[m] : (a[m-1]+a[m])/2; };
  const normalizeTV = v => { const s=clean(v).toLowerCase(); if (!s) return "No informado"; if (["si","sí","yes","1","true"].includes(s)) return "Sí"; if (["no","0","false"].includes(s)) return "No"; return clean(v); };
  const priceBand = n => n == null ? "Sin precio" : n < 50000 ? "< $50k" : n <= 75000 ? "$50k–$75k" : n <= 100000 ? "$75k–$100k" : "> $100k";

  function csvUrl(gid){ return `https://docs.google.com/spreadsheets/d/${BASE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&cb=${Date.now()}`; }
  function parseCSV(text){
    const rows=[]; let row=[], field="", quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], next=text[i+1];
      if(c==='"'){
        if(quoted && next==='"'){ field+='"'; i++; }
        else quoted=!quoted;
      } else if(c===',' && !quoted){ row.push(field); field=""; }
      else if((c==='\n' || c==='\r') && !quoted){
        if(c==='\r' && next==='\n') i++;
        row.push(field); if(row.some(v=>v!=="")) rows.push(row); row=[]; field="";
      } else field+=c;
    }
    if(field.length || row.length){ row.push(field); rows.push(row); }
    if(!rows.length) return [];
    const headers=rows[0].map(h=>clean(h));
    return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h, clean(r[i] ?? "")])));
  }
  async function fetchCsv(source){
    const res=await fetch(csvUrl(source.gid), { cache:"no-store" });
    if(!res.ok) throw new Error(`${source.label}: HTTP ${res.status}`);
    const text=await res.text();
    if(/<!doctype html>|<html/i.test(text)) throw new Error(`${source.label}: la hoja no es accesible como CSV desde el navegador.`);
    return parseCSV(text);
  }

  async function load(){
    $("refresh-btn").disabled=true; $("refresh-btn").textContent="Actualizando…";
    try{
      const [plansRes, coverageRes, summaryRes] = await Promise.allSettled([
        fetchCsv(SOURCES.plans), fetchCsv(SOURCES.coverage), fetchCsv(SOURCES.summary)
      ]);
      if(plansRes.status!=="fulfilled") throw plansRes.reason;
      state.rawPlans = plansRes.value;
      state.plans = plansRes.value;
      state.coverage = coverageRes.status==="fulfilled" ? coverageRes.value : [];
      state.summary = summaryRes.status==="fulfilled" ? summaryRes.value : [];
      $("source-plan-count").textContent = formatNum(state.plans.length);
      $("source-coverage-count").textContent = formatNum(state.coverage.length);
      $("last-load").textContent = new Intl.DateTimeFormat("es-CO", { dateStyle:"short", timeStyle:"short" }).format(new Date());
      renderFilters(); applyFilters();
    } catch(error){
      console.error(error);
      document.querySelector("main").insertAdjacentHTML("afterbegin", `<div class="error-box"><strong>No fue posible cargar Base General.</strong><br>${escapeHtml(error.message || String(error))}</div>`);
    } finally { $("refresh-btn").disabled=false; $("refresh-btn").textContent="Actualizar"; }
  }

  function renderFilters(){
    const root=$("filters"); root.innerHTML="";
    filterDefs.forEach(([key,label,getter])=>{
      const options=[...new Set(state.plans.map(getter).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
      const wrap=document.createElement("div"); wrap.className="filter";
      wrap.innerHTML=`<label class="filter-label">${label}</label><button class="filter-btn" type="button"><span data-label>Todos</span><span>⌄</span></button><div class="filter-menu hidden"><input class="filter-search" placeholder="Buscar…"><div class="filter-options"></div></div>`;
      const btn=wrap.querySelector(".filter-btn"), menu=wrap.querySelector(".filter-menu"), box=wrap.querySelector(".filter-options"), search=wrap.querySelector(".filter-search");
      const paint=(query="")=>{ box.innerHTML=""; options.filter(o=>o.toLowerCase().includes(query.toLowerCase())).forEach(o=>{ const row=document.createElement("label"); row.className="filter-option"; const checked=state.filters[key].has(o); row.innerHTML=`<input type="checkbox" ${checked?"checked":""}><span>${escapeHtml(o)}</span>`; const input=row.querySelector("input"); input.addEventListener("change",()=>{ input.checked?state.filters[key].add(o):state.filters[key].delete(o); updateFilterLabel(wrap,key); applyFilters(); }); box.appendChild(row); }); };
      btn.addEventListener("click",e=>{ e.stopPropagation(); document.querySelectorAll(".filter-menu").forEach(m=>{if(m!==menu)m.classList.add("hidden")}); menu.classList.toggle("hidden"); if(!menu.classList.contains("hidden")){search.focus();paint(search.value);} });
      menu.addEventListener("click",e=>e.stopPropagation()); search.addEventListener("input",()=>paint(search.value));
      root.appendChild(wrap); paint(); updateFilterLabel(wrap,key);
    });
  }
  function updateFilterLabel(wrap,key){ const n=state.filters[key].size; wrap.querySelector("[data-label]").textContent=n===0?"Todos":n===1?[...state.filters[key]][0]:`${n} seleccionados`; }
  document.addEventListener("click",()=>document.querySelectorAll(".filter-menu").forEach(m=>m.classList.add("hidden")));

  function planPasses(r){
    const vals={ city:clean(r.Ciudad), operator:clean(r.Operador_Normalizado), technology:clean(r.Tecnologia)||"No informado", tv:normalizeTV(r.TV_Incluida), price:priceBand(toNum(r.Precio_Usado_COP)), confidence:clean(r.Nivel_Confiabilidad)||"No informado" };
    return Object.entries(state.filters).every(([k,set])=>!set.size || set.has(vals[k]));
  }
  function coveragePasses(r){
    const city=clean(r.Ciudad), operator=clean(r.Operador_Normalizado), tech=clean(r.Tecnologia)||"No informado";
    return (!state.filters.city.size || state.filters.city.has(city)) && (!state.filters.operator.size || state.filters.operator.has(operator)) && (!state.filters.technology.size || state.filters.technology.has(tech));
  }
  function applyFilters(){
    state.filtered=state.plans.filter(planPasses); state.filteredCoverage=state.coverage.filter(coveragePasses); state.limit=state.expanded?Math.max(10,state.filtered.length):10;
    renderKPIs(); renderCharts(); renderCoverage(); renderTable();
  }

  function renderKPIs(){
    const d=state.filtered, operators=new Set(d.map(r=>clean(r.Operador_Normalizado)).filter(Boolean)), cities=new Set(d.map(r=>clean(r.Ciudad)).filter(Boolean));
    const prices=d.map(r=>toNum(r.Precio_Usado_COP)).filter(n=>n!=null && n>0), speeds=d.map(r=>toNum(r.Velocidad_Bajada_Mbps)).filter(n=>n!=null && n>0);
    const knownTv=d.map(r=>normalizeTV(r.TV_Incluida)).filter(v=>v==="Sí"||v==="No"), yesTv=knownTv.filter(v=>v==="Sí").length;
    $("kpi-plans").textContent=formatNum(d.length); $("kpi-operators").textContent=formatNum(operators.size); $("kpi-cities-note").textContent=`${formatNum(cities.size)} ciudades/localidades`;
    $("kpi-price").textContent=formatCOP(median(prices)); $("kpi-speed").textContent=median(speeds)==null?"—":`${formatNum(median(speeds))}`; $("kpi-tv").textContent=knownTv.length?`${Math.round(yesTv/knownTv.length*100)}%`:"—";
  }

  function chartDefaults(){
    Chart.defaults.color="#8FA9A0"; Chart.defaults.font.family="Inter"; Chart.defaults.font.size=10;
    return { responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{boxWidth:10,boxHeight:10,usePointStyle:true}}, tooltip:{backgroundColor:"#07100c",borderColor:"#1B3028",borderWidth:1,titleColor:"#F4FFF9",bodyColor:"#dce9e4"}}, scales:{x:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}},y:{grid:{color:"rgba(27,48,40,.35)"},border:{color:"#1B3028"}}} };
  }
  function destroyChart(key){ if(state.charts[key]) state.charts[key].destroy(); }
  function countBy(rows,key){ const map=new Map(); rows.forEach(r=>{const v=clean(r[key])||"No informado";map.set(v,(map.get(v)||0)+1)}); return [...map.entries()].sort((a,b)=>b[1]-a[1]); }
  function renderCharts(){
    const rows=state.filtered;
    destroyChart("scatter");
    const points=rows.map(r=>({x:toNum(r.Velocidad_Bajada_Mbps),y:toNum(r.Precio_Usado_COP),operator:clean(r.Operador_Normalizado),city:clean(r.Ciudad)})).filter(p=>p.x>0&&p.y>0);
    state.charts.scatter=new Chart($("scatter-chart"),{type:"scatter",data:{datasets:[{label:"Planes",data:points,pointRadius:4,pointHoverRadius:6,backgroundColor:"rgba(0,242,154,.65)"}]},options:{...chartDefaults(),plugins:{...chartDefaults().plugins,tooltip:{...chartDefaults().plugins.tooltip,callbacks:{label:c=>`${c.raw.operator} · ${c.raw.city}: ${formatNum(c.raw.x)} Mbps · ${formatCOP(c.raw.y)}`}}},scales:{x:{...chartDefaults().scales.x,title:{display:true,text:"Mbps"}},y:{...chartDefaults().scales.y,title:{display:true,text:"COP"},ticks:{callback:v=>`$${Math.round(v/1000)}k`}}}}});
    const op=countBy(rows,"Operador_Normalizado").slice(0,12); destroyChart("operators"); state.charts.operators=new Chart($("operators-chart"),{type:"bar",data:{labels:op.map(x=>x[0]),datasets:[{label:"Planes",data:op.map(x=>x[1]),backgroundColor:"rgba(0,242,154,.68)",borderRadius:5}]},options:{...chartDefaults(),indexAxis:"y",plugins:{...chartDefaults().plugins,legend:{display:false}}}});
    const city=countBy(rows,"Ciudad").slice(0,12); destroyChart("cities"); state.charts.cities=new Chart($("cities-chart"),{type:"bar",data:{labels:city.map(x=>x[0]),datasets:[{label:"Planes",data:city.map(x=>x[1]),backgroundColor:"rgba(0,199,125,.65)",borderRadius:5}]},options:{...chartDefaults(),plugins:{...chartDefaults().plugins,legend:{display:false}}}});
    const tvMap=new Map([["Sí",0],["No",0],["No informado",0]]); rows.forEach(r=>{const v=normalizeTV(r.TV_Incluida);tvMap.set(v,(tvMap.get(v)||0)+1)}); destroyChart("tv"); state.charts.tv=new Chart($("tv-chart"),{type:"doughnut",data:{labels:[...tvMap.keys()],datasets:[{data:[...tvMap.values()],backgroundColor:["#00F29A","#4d7869","#2a3732"],borderColor:"#0B110F",borderWidth:3}]},options:{...chartDefaults(),cutout:"68%",plugins:{...chartDefaults().plugins,legend:{position:"bottom"}}}});
  }

  function renderCoverage(){
    const rows=state.filteredCoverage; $("coverage-visible").textContent=formatNum(rows.length);
    const grouped=new Map(); rows.forEach(r=>{ const key=clean(r.Ciudad)||"No informado"; grouped.set(key,(grouped.get(key)||0)+1); }); const top=[...grouped.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
    destroyChart("coverage"); state.charts.coverage=new Chart($("coverage-chart"),{type:"bar",data:{labels:top.map(x=>x[0]),datasets:[{label:"Registros",data:top.map(x=>x[1]),backgroundColor:"rgba(0,242,154,.66)",borderRadius:5}]},options:{...chartDefaults(),plugins:{...chartDefaults().plugins,legend:{display:false}}}});
    const list=$("coverage-list"); list.innerHTML=""; rows.slice(0,80).forEach(r=>{ const el=document.createElement("div");el.className="coverage-row";el.innerHTML=`<strong>${escapeHtml(clean(r.Ciudad)||"—")}</strong><span title="${escapeHtml(clean(r.Operador_Normalizado))}">${escapeHtml(clean(r.Operador_Normalizado)||"—")}</span><span title="${escapeHtml(clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ))}">${escapeHtml(clean(r.Barrio)||clean(r.Localidad_Comuna_UPZ)||"Ciudad")}</span>`;list.appendChild(el); }); if(!rows.length) list.innerHTML='<span class="subtitle">Sin registros compatibles con los filtros.</span>';
  }

  function filteredTableRows(){
    const q=state.tableSearch.toLowerCase().trim(); let rows=state.filtered.filter(r=>!q || columns.some(([k])=>clean(r[k]).toLowerCase().includes(q)));
    const {key,dir}=state.sort; rows=[...rows].sort((a,b)=>{ const an=toNum(a[key]),bn=toNum(b[key]); if(an!=null&&bn!=null)return(an-bn)*dir; return clean(a[key]).localeCompare(clean(b[key]),"es",{numeric:true})*dir; }); return rows;
  }
  function renderTable(){
    const rows=filteredTableRows(); const visibleCols=columns.filter(([k])=>!state.hiddenColumns.has(k));
    $("table-head").innerHTML=`<tr>${visibleCols.map(([k,l])=>`<th data-key="${k}">${escapeHtml(l)}${state.sort.key===k?`<span class="sort-mark">${state.sort.dir===1?"▲":"▼"}</span>`:""}</th>`).join("")}</tr>`;
    $("table-head").querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{ const key=th.dataset.key;if(state.sort.key===key)state.sort.dir*=-1;else state.sort={key,dir:1};renderTable(); }));
    const shown=state.expanded?rows:rows.slice(0,state.limit); $("table-body").innerHTML=shown.map(r=>`<tr>${visibleCols.map(([k])=>`<td title="${escapeHtml(clean(r[k]))}">${formatCell(k,r[k])}</td>`).join("")}</tr>`).join("");
    $("table-count").textContent=`${formatNum(shown.length)} de ${formatNum(rows.length)} registros`;
    $("more-btn").textContent=state.expanded?"Ver menos":"Ver más"; $("more-btn").style.display=rows.length>10?"inline-flex":"none";
  }
  function formatCell(k,v){ const n=toNum(v); if(["Precio_Usado_COP"].includes(k))return escapeHtml(formatCOP(n)); if(k==="Precio_por_Mbps")return n==null?"—":escapeHtml(formatCOP(n)); if(["Velocidad_Bajada_Mbps","Velocidad_Subida_Mbps","Permanencia_Meses"].includes(k))return n==null?escapeHtml(clean(v)||"—"):escapeHtml(formatNum(n)); return escapeHtml(clean(v)||"—"); }
  function renderColumnPicker(){ const menu=$("columns-menu"); menu.innerHTML=columns.map(([k,l])=>`<label class="column-item"><input type="checkbox" data-key="${k}" ${state.hiddenColumns.has(k)?"":"checked"}><span>${escapeHtml(l)}</span></label>`).join(""); menu.querySelectorAll("input").forEach(i=>i.addEventListener("change",()=>{i.checked?state.hiddenColumns.delete(i.dataset.key):state.hiddenColumns.add(i.dataset.key);renderTable();})); }
  function escapeHtml(s){ return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

  $("refresh-btn").addEventListener("click",load);
  $("reset-btn").addEventListener("click",()=>{Object.values(state.filters).forEach(s=>s.clear());state.tableSearch="";$("table-search").value="";state.expanded=false;state.sort={key:"Fecha_Relevamiento",dir:-1};renderFilters();applyFilters();});
  $("clear-btn").addEventListener("click",()=>{Object.values(state.filters).forEach(s=>s.clear());renderFilters();applyFilters();});
  $("table-search").addEventListener("input",e=>{state.tableSearch=e.target.value;renderTable();});
  $("more-btn").addEventListener("click",()=>{state.expanded=!state.expanded;renderTable();if(!state.expanded)$("table-scroll").scrollTop=0;});
  $("columns-btn").addEventListener("click",e=>{e.stopPropagation();renderColumnPicker();$("columns-menu").classList.toggle("hidden");});
  $("columns-menu").addEventListener("click",e=>e.stopPropagation());
  $("scroll-left").addEventListener("click",()=>$("table-scroll").scrollBy({left:-500,behavior:"smooth"}));
  $("scroll-right").addEventListener("click",()=>$("table-scroll").scrollBy({left:500,behavior:"smooth"}));
  document.addEventListener("click",()=>$("columns-menu").classList.add("hidden"));

  load();
})();
