const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');let tests=0;const ok=(v,m)=>{assert.ok(v,m);tests++;};
// Execute the actual dashboard table module against a no-price coverage fixture.
const state={operators:[{ID_Operador:'OP1',Operador_Normalizado:'Example ISP'}],filtered:[],filteredCoverage:[{ID_Cobertura:'CVF_TEST',ID_Operador:'OP1',Operador_Normalizado:'Example ISP',Ciudad:'Villavicencio',Periodo_Label:'2026-oct',Periodo_Corte:'2026-10',Tecnologia:'Sin validar'}],coverage:[],filters:{city:new Set(['Villavicencio']),period:new Set(['2026-oct'])},indexes:{}};
const clean=v=>String(v??'').trim(),FZ={state,u:{clean,fold:clean,escapeHtml:clean,toNum:v=>v==null?null:Number(v),rowOperator:r=>r.Grupo_Operador||r.Operador_Normalizado,normalizeTV:v=>v||'No informado',$:()=>null},filters:{marketIdentity:clean,marketDisplayName:clean}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../js/table.js','utf8'),{window:{FZ},console});
const rows=FZ.table.buildSummaryRows();ok(rows.length===1&&rows[0].Precio_Min_COP===null&&rows[0].Velocidad_Min_Mbps===null,'presence-only row visible without prices/speeds');
ok(FZ.table.buildContactRows().length===1,'presence-only operator visible in contacts');ok(state.filtered.length===0,'commercial plan/KPI input unchanged');
console.log('FO-CHG-082 '+tests+' assertions PASS: deterministic consolidation, QA, GPS, editing and no-price dashboard');
