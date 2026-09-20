(() => {
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;

  const $=id=>document.getElementById(id);
  const clean=v=>String(v??"").trim();
  const fold=v=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const activeStates=new Set(["pendiente","en curso","en progreso","bloqueado","por validar"]);

  function openItems(){
    return (FZ.state.importantPendings||[])
      .filter(r=>fold(r.Mostrar_Dashboard)!=="no")
      .filter(r=>!["cerrado","resuelto","completado"].includes(fold(r.Estado)))
      .sort((a,b)=>{
        const rank={critica:0,"crítica":0,alta:1,media:2,baja:3};
        const ra=rank[fold(a.Prioridad)]??4;
        const rb=rank[fold(b.Prioridad)]??4;
        if(ra!==rb) return ra-rb;
        return clean(a.Ciudad).localeCompare(clean(b.Ciudad),"es",{numeric:true});
      });
  }

  function priorityClass(value){
    const p=fold(value);
    if(p==="critica"||p==="crítica") return "critical";
    if(p==="alta") return "high";
    if(p==="media") return "medium";
    return "low";
  }

  function render(){
    const button=$("important-pendings-btn");
    const count=$("important-pendings-count");
    const list=$("important-pendings-list");
    if(!button||!count||!list) return;

    const items=openItems();
    count.textContent=String(items.length);
    button.classList.toggle("has-items",items.length>0);
    button.title=items.length?items.length+" pendiente"+(items.length===1?"":"s")+" importante"+(items.length===1?"":"s"):"Sin pendientes importantes";

    if(!items.length){
      list.innerHTML='<div class="important-pendings-empty"><b>Sin pendientes abiertos</b><span>Cuando agreguemos uno en la Base General aparecerá aquí.</span></div>';
      return;
    }

    list.innerHTML=items.map(r=>{
      const place=[clean(r.Ciudad),clean(r.Troncal_FIBRAZO)].filter(Boolean).join(" · ");
      const meta=[clean(r.Tipo_Pendiente),clean(r.Responsable)&&fold(r.Responsable)!=="por definir"?"Resp. "+clean(r.Responsable):""].filter(Boolean).join(" · ");
      return '<article class="important-pending-item">'+
        '<div class="important-pending-top">'+
          '<span class="important-pending-priority '+priorityClass(r.Prioridad)+'">'+escapeHtml(clean(r.Prioridad)||"Media")+'</span>'+
          '<span class="important-pending-state">'+escapeHtml(clean(r.Estado)||"Pendiente")+'</span>'+
        '</div>'+
        '<div class="important-pending-place">'+escapeHtml(place||"General")+'</div>'+
        '<h3>'+escapeHtml(clean(r.Pendiente)||"Pendiente sin descripción")+'</h3>'+
        (clean(r.Impacto)?'<p>'+escapeHtml(r.Impacto)+'</p>':"")+
        (meta?'<small>'+escapeHtml(meta)+'</small>':"")+
      '</article>';
    }).join("");
  }

  function setOpen(open){
    const panel=$("important-pendings-panel");
    const backdrop=$("important-pendings-backdrop");
    const button=$("important-pendings-btn");
    if(!panel||!backdrop||!button) return;
    panel.classList.toggle("hidden",!open);
    backdrop.classList.toggle("hidden",!open);
    backdrop.setAttribute("aria-hidden",open?"false":"true");
    button.setAttribute("aria-expanded",open?"true":"false");
    document.body.classList.toggle("important-pendings-open",open);
    if(open){
      render();
      requestAnimationFrame(()=>$("important-pendings-close")?.focus());
    }else{
      button.focus();
    }
  }

  function bind(){
    const button=$("important-pendings-btn");
    const close=$("important-pendings-close");
    const backdrop=$("important-pendings-backdrop");
    if(!button||button.dataset.bound==="1") return;
    button.dataset.bound="1";
    button.addEventListener("click",()=>setOpen(button.getAttribute("aria-expanded")!=="true"));
    close?.addEventListener("click",()=>setOpen(false));
    backdrop?.addEventListener("click",()=>setOpen(false));
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape"&&button.getAttribute("aria-expanded")==="true") setOpen(false);
    });
    window.addEventListener("fz:data-loaded",render);
    render();
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();

  FZ.importantPendings={render,open:()=>setOpen(true),close:()=>setOpen(false)};
})();