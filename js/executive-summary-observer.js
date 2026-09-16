(function executiveSummaryObserver(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;

  const refinementVersion="20260916-03";
  let syncing=false;
  let scheduled=false;

  function syncComparator(){
    if(syncing||scheduled||FZ.state?.analysisView!=="compare") return;
    scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;
      if(syncing||FZ.state?.analysisView!=="compare") return;
      syncing=true;
      try{
        FZ.comparison?.renderComparator?.();
      }finally{
        requestAnimationFrame(()=>{syncing=false;});
      }
    });
  }

  function loadRefinement(){
    if(!document.getElementById("executive-summary-refinement-css")){
      const link=document.createElement("link");
      link.id="executive-summary-refinement-css";
      link.rel="stylesheet";
      link.href="executive-summary-refinement.css?v="+encodeURIComponent(refinementVersion);
      document.head.appendChild(link);
    }
    if(document.querySelector('script[data-executive-summary-refinement]')) return;
    const script=document.createElement("script");
    script.src="js/executive-summary-refinement.js?v="+encodeURIComponent(refinementVersion);
    script.dataset.executiveSummaryRefinement="true";
    document.body.appendChild(script);
  }

  function install(){
    const cards=document.getElementById("compare-cards");
    if(cards&&cards.dataset.executiveSummaryObserver!=="1"){
      cards.dataset.executiveSummaryObserver="1";
      new MutationObserver(()=>syncComparator()).observe(cards,{childList:true,subtree:false});
    }
    loadRefinement();
  }

  install();
})();
