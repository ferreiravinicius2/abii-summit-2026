// One-shot extractor: reads "2026 Comm KPIs.xlsx" -> writes abii-comm-kpis.js
// Usage: node build_comm_kpis.js
// Output JS sets window.__ABII_COMM_KPIS__ = { CountryName: [{name, measure, ac25, bgt26, le26}, ...] }
// Numbers are taken from the FY column (index 22) of sheet 'Comm KPIs - DATASET'.
// "AC25"  = rows with Actuality "2025 AC"
// "BGT26" = rows with Actuality "2026 BGT"
// "LE26"  = rows with Actuality "2026 LE" OR (latest LE version row, fallback 2026 LE 2+10).
// We deduplicate by country + KPI + actuality (taking the row whose 'Latest LE version' matches col A version, i.e. the freshest LE).

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '2026 Comm KPIs.xlsx');
const DST  = path.join(__dirname, 'abii-comm-kpis.js');

const wb = XLSX.readFile(SRC);
const ws = wb.Sheets['Comm KPIs - DATASET'];
if(!ws){ console.error('Sheet "Comm KPIs - DATASET" not found'); process.exit(1); }
const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true});

// Column indices (0-based):
const C = {
  LATEST_LE: 0,    // "Latest LE version" tag for the row
  CLUSTER: 1,
  HUB: 2,
  COUNTRY: 3,
  ON_OFF: 4,
  KPI: 5,
  ACTUALITY: 6,    // "2025 AC" / "2026 BGT" / "2026 LE"
  MEASURE: 7,
  FY: 22,
  YTD: 20,
  YTG: 21,
};

// Title-case helper for country names ("VENEZUELA" -> "Venezuela", "NEW ZEALAND" -> "New Zealand", "UAE" stays uppercase if short).
function niceCountry(s){
  if(!s) return s;
  const u = String(s).trim();
  if(u.length <= 4 && u === u.toUpperCase()) return u; // UAE
  return u.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Drop trailing/leading whitespace from KPI names so the same KPI doesn't appear twice.
function cleanKpi(s){ return String(s||'').replace(/\s+/g,' ').trim(); }

// Numbers in the workbook are JS Numbers; null/undefined for missing.
function num(v){
  if(v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Dataset: country -> kpi -> { ac25, bgt26, le26, measure }
const out = {};
const order = []; // keep insertion order of KPIs for nicer rendering

const seenKpi = new Set();

for(let i=2; i<rows.length; i++){
  const r = rows[i];
  if(!r) continue;
  const country = niceCountry(r[C.COUNTRY]);
  const kpi     = cleanKpi(r[C.KPI]);
  const act     = String(r[C.ACTUALITY]||'').trim();
  if(!country || !kpi || !act) continue;
  const fy      = num(r[C.FY]);

  if(!out[country]) out[country] = {};
  if(!out[country][kpi]){
    out[country][kpi] = { measure: r[C.MEASURE]||'', ac25:null, bgt26:null, le26:null };
  }
  if(!seenKpi.has(kpi)){ seenKpi.add(kpi); order.push(kpi); }

  // Map actuality to bucket. Latest LE wins for "le26".
  if(act === '2025 AC'){
    if(out[country][kpi].ac25 === null) out[country][kpi].ac25 = fy;
  } else if(act === '2026 BGT'){
    if(out[country][kpi].bgt26 === null) out[country][kpi].bgt26 = fy;
  } else if(act.startsWith('2026 LE')){
    // Always overwrite with later LE if present (the latest version "LE 2+10" rows come after older ones).
    out[country][kpi].le26 = fy;
  }
}

// Re-shape into arrays (preserve KPI insertion order for nicer table layout).
const finalOut = {};
Object.keys(out).sort().forEach(country=>{
  finalOut[country] = order
    .filter(kpi => !!out[country][kpi])
    .map(kpi => Object.assign({ name: kpi }, out[country][kpi]))
    // Drop KPIs where every value is null/0 to avoid showing empty rows.
    .filter(row => (row.ac25 || row.bgt26 || row.le26));
});

const banner = '/* AUTO-GENERATED from "2026 Comm KPIs.xlsx" by build_comm_kpis.js. Do not edit by hand. */\n';
fs.writeFileSync(DST, banner + 'window.__ABII_COMM_KPIS__ = ' + JSON.stringify(finalOut) + ';\n', 'utf8');
console.log('Wrote', DST, '— countries:', Object.keys(finalOut).length, 'kpis:', order.length);
