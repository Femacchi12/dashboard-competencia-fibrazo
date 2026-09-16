(function temporaryTrunkVisibility(){
  "use strict";

  const FZ=window.FZ;
  if(!FZ?.data) return;

  const {clean,fold}=FZ.u;
  const state=FZ.state;
  const originalLoad=FZ.data.load.bind(FZ.data);

  function isVisibleTrunk(row){
    const city=fold(row?.Ciudad);
    const trunk=clean(row?.Troncal_FIBRAZO).toUpperCase();

    if(city!=="barranquilla") return true;
    if(!trunk.startsWith("EVA")) return true;

    // Temporary operational rule: only EVA_T02 remains active/visible in Barranquilla.
    return trunk==="EVA_T02";
  }

  function applyVisibilityRule(){
    state.coverage=state.coverage.filter(isVisibleTrunk);
    state.metrics=state.metrics.filter(isVisibleTrunk);

    // Rebuild every trunk/city index after removing temporarily inactive trunks.
    FZ.data.buildIndexes();
  }

  FZ.data.load=async function(...args){
    const result=await originalLoad(...args);
    applyVisibilityRule();
    return {
      ...result,
      coverage:state.coverage.length,
      metrics:state.metrics.length
    };
  };

  FZ.data.isVisibleTrunk=isVisibleTrunk;
})();
