/* MAP-108: consume an explicit navigation request once, after authenticated data load. */
(()=>{'use strict';
 const FZ=window.FZ,nav=window.FIBRAZO_OPERATOR_NAV;if(!FZ||!nav)return;
 const params=new URLSearchParams(location.search);
 const id=(params.get('operatorId')||'').slice(0,160),name=(params.get('operator')||'').slice(0,120),city=(params.get('city')||'').slice(0,120),tech=(params.get('technology')||'').toUpperCase();
 if(!id&&!name)return;let consumed=false;
 function notice(text){let n=document.getElementById('territorial-link-notice');if(!n){n=document.createElement('div');n.id='territorial-link-notice';n.setAttribute('role','status');n.style.cssText='margin:12px 0;padding:12px 16px;border:1px solid var(--brand-primary,#43FFA5);border-radius:12px;background:var(--brand-surface,#151515);color:var(--brand-text,#F7FAF8);font-family:var(--brand-font-ui,Montserrat,system-ui,sans-serif)';document.querySelector('.filters')?.before(n);}n.textContent=text;}
 function apply(){
  if(consumed)return;const s=FZ.state;
  const catalog={operators:s.operators.map(o=>({id:o.ID_Operador,name:o.Operador_Normalizado,brand:o.Marca_Comercial,group:o.Grupo_Operador,city:o.Ciudad_Base,visible:String(o.Mostrar_Dashboard||'').toLowerCase()!=='no',tech:o.Tecnologia_Principal,cities:[...new Set([...s.coverage,...s.plans].filter(r=>r.ID_Operador===o.ID_Operador).map(r=>r.Ciudad))]})),aliases:[]};
  const found=id?catalog.operators.filter(o=>o.id===id):[];
  const resolved=id?(found.length===1?{status:'ready',operator:found[0]}:{status:'missing'}):nav.resolve(catalog,name,city);
  if(resolved.status!=='ready'||resolved.operator.visible===false){consumed=true;notice('No se encontró una ficha inequívoca y visible de este operador en Competencia. Se conservaron los filtros existentes.');return;}
  const op=resolved.operator;
  let rows=[...s.coverage,...s.plans].filter(r=>r.ID_Operador===op.id);
  const cityMatches=city?[...new Set(rows.map(r=>r.Ciudad))].filter(c=>nav.fold(c)===nav.fold(city)):[];
  if(city&&cityMatches.length!==1){consumed=true;notice('No hay información disponible de '+op.name+' en '+city+'. Se conservaron los filtros existentes.');return;}
  if(city)rows=rows.filter(r=>r.Ciudad===cityMatches[0]);
  if(['HFC','FTTH'].includes(tech))rows=rows.filter(r=>r.Tecnologia===tech);
  const latest=rows.map(r=>r.Periodo_Corte).filter(p=>/^\d{4}-\d{2}$/.test(p)).sort().at(-1);
  if(!rows.length||!latest){consumed=true;notice('La ficha existe, pero no tiene registros con esa ciudad o tecnología. Se conservaron los filtros existentes.');return;}
  const group=rows[0].Grupo_Operador||rows[0].Operador_Normalizado||op.group||op.brand||op.name;
  s.cityScopeMode='custom';s.filters.city.clear();if(city)s.filters.city.add(cityMatches[0]);
  s.filters.operator.clear();s.filters.operator.add(group);s.filters.technology.clear();if(['HFC','FTTH'].includes(tech))s.filters.technology.add(tech);
  s.filters.trunk.clear();s.filters.period.clear();s.filters.period.add(FZ.u.formatPeriod(latest));
  consumed=true;
  notice('Desde Exploración · '+op.name+(city?' · '+cityMatches[0]:'')+(tech?' · '+tech:'')+' · corte '+latest+'. Puedes ajustar los filtros normalmente.');
 }
 window.addEventListener('fz:data-loaded',apply);
})();
