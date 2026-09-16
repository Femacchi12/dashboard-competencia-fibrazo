(function executiveSummaryObserver(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;

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

  function install(){
    const cards=document.getElementById("compare-cards");
    if(!cards||cards.dataset.executiveSummaryObserver==="1") return;
    cards.dataset.executiveSummaryObserver="1";
    new MutationObserver(()=>syncComparator()).observe(cards,{childList:true,subtree:false});
  }

  install();
})();