(function temporaryVisibilityRules(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ) return;
  const state=FZ.state;
  const {clean,fold}=FZ.u;

  function normalizedTrunk(value){
    return clean(value).toUpperCase().replace(/[\s-]+/g,"_");
  }

  function isHiddenBarranquillaEva(row){
    if(fold(row?.Ciudad)!=="barranquilla") return false;
    const trunk=normalizedTrunk(row?.Troncal_FIBRAZO);
    if(!trunk||!trunk.startsWith("EVA")) return false;
    return trunk!=="EVA_T02";
  }

  function isHiddenTrunkName(value){
    const trunk=normalizedTrunk(value);
    return trunk.startsWith("EVA")&&trunk!=="EVA_T02";
  }

  function applyVisibilityRules(){
    let changed=false;

    if(Array.isArray(state.coverage)){
      const before=state.coverage.length;
      state.coverage=state.coverage.filter(row=>!isHiddenBarranquillaEva(row));
      changed=changed||state.coverage.length!==before;
    }

    if(Array.isArray(state.metrics)){
      const before=state.metrics.length;
      state.metrics=state.metrics.filter(row=>!isHiddenBarranquillaEva(row));
      changed=changed||state.metrics.length!==before;
    }

    if(state.filters?.trunk instanceof Set){
      for(const trunk of [...state.filters.trunk]){
        if(isHiddenTrunkName(trunk)){
          state.filters.trunk.delete(trunk);
          changed=true;
        }
      }
    }

    if(changed) FZ.data?.buildIndexes?.();
    return changed;
  }

  if(FZ.data?.load&&!FZ.data.__temporaryVisibilityWrapped){
    const originalLoad=FZ.data.load;
    FZ.data.load=async function(...args){
      const result=await originalLoad.apply(this,args);
      applyVisibilityRules();
      return {
        ...result,
        coverage:Array.isArray(state.coverage)?state.coverage.length:result?.coverage,
        metrics:Array.isArray(state.metrics)?state.metrics.length:result?.metrics
      };
    };
    FZ.data.__temporaryVisibilityWrapped=true;
  }

  if(FZ.app?.renderAll&&!FZ.app.__temporaryVisibilityWrapped){
    const originalRenderAll=FZ.app.renderAll;
    FZ.app.renderAll=function(...args){
      applyVisibilityRules();
      return originalRenderAll.apply(this,args);
    };
    FZ.app.__temporaryVisibilityWrapped=true;
  }

  function refreshAfterInitialLoad(){
    const changed=applyVisibilityRules();
    if(!changed) return;
    FZ.filters?.renderCityQuickbar?.();
    FZ.filters?.renderFilters?.();
    FZ.filters?.apply?.();
  }

  refreshAfterInitialLoad();

  let attempts=0;
  const timer=window.setInterval(()=>{
    attempts+=1;
    refreshAfterInitialLoad();
    if((!state.loading&&(state.coverage?.length||state.metrics?.length))||attempts>=40){
      window.clearInterval(timer);
    }
  },250);

  FZ.visibilityRules={
    ...(FZ.visibilityRules||{}),
    isHiddenBarranquillaEva,
    apply:applyVisibilityRules
  };
})();
