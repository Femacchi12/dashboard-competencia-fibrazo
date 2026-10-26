/* MAP-108: pure navigation contract, no writes and no fuzzy operator matching. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FIBRAZO_OPERATOR_NAV=factory();})(typeof window==='undefined'?this:window,function(){
 const clean=v=>String(v??'').trim();
 const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const COMPETITION='https://femacchi12.github.io/dashboard-competencia-fibrazo/';
 function entries(names){let incumbent=0,isp=0;return(names||[]).filter(v=>clean(v)).map(name=>({name:clean(name),label:/^(tigo|claro|movistar)/i.test(clean(name))?'Incumbente '+(++incumbent):/^(sin isp|sin identificar)$/i.test(clean(name))?'Sin identificar':'ISP '+(++isp)})).sort((a,b)=>Number(!a.label.startsWith('Incumbente'))-Number(!b.label.startsWith('Incumbente')));}
 function resolve(catalog,name,city){
  const cityKey=fold(city);let wanted=fold(name);
  if(cityKey==='neiva')wanted=({networ:'networks',wirlet:'wirtel',nov:'novanet',nob:'novanet'})[wanted]||wanted;
  for(const a of catalog.aliases||[])if(fold(a.alias)===wanted&&(!a.cities?.length||a.cities.some(c=>fold(c)===cityKey)))wanted=fold(a.name);
  const national=/^(tigo|claro|movistar)/i.exec(clean(name))?.[1]?.toLowerCase();
  const tech=/\b(HFC|FTTH)\b/i.exec(name)?.[1]?.toUpperCase()||'';
  let matches=(catalog.operators||[]).filter(o=>o.visible!==false&&[o.name,o.brand,o.group].some(v=>fold(v)===wanted));
  if(!matches.length&&national)matches=(catalog.operators||[]).filter(o=>o.visible!==false&&[o.name,o.brand,o.group].some(v=>fold(v)===national));
  const local=matches.filter(o=>(o.cities||[]).some(c=>fold(c)===cityKey));if(local.length)matches=local;
  const base=matches.filter(o=>fold(o.city)===cityKey);if(base.length)matches=base;
  if(tech){const exact=matches.filter(o=>clean(o.tech).toUpperCase()===tech||new RegExp('\\b'+tech+'\\b','i').test(o.name));if(exact.length)matches=exact;}
  const unique=[...new Map(matches.map(o=>[o.id,o])).values()];
  if(unique.length!==1)return{status:unique.length?'ambiguous':'missing',message:unique.length?'Hay varias fichas con este nombre; falta confirmar su identificador.':'Sin ficha disponible en Competencia para este operador.'};
  const op=unique[0];if(cityKey&&!(op.cities||[]).some(c=>fold(c)===cityKey)&&fold(op.city)!==cityKey)return{status:'missing-city',message:'Sin información registrada de este operador en '+clean(city)+'.'};
  return{status:'ready',operator:op,technology:tech};
 }
 function link(result,name,city){if(result.status!=='ready')return'';const u=new URL(COMPETITION);u.searchParams.set('operatorId',result.operator.id);u.searchParams.set('operator',clean(name));if(clean(city))u.searchParams.set('city',clean(city));if(result.technology)u.searchParams.set('technology',result.technology);u.searchParams.set('from','territorial');return u.href;}
 function mapRequest(input){const u=new URL(input,'https://fibrazo-forms.vercel.app/');const take=k=>u.searchParams.getAll(k).map(v=>v.trim()).filter(v=>v&&v.length<=120).slice(0,8);return{only:u.searchParams.get('map')==='only',view:u.searchParams.get('view')==='map'||u.searchParams.get('map')==='only',cities:take('city'),operators:take('operator')};}
 function mapLink(origin,cities=[],operators=[]){const u=new URL('/',origin);u.searchParams.set('view','map');u.searchParams.set('map','only');for(const c of cities.filter(v=>clean(v)&&clean(v)!=='all').slice(0,8))u.searchParams.append('city',clean(c).slice(0,120));if(cities.length===1)for(const o of operators.filter(v=>clean(v)&&clean(v)!=='all').slice(0,8))u.searchParams.append('operator',clean(o).slice(0,120));return u.href;}
 return{clean,fold,entries,resolve,link,mapRequest,mapLink,COMPETITION};
});
