(function coreModule(){
  "use strict";

  const FZ = window.FZ = window.FZ || {};

  FZ.BASE_SHEET_ID = "1v2sBVe_w-bTl438b8qWFmvw0gT66bj8TskcXbnY-gbU";
  FZ.AUTO_REFRESH_MS = 120000;

  FZ.SOURCES = {
    plans: { gid:"1372196091", label:"02_PLANES_HISTORICO", range:"A1:AF1000" },
    operators: { gid:"1091103584", label:"01_OPERADORES", range:"A1:AA300" },
    coverage: { gid:"718563813", label:"03_PRESENCIA", range:"A1:Y2500" },
    markets: { gid:"1320750580", label:"07_CONFIG · Mercados", range:"X2:AI300" },
    territories: { gid:"1320750580", label:"07_CONFIG · Territorio", range:"AK2:AQ277" },
    offers: { gid:"1320750580", label:"07_CONFIG · Oferta FIBRAZO", range:"AS2:BC300" },
    fibrazoMetrics: { gid:"1344959609", label:"10_FIBRAZO_METRICAS", range:"A1:X400" },
    mobile: { gid:"1227923955", label:"12_COMPETENCIA_MOVIL", range:"A1:S400" }
  };

  FZ.state = {
    plans: [], operators: [], coverage: [], markets: [], territories: [], offers: [], metrics: [], mobile: [],
    filtered: [], filteredCoverage: [],
    filters: {
      period:new Set(), city:new Set(), operator:new Set(), technology:new Set(), trunk:new Set()
    },
    cityScopeMode:"fibrazo",
    analysisView:"general",
    selectedOfferKey:"",
    comparison:{level:"city",periods:new Set(["2026-09"]),items:new Set(),cityFilter:"all",search:""},
    tableSearch:"",
    tableMode:"offer",
    expanded:false,
    sort:{key:"Grupo_Operador",dir:1},
    hiddenColumns:new Set(),
    charts:{},
    loading:false,
    lastLoadAt:0,
    openTrunkKey:"",
    networkSearch:"",
    networkSort:{key:"Troncal_FIBRAZO",dir:1},
    mobileView:{period:"2026-09",operator:"all",modality:"all",search:"",sort:{key:"Operador",dir:1},openKey:""},
    sourceHealth:{},
    indexes:{}
  };

  FZ.months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  FZ.phoneFields = new Set(["Telefono_1","Telefono_2","Telefono_3","Telefono_4","Telefono_5"]);
  FZ.linkFields = new Set(["Sitio_Web","Instagram","Facebook","TikTok","Imagenes_Folletos"]);
  FZ.linkLabels = {
    Sitio_Web:"Web ↗", Instagram:"Instagram ↗", Facebook:"Facebook ↗",
    TikTok:"TikTok ↗", Imagenes_Folletos:"Ver carpeta ↗"
  };

  const clean = v => String(v ?? "").trim();
  const fold = v => clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const $ = id => document.getElementById(id);

  function toNum(v){
    if(v===null||v===undefined||v==="") return null;
    let s=clean(v).replace(/[^0-9,.-]/g,"");
    if(!s) return null;
    if(s.includes(",")&&s.includes(".")){
      if(s.lastIndexOf(",")>s.lastIndexOf(".")) s=s.replace(/\./g,"").replace(",",".");
      else s=s.replace(/,/g,"");
    }else if(s.includes(",")){
      const parts=s.split(",");
      s=parts.length===2&&parts[1].length<=2?parts[0].replace(/\./g,"")+"."+parts[1]:s.replace(/,/g,"");
    }else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(s)){
      s=s.replace(/\./g,"");
    }
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }

  const formatCOP = n => n==null?"—":new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
  const formatNum = n => n==null?"—":new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(n);
  const formatPct = n => n==null||!Number.isFinite(n)?"—":(n>0?"+":"")+new Intl.NumberFormat("es-CO",{maximumFractionDigits:1,minimumFractionDigits:1}).format(n)+"%";
  const pctVs = (value,base) => Number.isFinite(value)&&Number.isFinite(base)&&base!==0?(value-base)/base*100:null;
  const priceBand = n => n==null?"Sin precio":n<50000?"< $50k":n<=75000?"$50k–$75k":n<=100000?"$75k–$100k":"> $100k";

  function normalizeTV(v){
    const s=fold(v);
    if(!s) return "No informado";
    if(["si","yes","1","true"].includes(s)) return "Sí";
    if(["no","0","false"].includes(s)) return "No";
    return clean(v);
  }

  const periodValue = value => clean(value).match(/^\d{4}-\d{2}$/)?clean(value):"";

  function formatPeriod(value){
    const s=periodValue(value);
    if(!s) return "Sin corte";
    const parts=s.split("-").map(Number);
    const year=parts[0], month=parts[1];
    return month>=1&&month<=12?year+"-"+FZ.months[month-1]:s;
  }

  function periodSortValue(value){
    const s=periodValue(value);
    if(!s) return 0;
    const parts=s.split("-").map(Number);
    return parts[0]*100+parts[1];
  }

  function formatYearMonth(value){
    const s=clean(value);
    if(!s||fold(s)==="sin fecha"||fold(s)==="sin info") return "Sin info";
    let m=s.match(/^(\d{4})[-\/]([01]?\d)(?:[-\/]\d{1,2})?$/);
    if(m){const month=Number(m[2]);return month>=1&&month<=12?m[1]+"-"+FZ.months[month-1]:"Sin info";}
    m=s.match(/^(\d{1,2})[\/]([01]?\d)[\/](\d{4})$/);
    if(m){const month=Number(m[2]);return month>=1&&month<=12?m[3]+"-"+FZ.months[month-1]:"Sin info";}
    const d=new Date(s);
    return !Number.isNaN(d.getTime())&&/\d{4}/.test(s)?d.getFullYear()+"-"+FZ.months[d.getMonth()]:"Sin info";
  }

  function safeUrl(value,field){
    const s=clean(value);
    if(!s||!/^https?:\/\//i.test(s)) return "";
    if(field==="Sitio_Web"&&/(?:docs\.google\.com|drive\.google\.com|facebook\.com|instagram\.com|tiktok\.com)/i.test(s)) return "";
    return s;
  }

  function linkCell(value,field){
    const url=safeUrl(value,field);
    if(!url) return '<span class="link-empty">—</span>';
    return '<a class="detail-link" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(FZ.linkLabels[field]||"Abrir ↗")+'</a>';
  }

  function phoneCell(value){
    const label=clean(value);
    if(!label) return '<span class="link-empty">—</span>';
    const dial=label.replace(/[^0-9+*#]/g,"");
    if(!dial) return escapeHtml(label);
    return '<a class="phone-link" href="tel:'+escapeHtml(dial)+'">'+escapeHtml(label)+'</a>';
  }

  const rowOperator = r => clean(r?.Grupo_Operador)||clean(r?.Operador_Normalizado);

  function traditionalOperatorPresence(operators){
    const names=[...operators].map(fold).filter(Boolean);
    const has=term=>names.some(name=>name.includes(term));
    return {
      tigo:has("tigo"),
      claro:has("claro"),
      movistar:has("movistar")
    };
  }

  function operatorPriorityRank(value){
    const name=fold(value);
    if(name.includes("tigo")) return 0;
    if(name.includes("claro")) return 1;
    if(name.includes("movistar")) return 2;
    return 3;
  }

  function compareOperatorsTraditionalFirst(a,b){
    const aName=typeof a==="string"?a:(a?.operator||rowOperator(a)||"");
    const bName=typeof b==="string"?b:(b?.operator||rowOperator(b)||"");
    const rank=operatorPriorityRank(aName)-operatorPriorityRank(bName);
    if(rank) return rank;
    return clean(aName).localeCompare(clean(bName),"es",{numeric:true,sensitivity:"base"});
  }

  function isInheritedCoverageRow(row){
    const id=clean(row?.ID_Cobertura);
    const notes=fold((row?.Observaciones||"")+" "+(row?.Observacion_Territorial||""));
    return id.startsWith("CV_CPY26_")||notes.includes("heredada del corte 2025-06");
  }

  function competitiveCoverageAllowed(row){
    if(!isInheritedCoverageRow(row)) return true;
    const period=clean(row?.Periodo_Corte);
    const city=clean(row?.Ciudad);
    const operator=rowOperator(row);
    if(!period||!city||!operator) return false;
    return FZ.state.indexes?.confirmedOperatorCityPeriod?.has(period+"|"+city+"|"+operator)===true;
  }

  function trunkCompetitiveSummaryHtml(operators,total=null){
    const names=[...new Map(
      [...operators].map(clean).filter(Boolean).map(name=>[fold(name),name])
    ).values()].sort(compareOperatorsTraditionalFirst);
    const count=total==null?names.length:total;
    const badge=name=>
      '<div class="trunk-market-signal present '+(operatorPriorityRank(name)<3?"traditional":"")+'"><span>'+escapeHtml(name)+'</span></div>';
    return '<div class="trunk-market-summary">'+
      '<div class="trunk-market-total"><span>Competidores</span><b>'+formatNum(count)+'</b></div>'+
      '<div class="trunk-market-traditional trunk-market-all-operators"><span>Operadores presentes</span><div>'+
        (names.length?names.map(badge).join(""):'<small>Sin operadores identificados</small>')+
      '</div></div>'+
    '</div>';
  }

  FZ.u = {
    $,clean,fold,escapeHtml,toNum,formatCOP,formatNum,formatPct,pctVs,priceBand,normalizeTV,
    periodValue,formatPeriod,periodSortValue,formatYearMonth,safeUrl,linkCell,phoneCell,rowOperator,traditionalOperatorPresence,operatorPriorityRank,compareOperatorsTraditionalFirst,isInheritedCoverageRow,competitiveCoverageAllowed,trunkCompetitiveSummaryHtml
  };

  FZ.filterDefs = [
    {key:"period", label:"Corte", getter:r=>FZ.u.clean(r.Periodo_Label), allLabel:"Último corte", maxSelections:1},
    {key:"city", label:"Ciudad / localidad", getter:r=>FZ.u.clean(r.Ciudad), allLabel:"Todas"},
    {key:"operator", label:"Operador", getter:r=>FZ.u.clean(r.Grupo_Operador)||FZ.u.clean(r.Operador_Normalizado), allLabel:"Todos"},
    {key:"technology", label:"Tecnología", getter:r=>FZ.u.clean(r.Tecnologia)||"No informado", allLabel:"Todos"}
  ];

  FZ.columns = [
    ["Periodo_Label","Corte"],
    ["Grupo_Operador","Operador"],
    ["Ciudad","Ciudad"],
    ["Departamento","Departamento"],
    ["Tecnologia","Tecnología"],
    ["Precio_Min_COP","Precio mín."],
    ["Precio_Max_COP","Precio máx."],
    ["Velocidad_Min_Mbps","Velocidad mín."],
    ["Velocidad_Max_Mbps","Velocidad máx."],
    ["Tipo_Servicio","Servicio"],
    ["TV_Incluida","TV"],
    ["Troncales_Ciudad","Troncales"]
  ];

  FZ.contactColumns = [
    ["Grupo_Operador","Operador"],
    ["Ciudades","Ciudades"],
    ["Telefono_1","Teléfono 1"],
    ["Telefono_2","Teléfono 2"],
    ["Telefono_3","Teléfono 3"],
    ["Telefono_4","Teléfono 4"],
    ["Telefono_5","Teléfono 5"],
    ["Sitio_Web","Web"],
    ["Instagram","Instagram"],
    ["Facebook","Facebook"],
    ["TikTok","TikTok"],
    ["Imagenes_Folletos","Material comercial"]
  ];
})();
