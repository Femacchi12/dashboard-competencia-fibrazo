const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nav=require('../js/operator-navigation');
// Consumer canonical ID is authoritative; applying a deep link is a one-shot action.
let listener;const filters=()=>({city:new Set(),operator:new Set(),technology:new Set(),trunk:new Set(),period:new Set()});
const state={operators:[{ID_Operador:'OP-NET',Operador_Normalizado:'Networks',Marca_Comercial:'Networks',Ciudad_Base:'Neiva'}],plans:[],coverage:[{ID_Operador:'OP-NET',Ciudad:'Neiva',Grupo_Operador:'Networks',Tecnologia:'Sin validar',Periodo_Corte:'2026-10'}],filters:filters()};
const notice={textContent:''};const dc={window:{FIBRAZO_OPERATOR_NAV:nav,FZ:{state,u:{formatPeriod:v=>v}},addEventListener(_,fn){listener=fn;}},location:{search:'?operatorId=OP-NET&operator=Wrong&city=Neiva'},URLSearchParams,document:{getElementById:()=>notice}};
vm.runInNewContext(fs.readFileSync('js/operator-deeplink.js','utf8'),dc);listener();assert(state.filters.operator.has('Networks'));assert(state.filters.city.has('Neiva'));assert(state.filters.period.has('2026-10'));state.filters.operator.clear();listener();assert.equal(state.filters.operator.size,0);
console.log('PASS108: canonical ID, city, latest available period, and refresh preserves user filters.');
