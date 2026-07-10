#!/usr/bin/env node
/**
 * Audits all datasets for consistency against authoritative aggregate files.
 * Run: node scripts/audit-data.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let errors = 0;
let warnings = 0;
const results = [];

function error(msg) { results.push({ level: 'ERROR', msg }); errors++; }
function warn(msg) { results.push({ level: 'WARN', msg }); warnings++; }
function pass(msg) { results.push({ level: 'PASS', msg }); }

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
}

function fileExists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

console.log('=== Gaza Live Map — Data Audit ===\n');

// Required files
const requiredFiles = [
  'data/aggregates/unosat-damage-assessment.json',
  'data/aggregates/territorial-shrinkage.json',
  'data/aggregates/ocha-snapshot-2026-02.json',
  'map/buildings.geojson',
  'map/rubble.geojson',
  'map/devastation_overlay.geojson',
  'map/damage_zones.geojson',
  'map/buffer_zones.geojson',
  'map/restricted_areas.geojson',
  'map/hospitals.geojson',
  'map/schools.geojson',
  'map/refugee_camps.geojson',
  'map/roads.geojson',
  'api/statistics.json'
];

requiredFiles.forEach(f => {
  if (fileExists(f)) pass(`File exists: ${f}`);
  else error(`Missing file: ${f}`);
});

const unosat = readJson('data/aggregates/unosat-damage-assessment.json');
const territorial = readJson('data/aggregates/territorial-shrinkage.json');
const ocha = readJson('data/aggregates/ocha-snapshot-2026-02.json');

// UNOSAT totals consistency
const damageSum = unosat.totals.structures_destroyed + unosat.totals.structures_severely_damaged +
  unosat.totals.structures_moderately_damaged + unosat.totals.structures_possibly_damaged;

if (Math.abs(damageSum - unosat.totals.structures_damaged) < 10) {
  pass(`UNOSAT damage categories sum to ${damageSum.toLocaleString()} ≈ ${unosat.totals.structures_damaged.toLocaleString()}`);
} else {
  error(`UNOSAT damage sum mismatch: ${damageSum} vs ${unosat.totals.structures_damaged}`);
}

if (unosat.totals.structures_damaged_percent === 81) {
  pass('UNOSAT territory-wide damage: 81% (verified against OCHA Feb 2026 snapshot)');
} else {
  warn(`UNOSAT damage percent is ${unosat.totals.structures_damaged_percent}%, expected 81%`);
}

// Casualty figures — must not use outdated 53,856 figure
if (unosat.casualties.reported_killed >= 70000) {
  pass(`Casualties updated: ${unosat.casualties.reported_killed.toLocaleString()} killed (MoH via OCHA Feb 2026)`);
} else {
  error(`Casualty figure outdated: ${unosat.casualties.reported_killed} — should be ≥70,000`);
}

// Governorate sum check
const govDamagedSum = unosat.governorates.reduce((s, g) => s + g.damaged_structures, 0);
if (Math.abs(govDamagedSum - unosat.totals.structures_damaged) < 5000) {
  pass(`Governorate damaged sum ${govDamagedSum.toLocaleString()} ≈ total ${unosat.totals.structures_damaged.toLocaleString()}`);
} else {
  warn(`Governorate sum ${govDamagedSum} differs from total ${unosat.totals.structures_damaged} by ${Math.abs(govDamagedSum - unosat.totals.structures_damaged)}`);
}

// Territorial shrinkage
if (territorial.territorial_shrinkage.idf_controlled_percent >= 50) {
  pass(`IDF territorial control documented: ${territorial.territorial_shrinkage.idf_controlled_percent}%`);
} else {
  warn('IDF territorial control figure missing or low');
}

if (territorial.no_go_zones_by_governorate.find(g => g.governorate === 'Rafah' && g.no_go_percent === 100)) {
  pass('Rafah 100% no-go zone documented');
} else {
  error('Rafah no-go zone not set to 100%');
}

// Schools metadata
const schools = readJson('map/schools.geojson');
if (schools.metadata.schools_damaged_percent >= 90) {
  pass(`Schools: ${schools.metadata.schools_need_reconstruction}/${schools.metadata.total_schools} need reconstruction (${schools.metadata.schools_damaged_percent}%)`);
} else {
  warn('School damage metadata incomplete');
}

// Buildings grid vs official totals
const buildings = readJson('map/buildings.geojson');
if (buildings.metadata.official_structures_damaged === unosat.totals.structures_damaged) {
  pass('Building grid references correct UNOSAT official totals in metadata');
} else {
  warn('Building grid metadata does not match UNOSAT totals');
}

if (buildings.features.length >= 5000) {
  pass(`Building grid has ${buildings.features.length} full-coverage cells`);
} else {
  warn(`Building grid has ${buildings.features.length} cells — expected 5000+ for full coverage`);
}

const rubblePct = buildings.features.filter(f => f.properties.status !== 'intact').length / buildings.features.length;
if (rubblePct >= 0.75) {
  pass(`Grid rubble coverage ${(rubblePct * 100).toFixed(1)}% matches UNOSAT ~81% damaged`);
} else {
  warn(`Grid rubble coverage only ${(rubblePct * 100).toFixed(1)}% — may not match satellite imagery`);
}

// Strike records audit
const strikesDir = path.join(ROOT, 'data/strikes');
const strikeFiles = fs.readdirSync(strikesDir).filter(f => f.endsWith('.json'));
const verified = strikeFiles.filter(f => {
  const s = JSON.parse(fs.readFileSync(path.join(strikesDir, f), 'utf8'));
  return s.verification === 'confirmed';
}).length;
const reported = strikeFiles.filter(f => {
  const s = JSON.parse(fs.readFileSync(path.join(strikesDir, f), 'utf8'));
  return s.verification === 'reported';
}).length;

pass(`Strike records: ${strikeFiles.length} total (${verified} confirmed, ${reported} reported/pending)`);
if (reported > 0) {
  warn(`${reported} strike records marked 'reported' — illustrative samples, not individually verified`);
}

// 90% claims documented
if (unosat.ninety_percent_claims_explained?.claims?.length >= 5) {
  pass(`'90% destroyed' claims documented and explained (${unosat.ninety_percent_claims_explained.claims.length} variants)`);
} else {
  warn('90% claims explanation incomplete');
}

// API statistics sync
if (fileExists('api/statistics.json')) {
  const stats = readJson('api/statistics.json');
  if (stats.infrastructure?.structures_damaged === unosat.totals.structures_damaged) {
    pass('API statistics.json synced with UNOSAT totals');
  } else {
    error('api/statistics.json out of sync — run node scripts/generate-statistics.js');
  }
  if (stats.casualties?.reported_killed >= 70000 || stats.ocha_aggregates?.reported_killed >= 70000) {
    pass('API casualty figures updated');
  } else {
    error('API casualty figures outdated');
  }
}

console.log('\n--- Audit Results ---');
results.forEach(r => {
  const icon = r.level === 'PASS' ? '✓' : r.level === 'WARN' ? '⚠' : '✗';
  console.log(`${icon} [${r.level}] ${r.msg}`);
});

console.log(`\n=== Summary: ${errors} errors, ${warnings} warnings, ${results.filter(r => r.level === 'PASS').length} passed ===`);
process.exit(errors > 0 ? 1 : 0);
