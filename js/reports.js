(()=>{
  'use strict';
  const host=document.getElementById('report-content');
  let loaded=false,loading=false,chart=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const p=s=>'<p>'+esc(s)+'</p>';
  function extract(content){
    const lines=String(content).split(/\r?\n|\u000b/).map(x=>x.trim()).filter(Boolean);
    const groups=[];let group={title:'Contexto',lines:[]};
    for(const line of lines){
      if(/^\d+\.\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(line)&&line.length<100){if(group.lines.length)groups.push(group);group={title:line,lines:[]};}
      else group.lines.push(line);
    }
    if(group.lines.length)groups.push(group);
    const full=lines.join(' '), sentence=full.match(/Permanencia:\s*(\d+)\s+de\s+(\d+)\s+ISP[^.]*?(\d+)\s+sí[^.]*?(\d+)\s+tiene condiciones mixtas[^.]*?(\d+)\s+no aportan dato/i);
    return {groups,full,permanence:sentence?{values:[+sentence[1],+sentence[3],+sentence[4],+sentence[5]],total:+sentence[2],source:sentence[0]}:null};
  }
  function render(data){
    const parsed=extract(data.content),sections=parsed.groups.filter(g=>!/^Contexto$/.test(g.title));
    const find=(name)=>sections.find(s=>new RegExp(name,'i').test(s.title));
    const intro=find('introducci[oó]n'),conclusion=find('conclusi[oó]n');
    const preview=(section)=>section?.lines.filter(x=>x.length>55).slice(0,2).join(' ')||'Consulta el documento completo en el detalle.';
    const stat=parsed.permanence;
    host.innerHTML='<header class="report-heading"><span>RELEVAMIENTOS · VILLAVICENCIO</span><h1>Exploración y competencia</h1><p>Un recorrido por el contexto territorial, la infraestructura y los operadores relevados.</p><div class="report-meta"><b>Borrador para revisión</b><span>Campo: 19–20 oct. 2026</span><span>Fuente actualizada: '+esc(data.modifiedTime?new Date(data.modifiedTime).toLocaleDateString('es-CO'):'sin fecha')+'</span></div></header>'+
      '<section class="report-callout"><span>LECTURA EJECUTIVA</span><h2>Una mirada al territorio</h2>'+p(preview(conclusion))+'</section>'+
      '<section class="report-block"><h2>Hallazgos del relevamiento</h2><div class="report-highlights">'+[['Contexto urbano','contexto urbano'],['Infraestructura','infraestructura de telecomunicaciones'],['Competencia','cobertura y competencia']].map(([title,key])=>'<article><h3>'+esc(title)+'</h3>'+p(preview(find(key)))+'</article>').join('')+'</div></section>'+
      (stat?'<section class="report-block"><h2>Condiciones de permanencia</h2><p>Distribución de los ISP locales según el informe de origen. Las categorías reflejan lo documentado en el corte.</p><div class="report-chart"><canvas id="report-permanence" role="img" aria-label="Condiciones de permanencia de los ISP"></canvas></div><details><summary>Ver como tabla</summary><table><thead><tr><th>Condición</th><th>ISP</th></tr></thead><tbody>'+['Sin permanencia','Con permanencia','Condiciones mixtas','Sin dato'].map((x,i)=>'<tr><td>'+x+'</td><td>'+stat.values[i]+'</td></tr>').join('')+'</tbody></table></details>'+p(stat.source)+'</section>':'')+
      '<section class="report-block"><h2>Informe de campo</h2><p>Abre cada sección para consultar su contenido. Esta versión se alimenta del documento fuente y puede contener tablas presentadas como texto.</p>'+sections.map(s=>'<details><summary>'+esc(s.title)+'</summary>'+s.lines.map(p).join('')+'</details>').join('')+'</section>'+
      '<section class="report-block report-limit"><h2>Alcance y fuentes</h2><p>El relevamiento corresponde al 19 y 20 de octubre de 2026. Las observaciones puntuales no demuestran cobertura total o ausencia de operadores en un barrio completo. El documento original es un borrador y su encabezado contiene una referencia a Bucaramanga que requiere revisión.</p><a href="'+esc(data.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Abrir documento fuente ↗</a></section>';
    if(stat&&window.Chart){if(chart)chart.destroy();chart=new Chart(document.getElementById('report-permanence'),{type:'bar',data:{labels:['Sin permanencia','Con permanencia','Mixta','Sin dato'],datasets:[{label:'ISP locales',data:stat.values,backgroundColor:['#16a46f','#4582ce','#e3a24c','#a0aaa5'],borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:true}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});}
  }
  async function show(){
    if(loaded||loading)return;
    const user=window.firebase?.auth()?.currentUser;if(!user){host.textContent='Inicia sesión para consultar el informe.';return;}
    loading=true;host.innerHTML='<p role="status">Cargando el informe desde la fuente corporativa…</p>';
    try{
      const token=await user.getIdToken();
      const preview=location.hostname==='fibrazo-competencia-qa-git-feat-vis-4f6fa2-fernandoemacchi-9206.vercel.app';
      const base=preview?'https://fibrazo-forms-git-feat-visual-dashb-fff851-fernandoemacchi-9206.vercel.app':'https://fibrazo-forms.vercel.app';
      const response=await fetch(base+'/api/isps?report=villavicencio',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(!response.ok)throw Error('REPORT_UNAVAILABLE');
      render(await response.json());loaded=true;
    }catch(e){host.innerHTML='<h2>Informe no disponible</h2><p>No fue posible consultar el documento corporativo. Puedes volver a intentar o abrir la fuente directamente.</p><button type="button" id="report-retry">Reintentar</button> <a href="https://docs.google.com/document/d/1XDJCVQtxBvyWfqKU4Z5IhtQDLJwKQNqwE4vhIHMAo5M/edit" target="_blank" rel="noopener noreferrer">Abrir documento fuente ↗</a>';document.getElementById('report-retry').addEventListener('click',show);}
    finally{loading=false;}
  }
  document.getElementById('report-villavicencio')?.addEventListener('click',show);
  document.getElementById('report-load')?.addEventListener('click',show);
  window.FibrazoReports={show};
})();
