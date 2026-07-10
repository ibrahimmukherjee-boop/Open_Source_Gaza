#!/usr/bin/env node
/**
 * Generates aggregate statistics from verified data records + UNOSAT/OCHA authoritative totals.
 * Run: node scripts/generate-statistics.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STRIKES_DIR = path.join(ROOT, 'data', 'strikes');
const CASUALTIES_DIR = path.join(ROOT, 'data', 'casualties');
const BUILDINGS_FILE = path.join(ROOT, 'map', 'buildings.geojson');
const UNOSAT_FILE = path.join(ROOT, 'data/aggregates/unosat-damage-assessment.json');
const TERRITORIAL_FILE = path.join(ROOT, 'data/aggregates/territorial-shrinkage.json');
const OCHA_FILE = path.join(ROOT, 'data/aggregates/ocha-snapshot-2026-02.json');

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function readGeoJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function countByField(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function strikesPerDay(strikes) {
  return strikes.reduce((acc, s) => {
    acc[s.date] = (acc[s.date] || 0) + 1;
    return acc;
  }, {});
}

function main() {
  const strikes = readJsonDir(STRIKES_DIR);
  const casualties = readJsonDir(CASUALTIES_DIR);
  const buildings = readGeoJson(BUILDINGS_FILE);
  const unosat = JSON.parse(fs.readFileSync(UNOSAT_FILE, 'utf8'));
  const territorial = JSON.parse(fs.readFileSync(TERRITORIAL_FILE, 'utf8'));
  const ocha = JSON.parse(fs.readFileSync(OCHA_FILE, 'utf8'));

  const verifiedStrikes = strikes.filter(s => ['confirmed', 'probable'].includes(s.verification));
  const verifiedCasualties = casualties.filter(c => ['confirmed', 'probable'].includes(c.verification));

  const gridCounts = buildings.features.reduce((acc, f) => {
    acc[f.properties.status] = (acc[f.properties.status] || 0) + 1;
    return acc;
  }, {});

  const stats = {
    generated_at: new Date().toISOString(),
    audit_date: '2026-02-11',
    methodology: "Infrastructure/destruction totals from UNOSAT Oct 2025 + OCHA Feb 2026. Strike records are sample dataset with 8 confirmed incidents.",
    strikes: {
      total: strikes.length,
      verified: verifiedStrikes.length,
      reported_unverified: strikes.filter(s => s.verification === 'reported').length,
      by_verification: countByField(strikes, 'verification'),
      by_facility_type: countByField(strikes, 'facility_type'),
      hospital_strikes: strikes.filter(s => s.hospital_damage).length,
      school_strikes: strikes.filter(s => s.school_damage).length,
      per_day: strikesPerDay(strikes),
      start_date: '2023-10-07',
      latest_date: strikes.sort((a, b) => b.date.localeCompare(a.date))[0]?.date
    },
    casualties: {
      reported_killed: unosat.casualties.reported_killed,
      reported_injured: unosat.casualties.reported_injured,
      reported_killed_identified: unosat.casualties.reported_killed_identified,
      verified_records_in_repo: verifiedCasualties.length,
      aid_workers_killed: unosat.casualties.aid_workers_killed,
      health_workers_killed: unosat.casualties.health_workers_killed,
      as_of: unosat.casualties.as_of,
      source: unosat.casualties.source
    },
    infrastructure: {
      source: 'UNOSAT satellite assessment, 11 October 2025 — verified by OCHA Feb 2026',
      source_url: unosat.url,
      total_structures: unosat.totals.total_structures_estimated,
      structures_damaged: unosat.totals.structures_damaged,
      structures_damaged_percent: unosat.totals.structures_damaged_percent,
      structures_destroyed: unosat.totals.structures_destroyed,
      structures_destroyed_percent: unosat.totals.structures_destroyed_percent_of_total,
      structures_severely_damaged: unosat.totals.structures_severely_damaged,
      structures_moderately_damaged: unosat.totals.structures_moderately_damaged,
      housing_units_damaged: unosat.totals.housing_units_damaged,
      roads_damaged_percent: unosat.totals.roads_damaged_percent,
      schools_need_reconstruction: unosat.infrastructure.schools_need_reconstruction,
      schools_total: unosat.infrastructure.schools_total,
      schools_damaged_percent: unosat.infrastructure.schools_damaged_percent,
      hospitals_non_functional: unosat.infrastructure.hospitals_non_functional,
      cropland_damaged_percent: unosat.infrastructure.cropland_damaged_percent,
      by_governorate: unosat.governorates,
      map_grid_sample: {
        note: 'Visual grid on map — representative sample, not exhaustive UNOSAT footprints',
        cells_total: buildings.features.length,
        by_status: gridCounts
      }
    },
    territorial_shrinkage: {
      gaza_total_area_km2: territorial.gaza_strip_total_area_km2,
      idf_controlled_percent: territorial.territorial_shrinkage.idf_controlled_percent,
      idf_controlled_target_percent: territorial.territorial_shrinkage.idf_controlled_target_percent,
      buffer_and_displacement_orders_percent: territorial.restricted_access.buffer_and_displacement_orders_percent,
      no_go_combined_percent: territorial.restricted_access.no_go_and_displacement_combined_percent,
      displacement_order_area_km2: territorial.restricted_access.displacement_order_area_km2,
      no_go_by_governorate: territorial.no_go_zones_by_governorate,
      buffer_zones: territorial.buffer_zones,
      source: territorial.territorial_shrinkage.idf_controlled_source
    },
    displacement: {
      population_total: unosat.displacement.population_total,
      currently_in_displacement_sites: unosat.displacement.currently_in_displacement_sites,
      currently_displaced_percent: unosat.displacement.currently_displaced_percent,
      ever_displaced_cumulative: unosat.displacement.ever_displaced_cumulative,
      ever_displaced_percent: unosat.displacement.ever_displaced_percent,
      source: unosat.displacement.source
    },
    ninety_percent_claims: unosat.ninety_percent_claims_explained,
    ocha_snapshot: {
      date: ocha.date,
      url: ocha.url
    }
  };

  const statsDir = path.join(ROOT, 'statistics');
  const apiDir = path.join(ROOT, 'api');
  fs.mkdirSync(statsDir, { recursive: true });
  fs.mkdirSync(apiDir, { recursive: true });

  fs.writeFileSync(path.join(statsDir, 'latest.json'), JSON.stringify(stats, null, 2));
  fs.writeFileSync(path.join(apiDir, 'statistics.json'), JSON.stringify(stats, null, 2));
  fs.writeFileSync(path.join(apiDir, 'unosat.json'), JSON.stringify(unosat, null, 2));
  fs.writeFileSync(path.join(apiDir, 'territorial-shrinkage.json'), JSON.stringify(territorial, null, 2));

  const strikesIndex = strikes.map(s => ({
    id: s.strike_id,
    date: s.date,
    time: s.time,
    lat: s.latitude,
    lng: s.longitude,
    verification: s.verification,
    confidence: s.confidence,
    facility_type: s.facility_type,
    casualties: s.casualties_reported || 0,
    destroyed_buildings: s.destroyed_buildings || 0,
    description: s.description
  }));

  fs.writeFileSync(path.join(apiDir, 'strikes.json'), JSON.stringify(strikesIndex, null, 2));
  fs.writeFileSync(path.join(apiDir, 'casualties.json'), JSON.stringify(casualties, null, 2));

  console.log('Statistics generated:');
  console.log(`  Structures damaged: ${stats.infrastructure.structures_damaged.toLocaleString()} (${stats.infrastructure.structures_damaged_percent}%)`);
  console.log(`  Structures destroyed: ${stats.infrastructure.structures_destroyed.toLocaleString()}`);
  console.log(`  Reported killed: ${stats.casualties.reported_killed.toLocaleString()}`);
  console.log(`  IDF controlled: ${stats.territorial_shrinkage.idf_controlled_percent}% of territory`);
  console.log(`  Map grid: ${stats.infrastructure.map_grid_sample.cells_total} cells`);
}

main();
